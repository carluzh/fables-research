// Which Chainlink-style feeds are live on chain 4663 right now, what they say, and how stale they
// are on a Sunday. The RHOracle scan in Research/RHOracle is from 2026-08-07 and found no gold feed;
// this checks whether that is still true and how the feeds behave when the underlying market is shut.
import { c, retry } from './lib.mjs'
import fs from 'node:fs'

const LATEST = '0xfeaf968c' // latestRoundData()
const DESC = '0x7284e416' // description()
const DECI = '0x313ce567' // decimals()

const KNOWN = [
  ['RHSPY / USD', '0x78bcb218fa04b9b3a278ebc865ed320bf8defbac'],
  ['RHNVDA / USD', '0xc9d16e4f2569b9e3ea0468fd85844953713dc2a2'],
  ['Robinhood META / USD', '0xc190b6164b9e320a6400cdab0085a2e0e2b9738e'],
  ['ETH / USD', '0x6091e64eb7138eef066a80fd3a0d7427b91f2721'],
  ['RHTSLA / USD', '0x7a6b81ba7fbcb90104d8c496158cf383cd7233b1'],
  ['Robinhood AAPL / USD', '0xbb11a21267cfdb63d4935d99a499133dd1744acb'],
  ['Robinhood SLV / USD', '0xcdf6f7043b3af6afa0caaace1230b355096b5386'],
  ['Robinhood SGOV-USD', '0x0e96b7708487f91baac09697593d3e8bf253f2d8'],
  ['Robinhood QQQ / USD', '0x25e996ce8b3529885d429241156e83e7b7744049'],
  ['USDG / USD', '0x8beee3503f6860d5dac4ce26b5eee92982951c2e'],
  ['BTC / USD', '0xc5845f87ad59a7a3d4bf9b90a0c19dba38475eec'],
]

const head = await retry(() => c.getBlockNumber())
const hb = await retry(() => c.getBlock({ blockNumber: head }))
const nowTs = Number(hb.timestamp)
console.log(`head ${head}  ${new Date(nowTs * 1000).toISOString()}\n`)

function decInt(hex, off) {
  const w = BigInt('0x' + hex.slice(2 + off * 64, 2 + (off + 1) * 64))
  return w
}
function decSigned(hex, off) {
  let v = decInt(hex, off)
  if (v >= 1n << 255n) v -= 1n << 256n
  return v
}
function decStr(hex) {
  const b = Buffer.from(hex.slice(2), 'hex')
  if (b.length < 64) return null
  const off = Number(BigInt('0x' + b.subarray(0, 32).toString('hex')))
  const len = Number(BigInt('0x' + b.subarray(off, off + 32).toString('hex')))
  return b.subarray(off + 32, off + 32 + len).toString('utf8')
}

console.log('feed                            answer        updatedAt (UTC)        age')
const live = {}
for (const [label, a] of KNOWN) {
  try {
    const r = await retry(() => c.call({ to: a, data: LATEST }))
    const d = await retry(() => c.call({ to: a, data: DECI }))
    const dec = Number(decInt(d.data, 0))
    const answer = Number(decSigned(r.data, 1)) / 10 ** dec
    const updatedAt = Number(decInt(r.data, 3))
    const age = nowTs - updatedAt
    live[label] = { addr: a, answer, updatedAt, ageSec: age, dec }
    const h = Math.floor(age / 3600)
    const m = Math.floor((age % 3600) / 60)
    console.log(
      `${label.padEnd(24)} ${answer.toFixed(4).padStart(12)}  ${new Date(updatedAt * 1000).toISOString().slice(0, 19)}  ${String(h).padStart(3)}h${String(m).padStart(2, '0')}m`,
    )
  } catch (e) {
    console.log(`${label.padEnd(24)} CALL FAILED ${String(e).slice(0, 80)}`)
  }
}

// Enumerate every feed that has published recently, and look for gold.
const AU = '0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f'
const SPAN = BigInt(process.argv[2] ?? 400000)
console.log(`\nscanning AnswerUpdated over the last ${SPAN} blocks (~${((Number(SPAN) * 0.101) / 3600).toFixed(1)}h) for live emitters`)
const emitters = new Map()
for (let b = head - SPAN; b <= head; b += 100000n) {
  const e = b + 99999n > head ? head : b + 99999n
  try {
    const logs = await retry(() => c.getLogs({ fromBlock: b, toBlock: e, topics: [AU] }))
    for (const l of logs) {
      const k = l.address.toLowerCase()
      emitters.set(k, (emitters.get(k) || 0) + 1)
    }
    console.log(`  blocks ${b}..${e}: ${logs.length} AnswerUpdated`)
  } catch (err) {
    console.log(`  blocks ${b}..${e}: FAILED ${String(err).slice(0, 100)}`)
  }
}
console.log(`\n${emitters.size} distinct emitters published in that window`)
const rows = []
for (const [addr, n] of [...emitters.entries()].sort((x, y) => y[1] - x[1])) {
  let desc = null
  try {
    const r = await retry(() => c.call({ to: addr, data: DESC }))
    desc = decStr(r.data)
  } catch (e) { /* not a describable feed */ }
  rows.push({ addr, n, desc })
  console.log(`  ${String(n).padStart(5)}  ${addr}  ${desc ?? '(no description)'}`)
}
const gold = rows.filter((r) => /GLD|XAU|GOLD/i.test(r.desc ?? ''))
console.log(`\nGOLD FEEDS FOUND: ${gold.length}`)
for (const g of gold) console.log('  ', g.addr, g.desc, 'n=' + g.n)

fs.writeFileSync(new URL('../data/oracle.json', import.meta.url), JSON.stringify({ headTs: nowTs, head: Number(head), live, emitters: rows }, null, 1))
console.log('\nwrote data/oracle.json')
