// FRESH DAILY VOLUME, straight from the indexer rather than a chain scan. The 14-day Swap scan was
// taking half an hour under RPC rate limiting; this endpoint returns a week of hourly buckets per
// pool in one call, and it is the same source census.mjs already used, so the numbers splice onto
// the existing baseline.
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'
const ORIGIN = 'https://app.uniswap.org'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Fables pools, plus the two ETH rivals worth watching. version 3 = v4, 2 = v3.
const POOLS = [
  ['GLD', '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a', 3],
  ['ETH', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551', 3],
  ['SPY', '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd', 3],
  ['NVDA', '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd', 3],
  ['META', '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5', 3],
  ['TSLA', '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e', 3],
  ['AAPL', '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147', 3],
]
// The two biggest non-Fables ETH/USDG venues, as a chain-native control: if they fell too, the
// quiet is the chain's, not ours.
const RIVALS = [
  ['rival v3 WETH/USDG 100', '0x52e65b17fb6e5ba00ed806f37afcd2daa50271ca', 2],
  ['rival v4 ETH/USDG 577', '0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32', 3],
]

async function hist(id, version) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(HIST, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN },
        body: JSON.stringify({ pool: { chainId: 'ROBINHOOD', addressOrId: id, version }, duration: 'HISTORY_DURATION_WEEK' }),
      })
      const j = await res.json()
      if (j.buckets) return j.buckets.map((x) => ({ t: Number(x.timestamp), v: Number(x.volumeUsd) || 0, f: Number(x.feeUsd) || 0 }))
    } catch (e) { /* retry */ }
    await sleep(900 + i * 700)
  }
  return []
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10)

async function daily(list) {
  const per = {}
  for (const [name, id, ver] of list) {
    const b = await hist(id, ver)
    const d = {}
    for (const x of b) {
      const k = dayOf(x.t)
      d[k] = d[k] ?? { v: 0, f: 0 }
      d[k].v += x.v
      d[k].f += x.f
    }
    per[name] = d
    process.stdout.write(`${name}: ${b.length} buckets\n`)
    await sleep(400)
  }
  return per
}

const ours = await daily(POOLS)
const rivals = await daily(RIVALS)

const names = POOLS.map((p) => p[0])
const days = [...new Set(Object.values(ours).flatMap((d) => Object.keys(d)))].sort()
const nowH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60
const today = new Date().toISOString().slice(0, 10)

console.log(`\nOUR DAILY VOLUME, USD, from the indexer`)
console.log(`${'day'.padEnd(12)} ${'dow'.padEnd(4)} ` + names.map((n) => n.padStart(11)).join(' ') + `  ${'TOTAL'.padStart(12)} ${'fees'.padStart(9)}`)
const rows = []
for (const k of days) {
  const cells = names.map((n) => ours[n][k]?.v ?? 0)
  const tot = cells.reduce((a, b) => a + b, 0)
  const fees = names.reduce((a, n) => a + (ours[n][k]?.f ?? 0), 0)
  const partial = k === today ? `  (partial, ${nowH.toFixed(1)}h of 24)` : ''
  rows.push({ day: k, dow: DOW[new Date(k + 'T12:00:00Z').getUTCDay()], per: Object.fromEntries(names.map((n, i) => [n, cells[i]])), total: tot, fees, partial: k === today })
  console.log(`${k.padEnd(12)} ${DOW[new Date(k + 'T12:00:00Z').getUTCDay()].padEnd(4)} ` + cells.map((v) => Math.round(v).toLocaleString().padStart(11)).join(' ') + `  ${Math.round(tot).toLocaleString().padStart(12)} ${('$' + fees.toFixed(0)).padStart(9)}${partial}`)
}

console.log(`\nEX-GLD, because GLD was an event and events end`)
console.log(`${'day'.padEnd(12)} ${'dow'.padEnd(4)} ${'ex-GLD total'.padStart(14)} ${'GLD alone'.padStart(12)} ${'GLD share'.padStart(10)}`)
for (const r of rows) {
  const g = r.per.GLD ?? 0
  console.log(`${r.day.padEnd(12)} ${r.dow.padEnd(4)} ${Math.round(r.total - g).toLocaleString().padStart(14)} ${Math.round(g).toLocaleString().padStart(12)} ${(r.total > 0 ? (100 * g / r.total).toFixed(1) + '%' : '-').padStart(10)}${r.partial ? '  (partial)' : ''}`)
}

console.log(`\nTHE CHAIN-NATIVE CONTROL: the two biggest ETH/USDG venues that are not ours`)
const rn = RIVALS.map((r) => r[0])
console.log(`${'day'.padEnd(12)} ${'dow'.padEnd(4)} ` + rn.map((n) => n.padStart(24)).join(' ') + `  ${'our ETH'.padStart(12)}`)
for (const k of days) {
  console.log(`${k.padEnd(12)} ${DOW[new Date(k + 'T12:00:00Z').getUTCDay()].padEnd(4)} ` +
    rn.map((n) => Math.round(rivals[n][k]?.v ?? 0).toLocaleString().padStart(24)).join(' ') +
    `  ${Math.round(ours.ETH[k]?.v ?? 0).toLocaleString().padStart(12)}`)
}

import fs from 'node:fs'
fs.writeFileSync('data/freshvol.json', JSON.stringify({ ours, rivals, rows }, null, 1))
console.log('\nwrote data/freshvol.json')
