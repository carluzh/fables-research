// v4 and v2 legs of the census, merged onto the v3 rows census.mjs already wrote.
// topV4Pools caps `first` at 100 and takes no cursor, so completeness comes from running it once
// per token with tokenFilter and taking the union.
import fs from 'node:fs'

const ORIGIN = 'https://app.uniswap.org'
const GQL = 'https://interface.gateway.uniswap.org/v1/graphql'
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const lc = (a) => (a || '').toLowerCase()

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
    await sleep(1500 + i * 1200)
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
    await sleep(900 + i * 700)
  }
  return []
}
const COMMON = `
  token0 { address symbol decimals market { price { value } } } token0Supply
  token1 { address symbol decimals market { price { value } } } token1Supply
  totalLiquidity { value }
  txCount
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

const OURS = new Set(Object.values(TOK).map(lc))
OURS.add('0x0000000000000000000000000000000000000000')
const touches = (n) => OURS.has(lc(n.token0 && n.token0.address)) && OURS.has(lc(n.token1 && n.token1.address))

// ---- v4: one topV4Pools call per token, union by poolId ----
const v4map = new Map()
for (const [sym, addr] of Object.entries(TOK)) {
  const d = await gql(
    `query Q($chain: Chain!, $t: String!) { topV4Pools(chain: $chain, first: 100, tokenFilter: $t) { poolId feeTier isDynamicFee tickSpacing hook { address } ${COMMON} } }`,
    { chain: 'ROBINHOOD', t: addr },
  )
  const arr = d.topV4Pools || []
  let kept = 0
  for (const p of arr) {
    if (!p || !p.poolId) continue
    if (!touches(p)) continue
    if (!v4map.has(p.poolId)) {
      v4map.set(p.poolId, p)
      kept++
    }
  }
  console.error(`  v4 tokenFilter ${sym}: ${arr.length} returned, ${kept} new pools on our assets`)
  await sleep(400)
}
console.error('v4 union on our assets:', v4map.size)

// ---- v2 ----
const v2d = await gql(`query Q($chain: Chain!) { topV2Pairs(chain: $chain, first: 100) { address ${COMMON} } }`, { chain: 'ROBINHOOD' })
const allV2 = (v2d.topV2Pairs || []).filter((p) => p && touches(p))
console.error('v2 pairs on our assets:', allV2.length)

// ---- merge with the v3 rows already written ----
const prev = JSON.parse(fs.readFileSync('data/census.json', 'utf8'))
const out = prev.out.filter((r) => r.proto === 'v3')
console.error('carried over v3 rows:', out.length)

for (const [poolId, n] of v4map) {
  const b = await hist(poolId, 3)
  out.push({
    proto: 'v4',
    id: poolId,
    hook: n.hook ? n.hook.address : null,
    isDynamicFee: !!n.isDynamicFee,
    tickSpacing: num(n.tickSpacing),
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
for (const n of allV2) {
  const b = await hist(n.address, 1)
  out.push({
    proto: 'v2',
    id: n.address,
    hook: null,
    isDynamicFee: false,
    sym0: n.token0 ? n.token0.symbol : null,
    sym1: n.token1 ? n.token1.symbol : null,
    addr0: n.token0 ? n.token0.address : null,
    addr1: n.token1 ? n.token1.address : null,
    feeTier: 3000,
    txCount: Number(n.txCount) || null,
    tvlUsd: tvlOf(n),
    tvlGateway: num(n.totalLiquidity ? n.totalLiquidity.value : null),
    vol24hGw: num(n.volume24h ? n.volume24h.value : null),
    buckets: b,
  })
  await sleep(140)
}

fs.writeFileSync('data/census.json', JSON.stringify({ fetchedAt: new Date().toISOString(), v3Factory: prev.v3Factory, feeTiersProbed: prev.feeTiersProbed, out }))
console.error('\nwrote data/census.json with', out.length, 'pools')
const FABLES_HOOKS = new Set()
for (const o of out) {
  const v7 = o.buckets.reduce((a, x) => a + x.v, 0)
  const f7 = o.buckets.reduce((a, x) => a + x.f, 0)
  console.error(
    `${o.proto} ${((o.sym0 || '?') + '/' + (o.sym1 || '?')).padEnd(12)} fee=${String(o.feeTier).padStart(6)} dyn=${o.isDynamicFee ? 'Y' : 'n'} hook=${o.hook ? o.hook.slice(0, 10) : '-'.padEnd(10)} tvl=${Math.round(o.tvlUsd || 0).toLocaleString().padStart(12)} vol7d=${Math.round(v7).toLocaleString().padStart(13)} fee7d=${Math.round(f7).toLocaleString().padStart(9)}`,
  )
}
