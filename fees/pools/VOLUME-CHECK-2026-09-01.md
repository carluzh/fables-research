# "Volume has calmed down": it has not, and here is the number that says it has

**2026-09-01 07:40 UTC, Tuesday.** Answering Yanis. Reproduce with `scripts-eth/freshvol.mjs`,
`whathesees.mjs`, `mktcontrol.mjs`, `glddev.mjs`, `allfees.mjs`.

Daily volume is at a record. The rolling 24-hour figure is down 36%. Both are true, and the second
one is what a dashboard shows.

**Provenance, verified against the chain.** The volume and fee figures come from the Uniswap indexer,
the same endpoint `census.mjs` uses. Two earlier attempts to cross-check it against raw `Swap` events
were abandoned: the RPC rate-limits `eth_getLogs` hard enough that 4 days across 7 pools ran past
half an hour. The fix was to stop trying to reproduce the whole table and instead scan **one day and
the two pools carrying 88% of Monday's volume**, which is a twentieth of the work and answers the
same question. `scripts-eth/chaincheck.mjs`, Monday 2026-08-31 UTC, blocks 50,419,159 to 51,274,850:

| pool | raw chain | indexer | ratio |
|---|---|---|---|
| ETH | 4,893 swaps, **$4,890,704**, $4,025 fees, 823 pips | **$4,890,702**, $4,025, 823 pips | **1.0000** |
| SPY | 7,305 swaps, **$3,963,650**, $1,458 fees, 368 pips | **$3,960,432**, $1,457, 368 pips | **1.0008** |
| **combined** | **$8,854,353** | **$8,851,134** | **1.0004** |

**The indexer is exact on our v4 pools**, to $3,219 on $8.85M, on the day the whole question is
about. It also beats the looser 1.000 to 1.017 that [OVERVIEW.md](OVERVIEW.md) section 4 measured
last week, because that comparison spanned v3 rivals with their own venue-level noise.

Two things this does not cover, neither of which touches the conclusion. The other five pools were
not rescanned; they are 12% of Monday. And the known census undercount on the two zero-fee WETH/USDG
venues still applies to the rival column in section 5, not to ours.

---

## 1. Daily volume, which is not down

From the indexer, the same source `census.mjs` uses.

| day | | GLD | ETH | SPY | NVDA | META | **total** | fees |
|---|---|---|---|---|---|---|---|---|
| 08-25 | Tue | 246,925 | 322,245 | 205,285 | 23,647 | 4,769 | **803,455** | $504 |
| 08-27 | Thu | 130,158 | 1,206,114 | 529,495 | 151,543 | 41,324 | **2,062,821** | $1,490 |
| 08-28 | Fri | 338,977 | 1,755,766 | 961,088 | 78,056 | 28,764 | **3,180,696** | $2,761 |
| 08-29 | Sat | 5,309,592 | 1,823,649 | 1,595,235 | 29,630 | 100,284 | **8,882,907** | $6,217 |
| 08-30 | Sun | 1,354,114 | 3,996,048 | 6,774,070 | 31,180 | 47,393 | **12,222,084** | $14,462 |
| **08-31** | **Mon** | 1,124,675 | 4,890,702 | 3,960,432 | 28,659 | 41,937 | **10,062,299** | **$10,204** |
| 09-01 | Tue | 342,891 | 1,850,665 | 907,846 | 6,268 | 29,588 | **3,169,578** | $2,335 |

The last row is 7.6 hours of a 24-hour day. Annualise it and Tuesday is running at **$10.0M/day
against Monday's $10.06M**. Monday was the second-biggest day the book has ever had. Volume is up 3x
on the week before and it is flat day over day.

## 2. The number that is down, and why

| rolling 24h ending | volume | fees | realised pips |
|---|---|---|---|
| 08-31 07:39 | $14,195,274 | $16,383 | 1,154 |
| **09-01 07:39** | **$9,130,384** | **$8,378** | **918** |
| | **-36%** | **-49%** | **-20%** |

That is the drop. It is a **window effect**: yesterday's trailing 24 hours contained Sunday's peak
hours and today's does not. Nothing changed in the pools between those two readings.

The cleanest version, same clock hours so time of day cancels entirely:

| 00:00 to 07:42 UTC | volume | fees |
|---|---|---|
| Sunday 08-30 | $2,128,475 | $2,239 |
| Monday 08-31 | $4,101,665 | $4,161 |
| Tuesday 09-01 | $3,169,750 | $2,335 |

Today is **0.77x** yesterday and **1.49x** Sunday. Monday was the peak, today is off it, and both are
well above the weekend.

## 3. Fees fell twice as fast as volume, and that is the ladder working

Realised fee went 1,154 pips to 918. That is not a market event, it is our own configuration.
**GLD's CLOSED floor is 6,000 pips and its weekday floors are 3,000.** GLD is our highest-priced
pool, so every Monday its price halves by design, and Monday's trailing window still held Sunday's
6,000-pip hours.

So the honest answer to "is it the start of the week" is **yes, but the opposite way round to how it
sounds**. The weekend is our expensive window, not our quiet one. The week starting shows up as a
fee decline, not a volume decline.

## 4. Volatility did not calm on Monday either

The ETH keeper's own EWMA, from its live log:

| day | mean sigma | max |
|---|---|---|
| 08-27 Thu | 47.5% | 133.5% |
| 08-28 Fri | 43.5% | 157.6% |
| 08-29 Sat | 19.0% | 39.6% |
| 08-30 Sun | 36.5% | 152.7% |
| **08-31 Mon** | **45.3%** | 106.0% |
| 09-01 Tue | 31.4% | 56.9% (7.7h only) |

Monday sat at 45.3%, squarely inside the prior week's 43 to 51%. Today reads 31.4% but that is
seven hours of pre-market, always the quietest stretch of the day.

## 5. The chain is not quiet, it is the busiest it has been

| day | rival v3 WETH/USDG 100 | rival v4 ETH/USDG 577 | our ETH |
|---|---|---|---|
| 08-28 Fri | $209,082,793 | $5,839,520 | $1,755,766 |
| 08-30 Sun | $326,928,682 | $10,348,442 | $3,996,048 |
| **08-31 Mon** | **$410,048,443** | $12,303,382 | $4,890,702 |
| 09-01 Tue (7.6h) | $141,521,911 | $2,937,235 | $1,850,665 |

The biggest venue on the chain had its highest day of the window on Monday and is tracking
**$447M/day** today. Binance is softer over the same days (ETH $1.16bn last Monday to $0.65bn this
Monday) but the chain is not following it.

## 6. The one real, permanent decline: GLD's event is over

Measured now: pool **408.41**, PAXG 4,430.29 times the 0.091804 basis gives fair **406.72**, so
**d = 0.42%** against a 2.00% kicker. The pool that was 181% mispriced has fully re-converged.

GLD did $5.31M on Saturday and about $1.1M a day now. It was 50% of our fee income and roughly 60% of
volume on its peak day. **That decline is real, it is permanent, and it was always going to happen.**
It is also the only genuine drop in this whole picture.

## 7. Everything is healthy

Read just now, both directions, using the correct 2-argument `currentFee(PoolId, bool)`:

| pool | fee now | is that right |
|---|---|---|
| GLD | 3,000 | overnight floor, yes |
| META | 750 | overnight floor, yes |
| SPY | 350 | yes |
| NVDA | 800 | yes |
| TSLA | 500 | yes |
| AAPL | 350 | yes |
| ETH | 450 | keeper flat, yes |

**No poke is live anywhere.** Both keepers are up: `fables-deviation.service` and
`fables-eth-usdg.service`, `NRestarts=0`. The deviation keeper has fired zero pokes since boot,
which is correct: every pool is below its kicker. The ETH keeper fired 174 in three days and is
resting at its 450 flat with sigma around 25%.

## 8. Against the competition, which is the question I should have asked first

Everything above measures us against ourselves. Carl asked for the field, and the first cut of it
looks alarming:

| rolling 24h | prev | now | change |
|---|---|---|---|
| **us, 9 pools** | $14,357,445 | $9,290,705 | **-35.3%** |
| **everyone else on the chain** | $442,956,424 | $598,773,794 | **+35.2%** |
| whole chain | $457,313,869 | $608,064,499 | +33.0% |

**Our share of chain volume went 3.140% to 1.528%, a halving.** We fell while the chain rose by the
same proportion. That reads as losing badly, and section 2's "it is only a window effect" does not
cover it.

**It is the same artefact one level up.** The two windows do not hold session constant either: the
previous one is mostly Sunday CLOSED and the current one is mostly weekday OPEN and OVERNIGHT. Our
share is session-dependent by construction, because the equity pools are one of the few venues open
when the real market is shut. Holding session fixed, `scripts-eth/spyshare.mjs` on SPY, the pool that
drives the whole move:

| session | 08-25 | 08-26 | 08-27 | 08-28 | **08-31 Mon** | 09-01 Tue |
|---|---|---|---|---|---|---|
| OVERNIGHT | 7.94% | 5.75% | 6.52% | 10.62% | **15.76%** | **12.89%** |
| CLOSED | | | | 13.60% | **22.35%** | |
| OPEN | 4.37% | 3.70% | 5.27% | 1.58% | **3.10%** | |

**In OVERNIGHT and CLOSED our share is at its best of the week, not its worst.** Monday's 15.76%
overnight is double the 5.75 to 7.94% of Tuesday through Thursday. The apparent collapse is entirely
session mix: the prior window sat in the sessions where we hold 19 to 22%, and the current one sits
in the sessions where we hold 3 to 16%.

Per asset, same two windows:

| asset | ours | field | share prev | share now |
|---|---|---|---|---|
| ETH | **+4.6%** | **+36.9%** | 1.32% | **1.01%** |
| SPY | -65.6% | -15.3% | 22.00% | 8.94% |
| GLD | -17.4% | -25.2% | 14.07% | **15.52%** |
| NVDA | +22.9% | +69.1% | 0.11% | 0.08% |
| META | +82.1% | +91.4% | 11.00% | 10.47% |
| AAPL | +259.9% | +149.2% | 0.61% | 0.88% |

### Two things in here are real and neither is the headline

**ETH did not keep up with a chain-wide surge.** No session effect exists on ETH, so its share going
1.32% to 1.01% is clean. The field grew 36.9% and we grew 4.6%. When flow surges on this chain it
goes to the venues in the route, and we are not one of them. That is the same conclusion
[ETH-USDG-CORRECTION.md](ETH-USDG-CORRECTION.md) section 6 reached from a completely different
direction, and this is the first time it has shown up as a live cost rather than a static ranking.

**SPY's OPEN tier at 800 pips is the one weak session.** Three days at 500 pips gave 4.37, 3.70 and
5.27%. Two days at 800 gave 1.58 and 3.10%. Share roughly halves for a 1.6x price rise, which is the
first thing resembling a real demand curve anyone has measured on this pool.

It still does not settle the held SPY open cut, and it must not be quoted as if it does. Measured
dollars run the other way, because the field's own OPEN volume grew 5x across the same days: at 800
pips we earned **$45.03/h** on the Monday and $8.91/h on the Friday, against $6.09, $4.73 and $8.65/h
on the three 500-pip days. Share says cut, dollars say hold, the confound is unbroken, and that is
exactly the state `BASELINE-2026-08-30.md` section 4 pre-registered. **The randomised schedule is
what settles it.**

## 9. META and NVDA, and the first read on the one change we shipped

`scripts-eth/assetshare.mjs`. Share of each asset's whole on-chain field, by day and session, with
META's CLOSED hours split either side of the `setPoolConfig` at 2026-08-30 21:49:39 UTC.

### META: the 28 August raise is working, and clearly

Volume-weighted across the week, same session, either side of that change:

| session | at the old fee | at the new fee | share | revenue per unit of field volume |
|---|---|---|---|---|
| OPEN | 500 pips, **7.98%** | 900 pips, **5.50%** | -31% | **+24%** |
| OVERNIGHT | ~410 pips, **9.14%** | ~737 pips, **6.98%** | -24% | **+37%** |

**Share barely moved for an 80 and 114% price rise, so revenue rose on both tiers.** That is a
genuine, if confounded, demand curve and it points the same way on two tiers independently.

It also retires the four held cuts rather than merely deferring them. The case for cutting META's
open and overnight back to 500 was that the 167h window showed us at 0.08x of market. The tiers have
now run a week at the higher price and earned more for it.

One honest wrinkle: the 500-pip OPEN days are 2.44%, 8.62% and 9.42%, and that first reading is an
outlier on $1,814 of volume. Drop it and the 500-pip share is 9.02%, the fall becomes -39%, and the
revenue gain shrinks to about +12%. Still positive, less emphatic.

### META CLOSED: the shipped change is passing, on ten hours of data

| | field volume | our share | realised |
|---|---|---|---|
| before, 08-28 to 08-30 | $1,829,077 | **8.01%** | 250 pips |
| after, 08-30 21:49 onward | $128,773 | **5.20%** | 450 pips |

Break-even is the old share times the fee ratio: `8.01% x 250/450 = 4.45%`. **We are at 5.20%, so it
is passing, by 17%.**

Do not bank it. The post-change window is **ten hours of Sunday evening**, the lowest-volume block of
the week, and it is 7% of the field volume the pre-change reading rests on. The two readings inside
it disagree with each other (7.70% and 4.49%). **The real test is next weekend**, which is the first
full CLOSED block at 450.

This also corrects the 7.12% break-even in [LADDER-CORRECTION.md](LADDER-CORRECTION.md) section 3.
That number came off the 167h window's 12.81% CLOSED share; measured fresh on the same days as the
post-change reading, the pre-change share is 8.01%, so 4.45% is the like-for-like bar.

### NVDA: nothing measurable, which confirms the hold

| session | range of daily share | our volume per session |
|---|---|---|
| OPEN | 0.07% to 0.24% | $6,242 to $42,026 |
| OVERNIGHT | 0.08% to 0.27% | $8,084 to $128,980 |
| CLOSED | 0.08% to 0.17% | $4,298 to $31,180 |

Monday is the weakest day on all three tiers, but our absolute volume was roughly flat and NVDA's
field grew: its OPEN field went $8.4M on the Tuesday to $16.5M on the Monday. **On $4k to $42k a
session no fee decision is identifiable**, and nothing here changes the hold.

## 10. Does any of this force a parameter change?

**Two yes, and everything share-driven is still too early.**

| change | verdict | why |
|---|---|---|
| **GLD closed 6,000 to 3,000** | **ship, deadline Saturday** | Not from this analysis at all: the dislocation is over at d = 0.42%. 6,000 is 1.5x its market with nothing left to defend, and the next CLOSED block starts Friday 16:00 ET |
| **ETH keeper `push_delta_immediate` 500 to 150** | **ship** | Mechanism identified in source, worth $160-840/wk, no revenue risk since ETH flow does not respond to price |
| META open, overnight | **hold, and now permanently** | The raise is earning more. The case for the cut is gone, not deferred |
| META closed 450 | **hold, re-measure Monday** | Passing on ten hours. Next weekend is the first real block |
| SPY open 800 | **hold, needs the randomised schedule** | Share says cut, dollars say hold, section 8 |
| SPY overnight, closed; NVDA closed | **hold** | Unchanged since `LADDER-CORRECTION.md`. Nothing here moves them |
| anything for ETH share | **no** | Share fell against a surging field, but the fee is not the lever. The routing test is |

**Neither of the two ships is driven by the share data.** One is a dislocation that ended and one is a
keeper reaction threshold. Everything the share numbers touch stays on the pre-registered gate: five
clean cash sessions on the live ladder, so **Friday 2026-09-04 at the earliest**.

## 11. GLD's closed floor: cutting it to 3,000 is WRONG, and the fix is the kicker

**I recommended taking GLD's closed tier from 6,000 to 3,000 in three separate places. Withdrawn.**
Carl pushed back that it would leave us too cheap out of hours, and measuring it says he is right by
a wide margin. `scripts-eth/gldclosed.mjs`.

**First, an error of my own that ran in the direction that flattered the cut.** I had been treating a
CPMM's no-arb band as plus or minus twice the fee, on the reasoning that an arb pays it on both legs.
That is wrong. The arbitrageur trades our pool **once** to realign it and sells into the real market,
so they pay our fee once, and the band is plus or minus `f`. A 6,000-pip fee protects a 0.60% move,
not a 1.20% one. The mistake halved the apparent exposure.

**The weekend gold move distribution**, PAXG hourly, 104 weekends over two years, Friday 16:00 ET to
Monday 09:30 ET:

| | median | p75 | p90 | p99 | max |
|---|---|---|---|---|---|
| net move, close to close | **0.745%** | 1.419% | 2.209% | 3.040% | 3.194% |
| max excursion inside the window | **1.360%** | 2.124% | 2.772% | 8.650% | 10.489% |

Against what each base actually covers:

| band | share of weekends, net | by excursion |
|---|---|---|
| under 0.30%, a 3,000 base covers it | 23.1% | **0.0%** |
| 0.30% to 0.60%, only 6,000 covers | 17.3% | 8.7% |
| **0.60% to 2.00%, NEITHER covers** | **47.1%** | **65.4%** |
| over 2.00%, the keeper takes over | 12.5% | 26.0% |

**The median weekend already moves further than 6,000 protects.** Cutting to 3,000 widens the
unprotected set from 47.1% to 64.4% of weekends on net moves, and from 65.4% to 74.0% on excursions.
That is the opposite of what I proposed.

### But holding 6,000 does not fix it either, and that is the real finding

The hole is **0.60% to 2.00%**, and it is where most weekends live. The base stops covering at 0.60%
and the keeper does not start until its 2.00% kicker. **Two thirds of weekends land in the gap
between them**, and no fee level closes it because the problem is not the level, it is the handoff.

**Set GLD's kicker to 0.60%, matching the no-arb band its own closed base buys.** Then the base covers
0 to 0.60% and the keeper covers everything above, continuously. The ramp is gentle where it now
starts: with base 6,000, cap 15,000, full 10.00%, a 1.0% deviation prices at 6,383 pips and a 2.0% at
7,340, so firing on more weekends does not mean charging much more on any of them.

**The better version, and it is a keeper change rather than a config one.** The keeper already reads
`base` from chain every cycle. Deriving the kicker from it, `kick = base_pips / 1e6`, makes the
handoff exact on every pool and every session automatically: 0.60% when GLD is in its closed tier,
0.30% when it drops to its weekday 3,000, and correspondingly on the equity pools. That is worth
raising with Yanis rather than shipping as a constant.

### So what happens to the closed tier

**Leave it at 6,000 for now.** The argument I made for cutting it was that the keeper has replaced the
need for a static defence. The measurement says the keeper as configured covers only the top 26% of
weekends, so it has not replaced it. Revisit the level once the kicker is fixed, not before.

The one thing that does still hold from the original note: **if it is ever cut, 3,000 not 1,500**,
because 1,500 would drop `pokeFloor` from 3,000 and open a 50% downward poke hole. Going to 3,000
leaves `pokeFloor` unchanged, since it is already `min(3000, 3000, 6000) = 3000`.

## 12. ETH `push_delta_immediate`: the objection is right, and the fix is asymmetry

Carl asked whether 150 would be too cheap. **The parameter is not a fee** and the fee floor does not
move: `min_fee` stays 450, `max_fee` 3,000, `C` 40. It is the size of fee *change* that triggers an
immediate on-chain push instead of waiting out the 900-second heartbeat.

But the objection survives that clarification, because `engine.py:123` computes
`delta = abs(desired - self.current_onchain_fee)`. **The deadband is symmetric.** Tightening it to 150
speeds the keeper up on the way down as well as up, so it would give up the revenue we currently earn
by sitting stale-high for up to fifteen minutes while volatility falls.

The markout only ever indicted the upward lag: the 500-700 band under-collects because toxic flow
arrives while we are still quoting the previous regime. Being late to come down is not a cost, it is
income.

**So make the deadband asymmetric rather than tighter**: push immediately on a **150-pip rise**, keep
**500 pips on a fall**. That captures all of the protection the markout identified and gives up none
of the stale-high revenue. It is a small code change, not a config edit, because the current
expression takes an absolute value.
