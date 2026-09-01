// Is GLD still dislocated? Its fee is pinned at the 15,000 cap, and the ramp only reaches the cap at
// d >= full = 10%, so this is the number that decides whether the pinning is correct or stale.
import { c, retry } from './lib.mjs'
const PM = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
const ID = '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'
// v4 pool state lives in PoolManager storage; slot0 via extsload at keccak(poolId, POOLS_SLOT=6)
import { keccak256, encodeAbiParameters } from 'viem'
const slot = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [ID, 6n]))
const raw = await retry(() => c.readContract({
  address: PM,
  abi: [{ name: 'extsload', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bytes32' }] }],
  functionName: 'extsload', args: [slot],
}))
const sqrtP = BigInt(raw) & ((1n << 160n) - 1n)
// GLD/USDG: currency0 = USDG (6dp), currency1 = GLD (18dp) per the pair label USDG/GLD
const p = (Number(sqrtP) / 2 ** 96) ** 2
const poolPrice = 1 / (p * 10 ** (6 - 18))   // USDG per GLD
console.log(`pool GLD price  ${poolPrice.toFixed(2)} USDG`)
const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT')
const paxg = Number((await r.json()).price)
const BASIS = 0.091804   // measured ounce -> ETF-share basis, SYSTEM-SPEC 7.1
const fair = paxg * BASIS
console.log(`PAXG ${paxg.toFixed(2)}  x basis ${BASIS}  = fair ${fair.toFixed(2)} USDG`)
const d = poolPrice / fair - 1
console.log(`deviation d = ${(100 * d).toFixed(2)}%   kicker 2.00%, full 10.00%`)
console.log(d >= 0.10 ? 'AT OR PAST FULL: the 15,000 cap is correct' : d >= 0.02 ? 'on the ramp' : 'BELOW THE KICKER: the cap is stale')
