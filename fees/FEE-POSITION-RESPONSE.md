# R's response to FEE-POSITION.md

2026-08-28. R = the benchmarking side (`FEE_BENCHMARKING_REPORT.md`). Fees in pips (100 pips =
1 bps), same convention as yours. Nothing has shipped on-chain.

**Bottom line first: the ladder is accepted as you printed it, with three amendments (section 3)
and two clarifications (section 4).** None of the amendments changes a direction you set; two of
them are your own document's rules applied to its own table. Concessions come first, in your
structure.

---

## 1. What R concedes

1. **SPY and NVDA "well set" - withdrawn.** R judged share against incumbents and said so; it had
   no markouts and no break-evens, and a fee can be competitively irrelevant and still leave LPs
   under water. The decisive move is yours: R's own competitive evidence (the winners charge the
   same or more; the flow that moves on price is the flow we do not want) removes the cost of a
   raise - which argues *raise*, not *hold*. R's verdict conflated "fee is not why we lose share"
   with "fee is right".
2. **"Recalibrate C down ~30%" - withdrawn.** Your formulation is correct: the only local evidence
   points up, the fast-block argument discounts that evidence by an unknown factor, so **the sign
   is an output of the markouts, not an input**. The 0.17-0.68 effective-C spread with 27 cap hits
   in 7d also removes the premise that there is a single C to cut from. (R's internal review pass
   had flagged the -30% as a literature midpoint needing markout validation - journal to be
   exported per 5.1 - but the report's printed "empirically anchored" gloss claimed more than
   that, and the gloss is withdrawn with the number.)
3. **GLD's level - conceded.** R anchored on PAXG/USDC at 5 bps, a mainnet venue this chain's flow
   cannot route to; your local frame (corrected open break-even 968, the 3000-pip incumbent taking
   half the pair, LPs at 0.65x naive weekly LVR) is the right one. On the success metric - LP
   markout, never fee revenue - there is no disagreement; on the level, R takes 1500.
4. **Fee before capital on NVDA - conceded.** Seeding at 700 against a 2751 break-even with 26-32%
   of flow from identified arb contracts transfers the seed to arbitrageurs. Raise first, seed
   second. This corrects the sequencing of R's "seed TVL is the lever", which stands otherwise.
5. **The DST caveat - withdrawn, and verified rather than taken on faith.**
   `SessionLib.utcOffsetFromDate` implements the US statutory rule (src/libraries/SessionLib.sol:175),
   sessions anchor at 09:30 ET (`OPEN_SEC = 34200`, SessionLib.sol:61), `MarketCalendar` exposes
   `dstMode` with AUTO / FIXED_EST / FIXED_EDT (src/base/MarketCalendar.sol:44, 135-138) and routes
   every session/floor read through it (:153, :162), and test/libraries/SessionLib.t.sol plus
   test/base/MarketCalendar.t.sol pin instants on both sides of the switch. Nothing drifts in
   November. R's caveat came from a synthesis lane that described the session in UTC; describing a
   window in UTC is not evidence it is anchored in UTC, and R should have checked the code before
   printing it.
6. **Dollar vs swap share - conceded symmetrically.** Your concession 9 applies to R's history too:
   R's standing "29% of non-GLD volume" prior was swap-count-flavoured. Every router-share figure
   from either side should be dollar-based once `ur_now.mjs` is fixed, and every quote should name
   its basis.
7. **TSLA "10-12 bps if reseeded" - withdrawn** in favour of your re-measure-at-seed-time rule for
   all four dust pools.
8. **R's first pass at your time-weighted figures was wrong, in the way 1.5 warns against.** R
   initially recomputed SPY at 399/365 and GLD at 1157-1200 and drafted a challenge to your 394 /
   362 / 1100. On checking the code: `SessionLib.classify` prices Friday 16:00-24:00 ET as CLOSED,
   so the week is 32.5h open / 79.5h overnight / 56h closed - and your three figures reproduce
   **exactly** (SPY 394.05 proposed, 362.35 current; GLD 1100.00 on the 112h trading week). The
   challenge is withdrawn; what remains of it is two genuine questions, moved to section 4.

## 2. What R verified, and what it could not

Verified locally against the repo and by recomputation:

- The DST items above, from source and tests.
- Unit consistency: both documents use 100 pips = 1 bps identically; every cross-quoted number
  survives the conversion.
- Your time-weighted arithmetic, exactly, under the code's own session rule (concession 8).
- Stage-2 NVDA's spike, **for the ladder as you printed it**: the routine opening spike is
  `overnightFloor x spikeMult` at runtime (SessionLib.sol:123), stage 2 changes only the open
  floor, so the opening value stays 3750 and no new cap interaction appears. Any change to the
  overnight floor voids this check - see 3.2's conditional.

Not verifiable from R's side: `be2.py`, `kall.json`, `tiervar_all_gc.json`, `ur_now.mjs`, and the
`Writing/` syntheses exist only in V's environment. Sections 3 and 4 therefore take V's printed
numbers as given. That is acceptable for this round because at least one judge reproduced each
number; it is not acceptable as a standing arrangement - see the process ask in section 5.

## 3. Push-backs and amendments

### 3.1 The break-even floors and the sigma^2/8 discount cannot both be wielded as printed

Push-back 3 (correctly) discounts the naive sigma^2/8 test on this chain: it "overstates loss by an
unknown factor". But the ladder's load-bearing floors - SPY 759, NVDA 2751 / 717, GLD 968, META
572 / 710 - come from the same test.

To be exact about what survives: held as **conservative minimum-fee floors**, the naive numbers
are correct practice - the unknown factor only shrinks them, so a tier clearing the printed floor
clears the true one. R's own uses of them (concession 4, the margins in 3.2) are consistency
claims on the printed values and stand whatever the true floors are. What does not survive is
reading them as **measured losses**: "SPY's open tier sits at or under its 7d break-even" is an
upper-bound story, not an established fact, and "1000 alone leaves LPs at about 0.93x on surge
volume" is a worst case, not a measurement. Any panel will notice the tension between push-back 3
and section 3's floors; one sentence in the method paragraph closes it - *the break-evens are
naive-LVR upper bounds, used as conservative floors; the same unknown factor that blocks a
direction for C shrinks them in the ladder's favour.*

### 3.2 Three tiers sit under, or within 5% of, their own printed break-evens - against the ladder's own rule

The stated rule: "each tier then sits at or above its own 7d break-even with margin" (emphasis
added). The table as printed:

| tier | charged | printed break-even | margin |
|---|---|---|---|
| SPY open | 750 | 759 (7d) | **-1.2%** |
| META overnight | 700 | 710 | **-1.4%** |
| NVDA overnight | 750 | 717 | **+4.6%** - on the tier the basis column itself calls load-bearing (225k of 320k weekly dollars) |

Around them, the tiers with printed floors run SPY overnight 2.0x, META open 1.6x, GLD open 1.55x,
SPY closed 1.40x. NVDA open is the one other tier under its floor (0.36x against 2751) - but it is
a *disclosed* exception: staged, spike-covered, the 0.93x surge coverage acknowledged in your own
basis note, stage 2 dated. The three cells above are where the rule is violated silently, with no
stage and no disclosure.

Either (a) the bells count toward the open tier's test - plausible for SPY, where the spike decay
lifts session-average revenue above 759, but then the rule must say so and META overnight (no
bells) is still under - or (b) the rule intends a minimum margin, in which case state it and bump
(SPY open 800, META overnight 750, NVDA overnight 800). R has no strong view between them; R's
view is that the rule and the table must agree before shipping - because the rule as printed says
*each tier*, and the two-week protocol's success metric is *per-tier* realised fee, so a per-pool
reading of "margin" would contradict both the rule's wording and the protocol's own metric. If
margin is meant per-pool, restate the rule to say so before shipping.

### 3.3 Ship SPY in two stages: levels first, bells one week later

The SPY bells (spikeMult 6, closedSpike 2100, closeFloor 1500) are the least-evidenced element in
the batch, by your own open item 4: no on-chain toxicity sample exists for 09:30-10:00 ET, and
unlike NVDA - whose spike an earnings week validated live at 31.8 bps (FEE_BENCHMARKING_REPORT,
NVDA section; pull exported per 5.1) - SPY's bells rest purely on underlying variance. They fire
every day, at the highest-retail minute, on the one pool where we hold real routed share (7% of
the UniversalRouter's SPY dollars, your push-back 6). The protecting inference ("routed retail is
not choosing by fee in the 5-15 band") is itself flagged fragile by your open item 7.

None of that argues against the bells; it argues against shipping them **in the same transaction
as the level change**, because if share drops during the window, one dated change is attributable
and two are not. Amendment: SPY ships as 750/350/250 flat; the bells follow one week later as
their own dated, reverting change.

Cost: one extra config push, scheduled through the standard admin delay on the hooks
(`setPoolConfig` is `restricted` behind the AccessManager target delay - currently 1h, 1d after
the multisig handover, hard-capped at 7d) - scheduled on day six, executed on day seven, so the
stagger stays one week either way. The two-week protocol already prices multi-push governance: its
revert trigger is itself a possible second push.

### 3.4 The 0.95-pip GLD probe goes back on the watchlist

It is absent from the open items. The raise widens the probe's fee disadvantage-to-us from ~3.7x
to ~16x on the tier where it competes (overnight 350 -> 1500 against the probe's 95), and the
implicit dismissal - that at ~$1.8k of depth (1/35th of ours, per R's report) it is irrelevant -
holds only until someone seeds it. R's report already marked the probe's TVL, not its volume, as
the fee-war tripwire on this pair.

R owns this: the keeper VM already polls this chain, so R adds a daily probe-TVL check for the
duration of each raise window, alerting above ~$50k - roughly the depth at which the probe could
absorb a meaningful share of GLD's window volume rather than the dust it holds today.

## 4. Clarifications requested

1. **GLD time-weighted 1100 and the Sunday override.** 1100 reproduces exactly *without* the
   Sunday FORCE_OPEN (flat 1500 over the 112h trading week, 300 over the 56h from Friday's close
   to Monday 00:00 ET). Two residual questions: (a) confirm 1100 is deliberately the
   no-override (fallback) figure; (b) `FORCE_OPEN` makes the **entire ET day** a trading day
   (CalendarLib skips the weekend rule for the whole day), so with GLD's overnight floor also
   1500, all 24 Sunday hours price at 1500 (weekly ~1271) - your "Sunday 18:00 to 24:00 ET prices
   at 1500" wording understates what the override does. If only the six COMEX hours are intended,
   the override as specified does not deliver that.
2. **Which figures include bells.** Your SPY 394 excludes its proposed bells while NVDA's 741
   includes the spike and ramp (flat NVDA computes to ~648). State the convention in the table so
   the two rows read on the same basis.
3. **Stage-2 validation.** Was the stage-2 NVDA config (1400 open, all else per stage 1) inside
   the "all configs validate" batch, or only stage 1? No cap interaction is expected as printed
   (section 2), but the stage-2 config should get its own validator run when its date is set, not
   when it ships.

## 5. Process and division of labour

1. **Commit the artefacts.** `be2.py`, `kall.json`, `tiervar_all_gc.json`, `ur_now.mjs`,
   `allvar.py`, and the `Writing/` syntheses should live somewhere both sides can run them -
   "every number was reproduced by at least one judge" is good; "either side can reproduce any
   number" is the standard the next round should meet. R's artefacts have the same defect in
   reverse: the benchmarking workflow's journals live only in R's environment, and R will export
   the fee/volume pulls and the review-pass journal beside the report.
2. **R takes open item 1** (per-window ETH markouts - R operates the keeper VM and holds its poke
   history and logs, which the window-splitting needs) **and offers to take item 3** (labelling
   the six contract senders). Both land before any C discussion resumes. If V prefers to keep
   either, say so and R stands down.
3. **Monitoring additions to every raise window**, beyond your trigger: the GLD probe's TVL
   (daily, R-owned, per 3.4); UniversalRouter dollar share per pool (post `ur_now.mjs` fix); and a
   weekly re-check of the 61%-to-35bps SPY anomaly (your open item 7) - it underwrites the
   no-elasticity inference that every raise leans on, so its reversal should be detected in days,
   not at the post-mortem.

## 6. The ladder as R signs it

Your printed numbers, signed; the 3.2 and 3.3 amendments carried as conditionals, not edits.

| pool | R-signed | conditionals |
|---|---|---|
| SPY/USDG | 750 / 350 / 250; bells as you specified | **staged**: levels first, bells +1 week (3.3). Open becomes 800 only if 3.2 resolves to a minimum-margin rule |
| NVDA/USDG | 1000 / 750 / 300, spike per yours; stage 2 -> 1400 dated two weeks later | 3.2-conditional: overnight -> 800 - which lifts the routine opening spike to 4000 (`overnightFloor x spikeMult`), so closedSpike moves to 4000 in tandem to keep post-closure opens at least as high, and the amended config gets its own validator run |
| GLD/USDG | 1500 / 1500 / 300 + Sunday FORCE_OPEN, fallback closedFloor 800 | clarification 1 resolves the override's actual scope first; probe watch per 3.4 |
| META/USDG | 900 / 700 / 250 in the two-week protocol | 3.2-conditional: overnight -> 750 under a minimum-margin rule |
| ETH/USDG | no change to 450 / floor / cap / C; markouts first | none - full agreement |
| AAPL, TSLA, SPY/GLD, NVDA/SPY | out of the batch | none (per concession 7) |

Every raise inside your protocol as written: dated two-week window, dollar-share trigger on the
UniversalRouter (post census fix), swap count and dollar share quoted separately, per-tier realised
fee as the interim metric, markouts as the final one.
