import { c, retry } from './lib.mjs'
import { keccak256, toHex, decodeAbiParameters, parseAbiItem } from 'viem'
const HOOK='0xB608a78761f179f7C56f15E7D13921B92F00a080'
const ID='0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'
const PC = parseAbiItem('event PoolConfigured(bytes32 indexed poolId, (uint24 openFloor,uint24 overnightFloor,uint24 closedFloor,uint8 spikeMult,uint24 closedSpike,uint32 descentWindow,uint24 closeFloor,uint32 closeBefore,uint32 closeAfter) config, uint24 maxFee)')
const FP = parseAbiItem('event FeePoked(bytes32 indexed poolId, uint24 fee, uint40 expiry)')
const head = await retry(()=>c.getBlockNumber())
const SPAN = BigInt(process.argv[2] ?? 3000000)
console.log('head', head, 'scanning back', SPAN, 'blocks (~', (Number(SPAN)*0.101/3600).toFixed(1), 'h )')
for (const [name, ev] of [['PoolConfigured', PC], ['FeePoked', FP]]) {
  const found=[]
  for (let b = head - SPAN; b <= head; b += 200000n) {
    const e = b+199999n > head ? head : b+199999n
    try {
      const logs = await retry(()=>c.getLogs({address:HOOK, event:ev, args:{poolId:ID}, fromBlock:b, toBlock:e}))
      found.push(...logs)
    } catch(err){ console.log('  scan fail', b, String(err).slice(0,80)) }
  }
  console.log(`\n${name}: ${found.length} events`)
  for (const l of found) {
    const blk = await retry(()=>c.getBlock({blockNumber:l.blockNumber}))
    const ts = new Date(Number(blk.timestamp)*1000).toISOString()
    console.log('  block', l.blockNumber.toString(), ts, JSON.stringify(l.args, (k,v)=>typeof v==='bigint'?v.toString():v))
  }
}
