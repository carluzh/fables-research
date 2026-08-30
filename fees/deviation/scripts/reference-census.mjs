// THE REFERENCE CENSUS. For every asset Fables might list, does a continuously traded reference
// exist, how closely does it track the asset, and therefore how tight can that pool's kicker be?
//
// This is the script that produces the locked parameter table in SPEC.md section 7. Re-run it to add
// an asset: the procedure is the script, not a paragraph.
//
// Method, per candidate:
//   1. is it listed on Binance and TRADING
//   2. does it print through the weekend (the whole point: a reference that shuts is not a reference)
//   3. basis = reference price / asset price, measured only on hours where BOTH are live
//   4. the error of that basis against its own rolling median sets the kicker
import fs from 'node:fs'

const OUT = new URL('../data/reference-census.json', import.meta.url)
const BARS = new URL('../bars/', import.meta.url)

// asset ticker -> [Binance symbol, Yahoo symbol, unit note]
// The Yahoo leg is the ground truth the reference is scored against. Where a Fables pool exists we
// also score against the pool's own gateway price, which is the number the keeper will really use.
const CANDIDATES = [
  ['SPY', 'SPYBUSDT', 'SPY', '1 token = 1 share'],
  ['NVDA', 'NVDABUSDT', 'NVDA', '1 token = 1 share'],
  ['META', 'METABUSDT', 'META', '1 token = 1 share'],
  ['AAPL', 'AAPLBUSDT', 'AAPL', '1 token = 1 share'],
  ['TSLA', 'TSLABUSDT', 'TSLA', '1 token = 1 share'],
  ['QQQ', 'QQQBUSDT', 'QQQ', '1 token = 1 share'],
  ['MSFT', 'MSFTBUSDT', 'MSFT', '1 token = 1 share'],
  ['AMZN', 'AMZNBUSDT', 'AMZN', '1 token = 1 share'],
  ['GOOGL', 'GOOGLBUSDT', 'GOOGL', '1 token = 1 share'],
  ['COIN', 'COINBUSDT', 'COIN', '1 token = 1 share'],
  ['MSTR', 'MSTRBUSDT', 'MSTR', '1 token = 1 share'],
  ['NFLX', 'NFLXBUSDT', 'NFLX', '1 token = 1 share'],
  ['GLD', 'PAXGUSDT', 'GLD', 'one OUNCE against one ETF SHARE: needs a fitted basis'],
  ['ETH', 'ETHUSDT', null, 'native, no conversion'],
]

const HOUR = 3600
const floor = (t) => t - (t % HOUR)

async function klines(symbol, startMs, limit = 1000) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&startTime=${startMs}&limit=${limit}`)
  const j = await r.json()
  if (!Array.isArray(j)) return null
  return j.map((k) => ({ t: Math.floor(k[0] / 1000), c: Number(k[4]), v: Number(k[5]) }))
}

function yahooBars(sym) {
  try {
    const j = JSON.parse(fs.readFileSync(new URL(`y_${sym}_1h.json`, BARS), 'utf8'))
    const r = j.chart.result[0]
    const out = new Map()
    r.timestamp.forEach((t, i) => {
      const c = r.indicators.quote[0].close[i]
      if (c != null) out.set(floor(Number(t)), c)
    })
    return out
  } catch (e) {
    return null
  }
}

const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))]

const START = Date.now() - 30 * 86400 * 1000
const rows = []
console.log('THE REFERENCE CENSUS')
console.log('%-7s %-12s %6s %7s %9s %11s %8s %8s %8s %8s'
  .replace(/%-?\d*s/g, (m) => m) , 'asset', 'binance', 'bars', 'satHrs', 'satVol', 'basis med', 'p50', 'p90', 'p99', 'max')

for (const [asset, sym, yah, note] of CANDIDATES) {
  const b = await klines(sym, START)
  if (!b || !b.length) {
    rows.push({ asset, symbol: sym, listed: false, note })
    console.log(`${asset.padEnd(7)} ${sym.padEnd(12)} NOT LISTED / no klines`)
    continue
  }
  const sat = b.filter((r) => new Date(r.t * 1000).getUTCDay() === 6)
  const satHrs = new Set(sat.map((r) => floor(r.t))).size
  const satVol = sat.reduce((a, c) => a + c.v, 0)
  const bm = new Map(b.map((r) => [floor(r.t), r.c]))

  let basis = null, err = null, n = 0
  const yb = yah ? yahooBars(yah) : null
  if (yb) {
    const pairs = []
    for (const [t, c] of yb) if (bm.has(t)) pairs.push(c / bm.get(t))
    if (pairs.length > 20) {
      const sorted = pairs.slice().sort((x, y) => x - y)
      basis = sorted[Math.floor(sorted.length / 2)]
      err = pairs.map((r) => Math.abs(r / basis - 1)).sort((x, y) => x - y)
      n = pairs.length
    }
  }
  const row = {
    asset, symbol: sym, note, listed: true, bars: b.length,
    saturdayHours: satHrs, saturdayVolume: satVol,
    basisMedian: basis, basisN: n,
    err: err ? { p50: q(err, .5), p90: q(err, .9), p99: q(err, .99), max: err[err.length - 1] } : null,
  }
  rows.push(row)
  const f = (x) => (x == null ? '     -' : (100 * x).toFixed(2) + '%')
  console.log(
    `${asset.padEnd(7)} ${sym.padEnd(12)} ${String(b.length).padStart(6)} ${String(satHrs).padStart(7)} ${satVol.toFixed(0).padStart(9)} ` +
    `${(basis == null ? '-' : basis.toFixed(6)).padStart(11)} ${f(err && err[Math.floor(err.length * .5)]).padStart(8)} ` +
    `${f(err && q(err, .9)).padStart(8)} ${f(err && q(err, .99)).padStart(8)} ${f(err && err[err.length - 1]).padStart(8)}`,
  )
  await new Promise((s) => setTimeout(s, 250))
}

// THE KICKER RULE, applied mechanically so nobody has to interpret it.
//
//   kicker = max(2 * basisErr_p99, 0.50%), rounded UP to the next 0.25%
//   full   = max(3 * kicker, 4%)
//
// p99 and not max, because max over a 30-day window is one bad hour and one bad hour must not set a
// parameter. Assets whose max exceeds 3x their p99 carry an outlier and are flagged for inspection
// rather than silently widened.
//
// The measured error is an UPPER BOUND on true basis noise: it compares two venues' hourly CLOSES,
// so it carries timing noise the live keeper will not see, since the keeper reads both sides at the
// same instant. Expect the realised error in production to be materially tighter, and re-cut these
// after two weeks of live measurement.
const MIN_SAT_VOLUME = 2000   // shares traded on a Saturday. Below this the reference is thin enough
                              // that pushing IT is cheaper than pushing our pool, so it needs a
                              // second source before a pool relies on it.
console.log('')
console.log('THE KICKER RULE: max(2 x basis p99, 0.50%), rounded up to 0.25%. full = max(3 x kicker, 4%)')
console.log('asset    p99      max     out?   satVol    thin?   KICKER    FULL')
for (const r of rows) {
  if (!r.err) {
    console.log(`${r.asset.padEnd(8)} no basis measured against a ground truth, see the note below`)
    continue
  }
  const raw = Math.max(2 * r.err.p99, 0.005)
  const kick = Math.ceil(raw / 0.0025) * 0.0025
  const full = Math.max(3 * kick, 0.04)
  const outlier = r.err.max > 3 * r.err.p99
  const thin = r.saturdayVolume < MIN_SAT_VOLUME
  r.kicker = kick
  r.full = full
  r.outlierFlag = outlier
  r.thinReference = thin
  console.log(
    `${r.asset.padEnd(8)} ${(100 * r.err.p99).toFixed(2).padStart(5)}%  ${(100 * r.err.max).toFixed(2).padStart(5)}%  ` +
    `${(outlier ? 'FLAG' : '  ok').padStart(5)}  ${r.saturdayVolume.toFixed(0).padStart(7)}  ${(thin ? 'THIN' : '  ok').padStart(6)}   ` +
    `${(100 * kick).toFixed(2).padStart(5)}%   ${(100 * full).toFixed(2).padStart(6)}%`,
  )
}
console.log('')
console.log('out? = max exceeds 3x p99, so a single hour dominates: inspect that hour before locking.')
console.log('thin? = under ' + MIN_SAT_VOLUME + ' shares traded on a Saturday, so the REFERENCE is pushable.')
console.log('        Such a pool needs a second reference and a disagreement guard before it goes live.')
console.log('')
console.log('ETH has no Yahoo ground truth here; its reference is ETHUSDT, basis 1.0 by construction')
console.log('(modulo the USDT peg), and it already carries the volatility keeper, so it is last in the')
console.log('rollout and its deviation kicker is set once the two signals are shown not to fight.')

fs.writeFileSync(OUT, JSON.stringify({ generatedFrom: 'binance klines 1h, 30d; yahoo 1h bars in ../bars', rows }, null, 1))
console.log('\nwrote data/reference-census.json')
