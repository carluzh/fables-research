# Per-pool fee ladder: measurement for review

**Status 31 Aug: one fee change ships, META closed. Everything else is held or withdrawn.**

Start with `OVERVIEW.md`; `BASELINE-2026-08-30.md` is the frozen record and the number of record
wherever the two disagree. Each pool has its own file.

This is the **calendar ladder** layer, the per-session base fees. It is separate from the deviation
keeper in `../deviation/`, which reads its base from chain every cycle, so a ladder change is a
`setPoolConfig` and touches no keeper code.

## What ships

| move | live on chain | to | vs market | why |
|---|---|---|---|---|
| **META closed** | **250** | **450** | **0.08x** | the one pool where price is the binding constraint |

That is one `setPoolConfig`, a whole-struct restatement, and it is as much an **experiment as a
change**: META is the only asset where our own diagnosis says the fee is what is holding us back, so
it is the clean place to finally measure the demand curve.

Everything else is held, and for reasons that are not "we need more data":

| pool | state | why |
|---|---|---|
| SPY | **hold** | depth-constrained, and depth is not ours to set. See below |
| NVDA | **hold** | scale-constrained: we are 197x smaller than the incumbent, and it is already above market on the live config |
| GLD | **hold** | an event, owned by the deviation work. One open decision, section below |
| ETH | **handed off** | owned by a separate workstream, direction there is to CUT the fee in low-volatility regimes |
| TSLA, AAPL, crosses | **hold** | $26.70 of fees between them for the week |

## Why the fee is not the project

The whole book is **$1,609,701 of TVL earning $15,035 a week LP-net at a blended 49.1% APR**, against
a field of 73.1%. Excluding GLD, which is 2.1% of our TVL and 49.7% of our fee income purely because
it is mispriced and being arbitraged, the book earns **25.2% against a field of 72.0%**.

Closing that gap on the capital we already hold is worth **$8,248 a week, more than doubling the
book**:

| asset | our TVL | our fees/wk | our APR | field APR | gap/wk |
|---|---|---|---|---|---|
| SPY | $464,072 | $1,596 | 17.9% | 58.8% | **$3,651** |
| ETH | $1,042,590 | $5,532 | 27.6% | 44.2% | **$3,331** |
| META | $26,148 | $107 | 21.3% | 179.6% | $796 |
| NVDA | $30,511 | $317 | 54.0% | 112.4% | $343 |
| TSLA, AAPL | $6,519 | $23 | | | $128 |
| **ex-GLD total** | | **$7,576** | **25.2%** | **72.0%** | **$8,248** |

**The entire fee-ladder exercise, at its best case with share holding perfectly, was worth $679 a
week: 8% of that gap.** It is priced correctly as a small, cheap tidy-up, not as the answer.

## Why each pool is behind, and it is not the same reason

`scripts/diagnose.py`. APR is turnover times fee, so the gap is **price**, **depth** or **reach**, and
the tell is volume share against depth share.

| asset | share ÷ depth share | k, rank | binding constraint | is it addressable? |
|---|---|---|---|---|
| SPY | k 34.3 against 178.1 for a same-size rival | 7 of 8 | **depth** | **no: k is not ours to set** |
| NVDA | 1.01 | 9 of 12 | **depth, then scale** | no: 197x too small |
| META | 2.57 | 3 of 5 | **price** | **yes, and it ships** |
| GLD | 0.40 | 1 of 5 | neither, an event | the deviation keeper |

**SPY is the important one and the answer is uncomfortable.** A pool of identical size quotes $90.5M
of depth against our $15.9M, and our share tracks our depth share almost exactly. Earlier drafts
called this "a 5.7x available for free, the highest-return action on the board". **That is withdrawn:
k is set by how LPs place ranges, not by us.** So on SPY the fee is not the constraint, the constraint
is not ours to move, and the only remaining lever is reach: **49.1% of SPY volume routes through
WETH/SPY, a pair we do not quote at all.** That is a product decision, not a parameter.

## Calibration

**The biggest error came from Yanis on 31 Aug and it changed what the change was.** The shipping
table's "was" column was realised fee over a 167h window that ends 30 August. A ladder change landed
on **28 August**, so the window is ~80% pre-change and mostly describes the config we replaced. Live
on chain, NVDA overnight is **800**, not the 417 published, so the proposed 550 was a **31% cut, not a
raise**. Four of eight tier moves were cuts written as raises, and for a cut the pre-registered test
inverts: share must rise by the full fee ratio, up to 80% on META open, just to hold revenue flat.

I had the evidence and did not apply it. BASELINE section 7 says "no pool held one fee regime across
the window" and `data/CORRECTIONS.txt` shows Friday breaking ranks on every pool. **A realised fee is
not a configuration**, and nothing in this work read `floorConfig` off chain until Yanis did.

From the same review: **NVDA's "OPEN: hold" was not achievable.** The routine bell is
`overnightFloor * spikeMult` (`SessionLib.sol:118`), live `800 x 5 = 4000` and deliberately equal to
`closedSpike`. Moving overnight to 550 drops the bell to 2750, a 31% cut to the one tier earning
above its field, and leaves `closedSpike` absolute so Monday opens become dearer than Tuesday. Both
pass validation silently.

Nine more found earlier, by Carl and by an adversarial pass over the finished documents:

- **Benchmarked against one rival instead of the field.** Changed conclusions on every pool, and wrote
  out a NVDA venue realising 9 pips on $1.68M and an ETH venue at 0 pips on $3.5M.
- **Ran a 24h window containing zero cash-session hours** and threw it away. `preflight.py` now gates
  this.
- **Claimed NVDA's session earned 1.46x the market APR.** One session. Across five, 0.95x; after the
  dead-venue fix, 1.19x. Two revisions on one number.
- **A rounding bug in the analyser** split single fee tiers across buckets and compared them against
  each other, corrupting every elasticity table.
- **Priced the NVDA raise against a market fee 33% composed of two dead venues**, moving the overnight
  field from 1,091 to 605.
- **Called NVDA the cleanest elasticity reading.** Backwards: its fee is collinear with session.
- **Quoted k on two bases**, a point reading against medians. On a common basis SPY is 34.2, rank 7 of
  8, not "mid-field".
- **Designated GLD a control** while its own config changed inside the window.
- **Said rivals keep 75 to 86%.** 21 of 50 pools keep 100%, us included.

The pattern behind them is worth more than the list. Three structural flaws: **the system's state was
inferred from market data rather than read from chain**; **an elasticity was pursued five separate
times from data that cannot identify it**, because the fee is a deterministic function of the calendar
and therefore collinear with everything else; and **the parameter that was easiest to measure was
optimised rather than the one that mattered.**

## The open decision

**GLD's closed floor.** Live is 3000 / 3000 / 6000, the emergency config pushed 2026-08-29 19:19 UTC.
The deviation spec dropped its "revert to 1,500" instruction because 1,500 sits below `pokeFloor` of
3,000; this work says "no change" because GLD is mid-dislocation. Between the two, **nothing reverts
it**, so 6,000 persists by default rather than by decision. Keep it, or pick a considered floor at or
above 3,000.

## What to hit hardest

- **The META ship is one pool's worth of evidence and its measured demand curve slopes up** (41.33%
  share at 900 pips against 21.14% at 250, which is the session confound). It ships because the level
  gap is measured and large, not because the elasticity supports the size. Pair it with a randomised
  `pokeFee` schedule, not a calendar-shaped one, or we will not learn anything from it either.
- **Every high-fee observation on SPY, META and NVDA falls on Friday 2026-08-28**, which is also the
  48h scan's only cash session. The two windows are not independent evidence at the top of any curve.
- **The window sits inside the points programme**, live since 2026-08-24 and paying on fees, so volume
  composition is contaminated by an incentive that did not exist two weeks ago.

## Reproducing

`scripts/` holds the measurement chain and `data/` the frozen inputs, so checking is a diff:

```
cd fees/pools/scripts
node livecfg.mjs          # live floorConfig, maxFee, pokeFloor off all six RWA hooks. Run this FIRST
python corrections.py     # the corrected bases, labelled by document section
python universe7d.py      # the 167h field table in BASELINE section 1
python lprank.py          # LP-net APR rank per asset, and the whole book
python diagnose.py        # price vs depth vs reach, per pool
```

**`livecfg.mjs` first, always.** Market data says what the market did; only chain says what we are
set to. That rule would have prevented four of the twelve errors above.
