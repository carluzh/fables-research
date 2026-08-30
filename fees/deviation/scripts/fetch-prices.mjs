// Pull the gateway's own price history for every GLD venue on chain 4663, plus SPY as a control,
// so the on-chain path can be laid beside the real-world reference.
import fs from 'node:fs'
const ORIGIN = 'https://app.uniswap.org'
const GQL = 'https://interface.gateway.uniswap.org/v1/graphql'

const Q = `query PoolPriceHistory($chain: Chain!, $addressOrId: String!, $duration: HistoryDuration!, $isV4: Boolean!, $isV3: Boolean!) {
  v4Pool(chain: $chain, poolId: $addressOrId) @include(if: $isV4) {
    id
    priceHistory(duration: $duration) { id token0Price token1Price timestamp }
  }
  v3Pool(chain: $chain, address: $addressOrId) @include(if: $isV3) {
    id
    priceHistory(duration: $duration) { id token0Price token1Price timestamp }
  }
}`

// [label, id, v, which token is USDG (0 or 1)]
const POOLS = [
  ['F-GLD', '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a', 4, 0],
  ['R-GLD-v3-3000', '0x7A6A053eCCf1446A2633E05aA6D40D09381997ec', 3, 0],
  ['R-GLD-v3-10000', '0x32cb909aCF78354E08aa45639Ff5CD33767E730a', 3, 0],
  ['F-SPY', '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd', 4, 1],
  ['F-ETH', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551', 4, 1],
  ['F-NVDA', '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd', 4, 0],
  ['F-META', '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5', 4, 0],
]
const DURATIONS = ['DAY', 'WEEK', 'MONTH']

const out = {}
for (const [label, id, v, usdgLeg] of POOLS) {
  out[label] = { id, v, usdgLeg, series: {} }
  for (const dur of DURATIONS) {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
      body: JSON.stringify({
        operationName: 'PoolPriceHistory',
        query: Q,
        variables: { chain: 'ROBINHOOD', addressOrId: id, duration: dur, isV4: v === 4, isV3: v === 3 },
      }),
    })
    const j = await res.json()
    if (j.errors) console.error(label, dur, 'GQL', JSON.stringify(j.errors).slice(0, 300))
    const node = j?.data?.v4Pool ?? j?.data?.v3Pool
    const ph = node?.priceHistory ?? []
    // tokenNPrice is priced IN tokenN, so the quote-per-base field is the one named after the USDG
    // leg (gw-price.ts). USDG is token0 on every GLD pool here, so we want token0Price.
    const rows = ph
      .filter(Boolean)
      .map((p) => ({ t: Number(p.timestamp), usdPerAsset: usdgLeg === 0 ? Number(p.token0Price) : Number(p.token1Price) }))
      .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.usdPerAsset) && r.usdPerAsset > 0)
      .sort((a, b) => a.t - b.t)
    out[label].series[dur] = rows
    const f = rows[0], l = rows[rows.length - 1]
    console.log(
      `${label.padEnd(16)} ${dur.padEnd(6)} n=${String(rows.length).padStart(4)}` +
        (rows.length
          ? `  ${new Date(f.t * 1000).toISOString().slice(0, 16)} $${f.usdPerAsset.toFixed(2)}  ->  ${new Date(l.t * 1000).toISOString().slice(0, 16)} $${l.usdPerAsset.toFixed(2)}`
          : '  EMPTY'),
    )
    await new Promise((s) => setTimeout(s, 200))
  }
}
fs.writeFileSync(new URL('../data/prices.json', import.meta.url), JSON.stringify(out))
console.log('\nwrote data/prices.json')
