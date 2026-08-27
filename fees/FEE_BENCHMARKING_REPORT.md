# Fables fee benchmarking - all 9 pools vs incumbents

As-of **2026-08-27 ~13:00 UTC** (pre-open; every RWA hook on its overnight tier at read time).
Sources: on-chain reads at block 47463296 (+ live re-verification at 13:30, block 47479625),
Uniswap gateway (the app's own upstream), GeckoTerminal, DefiLlama, Raydium API, arXiv 2404.05803.
All fees in **bps** (350 pips = 3.5 bps). Every figure below reproduced independently by a red-team
pass; where a supporting claim fell, the corrected version is what's printed.

**No changes have been made to anything. This is the report-first you asked for.**

---

## Headline numbers

| | |
|---|---|
| Protocol TVL | **$648.6k** (ETH/USDG $373k, SPY $138k, GLD $64k, NVDA $43k, META $25k, four dust pools) |
| 24h volume | **$1.94M** (7d $4.2M) - ETH 55%, SPY 25%, GLD+NVDA ~17% |
| Fee revenue | **$1,368/day** measured; blended realized fee **7.07 bps** volume-weighted |
| Blended LP fee APR | 30-100% per pool on the spike day (see caveat #1) |

**The single biggest context shift: Robinhood Chain 100x'd under us.** The chain now does
**~$826M/day** DEX volume ($640M TVL, ~40 live DEXes). Our priors ("~$12k/hr, we're 29% of non-GLD
volume") are weeks stale. Every one of our pairs now has serious same-chain incumbents.

---

## The three structural findings

### 1. Depth, not fee, is our binding constraint - scoped carefully

In every pool where we trail (NVDA, SPY, AAPL, TSLA, SPY/NVDA), the winning venue charges the
**same or more** than us with 30-180x our TVL:

- NVDA: v3 **5 bps** pool, $3.18M TVL, ~$60M/24h (earnings week; ~$19.7M/day 7d-avg) - 99% of the pair. We charge 4-7 and get ~$200k.
- AAPL: v3 **5 bps** - *exact fee parity with us*, 30x our depth, 90% share. The cleanest natural experiment: fee is fully exonerated.
- SPY/NVDA cross: an unhooked **6.25 bps** pool does **$1.1M/day** on $185k TVL. We're cheaper (5) and get ~0%. Cross demand is proven; we just never seeded it.
- TSLA: the volume leader charges **35 bps** and does $860k/day.

So cutting fees buys nothing on these - the flow that routes by price is arb/aggregator flow we
mostly don't want. The precise law (red-team corrected): **depth wins comparable-fee routed flow;
ultra-low fee wins arb flow regardless of depth** (mainnet 1bp: $51M/day on $3.8M TVL; a fresh
0.95 bp GLD probe on our chain already takes ~13% of our best pair on 1/35th our depth). An
undercutter *can* hurt us without TVL - but only with toxic flow. Never price-match one (USDE/USDG
went to 0.3 bps that way); respond with depth and the calendar.

**The growth lever is seeding TVL into proven high-turnover pairs** - NVDA (4.75x turnover, our
highest) and the SPY/NVDA cross (a demonstrated $1.1M/day market where we're already the cheapest
quote).

### 2. The calendar is a moat nobody copies - but it's mis-specified for gold

No competitor on any chain runs calendar-aware fees. Verified live: NVDA's opening spike fired at
**31.8 bps at 13:30:29 UTC** and decayed on schedule. Off-session we're the cheapest
*Uniswap-app-routable* venue on our pairs (not "cheapest on earth" - Ekubo runs 0%-fee probe pools
on RC and 1 bp venues trade 24/7; but those don't get the app's routed retail).

**The defect: GLD runs the equity calendar, but gold trades ~23h/weekday** (CME Globex). Our 3-3.5
bp "overnight/closed" discounts apply at exactly the hours gold price discovery is live elsewhere -
and GLD's flow is a persistent arb channel ($547k/wk, the old "burst" never stopped). We're
discounting the arbitrageurs. Same logic as our own charge-for-the-open research, violated on this
one pair.

### 3. The anti-LVR keeper works - as revenue capture; LP P&L not yet proven

ETH/USDG realized **9.53 bps** volume-weighted against a 4.5 flat - the keeper doubled capture
while the pool kept $1.07M/day. That's the inversion of the mainnet failure mode (5 bps ETH/USDC
LP fees = only ~80% of LVR; passive LPs net-negative - arXiv 2404.05803). Caught live re-poking
intraday (450 -> 671 pips in 27 minutes).

Two honest caveats before calling it proven: (a) fees/volume is revenue, not LP P&L - a per-window
**markout** analysis (poked-high windows vs flat windows) is the actual test; (b) the same
literature says fast blocks cut arb losses 20-70%, and RC is a fast Orbit chain, so C*sigma^2 calibrated
on mainnet assumptions likely overshoots at the top (the ~28 bps pokes). Also: poke value+expiry
are public, so check whether volume times itself into low-fee windows.

---

## Per-pool verdicts

| Pool | Fee (open/overnight/closed, bps) | TVL | Vol 24h | vw fee | Fee APR* | Verdict |
|---|---|---|---|---|---|---|
| ETH/USDG | 4.5 flat + keeper (cap 30) | $373k | $1.07M | 9.53 | ~100% | **WELL SET** - keep; recalibrate C down, prove with markouts |
| SPY/USDG | 5 / 3.5 / 3 | $138k | $484k | 3.77 | 48% | **WELL SET** - don't chase the subsidized 1bp venues |
| GLD/USDG | 5 / 3.5 / 3 (equity calendar) | $64k | $123k | 3.92 | 28% | **SLIGHTLY LOW** - fee level fine, *calendar wrong*: re-spec to gold hours (~flat 5, weekend-only discount). Judge by markout, not revenue |
| NVDA/USDG | 7 / 4 / 3 + spike + close 15 | $43k | $202k | 4.64 | 80% | **WELL SET** - keep; seed TVL, that's the lever |
| META/USDG | 5 / 3.5 / 3 | $25k | $55k | 4.57 | 37% | **TOO LOW** - rivals at 30-35 bps take equal volume; Solana METAx clears 25 organic. Reversible test: 10/7/5 for 2 weeks, revert if share drops >20% |
| AAPL/USDG | 5 / 3.5 / 3 | $2.6k | $3.0k | 4.08 | 17% | **WELL SET** - fee at parity with the 90%-share winner; pure depth gap |
| SPY/NVDA | 5 / 3.5 / 3 | $1.0k | $1.6k | 3.82 | 21% | **WELL SET** - cheapest venue for a proven $1.1M/day market; decision is capital, not price |
| TSLA/USDG | 9 / 5 / 4 + close 16 | $1.1k | $310 | 12.5 | 13% | **SLIGHTLY LOW** *if ever reseeded* (cap a raise at 10-12 open, Solana parity - the 35bps rival's volume may be self-LP wash); academic until then |
| SPY/GLD | 5 / 3.5 / 3 | $1.6k | $136 | 3.73 | 1% | **WELL SET** - only SPY/GLD venue in existence, demand ~0 at any price; apply gold calendar for consistency if GLD re-specs |

\* fee APR = measured 24h fees x 365 / TVL - **spike-day annualized, do not quote these**.

## What incumbents actually charge (compressed)

- **Tokenized equities, Solana xStocks (the apples-to-apples):** clearing range 1-25 bps. SPYx flow concentrates in a **1 bp** pool; NVDAx sustains **10 bps** (33% APR, $2M TVL); AAPLx/METAx clear **25 bps**; TSLAx **10 bps**. Kraken xStocks orderbook: 10 bps taker. Robinhood EU app itself: 10 bps FX per side, closed weekends. TradFi anchor: SPY spread ~0.3 bps.
- **On our own chain:** equities clear 5-35 bps (the 5 bps NVDA/AAPL winners; 35 bps TSLA/SPY pools doing real numbers); sub-5 venues are ve(3,3)-emissions-subsidized or dust probes; memes 29-510 bps. Stable fee-war floor: 0.3 bps.
- **ETH/stable:** mainnet 5 bps wins volume but LPs ~lose net of LVR; 1 bp pools = pure arb conveyors (13.5x turnover); Base's **30 bps** pool wins $89M/day where it holds dominant depth. Dynamic-fee competitors exist on our exact pair (Kyber FairFlow at 0.25 bps, two unidentified v4 dynamic hooks).
- **Gold:** global tier is **5 bps** (PAXG/USDC $2.7M/day, 22% APR). Our 5 open matches it exactly.

## Caveats that gate every number

1. **This was a spike week** - volume is 20-30x the Aug 16-19 baseline, NVDA had earnings, and the surge (Uniswap-app routing? arb? an MM ramping?) is **undiagnosed. Diagnosing it is the #1 follow-up** before acting on anything here.
2. Chain-wide volumes are points/wash-inflated; specifically, the 30-35 bps rival pools' volume may be self-LP wash (fee round-trips to the washer at ~zero cost). The META raise is designed to be safe in either world; the TSLA inference is weaker.
3. All fee APRs are one-day annualizations.
4. DST: the gold-calendar suggestion (and possibly the deployed equity window) is UTC-hardcoded; COMEX/NYSE are ET-anchored - drifts 1h in November. Worth auditing the deployed configs.

## If you decide to act (ranked, all reversible, none done)

1. **Diagnose the volume surge** (who/where from) - gates everything else.
2. **META -> 10/7/5** two-week test; revert if share drops >20%.
3. **GLD calendar -> gold hours** (~flat 5 bps, weekend-only 3); success metric is LP markout, not fee revenue. Watch the 0.95 bp probe's TVL (not volume) for the fee-war opening move.
4. **Seed TVL**: NVDA and the SPY/NVDA cross first (highest turnover; proven demand; we're already cheapest).
5. **Keeper**: markout study per fee-window; then recalibrate C down (~30% starting point, empirically anchored); check whether flow times itself into low-fee windows.
6. TSLA/SPY-GLD: leave until seeded / demand appears.
