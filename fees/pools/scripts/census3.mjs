// Top-up: native ETH/USDG v4 pools (tokenFilter cannot match the zero-address native leg) and a
// completeness check that no per-token topV4Pools call was truncated at the 100 cap.
import fs from 'node:fs'
const ORIGIN = 'https://app.uniswap.org'
const GQL = 'https://interface.gateway.uniswap.org/v1/graphql'
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const NATIVE_V4 = [
  '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551', // Fables ETH/USDG
  '0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32', // rival 577 native, dominant
  '0x387bf619da4d3fb62bb276482693dba1b9b3520f573cabdfe033384a24125982', // rival 625 native
]
const COMMON = `
  token0 { address symbol decimals market { price { value } } } token0Supply
  token1 { address symbol decimals market { price { value } } } token1Supply
  totalLiquidity { value } txCount
  volume24h: cumulativeVolume(duration: DAY) { value }
`
async function gql(query, variables) {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(GQL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
        body: JSON.stringify({ operationName: 'Q', query, variables }),
      })
      const j = await res.json()
      if (j.errors) console.error('GQL', JSON.stringify(j.errors).slice(0, 300))
      if (j.data) return j.data
    } catch (e) {}
    await sleep(1200 + i * 900)
  }
  return {}
}
async function hist(id, version) {
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
    await sleep(800 + i * 600)
  }
  return []
}
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

// completeness probe: did any per-token call hit the 100 cap?
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
console.error('COMPLETENESS: pools returned per tokenFilter (100 = capped, coverage incomplete)')
for (const [sym, addr] of Object.entries(TOK)) {
  const d = await gql(`query Q($chain: Chain!, $t: String!) { topV4Pools(chain: $chain, first: 100, tokenFilter: $t) { poolId totalLiquidity { value } } }`, {
    chain: 'ROBINHOOD',
    t: addr,
  })
  const a = d.topV4Pools || []
  const tail = a.length ? (a[a.length - 1].totalLiquidity || {}).value : null
  console.error(`  ${sym.padEnd(5)} ${String(a.length).padStart(4)}${a.length >= 100 ? '  *** CAPPED ***' : ''}  smallest TVL returned ${tail === null ? 'n/a' : Math.round(tail)}`)
  await sleep(350)
}

const prev = JSON.parse(fs.readFileSync('data/census.json', 'utf8'))
const have = new Set(prev.out.map((r) => r.id))
const add = []
for (const pid of NATIVE_V4) {
  if (have.has(pid)) continue
  const d = await gql(`query Q($chain: Chain!, $p: String!) { v4Pool(chain: $chain, poolId: $p) { poolId feeTier isDynamicFee tickSpacing hook { address } ${COMMON} } }`, {
    chain: 'ROBINHOOD',
    p: pid,
  })
  const n = d.v4Pool
  if (!n) {
    console.error('  no node for', pid)
    continue
  }
  const b = await hist(pid, 3)
  add.push({
    proto: 'v4',
    id: pid,
    hook: n.hook ? n.hook.address : null,
    isDynamicFee: !!n.isDynamicFee,
    tickSpacing: num(n.tickSpacing),
    sym0: n.token0 ? n.token0.symbol : 'ETH',
    sym1: n.token1 ? n.token1.symbol : null,
    addr0: n.token0 ? n.token0.address : '0x0000000000000000000000000000000000000000',
    addr1: n.token1 ? n.token1.address : null,
    feeTier: num(n.feeTier),
    txCount: Number(n.txCount) || null,
    tvlUsd: tvlOf(n),
    tvlGateway: num(n.totalLiquidity ? n.totalLiquidity.value : null),
    vol24hGw: num(n.volume24h ? n.volume24h.value : null),
    buckets: b,
  })
  console.error(`  added ${n.token0 ? n.token0.symbol : 'ETH'}/${n.token1 ? n.token1.symbol : '?'} fee=${n.feeTier} tvl=${Math.round(tvlOf(n) || 0)} buckets=${b.length}`)
  await sleep(200)
}
prev.out.push(...add)
fs.writeFileSync('data/census.json', JSON.stringify(prev))
console.error('census now holds', prev.out.length, 'pools')
