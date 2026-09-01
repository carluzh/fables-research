// Volume is at record highs, so whatever Yanis is looking at is not daily volume. The three
// candidates a dashboard would actually show, checked against each other:
//   1. TRAILING 24h volume, which right now is 16h of a busy Monday plus 8h of quiet overnight.
//   2. FEES, which fall on a weekday even when volume does not, because the weekend closed tiers
//      are the expensive ones on GLD and the pool spends the week in cheaper tiers.
//   3. HOURLY volume, where the last few prints really are quiet because it is 03:30 New York.
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'
const ORIGIN = 'https://app.uniswap.org'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const POOLS = [
  ['GLD', '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'],
  ['ETH', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551'],
  ['SPY', '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd'],
  ['NVDA', '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd'],
  ['META', '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5'],
  ['TSLA', '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e'],
  ['AAPL', '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147'],
]
async function hist(id) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(HIST, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN }, body: JSON.stringify({ pool: { chainId: 'ROBINHOOD', addressOrId: id, version: 3 }, duration: 'HISTORY_DURATION_WEEK' }) })
      const j = await r.json()
      if (j.buckets) return j.buckets.map((x) => ({ t: Number(x.timestamp), v: Number(x.volumeUsd) || 0, f: Number(x.feeUsd) || 0 }))
    } catch (e) { /* retry */ }
    await sleep(800 + i * 600)
  }
  return []
}

const all = {}
for (const [n, id] of POOLS) { all[n] = await hist(id); await sleep(350) }
const hours = [...new Set(Object.values(all).flat().map((x) => x.t))].sort((a, b) => a - b)
const agg = hours.map((t) => {
  let v = 0, f = 0
  for (const n of Object.keys(all)) { const b = all[n].find((x) => x.t === t); if (b) { v += b.v; f += b.f } }
  return { t, v, f }
})
const now = Math.floor(Date.now() / 1000)

// 1. rolling 24h, stepped back a day at a time
console.log('ROLLING 24h WINDOWS, the number a dashboard shows')
console.log(`${'window ending'.padEnd(22)} ${'volume'.padStart(13)} ${'fees'.padStart(10)} ${'realised pips'.padStart(14)}`)
for (let d = 0; d < 6; d++) {
  const end = now - d * 86400, start = end - 86400
  const g = agg.filter((x) => x.t > start && x.t <= end)
  const v = g.reduce((a, b) => a + b.v, 0), f = g.reduce((a, b) => a + b.f, 0)
  if (v <= 0) continue
  console.log(`${new Date(end * 1000).toISOString().slice(0, 16).replace('T', ' ').padEnd(22)} ${('$' + Math.round(v).toLocaleString()).padStart(13)} ${('$' + f.toFixed(0)).padStart(10)} ${(1e6 * f / v).toFixed(0).padStart(14)}`)
}

// 2. the last 30 hours, hour by hour
console.log('\nHOUR BY HOUR, last 30. ET = UTC-4, so the cash session is 13:30 to 20:00 UTC.')
console.log(`${'hour UTC'.padEnd(20)} ${'volume'.padStart(12)} ${'fees'.padStart(9)} ${'pips'.padStart(6)}  session`)
for (const x of agg.slice(-30)) {
  const h = new Date(x.t * 1000).getUTCHours() + new Date(x.t * 1000).getUTCMinutes() / 60
  const dow = new Date(x.t * 1000).getUTCDay()
  const sess = dow === 0 || dow === 6 ? 'CLOSED' : h >= 13.5 && h < 20 ? 'OPEN' : 'overnight'
  console.log(`${new Date(x.t * 1000).toISOString().slice(0, 16).replace('T', ' ').padEnd(20)} ${('$' + Math.round(x.v).toLocaleString()).padStart(12)} ${('$' + x.f.toFixed(0)).padStart(9)} ${(x.v > 0 ? (1e6 * x.f / x.v).toFixed(0) : '-').padStart(6)}  ${sess}`)
}

// 3. same clock hours, today against yesterday, which removes the time-of-day effect entirely
console.log('\nSAME CLOCK HOURS, today against the two days before. Removes time of day completely.')
const todayStart = Math.floor(now / 86400) * 86400
const elapsed = now - todayStart
const win = (off) => {
  const g = agg.filter((x) => x.t >= todayStart - off && x.t < todayStart - off + elapsed)
  return { v: g.reduce((a, b) => a + b.v, 0), f: g.reduce((a, b) => a + b.f, 0) }
}
const t0 = win(0), t1 = win(86400), t2 = win(2 * 86400)
const lab = (o) => new Date((todayStart - o) * 1000).toISOString().slice(0, 10)
console.log(`  ${lab(2 * 86400)} 00:00-${(elapsed / 3600).toFixed(1)}h   $${Math.round(t2.v).toLocaleString().padStart(12)}   fees $${t2.f.toFixed(0)}`)
console.log(`  ${lab(86400)} 00:00-${(elapsed / 3600).toFixed(1)}h   $${Math.round(t1.v).toLocaleString().padStart(12)}   fees $${t1.f.toFixed(0)}`)
console.log(`  ${lab(0)} 00:00-${(elapsed / 3600).toFixed(1)}h   $${Math.round(t0.v).toLocaleString().padStart(12)}   fees $${t0.f.toFixed(0)}`)
console.log(`\n  today vs yesterday: volume ${(t0.v / t1.v).toFixed(2)}x, fees ${(t0.f / t1.f).toFixed(2)}x`)
console.log(`  today vs two days ago: volume ${(t0.v / t2.v).toFixed(2)}x, fees ${(t0.f / t2.f).toFixed(2)}x`)
