// Faithful port of fables-research/fees/scripts/now.ts, with poolStatsOf inlined from
// fables-ui/src/data/gw-pool.ts (tvlFromLegs, the price>0 rule, totalLiquidity fallback).
import fs from 'node:fs'
const ORIGIN = 'https://app.uniswap.org'
const GQL = 'https://interface.gateway.uniswap.org/v1/graphql'
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'

const ROWS = [
  { key: 'F-NVDA', pair: 'NVDA/USDG', side: 'fables', v: 4, note: 'Fables', id: '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd' },
  { key: 'F-SPY', pair: 'SPY/USDG', side: 'fables', v: 4, note: 'Fables', id: '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd' },
  { key: 'F-ETH', pair: 'ETH/USDG', side: 'fables', v: 4, note: 'Fables', id: '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551' },
  { key: 'F-GLD', pair: 'GLD/USDG', side: 'fables', v: 4, note: 'Fables', id: '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a' },
  { key: 'F-META', pair: 'META/USDG', side: 'fables', v: 4, note: 'Fables', id: '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5' },
  { key: 'F-TSLA', pair: 'TSLA/USDG', side: 'fables', v: 4, note: 'Fables', id: '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e' },
  { key: 'F-AAPL', pair: 'AAPL/USDG', side: 'fables', v: 4, note: 'Fables', id: '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147' },
  { key: 'F-NVSP', pair: 'NVDA/SPY', side: 'fables', v: 4, note: 'Fables', id: '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f' },
  { key: 'F-SPGL', pair: 'SPY/GLD', side: 'fables', v: 4, note: 'Fables', id: '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f' },
  { key: 'R-NVDA-v3-500', pair: 'NVDA/USDG', side: 'rival', v: 3, note: 'v3 500 (dominant)', id: '0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3' },
  { key: 'R-NVDA-v4-3499', pair: 'NVDA/USDG', side: 'rival', v: 4, note: 'v4 3499', id: '0x3bb34a44f1b2b5f32c034c38a53065a521a47b199700fa9bd19d60985ff24bf1' },
  { key: 'R-SPY-v4-625', pair: 'SPY/USDG', side: 'rival', v: 4, note: 'v4 625 (dominant)', id: '0xe5923c8a8be481ec89a2ca784a2bbfa4235de6d88f92260fd66b660c4babf907' },
  { key: 'R-SPY-v4-3499', pair: 'SPY/USDG', side: 'rival', v: 4, note: 'v4 3499', id: '0xfe2a80bb5618fd14984b92ca6d45bf5ba67443ddb1435e28b2e48df2fc1526cd' },
  { key: 'R-SPY-v3-500', pair: 'SPY/USDG', side: 'rival', v: 3, note: 'v3 500', id: '0xa7Bb1AC63BBaB0C44316E6c8C455213441689167' },
  { key: 'R-ETH-v4-577', pair: 'ETH/USDG', side: 'rival', v: 4, note: 'v4 577 native (dominant)', id: '0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32' },
  { key: 'R-ETH-v4-625', pair: 'ETH/USDG', side: 'rival', v: 4, note: 'v4 625 native', id: '0x387bf619da4d3fb62bb276482693dba1b9b3520f573cabdfe033384a24125982' },
  { key: 'R-ETH-v3-100', pair: 'ETH/USDG', side: 'rival', v: 3, note: 'v3 100 WETH', id: '0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca' },
  { key: 'R-GLD-v3-3000', pair: 'GLD/USDG', side: 'rival', v: 3, note: 'v3 3000', id: '0x7A6A053eCCf1446A2633E05aA6D40D09381997ec' },
  { key: 'R-GLD-v3-10000', pair: 'GLD/USDG', side: 'rival', v: 3, note: 'v3 10000', id: '0x32cb909aCF78354E08aa45639Ff5CD33767E730a' },
]

const COMMON = [
  'id feeTier txCount',
  'token0 { address symbol decimals market { price { value } } } token0Supply',
  'token1 { address symbol decimals market { price { value } } } token1Supply',
  'totalLiquidity { value } totalLiquidityPercentChange24h { value }',
  'volume24h: cumulativeVolume(duration: DAY) { value }',
].join('\n  ')
const F4 = '{ ' + COMMON + ' isDynamicFee hook { address } }'
const F3 = '{ ' + COMMON + ' }'

async function batch(rows) {
  const args = rows.map((_, i) => '$p' + i + ': String!').join(', ')
  const roots = rows
    .map((r, i) =>
      r.v === 4
        ? '  a' + i + ': v4Pool(chain: $chain, poolId: $p' + i + ') ' + F4
        : '  a' + i + ': v3Pool(chain: $chain, address: $p' + i + ') ' + F3,
    )
    .join('\n')
  const query = 'query B($chain: Chain!, ' + args + ') {\n' + roots + '\n}'
  const variables = { chain: 'ROBINHOOD' }
  rows.forEach((r, i) => (variables['p' + i] = r.id))
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
    body: JSON.stringify({ operationName: 'B', query, variables }),
  })
  const j = await res.json()
  if (j.errors) console.error('GQL ERRORS', JSON.stringify(j.errors).slice(0, 1200))
  return j.data ?? {}
}

async function hist(id, v, dur) {
  const res = await fetch(HIST, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
    body: JSON.stringify({ pool: { chainId: 'ROBINHOOD', addressOrId: id, version: v === 4 ? 3 : 2 }, duration: 'HISTORY_DURATION_' + dur }),
  })
  const j = await res.json()
  return (j.buckets ?? []).map((x) => ({ t: Number(x.timestamp), v: Number(x.volumeUsd) || 0, f: Number(x.feeUsd) || 0 }))
}

const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null)
const priceOf = (t) => {
  const u = num(t && t.market && t.market.price ? t.market.price.value : null)
  return u !== null && u > 0 ? u : null
}
function tvlFromLegs(p) {
  const p0 = priceOf(p.token0)
  const p1 = priceOf(p.token1)
  const s0 = num(p.token0Supply)
  const s1 = num(p.token1Supply)
  if (p0 === null || p1 === null || s0 === null || s1 === null) return null
  return Math.max(0, s0) * p0 + Math.max(0, s1) * p1
}
const MAX_LP_FEE_PPM = 1000000
const feeTierOf = (raw) => {
  const v = num(raw)
  return v !== null && v > MAX_LP_FEE_PPM ? null : v
}

const data = await batch(ROWS)
const out = []
for (let i = 0; i < ROWS.length; i++) {
  const r = ROWS[i]
  const node = data['a' + i]
  if (!node) {
    out.push(Object.assign({}, r, { err: 'no node' }))
    continue
  }
  const b = await hist(r.id, r.v, 'WEEK')
  out.push(
    Object.assign({}, r, {
      tvlUsd: tvlFromLegs(node) !== null ? tvlFromLegs(node) : num(node.totalLiquidity ? node.totalLiquidity.value : null),
      tvlGateway: num(node.totalLiquidity ? node.totalLiquidity.value : null),
      tvlChangePct: num(node.totalLiquidityPercentChange24h ? node.totalLiquidityPercentChange24h.value : null),
      feeTier: feeTierOf(node.feeTier),
      isDynamicFee: typeof node.isDynamicFee === 'boolean' ? node.isDynamicFee : null,
      hook: node.hook ? node.hook.address : null,
      txCount: Number(node.txCount) || null,
      vol24hGw: num(node.volume24h ? node.volume24h.value : null),
      tok: {
        t0: node.token0 ? node.token0.symbol : null,
        d0: node.token0 ? node.token0.decimals : null,
        a0: node.token0 ? node.token0.address : null,
        p0: priceOf(node.token0),
        s0: num(node.token0Supply),
        t1: node.token1 ? node.token1.symbol : null,
        d1: node.token1 ? node.token1.decimals : null,
        a1: node.token1 ? node.token1.address : null,
        p1: priceOf(node.token1),
        s1: num(node.token1Supply),
      },
      buckets: b,
    }),
  )
  await new Promise((s) => setTimeout(s, 150))
}
fs.writeFileSync(new URL('../data/now.json', import.meta.url), JSON.stringify({ fetchedAt: new Date().toISOString(), out }))
console.log('rows', out.length, 'at', new Date().toISOString())
for (const o of out) {
  const n = (o.buckets || []).length
  console.log(
    o.key.padEnd(16) +
      ' tvl=' + (o.tvlUsd == null ? 'null' : Math.round(o.tvlUsd)) +
      ' gwTvl=' + (o.tvlGateway == null ? 'null' : Math.round(o.tvlGateway)) +
      ' feeTier=' + o.feeTier +
      ' buckets=' + n +
      ' last=' + (n ? new Date(o.buckets[n - 1].t * 1000).toISOString() : '-'),
  )
}
