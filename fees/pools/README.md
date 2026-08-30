# Per-pool competitive analysis

One document per Fables pool, answering a single question: **is this the most efficient pool on
Robinhood Chain for its asset, and if not, what would make it so.**

Fees in pips throughout: 100 pips = 1 bps = 0.01%.

**[REVIEW-BRIEF.md](REVIEW-BRIEF.md) is the entry point for a reviewer**: why this exists, what is
shipping, everything that was got wrong and corrected, and what to hit hardest.
**[OVERVIEW.md](OVERVIEW.md) is the one page.** Read it after, for the nine-pool map.
**[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md) is the frozen "before" state**, corrected on the
evening of 2026-08-30 after a dual review found five blocking errors: see its section 8. A fee change
is shipping on SPY, NVDA and META, cut back on 31 Aug to the four tiers that did NOT change on
28 August: the rest were reversals of a three-day-old config written as raises. GLD and ETH ship no change but **neither is a valid control**,
because both had their own fee moved inside the window, so drift is measured from the field instead.
Re-measure 1 to 2 days after the change using section 6 of that file.

| document | state | fee change | headline |
|---|---|---|---|
| [OVERVIEW.md](OVERVIEW.md) | the one page | n/a | all nine pools on one table; the book is $1,609,701 of TVL and $15,061.85 of fees in the week, 86% of it GLD and ETH |
| [BASELINE-2026-08-30.md](BASELINE-2026-08-30.md) | frozen, never edit | n/a | the cross-asset "before", the pre-registered predictions, and the re-measurement recipe |
| [SPY-USDG.md](SPY-USDG.md) | baseline frozen | o/n 350->450, closed 250->400 | 0.26x market fee, 0.30x market APR, on 9.0% of the asset's TVL |
| [NVDA-USDG.md](NVDA-USDG.md) | baseline frozen | closed 300->450 only | corrected: the field is 592 pips not 845 once two dead venues are dropped, so we are ABOVE market at 1.09x, and the session tier earns 1.19x the field APR |
| [META-USDG.md](META-USDG.md) | baseline frozen | closed 250->450 only | worst discount on the board at 0.08x market fee in closed hours, but its measured demand curve slopes UP, so the raise is cut to a step |
| [GLD-USDG.md](GLD-USDG.md) | no change, **not a valid control** | none | its own config changed inside the window, 2026-08-29 19:19 UTC. Still the only within-session fee experiment we have |
| [ETH-USDG.md](ETH-USDG.md) | no change, **not a valid control** | none | the opposite error: 5.37x market fee, 0.52% share, and its keeper repriced it daily |
| [TSLA-USDG.md](TSLA-USDG.md) | baseline frozen, **dust** | none, none proposed | $2,260 of TVL and $4.95 of fees in the whole week; 0.25x fee, 0.08x APR on a denominator too small to act on |
| [AAPL-USDG.md](AAPL-USDG.md) | baseline frozen, **dust** | none, none proposed | $4,259 of TVL, $18.17 of fees; the entire zero-elasticity prize is $74.66, and adding a fourth mover would only add noise |
| [NVDA-SPY.md](NVDA-SPY.md) | baseline frozen, **dust** | none | $4,395 of TVL, $2.25 of fees; worst APR ratio of any Fables pool at 0.05x, and its closed row at 0.03x is the lowest cell in the table |
| [SPY-GLD.md](SPY-GLD.md) | baseline frozen, **dust** | none, not a control either | smallest pool we run: $1,073 of TVL, $1.33 of fees; we are the only venue on chain quoting the pair, so its 1.00x is an identity, not a win |

Two labels in that table carry weight. **Dust** means the pool holds $1k to $4k of TVL and earned
single-digit or low-double-digit dollars over 167 hours: the ratios are honest arithmetic and none
of them is worth a decision. And the market APR for TSLA, AAPL and NVDA/SPY is **charged-basis, not
LP-net**, because `protofee.json` covers under 0.5% of those fields by volume, so those market APRs
are overstated and our ratio understated. Each document states its own correction.

### The benchmark is the whole field, never one rival

Every metric compares Fables against the **volume-weighted field**, not against a chosen incumbent.
This was a real error in the first pass and it changed conclusions: benchmarking SPY against "the
deepest rival at 625 pips" hid that the volume-weighted market fee is 1,167, and benchmarking NVDA
against "the incumbent at 500" wrote out a venue realising 9 pips on $1.68M. Compute:

```
market fee = sum(fees) / sum(volume) across EVERY venue trading that asset
market APR = sum(LP-net fees) / sum(TVL) across EVERY venue
```

and report ours as a ratio to each. Rank is secondary; the ratio is the number that means something.

### Two windows, and one of them has broken a conclusion

Report both. Where they disagree, the 167h window wins.

| window | source | answers | n |
|---|---|---|---|
| 48h chain scan | raw Swap events | depth, k, utilisation, exact per-swap fee | 1 cash session |
| 167h buckets | LiquidityService | share, fee and APR **by session** | 5 cash sessions |

On 2026-08-30 the 48h scan said NVDA's session earned **1.46x** the market APR. Over five sessions
it was **0.95x**. Never draw a session conclusion from the chain scan alone.

## Method

The point of these documents is that **a snapshot proves nothing**. Every headline number in the
earlier fee work was a single reading of TVL, volume and fee at one instant. That is how a pool whose
depth quadrupled inside a window can be ranked last on an APR that divides a period's fees by its
closing TVL. So each pool is measured as a time series, per hour, from raw chain data.

### 0. The two windows, and the pre-flight check

There are two windows and they answer different questions. Running only one of them is the mistake
this section exists to stop.

| window | source | answers | why not the other |
|---|---|---|---|
| **48h chain scan** | raw `Swap` events | depth, exact per-swap fee, utilisation, time-weighted TVL, intra-hour fee behaviour | the indexer publishes no depth at all |
| **7d hourly buckets** | LiquidityService | share, realised fee and APR **by session**, over 5 cash sessions | a chain scan of 7d on a busy pool is not practical |

**Pre-flight, before launching any scan: compute which sessions the window will contain, and print
them.** A 24h window taken on a Sunday contains zero cash-session hours and is worthless for the
question these documents ask. This was learned by wasting a scan on NVDA on 2026-08-30.

- The chain scan is **48h and must contain at least one complete cash session**. If the head lands on
  a weekend, 48h reaches back to Friday's session and is the minimum that works; a Sunday-afternoon
  head needs more.
- Never draw a session conclusion from the chain scan alone. It holds one session at best, so it is
  n=1. The session comparison comes from the 7d buckets, which hold five.
- State the session composition of every window in the document, in hours, so the reader can see the
  n.

`pool_series.mjs <config.json> <hours> <out.json>` is the scanner; the config carries the venue list,
the asset spot mark, and per-venue `assetIdx`, `quoteIdx`, `quoteDecimals` and `quoteUsd`.

### 0b. Cost, so the window is chosen deliberately

Scan time is set by swap density, not by pool count. The node caps a response at roughly 2,000 logs,
so a chunk holding 20,000 logs bisects four levels deep and costs about 30 sub-calls. Budget from the
census `txCount` before launching:

| asset | venues | window | swaps | wall clock |
|---|---|---|---|---|
| SPY | 8 | 48h | 206,361 | ~40 min |
| NVDA | 14 | 24h | 91,000 | ~11 min |
| NVDA | 14 | 48h | ~200,000 | ~30 min |

**1. Enumerate the whole field, not a hand-picked rival list.**
v3 exhaustively from the factory `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` by calling
`getPool(token0, token1, fee)` over every fee tier and pair. v4 from the Uniswap gateway's
`topV4Pools(chain: ROBINHOOD, first: 100, tokenFilter: <token>)`, once per token; the `first`
argument caps at 100 and takes no cursor, so coverage is complete only down to a per-token TVL
floor which each document states. v2 from `topV2Pairs`. `tokenFilter` accepts the zero address and
does return native-ETH pools, which an earlier pass wrongly assumed it did not.

**2. Read every swap.** For each venue, scan `Swap` events over the window: v4 from PoolManager
`0x8366a39CC670B4001A1121B8F6A443A643e40951` filtered by poolId, v3 from the pool address. The node
caps a `getLogs` response at roughly 2,000 logs and answers "Missing or invalid parameters" when a
range would exceed it, so ranges must bisect on failure rather than being fixed at a block count.

**3. Derive everything from the swaps, so nothing depends on an indexer.**

```
volume  = |asset leg| * asset spot, per swap
fee     = v4: the swap's own uint24 fee field, exact per swap. v3: the pool's static fee
depth   = virtual = 2 * L * sqrt(P) in USD, from the liquidity and sqrtPriceX96 each swap carries
share   = a pool's hourly volume over the hour's total across every venue for that asset
APR     = fees * 8760 / capital
```

**4. Report APR on two bases.** `APR on working capital` divides by virtual and needs no
reconstruction. `APR on TVL` divides by a TVL scaled by `virtual(h)/virtual(end)`, which assumes the
range distribution held over the window; the `ModifyLiquidity` counts are reported so the assumption
is auditable. **Never quote an APR off an end-of-window TVL while a pool is growing.** On SPY that
error alone was worth 61 points of APR and four places.

**5. Report LP-net, not charged.** v3 packs `feeProtocol` as two nibbles, each the denominator of
the protocol's cut. v4 packs `protocolFee` as two 12-bit pip values and the Swap event reports the
composed fee, so the LP's share of what the trader paid is `1 - protocolFee/charged`. Every Fables
pool runs `protocolFee = 0` and keeps 100%; rivals keep 75% to 86%. Comparing charged fees flatters
them by 11% to 33%.

The indexer's `feeUsd` was independently verified against chain and reproduces to the USDG wei
across 10,905 swaps and three fee tiers, including an hour where the hook stepped 350 to 800 pips
mid-bucket. So the 7d hourly buckets are trustworthy for volume, fees and share at horizons longer
than a chain scan is practical for. Depth is not available from them.

## Where the working files live

Scripts, raw JSON and logs are in `Research/Fables/fee-rerun-2026-08-30/`, outside this repo. The
reusable scanner is `pool_series.mjs`, driven by a per-asset config; `census.mjs`, `census2.mjs` and
`census3.mjs` build the field; `depth.mjs` reads k live. These documents are the output.

## Relationship to the other fee work

- [../FEE-POSITION.md](../FEE-POSITION.md) and its reply set the current ladder from a naive-LVR
  break-even. That work is absolute: it asks whether a tier covers its own adverse selection. These
  documents are relative: they ask whether the tier wins.
- [../deviation/DEVIATION-FEE.md](../deviation/DEVIATION-FEE.md) proposes a second-order deviation
  term on top of the calendar ladder. Each pool document states explicitly where the deviation term
  changes its conclusions and where the two disagree on parameters.
