// WHICH KEY EXECUTES setPoolConfig. getTargetAdminDelay is the delay on ADMIN operations against
// the target (setTargetFunctionRole, setTargetClosed), NOT the execution delay on a call. That
// comes from hasRole(roleId, account) -> (isMember, executionDelay). So the question "which key,
// and does it have to schedule an hour ahead" needs the role-0 membership, which is in the
// AccessManager's RoleGranted events.
import { c, retry } from './lib.mjs'
import { parseAbiItem } from 'viem'
import fs from 'node:fs'
const AMADDR = '0xA362D98B33A7bb5B5E2180a05f995A70FB404f30'
const RG = parseAbiItem('event RoleGranted(uint64 indexed roleId, address indexed account, uint32 delay, uint48 since, bool newMember)')
const RR = parseAbiItem('event RoleRevoked(uint64 indexed roleId, address indexed account)')
const AM = [{ name: 'hasRole', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint64' }, { type: 'address' }], outputs: [{ type: 'bool' }, { type: 'uint32' }] }]
const head = await retry(() => c.getBlockNumber())
const SPAN = BigInt(process.argv[2] ?? 40000000)
const STEP = 500000n
const seen = new Map()
for (const [label, ev] of [['granted', RG], ['revoked', RR]]) {
  for (let b = head > SPAN ? head - SPAN : 0n; b <= head; b += STEP) {
    const e = b + STEP - 1n > head ? head : b + STEP - 1n
    try {
      for (const l of await retry(() => c.getLogs({ address: AMADDR, event: ev, fromBlock: b, toBlock: e }))) {
        const r = Number(l.args.roleId), a = l.args.account
        const k = `${r}|${a}`
        seen.set(k, { roleId: r, account: a, last: label, delay: l.args.delay === undefined ? null : Number(l.args.delay), block: Number(l.blockNumber) })
      }
    } catch { /* range dropped */ }
  }
}
const out = []
process.stdout.write('AccessManager ' + AMADDR + '\nrole  account                                     lastEvent  hasRole  executionDelay\n')
for (const v of [...seen.values()].sort((x, y) => x.roleId - y.roleId)) {
  let live = null
  try { live = await retry(() => c.readContract({ address: AMADDR, abi: AM, functionName: 'hasRole', args: [BigInt(v.roleId), v.account] })) } catch { }
  const rec = { ...v, isMember: live ? live[0] : null, executionDelay: live ? Number(live[1]) : null }
  out.push(rec)
  process.stdout.write(`${String(v.roleId).padEnd(5)} ${v.account}  ${v.last.padEnd(9)}  ${String(rec.isMember).padEnd(7)}  ${rec.executionDelay}\n`)
}
fs.writeFileSync(new URL('../data/ladder-admins.json', import.meta.url), JSON.stringify(out, null, 1))
process.stdout.write('\nwrote data/ladder-admins.json\n')
