# Fables — APR display fixes and fee recalibration

**Status:** ready to execute. Every number below was measured on-chain against Robinhood Chain (4663)
and reconciled against PoolManager `Swap` events. Where something is inferred rather than measured, it
says so.

**Two repos are affected:** `fables-ui` (three APR display defects) and `fables-contracts`
(fee config on three pools).

---

## TL;DR

| # | Change | Repo | Priority |
|---|---|---|---|
| 1 | Deposit flow shows an APR **75x too high** — fix before anything else | fables-ui | **urgent** |
| 2 | `creatorFeeMultiple` returns an inflated multiple labelled `'observed'` | fables-ui | high |
| 3 | APR divides a 24h fee flow by an instantaneous TVL snapshot | fables-ui | high |
| 4 | **GLD/USDG fee is 7.6x below every competitor** | fables-contracts | high |
| 5 | SPY/USDG overnight tier underpriced; level ~1.5x below the dominant venue | fables-contracts | medium |
| 6 | NVDA/USDG closing bell underpriced, Monday reopen inert. **Do not raise its level.** | fables-contracts | medium |

---

# Part 1 — Reasoning

## 1.1 The thing that actually determines what an LP earns

Uniswap displays `fees24h / TVL`. That is the wrong denominator, and it hid the real problem from us for
a long time.

What a position earns is its **share of active liquidity**, not its share of TVL. So the honest test is:
take an identical $100 position, same range, drop it into each pool, and replay every real swap.

Result, over 24h of actual SPY/USDG swaps:

| range | Fables | rival `0xe5923c8a` (6.25 bps) | rival `0xfe2a80bb` (34.99 bps) |
|---|---|---|---|
| ±1% | 78.1% | 107.0% (**1.37x**) | 299.9% (**3.84x**) |
| ±2% | 39.2% | 53.6% (1.37x) | 150.4% (3.84x) |
| ±5% | 15.8% | 21.6% (1.37x) | 60.6% (3.84x) |

**The ratios are identical at every width.** That is the proof that range cancels out entirely. What
remains is only `fee rate × volume ÷ active liquidity`.

Decomposing the 3.84x gap against the 0.35% pool:

- their fee rate is **8.70x** ours
- our volume per unit of active liquidity is **2.27x better than theirs**
- net: 8.70 ÷ 2.27 = **3.84x against us**

**We already win the hard part.** Per unit of liquidity actually working, our pool attracts more than
twice the trading that pool does. We hand all of it back, and more, by charging an eighth of the price.

That is the entire thesis of this document: **the fee is the deficit, not the flow.**

## 1.2 Where our volume actually comes from

534 unique trader EOAs hit Fables SPY/USDG in 48h. 46% traded exactly once. Median trade $105. This is
not a handful of bots — but it is not healthy flow either:

| source | share of our SPY volume |
|---|---|
| one arbitrage contract (`0x0000...296f`) | **~42%** |
| RobinHoodSettler (Robinhood's own app router) | ~9% |
| various others | ~49% |

The 42% contract implements `uniswapV2Call`, `algebraSwapCallback`, `solidlyV3FlashCallback`,
`onMorphoFlashLoan` and Aave's `executeOperation`, and **88% of its transactions touch 2+ pools**. That
is the arbitrage signature.

So roughly half our volume is arbitrage — the flow that costs LPs money — and we price it at 3.5 bps.
That is the worst combination available.

## 1.3 What getting routed by Uniswap would change

Over 48h, the live UniversalRouter (`0x8876789976decbfcbbbe364623c63652db8c0904`, confirmed by selector
`0x3593564c` = `execute(bytes,bytes[],uint256)`) sent:

| pool | total swaps | from UniversalRouter |
|---|---|---|
| Fables ETH | 1,515 | **4** |
| Fables SPY | 1,611 | **1** |
| Fables NVDA | 873 | **1** |
| Fables GLD | 1,086 | **1** |
| Fables META | 168 | **4** |
| rival ETH `0x54f7` | 37,062 | **6,327** |
| rival SPY `0xfe2a80bb` | 5,438 | **3,486** |
| rival SPY `0xe5923c8a` | 17,438 | **1,331** |
| rival ETH `0x387b` | 11,351 | **1,565** |

**11 swaps to us. 12,709 to four rivals.** We are reachable but effectively never selected. The flat
1–4 pattern across five pools with completely different depths and fees rules out "the router looked and
picked someone better" — that would produce a graded distribution.

Three things being routed would give us, in order of value:

1. **Flow quality, not just quantity.** Router flow is uninformed retail. Arbitrage flow is informed and
   extracts value from LPs. Today our mix is roughly half arb; the routed rivals' is a few percent. This
   matters more than volume because it changes what fee is *sustainable* — you can charge retail and keep
   it, you can only tax arbitrage until it stops coming.
2. **It makes the fee increase safer.** The main risk of raising fees is losing price-sensitive routed
   flow. We have essentially none to lose. That is an argument for raising now — but it is also why
   getting routed *later* is worth more than the fee change: it is the only source of upside that scales.
3. **Volume.** The obvious one, and the least important of the three.

### Why we are probably not routed — **this is a hypothesis, not a measurement**

The one structural difference: **every Fables pool has a hook and `isDynamicFee: true`. Every routed
rival has neither.** Uniswap's routing quoter historically does not quote arbitrary hooked pools because
it cannot simulate hook logic reliably, and a dynamic fee is the hardest case.

This fits all the evidence but **has not been verified.** The test is cheap and worth running: check
whether the UniversalRouter routes to *any* of the 106 hooked pools on this chain. If it routes to some
hooked pools but not ours, the cause is something else (allowlist, verification, quoter registration).
If it routes to none, the hook is the cause and the fix is a Uniswap-side integration question, not
something we can configure away.

**Do not treat "we are excluded because of the hook" as established when planning around this.**

## 1.4 Why raise fees at all, given we might lose volume

Two points on a demand curve, measured as volume per unit of active liquidity:

| venue | fee | vol/liquidity (Fables = 1.00) |
|---|---|---|
| Fables SPY | 4.02 bps realised | 1.000 |
| rival `0xe5923c8a` | 6.25 bps | 0.877 |
| rival `0xfe2a80bb` | 34.99 bps | 0.441 |

Constant-elasticity fit gives ε ≈ 0.30–0.40. Revenue exponent `1 − ε ≈ +0.62`, i.e. **fee revenue rises
with fee across the entire measured range.** There is no interior maximum.

**Be honest about what that means: there is no locatable optimum.** The model's answer to "what fee
maximises revenue" is literally "become the most expensive pool on the chain." Reasons not to take it:

- These are **three different pools, not one pool at three fees.** The 0.441 is confounded with their
  depth, their routing share, their age and their flow mix. It is a cross-section being used as a causal
  curve. This is the single largest weakness in the analysis.
- A power law cannot represent a **threshold**. If there is a fee above which flow stops entirely,
  revenue goes to zero above it and the fit is worthless. Two points cannot detect a step function.
- The fitted elasticity is largely an **arbitrage** elasticity, given the flow mix in 1.2.

**So: move in stages and instrument the move.** The evidence supports a large increase in one direction
and is silent about where to stop.

---

# Part 2 — fables-ui: APR display defects

## 2.1 Deposit flow overstates APR by ~75x — **fix first**

**Files:** `src/routes/deposit/DepositRoute.tsx:453`, `src/routes/deposit/StepRange.tsx:132-133`

```ts
// DepositRoute.tsx:453 — current
const positionApr = poolApr === null ? null : totalApr(poolApr * concentrationValue, pool.id)
```

`concentration()` (`src/data/gw-pool.ts:162`) is `1/(1-(P_lower/P_upper)^0.25)` — capital efficiency
**measured against full range**. But `poolApr` is `aprPctOf(fees24hUsd, tvlUsd)`, whose denominator is
the pool's real token balances — capital that is *already deployed in narrow ranges*. **The concentration
factor is applied twice.**

What a user sees for Fables SPY (pool swap APR 29.41%, creator multiple 1.1866):

| range | concentration | displayed APR | $1,000 "annual projected earnings" |
|---|---|---|---|
| Tight (±80 ticks) | 250.5x | **8,742%** | $87,429 |
| typed ±1% (±100 ticks) | 200.5x | **6,997%** | $69,978 |
| **Balanced (±400) — the default** | 50.50x | **1,762%** | **$17,626** |
| Wide (±1200) | 17.17x | 599% | $5,993 |
| Full range | 1.00x | 34.9% | $349 (correct) |

Measured truth for a real ±1% SPY position: **78.1% swap / 92.7% with creator fee.** The ±1% screen
prints 6,997%. **Overstated 75.5x.**

The same pool reads **34.9% on the markets row** (`PoolStatRow.tsx:90` calls `totalApr(pool.aprPct.v,
pool.id)` with no concentration term) and **1,762% on the deposit screen that row opens**. `pickDefault`
(`range.ts:53`) can only return `'balanced'` or `'wide'`, never `'full'`, so every default user sees at
least a 17x inflation. There is no clamp — `fmt.ts:58` prints the raw number.

**Fix.** Use the share-based estimator that `positions-store.ts:290-293` already implements for live
positions:

1. Compute the prospective position's `L` from the entered amounts and bounds (`range.ts:depositAmounts`
   already has the sqrt-price math).
2. Expose `PoolChain.liquidity` (`pool-store.ts:73`) through `PoolView`, the way `poolSqrtPrice()` already
   exposes `sqrtPriceX96`.
3. Project `share = L_new / (L_active_in_range + L_new)`, then
   `fees24hUsd * share * 365 / depositValueUsd`.

This includes dilution by the deposit's own size and converges to the portfolio number the user sees one
screen later.

Fix **both** call sites — they are computed separately (props passed at `DepositRoute.tsx:561-563`).

**Also delete or invert `src/data/creator-fees.test.ts:218-222`** (`it('scales with concentration')`).
It currently asserts the bug, so the correct fix would fail CI and the next reader would restore it. The
prose at `creator-fees.ts:231-233` and `gw-pool.ts:158-161` endorses it too and should be corrected.

## 2.2 `creatorFeeMultiple` mislabels an inflated multiple as observed

**File:** `src/data/creator-fees.ts:183-198`

```ts
let seen: Origin = 'observed'
for (const id of ELIGIBLE) {
  const f = fees24hUsd(id)
  if (f.o === 'pending') return { v: null, o: 'pending' }
  if (f.v !== null) total += f.v
  if (f.o === 'unavailable') seen = 'unavailable'      // line 194 — set
}
if (total <= 0) return { v: null, o: seen === 'unavailable' ? 'unavailable' : 'observed' }
return { v: (pot * 52) / (total * 365), o: 'observed' } // line 197 — `seen` ignored
```

`seen` is only consulted in the `total <= 0` branch. On the success path it is discarded.

**Consequence:** an eligible pool whose fee read is unavailable silently drops out of `total`. Because
the multiple is `(pot × 52) / (total × 365)`, a smaller denominator makes the multiple **larger** — and
it is returned labelled `'observed'`. Every APR on every surface inherits the inflation with a confident
origin.

The `'pending'` case was handled correctly with an early return. `'unavailable'` was missed.

**Fix:** propagate `seen` on the success path — return `{ v, o: seen }`, or return
`{ v: null, o: 'unavailable' }` if a partial denominator should not produce a number at all. The comment
at :191-192 ("ANY pending read makes the DENOMINATOR wrong, not just its own row") already states the
correct principle; it just was not applied to `'unavailable'`.

## 2.3 APR divides a 24h flow by an instantaneous TVL snapshot

**File:** `src/data/gw-pool.ts:154`

```ts
export function aprPctOf(fees24hUsd: number, tvlUsd: number): number {
  return tvlUsd > 0 ? ((fees24hUsd * 365) / tvlUsd) * 100 : 0
}
```

Fees accrued over 24 hours against TVL as of *now*. Every Fables pool is growing fast; every competitor
is flat. So we systematically divide by a denominator that did not exist when the fees were earned.

Measured by reconstructing hour-by-hour TVL from the position set (validated: matches the gateway to
**0.3%** on Fables ETH):

| pool | 24h TVL change | end/TWA | APR shown | APR on time-weighted TVL |
|---|---|---|---|---|
| ETH/USDG | +159% | **1.42** | 61.0% | **85.2%** |
| GLD/USDG | +754% | 2.69 | 63.1% | 169.7% |
| SPY/USDG | +61% | 1.31 | 27.2% | 35.6% |
| competitors | −1% to +6% | 0.91–1.00 | — | (barely moves) |

**Cheapest fix:** `gw-pool.ts` already reads `totalLiquidityPercentChange24h` into `tvlChangePct`. Using
`TWA ≈ TVL × (1+g/2)/(1+g)` gets ETH to 1.44x against the true 1.40x — within 3%, one line, no new data.
It degrades on extreme drift (GLD: 1.79 vs true 2.69).

**Durable fix:** hourly TVL snapshots in the keeper that already writes fee history to Upstash.

Note this correction revises *down* as well as up (competitor `0x387b` goes 91.0% → 87.4%), which is what
makes it a correction rather than a flattering adjustment.

---

# Part 3 — fables-contracts: fee configuration

Config is `SessionLib.FloorConfig`:
`(openFloor, overnightFloor, closedFloor, spikeMult, closedSpike, descentWindow, closeFloor, closeBefore, closeAfter)`

Bounds to respect: all floors nonzero and ≤ pool cap; `descentWindow ≤ 6h`; `spikeMult ≤ 20`. Current
cap is 8000 on all three pools.

## 3.1 Where competitors actually price — measured by volume share

Fee tiers that exist are irrelevant; what matters is where the volume clears.

### GLD/USDG — we are **7.6x too cheap**

| pool | fee | TVL | 24h vol | share |
|---|---|---|---|---|
| **v3 `0x7A6A053e`** | **3000** (0.30%) | $126k | $592k | **72%** |
| **Fables** `0xfe281bbf` | 500 → **397 realised** | $39k | $145k | 17.6% |
| v3 `0x32cb909a` | 10000 (1.00%) | $82k | $83k | 10.1% |
| v4 `0x2df9fb9e` | 9820 (0.98%) | $5k | $3k | 0.3% |

Every competitor charges 3000–10000 pips. **We already hold 17.6% of volume at 397.** Biggest and
cleanest opportunity in the set.

### SPY/USDG — we are ~1.5x below the venue that matters

| pool | fee | TVL | 24h vol | share |
|---|---|---|---|---|
| **v4 `0xe5923c8a`** | **625** (0.0625%) | $500k | $1.80M | **69%** |
| v4 `0xfe2a80bb` | 3499 (0.35%) | $383k | $286k | 11% |
| **Fables** `0x8674c1c5` | 500 → **409 realised** | $124k | $237k | 9.1% |
| v3 `0xa7Bb1AC6` | 500 (0.05%) | $40k | $162k | 6.2% |

The market clears at **625**, not 3499. The 3499 pool holds only 11% — useful as proof there is room
above, not as the anchor.

### NVDA/USDG — we are already **1.7x more expensive**

| pool | fee | TVL | 24h vol | share |
|---|---|---|---|---|
| **v3 `0xd4EB2120`** | **500** (0.05%) | **$2.61M** | **$21.5M** | **96%** |
| v4 `0x3bb34a44` | 3499 | $1.04M | $240k | 1.1% |
| **Fables** `0x7990aad9` | 700 base → **837 realised** | $34k | $24k | 0.1% |

A v3 pool with **556,439 transactions** owns this pair. It charges **less than our openFloor** and earns
~150% APR on 8.2x daily turnover against our 0.7x.

**NVDA is not a fee problem. Do not raise its level.**

## 3.2 SPY/USDG — recalibrate

Current on-chain: `(500, 350, 300, 0, 0, 0, 0, 0, 0)`, cap 8000. Flat — no reopen spike, no closing ramp.

Measured hourly volatility over 7 days:

| window | σ/hr | current fee | ratio to session |
|---|---|---|---|
| session (13:30–20:00 UTC) | 10.9 bps | 500 | 1.00 |
| **overnight (futures live)** | **10.0 bps** | **350** | 0.70 |
| dark (Fri 21:00 → Sun 22:00 UTC) | 6.1 bps | 300 | 0.60 |

Two conclusions:

- **The weekend tier is already about right.** 300/500 = 0.60 against a measured vol ratio of 0.56.
  Futures genuinely are shut (CME ES: Sunday 18:00 ET → Friday 17:00 ET), and the data confirms it.
- **The overnight tier is the error.** It is **92% as volatile as the session** — ES futures trade
  straight through it, so fair value is continuously observable and arbitrageable — and we discount it
  30%. On σ² it should be ~420, on σ ~460.

### Proposed

```solidity
SessionLib.FloorConfig({
    openFloor:      1000,  // was 500  — 2.0x level
    overnightFloor:  900,  // was 350  — 2.6x: catches up to measured sigma
    closedFloor:     500,  // was 300  — 1.7x: ratio was already correct
    spikeMult:         4,  // was 0
    closedSpike:    5000,  // was 0    — must exceed overnightFloor*spikeMult (3600)
    descentWindow:  3600,  // was 0    — 1h
    closeFloor:        0,  // leave off: SPY close signal not established per-pool
    closeBefore:       0,
    closeAfter:        0
});  // cap 8000
```

**Why the reopen spike matters more than the level.** The dark window's risk is not diffusion, it is a
**jump released at reopen**. `SessionLib.floorFor:113` (`if (cfg.descentWindow == 0) return cfg.openFloor;`)
means that mechanism is currently dead code. Note also that our CLOSED tier runs to Monday 00:00 ET while
futures reopen **Sunday 18:00 ET** — six hours where the weekend's news is being priced into futures and
we charge 3 bps. `closedSpike` is exactly the instrument for it.

## 3.3 GLD/USDG — the big one

Current on-chain: `(500, 350, 300, 0, 0, 0, 0, 0, 0)`, cap 8000. Identical to SPY.

Gold follows the same session logic as SPY (COMEX GC / spot XAU trade ~23h/day, shut Friday 17:00 ET →
Sunday 18:00 ET), so the tier *shape* carries over. The **level** does not: every GLD competitor charges
**3000–10000 pips** against our 397, and we hold 17.6% of volume at that price.

### Proposed — staged

**Stage 1** (roughly 3x, still well under the 3000 the dominant venue charges):

```solidity
SessionLib.FloorConfig({
    openFloor:      1500,  // was 500
    overnightFloor: 1400,  // was 350  — futures live, near-session volatility
    closedFloor:     800,  // was 300
    spikeMult:         4,
    closedSpike:    7000,  // must exceed overnightFloor*spikeMult (5600)
    descentWindow:  3600,
    closeFloor:        0,
    closeBefore:       0,
    closeAfter:        0
});  // cap 8000
```

**Stage 2**, only after two weeks of data: if volume share holds above ~10%, move toward 3000 to match
the dominant venue. The cap may need raising above 8000 for that; check `_setPoolBounds` first.

**Measure between stages.** Track volume share and realised fee. If share collapses below ~5%, stop — that
is the threshold a two-point elasticity fit cannot predict.

## 3.4 NVDA/USDG — shape only, no level change

Current on-chain: `(700, 400, 300, 8, 3200, 7200, 1500, 1800, 900)`, cap 8000. The curve **is live** —
200+ distinct fee values from 300 to 3198 observed on-chain.

Measured intraday, 7 days:

| window | fee charged | measured σ/hr | fee implied by σ |
|---|---|---|---|
| midday (+2h..5.5h) | 700 | 21.7 bps | baseline |
| open +0..30m | 2,910 | 48.0 | ~1,550 |
| open +30..60m | 2,208 | **68.0** | ~2,200 |
| open +60..120m | 1,344 | 52.0 | ~1,680 |
| **close −30..0m** | **700** | **94.0** | **~3,000** |
| **close +0..15m** | **996** | **188.6** | **~6,100** |

- **Opening bell: right size, front-loaded.** Peak fee is in the first 30 minutes; peak toxicity is in the
  second. At +30..60m the fee is almost exactly right.
- **Closing bell: badly underpriced.** The last 30 minutes run 4.3x midday volatility and the 15 after
  close run 8.7x — the most toxic window in NVDA's week. `closeFloor` caps at 1500 and we collected only
  700–996 volume-weighted, because most volume arrives early in the ramp near `openFloor`.
- **Monday reopen is inert.** `closedSpike` = 3200 and `overnightFloor × spikeMult` = 400 × 8 = 3200.
  `SessionLib.floorFor:123` picks between two identical values, so an open after 56 dark hours prices
  exactly like a routine Tuesday.

### Proposed

| field | now | proposed | why |
|---|---|---|---|
| `openFloor` | 700 | **700** | unchanged — we are already above the dominant venue's 500 |
| `overnightFloor` | 400 | **400** | unchanged — needs its own measurement first |
| `closedFloor` | 300 | **300** | unchanged |
| `spikeMult` | 8 | **6** | trims the over-tall first 30m without touching +30..60m, which is right |
| `closedSpike` | 3200 | **5000** | must exceed `overnightFloor × spikeMult` (2400) to stop being inert |
| `descentWindow` | 7200 | **7200** | unchanged |
| `closeFloor` | 1500 | **3000** | measured σ says 3000–6000; 3000 is the conservative end |
| `closeBefore` | 1800 | **3600** | ramp starts an hour out so volume is not all priced at the foot |
| `closeAfter` | 900 | **1800** | the +0..15m window is the worst and extends past 15m |

**Caveat:** the two closing buckets are **n=24 and n=10 swaps**. The direction is unambiguous; the
magnitude is soft. Do not tune further off this sample — collect another week first.

---

# Part 4 — What is genuinely uncertain

1. **Why we are not routed.** Hypothesis only (see 1.3). Test it before planning around it.
2. **Elasticity.** Two cross-sectional points from three different pools. Supports "raise a lot", cannot
   say where to stop. Staging is not caution, it is the only available method.
3. **NVDA closing-bell magnitude.** n=10 and n=24.
4. **GLD is volatile in every sense.** TVL grew 754% in 24h, so its 189% APR has a wide error bar. The
   fee gap against competitors is solid; the APR is not.
5. **GLD, META and SPY/GLD have no config in the repo scripts** despite being configured on-chain
   (verified via `PoolConfigured` events). Worth reconciling — someone configured them another way, and
   the repo no longer describes production.
6. **SPY overnight for single names does not transfer.** AAPL/NVDA/TSLA/META have real extended-hours
   trading but no continuous futures. Their overnight tiers need their own measurement; do not copy SPY's.

---

# Appendix — how to reproduce

- Fee actually charged: `Swap` event `fee` field from PoolManager
  `0x8366a39CC670B4001A1121B8F6A443A643e40951`, filtered by pool id, bucketed hourly.
- Volume: sum `|amount|` of the USDG leg. Reconciles to the cent against Uniswap's
  `LiquidityService/GetPoolHistoryVolume` (ratio 1.000 on all three SPY pools).
- Active liquidity / depth: `liquidity` field on each `Swap`.
  `depth(±1%) = L × sqrt(P) × 1e-12 × (sqrt(1.01) − 1)`.
- TVL over time: replay `ModifyLiquidity` events into a position set, value each position at each hour's
  tick. Validated to 0.3% against the gateway on Fables ETH.
- Live config: `PoolConfigured` events on each hook — authoritative over the repo scripts.
- Volatility: hourly close-to-close log returns from `Swap` ticks, σ per regime. Do **not** use summed
  `|Δtick|` path length across pools — it is biased by swap count.

---

# Addendum — 2026-08-26: session-shape recalibration, and a withdrawal

Written after the Uniswap routing approval went live. Everything below is measured; sources are
730 days of 1h equity/futures bars, 60 sessions of 5m bars, and on-chain reads dated 2026-08-26.

## The question this settles

Whether a tokenised-equity pool should charge MORE or LESS outside the cash session. It should
charge less, which is the direction the launch ladder already had. Per-hour realised variance of
the fair value, annualised sigma:

| | OPEN | OVERNIGHT | CLOSED |
|---|---|---|---|
| SPY | 19.7% | 10.6% | 3.4% |
| NVDA | 55.5% | 38.4% | 9.8% |

A tokenised equity has no reference price to be arbitraged against on a Saturday, so the closure
is the one window that costs an LP almost nothing. Raising into it taxes the cheapest hours of the
week. Theory agrees: the optimal AMM fee is a pro-cyclical function of instantaneous variance
(arXiv 2606.21769), and the sublinearity comes from uninformed-volume elasticity, not from any
term that would flip the sign.

## What was wrong

1. **The ladder was too flat.** Break-even per tier, `f = (sigma^2/8) * k * hours * TVL / volume`,
   with `k` measured live as `2*L*sqrt(P)/TVL` from Swap events (SPY **82.1**, NVDA **20.3**, not
   the 26-42 this document assumed at section 3): break-even shape is OPEN 1.00 / OVERNIGHT 0.47 /
   CLOSED 0.28 on SPY and 1.00 / 0.66 / 0.05 on NVDA. Shipped was 1.00 / 0.70 / 0.60 and
   1.00 / 0.57 / 0.43.

2. **SPY's bells were switched off on too small a sample.** The launch call rested on 114 swaps.
   Sixty sessions of 5-minute underlying data put SPY's 09:30-10:00 at **3.40x** the mid-session
   median and its 15:30-16:00 at **1.77x**. NVDA reads 5.73x and 2.18x.

3. **`closeAfter` was pricing the calmest window of the day.** 16:00-16:15 measures **0.51x**
   (NVDA) and **0.57x** (SPY) of mid-session. NVDA held 15 bps there for 900 seconds.

4. **NVDA does not cover its LVR.** Post-routing break-even is 21.7 bps at the open against 7.0
   charged. Routing lifted SPY (20.2% of swaps now arrive via the UniversalRouter, volume doubled,
   break-even fell to 4.0 bps against 5.0 charged) and skipped NVDA (12.6%), which is consistent
   with section 3.1: NVDA is the one pair where we are priced above the venue that owns it.

## Withdrawn: D2, the `closedSpike` recommendation

Section 3.4 and the fee model both said `closedSpike` is inert because it equals
`overnightFloor * spikeMult`, and told the operator to raise it above the routine spike. **That is
wrong and the recommendation is withdrawn.** The Monday open is not more toxic than any other
open: its 09:30-10:00 variance is **0.91x** (SPY) and **0.94x** (NVDA) of a Tue-Fri open, and
Monday pre-market is **0.72x / 0.80x**. The weekend gap is larger in total (NVDA 2.13% vs 1.95%
sd) but it is absorbed by pre-market and the opening auction exactly as a weeknight gap is. The
equality is deliberate, as P1_02's own comment says, and it stays. The only reason `closedSpike`
must be set at all is `setPoolConfig`'s "must exceed openFloor" check.

## What shipped

`script/recal/R_01_RecalibrateNvdaSpy.s.sol`, with `test/RecalibrationNvdaSpy.t.sol` pinning every
number. SPY 500/350/300 -> **900/450/250** with descentWindow 7200, spikeMult 6, closedSpike 2700,
closeFloor 2200 / closeBefore 1800 / closeAfter 0. NVDA 700/400/300 -> **1400/900/250**, spikeMult
5, closedSpike 4500, closeFloor 3500 / closeBefore 1800 / closeAfter 0. Time-weighted over a normal
week: SPY 362 -> 534 pips, NVDA 512 -> 888. Caps unchanged at 8000; no redeploy.

NVDA stops deliberately short of its 21.7 bps break-even. Pricing to LVR in one step would put us
at 4x the v3 venue holding 98% of the pair, on a pool whose deficit is distribution.
