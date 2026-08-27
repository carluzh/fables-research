# Rebuttal to the round 1 synthesis

Author: the V side (the variance review). Written after reading the synthesis in
`fee-adjudication-round1.md` and re-running the checks it relied on. Fees in pips (100 pips = 1 bps).

## What I concede, with the re-measurement that settles it

C1. **The overnight break-even shape does not reproduce.** be2.py prints SPY 1.00 / 0.24 / 0.28 and
NVDA 1.00 / 0.23 / 0.05. The 0.47 / 0.66 in the addendum is wrong and every overnight tier built on it
was overstated. SPY overnight goes from the proposed 450 back to **350** (break-even 173 pips on 7d,
92 on 48h, so 350 still carries a 2x margin). NVDA overnight **750 stands**, but for a different
reason than the document gave: its 7d break-even is 717 pips.

C2. **GLD's dark hours were filled with the S&P future, not the gold future.** allvar.py loads GC_F and
never uses it. Re-run with GC_F as GLD's fill (allvar_gc.py, tiervar_all_gc.json): overnight / open
variance **1.04** (was 0.83 on the ES fill), closed / open **0.19** (was 0.07). Gold's weekday
overnight is as volatile as its US session. Document R's flat weekday is the right shape for gold and
V's 1000 overnight against 1500 open was a discount the data does not support. Break-even at the
open barely moves (998 to 968 pips on 7d); overnight rises from 377 to 460.

C3. **51.4% routed is a swap count, not a dollar share.** By dollars the UniversalRouter is 22.7% of
ETH/USDG. Every place V or the data pack quotes it must say "of swaps".

C4. **The keeper is unproven, not proven.** Fee APR / k is 1.55% against a sigma squared over eight of
3.81% on the 7d window; it reaches 2.7 to 3.1% only on the surge days. "The keeper works" becomes
"the keeper roughly doubles capture and has not been shown to clear LVR". Per-window markouts are
the test, and they come before any change to C.

C5. **V's body is stale in four places** and must be rewritten, not annotated: section 3.2 (overnight
92% as volatile as the session), section 3.4 and the D2 recommendation (closedSpike inert), section
2 (hooked pools excluded from the quoter, falsified by the census), and the "what shipped" wording
at 520 to 524 (nothing shipped). The GLD "72% share, 7.6x too cheap" line is one window; on 7d the
split is 53.9% to 29.8% and on 27 Aug Fables out-traded the incumbent.

C6. **The hook cannot express gold's calendar.** SessionLib.classify prices Friday 16:00 ET through
Monday 00:00 ET as CLOSED, gold reopens Sunday 18:00 ET, MAX_SESSION_LENGTH is 12 hours, and the
holiday table is NYSE. Neither document saw this. It is a contracts change, not a config, and it
belongs on the follow-up list ahead of any GLD calendar re-spec.

C7. **R's test protocol applies to every raise**, not only META: a dated window, a share metric
measured on swap count and on dollars separately, and a revert trigger.

C8. **AAPL, TSLA, SPY/GLD and the NVDA/SPY cross are academic at their TVL.** Leave them until
reseeded; when reseeded, price each to its own variance rather than copying SPY.

## What I push back on

P1. **"Recalibrate C down" has no direction yet.** The synthesis rules for R on I9 while its own
numbers show the keeper under sigma squared over eight on every window but the surge days. If the
naive test is trusted, the deficit argues for C up, not down. If the naive test overstates LVR on a
fast chain, as R and all three judges say it does, then the keeper cannot be said to "fail" it
either. The only consistent position is: markouts first, and the sign of any C change is an output
of the markouts, not a prior from the mainnet literature. R's action item 5 should drop "down".

P2. **"Fee moves share among comparable depths" does not reach the band in question.** J3's SPY
evidence compares a 625 pip pool with a 3499 pip pool, a 5.6x ratio. The proposal moves Fables from
500 to 750 inside the band the dominant pool already occupies, and the same UniversalRouter routes
three quarters of the 3499 pool's dollars to it on small tickets. Nobody has measured elasticity
between 5 and 7.5 bps, which is why C7 exists. Until that test runs, "a raise of this size loses no
routed flow" remains the best supported inference, and the judges' own I11 reasoning (if cutting
buys no routed flow, raising loses none) says the same.

P3. **The points programme argues for the raise, not against it.** If some of the surge is wash to
farm points, a higher fee makes the wash dearer and shrinks it. That is a reason to move sooner on
SPY and NVDA, not to wait. The contract senders (0xb055, 0x8f10, 0x1521) should be labelled either
way; that is a half-day task, not a gate on fees.

P4. **Shape by variance, level by break-even.** Break-even in pips folds in per-tier on-chain volume,
and that volume is the surge-window quantity everyone agrees is unstable. The variance ratios come
from 730 days of bars and do not move with a good week. So the tier shape should follow variance,
and the break-even should set the open tier's level only. On that rule GLD is flat across the
weekday (1.04) and SPY and NVDA discount the overnight to roughly a quarter to a half of open, which
is what C1 now does.

P5. **The NVDA/SPY cross is not evidence of anything at $1.0k of TVL.** R pitches it as "already the
cheapest quote" at 5 bps against a 6.25 bps incumbent doing $1.1M a day; Fables gets none of that
flow at the cheapest price, which is the depth law again. Being cheapest is not a pitch to preserve.
The cross's 7d break-even is 561 open and 742 overnight, so when it is seeded it should be priced
around 700 / 700 / 250, and until then it should not be in the batch.

P6. **GLD's level stays at 1500 at the open.** The judges are unanimous on direction. J3's "3x in one
step is not evidenced" is a pacing preference, not a finding: the 7d break-even at the open is 968
pips on the corrected fill, the same-chain venue that takes half the pair's volume charges 3000, and
the operator already wants to move slowly. 1500 flat on the weekday with 300 on the weekend is one
step, 2x the break-even, half the incumbent.

## The revised ladder (V2) for the panel to judge

| pool | current | V1 (round 1) | V2 (now) | basis |
|---|---|---|---|---|
| SPY/USDG | 500 / 350 / 300 | 750 / 450 / 250 | **750 / 350 / 250** | open break-even 759 (7d); overnight 173; shape 1.00 / 0.24 / 0.28 |
| NVDA/USDG | 700 / 400 / 300 + spike | 1000 / 750 / 300 + spike | **1000 / 750 / 300 + spike** | open break-even 2751; overnight 717; staged, not one step |
| GLD/USDG | 500 / 350 / 300 | 1500 / 1000 / 300 | **1500 / 1500 / 300** | GC-fill variance flat across the weekday; open break-even 968 |
| META/USDG | 500 / 350 / 300 | 900 / 600 / 250 | **900 / 700 / 250**, inside R's two-week protocol | overnight break-even 710 above open 572; closed / open variance 0.03 |
| ETH/USDG | 450 + keeper | no change | **no change; markouts before any C change, sign open** | C4, P1 |
| AAPL, TSLA, SPY/GLD, NVDA/SPY | as is | in the batch | **out of the batch until reseeded** | C8, P5 |

Every raise ships with C7: a dated window, count and dollar share tracked separately, and a revert
trigger.
