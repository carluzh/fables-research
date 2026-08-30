// Pull the 730d / 1h Yahoo bars that allvar.py expects beside it as y_<SYM>_1h.json.
import fs from 'node:fs'
const SYMS = [
  ['SPY', 'SPY'],
  ['NVDA', 'NVDA'],
  ['GLD', 'GLD'],
  ['TSLA', 'TSLA'],
  ['AAPL', 'AAPL'],
  ['META', 'META'],
  ['ES_F', 'ES=F'],
  ['GC_F', 'GC=F'],
  // the rest of the Binance-covered tickers, scored by reference-census.mjs
  ['QQQ', 'QQQ'],
  ['MSFT', 'MSFT'],
  ['AMZN', 'AMZN'],
  ['GOOGL', 'GOOGL'],
  ['COIN', 'COIN'],
  ['MSTR', 'MSTR'],
  ['NFLX', 'NFLX'],
]
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
for (const [name, ticker] of SYMS) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1h&range=730d&includePrePost=true`
  let ok = false
  for (let i = 0; i < 5 && !ok; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } })
      const txt = await res.text()
      const j = JSON.parse(txt)
      const r = j?.chart?.result?.[0]
      if (!r) throw new Error('no result: ' + txt.slice(0, 200))
      const n = r.timestamp?.length ?? 0
      const closes = r.indicators?.quote?.[0]?.close ?? []
      const good = closes.filter((c) => c != null).length
      const t0 = new Date(r.timestamp[0] * 1000).toISOString().slice(0, 10)
      const t1 = new Date(r.timestamp[n - 1] * 1000).toISOString().slice(0, 10)
      fs.writeFileSync(new URL(`../bars/y_${name}_1h.json`, import.meta.url), txt)
      console.log(`${name.padEnd(6)} ${ticker.padEnd(6)} bars=${n} closes=${good} ${t0} .. ${t1}`)
      ok = true
    } catch (e) {
      console.log(`${name} attempt ${i + 1} failed: ${String(e).slice(0, 160)}`)
      await new Promise((s) => setTimeout(s, 3000 + i * 2000))
    }
  }
  if (!ok) console.log(`${name} GAVE UP`)
  await new Promise((s) => setTimeout(s, 800))
}
