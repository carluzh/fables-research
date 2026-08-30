// WHICH POOLS CAN PRICE THE TWO DIRECTIONS DIFFERENTLY?
//
// THE TEST THAT MATTERS IS THE SELECTOR PROBE, NOT THE FEE COMPARISON.
//
// An earlier version of this script compared currentFee(id, true) against currentFee(id, false) and
// concluded from equality that no pool had asymmetric fees. That was wrong. Symmetric is the DEFAULT
// state of an asymmetry-capable hook: premiumPips is 0 until someone sets it, and the two-sided poke
// is empty until someone uses it. Both hook generations read identically in that state.
//
// What actually distinguishes them is whether the deployed runtime bytecode carries the selectors
// introduced by the asymmetric-fee revision (fables#28): the four-argument pokeFee, setPoolAsymmetry,
// poolAsymmetry and autonomousFee. Hook code is immutable, so this is a permanent property of each
// pool.
import { c, retry } from './lib.mjs'
import { keccak256, toHex } from 'viem'
import fs from 'node:fs'

const sig = (s) => keccak256(toHex(s)).slice(0, 10)

const POOLS = [
  ['GLD', '0xB608a78761f179f7C56f15E7D13921B92F00a080', '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'],
  ['META', '0x8AF95932eC4484fb10C641a4cBcf19a798cB2080', '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5'],
  ['SPY/GLD', '0xA4570C37590E45f0b06898123D4de16307A32080', '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f'],
  ['SPY', '0xA0E8fBFf13E24Af2b5e61A72800E08a161bDe080', '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd'],
  ['NVDA', '0x66622f77B797D506e5376F7798b67ab288966080', '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd'],
  ['TSLA', '0x67D86050d22D574Df046F3D90F722045F714e080', '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e'],
  ['AAPL', '0x70a9A88402989226847Ec122043CE5e7FF462080', '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147'],
  ['NVDA/SPY', '0x79576FBAD6e83915630BBB5D5658483F05532080', '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f'],
  ['ETH', '0x06a889870C8f83640D6816319f72e2aA579b6080', '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551'],
]

const ASYM = [
  ['pokeFee 4-arg', 'pokeFee(bytes32,uint24,uint24,uint40)'],
  ['setPoolAsymmetry', 'setPoolAsymmetry((address,address,uint24,int24,address),uint24,bool)'],
  ['poolAsymmetry', 'poolAsymmetry(bytes32)'],
  ['autonomousFee', 'autonomousFee(bytes32,bool)'],
]
const LEGACY = ['pokeFee 3-arg', 'pokeFee(bytes32,uint24,uint40)']

const head = await retry(() => c.getBlockNumber())
const blk = await retry(() => c.getBlock({ blockNumber: head }))
console.log(`block ${head}  ${new Date(Number(blk.timestamp) * 1000).toISOString()}\n`)
console.log('pool       4-arg  setAsym  poolAsym  autoFee  | 3-arg |  VERDICT')

const out = {}
for (const [name, hook, id] of POOLS) {
  const code = await retry(() => c.getCode({ address: hook }))
  const has = (fn) => code.includes(sig(fn).slice(2))
  const asym = ASYM.every(([, fn]) => has(fn))
  const legacy = has(LEGACY[1])
  out[name] = { hook, poolId: id, asymmetric: asym, legacyPoke: legacy, selectors: Object.fromEntries(ASYM.map(([l, fn]) => [l, has(fn)])) }
  console.log(
    `${name.padEnd(10)} ${ASYM.map(([, fn]) => (has(fn) ? 'yes' : ' . ').padStart(6)).join('  ')}  | ${(legacy ? 'yes' : ' . ').padStart(5)} |  ${asym ? 'ASYMMETRIC CAPABLE' : 'symmetric only, permanently'}`,
  )
}

// For the capable ones, what is actually configured right now.
console.log('\nLive asymmetry state on the capable pools (premium 0 = symmetric today, by default):')
for (const [name, hook, id] of POOLS) {
  if (!out[name].asymmetric) continue
  try {
    const raw = (await retry(() => c.call({ to: hook, data: sig('poolAsymmetry(bytes32)') + id.slice(2) }))).data.slice(2)
    const premium = Number(BigInt('0x' + raw.slice(0, 64)))
    const zeroForOne = BigInt('0x' + raw.slice(64, 128)) !== 0n
    const af = async (z) => Number(BigInt((await retry(() => c.call({ to: hook, data: sig('autonomousFee(bytes32,bool)') + id.slice(2) + (z ? '1' : '0').padStart(64, '0') }))).data))
    const p = (await retry(() => c.call({ to: hook, data: sig('pokeOf(bytes32)') + id.slice(2) }))).data.slice(2)
    const poke = { fee0For1: Number(BigInt('0x' + p.slice(0, 64))), fee1For0: Number(BigInt('0x' + p.slice(64, 128))), expiry: Number(BigInt('0x' + p.slice(128, 192))) }
    out[name].live = { premiumPips: premium, premiumZeroForOne: zeroForOne, autonomous0For1: await af(true), autonomous1For0: await af(false), poke }
    console.log(
      `  ${name.padEnd(9)} premium=${premium} on ${premium === 0 ? '(none)' : zeroForOne ? '0->1' : '1->0'}  ` +
      `autonomousFee 0->1=${out[name].live.autonomous0For1} 1->0=${out[name].live.autonomous1For0}  ` +
      `poke=[${poke.fee0For1},${poke.fee1For0}] exp=${poke.expiry || 'none'}`,
    )
  } catch (e) {
    console.log(`  ${name.padEnd(9)} read failed: ${String(e).slice(0, 80)}`)
  }
}

fs.writeFileSync(new URL('../data/asymmetry.json', import.meta.url), JSON.stringify(out, null, 1))
console.log('\nHook code is immutable and the PoolKey binds the hook address, so a "symmetric only" pool')
console.log('can never gain asymmetry: it would be a different poolId, i.e. a different pool.')
console.log('\nwrote data/asymmetry.json')
