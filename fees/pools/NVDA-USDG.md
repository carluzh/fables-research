# NVDA/USDG

**State: baseline frozen 2026-08-30, fee change shipping.** Cross-asset frozen state in
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md); method in [README.md](README.md).
Fees in pips. `protocolFee = 0`, cap 8,000, pokeFloor 300.

## 1. The change, and the scoreboard to fill in

**CORRECTED 2026-08-30 evening.** The market fee this raise was sized against was 33% composed of
two venues dead for most of the window. Excluding them the field is much cheaper and the overnight
raise is cut from 800 to 550.

| tier | was | **shipping** | market (as published) | **market (live venues only)** |
|---|---|---|---|---|
| OPEN | 1,377 realised | **hold** | 673 | **584** |
| OVERNIGHT | 417 | **550** (was 800) | 1,091 | **605** |
| CLOSED | 300 | **450** (was 500) | 574 | 574 |

At 800 pips the overnight tier would have been **1.32x the live market**, not a discount. The two
excluded venues (0x3d4db2a4, 0x1bdf79ca) are 4.0% of NVDA volume and **32.7% of field fees**,
realising 6,688 and 8,213 pips, and last traded 70 and 115 hours before the window closed.

| metric, 167h field benchmark | baseline | expected | after (fill in) |
|---|---|---|---|
| our fee vs market, all | **1.09x** (0.76x as published) | 1.2 to 1.4x | |
| our APR vs market, all | **0.78x** (0.48x as published) | 0.85 to 1.0x | |
| our volume share | 0.21% | 0.20 to 0.26% | |
| break-even share, overnight | **0.197%** | | |
| break-even share, closed | **0.133%** | | |

Share is the pre-registered test, not revenue: revenue is exposed to market-volume drift we cannot
measure, share is a ratio and is not. Falsified if overnight share falls below 0.197% or closed
below 0.133%.

**The session tier is deliberately untouched.** On the corrected field it earns **1.19x** the market
APR, the only tier on any Fables pool that is above the field rather than below it.

## 2. Why: the field numbers, frozen

167 hours, 19 venues, 5 cash sessions.

| session | hrs | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | $236,480,957 | **592** (845) | 643 | **1.09x** (0.76x) | **70.3%** (113.4%) | 54.5% | **0.78x** (0.48x) | 0.21% |
| OPEN | 35 | $86,700,772 | **584** (673) | 1,377 | 2.36x (2.05x) | **120.4%** (150.3%) | 143.2% | **1.19x** (0.95x) | 0.15% |
| OVERNIGHT | 77 | $107,212,624 | **605** (1,091) | 417 | **0.69x** (0.38x) | **70.0%** (150.1%) | 43.3% | 0.62x (0.29x) | 0.26% |
| CLOSED | 55 | $42,567,561 | 574 | 300 | 0.52x | 38.7% | 13.6% | 0.35x | 0.20% |

Live venues only, with the as-published figures in brackets. **The session tier is above market, not
at parity: 1.19x the field APR once the dead venues are removed.** That is the strongest reason to
leave it alone.

NVDA is the largest equity market we touch, $236M a week, and we hold **0.21% of it on 0.4% of the
TVL**. We are not in this market in any meaningful sense.

## 3. The 48h chain scan, 14 venues

The incumbent `v3 500` did **$46.4M on 186,038 swaps** at a flat 500 pips and holds 81 to 89% of
flow in every session. We did **$91,448 on 815 swaps**.

**Concentration.** On the window-median basis, **our k is 22.6, rank 9 of 12**, in a field spanning 4.4 to 2,018.8.
Three rivals are shallower than us: v4 3499 at 12.2, v4 375 at 20.4, v4 475 at 4.4.

An earlier version claimed our dollar quotes half the depth anyone else's does, against a field of
47.7 to 53.5. That was three hand-picked venues and it is withdrawn. It also compared against SPY's
k of 158.5, a point reading taken during a 4.66x depth spike: on the common median basis SPY is
**34.2 and ranks 7 of 8** in its own field, so both pools sit low, not just this one.

The comparison that does survive: v4 WETH 1193 has 1.5x our TVL, 3.6x our working depth and **9x our
share**, while charging 1.5x our price.

**A near-free venue exists and belongs in the benchmark:** `v4 0 dyn USDG` realised **9 pips on
$1.68M**, all in closed hours, on a claimed $74.9M of virtual depth. k = 2,019 is implausible and
is probably a single-tick range rather than absorbable depth, which is a caution about using depth
alone as a screen for whether a venue is a real alternative.

**Two venues that look alive weekly are dead.** The WETH/NVDA v4 dynamic pools showed $7.9M and
$1.5M over 7 days and did **zero** swaps in the last 48 hours. Any APR quoted for them off weekly
buckets is fiction.

## 4. How our flow responds to price

Rebucketed on the realised fee rounded to 1 pip, over 167 hours. The afternoon table was corrupted
by a rounding bug that split single tiers across buckets. Measured dollars sit beside the inferred
index because the two disagree in sign.

| we charge | hours | days | session | our volume | mean share | **$/hour** | index |
|---|---|---|---|---|---|---|---|
| 300 | 55 | 4 | all CLOSED | $86,909 | 0.27% | $0.47 | 82 |
| 400 | 64 | 4 | all OVERNIGHT | $232,331 | 0.22% | $1.45 | 87 |
| 700 | 12 | 4 | all OPEN | $25,724 | 0.13% | $1.50 | 93 |
| 1,000 to 2,665 | 14 | **1** | all OPEN | $71,320 | 0.13% | $10.34 | 113 to 369 |

**The "cleanest elasticity reading" claim is withdrawn: it was exactly backwards.** NVDA charged
300 pips in all 41 CLOSED hours and every fee above 1,000 fell in the 7 OPEN hours, so the fee is
perfectly collinear with the session and the -0.060 correlation measures the session, not the price.
The fee also ramps down through the cash session every day (09:00 ET 2,212 to 2,665 pips, 12:00 ET
700, 15:00 ET 837 to 1,277), so the high-fee hours are the highest-flow hours: a near-zero
correlation under that design is a real price effect cancelling an hour-of-day confound, not
evidence that flow is price-insensitive.

The comparable SPY figure over the same 48h window is **-0.582**, not the -0.363 quoted earlier,
which is a 167h number. **GLD** is the only pool in the set with genuine within-session fee variation
and therefore the only clean elasticity observation we have anywhere.

## 5. What this does not settle

- **A claim made and withdrawn on 2026-08-30.** From the 48h scan, NVDA's session looked like
  **1.46x** the market APR. Across five sessions it is **0.95x**. The outperformance was one
  session, Friday 2026-08-28. This is the reason the 167h benchmark exists and why no session
  conclusion should ever be drawn from the chain scan alone.
- **Why price does not move share.** Either we are below the threshold of router relevance at 0.4%
  of TVL, or we are not in the routing set at all. Untested, and it decides whether NVDA deserves
  capital.
- **Whether raising k is achievable.** 22.6 to ~50 would double quoting depth with no new capital,
  but we have not established what holds the ranges wide.
