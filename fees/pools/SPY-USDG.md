# SPY/USDG

Measured 2026-08-30 from raw chain data: 206,361 swaps across all eight SPY venues over 48h, plus a
7d session split on the hourly buckets. Method and provenance in [README.md](README.md).

Fees in pips: 100 pips = 1 bps = 0.01%. Current config `500 / 350 / 250` open / overnight / closed,
resting at 250 as this is written, hook `0xA0E8fBFf13E24Af2b5e61A72800E08a161bDe080`, cap 8,000,
pokeFloor 250, `protocolFee = 0`.

---

# Propositions

Ordered by measured effect. Each states the number it moves and the number it costs.

### P1. Cap the calendar ladder at 600 pips. Nothing on SPY should rest above it.

A trader who will not pay our price has a route that always exists: USDG to WETH at 100 pips
(a $7.7M pool doing $1.22bn a week) then WETH to SPY at 500. **All-in 600 pips.** Every calendar
tier above 600 is dominated by a two-hop alternative and prices us out rather than making us dear.

Measured: our 800-pip session tier ran for 6 hours and took **1.8% share on $72,368 of volume for
$57.89 of fees**. It is the worst-performing setting on the book.

This bounds the calendar base only. It explicitly does **not** bound the deviation term (P6).

### P2. Move the resting tiers toward 400, not away from it.

Our own demand curve, 167 hourly observations, fee against share of all chain SPY volume:

| we charge | hours | our volume | mean share | fee x share |
|---|---|---|---|---|
| 250 | 38 | $3,314,735 | 12.2% | 3,050 |
| 350 | 77 | $1,414,994 | 9.2% | 3,220 |
| 450 | 4 | $108,999 | 8.4% | **3,780** |
| 500 | 24 | $288,502 | 4.9% | 2,450 |
| 800 | 6 | $72,368 | 1.8% | 1,440 |

Revenue peaks near 400 to 450. Both ends of the current ladder sit off it: 250 is too cheap, 800 is
far too dear. Proposed `450 / 400 / 350` against today's `500 / 350 / 250`.

Worth **+21% to +42%** on fee revenue, which takes the 48h time-weighted APR from 99.3% to roughly
120% to 141%. Honest caveat: the 450 row is 4 hours, so treat the top of that range as soft, and the
fee level is confounded with the session because 250 only ever happens when the market is shut.

### P3. This is not enough to reach first place, and pretending otherwise wastes the quarter.

To pass the deepest USDG rival at 143.3% we need `turnover x fee x LP-share` of 7,850 against our
5,444, a **44% lift**. P2 delivers most of that. To pass the actual leader, v3 WETH/SPY at 563.6%,
we need **4x the turnover**, which is a routing and product problem, not a fee problem.

### P4. Open a WETH/SPY pool. It is the single largest lever on the board.

**49.1% of all SPY volume on chain over the 48h never touched a USDG pool.** It went through
v3 WETH/SPY: $17.4M of $35.4M, rising to 52.1% in closed hours. We do not quote that pair, so about
half the market is unreachable at any price we set.

The incumbent there is a plain 500-pip v3 with no session logic, no deviation term and 75% LP
retention. It is the weakest competitor on the board and it is beating every other venue on APR.

### P5. Stop stacking capital into a pool that already turns it over faster than its rivals.

APR is per dollar. Our working depth quadrupled inside 48 hours, $15.8M to $74.1M, while session
flow did not follow. We already run **0.234 volume per dollar of working depth against the 625
pool's 0.063 and the 3499 pool's 0.007**. Incremental TVL into SPY/USDG dilutes the number we are
trying to raise. If capital is arriving anyway it belongs in the WETH pool from P4.

### P6. Let the deviation term carry the adverse-selection insurance, and take it off the base.

See the next section. This is what makes P2 safe.

### P7. Publish LP-net, not charged.

We are the only pool on chain with `protocolFee = 0`. Rivals keep 75% to 86% of what they charge.
That is a standing 20% to 25% relative advantage we already own and currently do not count.

### P8. Retire the dust crosses.

NVDA/SPY and SPY/GLD hold $4,395 and $1,073 and produced $2 and $1 over a week.

---

# How the deviation fee changes this

Read [../deviation/DEVIATION-FEE.md](../deviation/DEVIATION-FEE.md) first. Three of the propositions
above interact with it, one is unaffected, and on one parameter the measurement here disagrees with
what that document proposes for SPY.

### It resolves the trap that P2 would otherwise walk into

Without a deviation term there is a structural problem on SPY: the revenue-maximising session fee is
about 450 while the naive-LVR break-even for the open tier is **759 pips** (7d, reproduced from
`be_all.json`). No single session price both wins flow and covers adverse selection. On that reading
the 800 tier is not a mistake at all: it is a decision not to compete in-session, priced above
break-even so the little flow that arrives is profitable.

The deviation term dissolves the trap, because adverse selection is not uniform across the session.
It is concentrated in the minutes after the reference moves, and **`RHSPY / USD` is live during
market hours**, which makes SPY effectively Mode A in-session rather than Mode B. So the pickoff can
be priced where it happens instead of being smeared across every session hour as a flat 800 that
benign retail also pays. That is precisely the intra-session discrimination this analysis wanted and
could not justify without markouts: the deviation term supplies the signal for free.

**So P1 and P2 are only safe with P6 shipped.** Cutting the session tier to 450 with no deviation
term is buying toxic flow at a loss. Cutting it to 450 with the term armed is repricing benign flow
correctly while the arb still pays the ramp.

### P1's 600-pip ceiling does not bind the deviation term

The ceiling is a statement about routine flow, which can route around us. Dislocation flow cannot:
to capture our mispricing an arbitrageur has to trade our pool, and the two-hop route does not help
them. `DEVIATION-FEE.md` makes the same argument for GLD from the other direction, and the GLD event
proves it empirically, since a 20x fee increase to 6,000 pips still drew $908,386 of volume.

So: **calendar base capped at 600, deviation ramp free to run to the 8,000 hook cap.** The two
numbers are not in conflict because they price different flow.

### Where the measurement disagrees with the proposed SPY parameters

`DEVIATION-FEE.md` section 10 proposes for SPY: Mode B, kick 3%, full 5%, **base 0.30% / 0.30%**,
cap 8,000. The base is 3,000 pips in and out of hours.

That is 5x the two-hop ceiling and 12x where the pool rests today. At our depth it would take our
share to near zero: we measured 1.8% at 800 pips.

The counter-example deserves stating, because it is real. The v4 3499 pool charges 3,499 pips and
holds 18.6% to 24.4% share. So a 0.35% resting fee is demonstrably survivable on SPY. But that pool
carries **$662.9M of working depth against our $15.8M, 42x more**. A 3,000-pip base is a
depth-conditional parameter, and we do not have the depth to hold it. `DEVIATION-FEE.md` says these
are "to be confirmed per pool before each one goes live"; this document is that confirmation, and
the answer for SPY is the measured revenue peak, not 3,000.

### The "never price the blind window cheapest" rule, applied honestly to SPY

That rule exists because it is exactly what cost GLD its book: the closed tier, the one window with
no reference price, shipped at 300 pips. **Our SPY closed tier at 250 is the same shape.** The hole
is real and it has simply not been walked through yet.

Two things make SPY's version of it much smaller, and both are measured rather than assumed:

1. **SPY's weekend gap risk is 2.5x smaller than gold's.** Weekend gap p99 2.40% and max 3.37% over
   730 days, against GLD's 6.05% and 8.40%. So the blind band that has to be tolerated is narrower.
2. **SPY did not dislocate over this weekend.** Against the Friday close of $769.35, the Fables pool
   ran a median absolute deviation of **0.36% and a maximum of 0.74%** across all 49 scanned hours,
   and the three deepest rivals tracked within a few cents of us the whole way. A 3% kicker would
   never have fired. The deviation term is close to free on SPY in normal conditions, which is the
   best possible argument for arming it.

The resolution between P2 and the rule: **raise the closed tier for revenue and let the deviation
term, not the base, carry the tail.** 250 to 350 is the revenue move and it happens to be a safety
move as well. Raising the closed base to 3,000 to insure against a tail that the deviation term
already bounds at 3% costs the one session we actually win.

### Unaffected

P4, P5, P7 and P8 are orthogonal. One note on P4: a WETH/SPY pool's deviation reference is
`RHSPY / ETH-USD`, and while `ETH / USD` updates through the weekend the SPY leg does not, so its
out-of-hours band is set by the same stale SPY anchor. No better, no worse.

---

# The evidence

## The field

Every SPY venue on chain, v3 enumerated exhaustively from the factory, v4 complete above $454 of TVL.

| pool | TVL | fee | LP keeps |
|---|---|---|---|
| **Fables SPY/USDG, dynamic** | 464,072 | 250 to 800 by session | **100%** |
| v4 SPY/USDG 625 | 507,842 | 625 flat | 80% |
| v4 SPY/USDG 3499 | 3,335,330 | 3499 flat | 85.7% |
| v3 SPY/USDG 500 | 79,620 | 500 flat | 75% |
| v3 SPY/USDG 3000 | 23,949 | 3000 flat | 83.3% |
| v4 SPY/USDG 75 | 10,905 | 75 flat | 100% |
| v4 SPY/USDG 10000, dynamic | 26,347 | 5,000 to 91,641 | 100% |
| v3 WETH/SPY 500 | 718,458 | 500 flat | 75% |

## 1. The fee is anti-correlated with the flow it wins

Correlation between the fee we charge and our share of chain SPY volume: **-0.363** over 167 hours,
**-0.582** over the 48h chain scan. The table is in P2.

## 2. Inside the cash session, price is not what beats us

By ET hour, weekdays only, 5 sessions:

| ET hour | our pips | our volume | all pools | our share |
|---|---|---|---|---|
| 00 to 08 overnight | 350 | $737,486 | $7,151,077 | 6.2% to 12.1% |
| 09 | 449 | $143,910 | $2,156,276 | 6.7% |
| 10 | 562 | $109,920 | $1,943,304 | 5.7% |
| 11 | 575 | $75,697 | $1,635,943 | 4.6% |
| 12 | 609 | $42,831 | $1,633,934 | **2.6%** |
| 13 | 529 | $55,670 | $1,814,716 | 3.1% |
| 14 | 518 | $38,952 | $1,489,271 | 2.6% |
| 15 | 560 | $37,801 | $1,491,420 | 2.5% |
| 16 to 23 post-close | 287 to 336 | $1,084,681 | $10,344,529 | 8.3% to 12.4% |

Over the week our session blend is 528 pips against the dominant pool's 625. **We are cheaper inside
the session and take 4.1% against its 41.6%.** During Friday's session our working depth was $15.8M
against $86.4M and $662.9M, so 5.5x and 42x shallower. Price is not the binding constraint there.

## 3. Depth is not the constraint we assumed either

The pool that beats everyone, v3 WETH/SPY, holds capital comparable to ours, $211k time-weighted
against our $180k, and serves 4.7x the volume. The 3499 pool holds **42x our working depth and
serves 2x our volume**, and earns less than we do per dollar of depth. Deeper is neither necessary
nor sufficient. Being on the routing path is.

## 4. The APR ranking was an artefact of the denominator

Our depth quadrupled inside the window, so dividing a 48h fee integral by end-of-window TVL
penalises the pool that grew most, which is us.

| pool | 48h fees | LP-net | TVL end | TVL time-wtd | APR flat | APR time-wtd | rank flat | rank t-w |
|---|---|---|---|---|---|---|---|---|
| **Fables** | 981.35 | 981.35 | 464,072 | 180,370 | **38.6%** | **99.3%** | **8/8** | **4/8** |
| v4 625 | 3,570.55 | 2,856.44 | 507,842 | 363,873 | 102.7% | 143.3% | 4 | 3 |
| v4 3499 | 26,149.16 | 22,412.50 | 3,335,330 | 4,583,442 | 122.6% | 89.2% | 3 | 5 |
| v4 10000 dyn | 732.95 | 732.95 | 26,347 | 19,941 | 507.7% | 670.8% | 1 | 1 |
| v4 75 | 25.74 | 25.74 | 10,905 | 10,890 | 43.1% | 43.1% | 6 | 7 |
| v3 500 | 361.92 | 271.44 | 79,620 | 74,613 | 62.2% | 66.4% | 5 | 6 |
| v3 3000 | 60.86 | 50.71 | 23,949 | 24,755 | 38.6% | 37.4% | 7 | 8 |
| v3 WETH/SPY | 8,694.97 | 6,521.23 | 718,458 | 211,176 | 165.6% | 563.6% | 2 | 2 |

`APR = turnover x fee x LP-share x annualisation` reproduces every row exactly. There are three
dials and depth is not one of them: it enters only through its effect on turnover.

## 5. Where we do lead

Return on working capital, LP-net, 48h by session:

| session | Fables | v4 625 | v4 3499 | v3 500 |
|---|---|---|---|---|
| OPEN | 0.57% | 0.84% | 0.98% | 0.92% |
| OVERNIGHT | **0.84%** | 0.26% | 0.30% | 0.15% |
| CLOSED | **1.20%** | 0.54% | 0.33% | 0.41% |

Against every USDG-quoted rival we earn more per dollar of depth actually at the price in the two
sessions where we price low, and less in the one where we price high. v3 WETH/SPY beats everyone in
every session, 5.35% to 14.92%, by running near full range and catching the routed flow.

## 6. The pool held its anchor

Against the Friday close of $769.35, over all 49 scanned hours: median absolute deviation 0.36%,
maximum 0.74%. Rivals tracked within cents. Detail in the deviation section above.

---

# What this does not settle

- **Why session flow does not come to us even when we are the cheaper quote.** Depth explains part
  of it; router inclusion and quote-path construction are untested. This is the highest-value open
  question, because it gates P3.
- **The elasticity is confounded with the session.** 250 pips only ever occurs when the market is
  shut, so the demand curve in P2 mixes price with time of day. The within-session hour rows are the
  clean read and they are a single week.
- **n = 1 on the cash session in the chain scan.** The 48h window holds one session, Friday 28 Aug.
  The 7d bucket split covers five and agrees, but depth is not available at that horizon.
- **The window sits inside the points programme**, which opened 2026-08-24 and pays on fees, and
  40 of the 48 scanned hours are weekend. Both inflate volume of unknown composition.
- **Whether 450 in-session is above the true break-even.** 759 pips is a naive-LVR upper bound, not
  a measurement. Per-window markouts settle it and remain open item 1 from `FEE-POSITION.md`.
- **What a WETH/SPY pool would actually capture.** P4 assumes we could take a share of routed flow
  comparable to what we take in USDG. Untested.
