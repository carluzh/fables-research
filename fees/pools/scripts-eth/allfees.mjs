// Live fee on every pool, correct 2-arg signature. Both directions, so an asymmetric poke shows.
import { createPublicClient, http } from 'viem'
import fs from 'node:fs'
const c = createPublicClient({ transport: http('https://rpc.mainnet.chain.robinhood.com') })
const P = JSON.parse(fs.readFileSync(new URL('../fables-research/fees/deviation/data/asymmetry.json', import.meta.url)))
const abi = [{ name: 'currentFee', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'bool' }], outputs: [{ type: 'uint24' }] }]
console.log(`${'pool'.padEnd(10)} ${'0->1'.padStart(7)} ${'1->0'.padStart(7)}   note`)
for (const [n, p] of Object.entries(P)) {
  const rd = async (z) => { try { return Number(await c.readContract({ address: p.hook, abi, functionName: 'currentFee', args: [p.poolId, z] })) } catch { return null } }
  const a = await rd(true); await new Promise((r) => setTimeout(r, 300))
  const b = await rd(false); await new Promise((r) => setTimeout(r, 300))
  console.log(`${n.padEnd(10)} ${String(a).padStart(7)} ${String(b).padStart(7)}   ${a !== null && a === b ? 'symmetric' : a === null ? 'read failed' : 'ASYMMETRIC, poke live'}`)
}
