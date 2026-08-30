// FULL PoolConfigured HISTORY. The 3.5M-block scan only reached 2026-08-26, so it showed the
// 08-28 change but not what it replaced. Without the previous config there is no way to say which
// tiers actually moved, which is the whole dispute. Scans back far enough to find pool creation.
import { c, retry } from './lib.mjs'
import { parseAbiItem } from 'viem'
import fs from 'node:fs'
const HOOKS = JSON.parse(fs.readFileSync(new URL('../data/hooks.json', import.meta.url)))
const PC = parseAbiItem('event PoolConfigured(bytes32 indexed poolId, (uint24 openFloor,uint24 overnightFloor,uint24 closedFloor,uint8 spikeMult,uint24 closedSpike,uint32 descentWindow,uint24 closeFloor,uint32 closeBefore,uint32 closeAfter) config, uint24 maxFee)')
const head = await retry(() => c.getBlockNumber())
const SPAN = BigInt(process.argv[2] ?? 30000000)   // ~35 days at 0.101s/block
const STEP = 500000n
const out = {}
process.stdout.write(`head ${head}, scanning ${SPAN} blocks (~${(Number(SPAN) * 0.101 / 86400).toFixed(1)}d)\n`)
for (const [name, h] of Object.entries(HOOKS)) {
  const found = []
  for (let b = head > SPAN ? head - SPAN : 0n; b <= head; b += STEP) {
    const e = b + STEP - 1n > head ? head : b + STEP - 1n
    try { found.push(...(await retry(() => c.getLogs({ address: h.hook, event: PC, args: { poolId: h.poolId }, fromBlock: b, toBlock: e })))) } catch { /* range dropped */ }
  }
  out[name] = []
  process.stdout.write(`\n${name}: ${found.length} PoolConfigured\n`)
  for (const l of found) {
    const blk = await retry(() => c.getBlock({ blockNumber: l.blockNumber }))
    const g = l.args.config
    const rec = { ts: Number(blk.timestamp), iso: new Date(Number(blk.timestamp) * 1000).toISOString(), block: Number(l.blockNumber), cap: Number(l.args.maxFee), ...Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Number(v)])) }
    out[name].push(rec)
    process.stdout.write(`  ${rec.iso}  ${rec.openFloor}/${rec.overnightFloor}/${rec.closedFloor}  spikeMult ${rec.spikeMult} closedSpike ${rec.closedSpike} descent ${rec.descentWindow} closeFloor ${rec.closeFloor}/${rec.closeBefore}/${rec.closeAfter} cap ${rec.cap}\n`)
  }
}
fs.writeFileSync(new URL('../data/ladder-history.json', import.meta.url), JSON.stringify(out, null, 1))
process.stdout.write('\nwrote data/ladder-history.json\n')
