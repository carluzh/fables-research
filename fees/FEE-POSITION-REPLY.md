# V's reply to FEE-POSITION-RESPONSE.md

2026-08-28. Fees in pips (100 pips = 1 bps). Nothing has shipped on-chain.

**Bottom line: all three amendments accepted, both clarifications answered, and the ladder below is
the one both sides have now signed.** The amended configs and both NVDA stages were pushed through
the live `setPoolConfig` validator today (`fables-contracts/test/scratch/ProposedFees.t.sol`, six
configs, all pass). The artefacts R could not run are now in a repo (section 5).

---

## 1. Amendments

### 3.1 The floors are upper bounds. Accepted, and the method paragraph now says so.

The break-evens are naive-LVR upper bounds (sigma squared over eight times k, continuous arbitrage,
no fee band, no block time), used as conservative floors. The same unknown factor that blocks a
direction for C shrinks them in the ladder's favour: a tier that clears the printed floor clears the
true one. "SPY's open sits under its break-even" and "NVDA at 1000 leaves LPs at 0.93x" are
worst-case statements, not measurements, and are worded that way from here on.

### 3.2 Three tiers under their own rule. Accepted, option (b): a stated minimum margin.

The rule, restated so the table and the method agree: **variance sets the tier ratio as the prior;
each tier then sits at least 5% above its own 7d naive break-even; variance stands in only where
volume is too thin to measure.** Per tier, not per pool, because the protocol's metric is per tier.
Bells do not count toward the open tier's test; they are priced on their own evidence (3.3).

| tier | was | now | floor | margin |
|---|---|---|---|---|
| SPY open | 750 | **800** | 759 | +5.4% |
| META overnight | 700 | **750** | 710 | +5.6% |
| NVDA overnight | 750 | **800** | 717 | +11.6% |
| NVDA closedSpike | 3750 | **4000** | must not fall under the routine spike, which is now 800 x 5 = 4000 | |

NVDA open stays the one disclosed exception (1000 against 2751, staged, spike-covered, stage 2
dated). Everything else in the ladder already carried at least 1.4x.

### 3.3 SPY in two stages. Accepted.

SPY ships as 800 / 350 / 250 flat; the bells (spikeMult 6, closedSpike 2100, descent 7200,
closeFloor 1500, closeBefore 1800, closeAfter 0) follow one week later as their own dated,
reverting change, scheduled through the admin delay so the stagger is a week either way. One dated
change per window is the right discipline, and the bells are the least evidenced element in the
batch by our own open item 4. Both SPY stages validate.

### 3.4 The GLD probe. Accepted, R-owned.

Daily probe-TVL check at $50k, for the duration of every GLD window. Added to open items.

## 2. Clarifications

1. **GLD 1100 and the Sunday override.** (a) Yes: 1100 is deliberately the no-override figure, and it
   is the fallback. (b) Correct, and thank you for the catch: `FORCE_OPEN` makes the whole ET day a
   trading day (`CalendarLib` :124 to :130 passes `force` into `classify`, which skips the weekend
   rule for the day), so with a flat 1500 weekday all 24 Sunday hours price at 1500 and the week
   averages **1271**, not 1100. That is what we intend, and the wording was wrong, not the plan:
   gold is shut on Sunday until 18:00 ET, so the twelve overpriced daytime hours carry no reference
   price to arbitrage and next to no retail, while the six evening hours carry all of the closed
   tier's measured variance at 1.77x the open hourly rate. Overcharging dust to price the toxic
   window right is the trade we take. The override needs a `setDayOverrides` push per month (two
   bits per day) and a resolver test that pins Sunday 18:00 to 24:00 ET at 1500 before the first
   push; that test is ours (open item 5). Fallback if the team would rather not overprice Sunday
   daytime at all: closedFloor 800, weekly 1267.
2. **Bells convention.** Every time-weighted figure below is quoted with the bells the config carries
   at that stage, on the code's own week (32.5h open, 79.5h overnight, 56h closed), linear descent
   and linear close ramp: SPY stage 1 **404** (flat), SPY stage 2 **448** (bells), NVDA stage 1
   **770** (bells; 672 flat), NVDA stage 2 **833**, GLD **1100** (1271 with the Sunday override),
   META **612**. Today: SPY 362, NVDA 425 flat.
3. **Stage 2 validation.** Both NVDA stages (1000 and 1400 open, 800 / 300, spikeMult 5, closedSpike
   4000, descent 7200, closeFloor 2200, closeBefore 1800, closeAfter 0) and both SPY stages went
   through the validator today and pass. Stage 2 gets a second run on the day its date is set.

## 3. Process

1. **Artefacts committed.** `/Users/carlschmidt/Desktop/Projects/fables-research` (git, one commit):
   `fees/scripts/` (allvar.py, allvar_gc.py, be2.py, be3.py, kmeas.mjs, lib.mjs, ur_now.mjs, now.ts),
   `fees/data/` (kall.json, be_all.json, tiervar_all.json, tiervar_all_gc.json, ur_now.json, now.json,
   the keeper series, res.json), `fees/adjudication/` (both syntheses, the rebuttal, raw verdicts),
   and the three documents. Yahoo bar files are not committed; allvar.py expects them beside it.
   R's pulls and the review-pass journal go in the same repo.
2. **The census fix is done and rerun.** `ur_now.mjs` now reads the USDG leg per pool (token0 on
   NVDA, GLD and META; token1 on ETH and SPY). The 24h window to 27 Aug 23:43 UTC, which is the
   baseline every raise window is measured against:

   | pool | swaps | UR by count | UR by dollars | top non-UR sender |
   |---|---|---|---|---|
   | ETH/USDG | 3,006 | 51.7% | 21.5% ($256k) | 0x8f10 14.2% |
   | SPY/USDG | 2,253 | 21.0% | 27.5% ($145k) | 0x39b3 21.9% |
   | NVDA/USDG | 1,068 | 14.7% | 16.7% ($26k) | 0x8f10 13.8% |
   | GLD/USDG | 409 | 16.1% | 15.2% ($20k) | 0x1521 33.7% |
   | META/USDG | 211 | 9.5% | 5.2% ($2k) | 0xc491 23.9% |
   | rival ETH 0x54f7 | 19,208 | 19.8% | 22.5% | 0x520e 32.9% |
   | rival SPY 0xe592 (625) | 9,121 | 13.7% | 21.9% | 0x6505 32.6% |
   | rival SPY 0xfe2a (3499) | 11,116 | 56.3% | 62.9% | 0x4a86 14.6% |

   Two things this settles. The router's dollar share of our raised pools is 15 to 28%, so the
   revert trigger has a real quantity to move on all four; and the 35 bps SPY pool still takes 63%
   of its dollars from the router, so the anomaly in open item 7 is current, not a one-day artefact.
   `fees/data/ur_now.json` holds the per-sender breakdown.
3. **Division of labour.** R takes the per-window ETH markouts (open item 1) and the six sender labels
   (open item 3). V keeps the census (done), the Sunday-override resolver test (open item 5), and
   the rewrite of the four stale review sections (open item 9). Monitoring per window as R listed:
   probe TVL daily, UniversalRouter dollar share per pool, and a weekly re-check of the 61% to 35 bps
   SPY anomaly.

## 4. The ladder as both sides sign it

| pool | ship | stage | time-weighted |
|---|---|---|---|
| SPY/USDG | **800 / 350 / 250** flat | bells one week later: spikeMult 6, closedSpike 2100, descent 7200, closeFloor 1500, closeBefore 1800 | 404, then 448 |
| NVDA/USDG | **1000 / 800 / 300**, spikeMult 5, closedSpike 4000, descent 7200, closeFloor 2200, closeBefore 1800 | open to **1400** two weeks later unless the protocol trips | 770, then 833 |
| GLD/USDG | **1500 / 1500 / 300**, no bells, Sunday FORCE_OPEN overrides after the resolver test | fallback closedFloor 800 | 1271 (1100 without overrides) |
| META/USDG | **900 / 750 / 250** in the two-week protocol | none | 612 |
| ETH/USDG | **no change** to 450, floor, cap or C | markouts first, sign of any C change is their output | |
| AAPL, TSLA, SPY/GLD, NVDA/SPY | **out of the batch** | re-measured at seed time | |

Every raise: a dated two-week window, one config change per window, UniversalRouter dollar share as
the revert trigger (count and dollars quoted separately), per-tier realised fee as the interim
metric, markouts as the final one.
