# fables-research

Measurement scripts, pulled data and adjudication records behind Fables' fee decisions. Scratch
work lives here so the product repos stay clean and both sides of a fee discussion can rerun any
number.

## fees/

- `FEE-AND-APR-REVIEW.md`, `FEE_BENCHMARKING_REPORT.md`, `FEE-POSITION.md`: the two analyses and the
  position after two blind adjudication rounds.
- `adjudication/`: round 1 and round 2 syntheses, the rebuttal between them, and the raw judge
  verdicts as JSON.
- `scripts/`: `allvar.py` (per-tier fair-value variance from 730 days of 1h bars, ES future filling
  the dark hours), `allvar_gc.py` (same, GC future for GLD), `be2.py` / `be3.py` (break-even fee per
  tier, f = sigma^2/8 * k * hours * TVL / volume), `kmeas.mjs` + `lib.mjs` (k = 2L sqrt(P) / TVL off
  PoolManager Swap events), `ur_now.mjs` (UniversalRouter share of swaps per pool), `now.ts` (gateway
  snapshot of every pool and rival; run with vite-node from fables-ui).
- `data/`: the outputs those scripts wrote on 26 to 28 Aug 2026. `tiervar_all.json` is ES-filled,
  `tiervar_all_gc.json` is the GLD correction. `ur_now.json` dollar figures are only valid for ETH and
  SPY until the decimals fix lands (USDG is token0 on NVDA, GLD and META).

Yahoo bar files (`y_*_1h.json`) are not committed; `allvar.py` expects them beside it.

## fees/deviation/

`DEVIATION-FEE.md`: the proposal that every RWA pool prices its distance from its reference market,
not just the time of day, worked through the GLD/USDG dislocation of 28 to 30 Aug 2026 (the pool ran
to +381% above fair while gold moved 0.13%, and earned $1,437 on $4.8M of volume because the closed
tier prices 300 pips). Holds the schedule, the argument for every parameter, the per-asset gap
measurements that set the trigger bands, and a rollout order for the other six pools.

`scripts/` re-derives every number: four fetchers (Uniswap gateway, Binance PAXG and XAUT, Yahoo
bars), six independent on-chain probes, and `model.py`, whose output is labelled by the section of the
document it backs. `data/` is what those fetchers wrote on 2026-08-30, committed because the gateway
rolls its history. See `fees/deviation/README.md`.
