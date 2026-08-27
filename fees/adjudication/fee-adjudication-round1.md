# Adjudication synthesis: fee-structure issues, Document R vs Document V

Judges: J1 (LP economics and microstructure), J2 (competitive positioning and flow), J3 (verification).

## 1. Verdict table

| Issue | Question | J1 | J2 | J3 | Consensus | Mean conf. |
|---|---|---|---|---|---|---|
| I1 | Is SPY 500/350/300 well set (R) or should it move to 750/450/250 (V)? | V | V | BOTH | V | 0.62 |
| I2 | Is NVDA 700/400/300 well set with TVL as the lever (R) or under LVR break-even and due for a raise (V)? | V | V | V | V | 0.63 |
| I3 | Should GLD level stay anchored to mainnet PAXG 5 bps (R) or rise toward 1500/1000/300 (V)? | V | V | V | V | 0.62 |
| I4 | GLD shape: flat weekday with weekend discount (R) or equity-style overnight discount (V)? | BOTH | R | V | SPLIT | 0.55 |
| I5 | Is the post-routing volume surge diagnosed enough to act on (V) or does it gate everything (R)? | BOTH | V | BOTH | BOTH | 0.58 |
| I6 | Is the calendar UTC-hardcoded and drifting in November (R)? | NEITHER | V | NEITHER | NEITHER (R's claim false) | 0.95 |
| I7 | Is AAPL well set at parity with the 90%-share rival (R) or should it move to 800/500/250 (V)? | V | R | UNDETERMINED | SPLIT | 0.48 |
| I8 | META raise: R's 1000/700/500 with test protocol or V's 900/600/250? | BOTH | R | R | R | 0.57 |
| I9 | Should the ETH keeper's C be recalibrated down ~30% now (R), or does the keeper already clear sigma^2/8 (V-side)? | R | R | R | R | 0.63 |
| I10 | Are TVL seeding and fee level orthogonal levers (R)? | V | BOTH | BOTH | BOTH | 0.60 |
| I11 | Does the evidence support R's "depth wins comparable-fee routed flow; ultra-low fee wins arb" law? | BOTH | BOTH | R | BOTH | 0.60 |

## 2. Issue-by-issue reasoning

### I1. SPY ladder (consensus V, 0.62)

All three judges reject R's "well set" on the open tier: be3.py gives a 7d open break-even of 8.2 bps against 5.00 charged (1.6x gap), with the post-routing 48h figure at 4.5 bps. J1 and J2 rule for V on that basis; J3 splits because the same data cuts against V's overnight tier: overnight break-even is 1.1-1.9 bps against 3.5 charged, so V's raise to 450 is not supported by V's own framework, and V's 0.47 overnight shape ratio reproduces from no file (be_all.json gives 0.23). J2 makes the same point and says the measured shape argues for roughly 750/250/250. The strongest flow evidence is J2's: the rival 34.99 bps SPY pool takes 74.8% of its dollars from the UniversalRouter and did $1.28M on 08-27, so routed flow is going to the most expensive pool and a 5 to 7.5 bps move cannot be what loses it. All three note V presents three different SPY ladders (1000/900/500, 900/450/250, 750/450/250) and that the 750 exists only in ProposedFees.t.sol:31.

### I2. NVDA level (consensus V, 0.63)

Unanimous: NVDA is the clearest LP-economics failure. be3.py puts open break-even at 27.0 bps (7d) / 22.4 bps (48h) against 7.00 charged, a 3.2x-3.9x gap; be2.py shows LVR APR 34.2% vs fee APR 20.8%, net -13.3. R's "the lever is TVL" would seed capital into a pool losing to LVR on every window. Fables holds 0.1-0.3% of the pair with UR at 10.1% of swaps, so there is no routed share to lose. The disagreement is magnitude: J2 and J3 both find V's overnight 750-900 unsupported (overnight break-even 3.3-6.2 bps; variance shape 0.15-0.23x open), and all three flag that V's body (line 313, "do not raise its level") contradicts its addendum (1400/900/250) and its test (1000/750/300).

### I3. GLD level (consensus V, 0.62)

Unanimous on direction: R's PAXG/USDC mainnet anchor is a venue this chain's flow cannot reach, and GLD open break-even is 998 pips (7d) / 408 (48h) against 500 posted and 3.9 realised. Same-chain venues charge 3000 and 10000 pips and the 3000 pool did $984k over 7d on $150k TVL, so demand exists at 30 bps. All three judges independently flag that V's "72% share / 7.6x too cheap" headline is stale: on 08-27 Fables did $135k-$144k against the incumbent's $54k-$66k, and over 7d the split is 53.9% vs 29.8%. J1 adds that GLD's overnight variance was built with an ES fill, not GC, so the overnight break-even level is less certain than V presents. J3 says a 3x raise in one step is not evidenced.

### I4. GLD shape (SPLIT: BOTH / R / V, 0.55)

The shared measurement is tiervar_all.json GLD: overnight/open variance 0.83, closed/open 0.068. J2 rules R because R's flat weekday matches the 0.83 ratio (gold price discovery runs ~23h) while V's 0.67 discounts hours the arb channel is live. J3 rules V because summing error across both tiers favours V (R's 0.60 weekend ratio is far above 0.068; V's 0.20 is closer) and the volume-weighted break-even ratio is 0.38-0.44. J1 lands on BOTH by the same two observations. All three agree neither document addresses the structural mismatch: the hook's CLOSED window runs Friday 16:00 ET to Monday 00:00 ET (SessionLib.classify:91-97) while gold reopens Sunday 18:00 ET, and J3 notes MAX_SESSION_LENGTH of 12h means a 23h gold session cannot be expressed. J2 adds that allvar.py fills CLOSED with zero except Sunday evening, so weekend LVR is probably understated for both.

### I5. Post-routing surge (consensus BOTH, 0.58)

The timing is nailed (approval Mon 08-24 ~05:00 UTC; ETH daily volume $53k, $101k, $411k, $953k on 08-23 through 08-26) and ur_now.json confirms UR is 51.4% of ETH swaps by count. But all three stress UR is only 22.7% of ETH dollars and 22.8% of SPY dollars; the rest sits in a few contract senders (0xb055 22.3%, 0x8f10 13.9% on ETH) consistent with arb responding to retail. J2 alone rules V, on the grounds that the flow at risk is demonstrably not fee-elastic, which is enough for direction; J2 also raises a point neither document makes: the surge coincides with the points programme start (24 Aug 02:00 UTC), which invites wash. J3 adds that ur_now.json volume shares for NVDA/GLD/META are invalid (wrong decimals leg, totV ~1e14), so only counts are usable there. Shared conclusion: act on shape and on tiers where the 7d break-even is unambiguous; treat 48h numbers as optimistic.

### I6. DST drift (consensus: R's claim is false, 0.95)

Unanimous on inspection: SessionLib.utcOffsetFromDate (lines 175-184) implements second-Sunday-of-March / first-Sunday-of-November, MarketCalendar exposes dstMode AUTO/FIXED_EST/FIXED_EDT (lines 44, 136-140), and a test anchors winter and summer instants. The switch is day-granular but both switch days are Sundays when every tier is CLOSED. J1 and J3 label it NEITHER since V makes no DST claim; J2 credits V because DATA-PACK line 50 states it correctly. J2 notes the only real calendar gap for gold is holidays: the baked table is NYSE and COMEX trades on several NYSE holidays.

### I7. AAPL (SPLIT: V / R / UNDETERMINED, 0.48)

The pool is $2.3k-$2.6k TVL, $2.8k-$2.9k/day, k measured on 33 swaps, so all three call the question nearly academic. J2 rules R because at exact 5 bps parity the share gap is depth (1/30th of rival TVL), and a raise neither gains nor loses routed flow. J1 rules V because be_all.json puts AAPL open break-even at 12.5-22.6 bps and overnight at 7.6-10.1 bps, so R's framing would seed capital into a pool priced below LVR. J3 says neither has evidence that matters at this size and R's rival figures cannot be verified locally. All three converge on one point: if AAPL is ever reseeded, price it to its own variance (sigma 32.5% vs SPY 19.5%), not copied from SPY.

### I8. META (consensus R, 0.57)

Both documents raise to roughly the same open level and both cite 30-35 bps rivals. R wins on specification: a two-week window, a share metric and a >20% share-loss revert trigger (R:87, 112); V's 900/600/250 appears only in ProposedFees.t.sol:36 with no META section in the document. But all three judges prefer V's shape: measured closed/open variance is 0.03, so R's 500 closed tier taxes a dead weekend; and be_all.json puts overnight break-even (710 pips) above open (572), which neither ladder reflects. J1's BOTH and the other two R verdicts share the same prescription: V's numbers inside R's protocol, with J1 wanting the success metric switched to LP markout. J2 notes UR is 1.5% of META swaps, so the share trigger would mostly measure arb departure.

### I9. ETH keeper recalibration (consensus R, 0.63)

Unanimous, but on narrow grounds: R's own ranking (R:115) puts markouts first and recalibration second, and the V-side claim that the keeper clears sigma^2/8 is contradicted by every window. Fee APR / k is 0.73%-0.77% (7d), 2.11% (48h), 2.68%-3.06% (24h) against a sigma^2/8 of 3.1-3.8% at 50-55% realised vol; DATA-PACK line 111 shows 1.55% vs 3.81%. All three add that R's "down ~30%" is a mainnet literature prior (arXiv 2404.05803, not verifiable locally), not a measurement on this chain, and cutting C on a pool that already fails the naive test would widen the deficit. J3 notes effective C already varies (f/s^2 median 0.40, range 0.17-0.75) so any recalibration must first pin what C currently is; J1 notes the fee pins at the 3000 cap repeatedly, which is where a markout is most informative.

### I10. TVL vs fee orthogonality (consensus BOTH, 0.60)

Mechanically distinct (TVL wins routed flow, fee prices arb), but not sequence-independent. Seeding NVDA at 7 bps against a 22-27 bps break-even with 26-32% of flow from identified arb contracts transfers the seed to arbitrageurs, so fee must move before capital; J1 rules V on that alone. J2 and J3 both surface a conflict neither document mentions: R's pitch for the SPY/NVDA cross is "already the cheapest quote" at 5 bps vs the 6.25 bps incumbent, while ProposedFees.t.sol:37 raises the cross to 900/650/250. J2 calls that conflict rhetorical (being cheapest does not win routed flow); J3 calls it direct.

### I11. Depth-versus-fee law (consensus BOTH, 0.60)

The first half (depth wins routed flow) is supported strongly: the 34.99 bps SPY pool with $720k TVL takes 3,673 of the UR's SPY swaps and 74.8% of its own dollars from the UR, and the 500-pip NVDA v3 with 70x Fables' depth holds 96-99%. J1 and J2 say the "comparable-fee" qualifier is unnecessary and the law's implication cuts the other way: if cutting buys no routed flow, raising loses none, which is V's conclusion. J3 rules R because within SPY at comparable depth the 625-pip pool holds 70% vs 20% for the 3499 pool, so fee does move share among comparable depths, and UR now carries 17-51% of Fables swaps, which supersedes V's "we have essentially none to lose." All three flag the same unknown: nobody has explained why the UR prefers a 35 bps pool on small tickets.

## 3. Factual errors (deduplicated)

| Doc | Claim | Correction | Evidence |
|---|---|---|---|
| R:107 | Calendar is UTC-hardcoded; drifts 1h in November | US DST rule implemented; dstMode AUTO default with FIXED_EST/FIXED_EDT override; no drift | SessionLib.sol:175-184; MarketCalendar.sol:44, 136-140; SlitherFalsePositives.t.sol:172-192 |
| R:67-68, 73, 115 | 5 bps ETH/USDC fees = ~80% of LVR; fast blocks cut arb loss 20-70%; hence recalibrate C down ~30% | Not verifiable locally; a literature prior, not a measurement on this chain | No local artefact; lvr24h.json effective C already 0.17-0.75 |
| V:319-333 | SPY overnight is 92% as volatile as the session; raise overnight to 420-460 | 730-day measurement: overnight variance 0.26-0.29x open (sigma 10.0-10.6% vs 19.5-19.7%); overnight break-even 1.1-1.9 bps vs 3.5 charged. Addendum reverses this but the section still stands | tiervar_all.json SPY; be3.py; V:475-478, 489-493 |
| V:489-493; R_01 script:54-56 | Break-even shape SPY 1.00/0.47/0.28, NVDA 1.00/0.66/0.05 | No local artefact reproduces 0.47 or 0.66; be2.py and be_all.json give SPY 1.00/0.23-0.24/0.28 and NVDA 1.00/0.23-0.26/0.05-0.06. Every V overnight tier inherits the overshoot | be3.py; be_all.json |
| V:278-288, 362-363 | 3000-pip GLD pool holds 72% at $592k/24h, Fables 17.6%; "7.6x too cheap" | Window-dependent. 7d to 08-27: v3-3000 53.9%, Fables 29.8%; 24h: Fables 70.6% ($135,357 vs $54,451). 7.6x is a ratio of posted tiers | now.json; DATA-PACK.md:15, 129, 139, 275-277 |
| V addendum:468; R_01:26; DATA-PACK:72 | Dark hours filled with ES/GC futures | allvar.py fills every asset including GLD with ES scaled by pre-market ratio; GC_F is loaded (line 8) and computed (line 35) but never used in tiervar() | allvar.py:8, 35, 37-52 |
| V:410-412, 422; 343, 375 | closedSpike is inert and must exceed overnightFloor*spikeMult | Withdrawn by V's addendum (507-516); validator imposes no such relation; Monday open measures 0.91x-0.94x a routine open. Body still carries it | FablesRWA.sol setPoolConfig; RecalibrationNvdaSpy.t.sol:102-112 |
| V:107-119 | Hooked/dynamic-fee pools are excluded from the Uniswap quoter | Falsified: UR sends 51.4% of Fables ETH swaps and 17.3% of SPY swaps post-approval; hooked rival 0x7266 does $3.66M/day | ur_now.json; DATA-PACK.md:36, 286 |
| V and DATA-PACK | UR carries 51.4% (51.6%) of ETH/USDG swaps | True by count (1,426 of 2,772) but 22.7% by dollars ($211k of $929k) | ur_now.json |
| V-side framing | ETH keeper clears sigma^2/8 | Fee APR / k is 0.73-0.77% (7d), 2.11% (48h), 2.68-3.06% (24h) vs 3.1-3.8% break-even; DATA-PACK line 111: 1.55% vs 3.81% | res.json; now.json F-ETH; lvr7d.json |
| V:520-524 | "What shipped": SPY to 900/450/250, NVDA to 1400/900/250 | Nothing shipped; live configs remain 500/350/300 and 700/400/300 | DATA-PACK.md sec 3, sec 9 |
| V:490 | k measured live SPY 82.1, NVDA 20.3 | kall.json: SPY 78.8, NVDA 20.7; within 5% | kall.json |
| V (ur_now.json census) | Volume shares for NVDA/GLD/META | Script assumes amount1 is 6-decimal USDG; wrong for those pools, totV ~1e14. Only counts valid | ur_now.json; ur_now.mjs |

## 4. What neither document establishes

- Per-window LP markouts on any pool. Every judge names this as the thing that would change their mind on I1, I2, I3, I8 and I9. The sigma^2/8 * k test is the only LVR evidence in play and nobody has measured realised loss under fast blocks and the fee band.
- Whether the large non-UR contract senders (0xb055, 0x8f10, 0x1521, 0x39b3, 0x6505, 0x6ddb) are adverse arb, aggregator routes carrying retail, or points-programme wash. This determines whether the 48h break-evens are trustworthy and whether the surge persists.
- Why the UniversalRouter routes 74.8% of the 34.99 bps SPY pool's dollars to it when a quoter should penalise 35 bps on $105 median tickets. Until diagnosed, "raising loses no routed flow" is an empirical regularity, not a rule.
- Fee elasticity of Fables' own routed share. No controlled before/after on any pool; V's "no share lost" is cross-sectional and V calls it its own largest weakness.
- GLD's true overnight and weekend variance. The tier data is ES-filled, not GC-filled, and the weekend is assumed zero outside Sunday evening while tokenised gold trades all weekend.
- A hook calendar for gold. CLOSED runs Friday 16:00 ET to Monday 00:00 ET, gold trades Sunday 18:00 ET onward, MAX_SESSION_LENGTH is 12h, and the holiday table is NYSE not COMEX. Neither document proposes a fix.
- What C the ETH keeper currently runs. Effective f/s^2 spans 0.17-0.75, so "recalibrate C down 30%" has no defined baseline.
- A single V ladder. SPY has three candidate ladders and NVDA has a body that says do not raise, a test at 1000/750/300 and a script at 1400/900/250; the overnight tiers in all of them rest on the unreproducible 0.47/0.66 shape.