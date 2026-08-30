// Verbatim port of fables-research/fees/scripts/lib.mjs
import { createPublicClient, http, parseAbiItem } from 'viem'
export const PM = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
export const c = createPublicClient({ transport: http('https://rpc.mainnet.chain.robinhood.com') })
export const ML = parseAbiItem(
  'event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)',
)
export const SWAP = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let chain = Promise.resolve()
function gate(fn) {
  const p = chain.then(async () => {
    await sleep(120)
    return fn()
  })
  chain = p.catch(() => {})
  return p
}
export async function retry(fn, n = 8) {
  for (let i = 0; i < n; i++) {
    try {
      return await gate(fn)
    } catch (e) {
      const s = String(e)
      if (!/429|Rate Limit|Too Many Requests|timed out/i.test(s)) throw e
      await sleep(6000 + i * 3000)
    }
  }
  throw new Error('rpc gave up')
}
export async function span(ev, id, b, e, depth = 0) {
  try {
    return await retry(() => c.getLogs({ address: PM, event: ev, args: { id }, fromBlock: b, toBlock: e }))
  } catch (err) {
    if (depth > 5) throw err
    const m = (b + e) / 2n
    const x = await span(ev, id, b, m, depth + 1)
    const y = await span(ev, id, m + 1n, e, depth + 1)
    return [...x, ...y]
  }
}
export async function scan(ev, id, fromBlock, toBlock, step = 100000n) {
  const out = []
  for (let b = fromBlock; b <= toBlock; b += step) {
    const e = b + step - 1n > toBlock ? toBlock : b + step - 1n
    out.push(...(await span(ev, id, b, e)))
  }
  out.sort((p, q) => Number(p.blockNumber - q.blockNumber))
  return out
}
