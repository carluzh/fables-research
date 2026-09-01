// IS 3,000 ENOUGH FOR GLD IN CLOSED HOURS?
//
// Carl's objection, and it is the right one: the deviation keeper only acts above its 2.00% kicker,
// so below that the base fee is the ONLY protection. Cutting closed from 6,000 to 3,000 halves the
// protection in exactly the band the keeper ignores.
//
// The question is therefore not "is 3,000 cheap" but "how much of the weekend move distribution
// falls in the band where the base fee is all we have". Measured on PAXG, which is the pool's own
// reference and trades through the weekend.
//
// CORRECTED. An earlier version of this script assumed the arb pays the fee on both legs and so
// needs m > 2f. That is wrong: the arbitrageur trades the pool ONCE to realign it and sells into the
// real market, so they pay our fee once. The standard CPMM no-arb band is +/- f, not +/- 2f. The
// mistake halved the apparent exposure and it ran in the direction that flattered a fee cut.
//     base 3,000 pips  no-arb band +/- 0.30%
//     base 6,000 pips  no-arb band +/- 0.60%
//     the keeper takes over at its 2.00% kicker
// So the uncovered band is 0.30% to 2.00% at a 3,000 base, or 0.60% to 2.00% at 6,000.
const CLOSE_ET = 16, OPEN_ET = 9.5 // Friday 16:00 ET to Monday 09:30 ET, the CLOSED session
const YEARS = 2

async function klines(sym, startMs, endMs) {
  const out = []
  let cur = startMs
  while (cur < endMs) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&startTime=${cur}&limit=1000`)
    const j = await r.json()
    if (!Array.isArray(j) || !j.length) break
    out.push(...j.map((k) => ({ t: Math.floor(k[0] / 1000), o: +k[1], hi: +k[2], lo: +k[3], c: +k[4] })))
    cur = (out[out.length - 1].t + 3600) * 1000
    if (j.length < 1000) break
    await new Promise((x) => setTimeout(x, 250))
  }
  return out
}

const now = Math.floor(Date.now() / 1000)
const bars = await klines('PAXGUSDT', (now - YEARS * 365 * 86400) * 1000, now * 1000)
console.log(`PAXGUSDT: ${bars.length} hourly bars, ${new Date(bars[0].t * 1000).toISOString().slice(0, 10)} to ${new Date(bars[bars.length - 1].t * 1000).toISOString().slice(0, 10)}\n`)

// ET is UTC-4 in summer and UTC-5 in winter. Using UTC-4 throughout shifts the boundary by an hour
// in winter, which is immaterial for a 65-hour window.
const et = (t) => new Date((t - 4 * 3600) * 1000)
const byT = new Map(bars.map((b) => [b.t, b]))

// Build the weekend windows: each Friday 16:00 ET close to the following Monday 09:30 ET open.
const windows = []
for (const b of bars) {
  const d = et(b.t)
  if (d.getUTCDay() !== 5 || d.getUTCHours() !== CLOSE_ET) continue
  const start = b.t
  const end = start + Math.round((3 * 24 - CLOSE_ET + OPEN_ET) * 3600) // Fri 16:00 to Mon 09:30 ET
  const seg = bars.filter((x) => x.t >= start && x.t <= end)
  if (seg.length < 40) continue
  const p0 = seg[0].c
  const p1 = seg[seg.length - 1].c
  const hi = Math.max(...seg.map((x) => x.hi))
  const lo = Math.min(...seg.map((x) => x.lo))
  windows.push({
    start, iso: new Date(start * 1000).toISOString().slice(0, 10),
    net: Math.abs(p1 / p0 - 1),          // where it ended up, the drift an arb finally captures
    excursion: Math.max(hi / p0 - 1, 1 - lo / p0), // the furthest it went, what a patient arb can take
  })
}
console.log(`${windows.length} weekend windows (Fri 16:00 ET to Mon 09:30 ET)\n`)

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
for (const [label, key] of [['NET move, close to close', 'net'], ['MAX EXCURSION inside the window', 'excursion']]) {
  const v = windows.map((w) => w[key])
  console.log(`${label}`)
  console.log(`  median ${(100 * q(v, 0.5)).toFixed(3)}%   p75 ${(100 * q(v, 0.75)).toFixed(3)}%   p90 ${(100 * q(v, 0.9)).toFixed(3)}%   p99 ${(100 * q(v, 0.99)).toFixed(3)}%   max ${(100 * Math.max(...v)).toFixed(3)}%`)
}

console.log('\nWHERE THE WEEKEND LANDS, against what each base fee covers')
console.log('An arb pays our fee ONCE, so the no-arb band is +/- f.')
console.log(`${'band'.padEnd(34)} ${'net'.padStart(12)} ${'excursion'.padStart(12)}`)
const bands = [
  ['under 0.30%: 3,000 covers it', (m) => m < 0.003],
  ['0.30% to 0.60%: only 6,000 covers', (m) => m >= 0.003 && m < 0.006],
  ['0.60% to 2.00%: NEITHER covers', (m) => m >= 0.006 && m < 0.02],
  ['over 2.00%: the keeper takes over', (m) => m >= 0.02],
]
for (const [label, f] of bands) {
  const n = windows.filter((w) => f(w.net)).length
  const e = windows.filter((w) => f(w.excursion)).length
  console.log(`${label.padEnd(34)} ${(100 * n / windows.length).toFixed(1).padStart(11)}% ${(100 * e / windows.length).toFixed(1).padStart(11)}%`)
}

console.log('\nTHE NUMBER THAT DECIDES IT: how much of the exposed band 6,000 actually buys')
for (const key of ['net', 'excursion']) {
  const at3 = windows.filter((w) => w[key] >= 0.003 && w[key] < 0.02).length
  const at6 = windows.filter((w) => w[key] >= 0.006 && w[key] < 0.02).length
  console.log(`  ${key.padEnd(10)} exposed at base 3,000: ${(100 * at3 / windows.length).toFixed(1)}% of weekends   at base 6,000: ${(100 * at6 / windows.length).toFixed(1)}%   6,000 closes ${(100 * (at3 - at6) / windows.length).toFixed(1)} points`)
}

console.log('\nWORST TEN WEEKENDS BY EXCURSION')
for (const w of [...windows].sort((a, b) => b.excursion - a.excursion).slice(0, 10)) {
  console.log(`  ${w.iso}  net ${(100 * w.net).toFixed(2)}%  excursion ${(100 * w.excursion).toFixed(2)}%`)
}

// Where should the kicker sit so the base and the keeper hand off cleanly, with no gap?
console.log('')
console.log('WHAT KICKER CLOSES THE GAP? The keeper should start where the base stops covering.')
for (const [base, label] of [[3000, 'base 3,000'], [6000, 'base 6,000']]) {
  const f = base / 1e6
  for (const key of ['net', 'excursion']) {
    const gap = windows.filter((w) => w[key] >= f && w[key] < 0.02).length
    console.log(`  ${label}, ${key.padEnd(10)} hands off at ${(100 * f).toFixed(2)}%, keeper starts at 2.00%, gap covers ${(100 * gap / windows.length).toFixed(1)}% of weekends`)
  }
}
console.log('')
console.log('  Setting the kicker to the base fee itself removes the gap entirely.')
