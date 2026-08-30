# TSLA/USDG

**State: baseline frozen 2026-08-30. No change is shipping, and none is proposed.** Cross-asset
frozen state in [BASELINE-2026-08-30.md](BASELINE-2026-08-30.md); method in [README.md](README.md).

Fees in pips: 100 pips = 1 bps. Hook `0x67D86050d22D574Df046F3D90F722045F714e080`, dynamic fee,
base tier 400, `protocolFee = 0` (read in `protofee.json`, so we keep 100% of what we charge). The
hook's cap and pokeFloor are not recorded anywhere in this snapshot, so they are not quoted here.

**This is a dust pool and the document says so before it says anything else.** $2,260 of TVL,
$5,951 of volume and **$4.95 of fees over the entire 167-hour week**. Every ratio below is honest
arithmetic on a denominator too small to act on. It is written down so nobody has to rediscover
that, and so the row in `universe7d.txt` is not read as a verdict.

---

## 1. The 167h field, frozen

167 hours to **2026-08-30T10:00:00Z**, 10 venues with volume, 5 cash sessions and 4 closed blocks.
Source `baseline-2026-08-30/universe7d.txt`, reproduced independently from `census.json`.

| session | hrs | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | $3,933,630 | 3,299 | 832 | 0.25x | 142.2% | 11.5% | **0.08x** | 0.151% |
| OPEN | 35 | $1,073,013 | 3,267 | 1,486 | 0.45x | 183.3% | 35.0% | 0.19x | 0.198% |
| OVERNIGHT | 77 | $1,604,682 | 3,360 | 531 | 0.16x | 128.2% | 5.1% | 0.04x | 0.119% |
| CLOSED | 55 | $1,255,936 | 3,247 | 408 | 0.13x | 135.7% | 5.5% | 0.04x | 0.153% |

Our TVL share is **0.472%** (`universe7d.txt` prints it rounded to 0.5%). Our fees split $3.16
open, $1.01 overnight, $0.78 closed. The whole week is under five dollars.

Two denominator warnings before those APR columns are used.

- **Every APR divides a week of fees by one TVL snapshot**, taken at `census.json` `fetchedAt`
  2026-08-30T10:47:35Z. TSLA is the mildest case in the set: `now.json` records our 24h TVL change
  as **+0.5%**, against +162.3% on SPY and -69.3% on GLD. The levels are still point-in-time
  denominator figures and must carry that label, but the distortion here is small.
- **The market APR is a charged-basis figure, not LP-net.** `protofee.json` holds protocol-fee reads
  for 50 of the 138 census pools, and in TSLA's field the only covered venue is our own pool, which
  is 0.15% of field volume. `universe7d.py` defaults an unread pool to a 100% LP keep, so 142.2%
  assumes every rival keeps everything it charges. Across the whole non-Fables field the
  volume-weighted keep is 75.7% (41 read venues with volume, 12 of them keeping 100%, the payers
  keeping 75.0% to 90.9%). Applying 75.7% to TSLA's unread venues puts the market APR at 107.7% and
  our ratio at **0.11x** instead of 0.08x. That correction is INFERRED, on a haircut nobody has read.

## 2. Who the field actually is

`census.json` carries 16 TSLA pools. Ten traded inside the window. Realised fee is
`1e6 * fees / volume` over the 167 hours; `hrs` counts hours with any volume.

| venue | TVL | realised fee | 167h volume | share | 167h fees | hrs |
|---|---|---|---|---|---|---|
| v4 TSLA/USDG 3499 | $310,249 | 3,499 | $2,513,370 | 63.89% | $8,794.28 | 167 |
| v3 TSLA/USDG 3000 | $146,694 | 3,000 | $1,250,100 | 31.78% | $3,750.30 | 167 |
| v3 WETH/TSLA 3000 | $7,436 | 3,000 | $130,538 | 3.32% | $391.61 | 167 |
| v4 TSLA/USDG 400 dyn, hook `0x64E9...e088` | $5,982 | 498 | $25,109 | 0.64% | $12.51 | 40 |
| v4 TSLA/USDG 13999 dyn, hook `0xA4e6...4880` | $1,803 | 2,490 | $7,965 | 0.20% | $19.83 | 67 |
| **Fables, 400 dyn** | **$2,260** | **832** | **$5,951** | **0.151%** | **$4.95** | **129** |
| v4 TSLA/USDG 4096 | $782 | 4,096 | $250 | 0.01% | $1.03 | 42 |
| v3 TSLA/USDG 100 | $0 | 100 | $215 | 0.01% | $0.02 | 1 |
| v3 TSLA/USDG 10000 | $21 | 10,000 | $127 | 0.00% | $1.27 | 20 |
| v4 TSLA/USDG 50950 | $1,716 | 50,950 | $3 | 0.00% | $0.17 | 2 |

Three things follow from that table, and they are the only things this pool measures well.

1. **TSLA is the most expensive equity market on the chain.** 99.0% of its volume pays 3,000 pips
   or more, and the two top venues alone are 95.7% of it. The 3,299-pip market fee is the highest
   of any asset field in the baseline except GLD's 3,937, which is a dislocation figure rather than
   a price: TSLA sits above META (2,933), AAPL (1,377), SPY (1,167), NVDA (592 on live venues, 845 as first published) and ETH (144).
2. **This field is alive, unlike NVDA's.** The top three venues each traded in all 167 hours and
   each traded within the last hour of the window (`vol24hGw` $431,898, $277,778 and $55,653). No
   part of the 3,299-pip market fee is composed of pools that stopped trading days earlier, which
   is precisely the defect that corrupts NVDA's market fee. Fee concentration is clean too: the top
   venue carries 67.8% of field fees on 63.89% of volume.
3. **We are not the only dynamic-fee hook quoting this pair.** Two other v4 pools run hooks that are
   not ours: `0x64E9...e088` on the identical 400 base tier, realising 498 pips, and
   `0xA4e6...4880` on a 13,999 tier realising 2,490. The 400-tier rival did **4.2x our volume on
   2.6x our TVL** and landed at **11.0% APR against our 11.5%**. The only other pool priced anywhere
   near us earns what we earn.

## 3. What the numbers say

The 0.08x APR ratio is not one story. It is the product of two measured ones:

```
price      our 832 pips / market 3,299 pips                    = 0.25x
turnover   our 2.63x TVL per week / field 8.22x TVL per week   = 0.32x
                                                       product = 0.081  = the printed 0.08x
```

So the discount explains about half of it. The other half is that a dollar sitting in this pool gets
used a third as often as a dollar sitting in the field. We hold 0.47% of the asset's TVL and take
0.15% of its volume, where on SPY and META share roughly tracks TVL share. That is a routing or a
depth fact, not a price fact, and nothing in this baseline can say which.

The size of the prize, and why it is not a prize: at the market's own 3,299 pips on unchanged volume
the week's fees would have been **$19.63 instead of $4.95** (INFERRED, and it assumes flow does not
move at all, which is the least defensible assumption available). A perfect repricing of this pool
is worth under fifteen dollars a week.

## 4. What is missing

- **No 48h chain scan was run for TSLA.** There is no `universe48h_tsla.txt` and no
  `tsla_series.json`. Everything above comes from the 167h hourly buckets, which carry no liquidity,
  so **virtual depth, k, utilisation, time-weighted TVL and exact per-swap fees do not exist for this
  pool or for any venue in its field.** Every depth statement made about SPY, NVDA, META and GLD has
  no counterpart here, and none should be inferred from the hook being the same one.
- **No two-window cross-check.** SPY, NVDA, META and GLD each have a second window, and the second
  window has already broken one conclusion (NVDA's session APR, 1.46x on 48h against 0.95x on 167h).
  TSLA has one window and nothing to check it against.
- **The elasticity is unusable, not merely weak.** 129 of the 167 hours had any volume at all; the
  median active hour did **$17.85** of volume; the largest single hour did $919; the largest fee hour
  earned **$0.93**, which is 18.8% of the whole week, and the top five hours are 43.0% of it. Our
  realised hourly fee ranged 400 to 3,728 pips, but every hour above 1,100 pips sits on under $120 of
  volume, so those readings describe rounding on a handful of swaps, not a ladder.
- **The field definition excludes a larger neighbour.** `v4 SPY/TSLA 625` did **$3,017,754** over
  the same 167 hours on $259,933 of TVL, 77% as much volume as the entire "TSLA market" above.
  `universe7d.py` routes a two-non-quote pair into its own cross field, so it sits outside this
  benchmark. A TSLA-for-SPY trader can also route through USDG, so the same-pair field is a lower
  bound on the real alternative set.

## 5. Recommendation

**Leave the fee alone, and leave the pool out of this round.** Not because the price is right: at
0.25x market it carries the same discount SPY and META do, and there is nothing to lose by raising
it. Because a fee change here cannot be measured. At $17.85 of median hourly volume a share move
from 0.15% to 0.10% is a handful of swaps, and no result the pool produced would survive being asked
for its n. Shipping a change into an unmeasurable pool adds a variable to the SPY / NVDA / META
experiment and buys nothing.

If TSLA is meant to be a real pool, the lever is TVL and routing, not price. We are 0.47% of the
asset's TVL in a market where 95.5% of the capital sits in two venues charging 3,000 and 3,499 pips
and turning over 8x a week. Fixing the fee on $2,260 turns a rounding error into a slightly larger
rounding error.

Two cheap things are worth doing anyway, and both are measurement rather than action.

1. **Extend the protocol-fee read to the rest of this field.** Nine venues are unread, which is
   99.85% of the volume, and it is the only reason the market APR above is charged-basis. That is a
   handful of `eth_call`s, not a scan.
2. **If TSLA ever gets capital, run the 48h scan before the fee moves**, so the pool starts with the
   depth and k numbers every other pool in this set has and this one does not.

## 6. What this does not settle

- **Sample size, which is the whole document.** The APR ratio has a **$4.95** numerator, and the
  session rows split that into $3.16, $1.01 and $0.78. No conclusion about the fee ladder, the
  session shape, or price sensitivity can be carried out of this pool in either direction.
- **Whether 0.15% share is a price problem, a depth problem or a routing problem.** The turnover
  decomposition says price is only half of it, and with no depth measurement we cannot say what the
  other half is. Untested, and it decides whether the pool deserves capital.
- **Whether the 3,299-pip market fee is a clearing price or a coordination point.** 99.0% of the
  field pays 3,000 or more with essentially nothing between our 832 and the 2,490 of the 13,999
  pool, and two venues hold 95.5% of the capital, so the volume-weighted market is close to a
  two-venue quote.
- **The market APR is not LP-net.** Said once in section 1 and repeated here because the 142.2%
  figure is the one that will get copied: it assumes rivals keep 100%. At the field's 75.7%
  volume-weighted keep it is 107.7% and our ratio is 0.11x.
- **The window sits inside the points programme.** It opened 2026-08-24, the same day routing was
  approved, and it pays on fees, so volume from that date carries two effects at once and is not a
  steady state. The hour-level concentration in the field (one hour is 13.1% of the week's volume,
  the top five are 37.8%) is the shape wash trading would take, and nothing measured here rules it
  out.
