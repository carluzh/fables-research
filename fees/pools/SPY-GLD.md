# SPY/GLD (cross)

**State: baseline frozen 2026-08-30. No change shipping, and it is not a control either.**
Cross-asset frozen state in [BASELINE-2026-08-30.md](BASELINE-2026-08-30.md). Fees in pips.
v4 dynamic-fee pool `0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f`,
hook `0xA4570C37590E45f0b06898123D4de16307A32080`, `protocolFee = 0` and `lpFeeOnChain = 0`
verified in `protofee.json`. The hook's cap and pokeFloor were **not** read on chain for this pool,
so they are not quoted here.

**This is the smallest pool we run.** $1,073 of TVL, $3,828 of volume and **$1.33 of fees** across
the whole 167-hour week. Read section 1 before any number below.

---

## 1. The benchmark is degenerate, not a win

`universe7d.txt` prints this pool (as `GLD/SPY`) with a market fee of 346 against our 346, a market
APR of 6.5% against our 6.5%, a 1.00x ratio on both, 100.00% volume share and 100.0% TVL share.
**None of that is performance. We are the only venue on chain quoting the pair, so every "market"
figure is our own figure copied into the other column.** `universe7d.py` defines a cross's field as
the pools quoting the same pair; with a field of one, every ratio is an identity.

The enumeration is real, not an omission. `census.mjs` probes the v3 factory
`0x1f7d7550b1b028f7571e69a784071f0205fd2efa` for `SPY/GLD` across all 13 fee tiers and finds
nothing, and the v4 gateway sweep returns exactly one SPY/GLD pool: ours. Of the 138 pools in
`census.json`, one quotes this pair.

**The ratio columns should be deleted for this row wherever it appears, including BASELINE
section 1.** They are the one thing in that table produced by construction rather than by
measurement.

There is a real alternative for a trader, just not a same-pair one: route SPY to USDG to GLD. That
comparison is in section 3 and it is INFERRED, not measured.

## 2. Baseline, frozen

167 hours to **2026-08-30T10:00:00Z** (window opens 2026-08-23T11:00:00Z), 1 venue, 5 cash sessions
and 4 closed blocks. Ratio columns dropped for the reason above. There is no 48h chain scan for this
pool, so there is no depth row.

| session | hrs | hrs with volume | our volume | our fee | our fees | APR* |
|---|---|---|---|---|---|---|
| ALL | 167 | 67 | $3,828.23 | 346 | $1.3259 | 6.5% |
| OPEN | 35 | 23 | $699.92 | 496 | $0.3475 | 8.1% |
| OVERNIGHT | 77 | 30 | $797.89 | 350 | $0.2793 | 3.0% |
| CLOSED | 55 | 14 | $2,330.42 | 300 | $0.6991 | 10.4% |

\* APR divides the window's fees by a **single end-of-window TVL read** ($1,072.50, `now.json`,
2026-08-30T10:09:16Z), the error [README.md](README.md) section 4 warns about. Here it bites least
of any Fables pool: `now.json` puts this pool's 24h TVL change at **+4.05%**, against +162.3% on
F-SPY, +328.1% on F-NVSP, +74.7% on F-ETH and -69.3% on F-GLD. The level is still a
point-in-time-denominator figure.

The realised fee is the calendar ladder and nothing else. Across all 67 active hours: **300 pips in
14 hours (all CLOSED), 350 in 31 hours (30 OVERNIGHT, 1 OPEN), 435 in 1 OPEN hour, 500 in 21 OPEN
hours.** No poke variance, no deviation term, no fee observed twice in the same session type. There
is no elasticity reading in this pool and there cannot be one at this volume.

## 3. What the numbers say

**Bottom of every ranking we keep.** All nine Fables pools, same 167h window, from `census.json`:

| pool | 7d fees | TVL | hrs with volume | lifetime tx |
|---|---|---|---|---|
| GLD/USDG | $7,482.77 | $34,391 | 140 / 167 | 43,119 |
| ETH/USDG | $5,532.06 | $1,042,590 | 167 / 167 | 21,263 |
| SPY/USDG | $1,596.22 | $464,072 | 167 / 167 | 26,641 |
| NVDA/USDG | $316.81 | $30,511 | 167 / 167 | 5,715 |
| META/USDG | $107.30 | $26,148 | 132 / 167 | 2,487 |
| AAPL/USDG | $18.17 | $4,259 | 156 / 167 | 3,173 |
| TSLA/USDG | $4.95 | $2,260 | 129 / 167 | 533 |
| NVDA/SPY | $2.25 | $4,395 | 125 / 167 | 880 |
| **SPY/GLD** | **$1.33** | **$1,073** | **67 / 167** | **234** |

Last on fees, last on TVL, last on active hours and last on lifetime transactions. The week's
revenue is **0.0088%** of the $15,061.85 the nine pools earned, on **0.067%** of their $1,609,701 of
TVL. Annualised at the observed rate that is **$69.55 a year**.

**It is not a fee problem.** The pool is already the cheapest way to trade the pair on chain and it
still gets almost nothing. INFERRED, by adding the two measured leg fees over the same 167 hours and
ignoring price impact and gas:

- Cheapest liquid two-hop: our own SPY/USDG pool at 304 pips plus `v3 GLD/USDG 500` at 500 pips =
  **804 pips**, against our cross at **346**.
- Volume-weighted two-hop across both legs: SPY/USDG field 1,567 pips ($37.5M, 8 venues) plus
  GLD/USDG field 2,067 pips ($24.3M, 15 venues) = **3,634 pips**.

We undercut the realistic route by better than half and the field-weighted route by 10x, and the
pair did $3,828 in a week. **Raising or cutting the fee cannot move a number this size.** Demand for
the pair is the binding constraint.

**What flow there is arrives in bursts.** 100 of the 167 hours had zero volume. One hour,
Sat 2026-08-29 08:00 ET, carries **27.1%** of the week's volume ($1,036.00) and the top 5 hours carry
**59.1%**. The last hour with any volume was that Saturday 12:00 UTC, **22 hours before the window
closed**; the gateway's own 24h volume field reads $0 for this pool at the `now.json` snapshot. Two
of the eight ET days in the window, Sun 08-23 and Sun 08-30, are entirely empty.

**The pool was one-sided at the snapshot.** `now.json` records its balances as 1.38538 SPY (worth
$1,070.81 at the gateway's $772.94 mark) and **0.00127 GLD** (worth $1.69), so **99.84% of the TVL
sits in SPY**. For a concentrated v4 range that means the price is at or past one edge and the pool
can only be traded in one direction until it comes back. That is a single reading, 2026-08-30
10:09:16Z, so whether it is a cause of the missing flow or a consequence of it is not settled here.

## 4. What is missing

- **No chain scan, so no depth.** There is no `spy_gld_cfg.json` and no `spgl_series.json`.
  `kall.json` holds k for seven pools (F-SPY, F-NVDA, F-ETH, F-GLD, F-META, F-TSLA, F-AAPL) and
  **neither cross is in it**. So virtual depth, k, utilisation, per-swap fee and time-weighted TVL do
  not exist for this pool in this baseline, and nothing in it was independently checked against chain
  the way the SPY/USDG pool's fees were.
- **The volume dollars' pricing leg is unknown.** Volume and fees come from the LiquidityService
  buckets. For GLD/USDG the scan config pins volume to the USDG leg and is immune to the on-chain
  mark, but this cross has no config and both its legs are non-quote assets. `REPRO-NOTES.md` open
  question 1 records GLD marked at $1,327.52 on chain against a real GLD ETF close of $409.23, a
  ratio of 3.2439. The TVL is 99.84% SPY so it is effectively immune; the volume and fee dollars may
  not be. The realised fee in pips is a ratio and is immune either way.
- **The window sits inside the points programme**, which opened 2026-08-24 and accrues on fees, the
  same day routing was approved (`REPRO-NOTES.md` open question 5). Volume from that date carries two
  effects at once, and a weekend-concentrated spike is the shape wash would take. This pool's volume
  is 61% CLOSED-session and 27% one Saturday hour.

## 5. Recommendation

**Retire it, or reclassify it as a product line rather than an LP product. The data does not support
a third option.**

What the data supports, stated plainly:

1. **No fee change can be argued from this pool's own data.** There is no rival to price against, no
   fee observed more than once per session type, and $1.33 of revenue to detect a response in. Any
   number we picked would be a guess wearing a measurement's clothes.
2. **It is not underpriced.** At 346 pips we are less than half the cheapest realistic two-hop route
   and still take $3,828 a week.
3. **The capital is a rounding error.** $1,073 is 0.067% of Fables TVL. Withdrawing it changes no
   other pool's economics and frees nothing worth naming. **The cost of this pool is attention, not
   capital**: it occupies a row in every table, a hook config, and a line in every rerun of this
   analysis, and it returns $69.55 a year.
4. **If it stays, it stays for a reason outside these documents** - a "trade any RWA against any RWA"
   product commitment. That is a legitimate reason and it is not measurable here. In that case say so
   in BASELINE and **drop the pool from the efficiency tables**, because a 1.00x row invites exactly
   the misreading section 1 exists to prevent.

**One test worth running before retiring, and it is cheap.** The pool held 0.00127 GLD at the
snapshot. If it has been out of range and one-sided for most of the week, then it has been unable to
fill half the possible trades, and the near-zero flow is partly self-inflicted. Re-centre the range,
fund both sides, and re-measure over one week. If volume stays under $10k a week with a two-sided
book, retire it on that evidence. This costs one liquidity event and no fee change, and it is the
only version of this pool's question the data can answer.

## 6. What this does not settle

- **Sample size: there is no sample.** $1.33 of fees over 167 hours, 67 active hours, 234 lifetime
  transactions since the pool was created. Every per-session figure in section 2 rests on 14 to 31
  hours of volume and single-digit or low-double-digit dollars. No conclusion about session pricing,
  elasticity or LP yield can carry from this pool to any other, and none should be carried in.
- **Whether a two-sided book changes anything.** Untested, and section 5 names the test.
- **Whether the pair has natural demand at all.** Nothing here separates "priced wrong" (ruled out in
  section 3), "unroutable" (unknown, we have no router-inclusion data) and "nobody wants to trade SPY
  against GLD directly" (the hypothesis the data is most consistent with, and the one it cannot
  prove).
- **The APR level.** 6.5% divides a week of fees by one TVL read. The denominator moved only +4.05%
  in 24 hours, which is the best-behaved of the nine, but it is still a snapshot and there is no 167h
  TVL series anywhere in this baseline.
- **The GLD mark.** `GLD-DEVIATION-FEE.md` and [GLD-USDG.md](GLD-USDG.md) own that question. It
  reaches this pool through the pricing basis of its volume dollars, which is unresolved above, and
  through whatever moved the range out of position.
