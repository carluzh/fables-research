import { keccak256, toHex } from 'viem'
const sig = (s) => keccak256(toHex(s)).slice(0,10)
const RPC='https://rpc.mainnet.chain.robinhood.com'
const POKER='0x1b6a8808e1d26dba66ba11e52997803c43cad429'
const GLD='0xB608a78761f179f7C56f15E7D13921B92F00a080', GLDID='fe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'
const SPY='0xA0E8fBFf13E24Af2b5e61A72800E08a161bDe080', SPYID='8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd'
const P4=sig('pokeFee(bytes32,uint24,uint24,uint40)'), P3=sig('pokeFee(bytes32,uint24,uint40)')
const w=n=>BigInt(n).toString(16).padStart(64,'0')
const E={}; for(const e of ['FeeBelowFloor()','FeeAboveCap()','InvalidTtl()','EmptyPoke()','AccessManagedUnauthorized(address)']) E[sig(e)]=e.replace('()','')
async function sim(from,to,data){
  const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{from,to,data},'latest']})})
  const j=await r.json()
  if(j.result!==undefined) return 'OK'
  const d=j.error?.data||''
  const s4=typeof d==='string'&&d.startsWith('0x')?d.slice(0,10):''
  return E[s4]||(j.error?.message||'?').slice(0,70)+(s4?` [${s4}]`:'')
}
const ramp=(d,base,kick,full,cap)=>Math.round(d<=kick?base:d>=full?cap:base+(cap-base)*(d-kick)/(full-kick))
console.log('GLD chain: floorConfig[open3000,overnight3000,closed6000] pokeFloor=3000 cap=15000; base NOW=6000')
console.log('SPEC 7.1 locked: base 3000 open / 1500 out-of-hours, kick 2%, full 10%, cap 15000\n')
console.log('  d      ramp@spec-base-1500   pokeFee result        | ramp@chain-base-6000   pokeFee result')
for(const d of [0.0201,0.022,0.025,0.0288,0.029,0.035,0.05,0.10]){
  const a=ramp(d,1500,0.02,0.10,15000), b=ramp(d,6000,0.02,0.10,15000)
  const ra=await sim(POKER,GLD,P4+GLDID+w(a)+w(a)+w(7200))
  const rb=await sim(POKER,GLD,P4+GLDID+w(b)+w(b)+w(7200))
  console.log(` ${(100*d).toFixed(2)}%  ${String(a).padStart(6)}   ${ra.padEnd(20)} |  ${String(b).padStart(6)}   ${rb}`)
  await new Promise(s=>setTimeout(s,250))
}
console.log('\nSPY legacy 3-arg. chain floorConfig[800,350,250] pokeFloor=250 cap=8000; spec 9 says base 800/400/400')
for(const [d,base,lbl] of [[0.0151,400,'spec base 400'],[0.0151,250,'chain base 250'],[0.03,400,'spec base 400']]){
  const f=ramp(d,base,0.015,0.045,8000)
  console.log(` d=${(100*d).toFixed(2)}% ${lbl.padEnd(16)} fee=${String(f).padStart(5)}  ->  ${await sim(POKER,SPY,P3+SPYID+w(f)+w(7200))}`)
  await new Promise(s=>setTimeout(s,250))
}
console.log('\ncontrols:')
console.log(' GLD ttl=259201        ->', await sim(POKER,GLD,P4+GLDID+w(5000)+w(5000)+w(259201)))
console.log(' GLD ttl=259200 (72h)  ->', await sim(POKER,GLD,P4+GLDID+w(5000)+w(5000)+w(259200)))
console.log(' GLD ttl=43200 (12h)   ->', await sim(POKER,GLD,P4+GLDID+w(5000)+w(5000)+w(43200)))
console.log(' GLD unauthorized      ->', await sim('0x000000000000000000000000000000000000dEaD',GLD,P4+GLDID+w(5000)+w(5000)+w(7200)))
console.log(' GLD clearPoke as poker->', await sim(POKER,GLD,sig('clearPoke(bytes32)')+GLDID))
console.log(' GLD clearPoke as guard->', await sim('0x5cda43da9631fb84d390d91e750f549b7ada721c',GLD,sig('clearPoke(bytes32)')+GLDID))
