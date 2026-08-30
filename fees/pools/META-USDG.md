# META/USDG

**State: baseline frozen 2026-08-30, fee change shipping.** Cross-asset frozen state in
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md). Fees in pips. `protocolFee = 0`, cap 8,000,
pokeFloor 250.

## 1. The change, and the scoreboard to fill in

**CORRECTED 2026-08-30 evening. The raise is cut from 900/800/700 to 500/500/450** because the
elasticity behind the larger number turned out to be incoherent: see section 3.

**FINAL 31 Aug: META closed is the only fee change shipping anywhere.** Live on chain META is
**900 / 750 / 250**. The proposed 500 / 500 was a **44% and 33% cut**, not a raise: the 167h window is
80% pre-change and its realised 579 / 361 describes the config replaced on 28 August.

It ships because META is the **one pool where our own diagnosis says price is the binding constraint**
(share 2.57x depth share, k rank 3 of 5), and because it is therefore the clean place to measure the
demand curve we have failed to identify five times from observational data.

**Ship it as one `setPoolConfig` and nothing else.** An earlier revision of this file proposed pairing
it with a randomised `pokeFee` schedule to identify the demand curve. **That is withdrawn.** `pokeFee`
restates the whole poke and the last write wins, so a randomiser would collide with the deviation
keeper, which is real LP protection on a Mode B pool with a 4.12% weekend gap p99. Building a research
apparatus that fights a safety mechanism, on a tier earning **$29.43 a week**, to sharpen a parameter
feeding decisions worth $679 a week at best, is not a trade worth making. Caught by Yanis, 31 Aug.

The step change is the observation. It is confounded, and at this size the precision does not matter:
if share holds above the 7.12% break-even it worked, if it collapses, revert.

| tier | **live on chain** | realised in window | **shipping** | market | vs live |
|---|---|---|---|---|---|
| OPEN | **900** | 579 | **held, was 500** | 2,659 | 0.34x |
| OVERNIGHT | **750** | 361 | **held, was 500** | 2,989 | 0.25x |
| CLOSED | **250** | 250 | **450** | 3,033 | **0.08x** |

The closed tier did not change on 28 August, so the window's evidence applies to it and it carries the
deepest discount on the board. The two open tiers now need a window containing the current config
before anything moves, and to break even a cut would need share to rise 80% and 50% respectively.

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

## 3b. The binding constraint is price, and depth is fine

`scripts/diagnose.py`. Volume share **8.23%** against depth share **3.20%**, a ratio of **2.57**: we
out-punch our depth by two and a half times, and k at 33.2 ranks 3 of 5. **Depth is not the ceiling
on META.**

The clinching comparison is `v3 WETH/META 3000`: **half our TVL, identical k at 32.9, charging 9x our
fee, and taking 88% of our share.** We give away a 9x discount to win 14% more flow than a pool that
does not bother.

This is the one asset where the naive "just raise the fee" answer is close to right, and it is also
the one whose demand curve came back sloping up, which is why the raise was cut. That tension is
unresolved and it is the sharpest one in the set.

Reach matters too: **43% of META flow is the SPY/META cross**, a pair we do not quote.

LP efficiency: our 21.5% APR against a field of 181.2%, **0.12x, rank 4 of 4**. The worst ratio of any
pool where we hold real capital.

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
