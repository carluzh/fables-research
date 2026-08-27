# Fee structure: what we concede and what we push back on

Position after two blind adjudication rounds, 2026-08-28. Fees in pips (100 pips = 1 bps). Nothing has
shipped on-chain.

How this was produced. Round 1: three independent judges (LP economics, competitive flow, verification
against the code and data) adjudicated eleven contested points between the benchmarking report
(`FEE_BENCHMARKING_REPORT.md`, "R") and the variance review (`FEE-AND-APR-REVIEW.md`, "V"), blind to
each other and to either author's rebuttal. Round 2: a fresh panel of three ruled on V's rebuttal and
revised ladder. Syntheses: `Writing/fee-adjudication-round1.md`, `Writing/fee-adjudication-round2.md`;
the rebuttal: `Writing/fee-adjudication-rebuttal.md`; raw verdicts beside them. Every number below was
reproduced by at least one judge from local files, and the final ladder was pushed through the live
`setPoolConfig` validator (all configs validate).

---

## 1. What we concede

### To the report

1. **The keeper is unproven, not proven.** Fee APR / k is under sigma squared over eight on every local
   window (0.73% on 7d, 2.11% on 48h, 2.68% on 24h against 3.1 to 3.8%). "Doubles capture" is true;
   "clears LVR" is not shown. Per-window markouts are the only measurement that settles it. (R was
   right; our "1.55% vs 3.81%" line had no stated window.)
2. **Gold's calendar shape is flat across the weekday.** Our tier variance had filled GLD's dark hours
   with the S&P future; `allvar.py` loaded the gold future and never used it. Re-measured on GC
   (`tiervar_all_gc.json`): overnight / open variance 1.04, closed / open 0.19. R's "flat weekday,
   weekend-only discount" is the right shape. Our 1000 overnight against 1500 open was a discount the
   data does not support.
3. **Depth is the lever for share.** Cutting fees buys nothing; TVL wins routed flow. Seeding NVDA is the
   growth move, on one condition (see push-back 5).
4. **META's protocol.** A dated two-week window with a revert trigger is the right way to ship a raise,
   and it applies to every raise, not only META. The trigger must be on UniversalRouter dollar share,
   not total share, because total share on these pools is a handful of contract senders whose departure
   is the intended effect.
5. **The small pools are academic.** AAPL, TSLA, SPY/GLD and the NVDA/SPY cross are $1k to $2.6k of
   TVL with k measured on 16 to 98 swaps; their break-evens move 2x between windows. Out of the batch
   until reseeded, then priced on their own variance, not copied from SPY.
6. **"Already the cheapest quote" is not a pitch worth preserving** on the cross, and our 700/700/250
   for it was not supportable either. No number until it is seeded.
7. **The wash argument.** Our claim that a higher fee shrinks points wash was wrong: points are pro rata
   on fees from a fixed pot, so cost per point is fee-invariant. The conclusion (labelling senders is a
   half-day task, not a gate on fees) stands on other grounds.

### About our own document

8. **The overnight break-even shape did not reproduce.** The addendum's SPY 1.00 / 0.47 / 0.28 and NVDA
   1.00 / 0.66 / 0.05 exist in no artefact; `be2.py` prints 1.00 / 0.24 / 0.28 and 1.00 / 0.23 / 0.05.
   Every overnight tier we proposed on that shape was overstated. SPY overnight goes back to **350**.
9. **51.4% routed is a swap count.** By dollars the UniversalRouter is 22.7% of ETH/USDG and 22.8% of
   SPY. Every quote of it must say "of swaps".
10. **Four sections of the review are stale and must be rewritten**, not annotated: 3.2 (overnight "92%
    as volatile as the session"; measured 0.26x), 3.4 and D2 (closedSpike "inert"; withdrawn, and the
    validator imposes no such relation), section 2 (hooked pools "excluded from the quoter"; falsified
    by the census), and the "what shipped" wording (nothing shipped). The "72% share, 7.6x too cheap"
    GLD line is one window; on 7d the split is 53.9% / 29.8% and the daily series swings from 1% to 67%
    in four days, so no single-window GLD share should be quoted by either side.
11. **The routing census has a decimals bug.** `ur_now.mjs` divides amount1 by 1e6 on every pool while
    USDG is token0 on NVDA, GLD and META, so dollar shares for those three are garbage (counts are
    fine). This has to be fixed before any dollar-share trigger can run.
12. **The rule we actually used.** We said "variance sets shape, break-even sets the open level". What
    the ladder does is: variance sets the ratio as the prior, and each tier then sits at or above its
    own break-even with margin. Restated below so the ladder and its method agree.

---

## 2. What we push back on

1. **SPY and NVDA are not "well set".** Unanimous across both panels. SPY's open tier sits at or under
   its 7d break-even (759 pips against 500 charged); NVDA's is 2751 against 700, and NVDA LPs run
   under LVR on every window (weekly LVR $287 against $171 of fees). "Well set" was judged on share
   against incumbents, which says nothing about whether LPs cover their loss. And the report's own
   evidence removes the cost: the winners charge the same or more, and the flow that moves on price
   is the flow we do not want.
2. **GLD's level is not 5 bps.** Unanimous on direction. The PAXG/USDC anchor is a mainnet venue this
   chain's flow cannot reach. On this chain the venue that takes half the pair's volume charges 3000
   pips, GLD's open break-even is 968 on the corrected fill, and GLD LPs cover 0.65x of naive weekly
   LVR at today's fee. 1500 flat on the weekday is 1.55x the open break-even and half the incumbent.
   (One judge would take 1200 first; the record does not distinguish the two, and we take 1500.)
3. **"Recalibrate C down 30%" has no direction.** Unanimous. The only local LVR evidence puts the keeper
   under sigma squared over eight, which points up; the fast-block argument says that test overstates
   loss by an unknown factor. Neither supports "down", which is a mainnet literature prior. Effective
   C already spans 0.17 to 0.68 around a 0.40 median with 27 cap hits in 7d, so there is no baseline
   to cut from. Markouts first; the sign is an output.
4. **The DST caveat is false.** `SessionLib.utcOffsetFromDate` implements the US rule, `MarketCalendar`
   exposes `dstMode` (AUTO, FIXED_EST, FIXED_EDT), sessions are anchored at 09:30 ET, and a test pins
   winter and summer instants. Nothing drifts in November. The real calendar gaps are elsewhere (see
   open item 5).
5. **Fee before capital on NVDA.** Seeding NVDA at 700 pips against a 2751 break-even, with 26 to 32%
   of its flow from identified arb contracts, transfers the seed to arbitrageurs. The raise ships
   first; the seed follows.
6. **A raise of this size loses no routed flow.** Upheld by two of three in round 2, with the caveat
   that it is an inference, not a measurement: the UniversalRouter sends 61% of its SPY dollars to a 35
   bps pool and 7% to us at 5 bps, so routed retail is not choosing by fee inside the 5 to 15 bps band.
   Nobody has measured elasticity between 5 and 7.5 bps, which is exactly why every raise ships inside
   the test protocol.
7. **"Surge undiagnosed" is half right.** The timing is nailed (routing approval Monday 24 Aug ~05:00
   UTC; ETH daily volume $53k, $101k, $411k, $953k on 23 to 26 Aug) and the retail leg is the router.
   What is not diagnosed is the larger contract leg (0xb055, 0x8f10, 0x1521 on ETH; 0x39b3 on SPY;
   0x6ddb on NVDA; 0x6505 on GLD). Labelling them changes levels, not direction, and is not a gate on
   the raise.

---

## 3. The ladder

Rule: variance ratio (730 days of bars) sets the shape as the prior; each tier then sits at or above
its own 7d break-even with margin; variance stands in only where volume is too thin to measure.

| pool | current | first proposal | final | basis |
|---|---|---|---|---|
| SPY/USDG | 500 / 350 / 300 | 750 / 450 / 250 | **750 / 350 / 250**, with the bells: spikeMult 6, closedSpike 2100, descent 7200, closeFloor 1500, closeBefore 1800, closeAfter 0 | open break-even 759 (7d) / 418 (48h); overnight 173; closed 178. Bells from the measured 3.40x open and 1.77x close variance; two of three judges add them |
| NVDA/USDG | 700 / 400 / 300 + spike | 1000 / 750 / 300 + spike | **1000 / 750 / 300**, spikeMult 5, closedSpike 3750, descent 7200, closeFloor 2200, closeBefore 1800, closeAfter 0, as **stage 1**; **stage 2 to 1400 open dated two weeks later** unless the protocol trips | open break-even 2751; overnight 717 (the load-bearing tier: it carries 225k of 320k weekly dollars); 1000 alone leaves LPs at about 0.93x on surge volume |
| GLD/USDG | 500 / 350 / 300 | 1500 / 1000 / 300 | **1500 / 1500 / 300**, no equity bells, plus Sunday FORCE_OPEN day overrides so Sunday 18:00 to 24:00 ET prices at 1500 (fallback if the resolver test fails: closedFloor 800) | GC-filled variance flat across the weekday; open break-even 968; all closed-tier variance sits in the six Sunday hours at 1.77x the open hourly rate |
| META/USDG | 500 / 350 / 300 | 900 / 600 / 250 | **900 / 700 / 250**, inside the two-week protocol | open break-even 572; overnight 710 (higher than open: overnight volume per hour is a third of the open's); closed / open variance 0.03 |
| ETH/USDG | 450 + keeper | no change | **no change** to 450 or C; markouts first | the one pool we win on flow terms; effective C has no single baseline |
| AAPL, TSLA, SPY/GLD, NVDA/SPY | as is | in the batch | **out of the batch** | dust TVL; optional pre-sets if reseeded: AAPL 1000/400/250, TSLA 1200/500/300 with its bells, NVDA/SPY 700/450/250, SPY/GLD 700/450/250, each re-measured at seed time |

Every raise ships with: a dated two-week window, swap count and dollar share tracked separately
(after the census fix), a revert trigger on UniversalRouter dollar share, and per-tier realised fee
as the success metric until markouts exist.

Time-weighted pips over a normal week: SPY 394 (about 362 today), NVDA 741, GLD 1100, META 588.

---

## 4. Open items, ranked

1. **Per-window LP markouts** on ETH first, then SPY and NVDA. Split windows by fee level (450 floor,
   mid, 3000 cap); check whether volume times itself into floor windows given the public poke and
   TTL. Gates any change to C and settles whether the naive test overstates loss on this chain.
2. **Fix `ur_now.mjs`** to read the USDG leg per pool. Gates the dollar-share trigger for NVDA, GLD
   and META.
3. **Label the six contract senders** (aggregator carrying retail, arb, or points wash). Half a day.
   Moves levels, not direction.
4. **SPY bells decision.** On-chain SPY sample over 09:30 to 10:00 ET showing whether realised toxicity
   exceeds mid-session. Until then the bells go in on the measured underlying variance.
5. **Gold calendar in the hook.** Sundays and COMEX-open NYSE holidays can be handled today via
   `setDayOverrides` (FORCE_OPEN skips the weekend rule). Bytecode is needed for the daily 17:00 to
   18:00 ET break, Friday 16:00 to 17:00 ET, and any session over `MAX_SESSION_LENGTH` (12h); with a
   flat weekday ladder the cap is moot. Write the resolver test for the Sunday override first.
6. **Weekend gold variance.** The closed tier assumes zero outside Sunday evening. A PAXG or XAUt
   weekend series would set the real ratio and could move GLD's closed tier above 300.
7. **Why the UniversalRouter routes 61% of its SPY dollars to a 35 bps pool on $100 tickets.**
   Unexplained. If it is a routing-API quirk it can reverse, and with it the "raises lose no routed
   flow" inference.
8. **NVDA stage 2 date.** Set it when stage 1 ships.
9. **Rewrite the four stale sections of the review** (concession 10) and correct the k figures
   (`kall.json`: SPY 78.8, NVDA 20.7, within 5% of the quoted 82.1 / 20.3).
