import { c, SWAP, retry, scan } from './lib.mjs'
const UR='0x8876789976decbfcbbbe364623c63652db8c0904'
// third column: which Swap amount is the USDG leg. USDG sorts as token0 on NVDA, GLD and META and as
// token1 on ETH (native currency0) and SPY; the old script read amount1 everywhere and produced
// 1e14 "dollars" on the three flipped pools.
const P=[
 ['FABLES ETH/USDG ','0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551',1],
 ['FABLES SPY/USDG ','0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd',1],
 ['FABLES NVDA/USDG','0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd',0],
 ['FABLES GLD/USDG ','0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a',0],
 ['FABLES META/USDG','0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5',0],
 ['rival ETH 0x54f7','0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32',1],
 ['rival SPY 0xe592','0xe5923c8a8be481ec89a2ca784a2bbfa4235de6d88f92260fd66b660c4babf907',1],
 ['rival SPY 0xfe2a','0xfe2a80bb5618fd14984b92ca6d45bf5ba67443ddb1435e28b2e48df2fc1526cd',1],
]
const HOURS = Number(process.argv[2] ?? 24)
const head=await retry(()=>c.getBlockNumber())
const bA=await retry(()=>c.getBlock({blockNumber:head})),bB=await retry(()=>c.getBlock({blockNumber:head-500000n}))
const SEC=(Number(bA.timestamp)-Number(bB.timestamp))/500000
const from=head-BigInt(Math.round(HOURS*3600/SEC))
console.log(`window ${HOURS}h, blocks ${from}..${head}, block time ${SEC.toFixed(3)}s, head ts ${new Date(Number(bA.timestamp)*1000).toISOString()}\n`)
console.log('pool               swaps   UR swaps  UR cnt%   UR vol$      UR vol%   top non-UR sender (share)')
const rows=[]
for(const [n,id,leg] of P){
  const sw=await scan(SWAP,id,from,head,100000n)
  const bySender={}
  let urC=0,urV=0,totV=0
  for(const l of sw){
    const v=Math.abs(Number(leg===0?l.args.amount0:l.args.amount1))/1e6
    const s=l.args.sender.toLowerCase()
    totV+=v
    bySender[s]=(bySender[s]||{c:0,v:0}); bySender[s].c++; bySender[s].v+=v
    if(s===UR){urC++;urV+=v}
  }
  const others=Object.entries(bySender).filter(([s])=>s!==UR).sort((a,b)=>b[1].v-a[1].v)
  const top=others[0]
  console.log(`${n} ${String(sw.length).padStart(7)} ${String(urC).padStart(10)} ${(sw.length?urC/sw.length*100:0).toFixed(1).padStart(8)}% ${urV.toFixed(0).padStart(10)} ${(totV?urV/totV*100:0).toFixed(1).padStart(11)}%   ${top?top[0].slice(0,10)+' '+(top[1].v/totV*100).toFixed(1)+'%':'-'}`)
  rows.push({pool:n,id,swaps:sw.length,urC,urV,totV,senders:Object.fromEntries(Object.entries(bySender).map(([k,v])=>[k,v]))})
}
const fs=await import('node:fs')
fs.writeFileSync(new URL('./ur_now.json',import.meta.url), JSON.stringify(rows,null,1))
