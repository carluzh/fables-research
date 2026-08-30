# The deviation fee: system specification

What gets built, on which pools, with which numbers, and what is not available to us.

`DEVIATION-FEE.md` is the economic argument and the GLD evidence. This file is the build decision.
Read that one for *why*; read this one for *what*.

Status: **specified, not built.** Every number here is measured, every availability question is
answered against the live chain, and nothing is left to interpretation. Two capabilities we wanted
turn out not to exist, and both have a fallback that is already decided below.

Fees in pips: 100 pips = 1 bps = 0.01%, 1,000,000 pips = 100%.

---

## 1. What is decided

| | |
|---|---|
| **Mechanism** | a deviation term poked on top of the existing session ladder, via `FablesBaseHook.pokeFee` |
| **Reference** | Binance, 24/7. Tokenised equities for the five equity pools, PAXG for gold, ETHUSDT for ETH |
| **Keeper** | modelled on the live ETH/USDG LVR keeper: same loop, same cadence, same TTL, different signal |
| **Asymmetric fees** | **not available on any existing pool, ever.** Fallback: one symmetric fee. Section 5 |
| **Protocol fee to treasury** | **not settable by us.** Fallback: `claimFeeBps`. Section 6 |
| **Pilot** | GLD/USDG, parameters locked in section 7.1 |
| **Scope of locked parameters** | every asset with a live reference. Section 7.2 |

---

## 2. The mechanism

```
d          = | P_pool / P_reference - 1 |
base(t)    = the pool's existing session floor, unchanged
kick, full = per-pool, from the reference census (section 7.3)
cap        = the pool's maxFee

fee(d) = base(t)                                            if d <= kick
       = base(t) + (cap - base(t)) * (d-kick)/(full-kick)   if kick < d < full
       = cap                                                if d >= full
```

One fee, both directions (see section 5). The keeper computes `fee(d)` and pokes it; the hook clamps
it to `[max(pokeFloor, autonomous/2), cap]` and expires it on its own.

Below `kick` the keeper pokes nothing and the pool behaves exactly as it does today. This is
additive: no existing behaviour changes until a pool is measurably off its reference.

---

## 3. The keeper

### 3.1 The template

The ETH/USDG pool already runs an LVR keeper in production. **Its source lives on the Google VM under
the Fables projects and was not read for this spec**, so what follows is its observed behaviour,
recovered from its own on-chain output. Anything marked *observed* is measured; anything marked
*to confirm* must be checked against the real service before build.

| property | value | how established |
|---|---|---|
| fee rule | `f = round(0.40 * sigma_annual_pct^2)`, clamped `[450, 3000]` | *observed*: exact on all 119 unclamped pokes in `../data/lvr24h.json` |
| repoke cadence | every ~9.5 minutes | *observed*: 609 pokes over 96.8h in `../data/lvr7d_new.json` |
| poke TTL | **7200s (2 hours)** | *observed live*: ETH `pokeOf` read 2026-08-30 12:30 UTC showed expiry 14:30, 119.8 min out |
| clamp behaviour | 29 cap hits, 111 floor hits in 609 pokes | *observed* |
| signal source | Binance | *stated by Carl* |
| retry, logging, alerting, restart | unknown | *to confirm* |

The deviation keeper should be the same service shape with the signal swapped. That is the point of
copying it: the operational surface is already proven in production.

### 3.2 The loop

```
every TICK (9.5 min, matching the ETH keeper):
  for each enabled pool:
    P_ref   <- reference price      (section 4)
    P_pool  <- sqrtPriceX96 from PoolManager.extsload, converted per pool orientation
    d       <- | P_pool / (P_ref * basis) - 1 |
    f_new   <- fee(d)                                        (section 2)
    if guards fail:            hold, do not poke, alert       (section 4.3)
    if |f_new - f_live| < EPS: skip                           (idempotency)
    else:                      pokeFee(poolId, f_new, ttl)
```

`f_live` is read from `currentFee(poolId, true)` rather than remembered, so a restart, a manual poke
or a config change is picked up rather than fought.

`EPS` exists so the keeper does not burn gas repoking a fee that has not meaningfully moved. Set it
to 50 pips (0.005%) or 2% of the live fee, whichever is larger.

### 3.3 Reading the pool price

This is the input the backtest does **not** exercise, and the one most likely to be got wrong. The
model in `scripts/model.py` reads pool prices from the Uniswap gateway at hourly granularity, which is
right for a replay and wrong for a keeper. The keeper must read chain state:

```
slot   = keccak256(abi.encode(poolId, uint256(6)))     // pools mapping in PoolManager
word   = PoolManager.extsload(slot)
sqrtPriceX96 = word & (2^160 - 1)
sp     = sqrtPriceX96 / 2^96
```

Then, and this is the part that bites:

```
USDG is token1 (SPY, ETH):    price = sp^2 * 10^(dec0 - dec1)
USDG is token0 (GLD, NVDA,
                META, AAPL):  price = 10^(dec1 - dec0) / sp^2
```

The orientation is per pool and is not guessable. **This exact class of bug has already cost this
team a round of the fee debate**: `ur_now.mjs` divided by `1e6` on every pool while USDG was token0 on
three of them, which is open item 2 in `FEE-POSITION.md`. It also bit the author of this spec while
writing it. Build a table, assert it against a known-good price at startup, and refuse to run a pool
whose computed price is more than 5% from its reference at boot.

`PoolManager` is `0x8366a39CC670B4001A1121B8F6A443A643e40951`. Verified working:
reading SPY this way returns $775.48 against a live mark of $774.

### 3.4 Poke policy

| | |
|---|---|
| TTL while `d <= kick` | 7200s (2h), matching the ETH keeper |
| TTL while `d > kick` | 43200s (12h) |
| max TTL the hook allows | 259200s (72h), `MAX_POKE_TTL` |
| lower bound the hook enforces | `max(pokeFloor, autonomous/2)`, so a poke can never halve the session fee |
| upper bound | the pool's `maxFee` |

The TTL asymmetry is the important part. A short TTL in calm means a keeper failure lapses back to
the calendar fee within two hours, which is the safe direction. A long TTL once triggered means a
keeper failure **mid-event** does not hand the fee back down to the closed floor, which is the
failure that cost GLD its book in the first place.

### 3.5 Failure modes

| failure | behaviour |
|---|---|
| reference unreachable | hold the last poke, re-poke it at its TTL to keep it alive, alert. Never fall back to the session floor while the last known `d` was above `kick` |
| two references disagree by more than the guard | hold, alert. Do not act on a number that cannot be corroborated |
| RPC unreachable | hold, retry with backoff. The live poke keeps the fee up on its own |
| pool price reads absurd (>5% from reference at boot, or a decimals mismatch) | refuse to start that pool, alert |
| keeper dies | fee lapses to the autonomous fee at TTL. In calm that is correct; mid-event it is a 12h window in which someone must notice |
| `pokeFee` reverts | log the revert reason. `FeeAboveCap`, `FeeBelowFloor` and `InvalidTtl` are all config errors, not transient |

### 3.6 Prerequisite nobody has checked

`pokeFee` is `restricted` through the AccessManager at
`0xa362d98b33a7bb5b5e2180a05f995a70fb404f30`. **Whether the ops key actually holds the poking role on
each pool hook has not been verified.** `FeePoked` has never fired on GLD, so that path is unproven on
that pool. Confirm before build, on every pool in the rollout, not just GLD.

---

## 4. The reference

### 4.1 Coverage: Binance carries everything we need

Binance lists tokenised equities that trade **24/7, including the full weekend**. Measured over 30
days (`scripts/reference-census.mjs`):

| asset | Binance symbol | Saturday hours | Saturday volume | basis vs the real share | basis error p99 |
|---|---|---|---|---|---|
| SPY | SPYBUSDT | 120 | 12,022 | 0.999418 | 0.27% |
| NVDA | NVDABUSDT | 120 | 12,644 | 0.999330 | 1.11% |
| META | METABUSDT | 120 | 521 | 0.999027 | 1.19% |
| AAPL | AAPLBUSDT | 120 | 7,907 | 0.999390 | 0.91% |
| TSLA | TSLABUSDT | 120 | 8,137 | 0.999382 | 1.16% |
| QQQ | QQQBUSDT | 120 | 17,383 | 0.999663 | 0.48% |
| MSFT | MSFTBUSDT | 120 | 1,132 | 0.999425 | 1.19% |
| AMZN | AMZNBUSDT | 120 | 754 | 0.999024 | 0.84% |
| GOOGL | GOOGLBUSDT | 120 | 4,110 | 0.999326 | 1.02% |
| COIN | COINBUSDT | 120 | 5,743 | 0.998985 | 2.05% |
| MSTR | MSTRBUSDT | 120 | 57,761 | 0.999272 | 2.80% |
| NFLX | NFLXBUSDT | 96 | 3,117 | 0.999297 | 0.96% |
| GLD | PAXGUSDT | 120 | 4,991 | 0.091804 | 1.04% |
| ETH | ETHUSDT | 120 | 802,645 | 1.0 by construction | n/a |

Every equity is **1 token = 1 share**: the basis is 0.999 to 1.000, so there is no conversion, no
scaling, no interpretation. That is what makes this a system rather than a fix for one pool.

**Gold is the single exception and was accepted deliberately.** There is no GLD token on Binance, so
gold comes in as PAXG, which is one *ounce*, converted to an ETF *share* by a fitted basis of
0.091804. That is a unit conversion the equities do not need, and its error is 1.04% at p99 against
0.27% for SPY. It is accepted because there is no alternative: chain 4663 carries no gold oracle
either, so PAXG with a measured basis is the only gold reference that exists.

`XAUTUSDT` is a second, independent gold market and is used as the disagreement guard, currently
0.138% from PAXG.

### 4.2 Maintaining the basis

The basis is not a constant. GLD's drifts with the ETF's expense ratio, and every equity's drifts
with its token's own premium.

```
basis = median( asset_price / reference_price ) over a 30-day rolling window,
        recut daily, on hours where BOTH legs are live
```

Recomputing GLD against a 30-day rolling median rather than a fixed one changed its p99 error from
1.32% to 1.31%, which is the check that the basis is stable rather than trending.

### 4.3 Guards

| guard | rule | on breach |
|---|---|---|
| staleness | reference print older than 15 min | hold, alert |
| disagreement | two independent references more than 1% apart | hold, alert |
| thin reference | Saturday volume under 2,000 shares | that pool requires a second reference before it goes live at all |
| basis drift | today's basis more than 3% from the 30-day median | hold, alert, do not recut |

The thin-reference guard matters more than it looks. If the reference trades 521 shares on a Saturday
(META) then pushing the *reference* is cheaper than pushing our pool, and an attacker who moves it
makes us raise our own fee on honest flow. Three assets fail this today: META, MSFT and AMZN.

---

## 5. Asymmetric fees: not available, on any existing pool

**Answer: no pool has it, and no existing pool can ever have it.**

Three independent confirmations:

1. **Empirical.** `currentFee(poolId, zeroForOne)` returns the identical value in both directions on
   all seven pools: GLD 6000/6000, SPY 250/250, NVDA 300/300, META 250/250, TSLA 400/400,
   AAPL 300/300, ETH 625/625.
2. **Structural.** `pokeFee` stores a single `uint24`. There is no direction in the poke.
3. **Permanent.** The pool's identity is its `PoolKey`, which includes the hook address. Hook code is
   immutable. So changing the fee logic means a different hook address, which means a **different
   pool** with no liquidity in it. There is no upgrade path for an existing pool.

Hook permission bits are `0x2080` on all nine Fables hooks, which is `BEFORE_INITIALIZE_FLAG`
(1 << 13) plus `BEFORE_SWAP_FLAG` (1 << 7) and nothing else. No delta flags anywhere.

**Fallback, and it is the better trade anyway: one symmetric fee.** From the event replay, symmetric
earns more than asymmetric ($50,551 against $41,085 on the physical volume model) and makes a round
trip cost 3.00% rather than 2.10%, which is the stronger deterrent against the round-tripping that
this event looked like. The thing symmetric gives up is that it also taxes the flow that repairs the
pool. That is a real cost and it is the reason to want asymmetry eventually, but it is not a reason to
delay.

**What it would take.** A new hook version whose `_autonomousFee` reads `params.zeroForOne`, which its
signature already receives and currently ignores, plus per-pool deviation state the keeper writes on
chain. It needs no new permission flag, because the fee override is a return value rather than a
delta. But it needs a new deployment and a new pool, so it is a migration, not an upgrade. Deferred.

**Residual check for the fact-check:** the direction test was run on a Sunday with the closed tier
live. ETH was read **with an active poke** (117 minutes remaining) and still priced both directions
identically, so the poked path is covered. What is not yet covered is an **open session**, so re-run
`scripts/probe-direction.mjs` on a weekday between 09:30 and 16:00 ET before treating "symmetric" as
proven in every state. It is a two-minute check and it prints the market state it was read in.

---

## 6. Protocol fees: not settable by us

**Answer: no, and not because of a multisig. It simply is not ours.**

v4's protocol fee is exactly the tool we wanted: `ProtocolFeeLibrary` packs a separate 12-bit fee for
`zeroForOne` and `oneForZero`, capped at `MAX_PROTOCOL_FEE = 1000` pips (0.1%) each, taken from the
input before the LP fee. Directional out of the box.

On the chain 4663 PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`:

| | |
|---|---|
| `protocolFeeController()` | `0x6d0009504d129cf5002dba61d9ae8575aa79314c`, a **contract**, 4,544 bytes |
| that controller's `owner()` | `0x2bad8182c09f50c8318d769245bea52c32be46cd`, an **EOA with no code** |
| PoolManager `owner()` | the same EOA, `0x2bad8182...46cd` |
| Fables' own AccessManager | `0xa362d98b33a7bb5b5e2180a05f995a70fb404f30`, a different contract entirely |
| GLD pool's protocol fee today | 0 in both directions |

So it is not a multisig, it is a single external key, and it belongs to whoever runs the chain, not to
Fables. `setProtocolFee` reverts for anyone but that controller. Per the standing instruction: **forget
it.**

**Future work, one line:** ask Robinhood to either set a directional protocol fee on Fables pools or
delegate the controller for them. If they ever do, it is 0.1% per direction and it composes with
everything above without touching the hook.

**Fallback, already available:** `FablesLedger.claimFeeBps`, max 2,000 (20%), routed to
`FablesTreasurySplitter`. It skims a share of fees *collected*, and fees now scale with the premium,
so the treasury take scales with the premium by construction. At 10% it would have taken $4,108 from
the GLD event under the modelled schedule against $688 on what actually happened. Its limits: global
across pools rather than per-pool, not directional, and changes go through the AccessManager execution
delay. It is a standing setting, not an event lever.

---

## 7. Parameters

### 7.1 GLD/USDG: LOCKED

The pilot. These numbers do not move without a new measurement.

| parameter | value | basis |
|---|---|---|
| reference | `PAXGUSDT` on Binance | only gold reference that exists, 24/7, 120 Saturday hours |
| second reference | `XAUTUSDT`, guard at 1% | independent, currently 0.138% apart |
| basis | **0.091804**, 30-day rolling median, recut daily | measured, n=1,394 hours |
| base fee, market hours | **3,000 pips (0.30%)** | matches the largest GLD incumbent on chain |
| base fee, out of hours | **1,500 pips (0.15%)** | defensible only because the reference is live |
| kicker | **2.00%** | agreed. The census rule gives 2.25%; see the note below |
| full | **10.00%** | above the worst weekend gold gap in 730 days (7.97%) and the worst basis error (5.49%) |
| cap | **15,000 pips (1.50%)** | the pool's live `maxFee`, no config change needed |
| direction | **symmetric** | asymmetry unavailable, section 5 |
| TTL | 7,200s calm / 43,200s triggered | |
| tick | 9.5 min | matches the ETH keeper |

**On the kicker.** The mechanical rule in 7.3 produces 2.25% for GLD from the 30-day census; we locked
2.00%. The difference is worth $653 on the event replay ($41,085 against $40,432) and does not change
the hour of the first raise. 2.00% stands as the agreed pilot value, and the census rule is what
governs every other asset.

Note the base fees differ from the pool's live config, which the emergency change on 2026-08-29 set to
`3000/3000/6000`. Moving the closed tier from 6,000 back to 1,500 is a `setPoolConfig` call and should
happen **only once the keeper is live**, not before.

### 7.2 Every other asset with a live reference

Produced mechanically by `scripts/reference-census.mjs`. `maxFee` is each pool's live cap where a pool
exists; assets without a Fables pool inherit the cap decision at listing time.

| asset | reference | basis | kicker | full | cap | flags |
|---|---|---|---|---|---|---|
| SPY | SPYBUSDT | 0.999418 | **0.75%** | 4.00% | 8,000 | |
| QQQ | QQQBUSDT | 0.999663 | **1.00%** | 4.00% | listing | no pool yet |
| AMZN | AMZNBUSDT | 0.999024 | **1.75%** | 5.25% | listing | **thin reference** |
| NFLX | NFLXBUSDT | 0.999297 | **2.00%** | 6.00% | listing | no pool yet |
| AAPL | AAPLBUSDT | 0.999390 | **2.00%** | 6.00% | 8,000 | |
| NVDA | NVDABUSDT | 0.999330 | **2.25%** | 6.75% | 8,000 | |
| GLD | PAXGUSDT | 0.091804 | 2.25% rule, **2.00% locked** | 10.00% | 15,000 | unit conversion |
| GOOGL | GOOGLBUSDT | 0.999326 | **2.25%** | 6.75% | listing | **outlier: max 5.44% vs p99 1.02%** |
| META | METABUSDT | 0.999027 | **2.50%** | 7.50% | 8,000 | **thin reference**, **outlier: max 6.49%** |
| TSLA | TSLABUSDT | 0.999382 | **2.50%** | 7.50% | 10,000 | |
| MSFT | MSFTBUSDT | 0.999425 | **2.50%** | 7.50% | listing | **thin reference** |
| COIN | COINBUSDT | 0.998985 | **4.25%** | 12.75% | listing | no pool yet |
| MSTR | MSTRBUSDT | 0.999272 | **5.75%** | 17.25% | listing | widest basis of the set |
| ETH | ETHUSDT | 1.0 | to set | to set | 3,000 | already has the volatility keeper, last in rollout |

Three assets carry a **thin reference** flag (Saturday volume under 2,000 shares) and two carry an
**outlier** flag (a single hour where the basis blew out beyond 3x its own p99). Neither is
disqualifying, but a flagged asset does not go live until a second reference is wired for the thin
ones, or the outlier hour has been inspected for the others.

Everything else Robinhood emits on chain 4663 (roughly 94 oracle feeds and 1,401 stock pools) has
**no continuous reference**, and therefore gets no kicker and no deviation term. The rule is simply:
**a pool with no live reference does not list.**

### 7.3 How to compute parameters for a new asset

The procedure is the script, so there is nothing to interpret.

```
1. add [ASSET, BINANCE_SYMBOL, YAHOO_SYMBOL, note] to CANDIDATES in scripts/reference-census.mjs
2. add the Yahoo symbol to scripts/fetch-bars.mjs and run it
3. node scripts/reference-census.mjs
```

It applies, and prints, this rule:

```
kicker = max( 2 * basisError_p99, 0.50% ), rounded UP to the next 0.25%
full   = max( 3 * kicker, 4% )
cap    = the pool's maxFee, bounded by its hook's ABSOLUTE_MAX_FEE
base   = unchanged from the pool's existing session ladder
```

and refuses to produce a kicker at all where no basis can be measured.

**Why p99 and not max.** Max over a 30-day window is one bad hour, and one bad hour must not set a
parameter. Assets whose max exceeds 3x their p99 are flagged for inspection instead of silently
widened.

**Why 2x.** The measured error is an upper bound on true basis noise, because it compares two venues'
hourly *closes* and so carries timing noise the keeper will not see, reading both sides at the same
instant. 2x p99 is therefore already conservative on a number that is already conservative. The
correct refinement is not a cleverer multiplier: it is to log the keeper's own realised basis error
for two weeks and re-cut from that.

**Gate on going live.** No asset goes live with a kicker until: a reference exists and clears the
thin-reference floor, the basis has been measured over at least 30 days, the pool-price orientation
has been asserted against a known-good mark, and the poking role has been confirmed on that pool.

---

## 8. Build checklist

Ordered. Nothing here is written yet.

1. Confirm the poking role on each pool hook through the AccessManager. Blocks everything.
2. Read the ETH keeper on the Google VM and reconcile section 3.1: the four *to confirm* rows, plus
   its retry, logging and alerting, so this service can be its sibling rather than its cousin.
3. Pool-price reader with the per-pool orientation table and the startup assertion in section 3.3.
4. Reference ingest: Binance klines plus the basis recut, with the four guards in section 4.3.
5. The fee function, with unit tests at the boundaries: `d` just under and just over the kicker, the
   ramp midpoint, `d` past full, cap clamping, the base flipping across a session boundary, and the
   sign flip when the pool is cheap rather than rich.
6. The poke loop with the TTL policy and the idempotency epsilon.
7. Dry-run mode: compute and log what it *would* poke, run it against GLD for a week, compare to the
   replay in `scripts/model.py`.
8. Go live on GLD. Then SPY, which has the tightest basis and the deepest book. Then AAPL, NVDA,
   TSLA, META. ETH last, once the deviation term is shown not to fight the volatility keeper.
9. Only after the keeper is live on GLD: `setPoolConfig` to move its closed tier from 6,000 back to
   1,500.

## 9. What is still open

- **The ETH keeper's internals.** Four rows of section 3.1 are inferred from on-chain output, not
  copied from source. Reconcile before build.
- **The poking role.** Unverified on every pool.
- **One event.** Every revenue figure is a replay of a single weekend on a single pool, bracketed by
  two volume models that disagree by 2.7x.
- **The direction test** was run in one market state. Re-run it in an open session.
- **Why chain 4663's GLD is dislocated at all**, which is upstream of this whole document and matters
  more than the fee. Every venue on the chain prices GLD near $1,520 against a real ETF at $409, and
  it has held for more than two days.
