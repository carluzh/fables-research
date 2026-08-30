// WHO CAN CALL setPoolConfig. The reviewer says role 0 (ADMIN_ROLE) with a 3,600s target admin
// delay, and flags "confirm which key executes" as unresolved. This resolves it from the
// AccessManager the hooks actually point at, rather than from the deploy scripts.
import { c, retry } from './lib.mjs'
import { toFunctionSelector } from 'viem'
import fs from 'node:fs'
const HOOKS = JSON.parse(fs.readFileSync(new URL('../data/hooks.json', import.meta.url)))
const AUTH = [{ name: 'authority', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }]
const AM = [
  { name: 'getTargetFunctionRole', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'bytes4' }], outputs: [{ type: 'uint64' }] },
  { name: 'isTargetClosed', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'getTargetAdminDelay', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint32' }] },
  { name: 'getRoleAdmin', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint64' }], outputs: [{ type: 'uint64' }] },
  { name: 'hasRole', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint64' }, { type: 'address' }], outputs: [{ type: 'bool' }, { type: 'uint32' }] },
]
const SEL = toFunctionSelector('setPoolConfig((address,address,uint24,int24,address),(uint24,uint24,uint24,uint8,uint24,uint32,uint24,uint32,uint32),uint24)')
process.stdout.write(`setPoolConfig selector ${SEL}\n\n`)
const out = {}
for (const [name, h] of Object.entries(HOOKS)) {
  let auth
  try { auth = await retry(() => c.readContract({ address: h.hook, abi: AUTH, functionName: 'authority' })) }
  catch { process.stdout.write(`${name.padEnd(8)} no authority()\n`); continue }
  const rd = async (fn, args) => { try { return await retry(() => c.readContract({ address: auth, abi: AM, functionName: fn, args })) } catch (e) { return 'ERR ' + String(e).slice(0, 40) } }
  const role = await rd('getTargetFunctionRole', [h.hook, SEL])
  const closed = await rd('isTargetClosed', [h.hook])
  const delay = await rd('getTargetAdminDelay', [h.hook])
  const admin = typeof role === 'bigint' ? await rd('getRoleAdmin', [role]) : null
  out[name] = { hook: h.hook, authority: auth, role: String(role), targetClosed: closed, targetAdminDelay: String(delay), roleAdmin: String(admin) }
  process.stdout.write(`${name.padEnd(8)} authority ${auth}  role ${role}  closed ${closed}  targetAdminDelay ${delay}  roleAdmin ${admin}\n`)
}
fs.writeFileSync(new URL('../data/ladder-roles.json', import.meta.url), JSON.stringify(out, null, 1))
process.stdout.write('\nwrote data/ladder-roles.json\n')
