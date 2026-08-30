# fees/deviation

The proposal that every Fables RWA pool should price its distance from its reference market, not just
the time of day. `DEVIATION-FEE.md` is the document; everything here exists so every number in it can
be re-derived from scratch.

Worked example throughout: the GLD/USDG dislocation of 28 to 30 August 2026, when the pool ran to
+381% above fair while gold itself moved 0.13%, and earned $1,437 on $4.8M of volume because the
closed tier prices 300 pips.

## Layout

```
DEVIATION-FEE.md   the proposal, the parameters and the argument for each of them
SYSTEM-SPEC.md     the build decision: keeper, reference, what is and is not available, locked params
scripts/           fetchers, on-chain probes, and the model
data/              everything the fetchers wrote, committed so the tables can be checked offline
bars/             Yahoo hourly bars, NOT committed (see .gitignore), rebuilt by fetch-bars.mjs
```

## Reproducing

```
cd scripts
npm install                  # viem only

node fetch-pools.mjs         # Uniswap gateway snapshot        -> ../data/now.json
node fetch-prices.mjs        # per-pool hourly price history   -> ../data/prices.json
node fetch-paxg.mjs          # Binance PAXG and XAUT klines    -> ../data/paxg.json
node fetch-bars.mjs          # Yahoo 1h bars, 730d, 8 symbols  -> ../bars/   (~8 MB)

python model.py              # sections 4 to 9 of the document
python gaps.py               # section 6.1, the per-asset gap distribution
```

Each block of `model.py` output is labelled with the section of `DEVIATION-FEE.md` it backs, so the
check is a diff.

## Evidence probes

Independent of the model and of each other. Each answers one factual question the argument rests on.

| script | question |
|---|---|
| `probe-hooks.mjs` | what caps, poke floors and bytecode constants every RWA pool actually carries, and who controls the v4 protocol fee |
| `probe-oracles.mjs` | which price feeds exist on chain 4663, what they say, and how stale they are |
| `probe-token.mjs` | did the GLD token have a shares-per-token event (it did not: `uiMultiplier()` is 1e18) |
| `probe-rivals.mjs` | what the rival GLD venues price off their own `slot0`, so the dislocation is not ours alone |
| `probe-config.mjs` | the pool's full `PoolConfigured` and `FeePoked` history |
| `probe-lp.mjs` | `ModifyLiquidity` over the event, so LP flight can be separated from trading |
| `probe-direction.mjs` | is any pool's fee direction-dependent (no: all seven symmetric, no delta flags) |
| `reference-census.mjs` | which assets have a continuous reference, how tight it tracks, and the kicker it earns |

All on-chain reads go to `https://rpc.mainnet.chain.robinhood.com`, which rate-limits: `lib.mjs`
carries the serialising gate, the retry and the range-halving that the fee scripts already use.

## Data

`data/` holds what the fetchers wrote on 2026-08-30. Committed so the document can be checked without
re-pulling, and because the event window is gone once the gateway rolls its history.

| file | source |
|---|---|
| `now.json` | Uniswap gateway, chain ROBINHOOD: TVL, fee tier, hourly volume and fee buckets, per pool |
| `prices.json` | Uniswap gateway: hourly price history per pool, day, week and month |
| `paxg.json` | Binance spot: PAXGUSDT and XAUTUSDT hourly klines, 120 days |
| `oracle.json` | chain 4663: every known feed, its latest answer and its staleness |
| `hooks.json` | chain 4663: per-pool caps, poke floors and hook constants |
| `panel.json` | written by `model.py`: the assembled hourly event panel |
| `gaps.json` | written by `gaps.py`: the per-asset gap distribution |

Yahoo bars are not committed, matching the convention in `fees/` for `y_*_1h.json`.
