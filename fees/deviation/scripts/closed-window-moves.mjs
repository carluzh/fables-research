// HOW OFTEN DOES ANYTHING ACTUALLY HAPPEN WHILE THE CASH MARKET IS SHUT?
//
// The closed-tier discount rests on an assumption: nothing moves, so there is nothing to arbitrage,
// so the fee can be cheap. This measures how often that assumption holds, and how badly it fails when
// it fails, per asset, separately for overnight and for weekends.
//
// It is the evidence behind the CLOSE-ANCHOR TRIGGER in DEVIATION-FEE.md section 12: while the market
// is shut, withdraw the discount whenever the 24/7 reference has moved more than X from the cash
// close. Sized here, deferred for build.
import fs from 'node:fs'

const BARS = new URL('../bars/', import.meta.url)
const OUT = new URL('../data/closed-window-moves.json', import.meta.url)

const ASSETS = ['SPY', 'QQQ', 'NVDA', 'META', 'AAPL', 'TSLA', 'GLD']
const THRESHOLDS = [0.005, 0.01, 0.02, 0.03, 0.05]

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
function et(tsSec) {
  const p = FMT.formatToParts(new Date(tsSec * 1000))
  const g = (t) => p.find((x) => x.type === t)?.value
  return { hour: Number(g('hour')) % 24, day: `${g('year')}-${g('month')}-${g('day')}`, wd: g('weekday') }
}

const out = {}
console.log('MOVES ACROSS A CLOSED CASH WINDOW, measured close to next open, 730d of 1h bars\n')
console.log('asset  window     n   median    p90     p99     max    ' + THRESHOLDS.map((t) => `<${(100 * t).toFixed(1)}%`.padStart(7)).join(''))

for (const a of ASSETS) {
  const bars = yahoo(a)
  const byDay = new Map()
  for (const b of bars) {
    const { hour, day, wd } = et(b.t)
    if (wd === 'Sat' || wd === 'Sun' || hour < 10 || hour > 15) continue
    const e = byDay.get(day) || { first: null, last: null }
    if (!e.first) e.first = b
    e.last = b
    byDay.set(day, e)
  }
  const days = [...byDay.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))
  const groups = { overnight: [], weekend: [] }
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1][1].last
    const next = days[i][1].first
    if (!prev || !next) continue
    const hours = (next.t - prev.t) / 3600
    const move = Math.abs(next.c / prev.c - 1)
    if (!Number.isFinite(move)) continue
    ;(hours > 36 ? groups.weekend : groups.overnight).push(move)
  }
  out[a] = {}
  for (const [k, arr] of Object.entries(groups)) {
    if (arr.length < 10) continue
    arr.sort((x, y) => x - y)
    const q = (p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]
    const shares = THRESHOLDS.map((t) => arr.filter((v) => v < t).length / arr.length)
    out[a][k] = { n: arr.length, median: q(0.5), p90: q(0.9), p99: q(0.99), max: arr[arr.length - 1], quietShare: Object.fromEntries(THRESHOLDS.map((t, i) => [t, shares[i]])) }
    console.log(
      `${a.padEnd(6)} ${k.padEnd(10)} ${String(arr.length).padStart(3)} ${(100 * q(0.5)).toFixed(2).padStart(7)}% ${(100 * q(0.9)).toFixed(2).padStart(6)}% ${(100 * q(0.99)).toFixed(2).padStart(6)}% ${(100 * arr[arr.length - 1]).toFixed(2).padStart(6)}%  ` +
      shares.map((s) => `${(100 * s).toFixed(0)}%`.padStart(7)).join(''),
    )
  }
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log('\nThe right-hand columns are the share of closed windows whose move stayed under each')
console.log('threshold. They are the quantified version of "more often than not, nothing happens":')
console.log('the discount is correct in the overwhelming majority of windows, which is exactly why it')
console.log('should be withdrawn by a TRIGGER on the rare window rather than priced away on all of them.')
console.log('\nwrote data/closed-window-moves.json')
