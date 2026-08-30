# AAPL/USDG

**State: baseline frozen 2026-08-30. No change shipping, and none proposed.** Cross-asset frozen
state in [BASELINE-2026-08-30.md](BASELINE-2026-08-30.md); method in [README.md](README.md).

Fees in pips: 100 pips = 1 bps. v4 dynamic-fee pool, hook
`0x70a9A88402989226847Ec122043CE5e7FF462080`, `protocolFee = 0` (verified in
`baseline-2026-08-30/protofee.json`). The hook's cap and pokeFloor are not recorded anywhere in
this snapshot and are deliberately not stated here.

**This is a dust pool.** TVL $4,259. Over the whole 167-hour window it did $54,218 of volume and
earned **$18.17** of fees, which is $0.109 an hour. Everything below is true and none of it is
worth much money. It is written so the pool is not silently missing from the set, and so that the
next person does not spend a 40-minute chain scan on it.

Window: 167 hours, **2026-08-23T11:00Z to 2026-08-30T10:00Z** (last census bucket; census fetched
2026-08-30T10:47:35Z). Session composition OPEN 35h / OVERNIGHT 77h / CLOSED 55h, covering 5 cash
sessions and 4 closed blocks. There is **no 48h chain scan for AAPL**, so this is a single-window
document.

---

## 1. Why nothing is shipping

AAPL was not included in the SPY / NVDA / META fee change. Two reasons, and only the second is a
judgement call.

1. **The dollars are not there.** Even under the most generous assumption available (hold volume
   constant, lose no share at all) charging the full field price of 1,377 pips for the whole week
   would have produced **$74.66** instead of $18.17. That is the entire theoretical prize, and the
   zero-elasticity assumption behind it is one this whole research set says is false. INFERRED.
2. **It would contaminate the experiment.** Three pools are moving at once and two are held as
   controls. Adding a fourth mover whose signal is $18 of fees adds noise to the read on SPY, NVDA
   and META without adding a usable observation of its own.

Unlike SPY and META, **AAPL's configuration did not change inside the window.** Per-day realised
fees from `census.json`: OPEN 499 / 474 / 489 / 489 / 491 pips Mon 08-24 through Fri 08-28,
OVERNIGHT 350 every night, CLOSED 300 every closed hour. So the "realised now" numbers here are one
regime, which is not true of SPY's 528 or META's 579.

---

## 2. The 167h field benchmark, by session

Volume-weighted whole field, every venue on chain trading AAPL. 13 venues traded; the census holds
22 AAPL pools, so 9 had zero volume in the window and are in the TVL denominator only.

| session | hrs | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share | our TVL share |
|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | $12,131,145 | 1,377 | 335 | **0.24x** | 110.3% | 22.4% | **0.20x** | 0.447% | 0.54% |
| OPEN | 35 | $3,781,745 | 1,539 | 490 | 0.32x | 183.4% | 22.3% | 0.12x | 0.205% | 0.54% |
| OVERNIGHT | 77 | $3,144,474 | 1,415 | 350 | 0.25x | 63.7% | 8.1% | 0.13x | 0.277% | 0.54% |
| CLOSED | 55 | $5,204,927 | 1,236 | 300 | 0.24x | 129.0% | 42.4% | 0.33x | 0.726% | 0.54% |

Our side of that, in dollars: OPEN $7,735 of volume and $3.79 of fees, OVERNIGHT $8,709 and $3.05,
CLOSED $37,774 and $11.33. 156 of 167 hours had any volume at all.

**Two caveats attach to the APR columns and neither is small.**

- **Market APR is charged-basis, not LP-net.** `protofee.json` holds a protocol-fee read for exactly
  one AAPL venue: ours. `universe7d.py` defaults an unread pool to a 100% LP keep, so every rival is
  credited with keeping everything it charges. Coverage by volume is **0.4%**, against 100.0% on SPY
  and 99.9% on NVDA. INFERRED correction: apply a uniform 80% keep to the rivals and the market APR
  falls from 110.3% to about 88%, moving our ALL ratio from 0.20x to about **0.25x**. Do not publish
  the 0.20x without this line attached.
- **Every APR here divides a week of fees by a single end-of-window TVL snapshot.** `now.json`
  records our AAPL TVL moving **+23.9% in the last 24 hours** of the window, so 22.4% is a
  point-in-time-denominator figure. The fee, volume and share columns are unaffected.

---

## 3. Who we are actually competing with

167h, every AAPL venue with volume, sorted by volume. Fees are realised (fees over volume), not
configured.

| venue | TVL | 7d volume | 7d fees | realised pips | share | lifetime tx |
|---|---|---|---|---|---|---|
| v3 USDG/AAPL 500 | $74,929 | $5,588,411 | $2,794.21 | 500 | 46.07% | 79,773 |
| v4 USDG/AAPL 3499 | $436,183 | $2,783,831 | $9,740.62 | 3,499 | 22.95% | 105,927 |
| v3 WETH/AAPL 500 | $15,982 | $2,629,862 | $1,314.93 | 500 | 21.68% | 81,016 |
| v3 USDG/AAPL 3000 | $137,433 | $659,808 | $1,979.42 | 3,000 | 5.44% | 36,700 |
| v4 WETH/AAPL 0 dyn | $846 | $362,806 | $681.25 | 1,878 | 2.99% | 745 |
| **Fables v4 USDG/AAPL dyn** | **$4,259** | **$54,218** | **$18.17** | **335** | **0.45%** | **3,173** |
| v4 USDG/AAPL 400 dyn | $6,626 | $33,466 | $10.21 | 305 | 0.28% | 1,199 |
| v4 USDG/AAPL 10990 | $77,672 | $11,008 | $120.98 | 10,990 | 0.09% | 15,801 |
| v3 USDG/AAPL 10000 | $1,036 | $3,963 | $39.63 | 10,000 | 0.03% | 1,122 |
| v4 USDG/AAPL 375 | $995 | $1,552 | $0.58 | 375 | 0.01% | 326 |
| v4 USDG/AAPL 4096 | $2,235 | $1,295 | $5.30 | 4,096 | 0.01% | 2,932 |
| v4 USDG/AAPL 1000 | $967 | $927 | $0.93 | 1,000 | 0.01% | 202 |
| v4 USDG/AAPL 50950 | $306 | $0.01 | $0.00 | 50,950 | 0.00% | 246 |

Points worth carrying:

- **The field is unusually flat for a small name.** No venue takes more than 46.1% of volume, and
  the top three are three different fee levels (500, 3,499, 500). Compare META, where 7 venues
  traded and the market fee is set by a handful of Saturday hours: AAPL's single busiest hour is
  **7.81%** of the week's market volume and its top five hours are 25.9%.
- **68% of market volume sits in the 400 to 600 pip band** (73.5% in closed hours), which is where a
  reasonable AAPL ladder would live. The 1,377-pip market fee is pulled up by `v4 3499`, which takes
  22.95% of volume and **58.3% of the field's fees**.
- **One rival is another dynamic-fee pool of our size.** `v4 USDG/AAPL 400 dyn`
  (hook `0x64E9ae1066c47Ac4a3cc0a5bd7B135908590e088`) holds $6,626 of TVL, 1.6x ours, and realised
  305 pips against our 335, doing $33,466 against our $54,218. It is the only venue on chain cheaper
  than us over the window, and it is 0.28% of the market.
- **One venue is mostly dead but appears in weekly totals.** `v4 WETH/AAPL 0 dyn` did all $362,806
  of its volume in 5 hours, every one of them OPEN, at a realised 1,878 pips on $846 of TVL, and
  last traded 2026-08-26T17:00Z, **89 hours before the window closed**. It is 3.0% of AAPL volume
  and 4.1% of AAPL fees. The same failure mode that broke NVDA's market fee applies here, but in
  miniature: removing it moves the ALL market fee from 1,377 to **1,362** and our ratio from 0.24x
  to 0.25x, which changes nothing. On NVDA the equivalent removal moved the market fee 845 to 592.

---

## 4. What the numbers say

**We are the cheap venue and it buys almost nothing.** Over the whole window **99.28% of AAPL
volume paid more than we did** and 0.28% paid less. In session it is 99.77% dearer, and in closed
hours 99.27%. We hold 0.54% of the asset's TVL and take 0.447% of its volume, so on a
share-per-TVL basis we are roughly at parity: the discount is not converting into flow.

**The one row that is not flat is CLOSED.** 0.726% share against a 0.447% all-window share, at 300
pips against a market of 1,236, and it is where 70% of our week's volume ($37,774 of $54,218) and
62% of our week's fees landed. That is the same shape SPY shows in closed hours and it is the only
part of AAPL's table that looks like a price effect rather than noise.

**But it cannot be read as one, because there is no within-session fee variation on this pool.**
Grouped on the actual realised tier, not on rounded buckets:

| our tier | hours | our volume | mean hourly share | our fees |
|---|---|---|---|---|
| 300 (all CLOSED) | 48 | $37,774 | 0.634% | $11.33 |
| 350 (all OVERNIGHT) | 74 | $8,709 | 0.408% | $3.05 |
| 437 to 500 (all OPEN) | 34 | $7,735 | 0.273% | $3.79 |

Share does fall monotonically as our fee rises, but fee and session are **perfectly collinear**:
every 300-pip hour is a closed hour, every 350-pip hour is an overnight hour, every hour above 437
is a session hour. This table is the session table with a different label on it. It is not an
elasticity and no revenue index is computed from it here. The five hours between 437 and 498 pips
are session-boundary hours where the hook stepped mid-bucket, not a separate tier.

**In absolute terms the whole question is worth under $10 a week.** INFERRED, holding volume
constant: charging a flat 500 pips (the field's own cheap deep tier, where 46% of volume trades)
across all 167 hours would have earned $27.11 against the realised $18.17, a gain of **$8.94 for
the week**. That is the realistic ceiling on fixing AAPL's price. The $74.66 at full market fee is
the unrealistic one.

---

## 5. What is missing

- **No chain scan, so no depth.** There is no `aapl_series.json`, no `aapl_cfg.json`, no
  `detail_aapl.txt` and no `universe48h_aapl.txt` under `fee-rerun-2026-08-30`. Everything above
  comes from the 167h hourly buckets in `census.json`. That means **virtual depth, k, utilisation,
  time-weighted TVL, per-swap fees and intra-hour fee behaviour do not exist for AAPL** in this
  baseline, for us or for any rival. Nothing in this document can say whether our $4,259 is quoted
  wide or narrow.
- **No protocol-fee reads on the field**, covered above: 0.4% of AAPL volume, versus 100% on SPY.
- **No time-weighted TVL**, so the APR ratio inherits a denominator that moved +23.9% in 24 hours.
- **The window sits inside the points programme.** It opened 2026-08-24, the same day routing was
  approved, so volume from that date carries two effects at once and the 167h share numbers span a
  routing change rather than describing a steady state. The weekend concentration is also the shape
  wash trading would take, and 70% of our AAPL volume is in closed hours, so this caveat lands
  hardest on exactly the row that looks most interesting.

---

## 6. Recommendation

1. **Do not spend a chain scan on this pool.** A 48h scan of AAPL's 13 venues would cost roughly
   what SPY's cost and would resolve a $18-a-week question. If depth is ever wanted here, get it as
   a by-product of an all-asset depth sweep, not as its own job.
2. **Move the ladder with the equity set, not on its own evidence.** When SPY's 550 / 450 / 400
   result comes back, apply the same shaped move to AAPL by analogy and say plainly that it is by
   analogy. The field supports it: nothing meaningful on chain trades below us, and 68% of volume
   sits at 400 to 600 pips, so a move toward 500 in the session and 400 in closed hours is well
   inside where the market already clears. There is no AAPL-specific elasticity to size it with and
   there will not be one at this volume.
3. **Decide the capital question separately and do not use this document to decide it.** The
   interesting number is not our fee, it is that `v3 USDG/AAPL 500` earns $2,794 a week on $74,929
   of TVL at the same 500 pips we would move to. Whether that is reachable depends on depth and
   routing inclusion, neither of which is measured here.
4. **Re-read the AAPL row when the next census runs**, using section 6 of the baseline. It costs
   nothing: `universe7d.py` already covers all nine pools.

---

## 7. What this does not settle

- **Anything about depth.** No chain scan exists for AAPL. k, utilisation and working depth are
  unmeasured for our pool and for all 12 rivals. This is the single largest gap and it is what
  would decide whether the pool is worth capital.
- **Whether we are in the routing set at all.** 0.45% of volume on 0.54% of TVL at a quarter of the
  market price is consistent with two very different stories: a router that includes us and finds
  us too shallow to fill through, or a router that does not include us and hands us only what
  arrives directly. Untested here, untested on NVDA, and it is the same open question in both.
- **The market APR ratio.** 0.20x is charged-basis; the honest number under a uniform 80% rival keep
  is about 0.25x, and neither is a real LP-net measurement because 99.6% of the field's volume has
  no protocol-fee read.
- **Any elasticity.** n = 0 usable observations. AAPL's fee never varied within a session type, so
  the fee-versus-share table above is the session table. No correlation is quoted for that reason.
- **Whether CLOSED's 0.726% share is a price effect.** It rests on $37,774 of volume across 48
  hours, 12.9% of our week's fees came from a single hour, and the block sits squarely inside the
  points-programme window. It is the only signal on the pool and it is not strong enough to act on.
