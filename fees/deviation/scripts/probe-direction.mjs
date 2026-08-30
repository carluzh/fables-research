// Is any pool's fee direction-dependent? SYSTEM-SPEC.md section 5 says no, and this is the check.
//
// Run it again in an OPEN session and with a poke active before treating "symmetric" as proven
// across all market states: the run behind the spec was a Sunday, closed tier, no poke on any RWA
// pool. A two-minute check.
import { c, retry } from './lib.mjs'
import { keccak256, toHex } from 'viem'

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

// v4 encodes hook permissions in the ADDRESS. A hook that could ever take a fee as a delta would
// have to carry these bits, and none of ours do.
const FLAGS = {
  BEFORE_INITIALIZE: 1n << 13n,
  AFTER_INITIALIZE: 1n << 12n,
  BEFORE_ADD_LIQUIDITY: 1n << 11n,
  AFTER_ADD_LIQUIDITY: 1n << 10n,
  BEFORE_REMOVE_LIQUIDITY: 1n << 9n,
  AFTER_REMOVE_LIQUIDITY: 1n << 8n,
  BEFORE_SWAP: 1n << 7n,
  AFTER_SWAP: 1n << 6n,
  BEFORE_DONATE: 1n << 5n,
  AFTER_DONATE: 1n << 4n,
  BEFORE_SWAP_RETURNS_DELTA: 1n << 3n,
  AFTER_SWAP_RETURNS_DELTA: 1n << 2n,
  AFTER_ADD_LIQUIDITY_RETURNS_DELTA: 1n << 1n,
  AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA: 1n << 0n,
}

const head = await retry(() => c.getBlockNumber())
const blk = await retry(() => c.getBlock({ blockNumber: head }))
const now = new Date(Number(blk.timestamp) * 1000)
const et = now.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit' })
console.log(`block ${head}  ${now.toISOString()}  (${et} ET)`)
console.log('RECORD THE MARKET STATE ABOVE: a symmetric result only proves symmetry in the state it was read.\n')

console.log('pool   0->1 fee   1->0 fee   verdict        poke active   permission bits')
let anyDirectional = false
for (const [name, hook, id] of POOLS) {
  const fee = async (z) =>
    Number(BigInt((await retry(() => c.call({ to: hook, data: sig('currentFee(bytes32,bool)') + id.slice(2) + (z ? '1' : '0').padStart(64, '0') }))).data))
  const a = await fee(true)
  const b = await fee(false)
  let poke = 'unknown'
  try {
    const p = (await retry(() => c.call({ to: hook, data: sig('pokeOf(bytes32)') + id.slice(2) }))).data.slice(2)
    const exp = Number(BigInt('0x' + p.slice(64, 128)))
    poke = exp > Number(blk.timestamp) ? `yes, ${Math.round((exp - Number(blk.timestamp)) / 60)}m left` : 'no'
  } catch (e) { /* leave unknown */ }
  const bits = BigInt(hook) & 0x3fffn
  const on = Object.entries(FLAGS).filter(([, m]) => (bits & m) !== 0n).map(([n]) => n).join('+')
  if (a !== b) anyDirectional = true
  console.log(
    `${name.padEnd(6)} ${String(a).padStart(8)}   ${String(b).padStart(8)}   ${(a === b ? 'symmetric' : '** DIRECTIONAL **').padEnd(14)} ${poke.padEnd(13)} 0x${bits.toString(16).padStart(4, '0')} ${on}`,
  )
}

console.log(
  anyDirectional
    ? '\nAt least one pool priced the two directions differently. SYSTEM-SPEC section 5 is WRONG and must be revised.'
    : '\nEvery pool priced both directions identically, in this market state.',
)
console.log('No hook carries BEFORE_SWAP_RETURNS_DELTA, and v4 fixes permissions in the hook address,')
console.log('so no existing pool can ever take a fee as a delta either. See SYSTEM-SPEC.md section 5.')
