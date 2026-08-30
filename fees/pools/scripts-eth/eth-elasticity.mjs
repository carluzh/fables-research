// DOES CUTTING THE ETH FEE WIN ANYTHING? The markout says the 450 floor is 8x covered in calm
// markets, which argues for KEEPING it. The only argument for cutting is that a lower fee wins
// enough extra flow to more than pay for itself. Nobody has measured that, and it is the whole
// question.
//
// The keeper's own fee variation is the natural experiment: it moves the fee every day on a
// volatility signal, not on a calendar. So unlike the RWA pools, ETH's fee is NOT collinear with
// session. It IS collinear with volatility, and volatility drives market-wide volume too, so a raw
// "volume at each fee level" is confounded in the direction that flatters a cut.
//
// The control: Binance ETHUSDT hourly quote volume. Our volume divided by that is a SHARE PROXY
// which strips market-wide activity. If share rises when our fee falls, flow is price-responsive
// and a cut can win. If it does not move, our flow is arriving for reasons price cannot improve
// and cutting is a giveaway.
import { c, SWAP, retry, scan } from './lib.mjs'
import fs from 'node:fs'

const POOL_ID = '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551'
const DAYS = Number(process.argv[2] ?? 7)

const head = await retry(() => c.getBlockNumber())
const bA = await retry(() => c.getBlock({ blockNumber: head }))
const bB = await retry(() => c.getBlock({ blockNumber: head - 500000n }))
const SEC = (Number(bA.timestamp) - Number(bB.timestamp)) / 500000
const tHead = Number(bA.timestamp)
const from = head - BigInt(Math.round((DAYS * 86400) / SEC))
const tsOf = (bn) => tHead - (Number(head) - Number(bn)) * SEC
console.log(`ETH/USDG, ${DAYS}d to ${new Date(tHead * 1000).toISOString()}, block time ${SEC.toFixed(4)}s`)

const logs = await scan(SWAP, POOL_ID, from, head, 100000n)
console.log(`swaps ${logs.length}`)

// ---- our side, hourly -------------------------------------------------------------------------
const hrs = new Map()
for (const l of logs) {
  const a1 = Math.abs(Number(l.args.amount1) / 1e6) // USDG notional
  if (!(a1 > 0)) continue
  const t = Math.floor(tsOf(l.blockNumber))
  const h = t - (t % 3600)
  const r = hrs.get(h) ?? { h, vol: 0, fee: 0, n: 0 }
  r.vol += a1
  r.fee += (a1 * Number(l.args.fee)) / 1e6
  r.n++
  hrs.set(h, r)
}

// ---- the control: Binance ETHUSDT hourly ------------------------------------------------------
async function klines(sym, interval, s, e) {
  const out = []
  let cur = s
  const step = interval === '1h' ? 3600 : 60
  while (cur < e) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&startTime=${cur}&limit=1000`)
    const j = await r.json()
    if (!Array.isArray(j) || !j.length) break
    out.push(...j.map((k) => ({ t: Math.floor(k[0] / 1000), o: +k[1], hi: +k[2], lo: +k[3], c: +k[4], qv: +k[7], nt: +k[8] })))
    cur = (out[out.length - 1].t + step) * 1000
    if (j.length < 1000) break
    await new Promise((x) => setTimeout(x, 250))
  }
  return out
}
const t0 = Math.floor(tsOf(from)) - 3600
const BH = await klines('ETHUSDT', '1h', t0 * 1000, (tHead + 3600) * 1000)
const REF = new Map(BH.map((k) => [k.t - (k.t % 3600), k]))
console.log(`reference ${BH.length} hourly candles`)

// Parkinson hourly vol from the high/low range, annualised: a cleaner per-hour vol estimate than a
// close-to-close on a single observation.
const rows = []
for (const [h, r] of [...hrs.entries()].sort((a, b) => a[0] - b[0])) {
  const k = REF.get(h)
  if (!k || !(k.qv > 0) || !(r.vol > 0)) continue
  const pk = Math.sqrt((Math.log(k.hi / k.lo) ** 2) / (4 * Math.LN2)) * Math.sqrt(24 * 365) * 100
  rows.push({
    h,
    iso: new Date(h * 1000).toISOString(),
    vol: r.vol,
    fees: r.fee,
    n: r.n,
    feePips: (1e6 * r.fee) / r.vol,
    mktVol: k.qv,
    share: r.vol / k.qv, // share proxy: our USD volume per USD of Binance ETHUSDT volume
    sigma: pk,
  })
}
console.log(`usable hours ${rows.length} of ${DAYS * 24}\n`)

const sum = (a, f) => a.reduce((x, y) => x + f(y), 0)
const mean = (a, f) => sum(a, f) / a.length
const med = (a, f) => {
  const s = a.map(f).sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

// ---- the headline table -----------------------------------------------------------------------
console.log('BY THE FEE THE KEEPER CHARGED. share is our USD volume per $1M of Binance ETHUSDT volume.')
console.log('fee band     hrs   mean fee   our $/h      our vol/h    share/$1M   mkt $bn/h   ann vol %')
const BANDS = [[0, 500], [500, 700], [700, 1000], [1000, 1500], [1500, 3001]]
const tab = []
for (const [lo, hi] of BANDS) {
  const g = rows.filter((r) => r.feePips >= lo && r.feePips < hi)
  if (g.length < 3) {
    console.log(`${(lo + '-' + hi).padEnd(12)} ${String(g.length).padStart(5)}   too few hours`)
    continue
  }
  const rec = {
    band: `${lo}-${hi}`,
    hrs: g.length,
    fee: mean(g, (r) => r.feePips),
    usdPerH: mean(g, (r) => r.fees),
    volPerH: mean(g, (r) => r.vol),
    sharePerM: 1e6 * mean(g, (r) => r.share),
    mktPerH: mean(g, (r) => r.mktVol),
    sigma: med(g, (r) => r.sigma),
  }
  tab.push(rec)
  console.log(
    `${rec.band.padEnd(12)} ${String(rec.hrs).padStart(5)} ${rec.fee.toFixed(0).padStart(10)} ${('$' + rec.usdPerH.toFixed(2)).padStart(11)} ${('$' + Math.round(rec.volPerH).toLocaleString()).padStart(13)} ${('$' + rec.sharePerM.toFixed(0)).padStart(11)} ${(rec.mktPerH / 1e9).toFixed(2).padStart(11)} ${rec.sigma.toFixed(1).padStart(10)}`,
  )
}

// ---- break the confound: compare fee levels WITHIN a volatility bucket -------------------------
// Volatility drives both the keeper's fee and market-wide volume, so the raw table cannot separate
// a price effect from a volatility effect. Inside one volatility tercile market conditions are held
// roughly fixed and only the fee differs.
console.log('\nWITHIN VOLATILITY TERCILES, so market conditions are held roughly fixed.')
const bySig = [...rows].sort((a, b) => a.sigma - b.sigma)
const cut = [bySig[Math.floor(bySig.length / 3)].sigma, bySig[Math.floor((2 * bySig.length) / 3)].sigma]
console.log(`tercile edges: ${cut[0].toFixed(1)}% and ${cut[1].toFixed(1)}% annualised\n`)
console.log('vol tercile   fee half   hrs   mean fee   share/$1M    our $/h    mkt $bn/h   ann vol %')
const terc = [
  ['low', (r) => r.sigma < cut[0]],
  ['mid', (r) => r.sigma >= cut[0] && r.sigma < cut[1]],
  ['high', (r) => r.sigma >= cut[1]],
]
const within = []
for (const [name, f] of terc) {
  const g = rows.filter(f)
  const m = med(g, (r) => r.feePips)
  for (const [half, sel] of [['cheap', (r) => r.feePips <= m], ['dear', (r) => r.feePips > m]]) {
    const s = g.filter(sel)
    if (s.length < 3) continue
    const rec = {
      tercile: name, half, hrs: s.length,
      fee: mean(s, (r) => r.feePips),
      sharePerM: 1e6 * mean(s, (r) => r.share),
      usdPerH: mean(s, (r) => r.fees),
      mktPerH: mean(s, (r) => r.mktVol),
      sigma: med(s, (r) => r.sigma),
    }
    within.push(rec)
    console.log(
      `${name.padEnd(13)} ${half.padEnd(9)} ${String(rec.hrs).padStart(5)} ${rec.fee.toFixed(0).padStart(10)} ${('$' + rec.sharePerM.toFixed(0)).padStart(11)} ${('$' + rec.usdPerH.toFixed(2)).padStart(10)} ${(rec.mktPerH / 1e9).toFixed(2).padStart(11)} ${rec.sigma.toFixed(1).padStart(10)}`,
    )
  }
}

// ---- the regression that decides it -------------------------------------------------------------
// log(share) on log(fee), with log(sigma) as the control. The fee coefficient IS the elasticity:
// -1 means a 1% fee cut buys exactly 1% more share, which is break-even on revenue. Closer to zero
// than -1 and a cut LOSES money.
function ols(y, X) {
  const n = y.length, k = X[0].length
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0))
  const Xty = new Array(k).fill(0)
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i]
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b]
    }
  }
  const M = XtX.map((r, i) => [...r, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))])
  for (let i = 0; i < k; i++) {
    let p = i
    for (let r = i + 1; r < k; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r
    const tmp = M[i]; M[i] = M[p]; M[p] = tmp
    const d = M[i][i]
    if (Math.abs(d) < 1e-12) return null
    for (let j = 0; j < 2 * k; j++) M[i][j] /= d
    for (let r = 0; r < k; r++) {
      if (r === i) continue
      const f = M[r][i]
      for (let j = 0; j < 2 * k; j++) M[r][j] -= f * M[i][j]
    }
  }
  const inv = M.map((r) => r.slice(k))
  const beta = inv.map((r) => r.reduce((s, v, j) => s + v * Xty[j], 0))
  let sse = 0
  for (let i = 0; i < n; i++) {
    const yh = X[i].reduce((s, v, j) => s + v * beta[j], 0)
    sse += (y[i] - yh) ** 2
  }
  const ybar = y.reduce((a, b) => a + b, 0) / n
  const sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0)
  const s2 = sse / (n - k)
  return { beta, se: inv.map((r, i) => Math.sqrt(s2 * r[i])), n, r2: 1 - sse / sst }
}
const use = rows.filter((r) => r.share > 0 && r.feePips > 0 && r.sigma > 0)
const y = use.map((r) => Math.log(r.share))
const models = [
  ['share ~ fee', use.map((r) => [1, Math.log(r.feePips)])],
  ['share ~ fee + sigma', use.map((r) => [1, Math.log(r.feePips), Math.log(r.sigma)])],
]
const regs = []
for (const [label, X] of models) {
  const m = ols(y, X)
  if (!m) continue
  const t = m.beta[1] / m.se[1]
  regs.push({ label, elasticity: m.beta[1], se: m.se[1], t, n: m.n, r2: m.r2 })
  console.log(`\n${label}:  n=${m.n}  R2=${m.r2.toFixed(3)}`)
  console.log(`  fee elasticity  ${m.beta[1].toFixed(3)}  se ${m.se[1].toFixed(3)}  t=${t.toFixed(2)}  ${Math.abs(t) > 1.96 ? 'SIGNIFICANT' : 'not significant'}`)
  if (X[0].length > 2) console.log(`  sigma control   ${m.beta[2].toFixed(3)}  se ${m.se[2].toFixed(3)}  t=${(m.beta[2] / m.se[2]).toFixed(2)}`)
}
console.log('\n  Break-even is -1.00. Closer to zero than -1.00 means a fee cut LOSES revenue.')

fs.writeFileSync('data/eth-elasticity.json', JSON.stringify({ days: DAYS, headTs: tHead, hours: rows.length, byFee: tab, withinVol: within, regs, rows }, null, 1))
console.log('\nwrote data/eth-elasticity.json')
