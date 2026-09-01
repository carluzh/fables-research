// OUR -36% AGAINST THE FIELD'S.
//
// The rolling 24h drop only means something next to what every other venue on the chain did over the
// same two windows. If the field fell as hard, the quiet is the chain's and our share is intact. If
// it did not, we lost ground and the window explanation is incomplete.
//
// The pool universe comes from the frozen census (138 venues, ids and metadata), but the BUCKETS are
// re-pulled fresh, because the census stops at 30 August and both windows are after it.
import fs from 'node:fs'

const HIST = 'https://liquidity.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetPoolHistoryVolume'
const ORIGIN = 'https://app.uniswap.org'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VER = { v4: 3, v3: 2, v2: 1 }

const OURS = new Set([
  '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a',
  '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551',
  '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd',
  '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd',
  '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5',
  '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e',
  '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147',
  '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f',
  '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f',
])

// Same two windows the volume check used, so the -36% reproduces exactly.
const ANCHOR = Number(process.argv[2] ?? 0) || Math.floor(Date.now() / 1000)
const W_NOW = [ANCHOR - 86400, ANCHOR]
const W_PREV = [ANCHOR - 2 * 86400, ANCHOR - 86400]

const census = JSON.parse(fs.readFileSync(new URL('../fables-research/fees/pools/data/census.json', import.meta.url)))
const venues = census.out.filter((r) => (r.buckets || []).some((b) => b.v > 0))
console.log(`${venues.length} venues with volume in the census, re-pulling fresh buckets`)
console.log(`window PREV ${new Date(W_PREV[0] * 1000).toISOString().slice(0, 16)} to ${new Date(W_PREV[1] * 1000).toISOString().slice(0, 16)}`)
console.log(`window NOW  ${new Date(W_NOW[0] * 1000).toISOString().slice(0, 16)} to ${new Date(W_NOW[1] * 1000).toISOString().slice(0, 16)}\n`)

async function hist(id, version) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(HIST, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: ORIGIN }, body: JSON.stringify({ pool: { chainId: 'ROBINHOOD', addressOrId: id, version }, duration: 'HISTORY_DURATION_WEEK' }) })
      const j = await r.json()
      if (j.buckets) return j.buckets.map((x) => ({ t: Number(x.timestamp), v: Number(x.volumeUsd) || 0, f: Number(x.feeUsd) || 0 }))
    } catch (e) { /* retry */ }
    await sleep(700 + i * 600)
  }
  return null
}

const rows = []
let done = 0, failed = 0
for (const v of venues) {
  const b = await hist(v.id, VER[v.proto] ?? 3)
  done++
  if (!b) { failed++; continue }
  const sum = (w) => b.filter((x) => x.t > w[0] && x.t <= w[1]).reduce((a, x) => ({ v: a.v + x.v, f: a.f + x.f }), { v: 0, f: 0 })
  const now = sum(W_NOW), prev = sum(W_PREV)
  if (now.v + prev.v <= 0) continue
  rows.push({
    id: v.id, proto: v.proto, pair: `${v.sym0}/${v.sym1}`,
    tier: v.isDynamicFee ? 'dyn' : String(v.feeTier),
    ours: OURS.has(v.id), nowV: now.v, nowF: now.f, prevV: prev.v, prevF: prev.f,
  })
  if (done % 25 === 0) process.stdout.write(`  ${done}/${venues.length}\n`)
  await sleep(120)
}
console.log(`pulled ${rows.length} venues with volume in either window, ${failed} failed\n`)

const tot = (f) => rows.reduce((a, r) => a + f(r), 0)
const our = rows.filter((r) => r.ours)
const riv = rows.filter((r) => !r.ours)
const pack = (g) => ({ nowV: g.reduce((a, r) => a + r.nowV, 0), prevV: g.reduce((a, r) => a + r.prevV, 0), nowF: g.reduce((a, r) => a + r.nowF, 0), prevF: g.reduce((a, r) => a + r.prevF, 0) })
const O = pack(our), R = pack(riv), A = pack(rows)
const pc = (a, b) => (b > 0 ? `${(100 * (a / b - 1)).toFixed(1)}%` : '-')

console.log('THE HEADLINE: our rolling-24h drop against everyone else on the chain')
console.log(`${''.padEnd(22)} ${'prev 24h'.padStart(16)} ${'now 24h'.padStart(16)} ${'change'.padStart(9)}`)
console.log(`${'US (9 pools)'.padEnd(22)} ${('$' + Math.round(O.prevV).toLocaleString()).padStart(16)} ${('$' + Math.round(O.nowV).toLocaleString()).padStart(16)} ${pc(O.nowV, O.prevV).padStart(9)}`)
console.log(`${'EVERYONE ELSE'.padEnd(22)} ${('$' + Math.round(R.prevV).toLocaleString()).padStart(16)} ${('$' + Math.round(R.nowV).toLocaleString()).padStart(16)} ${pc(R.nowV, R.prevV).padStart(9)}`)
console.log(`${'WHOLE CHAIN'.padEnd(22)} ${('$' + Math.round(A.prevV).toLocaleString()).padStart(16)} ${('$' + Math.round(A.nowV).toLocaleString()).padStart(16)} ${pc(A.nowV, A.prevV).padStart(9)}`)
console.log(`\nOUR SHARE OF CHAIN VOLUME:  prev ${(100 * O.prevV / A.prevV).toFixed(3)}%   now ${(100 * O.nowV / A.nowV).toFixed(3)}%   ${O.prevV > 0 && A.prevV > 0 ? ((O.nowV / A.nowV) / (O.prevV / A.prevV)).toFixed(3) + 'x' : ''}`)
console.log(`OUR FEES:  prev $${O.prevF.toFixed(0)}  now $${O.nowF.toFixed(0)}  ${pc(O.nowF, O.prevF)}`)
console.log(`RIVAL FEES: prev $${R.prevF.toFixed(0)}  now $${R.nowF.toFixed(0)}  ${pc(R.nowF, R.prevF)}`)

// per asset, because the chain total is dominated by ETH
const ASSET = (r) => {
  for (const a of ['GLD', 'SPY', 'NVDA', 'META', 'TSLA', 'AAPL']) if (r.pair.includes(a)) return a
  if (/ETH|WETH/.test(r.pair)) return 'ETH'
  return 'other'
}
console.log('\nPER ASSET: our change against our own field, and whether we held share')
console.log(`${'asset'.padEnd(7)} ${'our prev'.padStart(13)} ${'our now'.padStart(13)} ${'ours'.padStart(8)}   ${'field prev'.padStart(15)} ${'field now'.padStart(15)} ${'field'.padStart(8)}   ${'share prev'.padStart(11)} ${'share now'.padStart(10)}`)
const out = {}
for (const a of ['ETH', 'SPY', 'GLD', 'NVDA', 'META', 'TSLA', 'AAPL']) {
  const g = rows.filter((r) => ASSET(r) === a)
  if (!g.length) continue
  const o = pack(g.filter((r) => r.ours)), f = pack(g)
  if (f.prevV + f.nowV <= 0) continue
  out[a] = { our: o, field: f }
  console.log(
    `${a.padEnd(7)} ${('$' + Math.round(o.prevV).toLocaleString()).padStart(13)} ${('$' + Math.round(o.nowV).toLocaleString()).padStart(13)} ${pc(o.nowV, o.prevV).padStart(8)}   ` +
    `${('$' + Math.round(f.prevV).toLocaleString()).padStart(15)} ${('$' + Math.round(f.nowV).toLocaleString()).padStart(15)} ${pc(f.nowV, f.prevV).padStart(8)}   ` +
    `${(f.prevV > 0 ? (100 * o.prevV / f.prevV).toFixed(2) + '%' : '-').padStart(11)} ${(f.nowV > 0 ? (100 * o.nowV / f.nowV).toFixed(2) + '%' : '-').padStart(10)}`,
  )
}

// the biggest movers, so a single venue driving the field is visible
console.log('\nTHE TEN BIGGEST VENUES NOW, and what each did')
const top = [...rows].sort((a, b) => b.nowV - a.nowV).slice(0, 10)
console.log(`${'venue'.padEnd(30)} ${'prev 24h'.padStart(16)} ${'now 24h'.padStart(16)} ${'change'.padStart(9)}`)
for (const r of top) {
  console.log(`${((r.ours ? '* ' : '  ') + r.proto + ' ' + r.pair + ' ' + r.tier).slice(0, 30).padEnd(30)} ${('$' + Math.round(r.prevV).toLocaleString()).padStart(16)} ${('$' + Math.round(r.nowV).toLocaleString()).padStart(16)} ${pc(r.nowV, r.prevV).padStart(9)}`)
}
console.log('  * = ours')

fs.writeFileSync('data/fieldcompare.json', JSON.stringify({ anchor: ANCHOR, wNow: W_NOW, wPrev: W_PREV, ours: O, rivals: R, all: A, perAsset: out, rows }, null, 1))
console.log('\nwrote data/fieldcompare.json')
