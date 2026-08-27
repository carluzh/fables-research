import { c, SWAP, retry, scan } from './lib.mjs'
import fs from 'node:fs'
const now=JSON.parse(fs.readFileSync('now.json','utf8'))
const meta=Object.fromEntries(now.out.map(r=>[r.key,r]))
const P=[
 ['F-SPY','0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd'],
 ['F-NVDA','0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd'],
 ['F-ETH','0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551'],
 ['F-GLD','0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'],
]
// decimals: read from the gateway node we already have
const head=await retry(()=>c.getBlockNumber())
console.log('k = 2*L*sqrt(P) / TVL   (=1 for a full-range v2 pool; the capital-efficiency multiple that scales LVR)\n')
console.log('pool     swaps sampled   median L*  implied virtual value $     TVL $      k')
for(const [k,id] of P){
  const logs=await scan(SWAP,id,head-200000n,head,100000n)     // ~5.6h of blocks
  if(!logs.length){ console.log(k,'no swaps'); continue }
  const vals=[]
  for(const l of logs.slice(-400)){
    const L=Number(l.args.liquidity)
    const sp=Number(l.args.sqrtPriceX96)/2**96
    vals.push({L,sp})
  }
  const med=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)]
  const Lm=med(vals.map(v=>v.L)), spm=med(vals.map(v=>v.sp))
  const node=meta[k]
  // token decimals from gateway payload is not stored; use known: USDG 6, SPY/NVDA/GLD 18? derive from price consistency
  console.log(`${k.padEnd(9)} ${String(logs.length).padStart(8)} ${Lm.toExponential(4).padStart(14)}  sqrtP=${spm.toExponential(4)}   TVL $${Math.round(node.tvlUsd).toLocaleString()}`)
  fs.appendFileSync('kraw.txt',`${k} L=${Lm} sqrtP=${spm} tvl=${node.tvlUsd}\n`)
}
