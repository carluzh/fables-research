// CAPITAL EFFICIENCY, measured the way a v4 hook is supposed to win it:
//   k = 2 * L * sqrt(P) / TVL = virtual depth per dollar deposited.
// k = 1 is a full-range v2 pool. k = 100 means a dollar in this pool quotes like a hundred dollars
// in a v2 pool at the current price. Read live from chain: v3 pools via slot0()/liquidity(),
// v4 pools via StateView.getSlot0/getLiquidity, so Fables and every rival are measured identically.
import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'

const RPC = 'https://rpc.mainnet.chain.robinhood.com'
const STATE_VIEW = '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b'
const ORIGIN = 'https://app.uniswap.org'
const GQL = 'https://interface.gateway.uniswap.org/v1/graphql'
const c = createPublicClient({ transport: http(RPC) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const V3_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
])
const V2_ABI = parseAbi(['function getReserves() view returns (uint112 r0, uint112 r1, uint32 ts)'])
const SV_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
])

async function call(fn) {
  for (let i = 0; i < 7; i++) {
    try {
      return await fn()
    } catch (e) {
      const s = String(e)
      if (!/429|Rate|Too Many|timeout|timed out|fetch failed/i.test(s) && i > 2) throw e
      await sleep(1500 + i * 1500)
    }
  }
  return null
}

const census = JSON.parse(fs.readFileSync('data/census.json', 'utf8'))
// only pools that matter: at least 10k of TVL and some flow
const CAND = census.out.filter((p) => (p.tvlUsd || 0) >= 10000 && p.buckets.reduce((a, x) => a + x.v, 0) > 0)
console.error('measuring depth on', CAND.length, 'pools')

// token prices and decimals, straight off the gateway, one batch
const addrs = [...new Set(CAND.flatMap((p) => [p.addr0, p.addr1]).filter(Boolean))]
const args = addrs.map((_, i) => `$a${i}: String!`).join(', ')
const roots = addrs.map((_, i) => `  t${i}: token(chain: $chain, address: $a${i}) { address symbol decimals market(currency: USD) { price { value } } }`).join('\n')
const vars = { chain: 'ROBINHOOD' }
addrs.forEach((a, i) => (vars['a' + i] = a))
let PX = {}
try {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
    body: JSON.stringify({ operationName: 'T', query: `query T($chain: Chain!, ${args}) {\n${roots}\n}`, variables: vars }),
  })
  const j = await res.json()
  if (j.errors) console.error('token GQL', JSON.stringify(j.errors).slice(0, 300))
  for (let i = 0; i < addrs.length; i++) {
    const t = (j.data || {})['t' + i]
    if (t) PX[addrs[i].toLowerCase()] = { sym: t.symbol, dec: Number(t.decimals), usd: t.market && t.market.price ? Number(t.market.price.value) : null }
  }
} catch (e) {
  console.error('token batch failed', String(e).slice(0, 200))
}
// native ETH and any gap: fall back to the WETH mark
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73'
PX['0x0000000000000000000000000000000000000000'] = { sym: 'ETH', dec: 18, usd: PX[WETH] ? PX[WETH].usd : null }
console.error('priced tokens:', Object.entries(PX).map(([a, v]) => `${v.sym}=${v.usd === null ? 'null' : Math.round(v.usd)}`).join(' '))

const out = []
for (const p of CAND) {
  let L = null, sqrtP = null
  if (p.proto === 'v3') {
    const s = await call(() => c.readContract({ address: p.id, abi: V3_ABI, functionName: 'slot0' }))
    const l = await call(() => c.readContract({ address: p.id, abi: V3_ABI, functionName: 'liquidity' }))
    if (s && l !== null) { sqrtP = Number(s[0]) / 2 ** 96; L = Number(l) }
  } else if (p.proto === 'v4') {
    const s = await call(() => c.readContract({ address: STATE_VIEW, abi: SV_ABI, functionName: 'getSlot0', args: [p.id] }))
    const l = await call(() => c.readContract({ address: STATE_VIEW, abi: SV_ABI, functionName: 'getLiquidity', args: [p.id] }))
    if (s && l !== null) { sqrtP = Number(s[0]) / 2 ** 96; L = Number(l) }
  } else if (p.proto === 'v2') {
    const r = await call(() => c.readContract({ address: p.id, abi: V2_ABI, functionName: 'getReserves' }))
    if (r) {
      const d0 = (PX[(p.addr0 || '').toLowerCase()] || {}).dec ?? 18
      const d1 = (PX[(p.addr1 || '').toLowerCase()] || {}).dec ?? 18
      const r0 = Number(r[0]) / 10 ** d0, r1 = Number(r[1]) / 10 ** d1
      L = Math.sqrt(r0 * r1); sqrtP = Math.sqrt(r1 / r0)
      // for v2, k is 1 by construction
      out.push({ ...meta(p), k: 1, virtual: p.tvlUsd, L: null, sqrtP: null, note: 'v2 is full range by construction' })
      await sleep(90)
      continue
    }
  }
  if (L === null || sqrtP === null || !(sqrtP > 0)) {
    out.push({ ...meta(p), k: null, virtual: null, note: 'read failed' })
    await sleep(90)
    continue
  }
  const t0 = PX[(p.addr0 || '').toLowerCase()] || {}
  const t1 = PX[(p.addr1 || '').toLowerCase()] || {}
  // value the pool in whichever leg we can price, preferring a stable/quote leg
  let virtual = null
  if (t1.usd) virtual = ((2 * L * sqrtP) / 10 ** t1.dec) * t1.usd
  else if (t0.usd) virtual = ((2 * L) / sqrtP / 10 ** t0.dec) * t0.usd
  const k = virtual && p.tvlUsd > 0 ? virtual / p.tvlUsd : null
  out.push({ ...meta(p), k, virtual, L, sqrtP, note: null })
  await sleep(90)
}

function meta(p) {
  const v7 = p.buckets.reduce((a, x) => a + x.v, 0)
  const f7 = p.buckets.reduce((a, x) => a + x.f, 0)
  return {
    id: p.id, proto: p.proto, pair: `${p.sym0}/${p.sym1}`, fee: p.feeTier, dyn: !!p.isDynamicFee,
    tvl: p.tvlUsd, v7, f7, addr0: p.addr0, addr1: p.addr1,
  }
}

fs.writeFileSync('data/depth.json', JSON.stringify({ fetchedAt: new Date().toISOString(), out }, null, 1))
console.error('wrote data/depth.json,', out.filter((o) => o.k).length, 'of', out.length, 'measured')

const FAB = new Set([
  '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd',
  '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd',
  '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551',
  '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a',
  '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5',
])
const QUOTES = new Set(['USDG', 'WETH', 'ETH'])
const assetOf = (o) => {
  const non = o.pair.split('/').filter((s) => !QUOTES.has(s))
  return non.length === 0 ? 'ETH' : non.length === 2 ? non.sort().join('/') + ' cross' : non[0]
}
const groups = {}
for (const o of out) (groups[assetOf(o)] = groups[assetOf(o)] || []).push(o)
console.error('\nDEPTH PER DOLLAR (k). Higher = a dollar of TVL quotes like k dollars of v2 depth.')
for (const a of ['SPY', 'NVDA', 'GLD', 'META', 'ETH', 'TSLA', 'AAPL']) {
  const g = (groups[a] || []).filter((o) => o.k).sort((x, y) => y.k - x.k)
  if (!g.length) continue
  console.error(`\n=== ${a} ===`)
  console.error(
    '   ' + 'proto'.padEnd(6) + 'pair'.padEnd(12) + 'fee'.padStart(8) + 'TVL$'.padStart(12) + 'k'.padStart(10) + 'virtual$'.padStart(16) + 'fee/virtual bps/yr'.padStart(20),
  )
  for (const o of g) {
    const mark = FAB.has(o.id) ? '>>' : '  '
    const fpv = o.virtual > 0 ? (o.f7 * (365 / 7)) / o.virtual * 10000 : NaN
    console.error(`${mark.padEnd(3)}${o.proto.padEnd(6)}${o.pair.padEnd(12)}${String(Math.round(o.fee)).padStart(8)}${Math.round(o.tvl).toLocaleString().padStart(12)}${o.k.toFixed(1).padStart(10)}${Math.round(o.virtual).toLocaleString().padStart(16)}${fpv.toFixed(1).padStart(20)}`)
  }
  const f = g.find((o) => FAB.has(o.id))
  if (f) console.error(`    -> Fables rank ${g.indexOf(f) + 1}/${g.length} on k`)
}
