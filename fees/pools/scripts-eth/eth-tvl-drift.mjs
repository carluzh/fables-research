// DID OUR TVL MOVE UNDER THE MEASUREMENT? The APR comparison divides a week of fees by ONE
// end-of-window TVL snapshot, and REPRO-NOTES records our ETH pool going $282,628 to $1,040,994 in
// three days: 3.68x. If our capital arrived at the END of the week, the week's fees were earned on
// a much smaller base and our real APR is far above the 28% the table shows. That would move the
// whole comparison, so it has to be checked before anything is concluded from it.
//
// No TVL time series exists. But every v4 Swap carries `liquidity` and `sqrtPriceX96`, so
// virtual = 2 * L * sqrt(P) is readable at every swap, and with the range placement held roughly
// fixed virtual tracks TVL. Daily medians, our pool against the closest comparable.
import { c, SWAP, retry, span } from './lib.mjs'
import fs from 'node:fs'

const POOLS = [
  ['OURS  v4 ETH/USDG dyn', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551', 1042590],
  ['v4 ETH/USDG 577', '0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32', 2605672],
]
const DAYS = Number(process.argv[2] ?? 7)
const Q96 = 2 ** 96

const head = await retry(() => c.getBlockNumber())
const bA = await retry(() => c.getBlock({ blockNumber: head }))
const bB = await retry(() => c.getBlock({ blockNumber: head - 500000n }))
const SEC = (Number(bA.timestamp) - Number(bB.timestamp)) / 500000
const tHead = Number(bA.timestamp)
const tsOf = (bn) => tHead - (Number(head) - Number(bn)) * SEC
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }

console.log(`daily median virtual depth, ${DAYS}d to ${new Date(tHead * 1000).toISOString()}\n`)

// One short probe window per day per pool: virtual is a level, not a flow, so a slice is enough
// and a full-window scan on a 651k-transaction pool is not affordable.
const PROBE_SEC = 1800
const out = {}
for (const [name, id, tvlNow] of POOLS) {
  console.log(`${name}   TVL now $${tvlNow.toLocaleString()}`)
  console.log(`  ${'day'.padEnd(12)} ${'swaps'.padStart(6)} ${'median virtual $'.padStart(18)} ${'implied TVL $'.padStart(15)} ${'vs now'.padStart(8)}`)
  const series = []
  for (let d = DAYS - 1; d >= 0; d--) {
    const tEnd = tHead - d * 86400
    const bEnd = head - BigInt(Math.round((d * 86400) / SEC))
    const bStart = bEnd - BigInt(Math.round(PROBE_SEC / SEC))
    let logs = []
    try { logs = await span(SWAP, id, bStart, bEnd) } catch { /* probe missed */ }
    const virts = []
    for (const l of logs) {
      const L = Number(l.args.liquidity), sp = Number(l.args.sqrtPriceX96) / Q96
      if (L > 0 && sp > 0) virts.push((2 * L * sp) / 1e6)
    }
    const v = med(virts)
    const iso = new Date(tEnd * 1000).toISOString().slice(0, 10)
    series.push({ day: iso, ts: tEnd, swaps: logs.length, virtual: v })
    if (v === null) { console.log(`  ${iso.padEnd(12)} ${String(logs.length).padStart(6)}   no swaps in the probe window`); continue }
    console.log(`  ${iso.padEnd(12)} ${String(logs.length).padStart(6)} ${('$' + Math.round(v).toLocaleString()).padStart(18)}`)
  }
  const last = series.filter((s) => s.virtual !== null).slice(-1)[0]
  for (const s of series) s.impliedTvl = s.virtual === null || !last ? null : (tvlNow * s.virtual) / last.virtual
  console.log()
  console.log(`  ${'day'.padEnd(12)} ${'implied TVL $'.padStart(15)} ${'vs now'.padStart(8)}`)
  for (const s of series) {
    if (s.impliedTvl === null) continue
    console.log(`  ${s.day.padEnd(12)} ${('$' + Math.round(s.impliedTvl).toLocaleString()).padStart(15)} ${(s.impliedTvl / tvlNow).toFixed(2).padStart(7)}x`)
  }
  const ok = series.filter((s) => s.impliedTvl !== null)
  const avg = ok.reduce((a, s) => a + s.impliedTvl, 0) / ok.length
  out[name] = { id, tvlNow, series, avgImpliedTvl: avg, ratio: avg / tvlNow }
  console.log(`\n  window-average implied TVL $${Math.round(avg).toLocaleString()}, which is ${(avg / tvlNow).toFixed(2)}x the snapshot.`)
  console.log(`  So the reported APR is understated by ${(tvlNow / avg).toFixed(2)}x if capital arrived late, overstated if it left.\n`)
}

fs.writeFileSync('data/eth-tvl-drift.json', JSON.stringify(out, null, 1))
console.log('wrote data/eth-tvl-drift.json')
