// LIVE LADDER READ. The reviewer claims a Friday 28 Aug setPoolConfig is on chain and that the
// per-pool brief's "was" column predates it. This reads floorConfig() straight off each RWA hook,
// plus every PoolConfigured event with its block timestamp, so the claim is checkable rather than
// asserted.
import { c, retry } from './lib.mjs'
import { parseAbiItem } from 'viem'
import fs from 'node:fs'

const HOOKS = JSON.parse(fs.readFileSync(new URL('../data/hooks.json', import.meta.url)))
const ABI = [
  { name: 'floorConfig', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ type: 'tuple', components: [
      { name: 'openFloor', type: 'uint24' }, { name: 'overnightFloor', type: 'uint24' },
      { name: 'closedFloor', type: 'uint24' }, { name: 'spikeMult', type: 'uint8' },
      { name: 'closedSpike', type: 'uint24' }, { name: 'descentWindow', type: 'uint32' },
      { name: 'closeFloor', type: 'uint24' }, { name: 'closeBefore', type: 'uint32' },
      { name: 'closeAfter', type: 'uint32' }] }] },
  { name: 'maxFee', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint24' }] },
  { name: 'pokeFloor', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint24' }] },
  { name: 'currentFee', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint24' }] },
]
const PC = parseAbiItem('event PoolConfigured(bytes32 indexed poolId, (uint24 openFloor,uint24 overnightFloor,uint24 closedFloor,uint8 spikeMult,uint24 closedSpike,uint32 descentWindow,uint24 closeFloor,uint32 closeBefore,uint32 closeAfter) config, uint24 maxFee)')

const head = await retry(() => c.getBlockNumber())
const hb = await retry(() => c.getBlock({ blockNumber: head }))
console.log(`head ${head}  ${new Date(Number(hb.timestamp) * 1000).toISOString()}\n`)

const out = {}
console.log('LIVE floorConfig, read now')
console.log('pool    open    o/n  closed  spikeM  clSpike  descent  clFloor  clBef  clAft   cap  pokeFloor  now')
for (const [name, h] of Object.entries(HOOKS)) {
  if (name === 'ETH') continue // FablesLVR, no calendar
  let cfg
  try {
    cfg = await retry(() => c.readContract({ address: h.hook, abi: ABI, functionName: 'floorConfig', args: [h.poolId] }))
  } catch (e) { console.log(`${name.padEnd(6)} no floorConfig: ${String(e).slice(0, 70)}`); continue }
  const [cap, pf, cur] = await Promise.all(
    ['maxFee', 'pokeFloor', 'currentFee'].map((f) =>
      retry(() => c.readContract({ address: h.hook, abi: ABI, functionName: f, args: [h.poolId] })).catch(() => null)),
  )
  out[name] = { hook: h.hook, poolId: h.poolId, cfg: Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, Number(v)])), cap: Number(cap), pokeFloor: Number(pf), currentFee: Number(cur) }
  const g = (k) => String(Number(cfg[k])).padStart(6)
  console.log(`${name.padEnd(6)} ${g('openFloor')} ${g('overnightFloor')} ${g('closedFloor')} ${g('spikeMult')} ${g('closedSpike')} ${String(Number(cfg.descentWindow)).padStart(8)} ${g('closeFloor')} ${String(Number(cfg.closeBefore)).padStart(6)} ${String(Number(cfg.closeAfter)).padStart(6)} ${String(Number(cap)).padStart(5)} ${String(Number(pf)).padStart(10)} ${String(Number(cur)).padStart(4)}`)
}

// WHEN did each config land? PoolConfigured carries the whole struct, so the history is on chain.
console.log('\nPoolConfigured history, last ~3.0M blocks (~84h at 0.101s)')
const SPAN = BigInt(process.argv[2] ?? 3500000)
for (const [name, h] of Object.entries(HOOKS)) {
  if (name === 'ETH') continue
  const found = []
  for (let b = head - SPAN; b <= head; b += 200000n) {
    const e = b + 199999n > head ? head : b + 199999n
    try { found.push(...(await retry(() => c.getLogs({ address: h.hook, event: PC, args: { poolId: h.poolId }, fromBlock: b, toBlock: e })))) }
    catch (err) { /* skipped range */ }
  }
  if (!found.length) { console.log(`${name.padEnd(6)} no PoolConfigured in window`); continue }
  for (const l of found) {
    const blk = await retry(() => c.getBlock({ blockNumber: l.blockNumber }))
    const cfg = l.args.config
    console.log(`${name.padEnd(6)} ${new Date(Number(blk.timestamp) * 1000).toISOString()}  ${Number(cfg.openFloor)}/${Number(cfg.overnightFloor)}/${Number(cfg.closedFloor)}  spikeMult ${Number(cfg.spikeMult)} closedSpike ${Number(cfg.closedSpike)} descent ${Number(cfg.descentWindow)} closeFloor ${Number(cfg.closeFloor)} cap ${Number(l.args.maxFee)}`)
    out[name].history = out[name].history ?? []
    out[name].history.push({ ts: Number(blk.timestamp), block: Number(l.blockNumber), cfg: Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, Number(v)])), cap: Number(l.args.maxFee) })
  }
}
fs.writeFileSync(new URL('../data/live-ladder.json', import.meta.url), JSON.stringify(out, null, 1))
console.log('\nwrote /tmp/live-ladder.json')
