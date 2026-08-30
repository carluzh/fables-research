import { c, retry } from './lib.mjs'
const V3 = [
  ['GLD v3-3000 ', '0x7A6A053eCCf1446A2633E05aA6D40D09381997ec'],
  ['GLD v3-10000', '0x32cb909aCF78354E08aa45639Ff5CD33767E730a'],
  ['SPY v3-500  ', '0xa7Bb1AC63BBaB0C44316E6c8C455213441689167'],
  ['NVDA v3-500 ', '0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3'],
]
const SLOT0 = '0x3850c7bd'
const TOK0 = '0x0dfe1681'
const TOK1 = '0xd21220a7'
for (const [n, a] of V3) {
  const s = await retry(() => c.call({ to: a, data: SLOT0 }))
  const t0 = await retry(() => c.call({ to: a, data: TOK0 }))
  const t1 = await retry(() => c.call({ to: a, data: TOK1 }))
  const raw = s.data.slice(2)
  const sqrtX96 = BigInt('0x' + raw.slice(0, 64))
  const sp = Number(sqrtX96) / 2 ** 96
  console.log(n, 'token0=0x' + t0.data.slice(26), 'token1=0x' + t1.data.slice(26), 'sqrtP=' + sp.toExponential(6), 'p1/p0raw=' + (sp * sp).toExponential(6))
}
