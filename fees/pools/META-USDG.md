# META/USDG

**State: baseline frozen 2026-08-30, fee change shipping.** Cross-asset frozen state in
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md). Fees in pips. `protocolFee = 0`, cap 8,000,
pokeFloor 250.

## 1. The change, and the scoreboard to fill in

**CORRECTED 2026-08-30 evening. The raise is cut from 900/800/700 to 500/500/450** because the
elasticity behind the larger number turned out to be incoherent: see section 3.

| tier | was | **shipping** | market | after (fill in) |
|---|---|---|---|---|
| OPEN | 579 realised | **500** (was 900) | 2,659 | |
| OVERNIGHT | 361 | **500** (was 800) | 2,989 | |
| CLOSED | 250 | **450** (was 700) | 3,033 | |

The *level* argument is unchanged and is measured, not inferred: charging 0.08x to 0.22x of the
market's clearing price is a fact. What is not supportable is the size of the step, which rested on
six hours of one Friday.

| metric, 167h field benchmark | baseline | expected | after (fill in) |
|---|---|---|---|
| our fee vs market, all | **0.14x** | 0.16 to 0.20x | |
| our APR vs market, all | **0.12x** | 0.15 to 0.20x | |
| our volume share | 15.70% | 13 to 16% | |
| **break-even share** | | **12.95%** | |

Share is the pre-registered test. Falsified if share falls below 12.95%, the level at which the
raise stops paying for itself at constant market volume.

## 2. Why: the worst discount on the board

167 hours, 7 venues, 5 cash sessions.

| session | hrs | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | $1,725,143 | 2,933 | 396 | **0.14x** | 181.2% | 21.5% | **0.12x** | 15.70% |
| OPEN | 35 | $415,560 | 2,659 | 579 | 0.22x | 189.4% | 57.5% | 0.30x | 24.97% |
| OVERNIGHT | 77 | $390,481 | 2,989 | 361 | 0.12x | 90.1% | 7.7% | **0.09x** | 12.63% |
| CLOSED | 55 | $919,102 | 3,033 | 250 | **0.08x** | 303.3% | 17.9% | **0.06x** | 12.81% |

**We hold 20.7% of the asset's TVL, take 15.7% of its volume, and earn 12% of the field's APR.**
In closed hours we charge **8% of the market fee**. Over the 48h scan **zero** META volume traded
cheaper than us, and 4 of 5 venues beat our APR.

Largest discount and largest available gain of any pool, which is why META takes the biggest
relative raise.

## 3. How our flow responds to price

The afternoon version of this table was wrong twice over: corrupted by a rounding bug that split
META's single 250-pip tier into "200" and "300" rows and then compared them against each other, and
read off the inferred index rather than measured dollars. Rebucketed on the realised fee rounded to
1 pip, over 167 hours:

| we charge | hours | days | session | our volume | mean share | **$/hour** | index |
|---|---|---|---|---|---|---|---|
| 250 | 37 | 3 | all CLOSED | $117,708 | 21.14% | $0.80 | 5,285 |
| 350 | 57 | 5 | all OVERNIGHT | $48,039 | 21.12% | $0.29 | 7,392 |
| 500 | 22 | 4 | all OPEN | $41,436 | 21.48% | $0.94 | 10,740 |
| 900 | 6 | **1** | all OPEN | $17,879 | **41.33%** | $2.68 | 37,194 |

**The demand curve slopes up, which means it is not a demand curve.** Share at 900 pips is 41.33%
against 21.14% at 250. That is the session confound in plain sight: the 900-pip hours are six hours
of a single Friday, and META share is much higher during the cash session for reasons that have
nothing to do with our fee. There is no usable elasticity here.

The entire top-of-curve evidence for META is **$2.68 an hour on one day**, which is why the raise is
now a step to roughly the level we already charge in the session rather than a 3.6x jump.

## 4. Context

The 48h field fee of 1,959 pips is set by `v4 3499` ($670,906 at 3,499) and `v3 WETH/META 3000`.
The `v4 SPY/META 625` cross did $724,226 over the same 48h and $1,986,623 over 167h, a pair we do
not quote. Note the two windows define META's field differently: the 167h benchmark routes any
two-non-quote pair to its own cross asset and therefore **excludes** SPY/META, while the 48h chain
scan includes it, where it is the single largest venue at 43.0% of volume. META's market is small in absolute
terms, $1.7M a week, so the absolute upside is modest even if the ratio improves a lot: this pool is
worth changing because it is the cleanest test of how far a raise can go, not because of the dollars.

## 5. What this does not settle

- **Only 5 to 7 venues**, the smallest field of any asset, so one venue appearing or dying moves the
  market fee materially.
- **The elasticity is the thinnest of the four**: 6 hours at the top, fully confounded with session.
- **Whether a 3.6x raise holds share at all.** META gets the biggest relative move on the weakest
  evidence. If any pool overshoots, expect it to be this one, and that is an acceptable outcome:
  overshooting produces the ceiling observation we do not currently have anywhere.
