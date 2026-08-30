// Read the LIVE floorConfig off every Fables RWA hook, which is the thing the shipping table should
// have been written against and was not. The 167h measurement window ends 30 Aug and a ladder change
// landed on 28 Aug, so realised fees over that window describe mostly the PREVIOUS config.
import { createPublicClient, http, parseAbi } from 'viem'

const c = createPublicClient({ transport: http('https://rpc.mainnet.chain.robinhood.com') })
const ABI = parseAbi([
  'function floorConfig(bytes32 poolId) view returns ((uint24 openFloor,uint24 overnightFloor,uint24 closedFloor,uint8 spikeMult,uint24 closedSpike,uint32 descentWindow,uint24 closeFloor,uint32 closeBefore,uint32 closeAfter))',
  'function maxFee(bytes32 poolId) view returns (uint24)',
  'function pokeFloor(bytes32 poolId) view returns (uint24)',
])

const POOLS = [
  ['SPY', '0xA0E8fBFf13E24Af2b5e61A72800E08a161bDe080', '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd'],
  ['NVDA', '0x66622f77B797D506e5376F7798b67ab288966080', '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd'],
  ['META', '0x8AF95932eC4484fb10C641a4cBcf19a798cB2080', '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5'],
  ['GLD', '0xB608a78761f179f7C56f15E7D13921B92F00a080', '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'],
  ['TSLA', '0x67D86050d22D574Df046F3D90F722045F714e080', '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e'],
  ['AAPL', '0x70a9A88402989226847Ec122043CE5e7FF462080', '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147'],
]

// what the pool documents published as "realised now", from the 167h window
const PUBLISHED = { SPY: '528 / 350 / 250', NVDA: '1,377 / 417 / 300', META: '579 / 361 / 250', GLD: '1,065 / 392 / 1,207', TSLA: 'n/a', AAPL: 'n/a' }
// what the documents propose to ship
const SHIPPING = { SPY: '550 / 450 / 400', NVDA: 'hold / 550 / 450', META: '500 / 500 / 450', GLD: 'none', TSLA: 'none', AAPL: 'none' }

console.log('LIVE floorConfig, read at ' + new Date().toISOString())
console.log()
console.log('pool  open  o/night  closed  spikeMult  closedSpike  descent  closeFloor  maxFee  pokeFloor   routine BELL')
for (const [name, hook, pid] of POOLS) {
  try {
    const f = await c.readContract({ address: hook, abi: ABI, functionName: 'floorConfig', args: [pid] })
    let mx = null, pf = null
    try { mx = await c.readContract({ address: hook, abi: ABI, functionName: 'maxFee', args: [pid] }) } catch (e) {}
    try { pf = await c.readContract({ address: hook, abi: ABI, functionName: 'pokeFloor', args: [pid] }) } catch (e) {}
    const bell = Number(f.overnightFloor) * Number(f.spikeMult)
    console.log(
      `${name.padEnd(5)} ${String(f.openFloor).padStart(5)} ${String(f.overnightFloor).padStart(8)} ${String(f.closedFloor).padStart(7)}` +
        ` ${String(f.spikeMult).padStart(10)} ${String(f.closedSpike).padStart(12)} ${String(f.descentWindow).padStart(8)}` +
        ` ${String(f.closeFloor).padStart(11)} ${String(mx ?? '?').padStart(7)} ${String(pf ?? '?').padStart(10)}` +
        `   ${String(bell).padStart(6)}${Number(f.closedSpike) && bell !== Number(f.closedSpike) ? '  (closedSpike ' + f.closedSpike + ')' : ''}`,
    )
  } catch (e) {
    console.log(`${name.padEnd(5)} READ FAILED ${String(e).split('\n')[0].slice(0, 120)}`)
  }
}

console.log()
console.log('THE SHIPPING TABLE, RESTATED AGAINST LIVE CONFIG')
console.log('pool   live (o/n/c)          published "was"      shipping             real direction')
for (const [name, hook, pid] of POOLS) {
  try {
    const f = await c.readContract({ address: hook, abi: ABI, functionName: 'floorConfig', args: [pid] })
    const live = `${f.openFloor} / ${f.overnightFloor} / ${f.closedFloor}`
    const ship = SHIPPING[name]
    let dir = 'no change'
    if (ship !== 'none' && ship !== undefined) {
      const parts = ship.split(' / ')
      const tgt = [parts[0] === 'hold' ? null : Number(parts[0]), Number(parts[1]), Number(parts[2])]
      const cur = [Number(f.openFloor), Number(f.overnightFloor), Number(f.closedFloor)]
      dir = ['open', 'o/n', 'closed']
        .map((t, i) => (tgt[i] === null ? `${t} hold` : `${t} ${cur[i] === tgt[i] ? 'flat' : (tgt[i] > cur[i] ? '+' : '') + (((tgt[i] - cur[i]) / cur[i]) * 100).toFixed(0) + '%'}`))
        .join(', ')
    }
    console.log(`${name.padEnd(6)} ${live.padEnd(21)} ${(PUBLISHED[name] ?? '-').padEnd(20)} ${String(ship).padEnd(20)} ${dir}`)
  } catch (e) {}
}

console.log()
console.log('THE COUPLING: routine opening bell = overnightFloor x spikeMult (SessionLib.sol:118)')
for (const [name, hook, pid] of POOLS) {
  try {
    const f = await c.readContract({ address: hook, abi: ABI, functionName: 'floorConfig', args: [pid] })
    if (!Number(f.spikeMult) || !Number(f.descentWindow)) continue
    const now = Number(f.overnightFloor) * Number(f.spikeMult)
    const prop = SHIPPING[name] && SHIPPING[name] !== 'none' ? Number(SHIPPING[name].split(' / ')[1]) : null
    if (prop === null || Number.isNaN(prop)) continue
    const after = prop * Number(f.spikeMult)
    console.log(
      `  ${name}: overnight ${f.overnightFloor} -> ${prop} moves the bell ${now} -> ${after} (${(((after - now) / now) * 100).toFixed(0)}%), ` +
        `closedSpike stays ${f.closedSpike}` + (after < Number(f.closedSpike) ? '  <-- Monday opens now DEARER than Tuesday' : ''),
    )
  } catch (e) {}
}
