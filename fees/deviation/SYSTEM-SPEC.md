# The deviation fee: system specification

What gets built, on which pools, with which numbers, and what is not available to us.

`DEVIATION-FEE.md` is the economic argument and the GLD evidence. This file is the build decision.
Read that one for *why*; read this one for *what*.

Status: **specified, not built.** Fees in pips: 100 pips = 1 bps = 0.01%, 1,000,000 pips = 100%.

> **Revision 2026-08-30.** An earlier draft of this file claimed asymmetric fees were unavailable on
> every pool. That was wrong: it was written against the `audit/cofounder-fixes` branch, which
> predates `9b17b18` on main. **GLD and META carry the deployed asymmetric pipeline.** Section 5 is
> rewritten. The keeper section is also rewritten: it is now read from the running service rather
> than inferred from its on-chain output.

---

## 1. What is decided

| | |
|---|---|
| **Mechanism** | a deviation term poked on top of the existing session ladder, via `pokeFee` |
| **Reference** | Binance, 24/7. Tokenised equities for the equity pools, PAXG for gold, ETHUSDT for ETH |
| **Keeper** | the live ETH/USDG keeper's engine with the signal swapped. Source read, section 3 |
| **Asymmetric fees** | **available on GLD, META and SPY/GLD.** Not on SPY, NVDA, TSLA, AAPL, NVDA/SPY, ETH. Section 5 |
| **Protocol fee to treasury** | **UNKNOWN, blocked on Yanis.** Section 6 |
| **Pilot** | GLD/USDG, parameters locked in section 7.1 |
| **Close-anchor trigger** | a second, distinct trigger. Specified and **deferred**. Section 10 |

---

## 2. The mechanism

```
d          = | P_pool / P_reference - 1 |
base(t)    = the pool's existing session floor, unchanged
kick, full = per-pool, from the reference census (section 7.3)
cap        = the pool's maxFee

ramp(d) = base(t)                                            if d <= kick
        = base(t) + (cap - base(t)) * (d-kick)/(full-kick)   if kick < d < full
        = cap                                                if d >= full

outbound leg (the trade that increases |d|):  fee = ramp(d)
inbound  leg (the trade that decreases |d|):  fee = base + (ramp(d) - base) * inboundShare
```

On a pool without asymmetry, `inboundShare = 1` and this is one symmetric fee.

Below `kick` the keeper pokes nothing and the pool behaves exactly as it does today.

---

## 3. The keeper

### 3.1 The template, read from the running service

`fables-eth-usdg.service` on VM `lvrfee-engine`, project `fables-fi`, zone `europe-west3-a`.
**Direct SSH times out; use `--tunnel-through-iap`.** Source at `/home/yanis/ETHPair/engine`:
`main.py`, `engine.py` (745 lines), `volatility.py`, `depeg.py`, `config.py`.

The real rule, from `engine.py:FeeComputer` and `config.py:FeeParams`:

```python
fee_bps     = C * sigma_annual**2            # C = 40.0, sigma as a FRACTION
fee_onchain = round(fee_bps * 100)
fee         = clamp(fee_onchain, min_fee, max_fee)
```

| parameter | value | meaning |
|---|---|---|
| `C` | 40.0 | |
| `ewma_alpha` | 0.06 | EWMA on 1-minute candle closes, annualised by 525,600 |
| `min_fee` | 450 | = the on-chain `flatPips`. The keeper never pokes below the flat |
| `max_fee` | 3000 | = the on-chain cap. **MUST equal it or `pokeFee` reverts `FeeAboveCap`** |
| `push_delta_immediate` | 500 | a 5 bps change pushes at once |
| `push_delta_heartbeat` | 100 | a 1 bp change pushes on the heartbeat |
| `heartbeat_s` | 900 | 15 min |
| `ttl_s` | 7200 | 2h poke lifetime |
| `ttl_renew_s` | 5400 | 90 min forced renewal, so an elevated fee never lapses mid-vol |
| `poke_gate` | 500 | below 5 bps desired, rest at the flat: **zero pokes, zero gas** |
| `depeg_threshold` | 0.005 | USDG off peg by 0.5% pins the fee to the cap |
| `depeg_poll_s` | 60 | |

The push decision is event-driven, not a fixed cadence. The ~9.5 minute average interval visible in
`../data/lvr7d_new.json` is emergent, not configured.

`volatility.py` itself is **not** used by the pilot (section 3.2), but two of its ideas transfer to
the deviation signal and are worth borrowing rather than rediscovering: the **only-ever-raise rule**,
where an intra-interval reading is combined as `max(current, preview)` so a mid-interval surcharge can
lift the fee but never cut it; and its **gap handling**, which scales across a 2 to 60 minute hole in
the feed and refuses anything longer rather than pretending the stale value is current.

`depeg.py` is already a deviation monitor and is the pattern to follow: median of Kraken USDG/USD and
OKX USDG/USDT, pins the fee to cap while off peg, holds last state when every source is down, and
`active()` returns False on stale data so the core fee logic never depends on the monitor succeeding.

`engine.py` also carries an RPC fallback (`_switch_rpc`), Telegram alerting, a fee webhook, analytics
and state persistence to `engine_state_eth_usdg.json`. Reuse all of it.

### 3.2 What is copied from the ETH keeper, and what is not

The ETH keeper has exactly one job: `fee = C * sigma^2`, a volatility term. **The deviation keeper
carries no volatility term at all.** Decided 2026-08-30.

The reason is that an RWA pool already prices session volatility, statically, in its calendar. Each
tier of the signed ladder was derived from `sigma_T^2 / 8 * k * TVL / volume_T` in the break-even
work, so a live vol term on top would charge twice for the same risk. ETH needs one because
`FablesRamp` has no calendar: a flat 450 pips is its entire autonomous fee, so its keeper's vol term
IS its dynamic pricing. `FablesRWA` already has the equivalent built in.

So what gets copied from the ETH service is the **engine**, not the signal: the push policy, the poke
lifecycle, the RPC fallback, the guard pattern in `depeg.py`, the state persistence and the
`--dry-run` mode. `volatility.py` is not used by the pilot.

**The gap this leaves, stated so it is a choice and not an oversight.** A sharp move in gold *inside*
a session, which does not dislocate the pool because the pool tracks it correctly, is priced only by
the calendar tier and not by anything live. The hook already has machinery for exactly that, the
`spikeMult` / `closedSpike` / `descentWindow` bells, and GLD has them switched off: the signed ladder
gave GLD `spikeMult = 0` and "no equity bells". If that case ever needs pricing, the fix is a
`setPoolConfig` on the hook with no keeper involvement, and it needs spike parameters for gold that
the fee work explicitly declined to derive. Out of scope for the pilot.

### 3.3 The loop

```
on each reference tick:
  P_ref   <- reference price, Binance websocket, per section 4
  P_pool  <- sqrtPriceX96 from PoolManager.extsload, converted per pool orientation
  d       <- | P_pool / (P_ref * basis) - 1 |
  desired <- ramp(d) per side
  if guards fail:                 hold, do not poke, alert   (section 4.3)
  apply the SAME push policy as the ETH keeper: immediate on push_delta_immediate,
    heartbeat on push_delta_heartbeat, forced renewal at ttl_renew_s, and a poke_gate
    below which the pool rests at its session floor with no live poke at all
```

Keep `poke_gate`. On a deviation keeper it maps to `d <= kick`: below the kicker there should be no
live poke and no gas.

### 3.4 Reading the pool price

The input the backtest does not exercise and the one most likely to be got wrong.

```
slot         = keccak256(abi.encode(poolId, uint256(6)))   // pools mapping in PoolManager
sqrtPriceX96 = extsload(slot) & (2^160 - 1)
sp           = sqrtPriceX96 / 2^96

USDG is token1 (SPY, ETH):              price = sp^2 * 10^(dec0 - dec1)
USDG is token0 (GLD, NVDA, META, AAPL): price = 10^(dec1 - dec0) / sp^2
```

The orientation is per pool and is not guessable. **This exact bug already cost this team a round of
the fee debate** (`ur_now.mjs`, open item 2 in `FEE-POSITION.md`) and it bit the author of this spec.
Build a table, assert each pool's computed price against its reference at startup, and refuse to run
a pool that is more than 5% off at boot. `PoolManager` is `0x8366a39CC670B4001A1121B8F6A443A643e40951`.

### 3.5 Poke policy

| | |
|---|---|
| TTL while `d <= kick` | 7200s, and no poke at all below the gate |
| TTL while `d > kick` | 43200s (12h) |
| forced renewal | `ttl_renew_s`, always well under the live TTL |
| hook maximum | 259200s (72h) |
| lower bound enforced on chain | `max(pokeFloor, base_d * (1 - MAX_POKE_DISCOUNT_BPS))`, measured on the **premium-free** curve |
| upper bound | the pool's `maxFee` |

The TTL asymmetry is the point: short in calm so a keeper failure lapses back within two hours, long
once triggered so a keeper failure mid-event does not hand the fee back to the closed floor, which is
the failure that cost GLD its book.

### 3.6 Failure modes

| failure | behaviour |
|---|---|
| reference unreachable | hold the last poke and renew it at TTL, alert. Never lapse to the floor while the last known `d` was above `kick` |
| two references disagree past the guard | hold, alert |
| RPC unreachable | `_switch_rpc` to the fallback, then hold and retry. The live poke keeps the fee up on its own |
| pool price reads absurd at boot | refuse to start that pool, alert |
| keeper dies | fee lapses at TTL. Correct in calm; mid-event it is a 12h window in which someone must notice |
| `pokeFee` reverts | log the reason. `FeeAboveCap`, `FeeBelowFloor`, `InvalidTtl` are config errors, not transient |

### 3.7 Prerequisite nobody has checked

`pokeFee` is `restricted` through the AccessManager at `0xa362d98b33a7bb5b5e2180a05f995a70fb404f30`.
**Whether the ops key holds the poking role on each pool hook is unverified**, and `FeePoked` has
never fired on GLD. Note that the role scripts bind `pokeFee` under **both** its ABIs, so a hook
carrying the 4-arg selector needs the 4-arg binding. Confirm before build, per pool.

---

## 4. The reference

### 4.1 Coverage

Binance carries every asset we need, trading 24/7 including the full weekend. Measured over 30 days
by `scripts/reference-census.mjs`:

| asset | symbol | Sat hours | Sat volume | basis | basis err p99 |
|---|---|---|---|---|---|
| SPY | SPYBUSDT | 120 | 12,022 | 0.999418 | 0.27% |
| QQQ | QQQBUSDT | 120 | 17,383 | 0.999663 | 0.48% |
| AMZN | AMZNBUSDT | 120 | 754 | 0.999024 | 0.84% |
| AAPL | AAPLBUSDT | 120 | 7,907 | 0.999390 | 0.91% |
| NFLX | NFLXBUSDT | 96 | 3,117 | 0.999297 | 0.96% |
| GOOGL | GOOGLBUSDT | 120 | 4,110 | 0.999326 | 1.02% |
| GLD | PAXGUSDT | 120 | 4,991 | 0.091804 | 1.04% |
| NVDA | NVDABUSDT | 120 | 12,644 | 0.999330 | 1.11% |
| TSLA | TSLABUSDT | 120 | 8,137 | 0.999382 | 1.16% |
| META | METABUSDT | 120 | 521 | 0.999027 | 1.19% |
| MSFT | MSFTBUSDT | 120 | 1,132 | 0.999425 | 1.19% |
| COIN | COINBUSDT | 120 | 5,743 | 0.998985 | 2.05% |
| MSTR | MSTRBUSDT | 120 | 57,761 | 0.999272 | 2.80% |
| ETH | ETHUSDT | 120 | 802,645 | 1.0 | n/a |

Every equity is **1 token = 1 share**: no conversion, no interpretation. Gold is the one exception
and was accepted deliberately: PAXG is an *ounce*, converted to an ETF *share* by a fitted basis,
because chain 4663 carries no gold oracle and Binance lists no GLD token. `XAUTUSDT` is the
disagreement guard, currently 0.138% from PAXG.

**The reference is not blind while the cash market is shut.** Regressing each cash gap on the
reference's move measured at 04:00 ET, hours before the open (`scripts/gap-information.mjs`), every
slope is near 1 with t-stats of 3.8 to 10.9: SPY 0.998, NVDA 0.895, AAPL 1.212, TSLA 1.730,
META 1.106, QQQ 1.094, GLD/PAXG 1.139. The R-squared is only 0.28 to 0.43, but that says the gap has
not finished forming at 04:00, which is equally true of fair value: it is not an error in the
reference. Slope is the accuracy test and it passes.

### 4.2 Maintaining the basis

```
basis = median( asset_price / reference_price ) over a rolling 30 days,
        recut daily, on hours where BOTH legs are live
```

Recomputing GLD against a rolling median rather than a fixed one moved its p99 error from 1.32% to
1.31%, which is the check that the basis is stable rather than trending.

### 4.3 Guards

| guard | rule | on breach |
|---|---|---|
| staleness | reference print older than 15 min | hold, alert |
| disagreement | primary and secondary reference more than 1% apart | hold, alert |
| thin reference | Saturday volume under 2,000 shares | needs a second reference before that pool goes live |
| basis drift | today's basis more than 3% from the 30-day median | hold, alert, do not recut |

META (521 Saturday shares), MSFT (1,132) and AMZN (754) fail the thin test on volume. Section 4.4
measures the thing that actually matters, which is book depth, and clears them.

### 4.4 Can the reference be pushed, and is there a second one

Volume is not the test. A venue can turn over plenty on a thin book. `scripts/reference-depth.mjs`
walks the live order book and prices the attack directly: what it costs to move each reference, set
against what it costs to move our own pool the same distance.

| reference | cost to move it 2% | cost to move OUR pool 2% | ratio |
|---|---|---|---|
| PAXG (GLD) | $3,010,420 | $1,682 | **1,790x harder** |
| XAUT (GLD guard) | $2,232,193 | | |
| METAB | $200,734 | $8,687 | **23x harder** |
| SPYB | $313,666 | $619,754 | **0.5x: inverted** |
| NVDAB | $285,340 | | |
| AAPLB | $186,356 | | |
| TSLAB | $208,455 | | |
| ETHUSDT | $11,160,048 | | |

Every equity reference costs $186k to $479k to move 2%, and gold costs millions. Against our pools
that is a comfortable margin everywhere **except SPY**, where our own pool is currently the harder
target. That is not a property of the reference: it is the anomalous $61.98M of virtual depth SPY
picked up in the last week, the same anomaly that flipped it LVR-negative (section 9). At its 27 Aug
depth of $10.67M, moving our pool 2% cost $107k and the reference was 3x harder, which is the normal
ordering. Treat the inversion as a symptom to watch rather than a designed-in weakness.

**The second source exists**, which section 4.3's disagreement guard assumed without anyone checking.
OKX lists all twelve equities with an `X` prefix (`XSPY-USDT`, `XNVDA-USDT` and so on), priced within
0.005% to 0.122% of Binance, so it is unambiguously the same underlying. Bybit lists seven with an
`X` suffix, missing SPY, QQQ, MSFT, MSTR and NFLX. Kraken and Gate list none.

| | primary | secondary (guard) |
|---|---|---|
| equities | Binance, 2% push costs $186k to $479k | OKX, $12k to $126k |
| gold | Binance PAXG | Binance XAUT, and OKX and Kraken both carry PAXG |

Binance is primary because its book is three to five times deeper. OKX is the guard, not a fallback
to trade off: it is thin enough ($12k moves NFLX 2%) that acting on it alone would be worse than
holding. `scripts/reference-second-source.mjs` re-runs the comparison.

**The risk this does not solve.** Every equity reference is a tokenised-equity product, and that whole
product category is a regulatory posture rather than a market. A venue can withdraw it, and my
recollection is that Binance has discontinued such a product before, though I have not verified that
here and it should be checked rather than taken from me. Two venues protect against one venue's
decision; they do not protect against a sector-wide withdrawal, which would remove every equity
reference at once and leave those pools with no live anchor.

**What happens if it goes.** The keeper holds its last poke and renews it, per section 3.6, so nothing
lapses to the closed floor. The pools then have to fall back to the anchored mode described in
`DEVIATION-FEE.md` section 5.3, using the on-chain Robinhood feed's last print with the much wider
per-asset bands in section 6.1 of that document, which is why that section is kept rather than
deleted. Gold would have no anchor at all, since chain 4663 carries no gold feed.

---

## 5. Asymmetric fees: available on three pools

**Which pools have it.** Probed directly against deployed runtime bytecode
(`scripts/probe-asymmetry.mjs`):

| pool | two-sided `pokeFee` | `setPoolAsymmetry` / `poolAsymmetry` / `autonomousFee` | verdict |
|---|---|---|---|
| **GLD/USDG** | yes | yes | **asymmetric** |
| **META/USDG** | yes | yes | **asymmetric** |
| **SPY/GLD** | yes | yes | **asymmetric** |
| SPY/USDG | no, legacy 3-arg | no | symmetric only |
| NVDA/USDG | no | no | symmetric only |
| TSLA/USDG | no | no | symmetric only |
| AAPL/USDG | no | no | symmetric only |
| NVDA/SPY | no | no | symmetric only |
| ETH/USDG | no | no | symmetric only |

GLD, META and SPY/GLD are the wave-3 deploys (#29), which shipped after the asymmetric-fee commit
(#28). Everything else is phase-1 or wave-2 and predates it. Hook code is immutable and the PoolKey
binds the hook address, so **the symmetric pools can never gain it without a new pool.** That is the
fallback, and it is not a bad one: on the GLD replay, symmetric earns more than asymmetric
($50,551 against $41,085) and makes a round trip cost 3.00% rather than 2.10%.

Both GLD and META currently read `premiumPips = 0`, the symmetric default, which is why a naive
`currentFee` comparison in both directions cannot tell an asymmetric hook from a symmetric one. Do
not use that test; probe the selectors.

**Two ways to express asymmetry, and only one is right for this keeper.**

`setPoolAsymmetry(key, premiumPips, premiumZeroForOne)` sets a *standing* directional premium through
the delayed admin path. That is wrong here: which direction is "outbound" flips depending on whether
the pool is rich or cheap against the reference, so it cannot be a static config.

`pokeFee(poolId, fee0For1, fee1For0, ttl)` on the hot key is the right tool. Mechanics that matter:

- A side of `0` is a **sentinel** meaning "no override this direction", which keeps charging the
  autonomous fee including any standing premium. At least one side must be non-zero.
- **Each call restates the whole two-sided poke.** To change one side, restate the other in the same
  call or it reverts to autonomous.
- Set-time bounds are per side: `pokeFloor <= side <= cap`.
- Resolution-time floor is `max(pokeFloor, base_d * (1 - MAX_POKE_DISCOUNT_BPS))` measured on the
  **premium-free** curve.
- `autonomousFee(poolId, zeroForOne)` is the keeper's composition input and is **pre-poke and
  pre-cap**. `currentFee` cannot serve that role, because during a live poke it returns the poked
  clamped fee and the keeper could not recover its own baseline.
- Because `autonomousFee` is pre-cap, **the keeper must clamp each composed side to
  `min(side, maxFee)` before poking.** `pokeFee` rejects an over-cap side atomically, dropping the
  other side's update with it.
- Event is `FeePoked(poolId, fee0For1, fee1For0, expiry)`.

---

## 6. Protocol fee to treasury: UNKNOWN, blocked

**This section is deliberately unresolved. Do not treat the analysis below as the answer.**

What is established:

- v4's protocol fee is directional by design: `ProtocolFeeLibrary` packs a separate 12-bit fee for
  `zeroForOne` and `oneForZero`, each capped at `MAX_PROTOCOL_FEE = 1000` pips (0.1%), taken from the
  input before the LP fee.
- On the chain 4663 PoolManager, `protocolFeeController()` is `0x6d0009504d129cf5002dba61d9ae8575aa79314c`,
  a 4,544-byte contract exposing `setProtocolFee`, `collectProtocolFees` and `transferOwnership`, whose
  `owner()` is `0x2bad8182c09f50c8318d769245bea52c32be46cd`, a bare EOA that also owns the PoolManager.
- That address appears nowhere in the Fables contracts, and `grep` finds no `protocolFee` anywhere in
  `origin/main` outside `lib/`.
- **Every Fables pool's protocol fee is currently 0 in both directions**, read from `PoolManager`
  slot0 on 2026-08-30 (packed uint24: low 12 bits `zeroForOne`, high 12 `oneForZero`):

  | pool | protocolFee 0->1 | protocolFee 1->0 |
  |---|---|---|
  | GLD, SPY, NVDA, META, TSLA, AAPL, NVDA/SPY, SPY/GLD, ETH | 0 | 0 |

  So unlike asymmetry, this is **not** pool-dependent today: no pool has one set, and the ability to
  set one is a property of the controller rather than of the hook, so it would apply uniformly across
  all nine the moment the controller question is answered.

That reads as "not ours", but **Carl states this is wrong and that the answer is in
`github.com/yanisepfl/fables`.** It has not been found. Rather than guess a second time, this is an
open question with a named owner.

> **ACTION FOR THE REVIEWER.** If you know how Fables sets or overrides the protocol fee on chain
> 4663, write it here. If you do not, **ask Yanis directly** and record the answer:
> 1. Can Fables set a v4 protocol fee on its own pools, and through which address or role?
> 2. Is `0x2bad8182…46cd` ours, Robinhood's, or a shared deployer key?
> 3. Is there a Fables-side protocol fee or treasury cut on the swap path that this spec has missed?
> 4. If it is settable, is it per direction, and does it compose with the two-sided poke?
>
> Until answered, the keeper ships with **no treasury cut on the swap path**.

**The fallback that needs no answer:** `FablesLedger.claimFeeBps`, max 2,000 (20%), routed to
`FablesTreasurySplitter`. It skims a share of fees *collected*, and fees scale with the premium, so
the treasury take scales with the premium by construction. At 10% it would have taken $4,108 from the
GLD event against $688 on what actually happened. It is global across pools, not directional, and
changes go through the AccessManager delay: a standing setting, not an event lever.

---

## 7. Parameters

### 7.1 GLD/USDG: LOCKED

| parameter | value | basis |
|---|---|---|
| reference | `PAXGUSDT`, guard against `XAUTUSDT` at 1% | only gold reference that exists |
| basis | **0.091804**, rolling 30-day median, recut daily | measured, n=1,394 hours |
| base, market hours | **3,000 pips (0.30%)** | matches the largest GLD incumbent on chain |
| base, out of hours | **1,500 pips (0.15%)** | defensible only because the reference is live |
| kicker | **2.00%** | agreed. The census rule gives 2.25%; worth $653 on the replay and no change to the first-raise hour |
| full | **10.00%** | above the worst weekend gold gap in 730d (7.97%) and the worst basis error (5.49%) |
| cap | **15,000 pips (1.50%)** | the pool's live `maxFee`, no config change needed |
| direction | **asymmetric, inbound share 0.33** | available on this hook. See the note below |
| TTL | 7,200s calm / 43,200s triggered | |
| push policy | the ETH keeper's, unchanged | |

**On the asymmetry, and why the model does not settle it.** An earlier draft reported that symmetric
"measured better" at $50,551 against $41,085 and used that to argue for shipping symmetric first.
That comparison should not be relied on. `scripts/model.py` replays the **actual historical volume
path** and reprices it: volume is exogenous, and the `cpmm` response only adjusts how far a single
arbitrageur walks the pool, which against a 381% mispricing a 1.5% fee barely changes. Charging more
on the inbound hours therefore yields more revenue almost by construction.

Three things the model cannot see, all of which favour asymmetry:

- **Trade diversion.** There is no choice between our pool and a rival anywhere in the model.
- **Residual dislocation as a cost.** A higher repair fee makes the arbitrageur stop earlier, leaving
  the pool further from fair, its LPs holding the wrong inventory, and the next trade executing at a
  wrong price. The model scores fee revenue and is blind to all of it.
- **The regime asymmetry is for was never tested.** The replay is one 381% dislocation, where our
  pool is 21% cheaper than the next venue and the repair flow arrives regardless of our fee.
  Competition cannot bind there. It binds at small-to-moderate deviation, where a 1.5% repair fee
  sends corrective flow to a rival and leaves us dislocated while they collect. There is no
  observation of that regime in any of this work.

The round-trip argument, which the earlier draft called model-free and therefore surviving, is
**withdrawn as well, because it was backwards.** A round trip is LP-POSITIVE: on a constant-product
curve reserves are a function of price alone, so an excursion that returns to its origin leaves the
LP with their starting reserves plus every fee collected on both legs, while the round-tripper buys
high, sells lower and pays twice. We should want that flow, not deter it. The only case where it
hurts is a round-tripper who is also the LP, washing for fee-denominated points, and there the fee is
paid to themselves so a higher round-trip cost deters nothing either.

**What hurts LPs is a one-way excursion that does not come back.** That is the GLD case: two days on,
the pool holds 28,869 USDG and 8.289 GLD, worth $41,545 at the on-chain mark and $32,259 at the real
ETF price. The LP sold into a move that has not reverted, and the fee is their only compensation.

Which is the actual argument for asymmetry, and it needs no simulation: **the outbound leg creates
the LP's unwanted position and the inbound leg resolves it.** Charging more for the leg that does the
damage is pricing, not fairness.

`inboundShare` is a keeper variable, so it is a config edit either way. Locked at **0.33**.

Moving the closed tier from its current emergency 6,000 back to 1,500 is a `setPoolConfig` call and
should happen **only once the keeper is live.**

### 7.2 Every other asset with a live reference

From `scripts/reference-census.mjs`, applying the rule in 7.3.

| asset | kicker | full | cap | direction | flags |
|---|---|---|---|---|---|
| SPY | **1.50%** | **4.50%** | 8,000 | symmetric only | kicker widened, see section 9 |
| QQQ | 1.00% | 4.00% | at listing | symmetric only | no pool yet |
| AMZN | 1.75% | 5.25% | at listing | symmetric only | thin reference |
| NFLX | 2.00% | 6.00% | at listing | symmetric only | no pool yet |
| AAPL | 2.00% | 6.00% | 8,000 | symmetric only | |
| NVDA | 2.25% | 6.75% | 8,000 | symmetric only | |
| GLD | 2.00% locked (rule: 2.25%) | 10.00% | 15,000 | **asymmetric** | unit conversion |
| GOOGL | 2.25% | 6.75% | at listing | symmetric only | outlier: max 5.44% vs p99 1.02% |
| META | 2.50% | 7.50% | 8,000 | **asymmetric** | thin reference, outlier max 6.49% |
| TSLA | 2.50% | 7.50% | 10,000 | symmetric only | |
| MSFT | 2.50% | 7.50% | at listing | symmetric only | thin reference |
| COIN | 4.25% | 12.75% | at listing | symmetric only | |
| MSTR | 5.75% | 17.25% | at listing | symmetric only | widest basis of the set |
| ETH | to set | to set | 3,000 | symmetric only | already runs the volatility keeper, last in rollout |

Everything else Robinhood emits on chain 4663 has no continuous reference and therefore no kicker.
**A pool with no live reference does not list.**

### 7.3 How to compute parameters for a new asset

```
1. add [ASSET, BINANCE_SYMBOL, YAHOO_SYMBOL, note] to CANDIDATES in scripts/reference-census.mjs
2. add the Yahoo symbol to scripts/fetch-bars.mjs and run it
3. node scripts/reference-census.mjs
```

which applies:

```
kicker = max( 2 * basisError_p99, 0.50% ), rounded UP to the next 0.25%
full   = max( 3 * kicker, 4% )
cap    = the pool's maxFee, bounded by its hook's ABSOLUTE_MAX_FEE
base   = unchanged from the pool's existing session ladder
```

p99 and not max, because max over 30 days is one bad hour. Assets whose max exceeds 3x their p99 are
flagged for inspection, not silently widened. The 2x multiplier is conservative on a number that is
already conservative, because the measured error compares two venues' hourly *closes* and carries
timing noise the keeper will not see. The right refinement is to log the keeper's own realised basis
error for two weeks and re-cut from that, not a cleverer multiplier.

**Gate on going live:** a reference exists and clears the thin floor; the basis is measured over at
least 30 days; the pool-price orientation is asserted against a known-good mark; the poking role is
confirmed on that pool under the correct `pokeFee` ABI.

---

## 8. Build checklist

1. Confirm the poking role per pool, under the right `pokeFee` ABI. Blocks everything.
2. Resolve section 6 with Yanis.
3. Fork the ETH keeper. Keep `volatility.py` wholesale if a vol term is wanted later; keep
   `depeg.py`'s guard pattern; keep the executor, RPC fallback, alerting and state persistence.
4. Pool-price reader with the orientation table and the startup assertion (3.4).
5. Reference ingest and the rolling basis, with the four guards (4.3).
6. The ramp, with unit tests at every boundary: `d` either side of the kicker, the ramp midpoint,
   past full, cap clamping, the base flipping across a session boundary, and the direction flip when
   the pool is cheap rather than rich.
7. Two-sided poke composition for GLD and META: clamp each side to `min(side, maxFee)`, restate both
   sides every call, and never read `currentFee` as the baseline.
8. **Dry run ALL seven pools from day one** (`--dry-run` already exists and pokes nothing). This
   costs nothing and carries no risk, so there is no reason to observe one pool at a time. Compare
   GLD's output against `scripts/model.py`.
9. Enable live poking progressively: GLD, then SPY, AAPL, NVDA, TSLA, META, and ETH last. Days
   between steps, not weeks, gated on the dry run being clean per pool rather than on a calendar.

### 8.1 Why not GLD only

The exposure is identical on the other pools and they have nothing. As this is written, on a Sunday,
SPY, NVDA, META, TSLA and AAPL are all resting at 250 to 400 pips with no deviation term, which is
the same 0.025% to 0.04% in the same blind window that cost GLD its book. Nothing about GLD made it
uniquely vulnerable; it simply went first.

**Capacity is not a constraint.** Measured on `lvrfee-engine` (e2-medium, 2 vCPU, 3,924 MB):

| | now, one pool | seven pools, extrapolated | headroom |
|---|---|---|---|
| RSS | 79.8 MB | 559 MB | 14% of RAM |
| CPU | 0.4% | 2.8% | load average is currently 0.00 |
| connections | 4 | 28 | |

Binance is not a constraint either. The price feed is a **websocket**, which consumes no REST weight
at all, and the limits are 6,000 request-weight per minute and 300,000 raw requests per five minutes
per IP. The second-source guard is a ticker read, weight 1 to 2. Seven pools use a rounding error of
that budget.

**The blast radius of a keeper bug is bounded and expiring.** A poke resolves inside
`[max(pokeFloor, autonomous/2), cap]` and lapses at its TTL, so the worst a bug can do is overcharge
for up to two hours in calm or twelve once triggered. Our keeper only ever computes `ramp(d) >= base`
and therefore never pokes downward: **assert that and refuse to poke below the session base**, and the
downward half of the range becomes unreachable. Set against the failure it prevents, $4.79M of volume
at three basis points, that is the cheaper risk.

**One thing genuinely argues for doing them together rather than GLD alone.** GLD and META take the
four-argument `pokeFee`; SPY, NVDA, TSLA, AAPL and ETH take the legacy three-argument one. A
GLD-only build implements only the four-argument path and then has to be retrofitted. Building both
from the start is less work, not more.
10. Only after the keeper is live on GLD: `setPoolConfig` to move its closed tier back to 1,500.

---

## 9. The SPY dispute, adjudicated

Two documents disagreed on SPY's base: this one proposed 3,000 pips by analogy from GLD,
`../pools/SPY-USDG.md` measured a revenue peak near 400 to 450 and a two-hop route ceiling at 600.
A reconciler and an independent adversarial verifier were run over both plus the raw data. The
verifier's findings, each reproduced from source:

**The route ceiling is not a ceiling.** In the open session the v4 625 pool takes 41.6% of SPY volume
at 625 pips and the v4 3499 pool takes 24.4% at 3,499. Two thirds of open-session USDG volume goes to
venues priced *above* the alleged 600-pip all-in bound. A bound that two thirds of the market ignores
describes an idealised router, not a constraint. The per-asset ceiling table computed during
reconciliation is also built over the wrong alternative set: it ranks only USDG to WETH to asset and
never checks direct rival pools in the same pair, which are cheaper everywhere. On that corrected
test **this document's 3,000-pip GLD base is 6x GLD's cheapest funded direct alternative**, a v3
500-pip pool doing $5.7M over 7 days, rather than comfortably under a loose ceiling.

**The measured SPY elasticity does not survive either.** The reconciler's difference-in-differences
put share at 21% of counterfactual when the open tier went to 800 pips. But Friday's session at 800
produced **the week's highest session fee take in dollars** ($57.89 against $17.67, $39.58, $30.76
and $56.24), our absolute session volume of $72,368 sat at the week's median of $70,346, and the raw
treated-day z is -1.42, not significant. The DiD draws 44% of its effect from Friday's pre-open share
being the week's highest, which is a property of the control window, not of the treatment.

**What both documents missed, and it is larger than the dispute.** SPY/USDG flipped from LVR-positive
to LVR-negative **with no fee change at all**, purely because its working depth went from $10.67M to
$61.98M of virtual: weekly cover 1.21 on 27 Aug against 0.84 on 30 Aug, LVR $1,906/wk against
$1,596/wk of fees. The base-fee argument concerns the open tier, which produced $266.71 of that
week's $1,596.22. Depth is the binding lever on this pool and neither fee ladder touches it.

**Resolution.** SPY's base stays **800 / 400 / 400** pending its own dated test window: the open tier
is not reverted, because the 800 hours produced the week's highest fee take and the signed revert
trigger (UniversalRouter dollar share against a 27.5% baseline) has not been computed. The out-of-
hours raise from 350/250 to 400/400 is where the evidence is: out of hours is 83.3% of the pool's fees
(open $266.71, overnight $495.25, closed $834.25), and in closed hours the v4 625 pool holds 9% more
TVL than us and takes 18.6% share at 625 pips against our 10.3% at 250. A rival at comparable depth
takes nearly double our share at 2.5x our price.

**SPY's kicker is widened from 0.75% to 1.50%, and full from 4.00% to 4.50%.** The census rule set
0.75% from basis noise alone, but the pool's own measured deviation over an entirely normal weekend
reached 0.74%, so 0.75% would have fired at the margin on nothing at all. Full follows this document's
own rule, `max(3 x kicker, 4%)` = 4.5%, which still clears SPY's worst weekend gap in 730 days
(3.37%). The cap stays 8,000 and on SPY should essentially never bind.

## 10. Deferred: the close-anchor trigger

**A second, distinct trigger. Specified here, not built.**

Section 2's trigger asks *is the pool wrong against the world*. This one asks a different question:
*is the closed-hours discount still justified?*

The closed tier is cheap on the assumption that nothing moves while the cash market is shut. That
assumption is usually right and occasionally very wrong, and when it is wrong the discount is a gift
to whoever is repricing. Because the Binance reference **is** informative out of hours (section 4.1),
we can tell the two cases apart live.

```
while the cash market is closed:
    m = | P_reference / P_cash_close - 1 |            the move since the last cash close
    if m > closeAnchorThreshold:  withdraw the closed-tier discount,
                                  charge the in-hours base or higher
```

Note this is measured on the **reference against the cash close**, not on the pool. A pool tracking a
genuinely repriced world is not mispriced, so section 2's trigger will not fire, yet its LPs are
being handed a discount priced for a world that no longer exists.

**How often the discount is justified** (`scripts/closed-window-moves.mjs`, 730d, close to next open):

| asset | window | n | median | <1% | <2% | p99 | max |
|---|---|---|---|---|---|---|---|
| SPY | overnight | 566 | 0.37% | 88% | 99% | 2.13% | 4.06% |
| SPY | weekend | 162 | 0.37% | 85% | 98% | 2.52% | 2.58% |
| QQQ | overnight | 567 | 0.56% | 70% | 95% | 2.91% | 4.66% |
| GLD | overnight | 566 | 0.60% | 70% | 93% | 4.12% | 6.91% |
| AAPL | overnight | 567 | 0.61% | 69% | 90% | 5.33% | 9.62% |
| META | overnight | 567 | 0.97% | 51% | 79% | 9.47% | 20.82% |
| NVDA | overnight | 567 | 1.57% | 36% | 64% | 6.71% | 15.04% |
| TSLA | overnight | 567 | 1.78% | 32% | 54% | 10.30% | 18.99% |

**The claim that nothing usually happens is TRUE, and strongly asset-dependent.** On SPY, 88% of
overnight windows move under 1% and the discount is right almost always: a trigger is the correct
shape, because pricing the tail into every window would tax 88% of them for the sake of 1%.

On NVDA and TSLA it is not true at all. Their **median** overnight move is 1.57% and 1.78%, and only
32 to 36% of windows stay under 1%. A closed-tier discount on those names is not occasionally
mispriced, it is systematically mispriced, and the right answer there may be **no discount at all**
rather than a discount with a trigger.

Proposed threshold, when this is built: `closeAnchorThreshold = the asset's overnight p90`, which
fires on roughly one window in ten. That is 1.08% for SPY, 3.74% for NVDA, 4.36% for TSLA. Size it
against realised markouts once those exist, since this trigger's value is exactly the adverse
selection it avoids and that has never been measured on this chain.

**Why deferred:** it needs a cash-close anchor per asset (a market-calendar dependency the deviation
keeper does not otherwise have), it interacts with the session ladder rather than sitting on top of
it, and the pilot should prove the simpler trigger first.

---

## 11. What is still open

- **The protocol fee**, section 6, blocked on Yanis.
- **SPY's base**, section 9, blocked on the reconciliation.
- **The poking role** on every pool.
- **One event.** Every revenue figure replays a single weekend on a single pool, bracketed by two
  volume models that disagree by 2.7x.
- **The direction probe** has been run on a Sunday closed session and on ETH with a live poke. Re-run
  it in an open session.
- **Why chain 4663's GLD is dislocated at all**, which is upstream of this document and matters more
  than the fee.
