// MARKET-WIDE CONTROL, independent of the chain. If crypto and equity activity fell over the same
// days, our volume falling with it is not a Fables event and not a day-of-week effect either.
const now = Math.floor(Date.now() / 1000)
const start = (now - 12 * 86400) * 1000
async function daily(sym) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1d&startTime=${start}&limit=20`)
  const j = await r.json()
  if (!Array.isArray(j)) return []
  return j.map((k) => ({
    day: new Date(k[0]).toISOString().slice(0, 10),
    qv: Number(k[7]),
    rng: 100 * Math.sqrt((Math.log(Number(k[2]) / Number(k[3])) ** 2) / (4 * Math.LN2)) * Math.sqrt(365),
  }))
}
const eth = await daily('ETHUSDT')
const eq = {}
for (const s of ['SPYBUSDT', 'NVDABUSDT', 'METABUSDT', 'AAPLBUSDT', 'TSLABUSDT']) {
  for (const r of await daily(s)) { eq[r.day] = (eq[r.day] ?? 0) + r.qv }
  await new Promise((x) => setTimeout(x, 250))
}
const paxg = await daily('PAXGUSDT')
const pm = new Map(paxg.map((r) => [r.day, r]))
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
console.log('BINANCE, the market our pools price against')
console.log(`${'day'.padEnd(12)} ${'dow'.padEnd(4)} ${'ETH $bn'.padStart(9)} ${'ETH vol%'.padStart(9)} ${'tok-equities $m'.padStart(16)} ${'PAXG $m'.padStart(9)} ${'PAXG vol%'.padStart(10)}`)
for (const r of eth) {
  const p = pm.get(r.day)
  console.log(
    `${r.day.padEnd(12)} ${DOW[new Date(r.day + 'T12:00:00Z').getUTCDay()].padEnd(4)} ` +
    `${(r.qv / 1e9).toFixed(2).padStart(9)} ${r.rng.toFixed(1).padStart(9)} ` +
    `${((eq[r.day] ?? 0) / 1e6).toFixed(1).padStart(16)} ${(p ? (p.qv / 1e6).toFixed(1) : '-').padStart(9)} ${(p ? p.rng.toFixed(1) : '-').padStart(10)}`,
  )
}
