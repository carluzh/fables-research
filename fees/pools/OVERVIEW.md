# Where Fables sits, on nine pools, against the whole field


> **STOP, 2026-08-30 late: the shipping table below must not be executed as written.** Its
> "realised now" column is a week-long blend, not the live config. A `setPoolConfig` landed
> 2026-08-28 04:41-04:44 UTC on SPY, NVDA, META and GLD, so four of the eight tier moves are
> cuts that reverse it. Corrected table, chain-verified config history and the three calls to
> execute: [LADDER-CORRECTION.md](LADDER-CORRECTION.md).

The one page. Read this and you have the map; everything under it is detail.

**The question every document in this folder answers:** measured against the volume-weighted whole
field of every venue on Robinhood Chain trading that asset, not against a chosen rival, where does
the Fables pool sit on price and on LP yield, and what should change.

Fees in pips: 100 pips = 1 bps = 0.01%. All APR is LP-net, after the protocol fee each venue pays.
Chain id 4663. Sessions in ET: OPEN 09:00 to 16:00 weekdays, CLOSED Friday 16:00 onward plus the
weekend, OVERNIGHT everything else.

- Method and the two windows: [README.md](README.md)
- The frozen "before" record and the diff target: [BASELINE-2026-08-30.md](BASELINE-2026-08-30.md)
- Evidence: `Research/Fables/fee-rerun-2026-08-30/baseline-2026-08-30/`

---

## 1. The nine pools, 167 hours, every venue on chain

Window: **167 hourly buckets, 2026-08-23T11:00Z to 2026-08-30T09:00Z inclusive**, census fetched
2026-08-30T10:47:35Z. Session composition OPEN 35h / OVERNIGHT 77h / CLOSED 55h, covering **5 cash
sessions and 4 closed blocks**. All ALL-session rows. Source `universe7d.txt`, reproduced
independently from `census.json` and `protofee.json`.

| pool | venues w/ vol | field 167h volume | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our vol share | our TVL (share) | our 167h fees |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [SPY/USDG](SPY-USDG.md) | 9 | $59,984,468 | 1,167 | 304 | **0.26x** | 59.3% | 18.0% | **0.30x** | 8.76% | $464,072 (9.0%) | $1,596.22 |
| [NVDA/USDG](NVDA-USDG.md) | 19 | $236,480,957 | 845 | 643 | 0.76x | 113.4% | 54.5% | 0.48x | 0.21% | $30,511 (0.4%) | $316.81 |
| [META/USDG](META-USDG.md) | 7 | $1,725,143 | 2,933 | 396 | **0.14x** | 181.2% | 21.5% | **0.12x** | 15.70% | $26,148 (20.7%) | $107.30 |
| [GLD/USDG](GLD-USDG.md) | 20 | $31,812,152 | 3,937 | 1,135 | 0.29x | 1683.4% | 1141.3% | 0.68x | 20.73% | $34,391 (10.4%) | $7,482.77 |
| [ETH/USDG](ETH-USDG.md) | 15 | $1,358,385,815 | 144 | 776 | **5.37x** | 44.6% | 27.8% | 0.62x | 0.52% | $1,042,590 (5.9%) | $5,532.06 |
| [TSLA/USDG](TSLA-USDG.md) | 10 | $3,933,630 | 3,299 | 832 | 0.25x | 142.2%\* | 11.5% | 0.08x\* | 0.15% | $2,260 (0.5%) | $4.95 |
| [AAPL/USDG](AAPL-USDG.md) | 13 | $12,131,145 | 1,377 | 335 | 0.24x | 110.3%\* | 22.4% | 0.20x\* | 0.45% | $4,259 (0.5%) | $18.17 |
| [NVDA/SPY](NVDA-SPY.md) | 3 | $4,031,108 | 620 | 390 | 0.63x | 49.8%\* | 2.7% | 0.05x\* | 0.14% | $4,395 (1.7%) | $2.25 |
| [SPY/GLD](SPY-GLD.md) | 1 | $3,828 | 346 | 346 | 1.00x† | 6.5% | 6.5% | 1.00x† | 100.00%† | $1,073 (100%†) | $1.33 |

The whole book: **$1,609,701 of TVL, $19,809,393 of volume and $15,061.85 of fees over the week**
(`census.json`). GLD and ETH are 86% of the fees. The four small pools are $11,987 of TVL and
$26.70 of fees between them.

\* **Charged-basis, not LP-net.** `protofee.json` holds protocol-fee reads for 50 of the 138 census
pools, and `universe7d.py` defaults an unread pool to a 100% LP keep. Coverage by volume is 100.0%
SPY, 99.9% NVDA, 97.6% META, 98.2% GLD, 100.0% ETH, but **0.2% TSLA, 0.4% AAPL and 0.1% NVDA/SPY**,
where the only read venue is our own pool. Those three market APRs assume every rival keeps
everything, so they are overstated and our ratio is understated by roughly the rival haircut.

† **Degenerate, not a win.** We are the only venue on chain quoting SPY/GLD, so the "market" column
is our own column copied across and every ratio is an identity. `universe7d.txt` prints this row as
`GLD/SPY`. Do not read it as a rank. See [SPY-GLD.md](SPY-GLD.md) section 1.

**Three caveats attach to the two APR columns and none is small.**

1. **Every APR divides a week of fees by one TVL snapshot.** `universe7d.py` uses `p['tvlUsd']`, a
   single instantaneous read, as the denominator for a 167-hour fee integral. This is the exact
   error [README.md](README.md) section 4 forbids. `now.json` records 24-hour TVL changes of
   **+328.1% (F-NVSP), +162.3% (F-SPY), +74.7% (F-ETH), +49.3% (rival NVDA v3 500), +36.3% (rival
   SPY v4 3499), -69.3% (F-GLD)**. `REPRO-NOTES.md` gives a three-day read on the same pools: SPY
   TVL 138,049 to 449,560 (3.26x), ETH 282,628 to 1,040,994 (3.68x), META 24,866 to 26,139 (1.05x),
   NVDA 42,676 to 30,506 (0.71x), GLD 64,127 to 33,227 (0.52x). So SPY's 18.0% and ETH's 27.8% are
   understated, NVDA's 54.5% and GLD's 1141.3% are overstated, and the APR column is not apples to
   apples across assets. There is no 167h TVL series in the frozen data, so there is no exact fix.
   **The fee, volume and share columns are unaffected.**
2. **NVDA's market fee is a third composed of two dead venues.** Two WETH/NVDA v4 dynamic pools
   contribute $65,423 of NVDA's $199,853 of field fees (32.7%) on 4.0% of the volume, realising
   6,688 and 8,213 pips. One last traded 2026-08-27T12:00Z, the other 2026-08-25T15:00Z, and both
   did zero swaps in the last 48 hours. Removing them: **market fee 845 to 592 (our ratio 0.76x to
   1.09x, above market), overnight 1,091 to 605 (0.38x to 0.69x), market APR 113.4% to 70.3% (our
   ratio 0.48x to 0.78x), open APR 150.3% to 120.4% so the "0.95x parity" session becomes 1.19x,
   above market**. CLOSED is unaffected at 574 because neither pool traded in closed hours.
   Recomputed from `census.json`. Both numbers are true; the live one is the one a pricing decision
   should use.
3. **The crosses are benchmarked against the same pair only.** `universe7d.py` routes a two-non-quote
   pair to its own field, so the SPY/META cross ($2,044,007 over 167h) sits outside the META field
   even though it is larger than the entire $1,725,143 "META market", and the SPY/NVDA cross
   ($4,031,108) sits outside NVDA's. The 48h chain scans include them. Adding the SPY/META cross to
   META's field: volume $3,769,150, market fee 1,679 pips, our share 7.19%.

---

---

## 1b. LP efficiency: where we actually rank

`scripts/lprank.py`. Rank is our position on LP-net APR among every venue on chain trading the same
asset, 167h, two dead NVDA venues excluded, floors on TVL so a micro-pool cannot take the top slot.

| asset | our APR | field APR | ratio | rank, TVL over $10k |
|---|---|---|---|---|
| SPY | 18.0% | 59.3% | 0.30x | **8 of 8** |
| NVDA | 54.5% | 70.3% | 0.78x | 8 of 13 |
| META | 21.5% | 181.2% | **0.12x** | **4 of 4** |
| GLD | 1,141.3% | 1,683.4% | 0.68x | 3 of 5 |
| ETH | 27.8% | 44.6% | 0.62x | 6 of 14 |
| TSLA | 11.5% | 142.2% | **0.08x** | 5 of 6 |
| AAPL | 22.4% | 110.3% | 0.20x | 7 of 11 |
| NVDA/SPY | 2.7% | 49.8% | **0.05x** | **3 of 3** |
| GLD/SPY | 6.5% | 6.5% | 1.00x | 1 of 1, the only venue |

**We are last in our field on SPY, META and NVDA/SPY, and first nowhere except a pool where we are the
only venue.**

The whole book: **$1,609,701 of TVL earning $15,061.85 a week LP-net, a blended 49.1% APR**, against a
rival book of $31.1M at 74.4%. Field 73.1%, so **our ratio is 0.67x**.

That flatters us. Half our fee income is one dislocating pool:

| pool | LP-net fees, 167h | share of our income | TVL | APR |
|---|---|---|---|---|
| GLD | $7,482.77 | **49.7%** | $34,391 | 1,141.3% |
| ETH | $5,532.06 | 36.7% | $1,042,590 | 27.8% |
| SPY | $1,596.22 | 10.6% | $464,072 | 18.0% |
| NVDA | $316.81 | 2.1% | $30,511 | 54.5% |
| META | $107.30 | 0.7% | $26,148 | 21.5% |
| AAPL, TSLA, crosses | $26.70 | 0.2% | $11,987 | 2.7 to 22.4% |

GLD is **2.1% of our TVL producing half our revenue**, entirely because it is mispriced against its
anchor and being arbitraged. **Strip it and the book earns 25.2% against a field of 72.0%: 0.35x.**

Two caveats. APR divides a week of fees by one end-of-window TVL snapshot and our TVL moved more than
anyone's, so these ranks are if anything understated. And the "best in field" is often a thin pool:
at a $50k floor SPY is 5 of 5 rather than 8 of 8, the same answer with less noise.

## 2. The pattern, and the pool that breaks it

**We charge a fraction of what the market charges, on eight of nine pools, and we earn a fraction of
the field's APR for it.** Fee ratios run 0.14x (META) to 0.76x (NVDA, or 1.09x on live venues only).
APR ratios run 0.05x to 0.68x. Not one pool with a real field earns market APR.

**Our volume share never exceeds our TVL share on any equity USDG pool, no matter how deep the
discount.** Share divided by TVL share: SPY 0.97x, AAPL 0.89x, META 0.76x, NVDA 0.53x, TSLA 0.30x.
The fee ratio across those five ranges 0.14x to 0.76x of market, a factor of five, and the share
response to it is not visible in this data. We are buying share with capital, not with price.
MEASURED, but observational: the fee was never randomised.

**ETH is the pool that breaks it, and it lands in the same place.** We charge **5.37x the market fee
overall and 10.21x in session**, against a field that clears at 144 pips because `v3 WETH/USDG 100`
alone does $1,222,733,387 a week (90.0% of the field) at 100 pips on 13.3M lifetime transactions.
We hold **0.52% of the flow on 5.9% of the TVL**, share over TVL share of **0.09x**, and still earn
only **0.62x the market APR**. The opposite error produces the same outcome.

That is the finding in one line: **at 0.14x to 0.76x of market we did not buy share above our
capital, and at 5.37x we clearly lost it. Between those two ends the price response is unidentified,
which is the entire reason the fee change is worth shipping.**

Two secondary patterns worth carrying:

- **The discount is deepest in the largest block of hours.** OVERNIGHT is 77 of 167 hours, 46% of
  the week, and it is where the equity fee ratios bottom out: META 0.12x, GLD 0.15x, AAPL 0.25x,
  SPY 0.28x, NVDA 0.38x (0.69x ex-dead venues).
- **Every field is dominated by one venue.** Top venue by 167h volume: NVDA `v3 USDG/NVDA 500`
  89.5%, ETH `v3 WETH/USDG 100` 90.0%, SPY/NVDA cross `v4 625` 96.5%, TSLA `v4 3499` 63.9%, META
  `v4 3499` 56.8%, AAPL `v3 500` 46.1%, SPY `v3 WETH/SPY 500` 37.5%, GLD `v3 3000` 34.4%. The whole
  field is still the right benchmark, but on six of eight it is close to one rival plus a tail.

---

---

## 2b. Why each pool underperforms, and it is not the same reason

`scripts/diagnose.py` splits the gap three ways. APR is turnover times fee, so a pool falls behind
its field for exactly one of three reasons: **PRICE**, we charge less than the field for the flow we
win; **DEPTH**, our capital quotes less depth than theirs so we win less flow per dollar; or **REACH**,
the flow is in a pair we do not quote at all. The tell is volume share against **depth share**. A pool
that wins its depth share is depth-constrained. One that wins more is buying flow with price. One that
wins less has depth that is not converting.

| asset | share ÷ depth share | k, rank in field | binding constraint |
|---|---|---|---|
| SPY | out-punches, but k 34.3 against 178.1 for a same-size rival | 7 of 8 | **DEPTH** |
| NVDA | **1.01** | 9 of 12 | **DEPTH, then scale** |
| META | **2.57** | 3 of 5 | **PRICE** |
| GLD | **0.40** | **1 of 5** | neither: an event |

**SPY.** The v4 625 pool holds $507,842 against our $464,072, charges **18% more**, and takes **41.6%
of session volume against our 4.1%**. Same capital, and it quotes $90.5M of depth against our $15.9M,
so k 178.1 against 34.3. Concentrating would 5x our quoted depth with no new capital. Separately,
**49.1% of SPY volume routes through WETH/SPY**, a pair we do not quote, so half the market is
unreachable at any price.

**NVDA.** Volume share 0.17% against depth share 0.16%: we win exactly what our depth entitles us to.
But we hold 0.38% of the asset's TVL and take 0.17% of its volume, so we under-punch even our capital,
and the incumbent is 197x our size. Doubling k to the incumbent's 48.5 would take us to roughly 0.35%
share. **This is a scale problem wearing a depth problem's clothes.** Reach is not the issue: only
11.4% of NVDA flow is in pairs we do not quote.

**META.** Share 8.23% against depth share 3.20%, and k ranks 3 of 5. Depth is fine. The clinching row
is `v3 WETH/META 3000`: **half our TVL, identical k at 32.9, charging 9x our fee, taking 88% of our
share.** We are giving away a 9x discount to win 14% more flow than a pool that does not bother. This
is the one asset where the naive "just raise the fee" answer is close to right, and it is also the one
whose demand curve came back sloping up, which is the sharpest unresolved tension in this set. 43% of
META flow is the SPY/META cross, which we do not quote.

**GLD.** Share 20.4% against depth share **50.5%**, and k of 32.7 is **first in the field** against
rivals running near-full-range at 1.1 to 5.7. We hold half the field's quoting depth and take a fifth
of its flow. That is not a depth failure, it is a sign that this week's GLD flow is not router flow at
all: it is arbitrage against a pool mispriced by roughly 181%, and an arbitrageur does not shop for
depth. **These numbers describe an incident, not a business.** The action on GLD is the deviation
keeper, not a fee tier and not a range.

## 3. What is shipping and what is held

**FINAL 31 Aug. One tier ships.**

| move | live on chain | to | vs market | why |
|---|---|---|---|---|
| **META closed** | **250** | **450** | **0.08x** | the only pool where price is the binding constraint |

Everything else is held. Two decisions from 31 August drive this. **k is not ours to set**, which
withdraws the SPY concentration lever rather than deferring it, and leaves SPY depth-constrained with
no direct lever. And **ETH is handed to a separate workstream**, whose direction has since been
measured: **not a cut.** See [ETH-USDG-CORRECTION.md](ETH-USDG-CORRECTION.md).

| pool | state | reason |
|---|---|---|
| SPY | held | the two unchanged-tier raises are worth $642/wk against a $3,651/wk gap; the binding constraint is depth and it is not ours |
| NVDA | held | already above market on the live config; the closed raise is worth $13/wk; the constraint is scale, 197x |
| GLD | held | an event. One open decision on the closed floor |
| ETH | handed off | separate workstream. Largest single line in the gap at $3,331/wk. No longer the least measured: see [ETH-USDG-CORRECTION.md](ETH-USDG-CORRECTION.md) |
| TSLA, AAPL, crosses | held | $26.70 of fees between them for the week |

The four cuts proposed on 30 August (SPY open, NVDA overnight, META open and overnight) were
reversals of a config that landed on 28 August, written as raises because the measurement window is
80% pre-change. They are held pending a window that contains the current config.

**There is no valid control pool, and BASELINE section 2 now says so.** This section reached that
conclusion independently and it was right; drift is measured from each asset's own field instead, with
re-basing triggered if a market fee moves more than 20% relative between runs.

- **GLD's own configuration changed inside the frozen window.** `setPoolConfig` (3000 / 3000 / 6000,
  cap 15,000) fired Saturday 2026-08-29 at 19:19 UTC, roughly 14 hours before the window's last
  bucket (`GLD-DEVIATION-FEE.md` section 1). Per-day realised fees confirm it: OPEN ran 484 to 498
  pips Monday to Thursday then 1,500 on Friday; CLOSED ran 300 Friday, 1,185 Saturday, 6,000 Sunday.
  A pool whose live config is now 3000/3000/6000 against a baseline realised 1,065 / 392 / 1,207
  will move 2.8x and 7.7x with no market change at all. **Use GLD as a control on volume and share
  only, never on fee or APR.**
- **ETH's fee moves on its own.** It is set by an LVR keeper, `f = round(0.40 * sigma_annual_pct^2)`
  clamped to [450, 3000] (`keeper-src/part1.txt`, `min_fee` 450 and `max_fee` 3000), so its realised
  fee tracks volatility, not a config we froze.
- **SPY, META and NVDA also changed regime inside the window.** Friday 2026-08-28 is the only day
  running the current OPEN configuration: SPY OPEN 492 / 491 / 488 / 489 Monday to Thursday then
  **673** Friday; META 500 / 490 / 482 / 494 then **900**; NVDA OVERNIGHT 407 / 411 / 400 / 407 then
  **765**. So every "realised now" number blends two configurations, and the 48h chain scan's single
  cash session is that same Friday. The 48h and 167h windows are **not** independent evidence at the
  top of any elasticity curve. AAPL is the one pool that held one regime all week (OPEN 474 to 499,
  OVERNIGHT 350 every night, CLOSED 300 every hour).

---

## 4. What we know, and what we are guessing

**MEASURED, and safe to build on:** market fee, our fee and the ratio between them; our volume share
and TVL share; every dollar of volume and fees; depth, k and utilisation where a 48h scan exists;
protocol-fee reads on all nine Fables pools. All 36 rows of `universe7d.txt` reproduce exactly from
`census.json` plus `protofee.json` through an independent reimplementation. The two data sources
agree: comparing raw Swap events against indexer buckets on overlapping hours, scan-over-census
volume ratios are SPY 1.017, NVDA 1.000, META 1.001, GLD 1.001, ETH 1.009, with no single venue over
1.03.

**INFERRED, and every revenue projection in this folder depends on it: the elasticity.** We never
randomised the fee. We observed it where the calendar put it, so fee is collinear with session, hour
of day and regime. What that actually leaves us with:

| pool | 167h corr(fee, share) | n (hours with volume) | what the variation is |
|---|---|---|---|
| ETH | -0.472 | 167 | keeper-driven, tracks volatility |
| GLD | -0.390 | 140 | **the only genuine within-session variation**: 300 pips for 23 CLOSED hours and 6,000 pips for 19 CLOSED hours |
| SPY | -0.363 | 167 | 250 only ever in CLOSED, 350 only ever in OVERNIGHT, 800 only on one Friday |
| AAPL | -0.229 | 156 | flat calendar ladder, zero within-session variation |
| NVDA | -0.183 | 167 | fee ramps down through the cash session, so high fee = highest-flow hour |
| NVDA/SPY | -0.084 | 125 | flat ladder, no elasticity identifiable even in principle |
| TSLA | -0.075 | 129 | $5,951 of volume all week |
| META | **+0.167** | 132 | share is **highest at the highest fee**: mean 40.30% in the 7 hours at 900 pips against 21.14% in the 37 hours at 250 pips |

Read that table as a warning, not a demand curve. Nothing in it separates a price effect from the
hour of day the calendar attached that price to. META's sign is positive, which supports the raise
on the opposite evidence to a price story. NVDA's near-zero is what you get when a real negative
price effect is offset by a positive hour-of-day confound, not evidence that flow is insensitive.

**GLD is the strongest single observation and the weakest generalisation.** A 20x raise inside one
session type took share from 31.32% to 12.07% and revenue from $1,436.78 in 23 hours to $5,441.10 in
15 hours, **4.24x in dollars and 5.13x per hour** over the 167h window (the revenue *index* rose
9.30x; that is an inferred quantity holding market volume constant, and the two must not be quoted
as one number). But the two fee levels are strictly time-ordered, a hand-run `setPoolConfig` 23
hours into an ongoing dislocation, so 300 pips covers the maximally mispriced phase and 6,000 the
decaying one; and a dislocated pool's arbitrageur has to trade us to capture our own mispricing,
where a normal pool's trader can route away. **Treat the GLD elasticity as an upper bound on how
insensitive flow is elsewhere, never as an estimate of it.**

**The pre-registered predictions in BASELINE section 3 are not all internally consistent.** Revenue
moves as fee times share at constant market volume, so each tier has a break-even share below which
the raise loses money: SPY closed 6.46%, SPY overnight 6.36%, META all-tier 8.06%, NVDA overnight
0.136%, NVDA closed 0.120%. Three rows pair a share band whose floor sits below break-even with a
revenue band that is strictly positive. Prefer **share** as the test when re-measuring: it is a
ratio and therefore immune to market-wide volume drift, which the controls cannot measure.

---

## 5. Structural facts that survive any fee change

Measurements, not inferences. They will still be true after the change lands.

- **We keep 100% of what we charge, and so do some rivals.** All nine Fables pools carry
  `protocolFeeRaw = 0`, verified individually. But **12 of the 41 non-Fables venues with volume and
  a protocol-fee read also keep 100%**, including two in SPY's own field, and the rivals that do pay
  keep **75.0% to 90.9%**, not 75% to 86%. The defensible statement is the volume-weighted one:
  across the read non-Fables field the volume-weighted LP keep is **75.7%**, so comparing charged
  fees flatters the field by about 32% weighted, and by 0% to 33% venue by venue. The advantage is
  real and it is not universal.
- **Roughly a third of the SPY market routes through WETH and we do not quote it.** WETH-quoted
  pools took **37.5% of SPY's 167h volume ($22,484,547 of $59,984,468)**; over the 48h scan
  `v3 WETH/SPY 500` alone took 49.1%, and 52.1% in closed hours. The same measure on the other
  names: AAPL 24.7%, GLD 23.5%, META 17.4%, NVDA 7.8%, TSLA 3.3%. No fee we set reaches any of it.
- **Concentration is uneven across our own pools and it is a range-placement choice, not a hook
  limit.** k = virtual / TVL, sampled at head block 49,928,084 (`kall.json`): SPY 137.9, ETH 44.7,
  AAPL 43.1, META 33.2, NVDA 22.6, TSLA 14.9, GLD 5.1. On the alternative common basis, the 48h
  window median, SPY is 34.3, META 33.2, GLD 32.7, ETH 25.1, NVDA 22.6. **Pick one basis and use it
  for both sides of any comparison**: on the median basis SPY ranks 7 of 8 in its field (9.2 to
  330.6) and NVDA 9 of 12 in its own (4.4 to 2,018.8), with three NVDA rivals shallower than us. The
  earlier claim that our NVDA dollar quotes half the depth of anyone else's is false.
- **Near-free venues exist and must stay in the benchmark.** Over 167 hours: two WETH/USDG v4 pools
  realising **0.0 pips on $1,790,305 and $535,414**; `v4 USDG/NVDA 0 dyn` realising **9.0 pips on
  $1,670,249**; `v4 SPY/USDG 75` at 75 pips on $716,038; `v4 USDG/GLD 95` at 95 pips on $375,533 with
  $78 of TVL. Benchmarking against "the incumbent" writes every one of them out, which is the
  original error this whole method exists to correct.
- **Some venues look alive weekly and are dead daily.** The two WETH/NVDA v4 pools above are the
  case that matters, because they set a third of a market fee a pricing decision was made against.
  Any market fee or market APR taken off weekly buckets needs a last-traded check before it is used.
- **The two windows are not nested.** The 167h census window ends 2026-08-30T09:00Z (last bucket);
  the 48h scans end 11:13Z (SPY), 12:59Z (NVDA), 13:21Z (META and GLD), so they reach 2 to 4 hours
  past it. Visible effect: GLD at 6,000 pips earns $6,088.50 over 19 hours in the 48h scan but
  $5,441.10 over 15 hours in the 167h window that is supposed to contain it. Every 48h scan is also
  83% to 88% closed hours (SPY 40/7/1, NVDA 41/7/0, META and GLD 42/6/0), so every 48h "ALL" figure
  is effectively a weekend figure and holds exactly one cash session.
- **A known undercount on ETH.** Over identical hours the chain scan reads $3,497,026 and $1,087,226
  for the two 0-fee WETH/USDG v4 pools while `census.json` gives $2,057,498 and $622,661, and the
  full 167h census figures ($1,790,305 and $535,414) are *below* the 48h scan. Every other ETH venue
  agrees within 3 to 12%. ETH's whole case rests on bucket data, so its $1.36bn market and 0.52%
  share carry that caveat.
- **Depth does not exist at the 167h horizon, and does not exist at all for ETH's field.** The
  buckets carry no liquidity, and ETH's four largest venues cannot be swap-scanned (13.3M, 1.29M,
  651k and 606k lifetime transactions). The node serves no archive `eth_call`, so depth can only ever
  come from Swap events. Our own ETH pool's depth was measured; the field's was not.
- **Four pools are dust and no ranking computed on them means anything.** TSLA $2,260 of TVL and
  $4.95 of fees, AAPL $4,259 and $18.17, NVDA/SPY $4,395 and $2.25, SPY/GLD $1,073 and $1.33. That
  is $26.70 for the week across the four. Their rows in `universe7d.txt` are honest arithmetic on
  denominators too small to act on.

---

## 6. Open questions, ranked by what they would settle

1. **The elasticity.** Unblocks every revenue projection in this folder. Nothing here identifies a
   demand curve: fee is collinear with session on eight of nine pools, and the only within-session
   variation is GLD's, mid-dislocation and time-ordered. The shipping change on SPY, NVDA and META
   **is** the experiment. Settled by the re-measurement in BASELINE section 6, run 1 to 2 days after
   the change with the same window length and session definitions.
2. **Per-window markouts, so we know whether any tier covers its own adverse selection.** Unblocks
   the cost side entirely, and it is the only thing that can either justify or kill ETH at 5.37x the
   market fee. Open item 1 in [../FEE-POSITION.md](../FEE-POSITION.md). Without it every conclusion
   in this folder is about revenue and silent about profit.
3. **Are we in the router's set at all.** Unblocks every share projection. In the 48h scan's cash
   session 60.5% of SPY volume traded *cheaper* than us, yet across five sessions we took 4.15% of
   the OPEN market on 9.0% of the TVL; on NVDA we hold 0.21% of a $236M market on 0.4% of the TVL.
   Either we are below the threshold of router relevance or we are not in the routing set. This
   decides whether NVDA, TSLA and AAPL deserve capital at all, and it is testable directly rather
   than by inference from share.
4. **A TVL time series.** Unblocks the APR column of the primary table, which today divides a week of
   fees by a snapshot that moved up to +328% in 24 hours. Cheap to fix: record `tvlUsd` per venue
   hourly from the same source that already writes the volume buckets.
5. **Points-programme and routing contamination.** The programme opened 2026-08-24 and pays on fees,
   **the same day routing was approved** (`REPRO-NOTES.md` open question 5). Two effects start on one
   date, so the 167h share numbers span a routing change and are not a steady state, and the weekend
   volume spike is the shape wash would take. Settles whether the volume and share columns describe
   real demand. Weighs most on CLOSED, which carries the largest blocks driving the raises (SPY
   $32.2M of $60.0M, GLD $28.1M of $31.8M).
6. **What the on-chain GLD mark is.** `REPRO-NOTES.md` records the pool marking $1,327.52 against a
   real GLD ETF close of $409.23, correct as recently as 2026-08-24. Either an ERC-8056 shares-per-
   token event or a dislocation. Settles whether GLD's $6.6M week, $7,482.77 of fees and 1141.3% APR
   describe a market at all, and therefore whether GLD can ever be a control.
7. **Protocol-fee reads for the rest of the field.** 50 of 138 census pools are read. Coverage is
   effectively complete on the five large assets and effectively zero on TSLA, AAPL and NVDA/SPY, so
   those three market APRs are charged-basis and their ratios are not comparable to the others.
   Cheap: one `protofee.mjs` pass over the remaining ids.
8. **Depth on ETH's four largest venues, and whether k is a choice.** Short 1 to 2 hour windows
   repeated across a week are enough to establish k and utilisation without scanning millions of
   swaps. If NVDA's 22.6 can be moved toward its field's 48 to 53 by range placement alone, that is
   a doubling of quoting depth on no new capital, and nothing in this set establishes what is
   holding the ranges wide.

---

## 7. The per-pool files

| pool | state | what it is for |
|---|---|---|
| [SPY-USDG.md](SPY-USDG.md) | change shipping | the largest Fables pool by TVL, and the case study in why an end-of-window TVL denominator breaks a rank. Its apparent revenue peak at 450 was withdrawn: measured dollars rank the 800-pip hours above the 500-pip hours |
| [NVDA-USDG.md](NVDA-USDG.md) | change shipping | the largest equity market on chain and the smallest position in it; also where the 1.46x-to-0.95x retraction happened and where two dead venues set a third of the market fee |
| [META-USDG.md](META-USDG.md) | change shipping | the deepest discount and the biggest relative raise, on the thinnest evidence in the set |
| [GLD-USDG.md](GLD-USDG.md) | control, with caveats | the only 20x fee move inside one session type, and the reason to treat it as an upper bound |
| [ETH-USDG.md](ETH-USDG.md) | control | the opposite error, in a $1.36bn market, on a keeper-driven fee |
| [TSLA-USDG.md](TSLA-USDG.md) | dust, no change | a real field ($3.9M, 10 venues at 3,299 pips) and a pool too small to rank in it |
| [AAPL-USDG.md](AAPL-USDG.md) | dust, no change | the only Fables pool that held one fee regime across the whole window |
| [NVDA-SPY.md](NVDA-SPY.md) | dust, no change | the worst APR ratio on the board, against a field that is one rival at 96.5% |
| [SPY-GLD.md](SPY-GLD.md) | dust, no change | the degenerate row: a field of one, where every ratio is an identity |
