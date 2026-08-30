import { c, retry } from './lib.mjs'
const GLD = '0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e'
const SPY = '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C'
const NVDA = '0xd0601cE157db5bdC3162bbAc2a2c8AF5320d9eEC'
const sels = {
  'name()': '0x06fdde03',
  'symbol()': '0x95d89b41',
  'decimals()': '0x313ce567',
  'totalSupply()': '0x18160ddd',
  'uiMultiplier()': '0x2b3297f9',
  'sharesPerToken()': '0x4d0a4a4f',
  'multiplier()': '0x5e1c1059',
  'sharePrice()': '0x87269729',
  'getMultiplier()': '0x49a4d1dd',
  'scalingFactor()': '0xf5b541a6',
  'rate()': '0x2c4e722e',
}
import { keccak256, toHex } from 'viem'
const sig = (s) => keccak256(toHex(s)).slice(0, 10)
const PROBE = [
  'uiMultiplier()', 'sharesPerToken()', 'tokensPerShare()', 'multiplier()', 'scalingFactor()',
  'sharesOf(address)', 'convertToShares(uint256)', 'convertToAssets(uint256)', 'exchangeRate()',
  'getSharesPerToken()', 'shareMultiplier()', 'splitMultiplier()', 'ratio()', 'index()',
]
for (const [label, addr] of [['GLD', GLD], ['SPY', SPY], ['NVDA', NVDA]]) {
  console.log('=====', label, addr)
  for (const fn of ['name()', 'symbol()', 'decimals()', 'totalSupply()']) {
    try {
      const r = await retry(() => c.call({ to: addr, data: sig(fn) }))
      console.log('  ', fn, r.data)
    } catch (e) { console.log('  ', fn, 'REVERT') }
  }
  for (const fn of PROBE) {
    if (fn.includes('address') || fn.includes('uint256')) continue
    try {
      const r = await retry(() => c.call({ to: addr, data: sig(fn) }))
      if (r.data && r.data !== '0x') console.log('   HIT', fn, sig(fn), r.data)
    } catch (e) { /* no such fn */ }
  }
}
