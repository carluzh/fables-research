// SHARE BY DAY AND SESSION, for any asset. Generalises spyshare.mjs.
//
// META matters most here: its CLOSED tier went 250 -> 450 at 2026-08-30 21:49:39 UTC, the only fee
// change anyone has shipped, so it is the only pre-registered experiment with any data at all. The
// script splits META's CLOSED hours either side of that timestamp.
//
// Usage: node assetshare.mjs META NVDA
import fs from 'node:fs'
const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'
const ORIGIN = 'https://app.uniswap.org'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VER = { v4: 3, v3: 2, v2: 1 }

const OUR = {
  META: '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5',
  NVDA: '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd',
  SPY: '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd',
  GLD: '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a',
}
// The one shipped fee change, so its effect can be split out rather than averaged away.
const META_CLOSED_CHANGE = Date.UTC(2026, 7, 30, 21, 49, 39) / 1000

const census = JSON.parse(fs.readFileSync(new URL('../fables-research/fees/pools/data/census.json', import.meta.url)))
const assets = process.argv.slice(2)
if (!assets.length) { console.error('give one or more assets'); process.exit(1) }

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

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function session(t) {
  const et = new Date((t - 4 * 3600) * 1000)
  const d = et.getUTCDay(), h = et.getUTCHours() + et.getUTCMinutes() / 60
  if (d === 0 || d === 6) return 'CLOSED'
  if (d === 5 && h >= 16) return 'CLOSED'
  return h >= 9.5 && h < 16 ? 'OPEN' : 'OVERNIGHT'
}
const key = (t) => new Date(t * 1000).toISOString().slice(0, 10)

const results = {}
for (const A of assets) {
  const field = census.out.filter((r) => (r.sym0 === A || r.sym1 === A) && (r.buckets || []).some((b) => b.v > 0))
  console.log(`\n=== ${A}: ${field.length} venues in the field ===`)
  const bk = {}
  for (const v of field) { bk[v.id] = await hist(v.id, VER[v.proto] ?? 3); await sleep(150) }

  const agg = {}
  for (const [id, bs] of Object.entries(bk)) {
    for (const b of bs) {
      if (b.v <= 0) continue
      let sess = session(b.t)
      if (A === 'META' && sess === 'CLOSED') sess = b.t < META_CLOSED_CHANGE ? 'CLOSED@250' : 'CLOSED@450'
      const k = `${key(b.t)}|${sess}`
      agg[k] = agg[k] ?? { ours: 0, field: 0, ourFees: 0 }
      agg[k].field += b.v
      if (id === OUR[A]) { agg[k].ours += b.v; agg[k].ourFees += b.f }
    }
  }
  const rows = []
  console.log(`${'day'.padEnd(12)} ${'dow'.padEnd(4)} ${'session'.padEnd(12)} ${'our volume'.padStart(12)} ${'field'.padStart(14)} ${'share'.padStart(8)} ${'our pips'.padStart(9)}`)
  for (const k of Object.keys(agg).sort()) {
    const [day, sess] = k.split('|')
    const a = agg[k]
    if (a.field <= 0) continue
    const rec = { day, dow: DOW[new Date(day + 'T12:00:00Z').getUTCDay()], sess, ours: a.ours, field: a.field, share: a.ours / a.field, pips: a.ours > 0 ? (1e6 * a.ourFees) / a.ours : 0 }
    rows.push(rec)
    console.log(`${day.padEnd(12)} ${rec.dow.padEnd(4)} ${sess.padEnd(12)} ${('$' + Math.round(a.ours).toLocaleString()).padStart(12)} ${('$' + Math.round(a.field).toLocaleString()).padStart(14)} ${(100 * rec.share).toFixed(2).padStart(7)}% ${rec.pips.toFixed(0).padStart(9)}`)
  }
  results[A] = rows

  console.log(`\n  ${A} grouped by session:`)
  for (const s of [...new Set(rows.map((r) => r.sess))].sort()) {
    const g = rows.filter((r) => r.sess === s)
    const ov = g.reduce((a, r) => a + r.ours, 0), fv = g.reduce((a, r) => a + r.field, 0)
    console.log(`    ${s.padEnd(12)} ${g.length} day(s)  our $${Math.round(ov).toLocaleString()}  field $${Math.round(fv).toLocaleString()}  share ${(100 * ov / fv).toFixed(2)}%`)
    for (const r of g) console.log(`        ${r.day} ${r.dow}  ${(100 * r.share).toFixed(2)}% at ${r.pips.toFixed(0)} pips`)
  }
}
fs.writeFileSync('data/assetshare.json', JSON.stringify(results, null, 1))
console.log('\nwrote data/assetshare.json')
