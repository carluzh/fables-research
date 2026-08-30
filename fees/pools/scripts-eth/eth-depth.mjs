// IS THE ETH GAP PRICE OR DEPTH?
//
// The field table says a v4 ETH/USDG pool at a STATIC 577 pips earns 1.72x our LP APR, and one at
// 625 earns 1.77x. APR is turnover times fee, and the decomposition puts almost all of it in
// turnover: 2.3x and 2.2x. If that turnover gap is concentration rather than routing, the lever is
// range placement and the fee is a red herring.
//
// k = virtual / TVL is the standard measure of how much depth a dollar of capital quotes. Every v4
// Swap event carries `liquidity` and `sqrtPriceX96`, so k needs no archive call and no full scan:
// a short recent window of swaps is enough. OVERVIEW.md open question 8 says exactly this and
// nobody has run it, because the assumption was that ETH's venues are unscannable. They are
// unscannable in FULL. They are trivially scannable over two hours.
//
// Median across the window, not a point reading: BASELINE correction 4 was a k quoted on two
// different bases and it inverted a ranking.
import { c, SWAP, retry, span } from './lib.mjs'
import fs from 'node:fs'

const POOLS = [
  ['OURS  v4 ETH/USDG dyn', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551', 1042590, 773],
  ['v4 ETH/USDG 577', '0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32', 2605672, 577],
  ['v4 ETH/USDG 625', '0x387bf619da4d3fb62bb276482693dba1b9b3520f573cabdfe033384a24125982', 157289, 625],
  ['v4 WETH/USDG 252', '0x84bd4e2d8be11aeb0afc1195b38f587b61e90068548f1063fdbe448fb8cad0b6', 369659, 252],
  ['v4 WETH/USDG 625', '0xfcfae8fa0bd6da961bcf5d990f27690932deac4f093e99bf3e871691c6586593', 105234, 625],
  ['v4 WETH/USDG 565', '0x6ba18d461bfe3df70a80b50a4700e330e49efdaf597901b931f210554a5035d2', 122274, 565],
]
const HOURS = Number(process.argv[2] ?? 6)
const Q96 = 2 ** 96

const head = await retry(() => c.getBlockNumber())
const bA = await retry(() => c.getBlock({ blockNumber: head }))
const bB = await retry(() => c.getBlock({ blockNumber: head - 500000n }))
const SEC = (Number(bA.timestamp) - Number(bB.timestamp)) / 500000
const from = head - BigInt(Math.round((HOURS * 3600) / SEC))
console.log(`k = virtual / TVL, ${HOURS}h window to block ${head} (${new Date(Number(bA.timestamp) * 1000).toISOString()})`)
console.log(`token0 is ETH/WETH at 18 decimals, token1 is USDG at 6. virtual = 2 * L * sqrt(P), in USDG.\n`)

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }

const out = []
console.log(`${'venue'.padEnd(22)} ${'swaps'.padStart(6)} ${'median virtual $'.padStart(17)} ${'TVL $'.padStart(12)} ${'k'.padStart(8)} ${'vs ours'.padStart(8)} ${'ETH px'.padStart(9)}`)
for (const [name, id, tvl, pips] of POOLS) {
  let logs = []
  try { logs = await span(SWAP, id, from, head) } catch (e) { console.log(`${name.padEnd(22)} scan failed: ${String(e).slice(0, 50)}`); continue }
  if (!logs.length) { console.log(`${name.padEnd(22)} ${String(0).padStart(6)}   no swaps in window`); continue }
  const virts = []
  const pxs = []
  for (const l of logs) {
    const L = Number(l.args.liquidity)
    const sp = Number(l.args.sqrtPriceX96) / Q96
    if (!(L > 0) || !(sp > 0)) continue
    // y_virtual (raw USDG) = L * sqrtP; the pool value at the current tick is twice that leg
    virts.push((2 * L * sp) / 1e6)
    pxs.push(sp * sp * 1e12)
  }
  if (!virts.length) { console.log(`${name.padEnd(22)} ${String(logs.length).padStart(6)}   no usable liquidity readings`); continue }
  const v = med(virts)
  const rec = { name, id, tvl, pips, swaps: logs.length, virtual: v, k: v / tvl, px: med(pxs) }
  out.push(rec)
  console.log(`${name.padEnd(22)} ${String(logs.length).padStart(6)} ${('$' + Math.round(v).toLocaleString()).padStart(17)} ${('$' + Math.round(tvl).toLocaleString()).padStart(12)} ${rec.k.toFixed(1).padStart(8)} ${''.padStart(8)} ${Math.round(rec.px).toLocaleString().padStart(9)}`)
}

const us = out.find((r) => r.name.startsWith('OURS'))
if (us) {
  console.log(`\nRANKED BY k, which is depth quoted per dollar of capital.`)
  console.log(`${'venue'.padEnd(22)} ${'fee'.padStart(6)} ${'k'.padStart(8)} ${'k vs ours'.padStart(10)}`)
  for (const r of [...out].sort((a, b) => b.k - a.k)) {
    console.log(`${r.name.padEnd(22)} ${String(r.pips).padStart(6)} ${r.k.toFixed(1).padStart(8)} ${(r.k / us.k).toFixed(2).padStart(9)}x`)
  }
  console.log(`\nOurs: k = ${us.k.toFixed(1)} on $${Math.round(us.tvl).toLocaleString()} of capital, quoting $${Math.round(us.virtual).toLocaleString()} of virtual depth.`)
  console.log('If a peer with more turnover also has more k, the turnover gap is RANGE PLACEMENT and')
  console.log('costs no new capital to close. If its k is the same or lower, the gap is ROUTING and no')
  console.log('range change will fix it.')
}

fs.writeFileSync('data/eth-depth-field.json', JSON.stringify({ hours: HOURS, head: Number(head), out }, null, 1))
console.log('\nwrote data/eth-depth-field.json')
