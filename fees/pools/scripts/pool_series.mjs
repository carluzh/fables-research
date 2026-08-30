// Generalised version of spy_series.mjs: hour-by-hour volume, fee, depth and flow share for every
// venue trading one asset, read from raw Swap events. Config comes from a JSON file so the same
// scanner serves SPY, NVDA, GLD, META and ETH.
//
// node pool_series.mjs <config.json> <hours> <out.json>
import fs from 'node:fs'
import { createPublicClient, http, parseAbiItem } from 'viem'

const PM = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
const c = createPublicClient({ transport: http('https://rpc.mainnet.chain.robinhood.com') })
const V4_SWAP = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
)
const V4_ML = parseAbiItem(
  'event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)',
)
const V3_SWAP = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
)
const V3_MINT = parseAbiItem('event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)')
const V3_BURN = parseAbiItem('event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let q = Promise.resolve()
const gate = (fn) => {
  const p = q.then(async () => {
    await sleep(110)
    return fn()
  })
  q = p.catch(() => {})
  return p
}
async function retry(fn, n = 6) {
  for (let i = 0; i < n; i++) {
    try {
      return await gate(fn)
    } catch (e) {
      const s = String(e)
      if (!/429|Rate Limit|Too Many|timed out|timeout|fetch failed|limit exceeded/i.test(s)) throw e
      await sleep(4000 + i * 2500)
    }
  }
  throw new Error('rpc gave up')
}

const CFG = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const HOURS = Number(process.argv[3] ?? 24)
const OUT = process.argv[4] ?? 'data/pool_series.json'

const head = await retry(() => c.getBlockNumber())
const bA = await retry(() => c.getBlock({ blockNumber: head }))
const bB = await retry(() => c.getBlock({ blockNumber: head - 500000n }))
const SEC = (Number(bA.timestamp) - Number(bB.timestamp)) / 500000
const span = BigInt(Math.round((HOURS * 3600) / SEC))
const from = head - span
const anchorBlock = Number(head)
const anchorTs = Number(bA.timestamp)
const tsOf = (bn) => anchorTs + (Number(bn) - anchorBlock) * SEC
console.error(`${CFG.asset}: head ${head} @ ${new Date(anchorTs * 1000).toISOString()}  block ${SEC.toFixed(4)}s  window ${HOURS}h = ${span} blocks  ${CFG.pools.length} venues`)

const STEP = 100000n
async function bisect(params, b, e, depth = 0) {
  try {
    return await retry(() => c.getLogs({ ...params, fromBlock: b, toBlock: e }), 5)
  } catch (err) {
    if (depth > 9 || e - b < 2n) throw err
    const m = b + (e - b) / 2n
    const x = await bisect(params, b, m, depth + 1)
    const y = await bisect(params, m + 1n, e, depth + 1)
    return [...x, ...y]
  }
}
async function scan(params, label) {
  const out = []
  for (let b = from; b <= head; b += STEP) {
    const e = b + STEP - 1n > head ? head : b + STEP - 1n
    out.push(...(await bisect(params, b, e)))
    process.stderr.write(`\r  ${label} ${Number(((b - from) * 100n) / span)}%  ${out.length} logs      `)
  }
  process.stderr.write('\n')
  return out
}

const ASSET_DEC = CFG.assetDecimals ?? 18
const byPool = {}
const drift = {}

for (const p of CFG.pools) {
  const isV4 = p.proto === 'v4'
  const swaps = await scan(isV4 ? { address: PM, event: V4_SWAP, args: { id: p.id } } : { address: p.id, event: V3_SWAP }, `swap ${p.key}`)
  const rows = []
  // Which leg to value the swap in. Defaults to the asset leg, but a pool whose asset mark is
  // disputed (GLD is 1,327 on chain against a 409 ETF) must be valued in its quote leg, because
  // the USDG a trader actually paid is the only notional that is not an opinion.
  const volIdx = p.volIdx ?? p.assetIdx
  const volDec = p.volDecimals ?? ASSET_DEC
  const volUsd = p.volUsd ?? CFG.assetUsd
  for (const l of swaps) {
    const a0 = Number(l.args.amount0)
    const a1 = Number(l.args.amount1)
    const volRaw = volIdx === 0 ? a0 : a1
    const notional = (Math.abs(volRaw) / 10 ** volDec) * volUsd
    const feePips = isV4 ? Number(l.args.fee) : p.fee
    const sp = Number(l.args.sqrtPriceX96) / 2 ** 96
    const L = Number(l.args.liquidity)
    // virtual = 2 * (quote-leg virtual reserve) valued in USD
    const quoteIsToken1 = p.quoteIdx === 1
    const reserveRaw = quoteIsToken1 ? L * sp : L / sp
    const virtual = ((2 * reserveRaw) / 10 ** p.quoteDecimals) * (p.quoteUsd ?? 1)
    rows.push({ t: tsOf(l.blockNumber), notional, feePips, fee: (notional * feePips) / 1e6, L, sp, virtual })
  }
  byPool[p.key] = rows
  const liq = isV4
    ? await scan({ address: PM, event: V4_ML, args: { id: p.id } }, `mliq ${p.key}`)
    : [...(await scan({ address: p.id, event: V3_MINT }, `mint ${p.key}`)), ...(await scan({ address: p.id, event: V3_BURN }, `burn ${p.key}`))]
  drift[p.key] = { events: liq.length }
  console.error(`  ${p.key}: ${swaps.length} swaps, ${liq.length} liquidity events`)
}

const hourOf = (t) => Math.floor(t / 3600) * 3600
const hours = [...new Set(Object.values(byPool).flat().map((s) => hourOf(s.t)))].sort((a, b) => a - b)
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)

const series = {}
for (const p of CFG.pools) {
  const sw = byPool[p.key] || []
  const rows = hours.map((h) => {
    const inH = sw.filter((s) => hourOf(s.t) === h)
    const vol = inH.reduce((a, s) => a + s.notional, 0)
    const fee = inH.reduce((a, s) => a + s.fee, 0)
    return {
      h,
      swaps: inH.length,
      vol,
      fee,
      pips: vol > 0 ? (1e6 * fee) / vol : null,
      virtual: med(inH.map((s) => s.virtual)),
      L: med(inH.map((s) => s.L)),
    }
  })
  series[p.key] = { meta: { ...p, drift: drift[p.key] || { events: 0 } }, rows }
}
for (const h of hours) {
  const tot = CFG.pools.reduce((a, p) => a + (series[p.key].rows.find((r) => r.h === h) || { vol: 0 }).vol, 0)
  for (const p of CFG.pools) {
    const r = series[p.key].rows.find((x) => x.h === h)
    if (r) r.share = tot > 0 ? r.vol / tot : null
  }
}

fs.writeFileSync(OUT, JSON.stringify({ asset: CFG.asset, fetchedAt: new Date().toISOString(), headBlock: Number(head), headTs: anchorTs, blockSec: SEC, hours: HOURS, assetUsd: CFG.assetUsd, series }, null, 1))
console.error(`\nwrote ${OUT}`)
for (const p of CFG.pools) {
  const rs = series[p.key].rows
  const v = rs.reduce((a, r) => a + r.vol, 0)
  const f = rs.reduce((a, r) => a + r.fee, 0)
  console.error(`  ${p.key.padEnd(22)} vol=${Math.round(v).toLocaleString().padStart(14)}  fees=${f.toFixed(2).padStart(11)}  pips=${(v ? (1e6 * f) / v : 0).toFixed(0).padStart(7)}  mliq=${drift[p.key].events}`)
}
