// DOES THE 24/7 REFERENCE ACTUALLY KNOW ANYTHING WHILE THE CASH MARKET IS SHUT?
//
// The objection: for equities we cut fees out of hours, which is safe only if nothing moves. Things
// do move. But a Binance tokenised equity might be its own thin, disconnected market that does NOT
// reflect real overnight information, in which case anchoring to it is no better than anchoring to
// the last cash close, and worse, because it invites us to react to its own noise.
//
// TWO REGRESSIONS, and only the second one settles it.
//
//   AT-OPEN:  regress the cash gap on the reference move measured up to the cash OPEN.
//             A slope of 1 here proves little: at that instant both venues are live, so they would
//             agree even if the reference had simply followed the open.
//
//   MID-WINDOW: regress the cash gap on the reference move measured at 04:00 ET, hours BEFORE the
//             open, strictly inside the closed window. A slope of 1 HERE means the reference already
//             knew where the stock would open while the stock was still shut. That is information,
//             not co-movement, and it is the whole question.
//
// PAXG against GLD is the positive control: an unambiguously real 24/7 gold market.
//
// The last column is what actually decides the design: the residual the kicker must clear under a
// LIVE anchor, against the raw gap sd it must clear under a LAST-CLOSE anchor.
import fs from 'node:fs'

const BARS = new URL('../bars/', import.meta.url)
const OUT = new URL('../data/gap-information.json', import.meta.url)
const HOUR = 3600
const DAY_MS = 86400000
const MID_HOUR_ET = 4 // hours before the cash open, after Asia has traded

const PAIRS = [
  ['SPY', 'SPYBUSDT', 'SPY'],
  ['NVDA', 'NVDABUSDT', 'NVDA'],
  ['AAPL', 'AAPLBUSDT', 'AAPL'],
  ['TSLA', 'TSLABUSDT', 'TSLA'],
  ['META', 'METABUSDT', 'META'],
  ['QQQ', 'QQQBUSDT', 'QQQ'],
  ['GLD control', 'PAXGUSDT', 'GLD'],
]

async function klines(symbol, days = 180) {
  const out = []
  let cursor = Date.now() - days * DAY_MS
  for (let page = 0; page < 6; page++) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${cursor}&limit=1000`)
    const j = await r.json()
    if (!Array.isArray(j) || !j.length) break
    out.push(...j.map((k) => ({ t: Math.floor(k[0] / 1000), c: Number(k[4]) })))
    cursor = (out[out.length - 1].t + HOUR) * 1000
    if (j.length < 1000) break
    await new Promise((s) => setTimeout(s, 250))
  }
  const seen = new Set()
  return new Map(out.filter((r) => (seen.has(r.t) ? false : (seen.add(r.t), true))).map((r) => [r.t, r.c]))
}

function yahoo(sym) {
  const j = JSON.parse(fs.readFileSync(new URL(`y_${sym}_1h.json`, BARS), 'utf8'))
  const r = j.chart.result[0]
  const rows = []
  r.timestamp.forEach((t, i) => {
    const c = r.indicators.quote[0].close[i]
    if (c != null) rows.push({ t: Number(t), c })
  })
  return rows.sort((a, b) => a.t - b.t)
}

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: 'numeric', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
})
function etParts(tsSec) {
  const p = FMT.formatToParts(new Date(tsSec * 1000))
  const g = (t) => p.find((x) => x.type === t)?.value
  return { hour: Number(g('hour')) % 24, day: `${g('year')}-${g('month')}-${g('day')}`, wd: g('weekday') }
}

function ols(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((a, c) => a + c, 0) / n
  const my = ys.reduce((a, c) => a + c, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2 }
  const slope = sxy / sxx
  const r2 = (sxy * sxy) / (sxx * syy)
  let sse = 0
  for (let i = 0; i < n; i++) sse += (ys[i] - (my + slope * (xs[i] - mx))) ** 2
  const se = Math.sqrt(sse / (n - 2) / sxx)
  return { slope, r2, se, n, tStat: slope / se }
}
const sd = (a) => { const m = a.reduce((x, c) => x + c, 0) / a.length; return Math.sqrt(a.reduce((x, c) => x + (c - m) ** 2, 0) / a.length) }

const results = []
console.log('DOES THE 24/7 REFERENCE PREDICT THE CASH GAP?\n')
console.log('                      AT-OPEN           MID-WINDOW (04:00 ET)        kicker must clear')
console.log('asset          n   slope    R^2     n   slope    R^2      t     last-close   live    verdict')

for (const [label, bsym, ysym] of PAIRS) {
  const ref = await klines(bsym)
  const bars = yahoo(ysym)

  // Hourly bars, so RTH is the 10:00 to 15:00 ET set of bar starts: 09:30 opens inside the 09:00 bar
  // which also carries pre-market. Using 10:00 as "the open" and 15:00 as "the close" understates the
  // true gap, equally on both legs, so the slope is unaffected.
  const byDay = new Map()
  for (const b of bars) {
    const { hour, day, wd } = etParts(b.t)
    if (wd === 'Sat' || wd === 'Sun' || hour < 10 || hour > 15) continue
    const e = byDay.get(day) || { first: null, last: null }
    if (!e.first) e.first = b
    e.last = b
    byDay.set(day, e)
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))

  const X = [], Y = [], XM = [], YM = []
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1][1].last
    const next = days[i][1].first
    if (!prev || !next) continue
    const t0 = prev.t - (prev.t % HOUR)
    const t1 = next.t - (next.t % HOUR)
    if (!ref.has(t0) || !ref.has(t1)) continue
    const realGap = next.c / prev.c - 1
    const refMove = ref.get(t1) / ref.get(t0) - 1
    if (!Number.isFinite(refMove) || !Number.isFinite(realGap)) continue
    X.push(refMove); Y.push(realGap)
    for (let t = t0 + HOUR; t < t1; t += HOUR) {
      if (etParts(t).hour === MID_HOUR_ET && ref.has(t)) {
        XM.push(ref.get(t) / ref.get(t0) - 1); YM.push(realGap)
        break
      }
    }
  }
  if (X.length < 20) { console.log(`${label.padEnd(14)} only ${X.length} usable boundaries, skipped`); continue }

  const r = ols(X, Y)
  const rm = XM.length >= 20 ? ols(XM, YM) : null
  const gapSd = sd(Y)
  // Under a LIVE anchor the kicker only has to clear what the reference could not explain.
  // Under a LAST-CLOSE anchor it has to clear the whole gap.
  const residLive = rm ? sd(YM) * Math.sqrt(Math.max(0, 1 - rm.r2)) : null
  const verdict = rm && rm.r2 > 0.5 && rm.slope > 0.7 ? 'INFORMATIVE' : rm && rm.r2 > 0.2 ? 'partial' : 'NOISE'
  results.push({ asset: label, symbol: bsym, atOpen: r, midWindow: rm, gapSd, residualUnderLiveAnchor: residLive, verdict })
  console.log(
    `${label.padEnd(14)} ${String(r.n).padStart(3)} ${r.slope.toFixed(3).padStart(6)} ${r.r2.toFixed(3).padStart(7)}  ` +
    `${String(rm ? rm.n : 0).padStart(4)} ${(rm ? rm.slope.toFixed(3) : '-').padStart(6)} ${(rm ? rm.r2.toFixed(3) : '-').padStart(7)} ${(rm ? rm.tStat.toFixed(1) : '-').padStart(6)}   ` +
    `${(100 * gapSd).toFixed(2).padStart(7)}% ${(residLive == null ? '-' : (100 * residLive).toFixed(2)).padStart(7)}%  ${verdict}`,
  )
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 1))
console.log('\nMID-WINDOW is the one that matters. Slope near 1 with a high R^2 there means the reference')
console.log('already knew where the stock would open, hours before it opened. Slope near 0 would mean it')
console.log('was moving on its own and a last-close anchor is the right one instead.')
console.log('\nThe last two columns are the design consequence: the noise a kicker has to clear under each')
console.log('anchoring choice. Lower is better, because it lets the trigger sit tighter.')
console.log('\nwrote data/gap-information.json')
