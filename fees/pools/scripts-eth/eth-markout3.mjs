// ETH/USDG markouts, corrected. Two bugs in the first attempts, both now fixed.
//
//  1. DIRECTION WAS INVERTED. In v4 the Swap event's amounts are the CALLER's deltas: amount0 > 0
//     means the caller received token0, i.e. the trader BOUGHT ETH. Confirmed empirically: the
//     a0 > 0 group executes ~205 pips above the a0 < 0 group, which is half a 450-pip fee, so the
//     higher-executing group is the buyer.
//  2. THE FEE IS INSIDE THE EXECUTION PRICE, so a markout measured from exec already contains the
//     fee and adding fees on top double counts. There is also a persistent ~180 pip basis between
//     the pool's ETH price and Binance ETHUSDT (USDG against USDT), which biases any exec-based
//     measure.
//
// Both are avoided by measuring the LP's P&L on the INVENTORY they were forced to take, marked at
// the reference, and never touching exec at all:
//
//     LP markout(H) = -qty_to_trader * ( R(t+H) - R(t) )
//
// A constant basis cancels. The fee does not enter. If the trader bought ETH from us and ETH then
// rose, we lost, and that loss is adverse selection in dollars.
import { c, SWAP, retry, scan } from './lib.mjs'
import fs from 'node:fs'

const POOL_ID = '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551'
const HOURS = Number(process.argv[2] ?? 48)
const HORIZONS = [1, 5, 30, 60]

const head = await retry(() => c.getBlockNumber())
const bA = await retry(() => c.getBlock({ blockNumber: head }))
const bB = await retry(() => c.getBlock({ blockNumber: head - 500000n }))
const SEC = (Number(bA.timestamp) - Number(bB.timestamp)) / 500000
const tHead = Number(bA.timestamp)
const BACK = Number(process.argv[3] ?? 0)   // hours to shift the window back, for an independent sample
const endBn = head - BigInt(Math.round((BACK * 3600) / SEC))
const from = endBn - BigInt(Math.round((HOURS * 3600) / SEC))
const tsOf = (bn) => tHead - (Number(head) - Number(bn)) * SEC

console.log(`ETH/USDG markouts, ${HOURS}h to ${new Date(tHead * 1000).toISOString()}`)
const logs = await scan(SWAP, POOL_ID, from, endBn, 100000n)

async function klines(sym, s, e) {
  const out = []
  let cur = s
  while (cur < e) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1m&startTime=${cur}&limit=1000`)
    const j = await r.json()
    if (!Array.isArray(j) || !j.length) break
    out.push(...j.map((k) => ({ t: Math.floor(k[0] / 1000), c: Number(k[4]) })))
    cur = (out[out.length - 1].t + 60) * 1000
    if (j.length < 1000) break
    await new Promise((x) => setTimeout(x, 250))
  }
  return new Map(out.map((r) => [r.t - (r.t % 60), r.c]))
}
const REF = await klines('ETHUSDT', (Math.floor(tsOf(from)) - 180) * 1000, (tHead + 70 * 60) * 1000)
const refAt = (t) => { const m = t - (t % 60); for (let k = 0; k <= 5; k++) if (REF.has(m - k * 60)) return REF.get(m - k * 60); return null }
console.log(`swaps ${logs.length}   reference ${REF.size} 1m closes`)

const rows = []
for (const l of logs) {
  const a0 = Number(l.args.amount0) / 1e18   // ETH, CALLER delta: >0 = trader received ETH = BOUGHT
  const a1 = Number(l.args.amount1) / 1e6    // USDG
  if (a0 === 0) continue
  const t = Math.floor(tsOf(l.blockNumber))
  const r0 = refAt(t)
  if (!r0) continue
  const notional = Math.abs(a1)
  if (notional < 1) continue                 // dust
  const row = { t, qty: a0, notional, feePips: Number(l.args.fee), r0 }
  for (const H of HORIZONS) {
    const rh = refAt(t + H * 60)
    row['m' + H] = rh === null ? null : -a0 * (rh - r0)
  }
  rows.push(row)
}
const buys = rows.filter((r) => r.qty > 0).length
console.log(`usable ${rows.length}   buys ${buys}   sells ${rows.length - buys}\n`)

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)) }
const stat = (a) => { const m = mean(a), se = sd(a) / Math.sqrt(a.length); return { n: a.length, mean: m, se, t: m / se } }

const totNot = rows.reduce((a, r) => a + r.notional, 0)
const totFee = rows.reduce((a, r) => a + (r.notional * r.feePips) / 1e6, 0)
console.log(`notional $${Math.round(totNot).toLocaleString()}   fees $${totFee.toFixed(2)}   realised ${((1e6 * totFee) / totNot).toFixed(0)} pips\n`)

console.log('ADVERSE SELECTION BY HORIZON. Positive markout = LP won.')
console.log('horizon      n   markout $   pips of notional     se     t      fee pips   fee/adverse')
const out = { hours: HOURS, n: rows.length, notional: totNot, fees: totFee, horizons: {} }
for (const H of HORIZONS) {
  const g = rows.filter((r) => r['m' + H] !== null)
  const mk = g.reduce((a, r) => a + r['m' + H], 0)
  const notl = g.reduce((a, r) => a + r.notional, 0)
  const fee = g.reduce((a, r) => a + (r.notional * r.feePips) / 1e6, 0)
  const pipsPer = g.map((r) => (1e6 * r['m' + H]) / r.notional)
  const s = stat(pipsPer)
  const advPips = -(1e6 * mk) / notl          // +ve = LPs losing
  const feePips = (1e6 * fee) / notl
  out.horizons[H] = { n: g.length, markoutUsd: mk, advPips, feePips, t: s.t }
  console.log(
    `${(H + 'm').padEnd(8)} ${String(g.length).padStart(6)} ${mk.toFixed(2).padStart(11)} ${((1e6 * mk) / notl).toFixed(1).padStart(17)} ${s.se.toFixed(1).padStart(7)} ${s.t.toFixed(2).padStart(6)} ${feePips.toFixed(0).padStart(12)} ${(advPips > 0 ? (feePips / advPips).toFixed(1) + 'x' : 'LP wins').padStart(13)}`,
  )
}

console.log('\nBY TICKET SIZE, at 5m')
console.log('ticket $         n    volume $     adverse pips      t')
for (const [lo, hi] of [[1, 100], [100, 1000], [1000, 10000], [10000, 1e9]]) {
  const g = rows.filter((r) => r.notional >= lo && r.notional < hi && r.m5 !== null)
  if (g.length < 30) continue
  const vol = g.reduce((a, r) => a + r.notional, 0)
  const mk = g.reduce((a, r) => a + r.m5, 0)
  const s = stat(g.map((r) => (1e6 * r.m5) / r.notional))
  console.log(`${(lo + '-' + (hi > 1e8 ? 'inf' : hi)).padEnd(15)} ${String(g.length).padStart(5)} ${Math.round(vol).toLocaleString().padStart(11)} ${(-(1e6 * mk) / vol).toFixed(1).padStart(15)} ${s.t.toFixed(2).padStart(7)}`)
}

console.log('\nDOES THE KEEPER TRACK TOXICITY? adverse selection at 5m, split by the fee it charged')
console.log('fee charged       n    volume $     adverse pips     charged     ratio       t-stat')
for (const [lo, hi] of [[0, 500], [500, 700], [700, 1200], [1200, 3001]]) {
  const g = rows.filter((r) => r.feePips >= lo && r.feePips < hi && r.m5 !== null)
  if (g.length < 30) { continue }
  const vol = g.reduce((a, r) => a + r.notional, 0)
  const mk = g.reduce((a, r) => a + r.m5, 0)
  const adv = -(1e6 * mk) / vol
  const chg = (1e6 * g.reduce((a, r) => a + (r.notional * r.feePips) / 1e6, 0)) / vol
  const st = stat(g.map((r) => (1e6 * r.m5) / r.notional))
  console.log(`${(lo + '-' + hi).padEnd(15)} ${String(g.length).padStart(5)} ${Math.round(vol).toLocaleString().padStart(11)} ${adv.toFixed(1).padStart(15)} ${chg.toFixed(0).padStart(11)} ${(adv > 0 ? (chg / adv).toFixed(1) + 'x' : 'LP wins').padStart(10)} ${('t=' + st.t.toFixed(2)).padStart(10)}`)
}

fs.writeFileSync('data/eth-markout3.json', JSON.stringify(out))
console.log('\nwrote data/eth-markout3.json')
