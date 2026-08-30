# Per-pool competitive analysis

One document per Fables pool, answering a single question: **is this the most efficient pool on
Robinhood Chain for its asset, and if not, what would make it so.**

Fees in pips throughout: 100 pips = 1 bps = 0.01%.

| pool | status | verdict |
|---|---|---|
| [SPY-USDG.md](SPY-USDG.md) | done 2026-08-30 | not first on any LP metric; the cause is not what we assumed |
| NVDA-USDG.md | in progress | |
| GLD-USDG.md | pending, blocked on the dislocation in [../deviation/](../deviation/) | |
| META-USDG.md | pending | |
| ETH-USDG.md | pending | |

## Method

The point of these documents is that **a snapshot proves nothing**. Every headline number in the
earlier fee work was a single reading of TVL, volume and fee at one instant. That is how a pool whose
depth quadrupled inside a window can be ranked last on an APR that divides a period's fees by its
closing TVL. So each pool is measured as a time series, per hour, from raw chain data.

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
