# Per-pool fee ladder: measurement for review

Measured, not built. Start with `OVERVIEW.md`; `BASELINE-2026-08-30.md` is the frozen record and the
number of record wherever the two disagree. Each pool has its own file.

This is the **calendar ladder** layer: the per-session base fees. It is separate from the deviation
keeper in `../deviation/`, and that keeper does not depend on it, because it reads the base from
chain every cycle. A ladder change is a `setPoolConfig` and touches no keeper code.

## Why

We had never measured ourselves against the field. Every earlier fee number compared us to a chosen
rival, and against the volume-weighted whole market the picture is different and worse.

**On four of five real pools we sell below the market's clearing price in every session.** SPY at
0.26x of the field fee, META at 0.14x and 0.08x in closed hours, and we earn 0.30x and 0.12x of the
field APR for it. On ETH we do the opposite at 5.37x. On NVDA, once dead venues are removed, we are
roughly at market.

## What is shipping

| pool | realised now, O / N / C | shipping | why |
|---|---|---|---|
| SPY | 528 / 350 / 250 | **550 / 450 / 400** | 0.26x market fee on 9.0% of the asset's TVL |
| NVDA | 1,377 / 417 / 300 | **hold / 550 / 450** | the session tier earns 1.19x the field APR, so it is untouched |
| META | 579 / 361 / 250 | **500 / 500 / 450** | 0.08x market in closed hours, but see calibration |
| GLD, ETH | | **none** | GLD is mid-dislocation, ETH is keeper-driven |
| TSLA, AAPL, NVDA/SPY, SPY/GLD | | **none** | $26.70 of fees between them for the week |

The **level** argument is measured: charging 0.08x of what a market clears at is arithmetic on two
well-measured quantities. The **size** of each step is not, and that is the weakness of this whole
document. Shipping it is the experiment that produces the elasticity we do not have.

## How it is measured, and the one rule that matters

Two windows, because they answer different questions and one of them has already broken a conclusion.
A 48h chain scan reads every Swap event for depth, exact per-swap fees and utilisation. A 167h bucket
window covers five cash sessions for share, fee and APR by session. **Never draw a session conclusion
from the 48h scan: it holds one session.**

The benchmark is always `sum(fees)/sum(volume)` across every venue on chain for that asset, never a
chosen rival. SPY's field is 1,167 pips; the "deepest rival" is 625. Those are different arguments.

## Your work, used

The session tier structure and the hook's fee mechanics are yours and unchanged here: this measures
what the existing ladder earns, it does not redesign it. The deviation work in `../deviation/` is the
second-order layer on top, and the two are deliberately independent.

One finding of mine feeds back into your deviation spec and it is already there: the 600-pip
two-hop route ceiling (USDG to WETH at 100, WETH to SPY at 500) bounds price-sensitive flow only.
**Two thirds of open-session SPY volume trades above it**, and 21% of all SPY volume pays 3,000+.
So the ceiling constrains the calendar base and does not constrain the deviation ramp.

## Calibration

Nine things I got wrong and corrected, left visible in the documents rather than quietly fixed, so
you can see which claims have been stress-tested and which have not. The first two were caught by
Carl, the rest by an adversarial review pass over the finished documents.

- **Benchmarked against one rival instead of the field.** This was the original error and it changed
  conclusions on every pool. Against the "deepest SPY rival" we looked mid-priced; against the field
  we are at 0.26x. It also wrote out a NVDA venue realising **9 pips on $1.68M** and an ETH venue at
  **0 pips on $3.5M**.
- **Ran a 24h window that contained zero cash-session hours** and had to throw it away. The procedure
  now has a `preflight.py` gate that rejects such a window before the scan runs.
- **Claimed NVDA's session earned 1.46x the market APR.** That was one session. Across five it was
  0.95x, and after the dead-venue correction 1.19x. Two revisions on one number.
- **A rounding bug in my own analyser corrupted every elasticity table.** `int(round(pips/100)*100)`
  applied to a fee derived as `1e6*f/v` sends a 250-pip tier to either the 200 or the 300 bucket, so
  single tiers appeared as two rows and were compared against each other.
- **Priced the NVDA raise against a market fee that was 33% composed of two dead venues.** They were
  4.0% of volume, realised 6,688 and 8,213 pips, and had not traded in 70 and 115 hours. Removing
  them moves the overnight field from 1,091 to **605**, so the proposed 800 would have been 1.32x
  market while I described it as a discount. The raise is now 550.
- **Called NVDA our cleanest elasticity reading.** Exactly backwards: its fee is perfectly collinear
  with session, so the near-zero correlation measures the session, not the price.
- **Quoted k on two different bases**, a point reading for SPY against medians elsewhere. On a common
  basis SPY is 34.2 and ranks 7 of 8 in its own field, not the 158.5 and "mid-field" I published.
- **Designated GLD a control when its own config changed inside the window**, by hand, at 2026-08-29
  19:19 UTC. ETH is no better, its keeper reprices daily. There is no valid control pool and drift is
  now measured from each asset's field instead.
- **Said rivals keep 75% to 86% of what they charge.** True of the ones that take a cut; 21 of 50
  pools keep 100%, us included.

Every number is reproducible from this folder. `scripts/` holds the measurement chain and `data/`
holds the frozen inputs and rendered reports, so checking is a diff:

```
cd fees/pools/scripts
python corrections.py      # the corrected bases, labelled by document section
python universe7d.py       # the 167h field table in BASELINE section 1
python universe.py ../data/spy_series.json   # the 48h field benchmark for one asset
```

The scripts read from `../data/`. Re-measuring means re-running `census*.mjs` and `pool_series.mjs`
first, which need network and roughly 40 minutes for a busy asset.

## Where we actually rank, and why each pool is behind

`scripts/lprank.py` and `scripts/diagnose.py`, both reproducible from `data/`.

The whole book is **$1,609,701 of TVL earning $15,062 a week LP-net, a blended 49.1% APR**, against a
field of 73.1%. That is **0.67x**, and it flatters us: **GLD is 2.1% of our TVL and 49.7% of our fee
income**, purely because it is mispriced and being arbitraged. Strip it and the book earns 25.2%
against 72.0%, **0.35x**. We are last in our field on SPY, META and NVDA/SPY.

The reasons differ per pool, which matters because the fix differs too:

| asset | share / depth share | k, rank | binding constraint |
|---|---|---|---|
| SPY | k 34.3 against 178.1 for a same-size rival | 7 of 8 | **depth** |
| NVDA | 1.01 | 9 of 12 | **depth, then scale** |
| META | 2.57 | 3 of 5 | **price** |
| GLD | 0.40 | 1 of 5 | neither, an event |

**Only META is a pricing problem.** On SPY a pool of identical size charges 18% more than us and takes
ten times our flow, quoting $90.5M of depth against our $15.9M. On NVDA we win exactly our depth
share and are 197x smaller than the incumbent. On GLD we hold half the field depth and take a fifth of
the flow, because arbitrage does not shop for depth.

This is the part most likely to change what you do with the fee changes, so it is worth reading before
the per-pool files.

## What I need from you

**A sanity check on the three shipped numbers, not on the diagnosis.** The diagnosis is arithmetic on
two measured quantities and I am confident in it. The step sizes are judgement against an elasticity
that does not exist yet, and you know the flow and the router behaviour better than the data does.

Specifically: is there a reason a Fables pool cannot hold 450 to 550 pips in overnight and closed
hours that the field data would not show me? If the answer is routing inclusion, say so, because that
changes the whole plan from a pricing question to a distribution one.

## The three things worth hitting hardest

- **META's demand curve slopes up.** Share is 41.33% at 900 pips against 21.14% at 250. That is not a
  demand curve, it is the session confound: the 900-pip hours are six hours of one Friday. META gets
  the biggest relative discount and the weakest evidence, and if any pool overshoots it will be this
  one. I cut the raise from 900/800/700 to 500/500/450 for that reason and it is still the shakiest
  number here.
- **Every high-fee observation on SPY, META and NVDA falls on Friday 2026-08-28**, which is also the
  only cash session in the 48h scan. The two windows are **not** independent evidence at the top of
  any curve, which is exactly where the shipping decision needs them to be.
- **The window sits inside the points programme**, live since 2026-08-24 and paying on fees. Volume
  composition is contaminated by an incentive that did not exist two weeks ago, and we cannot
  separate incentivised flow from real flow with what we have. SPY's closed-hours share of 10.34% at
  250 pips is the number most exposed to this.

## Also worth knowing before you apply anything

- **Half the SPY market is unreachable at any price.** 49.1% of chain SPY volume routes through
  v3 WETH/SPY, a pair we do not quote. That is a product gap, not a fee gap.
- **The APR figures divide a week of fees by one TVL snapshot**, and TVL moved +162% on SPY and -69%
  on GLD in the final 24 hours. Fee, share and volume columns are unaffected; treat APR levels as
  indicative and APR ratios as the more robust of the two.
- **The predictions are pre-registered on share, not revenue**, with break-even shares printed per
  tier: SPY closed 6.46%, SPY overnight 7.06%, NVDA overnight 0.197%, NVDA closed 0.133%, META
  12.95%. Revenue is exposed to market drift we can no longer measure with a control; share is a
  ratio and is not.
- **GLD is the only clean elasticity observation in the set** and it is still not clean: 300 and
  6,000 pips both in closed hours across two days, share 31.32% to 12.60%, measured dollars 5.29x per
  hour. But the raise was made by hand 23 hours into a decaying event, so time ordering confounds it
  before routing does. Treat it as an upper bound on how insensitive flow is, never an estimate.
