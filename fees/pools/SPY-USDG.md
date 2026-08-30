# SPY/USDG

**State: baseline frozen 2026-08-30, fee change shipping.** Re-measure 1 to 2 days after the change
and fill in the "after" column in section 1. The cross-asset frozen state is
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md); method in [README.md](README.md).

Fees in pips: 100 pips = 1 bps. Hook `0xA0E8fBFf13E24Af2b5e61A72800E08a161bDe080`, cap 8,000,
pokeFloor 250, `protocolFee = 0`.

---

## 1. The change, and the scoreboard to fill in

**CORRECTED 2026-08-30 evening.** Overnight cut from 500 to 450: the 500 was priced off a revenue
index that measured dollars contradict (section 4).

| tier | was | **shipping** | market | after (fill in) |
|---|---|---|---|---|
| OPEN | 528 realised | **550** | 1,282 | |
| OVERNIGHT | 350 | **450** (was 500) | 1,260 | |
| CLOSED | 250 | **400** | 1,079 | |

"528 realised" blends two configurations: roughly 490 pips Monday to Thursday and 673 on Friday
2026-08-28. No Fables pool held one regime across the window.

| metric, 167h field benchmark | baseline 2026-08-30 | expected | after (fill in) |
|---|---|---|---|
| our fee vs market, all | 0.26x | 0.33 to 0.40x | |
| our APR vs market, all | **0.30x** | 0.38 to 0.48x | |
| our volume share | 8.76% | 7.5 to 9.5% | |
| **break-even share, closed** | | **6.46%** | |
| **break-even share, overnight** | | **7.06%** | |

Share is the pre-registered test, not revenue: revenue is exposed to market-volume drift, share is a
ratio and is not. Falsified if closed share falls below 6.46% or overnight below 7.06%.

---

## 2. Why: the field numbers, frozen

Measured against the volume-weighted whole field, 167 hours, 9 venues, 5 cash sessions.

| session | hrs | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | $59,984,468 | 1,167 | 304 | **0.26x** | 59.3% | 18.0% | **0.30x** | 8.76% |
| OPEN | 35 | $12,164,865 | 1,282 | 528 | 0.41x | 63.1% | 14.4% | 0.23x | 4.15% |
| OVERNIGHT | 77 | $15,580,774 | 1,260 | 350 | 0.28x | 36.3% | 12.1% | 0.33x | 9.08% |
| CLOSED | 55 | $32,238,829 | 1,079 | 250 | 0.23x | 89.2% | 28.6% | 0.32x | 10.34% |

We hold **9.0% of the asset's TVL and take 8.76% of its volume**, so flow is not the problem. We
take **2.3% of the fees**, because we charge a quarter of what the market charges. The fee is the
entire gap.

Only **1.0%** of chain SPY volume trades cheaper than us over the 48h scan. We are the cheap venue
in a market that is not cheap: 21.2% of volume pays 3,000+ pips, and 37.2% does in the session.

## 3. The 48h chain scan, 206,361 swaps across all 8 venues

| pool | TVL | fee | LP keeps | 48h vol | APR t-w |
|---|---|---|---|---|---|
| **Fables, dynamic** | 464,072 | 250 to 800 | **100%** | $3,727,531 | **99.3%** |
| v4 625 | 507,842 | 625 | 80% | $5,712,877 | 143.3% |
| v4 3499 | 3,335,330 | 3,499 | 85.7% | $7,473,325 | 89.2% |
| v3 500 | 79,620 | 500 | 75% | $723,839 | 66.4% |
| v3 3000 | 23,949 | 3,000 | 83.3% | $20,285 | 37.4% |
| v4 75 | 10,905 | 75 | 100% | $343,219 | 43.1% |
| v4 10000 dyn | 26,347 | 5,000 to 91,641 | 100% | $29,359 | 670.8% |
| v3 WETH/SPY 500 | 718,458 | 500 | 75% | $17,389,941 | 563.6% |

**Depth per dollar, k, on the window-median basis: ours 34.2, rank 7 of 8**, field 8.0 to 330.6.
The figure of 158.5 quoted this afternoon was a single point reading taken during a 4.66x depth
spike, and "we are mid-field, not shallow" is withdrawn. On a common basis we are second from the
bottom of the SPY field.

**The APR ranking depends on the denominator.** Our working depth ran $15.9M at the 48h median and
$74.1M in the final hour, a 4.66x spike, and about 80% of the final liquidity was added inside the
window. Dividing a 48h fee integral by an end-of-window TVL therefore penalises the pool that grew
most. Flat TVL puts us 8/8 at 38.6%; time-weighting puts us **4/8 at 99.3%**. Never quote the flat
number while the pool is growing.

## 4. What we know about how our flow responds to price

Rebucketed on the realised fee rounded to 1 pip, with measured dollars beside the inferred index.
The afternoon table was corrupted by a rounding bug that split the 250-pip tier across two buckets,
and its "450" row was five separate single-hour readings between 409 and 471 pips.

| we charge | hours | days | session | our volume | mean share | **$/hour** | index |
|---|---|---|---|---|---|---|---|
| 250 | 38 | 3 | all CLOSED | $3,314,735 | 12.18% | **$21.81** | 3,046 |
| 350 | 77 | 5 | all OVERNIGHT | $1,414,994 | 9.15% | $6.43 | 3,203 |
| 409 to 471 | 5 | 1 | all OPEN | $143,910 | 7.7% | $12.92 | 1,245 to 6,086 |
| 500 | 24 | 4 | all OPEN | $288,502 | 4.94% | $6.01 | 2,468 |
| 800 | 6 | **1** | all OPEN | $72,368 | 1.85% | **$9.65** | 1,479 |

**The claim that revenue peaks at 450 is withdrawn: it was an index artefact.** On measured dollars
the 800-pip session hours earned $9.65/h against $6.01/h at 500, ranking them the opposite way to
the index. Both readings are thin (6 hours on one day against 24 hours on four), so the honest
statement is that SPY's session optimum is **unknown**, not that it is 450.

Correlation -0.582 over the 48h scan and -0.363 over 167h. Every observation above 500 pips falls on
Friday 2026-08-28, which is also the only cash session in the 48h scan, so the two windows are not
independent evidence at the top of the curve.

## 4b. The binding constraint is depth

`scripts/diagnose.py`. The comparison that settles it, SPY OPEN over 167h:

| | TVL | k | fee | share | turnover |
|---|---|---|---|---|---|
| v4 625 | $507,842 | **178.1** | **625** | **41.6%** | 10.0 |
| **Fables** | **$464,072** | **34.3** | 528 | **4.1%** | **1.1** |

A pool of essentially identical size **charges 18% more than we do and takes ten times our flow**. In
closed hours it charges 2.5x our price and still takes 1.8x our flow. Flow is not being bought with
our discount, so raising to their price would not move us toward their share.

Same capital, **a fifth of the quoting depth**. Concentrating from k 34.3 toward 178 would 5x our
depth with zero new capital, and our share tracks our depth share almost exactly (2.03% of session
depth, 4.15% of session volume).

Also: the 1,167-pip field fee is **not a price we can charge**. It is inflated by the v4 3499 pool,
$3.34M of TVL quoting $1.1bn of depth. The venues at our size charge 500 to 625, so that is the
realistic ceiling, not 1,167.

Ranked fixes: **concentration first (5.7x, free), then the WETH pair (unlocks half the market), then
price (worth about 1.3x).**

LP efficiency: our 18.0% APR against a field of 59.3%, **0.30x, rank 8 of 8**.

## 5. Structural facts, independent of the fee

- **Half the market is unreachable.** 49.1% of chain SPY volume over 48h routed through
  v3 WETH/SPY, 52.1% in closed hours. We do not quote that pair. No fee reaches it.
- **A two-hop route caps price-sensitive flow at ~600 pips**: USDG to WETH at 100, WETH to SPY at
  500. But it does not cap the market, since 37.2% of session volume pays 3,000+. Depth commands
  price and that flow is not shopping.
- **In session, share tracks depth share exactly**: 2.32% volume on 2.03% depth. In closed hours we
  buy 9.2x our depth share with a 77% discount and net 0.32x the market APR. Discounting converts
  depth into share at a bad rate.
- **The pool held its anchor** through the GLD weekend: median absolute deviation 0.36% from the
  Friday close of $769.35, maximum 0.74%, rivals within cents. A 3% deviation kicker would not have
  fired.

## 6. Interaction with the deviation fee

See [../deviation/DEVIATION-FEE.md](../deviation/DEVIATION-FEE.md).

- **`RHSPY / USD` is live during market hours**, so SPY is effectively Mode A in-session. Adverse
  selection is concentrated in the minutes after the reference moves, which means the deviation term
  can carry the pickoff insurance and let the session base sit where flow wants it. That matters more
  now than it did this afternoon: with the revenue peak withdrawn, we do not know where the session
  base should sit, and a deviation term makes a lower base safe to test.
- **The 600-pip hop ceiling bounds the calendar base, not the deviation ramp.** Dislocation flow
  cannot route around us: to capture our mispricing the arb must trade our pool. Cap the base,
  leave the ramp free to the 8,000 hook cap.
- **The document's proposed SPY base of 3,000 pips is depth-conditional.** The v4 3499 pool
  sustains 18.6 to 24.4% share at 3,499, but on $662.9M of working depth against our $15.8M, 42x
  more. We have no measured peak to set against it: the only observation above 500 pips is six hours
  of one Friday, and it earned MORE per hour than the 500-pip hours did. So the honest position is
  that 3,000 is unproven rather than refuted, and the way to settle it is a poke test.
- **Our closed tier at 250 is the same shape as the hole that cost GLD its book**, but sized much
  smaller: SPY's weekend gap p99 is 2.40% against gold's 6.05%, and the pool did not move. Raising
  closed to 400 is both the revenue move and the safety move.

## 7. What this does not settle

- **Why session flow does not come to us even when we are the cheaper quote.** Highest-value open
  question; it gates any share gain.
- **The elasticity is observational**, confounded with session, thin at the top. The shipping change
  is the experiment that fixes this.
- **One cash session** in the chain scan, Friday 2026-08-28. Depth, k and utilisation rest on it.
- **The window sits inside the points programme**, live since 2026-08-24 and paying on fees.
- **Whether 450 in-session clears true break-even.** 759 pips is a naive-LVR upper bound, not a
  measurement. Per-window markouts settle it and remain open item 1 in `FEE-POSITION.md`.

## 8. Revision history

| date | state | headline |
|---|---|---|
| 2026-08-30 am | first pass, single-rival benchmark | "8/8 on fee APR, we underprice and are structurally shallow" |
| 2026-08-30 pm | **corrected to a whole-field benchmark** | benchmarking against one rival was wrong. Against the field: 0.26x market fee, 0.30x market APR. The 600-pip ceiling claim was overstated, and rank moved to 4/8 once the TVL denominator was time-weighted |
| 2026-08-30 pm | **widened to 167h / 5 sessions** | conclusions stable on SPY across both windows. Overnight identified as the largest and most discounted block, 77 of 167 hours |
| 2026-08-30 pm | baseline frozen, change proposed | 550 / 500 / 400 |
| 2026-08-30 eve | **dual review, five blocking errors, change revised** | **550 / 450 / 400**. The k of 158.5 was a point reading during a 4.66x depth spike, so on a common basis SPY is 34.2 and ranks 7 of 8. The revenue peak at 450 was an index artefact that measured dollars contradict |
