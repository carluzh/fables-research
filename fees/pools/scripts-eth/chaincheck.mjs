// CLOSES THE GAP THE VOLUME CHECK ADMITTED TO.
//
// VOLUME-CHECK-2026-09-01.md rests entirely on the Uniswap indexer, and the raw-chain scan meant to
// verify it was abandoned because a 4-day, 7-pool scan ran past 30 minutes under RPC rate limiting.
// The fix is to stop trying to reproduce the whole table. One day and the two pools that carry 88%
// of Monday's volume is enough to test whether the endpoint is telling the truth, and it is roughly
// one twentieth of the work.
//
// Monday 2026-08-31 00:00Z to 2026-09-01 00:00Z, ETH and SPY, against the indexer's daily figure.
import { c, SWAP, retry, scan } from './lib.mjs'
import fs from 'node:fs'

const DAY_START = Date.UTC(2026, 7, 31, 0, 0, 0) / 1000 // month is 0-indexed: 7 = August
const DAY_END = DAY_START + 86400

// Indexer daily volume for the same day, from freshvol.json, so the comparison uses what was reported
const fresh = JSON.parse(fs.readFileSync('data/freshvol.json'))
const CHECK = [
  ['ETH', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551', 'amount1', 6],
  ['SPY', '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd', 'amount1', 6],
]

const head = await retry(() => c.getBlockNumber())
const bA = await retry(() => c.getBlock({ blockNumber: head }))
const bB = await retry(() => c.getBlock({ blockNumber: head - 1000000n }))
const SEC = (Number(bA.timestamp) - Number(bB.timestamp)) / 1000000
const tHead = Number(bA.timestamp)
const blockAt = (t) => head - BigInt(Math.round((tHead - t) / SEC))
const tsOf = (bn) => tHead - (Number(head) - Number(bn)) * SEC

const from = blockAt(DAY_START), to = blockAt(DAY_END)
console.log(`Monday 2026-08-31 UTC, blocks ${from} to ${to} (block time ${SEC.toFixed(4)}s)`)
console.log(`Raw Swap events against the indexer's daily volume.\n`)

const out = []
for (const [name, id, field, dec] of CHECK) {
  let logs
  try { logs = await scan(SWAP, id, from, to, 150000n) } catch (e) { console.log(`${name}: scan failed ${String(e).slice(0, 60)}`); continue }
  let vol = 0, fees = 0, n = 0
  for (const l of logs) {
    const t = tsOf(l.blockNumber)
    if (t < DAY_START || t >= DAY_END) continue // trim the interpolation's edge slop
    const v = Math.abs(Number(l.args[field])) / 10 ** dec
    if (!(v > 0)) continue
    vol += v
    fees += (v * Number(l.args.fee)) / 1e6
    n++
  }
  const idx = fresh.ours[name]['2026-08-31']
  const ratio = idx && idx.v > 0 ? vol / idx.v : null
  out.push({ name, swaps: n, chainVol: vol, chainFees: fees, indexerVol: idx ? idx.v : null, indexerFees: idx ? idx.f : null, ratio })
  console.log(`${name}`)
  console.log(`  raw chain    ${n.toLocaleString()} swaps   $${Math.round(vol).toLocaleString()}   fees $${fees.toFixed(0)}   ${(1e6 * fees / vol).toFixed(0)} pips`)
  console.log(`  indexer                      $${Math.round(idx.v).toLocaleString()}   fees $${idx.f.toFixed(0)}   ${(1e6 * idx.f / idx.v).toFixed(0)} pips`)
  console.log(`  chain / indexer  volume ${ratio.toFixed(4)}   fees ${(fees / idx.f).toFixed(4)}\n`)
}

const cv = out.reduce((a, r) => a + r.chainVol, 0)
const iv = out.reduce((a, r) => a + (r.indexerVol ?? 0), 0)
console.log(`COMBINED  chain $${Math.round(cv).toLocaleString()}  indexer $${Math.round(iv).toLocaleString()}  ratio ${(cv / iv).toFixed(4)}`)
console.log(cv / iv > 0.97 && cv / iv < 1.03
  ? 'WITHIN 3%: the indexer is telling the truth and the volume check stands.'
  : 'OUTSIDE 3%: the volume check needs revisiting.')
fs.writeFileSync('data/chaincheck.json', JSON.stringify({ day: '2026-08-31', out, combined: { chainVol: cv, indexerVol: iv, ratio: cv / iv } }, null, 1))
console.log('\nwrote data/chaincheck.json')
