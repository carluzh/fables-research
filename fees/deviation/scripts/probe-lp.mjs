import { c, ML, retry, scan } from './lib.mjs'
const ID='0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'
const head = await retry(()=>c.getBlockNumber())
const hb = await retry(()=>c.getBlock({blockNumber:head}))
const SEC=0.101
// Friday 2026-08-28 16:00 ET = 20:00 UTC
const startTs = Date.UTC(2026,7,28,20,0,0)/1000
const back = BigInt(Math.round((Number(hb.timestamp)-startTs)/SEC))
console.log('head',head.toString(),new Date(Number(hb.timestamp)*1000).toISOString())
console.log('scanning ModifyLiquidity from', (head-back).toString(), 'covering', ((Number(back)*SEC)/3600).toFixed(1),'h')
const logs = await scan(ML, ID, head-back, head, 100000n)
console.log('events:', logs.length)
let adds=0n, rems=0n, nAdd=0, nRem=0
const byAcct={}
for(const l of logs){
  const d = l.args.liquidityDelta
  const s = l.args.sender.toLowerCase()
  byAcct[s]=byAcct[s]||{add:0n,rem:0n,n:0}
  byAcct[s].n++
  if(d>0n){adds+=d;nAdd++;byAcct[s].add+=d} else {rems+=-d;nRem++;byAcct[s].rem+=-d}
}
console.log('adds', nAdd, 'total L +'+adds.toString())
console.log('removes', nRem, 'total L -'+rems.toString())
console.log('net L', (adds-rems).toString())
console.log('\nby sender:')
for(const [s,v] of Object.entries(byAcct).sort((a,b)=>Number(b[1].n-a[1].n)))
  console.log('  ',s,'events',v.n,'add',v.add.toString(),'rem',v.rem.toString(),'net',(v.add-v.rem).toString())
