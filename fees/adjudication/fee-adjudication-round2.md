# Fee adjudication, round 2 synthesis

Three judges (J1 LP economics, J2 competitive flow, J3 verification) ruled on the rebuttal to the round 1 synthesis. All numbers below were re-run locally by at least one judge; J3 additionally pushed the V2 ladder through the live `setPoolConfig` validator (all eight configs validate; time-weighted pips SPY 394, NVDA 741, GLD 1100, META 588).

## 1. Concessions C1 to C8

| Item | J1 (LP) | J2 (flow) | J3 (verification) | Consensus | Mean conf. |
|---|---|---|---|---|---|
| C1 SPY 350 / NVDA 750 overnight, 0.47/0.66 withdrawn | ACCEPT | ACCEPT | ACCEPT | Accept | 0.79 |
| C2 GLD variance on GC fill, flat weekday | ACCEPT-WITH-CHANGE | ACCEPT | ACCEPT-WITH-CHANGE | Accept with change | 0.78 |
| C3 UR share is 51% by count, 23% by dollars | ACCEPT | ACCEPT | ACCEPT | Accept | 0.96 |
| C4 Keeper not shown to clear LVR | ACCEPT-WITH-CHANGE | ACCEPT | ACCEPT-WITH-CHANGE | Accept with change | 0.78 |
| C5 Stale sections rewritten | ACCEPT | ACCEPT-WITH-CHANGE | ACCEPT | Accept with change | 0.85 |
| C6 Calendar mismatch is a contracts change | ACCEPT | ACCEPT-WITH-CHANGE | ACCEPT-WITH-CHANGE | Accept with change | 0.80 |
| C7 Dated window, count and dollar share, revert trigger | ACCEPT-WITH-CHANGE | ACCEPT-WITH-CHANGE | ACCEPT-WITH-CHANGE | Accept with change | 0.80 |
| C8 Dust pools out of the batch | ACCEPT | ACCEPT | ACCEPT | Accept | 0.83 |

## 2. Pushbacks P1 to P6

| Item | J1 (LP) | J2 (flow) | J3 (verification) | Consensus | Mean conf. |
|---|---|---|---|---|---|
| P1 Sign of any C change is open, not "down 30%" | UPHELD | UPHELD | UPHELD | Upheld | 0.73 |
| P2 No elasticity measured between 5 and 7.5 bps | UPHELD | UPHELD | PARTLY | Upheld (narrow claim); overreach noted | 0.63 |
| P3 Wash labelling is not a gate; higher fee shrinks wash | PARTLY | PARTLY | OVERRULED | Split: conclusion stands, mechanism rejected | 0.65 |
| P4 Variance sets shape, break-even sets open level only | PARTLY | PARTLY | PARTLY | Partly: rule is sound, V2 does not follow it | 0.65 |
| P5 NVDA/SPY cross: cheapest quote is not a reason | UPHELD | UPHELD | PARTLY | Upheld; the 700/700/250 number rejected | 0.67 |
| P6 GLD 1500 flat in one step | UPHELD | UPHELD | PARTLY | Upheld on direction; split on step size | 0.63 |

## 3. V2 ladder L1 to L6

| Item | J1 (LP) | J2 (flow) | J3 (verification) | Consensus number | Mean conf. |
|---|---|---|---|---|---|
| L1 SPY/USDG | MODIFY: 750/350/250 plus bells (spikeMult 6, closedSpike 2100, descent 7200, closeFloor 1500, closeBefore 1800, closeAfter 0) | ACCEPT: 750/350/250, no bells; omission must be a decision | MODIFY: 750/350/250 plus the same bells | 750/350/250 unanimous; 2 of 3 add the bells | 0.60 |
| L2 NVDA/USDG | MODIFY: 1400/750/300, spikeMult 5, closeFloor 3000; 1000 only as stage 1 with dated stage 2 | ACCEPT: 1000/750/300, spikeMult 5, closeFloor 2200 | ACCEPT: 1000/750/300, spikeMult 5, closeFloor 2200 | 1000/750/300 with bells (2 of 3); J1 wants 1400 or a dated stage 2 | 0.57 |
| L3 GLD/USDG | ACCEPT: 1500/1500/300, no bells | MODIFY: 1500/1500/300 plus Sunday FORCE_OPEN overrides; else 1500/1500/800 | MODIFY: 1200/1200/300 step one, 1500/1500/300 pre-declared step two | Flat weekday, 300 closed unanimous; three-way split on level and Sunday handling | 0.58 |
| L4 META/USDG | ACCEPT: 900/700/250 in two-week protocol | ACCEPT: 900/700/250, trigger on UR-dollar share only | ACCEPT: 900/700/250 in two-week protocol | 900/700/250 | 0.60 |
| L5 ETH/USDG | ACCEPT: no change, markouts first | ACCEPT: no change, markouts first | ACCEPT: no change to 450 or C | No change; per-window markouts first | 0.75 |
| L6 AAPL, TSLA, SPY/GLD, NVDA/SPY | ACCEPT: out of batch; optional variance-shaped pre-set | ACCEPT: out of batch | ACCEPT: out of batch | Unchanged, out of the batch | 0.78 |

## 4. Reasoning per item

### C1
All three reproduce the concession: be2.py prints SPY 1.00/0.24/0.28 and NVDA 1.00/0.23/0.05, and no local artefact produces the 0.47/0.66 in the addendum or R_01 lines 54-56. SPY overnight 350 is a 2x margin over the 173 pip 7d break-even (J3 re-derivation 163) and remains the cheapest non-dust venue in an ES-arb window. NVDA overnight 750 clears 717 (J3: 628, J1: 630 on kall k) and is the load-bearing tier for NVDA LP P&L, since the overnight tier carries 225k of 320k weekly dollars. All three note the justification is break-even on a non-open tier, which contradicts P4.

### C2
The GC fill reproduces exactly: tiervar_all_gc.json GLD overnight/open 1.04, closed/open 0.19, versus 0.83/0.07 on the ES fill; the 968/460 break-evens reproduce to within TVL rounding. Flat weekday is the right shape, since Asia and London hours are real gold price discovery and the arb channel (0x6505, 34.9% of GLD dollars) is most active overnight. Changes: the OVERNIGHT average includes thin GLD ETF prints for 16:00-18:00 ET (GC-only gives 0.89), the GLD series is missing a 15:00 ET bar so one OPEN hour is futures-filled, and the CLOSED figure assumes zero weekend variance outside Sunday 18:00-24:00 ET, so 0.19 is a floor. J2 adds that all CLOSED-tier variance sits in those six Sunday hours at 1.77x the OPEN hourly rate, which drives the L3 split.

### C3
Arithmetic on ur_now.json: ETH 1,426 of 2,772 swaps (51.4%) but $211k of $929k (22.7%); SPY 17.3% by count, 22.8% by dollars. Dollar share is the one that matters for both LVR and flow. J2 and J3 flag that the same file's dollar figures for NVDA, GLD and META are invalid (totV around 1e14) because ur_now.mjs divides amount1 by 1e6 while USDG is token0 on those pools.

### C4
Direction accepted: fee APR / k sits under sigma^2/8 on every local window (0.73% on 7d, 2.11% on 48h, 2.68% on 24h against 3.1-3.8%), and 7d fees of $1,847 compare with naive LVR of $7.5-9.1k. Two changes. The rebuttal's "1.55% on the 7d window" is DATA-PACK line 111 with no window stated and matches no local window. J1 adds that the naive test is an upper bound that ignores a 9-23 bps fee band on a sub-second chain, so the wording should be "cannot be assessed on the naive test; markouts are the only measurement". J2 notes the keeper is not losing flow (4.37x turnover vs 3.19x, UR grew through 17-23 bps hours), so nothing competitive argues for touching C.

### C5
All stale passages (FEE-AND-APR-REVIEW.md 107-119, 331-333, 410-412, 422, 520-524) are confirmed stale against tiervar (0.26x), the addendum, the UR census and DATA-PACK sections 3 and 9; the validator imposes no overnightFloor*spikeMult vs closedSpike relation. The 7d GLD split reproduces (29.8% / 53.9% / 16.3%). J2's change: "on 27 Aug Fables out-traded the incumbent" rests on a partial day; the daily GLD series swings from 1.3% to 66.9% in four days, so neither document should quote single-window GLD share.

### C6
The code facts hold: SessionLib.classify:91-94 returns CLOSED Friday close through Sunday, MAX_SESSION_LENGTH is 12 hours (MarketCalendar:112), the baked holidays are NYSE. J2 and J3 reject "contracts change, not config" as only half true: CalendarLib passes a FORCE_OPEN day override into SessionLib.classify, which skips the weekend rule, so Sundays and COMEX-open NYSE holidays can be priced at OPEN/OVERNIGHT today via setDayOverrides; with a flat weekday ladder the 12h cap is moot. What needs bytecode is the daily 17:00-18:00 break, Friday 16:00-17:00 ET, and (absent overrides) Sunday 18:00-24:00 ET. J1 sizes the current exposure at roughly $29/week (about 9% of GLD weekly LVR) with zero weekend volume in the 7d window, so it is real but small until weekend gold flow arrives.

### C7
Unanimously necessary and unanimously insufficient as written. J2 and J3: the dollar leg cannot run on NVDA, GLD or META until ur_now.mjs reads the USDG leg correctly. J1 and J2: the revert trigger must be on routed (UR) dollar share, not total share, because total share on these pools is dominated by a handful of contract senders (SPY 0x39b3 20.6%, GLD 0x6505 34.9%, NVDA 0x6ddb 31.7%) whose departure is the intended effect. J1 adds per-tier realised fee and per-tier LP markout as the success metric; J3 adds a per-tier break-even re-measure, since SPY's 750 open sits under its 7d break-even of 759.

### C8
At $1.0-2.3k TVL with k measured on 16-98 swaps, break-evens are ratios of dust volume that move 2x between windows (TSLA 2877 vs 4527, NVDA/SPY 561 vs 774), and there is no share to win or lose. All three accept. J1 adds an optional guard: pre-set variance-shaped ladders so a future seed does not land at a losing price (AAPL open sigma 32.5%, TSLA 66.3% vs SPY 19.5%).

### P1
Upheld unanimously. The only local LVR evidence says the keeper is under sigma^2/8 on every window, so the naive test points up; the fast-block argument says the naive test overstates loss by an unknown factor. Neither supports "down 30%", which is a mainnet literature prior (arXiv 2404.05803). Effective f/s^2 in the keeper series spans 0.17-0.68 around a 0.40 median with 27 cap hits in 7d, so there is no single C baseline to cut from. J1 adds that the cap (fee pinned at 3000) is where markouts are most informative, since the band there is widest relative to per-block sigma.

### P2
J1 and J2 uphold; J3 partly. J3's cited comparison is 625 vs 3499, a 5.6x gap, and the 3499 pool takes 74.8% of its dollars from the UR; J2 adds the UR sends 61% of its SPY dollars to the 35 bps pool, 32% to 625, 7% to Fables at 5 bps, so routed retail is not choosing by fee in this band. J1's LP asymmetry: V2 lifts SPY coverage from 1.19x to 1.39x at held volume and needs a volume loss above 28% to leave LPs worse off. J3's caveat: "essentially none to lose" overreaches, since UR is now 22.8% of Fables SPY dollars and the 500-pip v3 rival still does $193k/day on a third of the TVL, so C7 is what makes the inference acceptable.

### P3
Split on the mechanism, agreement on the conclusion. All three reject "a higher fee makes the wash dearer": points are pro rata on fees earned, so a washer with liquidity share s pays (1-s)fV and earns credit on sfV, both scaling with f, so cost per point is invariant to the fee level (J3 goes further: a raised pool takes a larger share of total fees, making it more attractive to wash). J1 and J2 keep PARTLY because the practical conclusion (do not wait; labelling 0xb055, 0x8f10, 0x1521, 0x39b3, 0x6ddb, 0x6505 is a half-day task) stands on P2 and on the fact that wash ends 5 October, so 7d break-evens rather than 48h should anchor levels. J2 adds that wash inflates per-tier volume and so understates every break-even, which strengthens the case for raising but means labels can change the level.

### P4
Partly, unanimously, and for the same reason: the rule is sound as a tie-break (730 days of variance vs one week of volume) but V2 does not follow it. SPY overnight is 0.47x open against 0.26 variance, NVDA 0.75x against 0.48, META 0.78x against 0.44; only GLD follows the shape. In each case V2 picked the higher break-even number, which J1 argues is correct for LPs because P&L is additive across tiers and NVDA's overnight tier at the variance-shaped 480 would sit under its 630-717 break-even. The restated rule all three converge on: variance sets the ratio as the prior, each tier sits at or above its own break-even with margin, and variance stands in only where volume is too thin to measure.

### P5
Upheld on the argument: being cheapest at $1k TVL buys none of the incumbent's $1.1M/day, so "already the cheapest quote" is not a reason to preserve 5 bps, and the cross belongs out of the batch. All three reject the 700/700/250 figure: the 561/742 break-evens rest on $1,030 TVL, 98 swaps and $32-62/hr of volume, flip between windows (561 vs 774), and a flat overnight contradicts the cross's 0.66 variance ratio. J1 suggests roughly 700/450/250 as a starting shape when seeded; J2 and J3 say no number is supportable until then. ProposedFees.t.sol:37 carries a third number (900/650/250).

### P6
Direction is unanimous: GLD open break-even is 952-968 on the GC fill, the 3000-pip venue holds 53.9% of 7d volume, and GLD LPs currently cover 0.65x of naive weekly LVR ($203 fees vs $311). J1 and J2 uphold 1500 in one step: LPs are better off unless volume falls by more than two thirds, the shed flow is identifiable arb (0x6505, 0x1521), and expected volume roughly halves on cleaner flow. J3 partly: "2x the break-even" is actually 1.55x at the open and 3.3x (7d) or 6.4x (48h) at the overnight, and nothing in the record distinguishes 1200 from 1500. J2 flags that the 3000 and 10000 pools' 08-21 to 08-25 volume could be points-era wash rather than proof of demand at 30 bps. The "largest GLD venue by 24h volume" headline will not survive either level.

### L1
The three tiers are unanimous: 750 clears the 48h break-even (418) and sits on the 7d one (759), 350 is 2x the overnight break-even, 250 near the closed one (178); time-weighted 394 pips against about 362 today. J1 and J3 modify to add the bells the V addendum measured (09:30-10:00 at 3.40x, 15:30-16:00 at 1.77x mid-session variance) and R_01 drafted, which ProposedFees.t.sol:31 and V2 dropped without saying so; the validator accepts 350*6 = 2100 and closedSpike 2100 above 750. J2 accepts without bells on flow grounds but says the omission should be a decision, and notes a 2100 opening descent would not lose routed flow since the UR already pays 35 bps on this pair. J3 flags that SPY's open is the only V2 tier set below its 7d break-even.

### L2
J2 and J3 accept 1000/750/300 with spikeMult 5, closedSpike 3750, descent 7200, closeFloor 2200: it validates (time-weighted 741), stays under the 3499 and 10990 NVDA pools on-chain, there is no routed share to lose (UR 6.3% of dollars, top senders are contracts), and closeAfter 0 matches the measured 0.51x post-close quarter hour. J1 modifies to 1400: NVDA is the one pool V2 leaves underwater by its own numbers (weekly LVR $287 vs fees $171; at 1000 with bells about 0.93x on surge volume), 1400 is what V's own script justified as the largest in-range step, and it lifts coverage to about 1.0x; 1000 is acceptable only as stage 1 with a dated stage 2. All three accept overnight 750 despite the P4 inconsistency.

### L3
Flat weekday and closed 300 against a 0.19 variance ratio are unanimous, and equity bells do not map to gold. Three-way split on the rest. J1 accepts 1500/1500/300 as the robust LP choice. J2 keeps 1500 but modifies the weekend: all CLOSED-tier variance sits in Sunday 18:00-24:00 ET at 1.77x OPEN hourly, so pricing it at 300 against a 1500 weekday is a 5x discount on the most toxic window of the gold week; fix with Sunday FORCE_OPEN overrides (four or five bits a month) or, failing that, closedFloor 800. J3 modifies the level: 1200/1200/300 as step one under C7 with 1500 pre-declared as step two, since the record does not distinguish the two and the one measured GLD win was earned at 3.9 bps realised.

### L4
Unanimous at 900/700/250 inside R's two-week protocol. 900 is 1.57x the 7d open break-even (572); 700 sits at the 7d overnight break-even (710, J3 re-derivation 648), the only V2 tier where overnight break-even exceeds open because overnight volume per hour is a third of the open's; 250 matches a 0.03 closed variance ratio and beats R's 500. Weekly coverage moves from 0.67x to about 1.3x at held volume. UR is 1.5% of META swaps, so the protocol's trigger must be on UR-dollar share or per-tier markout, otherwise it fires on arb departure, which is the intended effect.

### L5
Unanimous: no change to flatPips 450 or C. Fee APR / k is under sigma^2/8 on every window, effective C already spans 0.17-0.68, and ETH is the one pool Fables wins on flow terms (9.63 bps realised, 0% zero-fee swaps, 4.37x turnover). Markout design should split windows by fee level (450 floor, mid, 3000 cap), check whether volume times itself into floor windows given the public poke and TTL, and look hardest at the cap.

### L6
Unanimous: AAPL, TSLA, SPY/GLD, NVDA/SPY unchanged and out of the batch. Combined TVL under $6k, k on 16-98 swaps, break-evens moving 1.4-2x between windows. J1 offers starting shapes for reseeding (AAPL 1000/400/250, TSLA 1200/500/300 with existing bells, NVDA/SPY 700/450/250, SPY/GLD 700/450/250) as optional pre-sets, not conditions; J2 and J3 say price on own variance and a fresh break-even at seed time.

## 5. Factual errors in the rebuttal (deduplicated)

1. **C4, "1.55% against 3.81% on the 7d window."** DATA-PACK line 111 states no window. Locally 7d is 0.73% (32.5 / 44.3), 48h 2.11%, 24h 2.68%; 1.55% matches none. Conclusion survives. (J1, J3)
2. **P4, "a quarter to a half of open, which is what C1 now does."** V2 follows the variance shape only on GLD. SPY 0.47x vs 0.26, NVDA 0.75x vs 0.48, META 0.78x vs 0.44, P5's cross 1.0x vs 0.66; each was set by break-even, the method P4 reserves for the open tier. (J1, J2, J3)
3. **C1, NVDA overnight 750 justified by its 717 break-even.** Correct number, but the justification contradicts the rebuttal's own P4 rule, which would give roughly 480, under break-even. (J1, J3)
4. **P3, "a higher fee makes the wash dearer and shrinks it."** Points are pro rata on fees earned from a fixed pot; cost (1-s)fV and credit sfV both scale with f, so cost per point is fee-invariant, and a raised pool takes a larger share of total fees. Only small-share washers are deterred. (J1, J2, J3)
5. **P5, "should be priced around 700 / 700 / 250."** The 561/742 break-evens rest on $1,030 TVL, 98 swaps, $32-62/hr of volume, and flip between windows; a flat overnight contradicts the 0.66 variance ratio. ProposedFees.t.sol:37 carries 900/650/250. (J1, J2, J3)
6. **C2, GLD overnight 1.04 presented as a clean measurement.** The OVERNIGHT average includes thin GLD ETF prints for 16:00-18:00 ET (6.95e-6, 4.06e-6), the second in the CME daily break; GC-only gives 0.89. The GLD series lacks a 15:00 ET bar so one OPEN hour is futures-filled. The CLOSED tier assumes zero weekend variance outside Sunday evening, so 0.19 is a floor. (J1, J3)
7. **V2 SPY row "750 / 350 / 250" as the full proposal.** Omits the opening and closing bells the V addendum measured (3.40x, 1.77x) and R_01 drafted (spikeMult 6, closeFloor 2200); ProposedFees.t.sol:31 has spikeMult 0 and V2 does not say which shape it intends. (J1, J2, J3)
8. **V2 SPY basis "open break-even 759 (7d)" beside a 750 open.** 750 is under the 7d figure and clears only the 48h one (418); it is the one V2 tier set below its 7d break-even. (J3)
9. **C6, "a contracts change, not a config."** CalendarLib passes FORCE_OPEN into SessionLib.classify, which skips the weekend rule, so Sundays and COMEX-open NYSE holidays are fixable via setDayOverrides today; a flat weekday ladder makes the 12h cap moot. Only the daily 17:00-18:00 break, Friday 16:00-17:00 ET, and sessions over 12h need bytecode. (J2, J3)
10. **C5, "on 27 Aug Fables out-traded the incumbent."** Partial day (now.json fetched 11:20 UTC, $46.8k vs $21.7k); the incumbent had collapsed from $292k to $66k and did $564k against Fables' $285k the day before. (J2)
11. **C7, "count and dollar share tracked separately" as runnable.** ur_now.mjs divides amount1 by 1e6 on every pool while USDG is token0 on NVDA, GLD and META (toks.json d0 6), so totV is around 1e14 and dollar share does not exist for three of the four raised pools. (J2, J3)
12. **P6, "1500 flat is 2x the break-even."** 1500 / 968 = 1.55x at the open; at the overnight tier it is 3.3x the 7d (460) and 6.4x the 48h (233). (J3)

## 6. Still open

- **Per-window LP markouts.** Named by all three judges on C4, P1, L5 and every would-change-my-mind on the equity pools. Nothing about the sign of a C change, whether the keeper clears LVR on this chain, or whether the naive sigma^2/8 test overstates realised loss can be settled without them.
- **Elasticity inside the 5-15 bps band.** No before/after exists on any Fables pool. C7 is the only instrument, and it cannot run until ur_now.mjs is fixed and the trigger is redefined on UR-dollar share.
- **Why the UniversalRouter sends 61% of its SPY dollars to a 35 bps pool on $100 tickets.** Unexplained by any judge in either round; if it is a routing-API quirk it can reverse.
- **Sender labels** for 0xb055, 0x8f10, 0x1521 (ETH), 0x39b3 (SPY), 0x6ddb (NVDA), 0x6505 (GLD). Not a gate, but J2 shows they change the level: aggregator routes carrying retail put flow at risk; dominant-LP wash means every break-even is understated.
- **NVDA open level.** 1000 (J2, J3) vs 1400 (J1). Both agree 1000 leaves LPs at about 0.93x on surge volume; the split is on whether to take the second step now or date it.
- **GLD level and Sunday handling.** 1500 in one step (J1), 1500 plus Sunday FORCE_OPEN or a 800 closed floor (J2), 1200 then 1500 (J3). A resolver test showing Sunday FORCE_OPEN prices as intended would settle J2's branch; whether the 3000-pip pool's late-August volume is demand or wash would settle the level.
- **SPY bells.** 2 of 3 want them on; the deciding evidence is an on-chain SPY sample over 09:30-10:00 showing whether realised toxicity exceeds mid-session.
- **Weekend gold variance.** CLOSED tier assumes zero outside Sunday evening; a PAXG/XAUt weekend series would set the real closed/open ratio and could move GLD's closed tier above 300.
- **The P4 rule as applied.** All three ask for V2 to restate the rule it actually used (variance sets the ratio, break-even floors each tier) so the ladder and its stated method agree.
- **Reseed dates** for AAPL, TSLA, SPY/GLD, NVDA/SPY. Any commitment moves that pool back into scope with its own measurement.