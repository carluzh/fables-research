// IS THERE A SECOND SOURCE FOR THE EQUITY REFERENCES?
//
// SYSTEM-SPEC section 4.3 requires a disagreement guard: two independent references, hold if they
// diverge past 1%. Gold has PAXG and XAUT. For the equities that guard was specified before anyone
// checked a second venue existed. This checks.
//
// OKX lists all twelve with an X prefix (XSPY-USDT etc). Bybit lists seven with an X suffix
// (NVDAXUSDT etc), missing SPY, QQQ, MSFT, MSTR and NFLX. Kraken and Gate list none.
// Binance is primary because it is 3x to 5x deeper; OKX is the guard.
const PAIRS = [['SPY','SPYBUSDT','XSPY-USDT'],['NVDA','NVDABUSDT','XNVDA-USDT'],['META','METABUSDT','XMETA-USDT'],['AAPL','AAPLBUSDT','XAAPL-USDT'],['TSLA','TSLABUSDT','XTSLA-USDT'],['QQQ','QQQBUSDT','XQQQ-USDT'],['MSFT','MSFTBUSDT','XMSFT-USDT'],['AMZN','AMZNBUSDT','XAMZN-USDT'],['GOOGL','GOOGLBUSDT','XGOOGL-USDT'],['COIN','COINBUSDT','XCOIN-USDT'],['MSTR','MSTRBUSDT','XMSTR-USDT'],['NFLX','NFLXBUSDT','XNFLX-USDT']]
const j = async (u) => { try { return await (await fetch(u)).json() } catch { return null } }
console.log('asset   Binance      OKX        diff      OKX 2% push cost   OKX book $')
for (const [n, b, o] of PAIRS) {
  const bt = await j(`https://api.binance.com/api/v3/ticker/price?symbol=${b}`)
  const ot = await j(`https://www.okx.com/api/v5/market/ticker?instId=${o}`)
  const od = await j(`https://www.okx.com/api/v5/market/books?instId=${o}&sz=400`)
  const bp = Number(bt?.price), op = Number(ot?.data?.[0]?.last)
  if (!bp || !op) { console.log(`${n.padEnd(7)} unavailable`); continue }
  let cost = null, book = 0
  const bk = od?.data?.[0]
  if (bk) {
    const asks = bk.asks.map(a => [Number(a[0]), Number(a[1])])
    const bids = bk.bids.map(a => [Number(a[0]), Number(a[1])])
    const mid = (asks[0][0] + bids[0][0]) / 2
    book = [...asks, ...bids].reduce((a, [p, q]) => a + p * q, 0)
    const walk = (lv, t, up) => { let u = 0; for (const [p, q] of lv) { if (up ? p > t : p < t) return u; u += p * q } return null }
    const up = walk(asks, mid * 1.02, true), dn = walk(bids, mid * 0.98, false)
    cost = up === null || dn === null ? null : Math.min(up, dn)
  }
  console.log(`${n.padEnd(7)} ${bp.toFixed(2).padStart(9)} ${op.toFixed(2).padStart(10)} ${(100*(op/bp-1)).toFixed(3).padStart(8)}%   ${(cost===null?'>book':'$'+Math.round(cost).toLocaleString()).padStart(14)}   ${('$'+Math.round(book).toLocaleString()).padStart(11)}`)
  await new Promise(s => setTimeout(s, 250))
}
