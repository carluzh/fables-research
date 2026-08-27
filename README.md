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
