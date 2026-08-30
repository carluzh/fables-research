// Live bounds on every Fables RWA hook: the bytecode constants, the per-pool cap and poke floor,
// and the fee each pool is charging right now. This is the table in DEVIATION-FEE.md section 3.
import { c, retry } from './lib.mjs'
import { keccak256, toHex } from 'viem'
import fs from 'node:fs'

const sig = (s) => keccak256(toHex(s)).slice(0, 10)

const POOLS = [
  ['GLD', '0xB608a78761f179f7C56f15E7D13921B92F00a080', '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'],
  ['SPY', '0xA0E8fBFf13E24Af2b5e61A72800E08a161bDe080', '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd'],
  ['NVDA', '0x66622f77B797D506e5376F7798b67ab288966080', '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd'],
  ['META', '0x8AF95932eC4484fb10C641a4cBcf19a798cB2080', '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5'],
  ['TSLA', '0x67D86050d22D574Df046F3D90F722045F714e080', '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e'],
  ['AAPL', '0x70a9A88402989226847Ec122043CE5e7FF462080', '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147'],
  ['ETH', '0x06a889870C8f83640D6816319f72e2aA579b6080', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551'],
]

const CONSTS = [
  ['ABSOLUTE_MAX_FEE', 'ABSOLUTE_MAX_FEE()'],
  ['MAX_POKE_TTL', 'MAX_POKE_TTL()'],
  ['MIN_POOL_FEE', 'MIN_POOL_FEE()'],
  ['MAX_POKE_DISCOUNT_BPS', 'MAX_POKE_DISCOUNT_BPS()'],
]

const out = {}
console.log('pool  ABS_MAX  POKE_TTL  MIN_FEE  MAX_DISC   maxFee  pokeFloor  pokeFee  pokeExpiry  currentFee')
for (const [name, hook, id] of POOLS) {
  const o = { hook, poolId: id }
  for (const [k, fn] of CONSTS) {
    try {
      o[k] = Number(BigInt((await retry(() => c.call({ to: hook, data: sig(fn) }))).data))
    } catch (e) {
      o[k] = null
    }
  }
  for (const [k, fn] of [['maxFee', 'maxFee(bytes32)'], ['pokeFloor', 'pokeFloor(bytes32)']]) {
    try {
      o[k] = Number(BigInt((await retry(() => c.call({ to: hook, data: sig(fn) + id.slice(2) }))).data))
    } catch (e) {
      o[k] = null
    }
  }
  try {
    const p = (await retry(() => c.call({ to: hook, data: sig('pokeOf(bytes32)') + id.slice(2) }))).data.slice(2)
    o.pokeFee = Number(BigInt('0x' + p.slice(0, 64)))
    o.pokeExpiry = Number(BigInt('0x' + p.slice(64, 128)))
  } catch (e) {
    o.pokeFee = o.pokeExpiry = null
  }
  try {
    o.currentFee = Number(
      BigInt((await retry(() => c.call({ to: hook, data: sig('currentFee(bytes32,bool)') + id.slice(2) + ''.padStart(64, '0') }))).data),
    )
  } catch (e) {
    o.currentFee = null
  }
  out[name] = o
  const p = (v, w) => String(v === null ? '-' : v).padStart(w)
  console.log(
    name.padEnd(5),
    p(o.ABSOLUTE_MAX_FEE, 8),
    p(o.MAX_POKE_TTL, 9),
    p(o.MIN_POOL_FEE, 8),
    p(o.MAX_POKE_DISCOUNT_BPS, 9),
    p(o.maxFee, 8),
    p(o.pokeFloor, 10),
    p(o.pokeFee, 8),
    p(o.pokeExpiry, 11),
    p(o.currentFee, 11),
  )
}

// The v4 PoolManager's protocol-fee controller, which decides whether a directional treasury cut is
// even available to us. See DEVIATION-FEE.md section 9.
const PM = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
console.log('\nPoolManager', PM)
for (const fn of ['protocolFeeController()', 'owner()']) {
  try {
    const r = await retry(() => c.call({ to: PM, data: sig(fn) }))
    console.log('  ' + fn.padEnd(26), '0x' + r.data.slice(26))
  } catch (e) {
    console.log('  ' + fn, 'REVERT')
  }
}
fs.writeFileSync(new URL('../data/hooks.json', import.meta.url), JSON.stringify(out, null, 1))
console.log('\nwrote data/hooks.json')
