# ETH/USDG

**State 31 Aug: HANDED OFF to a separate workstream, which is taking the fee DOWN in low-volatility
regimes.** Nothing in this folder should touch ETH. It is also **the largest single line in the gap at
$3,331 a week** on 65% of our TVL, and the least examined thing here: its four largest venues were
excluded from every scan, so there is no depth measurement for ETH at all.

It is also NOT a valid control: its keeper repriced it every day inside
the frozen window (OPEN realised 2,119 / 1,122 / 899 / 1,053 / 2,065 across 08-24 to 08-28), so it
cannot serve as a tide gauge. Drift is measured from the field instead. Cross-asset frozen state in
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md). Fees in pips. Cap 3,000, pokeFloor 100,
autonomous 450 plus a live LVR keeper. `protocolFee = 0`.

## 1. Why it is held, and why that is not comfortable

ETH is the one pool where we make the **opposite** error from every other, in the largest market on
the chain by an order of magnitude.

| session | hrs | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share | our TVL share |
|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | $1,358,385,815 | 144 | 776 | **5.37x** | 44.6% | 27.8% | 0.62x | 0.52% | 5.9% |
| OPEN | 35 | $417,483,831 | 146 | 1,493 | **10.21x** | 66.4% | 53.0% | 0.80x | 0.35% | 5.9% |
| OVERNIGHT | 77 | $506,833,231 | 146 | 736 | 5.03x | 36.6% | 21.1% | 0.58x | 0.52% | 5.9% |
| CLOSED | 55 | $434,068,753 | 140 | 460 | 3.27x | 41.9% | 21.2% | 0.51x | 0.70% | 5.9% |

The market clears at **144 pips** because `v3 WETH/USDG 100` sets it: $1.22bn a week, 13.3M lifetime
transactions. We charge 5 to 10x that and hold **0.52% of flow on 5.9% of the TVL**.

Held anyway, for two reasons. The fee is driven by a live LVR keeper rather than a static ladder, so
changing it means changing a control loop, not a config. And cutting a volatility-derived fee
without markouts is precisely the move that buys toxic flow at a loss. It also serves as the second
control alongside GLD.

**The burden of proof is on keeping it.** A pool at 10x market with 0.35% session share is not
obviously priced right, and this needs its own study before the next round.

Note the ETH pool prices a 24/7 asset off the NYSE calendar: 1,493 pips during the cash session
against 460 when US equities are shut, on an asset that does not care. That is worth questioning on
its own, separately from the level.

## 2. What is missing from this baseline

**ETH has no depth measurement.** Its four largest venues could not be swap-scanned:
`v3 WETH/USDG 100` at 13.3M lifetime transactions, `v3 500` at 1.29M, `v4 577` at 651k, `v4 252` at
606k. The node serves **no archive `eth_call`** (tested and confirmed at head-100k, head-900k,
head-1.71M and head-5M), so depth can only come from Swap events and there is no cheaper path.
Volume, fee, share and APR above come from the 167h hourly buckets, which were verified accurate
against chain; virtual and k do not exist for ETH.

**A number to discard:** an earlier 48h scan covering only the six tractable venues reported a
40.46% share. It is wrong and must not be used: it measured a $9.8M market against a real $1.36bn.
It is recorded here so nobody rediscovers it and believes it.

## 3. What to do before the next round

1. **Sample depth on the four monsters.** Short windows of 1 to 2 hours, repeated at a few points
   across a week, is enough to establish k and utilisation without scanning millions of swaps.
2. **Recover and re-argue the keeper's rule.** `f = round(0.40 * sigma_annual_pct^2)` clamped to
   [450, 3000], fitted exactly on 119 unclamped pokes in `../data/lvr24h.json`. Any repricing is a
   change to that constant and should be argued as such.
3. **Per-window markouts**, open item 1 in `../FEE-POSITION.md`. ETH is where they were always meant
   to run first, and it is the only thing that can justify 5x the market fee.
