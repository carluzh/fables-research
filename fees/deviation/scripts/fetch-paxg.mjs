// PAXG and XAUT trade 24/7 on Binance, so they give a gold reference that never goes dark - which
// is exactly what COMEX and the GLD ETF cannot do over a weekend. Pull enough history to measure
// the PAXG -> GLD-share basis and its stability, plus the event window at 1h.
import fs from 'node:fs'

async function klines(symbol, interval, startMs, limit = 1000) {
  const u = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startMs}&limit=${limit}`
  const r = await fetch(u)
  const j = await r.json()
  if (!Array.isArray(j)) throw new Error(symbol + ' ' + JSON.stringify(j).slice(0, 200))
  return j.map((k) => ({ t: Math.floor(k[0] / 1000), c: Number(k[4]), v: Number(k[5]) }))
}

const out = {}
for (const sym of ['PAXGUSDT', 'XAUTUSDT']) {
  const rows = []
  // 120 days back, 1000 hourly bars per page
  let cursor = Date.now() - 120 * 86400 * 1000
  for (let page = 0; page < 4; page++) {
    const b = await klines(sym, '1h', cursor)
    if (!b.length) break
    rows.push(...b)
    cursor = (b[b.length - 1].t + 3600) * 1000
    if (b.length < 1000) break
    await new Promise((s) => setTimeout(s, 300))
  }
  const seen = new Set()
  const dedup = rows.filter((r) => (seen.has(r.t) ? false : (seen.add(r.t), true))).sort((a, b) => a.t - b.t)
  out[sym] = dedup
  console.log(
    `${sym}  n=${dedup.length}  ${new Date(dedup[0].t * 1000).toISOString().slice(0, 16)} .. ${new Date(dedup[dedup.length - 1].t * 1000).toISOString().slice(0, 16)}  last $${dedup[dedup.length - 1].c}`,
  )
  // weekend coverage check: does it actually print on Saturdays?
  const sat = dedup.filter((r) => new Date(r.t * 1000).getUTCDay() === 6)
  console.log(`   Saturday bars: ${sat.length}, median volume ${sat.map((r) => r.v).sort((a, b) => a - b)[Math.floor(sat.length / 2)]?.toFixed(0)} PAXG`)
}
fs.writeFileSync(new URL('../data/paxg.json', import.meta.url), JSON.stringify(out))
console.log('\nwrote data/paxg.json')
