// HOW MUCH DOES IT COST TO PUSH THE ORACLE?
//
// The whole design hinges on the Binance reference being harder to move than our own pool. Volume is
// not that test: a venue can turn over plenty and still have a thin book. This walks the live order
// book and reports the dollar cost of moving each reference 0.5%, 1% and 2%, which is the range that
// matters because our kickers sit at 0.75% to 2.50%.
//
// The attack it prices: push the REFERENCE rather than the pool. Push it away and we raise our fee on
// honest flow; push it toward a dislocated pool and we fail to raise at all. Either costs an attacker
// the numbers below and is compared against what it costs to move our own pool the same distance.
import fs from 'node:fs'

const SYMS = [
  ['SPY', 'SPYBUSDT'], ['NVDA', 'NVDABUSDT'], ['META', 'METABUSDT'], ['AAPL', 'AAPLBUSDT'],
  ['TSLA', 'TSLABUSDT'], ['QQQ', 'QQQBUSDT'], ['MSFT', 'MSFTBUSDT'], ['AMZN', 'AMZNBUSDT'],
  ['GOOGL', 'GOOGLBUSDT'], ['COIN', 'COINBUSDT'], ['MSTR', 'MSTRBUSDT'], ['NFLX', 'NFLXBUSDT'],
  ['GLD (PAXG)', 'PAXGUSDT'], ['GLD (XAUT)', 'XAUTUSDT'], ['ETH', 'ETHUSDT'],
]
const MOVES = [0.005, 0.01, 0.02]

// Cost to walk the book far enough to move the mid by `move`, on the cheaper side.
function costToMove(levels, mid, move, side) {
  const target = side === 'ask' ? mid * (1 + move) : mid * (1 - move)
  let usd = 0
  for (const [pStr, qStr] of levels) {
    const p = Number(pStr), q = Number(qStr)
    if (side === 'ask' ? p > target : p < target) return usd
    usd += p * q
  }
  return null // book not deep enough to reach the target at all
}

const out = []
console.log('COST TO PUSH THE REFERENCE, live order book, USD to move the mid')
console.log('asset          mid       spread     0.50%        1.00%        2.00%     book depth $')
for (const [label, sym] of SYMS) {
  const r = await fetch(`https://api.binance.com/api/v3/depth?symbol=${sym}&limit=5000`)
  const d = await r.json()
  if (!d.bids || !d.bids.length) { console.log(`${label.padEnd(13)} no book`); continue }
  const bid = Number(d.bids[0][0]), ask = Number(d.asks[0][0])
  const mid = (bid + ask) / 2
  const spread = (ask - bid) / mid
  const total = [...d.bids, ...d.asks].reduce((a, [p, q]) => a + Number(p) * Number(q), 0)
  const row = { asset: label, symbol: sym, mid, spreadPct: spread, bookUsd: total, cost: {} }
  const cells = MOVES.map((m) => {
    const up = costToMove(d.asks, mid, m, 'ask')
    const dn = costToMove(d.bids, mid, m, 'bid')
    const c = up === null || dn === null ? null : Math.min(up, dn)
    row.cost[m] = c
    return c === null ? '  >book'.padStart(11) : ('$' + Math.round(c).toLocaleString()).padStart(11)
  })
  out.push(row)
  console.log(
    `${label.padEnd(13)} ${mid.toFixed(2).padStart(9)} ${(100 * spread).toFixed(3).padStart(7)}% ${cells.join(' ')}  ${('$' + Math.round(total).toLocaleString()).padStart(13)}`,
  )
  await new Promise((s) => setTimeout(s, 300))
}

fs.writeFileSync(new URL('../data/reference-depth.json', import.meta.url), JSON.stringify(out, null, 1))

// Quote-leg input needed to move a constant-product price by m is (virtual/2)*(sqrt(1+m)-1),
// NOT (virtual/2)*m, which overstates it by 2.01x at m = 2%. An earlier version had the wrong one.
//
// TWO CEILINGS THIS STILL IGNORES, both of which matter and neither of which is modelled here:
//  1. A pool cannot absorb more than the inventory it holds. SPY/USDG holds about $449k in total,
//     so no push can cost more than that whatever `virtual` implies.
//  2. `virtual` is 2*L*sqrt(P) at the CURRENT tick. On a concentrated pool with k around 100, a 2%
//     move is at or past the edge of the range and the formula has nothing left to integrate.
// Treat the pool column as an upper bound that is only meaningful well inside the range.
console.log('\nCompare against what it costs to move OUR pool the same distance:')
console.log('  cost = (virtual/2) * (sqrt(1+m) - 1), capped by the pool actual inventory')
for (const [name, virt, inventoryUsd] of [['GLD', 168196, 41545], ['SPY', 61975350, 449283], ['META', 868705, 26139]]) {
  const line = MOVES.map((m) => {
    const c = Math.min((virt / 2) * (Math.sqrt(1 + m) - 1), inventoryUsd)
    return ('$' + Math.round(c).toLocaleString()).padStart(11)
  }).join(' ')
  console.log(`  move OUR ${name.padEnd(5)} pool: ${line}   (inventory ceiling $${inventoryUsd.toLocaleString()})`)
}
console.log('\nIF PUSHING THE REFERENCE IS CHEAPER THAN PUSHING THE POOL, the oracle is the soft target')
console.log('and that pool must not go live on a single reference.')
console.log('\nwrote data/reference-depth.json')
