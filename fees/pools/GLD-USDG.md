# GLD/USDG

**State: NO CHANGE SHIPPING. It is NOT a valid control, see section 1.** Cross-asset frozen state in
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md). Fees in pips. Cap 15,000, pokeFloor 3,000,
autonomous 6,000, `protocolFee = 0`.

## 0. The closed floor needs a decision, not a default

**Live on chain GLD is 3000 / 3000 / 6000, cap 15,000, pokeFloor 3,000.** That is the emergency config
pushed at 2026-08-29 19:19 UTC during the dislocation.

The deviation spec correctly dropped its "revert closed to 1,500" instruction, because 1,500 sits
below `pokeFloor`. This document says "no change" because GLD is mid-dislocation. Between the two,
**nothing reverts the emergency 6,000**, so it persists by default rather than by decision. One call
is needed: keep 6,000, or pick a considered closed floor at or above 3,000. Raised by Yanis, 31 Aug.

## 1. Why it is held

Two independent reasons.

1. **It is mid-dislocation.** The pool marks GLD far above its anchor and the event is the subject
   of [../deviation/DEVIATION-FEE.md](../deviation/DEVIATION-FEE.md). Changing a fee during the
   event confounds that work and this one.
2. **It was designated a control, and that was wrong.** A control must hold still, and GLD did not:
   its configuration was changed by hand to 3000/3000/6000 at **2026-08-29 19:19 UTC**, fourteen
   hours before the frozen window closed. The realised fee shows it plainly, CLOSED running 300 on
   08-28, 1,185 on 08-29 and 6,000 on 08-30. Its OPEN and OVERNIGHT tiers will move from a realised
   1,065 and 392 to a live 3,000 with no market change at all.

   **There is no valid control pool.** ETH is no better: its keeper repriced it daily across the
   window (OPEN 2,119 / 1,122 / 899 / 1,053 / 2,065). Use the field instead. Each asset's market fee
   and market APR are measured every run, so drift is visible without an unchanged pool, and
   re-basing triggers if an asset's market fee moves more than 20% relative between runs.

## 2. Baseline, frozen

167 hours, 20 venues, 5 cash sessions.

| session | hrs | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | $31,812,152 | 3,937 | 1,135 | 0.29x | 1683.4% | 1141.3% | 0.68x | 20.73% |
| OPEN | 35 | $2,197,620 | 2,222 | 1,065 | 0.48x | 312.8% | 291.8% | 0.93x | 17.14% |
| OVERNIGHT | 77 | $1,561,929 | 2,584 | 392 | 0.15x | 117.5% | 67.5% | 0.57x | 33.30% |
| CLOSED | 55 | $28,052,602 | 4,147 | 1,207 | 0.29x | 4747.8% | 3185.3% | 0.67x | 20.31% |

Every APR here is an **event** figure, not a run rate. 88% of the week's volume landed in closed
hours during the dislocation.

## 3. The one thing GLD proves for every other pool

It is the only pool whose fee varied by 20x **within** the same session type, which makes it the
cleanest natural experiment on price sensitivity we have anywhere.

| we charge | hours | days | session | our volume | mean share | **$/hour** | index |
|---|---|---|---|---|---|---|---|
| 300 | 23 | 2 | all CLOSED | $4,789,279 | 31.32% | **$62.47** | 9,397 |
| 350 | 60 | 5 | all OVERNIGHT | $500,945 | 42.21% | $2.92 | 14,772 |
| 500 | 24 | 4 | all OPEN | $124,737 | 42.38% | $2.60 | 21,191 |
| 1,500 | 14 | 1 | OPEN and OVERNIGHT | $233,718 | 23.47% | $25.04 | 35,202 |
| 6,000 | 14 | 2 | all CLOSED | $770,856 | 12.60% | **$330.37** | 75,600 |

**The 300 and 6,000 rows are the experiment: same session type, two days each.** A 20x fee raise cut
share from 31.32% to 12.60% (0.40x) and multiplied measured dollars per hour **5.29x**, $62.47 to
$330.37.

The 9.3x quoted this afternoon is the inferred index ratio, not the measured one. Use 5.29x.

This is the single strongest piece of evidence behind raising every other pool's overnight and
closed tiers, and it is still not clean. Two reasons, in order of weight.

**First, time ordering.** The 300 to 6,000 move was a manual `setPoolConfig` made 23 hours into an
ongoing dislocation, not a randomised change. The event was already decaying when the fee rose, so
part of the share fall and part of the revenue rise belong to the event, not the price.

**Second, routing.** A dislocated pool's arbitrageur has to trade us to capture our own mispricing;
a normal pool's trader can route away.

**Treat the GLD elasticity as an upper bound on how insensitive flow is elsewhere, never as an
estimate of it.**

## 3b. Neither depth nor price: the numbers describe an event

`scripts/diagnose.py`. Volume share **20.4%** against depth share **50.5%**, a ratio of **0.40**, and
k of **32.7 is first in the field** against rivals running near-full-range at 1.1 to 5.7. We hold half
the field's quoting depth and take a fifth of its flow.

That inverts the SPY and NVDA pattern completely, and it is not a depth failure. This week's GLD flow
is not router flow: it is arbitrage against a pool mispriced by roughly 181%, and an arbitrageur does
not shop for depth, they trade the mispricing wherever it sits. **The action on GLD is the deviation
keeper, not a fee tier and not a range.**

LP efficiency: our 1,141.3% APR against a field of 1,683.4%, 0.68x, rank 3 of 5. Both numbers are
event figures. GLD is **2.1% of our TVL and 49.7% of our weekly fee income**, which is the clearest
single statement of how distorted the book currently is.

## 4. What this does not settle

- **Whether the event was manipulation or a broken market.** Unresolved, upstream of the fee, and
  it decides whether any of these numbers describe a market at all.
- **The LP damage.** Net liquidity fell over the event; separating trading losses from withdrawals
  needs per-position accounting that has not been done.
- **When to un-hold.** GLD returns to the normal cycle once the dislocation resolves and the
  deviation keeper is live, not before.
