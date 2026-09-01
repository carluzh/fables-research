// SPY SHARE, DAY BY DAY AND SESSION BY SESSION.
//
// The field comparison says our SPY volume fell 65.6% between the two rolling windows while its field
// fell only 15.3%, taking our share from 22.00% to 8.94%. That is not a window effect and it is not
// the market. Two candidates, and they need separating:
//
//   1. WEEKEND STRUCTURE. On a closed weekend the on-chain pool is the only venue trading SPY, so
//      everyone's share numbers are unusual and ours may simply be flattered. If so, this Monday
//      should look like last Monday.
//   2. OUR PRICE. SPY runs 250 pips in CLOSED and 800 open / 350 overnight on a weekday. The two
//      windows straddle exactly that change.
//
// Test 1 settles it: same weekday, same session, this week against last.
import fs from 'node:fs'
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'
const ORIGIN = 'https://app.uniswap.org'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VER = { v4: 3, v3: 2, v2: 1 }
const OUR_SPY = '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd'

const census = JSON.parse(fs.readFileSync(new URL('../fables-research/fees/pools/data/census.json', import.meta.url)))
// every venue trading SPY against anything
const field = census.out.filter((r) => (r.sym0 === 'SPY' || r.sym1 === 'SPY') && (r.buckets || []).some((b) => b.v > 0))
console.log(`SPY field: ${field.length} venues\n`)

async function hist(id, version) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(HIST, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN }, body: JSON.stringify({ pool: { chainId: 'ROBINHOOD', addressOrId: id, version }, duration: 'HISTORY_DURATION_WEEK' }) })
      const j = await r.json()
      if (j.buckets) return j.buckets.map((x) => ({ t: Number(x.timestamp), v: Number(x.volumeUsd) || 0, f: Number(x.feeUsd) || 0 }))
    } catch (e) { /* retry */ }
    await sleep(700 + i * 500)
  }
  return []
}

// ET session for a UTC timestamp. EDT = UTC-4 in August. Contract opens 09:30, closes 16:00.
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function session(t) {
  const et = new Date((t - 4 * 3600) * 1000)
  const d = et.getUTCDay(), h = et.getUTCHours() + et.getUTCMinutes() / 60
  if (d === 0 || d === 6) return 'CLOSED'
  if (d === 5 && h >= 16) return 'CLOSED'
  return h >= 9.5 && h < 16 ? 'OPEN' : 'OVERNIGHT'
}

const bucketsBy = {}
for (const v of field) {
  bucketsBy[v.id] = await hist(v.id, VER[v.proto] ?? 3)
  await sleep(150)
}

// fresh buckets only go back a week, so last Monday may be partly out of range; say so if it is
const all = Object.values(bucketsBy).flat()
const tMin = Math.min(...all.map((x) => x.t)), tMax = Math.max(...all.map((x) => x.t))
console.log(`fresh buckets cover ${new Date(tMin * 1000).toISOString().slice(0, 16)} to ${new Date(tMax * 1000).toISOString().slice(0, 16)}\n`)

const key = (t) => new Date(t * 1000).toISOString().slice(0, 10)
const agg = {}
for (const [id, bs] of Object.entries(bucketsBy)) {
  for (const b of bs) {
    if (b.v <= 0) continue
    const k = `${key(b.t)}|${session(b.t)}`
    agg[k] = agg[k] ?? { ours: 0, field: 0, ourFees: 0 }
    agg[k].field += b.v
    if (id === OUR_SPY) { agg[k].ours += b.v; agg[k].ourFees += b.f }
  }
}

console.log('SPY, BY DAY AND SESSION. share is our volume over the whole SPY field.')
console.log(`${'day'.padEnd(12)} ${'dow'.padEnd(4)} ${'session'.padEnd(10)} ${'our volume'.padStart(13)} ${'field'.padStart(15)} ${'share'.padStart(8)} ${'our pips'.padStart(9)}`)
const keys = Object.keys(agg).sort()
const rows = []
for (const k of keys) {
  const [day, sess] = k.split('|')
  const a = agg[k]
  if (a.field <= 0) continue
  const rec = { day, dow: DOW[new Date(day + 'T12:00:00Z').getUTCDay()], sess, ours: a.ours, field: a.field, share: a.ours / a.field, pips: a.ours > 0 ? (1e6 * a.ourFees) / a.ours : 0 }
  rows.push(rec)
  console.log(`${day.padEnd(12)} ${rec.dow.padEnd(4)} ${sess.padEnd(10)} ${('$' + Math.round(a.ours).toLocaleString()).padStart(13)} ${('$' + Math.round(a.field).toLocaleString()).padStart(15)} ${(100 * rec.share).toFixed(2).padStart(7)}% ${rec.pips.toFixed(0).padStart(9)}`)
}

console.log('\nTHE TEST: same session, weekday against weekday')
for (const s of ['OPEN', 'OVERNIGHT', 'CLOSED']) {
  const g = rows.filter((r) => r.sess === s)
  if (!g.length) continue
  console.log(`\n${s}`)
  for (const r of g) console.log(`  ${r.day} ${r.dow}  share ${(100 * r.share).toFixed(2)}%  at ${r.pips.toFixed(0)} pips  (ours $${Math.round(r.ours).toLocaleString()} of $${Math.round(r.field).toLocaleString()})`)
}

fs.writeFileSync('data/spyshare.json', JSON.stringify(rows, null, 1))
console.log('\nwrote data/spyshare.json')
