// FULL POOL CENSUS, Robinhood Chain (4663), for every asset Fables runs.
// Enumerates v4 (gateway topV4Pools), v3 (factory.getPool over every fee tier, exhaustive) and
// v2 (gateway topV2Pairs), then pulls a week of hourly volume and fee buckets for each so the
// efficiency metrics come from the same source for Fables and for every rival.
import fs from 'node:fs'

const ORIGIN = 'https://app.uniswap.org'
const GQL = 'https://interface.gateway.uniswap.org/v1/graphql'
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'
const RPC = 'https://rpc.mainnet.chain.robinhood.com'
const V3_FACTORY = '0x1f7d7550b1b028f7571e69a784071f0205fd2efa'

const TOK = {
  USDG: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  WETH: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  SPY: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
  NVDA: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
  GLD: '0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e',
  META: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35',
  TSLA: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
  AAPL: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
}
const ASSETS = ['SPY', 'NVDA', 'GLD', 'META', 'TSLA', 'AAPL']
const FEE_TIERS = [100, 200, 250, 300, 400, 500, 1000, 1500, 2500, 3000, 5000, 10000, 20000]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const lc = (a) => (a || '').toLowerCase()

async function rpc(to, data) {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      })
      const j = await res.json()
      if (j.error) throw new Error(JSON.stringify(j.error))
      return j.result
    } catch (e) {
      await sleep(1200 + i * 900)
    }
  }
  return null
}
const pad = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0')
const padN = (n) => n.toString(16).padStart(64, '0')

async function gql(query, variables) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(GQL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
        body: JSON.stringify({ operationName: 'Q', query, variables }),
      })
      const j = await res.json()
      if (j.errors) console.error('GQL', JSON.stringify(j.errors).slice(0, 400))
      if (j.data) return j.data
    } catch (e) {}
    await sleep(1500 + i * 1000)
  }
  return {}
}

async function hist(id, version) {
  // version: 3 for v4 pools, 2 for v3, 1 for v2 (the endpoint's own numbering)
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(HIST, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
        body: JSON.stringify({ pool: { chainId: 'ROBINHOOD', addressOrId: id, version }, duration: 'HISTORY_DURATION_WEEK' }),
      })
      const j = await res.json()
      if (j.buckets) return j.buckets.map((x) => ({ t: Number(x.timestamp), v: Number(x.volumeUsd) || 0, f: Number(x.feeUsd) || 0 }))
    } catch (e) {}
    await sleep(900 + i * 700)
  }
  return []
}

const POOL_FIELDS = `
  feeTier txCount
  token0 { address symbol decimals market { price { value } } } token0Supply
  token1 { address symbol decimals market { price { value } } } token1Supply
  totalLiquidity { value }
  volume24h: cumulativeVolume(duration: DAY) { value }
`
const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null)
const priceOf = (t) => {
  const u = num(t && t.market && t.market.price ? t.market.price.value : null)
  return u !== null && u > 0 ? u : null
}
function tvlOf(p) {
  const p0 = priceOf(p.token0),
    p1 = priceOf(p.token1)
  const s0 = num(p.token0Supply),
    s1 = num(p.token1Supply)
  if (p0 === null || p1 === null || s0 === null || s1 === null) return num(p.totalLiquidity ? p.totalLiquidity.value : null)
  return Math.max(0, s0) * p0 + Math.max(0, s1) * p1
}

// ---------- 1. v4 via topV4Pools ----------
console.error('enumerating v4 ...')
const v4 = await gql(
  `query Q($chain: Chain!, $first: Int!) { topV4Pools(chain: $chain, first: $first) { poolId isDynamicFee hook { address } ${POOL_FIELDS} } }`,
  { chain: 'ROBINHOOD', first: 1000 },
)
const allV4 = v4.topV4Pools || []
console.error('  v4 pools returned:', allV4.length)

// ---------- 2. v2 via topV2Pairs ----------
console.error('enumerating v2 ...')
const v2 = await gql(
  `query Q($chain: Chain!, $first: Int!) { topV2Pairs(chain: $chain, first: $first) { address ${POOL_FIELDS} } }`,
  { chain: 'ROBINHOOD', first: 1000 },
)
const allV2 = v2.topV2Pairs || []
console.error('  v2 pairs returned:', allV2.length)

// ---------- 3. v3 exhaustively via the factory ----------
console.error('enumerating v3 by factory.getPool over every fee tier ...')
const PAIRS = []
for (const a of ASSETS) {
  PAIRS.push([a, 'USDG'], [a, 'WETH'])
}
PAIRS.push(['WETH', 'USDG'], ['NVDA', 'SPY'], ['SPY', 'GLD'], ['NVDA', 'GLD'], ['META', 'SPY'], ['TSLA', 'SPY'], ['AAPL', 'SPY'])
const v3Found = []
for (const [x, y] of PAIRS) {
  for (const fee of FEE_TIERS) {
    const data = '0x1698ee82' + pad(TOK[x]) + pad(TOK[y]) + padN(fee)
    const r = await rpc(V3_FACTORY, data)
    if (!r) continue
    const addr = '0x' + r.slice(-40)
    if (BigInt(addr) === 0n) continue
    v3Found.push({ pair: `${x}/${y}`, fee, address: addr })
  }
}
console.error('  v3 pools found:', v3Found.length)

// ---------- 4. fetch v3 pool nodes ----------
const v3Nodes = []
for (let i = 0; i < v3Found.length; i += 10) {
  const chunk = v3Found.slice(i, i + 10)
  const args = chunk.map((_, j) => `$p${j}: String!`).join(', ')
  const roots = chunk.map((_, j) => `  a${j}: v3Pool(chain: $chain, address: $p${j}) { ${POOL_FIELDS} }`).join('\n')
  const vars = { chain: 'ROBINHOOD' }
  chunk.forEach((c, j) => (vars['p' + j] = c.address))
  const d = await gql(`query Q($chain: Chain!, ${args}) {\n${roots}\n}`, vars)
  chunk.forEach((c, j) => {
    const node = d['a' + j]
    if (node) v3Nodes.push({ ...c, node })
  })
  await sleep(200)
}
console.error('  v3 nodes priced:', v3Nodes.length)

// ---------- 5. keep only pools touching our assets ----------
const OURS = new Set(Object.values(TOK).map(lc))
OURS.add('0x0000000000000000000000000000000000000000')
const touches = (n) => OURS.has(lc(n.token0 && n.token0.address)) && OURS.has(lc(n.token1 && n.token1.address))

const rows = []
for (const p of allV4) {
  if (!touches(p)) continue
  rows.push({ proto: 'v4', id: p.poolId, hook: p.hook ? p.hook.address : null, isDynamicFee: !!p.isDynamicFee, node: p, histVersion: 3 })
}
for (const p of allV2) {
  if (!touches(p)) continue
  rows.push({ proto: 'v2', id: p.address, hook: null, isDynamicFee: false, node: p, histVersion: 1 })
}
for (const p of v3Nodes) {
  if (!touches(p.node)) continue
  rows.push({ proto: 'v3', id: p.address, hook: null, isDynamicFee: false, node: p.node, histVersion: 2 })
}
console.error('pools touching our assets:', rows.length)

// ---------- 6. week of buckets for each ----------
const out = []
for (const r of rows) {
  const n = r.node
  const b = await hist(r.id, r.histVersion)
  out.push({
    proto: r.proto,
    id: r.id,
    hook: r.hook,
    isDynamicFee: r.isDynamicFee,
    sym0: n.token0 ? n.token0.symbol : null,
    sym1: n.token1 ? n.token1.symbol : null,
    addr0: n.token0 ? n.token0.address : null,
    addr1: n.token1 ? n.token1.address : null,
    feeTier: num(n.feeTier),
    txCount: Number(n.txCount) || null,
    tvlUsd: tvlOf(n),
    tvlGateway: num(n.totalLiquidity ? n.totalLiquidity.value : null),
    vol24hGw: num(n.volume24h ? n.volume24h.value : null),
    buckets: b,
  })
  await sleep(140)
}
fs.writeFileSync('data/census.json', JSON.stringify({ fetchedAt: new Date().toISOString(), v3Factory: V3_FACTORY, feeTiersProbed: FEE_TIERS, out }))
console.error('wrote data/census.json with', out.length, 'pools')
for (const o of out) {
  const v7 = o.buckets.reduce((a, x) => a + x.v, 0)
  console.error(
    `${o.proto} ${(o.sym0 + '/' + o.sym1).padEnd(12)} fee=${String(o.feeTier).padStart(6)} dyn=${o.isDynamicFee ? 'Y' : 'n'} hook=${o.hook ? o.hook.slice(0, 8) : '-'} tvl=${Math.round(o.tvlUsd || 0).toLocaleString().padStart(12)} vol7d=${Math.round(v7).toLocaleString().padStart(13)} buckets=${o.buckets.length}`,
  )
}
