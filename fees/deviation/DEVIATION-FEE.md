# The deviation fee

A proposal for how every Fables RWA pool prices the gap between itself and its reference market.
Written 2026-08-30, using the GLD/USDG dislocation of 28 to 30 August as the worked example.

> **Corrections, 2026-08-30.** Two claims below are superseded by `SYSTEM-SPEC.md`, which is the
> build decision and wins wherever the two disagree.
> 1. **Asymmetric fees ARE available on GLD, META and SPY/GLD** through the deployed two-sided
>    `pokeFee`. Section 7's closing paragraph originally said they need new bytecode: that was
>    written against a stale branch and is now corrected in place. The claim remains true for SPY,
>    NVDA, TSLA, AAPL, NVDA/SPY and ETH, which carry only the legacy single-sided poke and can never
>    gain asymmetry.
> 2. **The equity base fees proposed in section 10 are an analogy from GLD, not a measurement.**
>    `../pools/SPY-USDG.md` measures SPY's revenue peak near 400 to 450 pips against the 3,000
>    proposed here. The measured number should win; see SYSTEM-SPEC section 9.
>
> A third trigger, deferred, is specified in SYSTEM-SPEC section 10: withdrawing the closed-hours
> discount when the reference has moved away from the cash close.

Fees are in pips throughout: **100 pips = 1 bps = 0.01%**, and 1,000,000 pips = 100%, which is v4's
own unit. So 300 pips is 0.03%, 3,000 is 0.30%, 15,000 is 1.50%.

Every number below is produced by the scripts in `scripts/`. Run `python scripts/model.py` and
`python scripts/gaps.py` and diff the output against this document: each block of output is labelled
with the section it backs. Section 11 gives the fetch order.

---

## 1. What we are proposing

Today a Fables RWA pool prices time. `FablesRWA._autonomousFee` returns `feeFloorAt(config, block.timestamp)`
and nothing else: an open tier, an overnight tier, a closed tier, plus optional bells. It has no idea
what its own price is, and no idea what the asset is worth anywhere else.

We propose it also prices **deviation**: how far the pool's price has walked from the asset's
reference price. Below a threshold the session ladder is unchanged. Above it the fee ramps to a cap.
The leg that pushes the pool further from the reference pays the ramped fee; the leg that brings it
back pays a third of it.

This is not a new mechanism. `FablesBaseHook.pokeFee` already exists, is already how the ETH pool is
priced, and can already move a pool's fee inside `[max(pokeFloor, autonomous/2), cap]` on a hot key
with no execution delay. For GLD, the bounds live on chain today allow everything below without a
single config change.

The rest of this document argues why, and with what numbers.

---

## 2. The problem an RWA pool actually has

A Fables pool holds a tokenised claim on an asset that trades somewhere else. Its price is correct
only because arbitrageurs keep it correct, and they can only do that while three things hold:

1. the reference market is open, so a fair price exists,
2. someone is watching, and
3. the mint and redeem path works, so the arbitrage can actually be closed.

All three fail at once every Friday afternoon. The equity market shuts, the on-chain oracle stops
publishing, and creation and redemption stop. What is left is a pool quoting a price that nobody is
obliged to keep honest, with a fee schedule that, on the calendar model, charges its **cheapest** rate
in exactly that window because the closed tier was priced off realised volatility, and realised
volatility is near zero when the underlying is not trading.

That reasoning is wrong, and this is the correction. Closed-hours variance being low is a statement
about the *asset*. It says nothing about the *pool*, which can be walked anywhere by anyone once the
discipline is gone. The right thing to price in the dark is not volatility. It is distance from the
last honest price.

---

## 3. What we already have

`FablesBaseHook` resolves a fee as: the poked fee while it is fresh, otherwise the autonomous fee,
clamped to the pool's cap. The poke is bounded on both sides, expires on its own, and cannot cut more
than half off the autonomous fee. Read live on 2026-08-30:

| pool | ABSOLUTE_MAX_FEE | MAX_POKE_TTL | MIN_POOL_FEE | MAX_POKE_DISCOUNT_BPS | maxFee | pokeFloor | currentFee |
|---|---|---|---|---|---|---|---|
| GLD | 15,000 | 259,200 (72h) | 100 | 5,000 | **15,000** | 3,000 | 6,000 |
| SPY | 15,000 | 259,200 | 100 | 5,000 | 8,000 | 250 | **250** |
| NVDA | 20,000 | 259,200 | 100 | 5,000 | 8,000 | 300 | **300** |
| META | 15,000 | 259,200 | 100 | 5,000 | 8,000 | 250 | **250** |
| TSLA | 20,000 | 259,200 | 100 | 5,000 | 10,000 | 400 | **400** |
| AAPL | 15,000 | 259,200 | 100 | 5,000 | 8,000 | 300 | **300** |
| ETH | 20,000 | 259,200 | 100 | 5,000 | 3,000 | 100 | 450 (a live poke, the keeper is running) |

(`scripts/probe-hooks.mjs`.)

Two things to take from that table. First, GLD can be driven anywhere in [3,000, 15,000] today with
no config change and no deploy. Second, **as this is written, on a Sunday, SPY, NVDA, META, TSLA and
AAPL are all sitting at 250 to 400 pips**, which is 0.025% to 0.04%, in precisely the window that cost
GLD its book. They have not been walked through the hole yet. That is the only difference.

The ETH pool is the precedent for the mechanism. It runs on `FablesRamp`, charges a flat 450 pips
autonomously, and a keeper pokes an LVR-derived fee on top. Recovering that keeper's rule from its own
poke series (`../data/lvr24h.json`, 163 pokes, 119 of them away from the clamps) gives

```
f = round(0.40 * sigma_annual_pct^2),  clamped to [450, 3000]
```

exactly, on every unclamped poke. The "effective C spans 0.17 to 0.68" line in `FEE-POSITION.md` is
that same constant seen through the clamps. What follows is the same architecture with a different
signal: deviation instead of volatility.

---

## 4. The worked example: GLD, 28 to 30 August 2026

### 4.1 What happened

The GLD/USDG pool tracked gold to within half a percent for the whole week, including a genuine
-3.5% gold selloff on Friday afternoon which it followed the whole way down. At 17:00 ET on Friday the
COMEX gold future printed for the last time. Within three hours the pool had left the reference, and
it did not come back.

| | |
|---|---|
| window | Fri 2026-08-28 16:00 ET to Sun 2026-08-30 06:00 ET, 39 hours with volume |
| volume | **$5,697,665** |
| fees earned | **$6,885** (1,208 pips realised) |
| of which, at the 300-pip closed floor | **$4,789,279 of volume earning $1,437** |
| peak deviation from fair | **+381%** |
| churn | **171x** the $33,227 pool, in 39 hours |

The hour-by-hour path, with gold beside it:

| hour (ET) | PAXG $ | implied fair GLD $ | pool $ | deviation | volume $ | fee charged |
|---|---|---|---|---|---|---|
| Fri 16:00 | 4,456.64 | 409.30 | 407.92 | -0.3% | 15,244 | 300 |
| Fri 19:00 | 4,461.92 | 409.78 | 411.19 | +0.3% | 14,324 | 300 |
| Fri 22:00 | 4,459.71 | 409.58 | 420.07 | +2.6% | 226,147 | 300 |
| Sat 01:00 | 4,460.26 | 409.63 | 434.01 | +6.0% | 1,307,915 | 300 |
| Sat 04:00 | 4,458.99 | 409.51 | 447.68 | +9.3% | 128,842 | 300 |
| Sat 07:00 | 4,457.21 | 409.35 | 493.97 | +20.7% | 234,112 | 300 |
| Sat 10:00 | 4,461.69 | 409.76 | 609.12 | +48.7% | 224,712 | 300 |
| Sat 13:00 | 4,462.56 | 409.84 | 670.37 | +63.6% | 114,290 | 300 |
| Sat 16:00 | 4,460.37 | 409.64 | 1,425.41 | +248.0% | 55,353 | 6,000 |
| Sat 19:00 | 4,464.85 | 410.05 | 1,493.96 | +264.3% | 135,568 | 6,000 |
| Sun 01:00 | 4,462.86 | 409.87 | 1,398.60 | +241.2% | 52,314 | 6,000 |
| Sun 04:00 | 4,463.27 | 409.90 | 1,244.19 | +203.5% | 22,562 | 6,000 |

**Gold moved +0.13% across the entire event. The pool moved +262%.**

### 4.2 What it was not

Three explanations were ruled out before designing anything.

**Not a token event.** `GLD.uiMultiplier()` returns exactly `1e18`, i.e. 1.0, identical to SPY's. There
was no split, no rebase, no shares-per-token change (`scripts/probe-token.mjs`). The token is
"SPDR Gold Trust, Robinhood Token", 18 decimals, and one token is one ETF share.

**Not a Fables-only dislocation.** Reading `slot0` directly on the two rival GLD venues put them at
$1,399.70 and $1,397.10 against our $1,323.20 at the same moment (`scripts/probe-rivals.mjs`). Every
GLD venue on the chain moved together. Across the event, `|Fables / rival-3000 - 1|` had a median of
0.22%, a p90 of 1.80% and a max of 5.20%.

That last figure is the single most important design constraint in this document: **a purely on-chain,
cross-venue trigger would never have fired.** Comparing ourselves to the other pools on the chain
detects the case where only we are wrong, which is not the case that happened. An external reference
is not a nice-to-have.

**Not a slow response by accident.** The pool's whole config history is two events
(`scripts/probe-config.mjs`):

- `2026-08-28 04:43 UTC` the signed ladder shipped: `1500/1500/300`, cap 8,000.
- `2026-08-29 19:19 UTC` an emergency change to `3000/3000/6000`, cap 15,000.

`FeePoked` has **never** fired on this pool. Both responses went through `setPoolConfig`, the slow
admin path, and the second one arrived 23 hours after the deviation first crossed 2%. The fast lever
was there the whole time and was not used, because nothing was watching the one number that mattered.

### 4.3 What it cost

Over the 39 hours there were 553 `ModifyLiquidity` events on the pool and net liquidity fell by
1.07e17, roughly 15% of the book (`scripts/probe-lp.mjs`). A constant-product LP is made whole by a
round trip that returns to its starting price, plus every fee collected on the way, which is exactly
why the 300-pip floor is the expensive part of this story: the pool was rented out 171 times over at
three basis points. As this is written the round trip has not happened. The pool still marks GLD at
about $1,519 against a real ETF price of $409.

---

## 5. The reference

### 5.1 There is no gold oracle on this chain

Enumerating the Chainlink-style feeds on chain 4663 finds 94 of them, including `Robinhood SLV / USD`,
`RHSPY / USD`, `RHNVDA / USD`, `Robinhood META / USD`, `Robinhood AAPL / USD`, `RHTSLA / USD` and
`ETH / USD`. **There is no GLD, XAU or gold feed of any kind** (`scripts/probe-oracles.mjs`, and the
older full-chain sweep in `Research/RHOracle`).

And the feeds that do exist stop at the cash close. Read live on Sunday 2026-08-30 11:06 UTC:

| feed | last answer | last updated | age |
|---|---|---|---|
| RHSPY / USD | 770.2651 | Fri 16:18 UTC | 42h48m |
| RHNVDA / USD | 218.1555 | Fri 19:56 UTC | 39h10m |
| Robinhood META / USD | 576.5713 | Fri 17:28 UTC | 41h37m |
| Robinhood AAPL / USD | 319.7127 | Fri 17:37 UTC | 41h29m |
| Robinhood SLV / USD | 60.0850 | Fri 19:27 UTC | 39h39m |
| ETH / USD | 2456.3113 | Sat 19:13 UTC | 15h53m |

The Robinhood equity oracles are market-hours instruments. They are useful, but they are not a
weekend reference.

### 5.2 For gold, use PAXG

**PAXG/USDT on Binance is a continuously traded gold market.** It is the same venue the ETH keeper
already pulls, so this adds no new dependency.

- 420 Saturday hourly bars in the pulled window, with no gaps at all.
- Median Saturday volume 24 PAXG, roughly $110k an hour: thin, but continuous and arbitraged to spot.
- `XAUTUSDT` is a second, independent tokenised-gold market, currently 0.138% away from PAXG. Use it
  as a disagreement guard: if the two differ by more than about 1%, do not act on either.

The conversion from an ounce of gold to a GLD share is a measured basis, not an assumption. Over 1,394
overlapping hours from 2026-05-04:

| | |
|---|---|
| GLD ETF close / PAXG, median | **0.091840** |
| standard deviation | 0.000340, i.e. 0.370% of the mean |
| \|basis error\| against its own median | median 0.11%, p90 0.35%, **p99 1.32%**, max 5.49% |

So `fair_GLD = PAXG_usd * 0.091840`, with the ratio re-cut on a 30-day rolling median so it absorbs
the ETF's expense drag and PAXG's own premium without anyone touching it. Recomputing against a 30-day
rolling median instead of a fixed one barely moves the error distribution (p99 1.31% against 1.32%),
which is the check that the ratio is stable rather than trending.

### 5.3 The general rule, and the two modes

The reference a pool needs is **the last price it is entitled to believe**. That gives two modes, and
every RWA pool falls into one of them.

**Mode A, live reference.** A continuously traded proxy exists. The deviation is measured against it
in real time, and the trigger band only has to cover the *basis noise* between the proxy and the
asset. GLD is Mode A via PAXG, and its basis noise has a p99 of 1.32%.

**Mode B, anchored reference.** No continuous proxy exists. The reference is the last print of the
on-chain Robinhood feed, and deviation is measured against that anchor. The band must then cover the
*gap risk*: how far the asset could honestly have moved while nobody was looking. That is a much
wider number, and section 6.1 measures it per asset.

The difference between the two modes is roughly a factor of five in how tight the trigger can be.

> **Correction.** This section originally said Mode B "is the case for every single-name US equity."
> It is not. Binance lists tokenised equities that trade 24/7 through the weekend at one token per
> share, so **every Fables pool is Mode A** and none of them uses the anchored mode. Mode B is kept
> here because it is the right design for an asset that genuinely has no continuous reference, and
> because section 6.1's gap measurements are what make the close-anchor trigger sizeable (SYSTEM-SPEC
> section 10). No pool we run today needs it.

---

## 6. The parameters

The proposed schedule, in full:

```
d       = | P_pool / P_reference - 1 |

base    = 3000 pips (0.30%) during market hours
        = 1500 pips (0.15%) out of hours

kick    = 2%          the deviation at which the fee starts to move
full    = 10%         the deviation at which it reaches the cap
cap     = 15000 pips (1.50%)

ramp(d) = base                                          if d <= kick
        = base + (cap - base) * (d - kick)/(full - kick)  if kick < d < full
        = cap                                           if d >= full

outbound leg, the trade that increases |d|:  fee = ramp(d)
inbound  leg, the trade that decreases |d|:  fee = base + (ramp(d) - base) * 0.33
```

### 6.1 The kicker: 2%

The kicker has to sit above honest noise, or the keeper taxes a real move. What counts as honest noise
depends on the mode.

For GLD in Mode A it is the PAXG basis error, whose p99 is **1.32%**. A 2% kicker clears that with
room, and clears it by a wide margin against the day-to-day: the pool's own tracking error against the
live reference during the calm week ran 0.1% to 0.5%.

For Mode B pools it is the gap distribution. Measured over 730 days of hourly bars (`scripts/gaps.py`):

| asset | weekend gaps | median | p90 | p99 | max | session breaks p99 | max |
|---|---|---|---|---|---|---|---|
| SPY | 151 | 0.28% | 0.89% | **2.40%** | 3.37% | 1.15% | 2.17% |
| NVDA | 151 | 0.90% | 2.04% | **6.18%** | 8.63% | 3.37% | 5.32% |
| META | 151 | 0.40% | 1.52% | **4.12%** | 5.63% | 2.07% | 3.43% |
| AAPL | 151 | 0.38% | 1.24% | **6.11%** | 7.28% | 1.45% | 3.12% |
| TSLA | 151 | 1.10% | 2.78% | **6.94%** | 8.20% | 4.91% | 11.35% |
| GLD | 151 | 0.44% | 1.62% | 6.05% | 8.40% | 2.40% | 7.87% |
| ES=F | 124 | 0.18% | 0.71% | 1.58% | 4.07% | 1.02% | 2.63% |
| GC=F | 124 | 0.20% | 1.19% | 2.86% | 7.97% | 1.61% | 2.48% |

The GLD row is what the kicker would have had to be without PAXG: 6.05%, nearly five times wider, and
a 5% kicker already delays the trigger from Friday 23:00 to Saturday 02:00, and 6.05% would be later
still.

**A low kicker is only safe because the ramp is linear.** A spurious reading at 3% charges
`1500 + 13500 * (1/8) = 3188` pips, about 0.32%, not the cap. Getting the kicker slightly wrong is
cheap; that is the whole point of ramping rather than stepping. The sensitivity confirms it: moving the
kicker from 1% to 5% moves modelled event revenue from $43,505 to $34,876, a 20% band across a 5x
change in the parameter.

### 6.2 The full point: 10%

This is where we stop giving the benefit of the doubt. It should sit above anything the asset has ever
honestly done while unobserved. For gold that is a 7.97% worst weekend gap in the futures and an 8.40%
worst gap in the ETF, against a 5.49% worst basis error. 10% clears all three.

The interpretation is worth stating plainly, because it is what makes the cap defensible to anyone who
asks: **we only charge full freight once the pool has moved further than the asset has ever moved over
a weekend in two years of data.** At that point the move is not information, and the fee is not a tax
on a trader who knows something we do not.

### 6.3 The cap: 15,000 pips, 1.50%

Two questions here: is it defensible, and does it destroy the pool.

**Defensible.** What the funded, traded venues on this chain charge:

| pool | fee | TVL |
|---|---|---|
| GLD v3-3000 | 0.30% | $82,820 |
| GLD v3-10000 | **1.00%** | $47,344 |
| SPY v4-3499 | 0.35% | $3,337,564 |
| NVDA v4-3499 | 0.35% | $1,002,457 |
| SPY v4-625 | 0.06% | $510,477 |
| NVDA v3-500 | 0.05% | $6,006,090 |

There is a live, funded GLD pool on this chain charging 1.00% flat, around the clock, in every
condition. Our 1.50% is 1.5x that and is only reached when the pool is more than 10% off fair. If the
external defence matters more than the revenue, 10,000 is the number with the cleanest answer
("we never charge more for gold than a venue that already exists here"), and it costs about 29% of the
modelled event revenue.

**Does not destroy the pool.** The fee as a share of the mispricing it is charged on:

| deviation | at 0.30% | at 0.60% | at 1.50% |
|---|---|---|---|
| 3% | 10.0% | 20.0% | 50.0% |
| 8% | 3.8% | 7.5% | 18.8% |
| 20% | 1.5% | 3.0% | 7.5% |
| 100% | 0.3% | 0.6% | 1.5% |
| 381% | 0.1% | 0.2% | 0.4% |

At the full point the arbitrageur still keeps 81% of the gap. Past 20% deviation we are taking under
8%. The ramp exists precisely so that the top-left cell of that table, where a 1.50% fee would be half
the mispricing, is never actually charged.

And the event settles it empirically, harder than this document originally argued. When the fee went
from 300 to 6,000 pips at Saturday 15:00, **$926,461 of volume still came**. Measured properly, on
our SHARE of all on-chain GLD/USDG volume rather than on raw hourly volume, which controls for the
event decaying:

| fee | our share of all on-chain GLD volume | our volume |
|---|---|---|
| 300 pips, Fri 16:00 ET on, 23h | 33.9% mean, 28.9% volume-weighted | $4,789,279 |
| 6,000 pips, Sat 15:00 on, 16h | 25.2% mean, 22.4% volume-weighted | $926,461 |

**A twentyfold fee raise cost 26% of share.** Share elasticity is **-0.10**, and revenue per unit of
market volume went up **14.9x**. The `empirical` model used elsewhere in this document fits -0.431
from the raw volume drop, which conflates the fee with the event decaying: measured on share it is
four times more inelastic, so every revenue figure in section 8 that leans on the `empirical` column
is conservative by roughly that factor.

The decisive detail: over those same 16 hours the cheapest funded direct alternative, a v3 pool
**12x cheaper at 500 pips**, took **$132,528** against our $926,461. A cheaper venue sat live the
whole time and could not take the flow, because it was mispriced in the same direction. That is the
mechanism in one line: **when the alternative route reaches a price that is itself dislocated, the
competitive ceiling is not merely non-binding, it is absent.**

Capping lower is worse than doing nothing new: at a 3,000 cap the whole schedule earns $12,113,
against $6,885 actually earned and $8,321 for a flat schedule with no trigger at all. The competitive
constraint binds on routine flow, not on dislocation flow. When every GLD venue on the chain is wrong
together, the arbitrageur has to trade **our** pool to capture **our** mispricing; routing elsewhere
does not fix it.

| cap | fees (cpmm) | fees (empirical) |
|---|---|---|
| 3,000 (0.30%) | $12,113 | $7,599 |
| 6,000 (0.60%) | $19,583 | $10,013 |
| 8,000 (0.80%) | $24,479 | $11,374 |
| 10,000 (1.00%) | $29,307 | $12,612 |
| **15,000 (1.50%)** | **$41,085** | **$15,347** |
| 20,000 (2.00%) | $52,444 | $17,738 |

Note the ceiling: `ABSOLUTE_MAX_FEE` is 15,000 on the GLD, SPY, META and AAPL hooks and 20,000 on the
NVDA, TSLA and ETH hooks, so 15,000 is the highest cap available on every pool without a redeploy.
That is a second, practical reason to standardise on it.

### 6.4 The base: 0.30% in hours, 0.15% out of hours

The out-of-hours base is lower than the in-hours base, which is the opposite of what the emergency
config now does (`3000/3000/6000`). That is deliberate and it is only defensible **because the
reference is live**. The reason the closed tier was dangerous was blindness, and PAXG removes the
blindness: any real dislocation is now priced by the deviation term within the hour, so the base does
not have to carry insurance it cannot target.

Out-of-hours flow is also the flow least worth deterring, being thin and mostly not the flow we are
worried about. The cost of the choice is small and measured: a 0.30% closed base instead of 0.15%
earns $44,904 against $41,085 on this event, about 9%.

**For a Mode B pool this argument does not hold** and the out-of-hours base must stay at or above the
in-hours base until that pool has a live reference. This is the one parameter that is not uniform
across the standard.

---

## 7. Asymmetry, and why the corrective leg pays a third

The two legs of a dislocation are not the same trade. One walks the pool away from fair and grows the
position the LP did not want; the other brings it back. Taxing them identically is leaving something
on the table.

Splitting the event by whether the deviation grew or shrank in each hour:

| leg | hours | volume | share |
|---|---|---|---|
| outbound, the pool walked further out | 25 | $4,563,959 | **80%** |
| inbound, the pool brought back | 14 | $1,133,706 | 20% |

**A correction to what this section originally argued.** It claimed the inbound discount was a hole,
because it makes a round trip cost 1.65% instead of 3.00% and the counterparty looked like a
round-tripper. That reasoning is wrong. A round trip is **LP-positive**: reserves on a
constant-product curve are a function of price alone, so an excursion returning to its origin leaves
the LP with their starting reserves plus every fee collected on both legs, while the round-tripper
buys high, sells lower, and pays twice. That is flow to welcome. The one case where it hurts is a
round-tripper who is also the LP, washing for fee-denominated points, and there the fee returns to
them so no round-trip cost deters it.

The LP is hurt by a **one-way excursion that does not come back**, which is what GLD actually was.
The outbound leg creates the position the LP did not want; the inbound leg resolves it. Charging more
for the leg that does the damage is the whole argument for asymmetry, and it needs no model.

> **Read this table for the round-trip column, not the revenue columns.** The revenue figures come
> from replaying the actual volume path with an exogenous volume response, so charging more on the
> inbound leg raises revenue close to by construction. The model has no trade diversion in it, does
> not price the residual dislocation a higher repair fee leaves behind, and replays only a 381%
> event, where our pool is 21% cheaper than the next venue and the repair flow arrives whatever we
> charge. The regime where the inbound share actually matters, small-to-moderate deviation with a
> thin price advantage, is untested. The round-trip column is arithmetic and does survive.

| inbound share of the ramp | fees (cpmm) | fees (emp) | avg outbound | avg inbound | round trip at full ramp |
|---|---|---|---|---|---|
| 0%, base only | $36,291 | $13,176 | 0.98% | 0.15% | 1.65% |
| **33%** | **$41,085** | **$15,347** | 0.98% | 0.56% | **2.10%** |
| 50% | $43,521 | $16,160 | 0.98% | 0.77% | 2.33% |
| 100%, symmetric | $50,551 | $18,108 | 0.98% | 1.40% | 3.00% |

A third is the compromise: the corrective leg still pays a little over half what the destabilising leg
pays, so the incentive to fix the pool survives, and the round trip costs 2.10% rather than 1.65%.
**0.33 is the locked value for GLD.** The revenue ranking in the table above is not the reason: see
the note under it, and SYSTEM-SPEC section 7.1.

The direction that "worsens the spread" is defined against the reference, not against a fixed side, so
it flips automatically when the pool is cheap rather than rich. That matters: this event ran rich, but
a stale anchor after a genuine gap down will run cheap, and the same rule handles it.

**Availability is per pool, and the pilot has it.** GLD, META and SPY/GLD carry the deployed
asymmetric pipeline: a four-argument `pokeFee(poolId, fee0For1, fee1For0, ttl)` on the hot key, plus
a standing `setPoolAsymmetry` premium on the delayed admin path. The two-sided poke is the right tool
here, because which direction counts as outbound flips with the sign of the deviation and so cannot
be a static config. SPY, NVDA, TSLA, AAPL, NVDA/SPY and ETH carry only the legacy single-sided poke
and can never gain asymmetry, since hook code is immutable and the PoolKey binds the hook address.
See SYSTEM-SPEC section 5 for the mechanics that bite.

---

## 8. What it would have earned

### 8.1 The volume response

Two models, because the honest answer is a range.

**cpmm** is the physical one: the volume needed to walk a constant-product pool from mispricing `d`
down to the fee band, relative to the volume needed to walk it to the fee actually charged. Against a
187% mispricing, the difference between a 0.03% fee and a 1.50% fee barely changes how far the arb
walks, so this model says volume is almost unchanged.

**empirical** is fitted from the one natural experiment in the data. When the fee went from 300 to
6,000 pips at Saturday 15:00, hourly volume fell from $208,230 to $56,774, a factor of 3.67 against a
factor of 20 in the fee, giving `V ~ f^-0.431`. This over-states the elasticity, because the event was
also decaying while the fee rose, so treat it as a floor rather than an estimate.

### 8.2 Scoring

All figures with a 1-hour keeper lag, which is deliberately pessimistic given the ETH keeper repokes
every 9 to 10 minutes.

| schedule | fees (cpmm) | fees (emp) | first raise |
|---|---|---|---|
| what actually happened | $6,885 | $6,885 | Sat 15:00 ET |
| flat 0.30/0.15, no trigger | $8,321 | $6,066 | never |
| **the schedule: kick 2%, full 10%, cap 1.50%, inbound 33%** | **$41,085** | **$15,347** | **Fri 23:00 ET** |
| same, inbound 0% | $36,291 | $13,176 | Fri 23:00 ET |
| same, inbound 100% | $50,551 | $18,108 | Fri 23:00 ET |
| same, closed base 0.30% | $44,904 | $16,386 | Fri 23:00 ET |
| same, cap 1.00% | $29,307 | $12,612 | Fri 23:00 ET |
| same, kick 1% | $43,505 | $15,874 | Fri 22:00 ET |
| same, kick 5% | $34,876 | $13,937 | Sat 02:00 ET |
| same, full 5% | $49,833 | $17,026 | Fri 23:00 ET |
| same, full 20% | $33,876 | $14,029 | Fri 23:00 ET |

Six times what the pool actually earned on the physical model, and a little over twice on the
pessimistic one, and it starts pricing the problem **sixteen hours** before the manual
response did.

The second row is the one that justifies the whole exercise: a flat schedule with a sensible base and
no trigger earns roughly what actually happened. **The trigger is doing all of the work.**

Lag matters less than one would expect, because the deviation persists for a day:

| keeper lag | fees (cpmm) | fees (emp) | first raise |
|---|---|---|---|
| 0h | $46,507 | $16,412 | Fri 22:00 |
| 1h | $41,085 | $15,347 | Fri 23:00 |
| 2h | $37,678 | $14,669 | Sat 00:00 |
| 4h | $31,910 | $13,428 | Sat 02:00 |
| 8h | $24,328 | $12,180 | Sat 06:00 |

An eight-hour-late keeper still captures 52% of a perfect one and three and a half times what happened.
That is a robustness property worth having: this does not need to be a low-latency system.

### 8.3 Is there an optimal fee?

Not knowably, and that is an argument for a clean schedule rather than a tuned one.

The revenue-maximising fee against an arbitrageur closing a gap `d` on a constant-product pool solves
`sqrt(1+d) - sqrt(1+f) = f / (2*sqrt(1+f))`, which reduces to the familiar `f* = d/2` for small `d`.
At `d = 3%` that is 1,500 pips; at `d = 187%` it is around 8,800 bps. So at every deviation worth
reacting to, the theoretical optimum sits far above any cap anyone would set, which means the pool is
on the rising part of the revenue curve everywhere below the cap.

Combine that with having exactly one observation of the real volume-response curve, and the model
simply cannot distinguish between any two reasonable schedules. **The cap does the work; the shape
below it is a judgement call.** Anyone proposing to tune these parameters harder should be asked what
new measurement they intend to make first.

---

## 9. The treasury cut

The natural way to route a share of a dislocation to the treasury would be v4's protocol fee. It is
already directional: `ProtocolFeeLibrary` packs a separate 12-bit fee for `zeroForOne` and
`oneForZero`, each capped at `MAX_PROTOCOL_FEE = 1000` pips (0.1%), taken from the input before the LP
fee.

**We cannot set it.** On the chain 4663 PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`,
`protocolFeeController()` is `0x6d0009504d129cf5002dba61d9ae8575aa79314c` and `owner()` is
`0x2bad8182c09f50c8318d769245bea52c32be46cd`. Neither address appears anywhere in the Fables
contracts, and `setProtocolFee` reverts for anyone but the controller. The GLD pool's protocol fee is
currently zero in both directions. Getting it would mean asking Robinhood.

Taking the cut inside the hook instead means returning a `BeforeSwapDelta`, which requires a delta
permission flag, and v4 encodes hook permissions in the hook **address**. That is a new deployment and
a pool migration, not a config change.

**What already exists is enough.** `FablesLedger.claimFeeBps` (max 2,000, i.e. 20%) skims a share of
fees collected and routes it to `FablesTreasurySplitter`. Because it is a share of *fees*, and fees
now scale with the premium, the treasury take scales with the premium **by construction**. No dynamic
mechanism is needed, because the thing it skims is already dynamic.

| claimFeeBps | treasury (cpmm) | treasury (emp) | the same rate on what actually happened |
|---|---|---|---|
| 500 (5%) | $2,054 | $767 | $344 |
| **1000 (10%)** | **$4,108** | **$1,535** | **$688** |
| 1500 (15%) | $6,163 | $2,302 | $1,033 |
| 2000 (20%) | $8,217 | $3,069 | $1,377 |

Honest limits: it is global across pools rather than per-pool, it is not directional, and changing it
goes through the AccessManager execution delay. It is a standing setting, not an event lever. If a
directional treasury cut is genuinely wanted, it arrives with the same bytecode change as the
asymmetry in section 7, and it should be argued on its own merits then.

---

## 10. The standard: every RWA pool, in due time

The GLD event is not a gold story. It is what happens to any pool whose reference market shuts while
its fee schedule keeps quoting. Every Fables RWA pool has the same shape, and five of them are sitting
at 250 to 300 pips right now, on a Sunday, with no deviation term at all.

**The standard.** Every RWA pool prices deviation from its reference, on the schedule in section 6,
with per-asset parameters set by measurement and not by analogy. A pool that has no reference does not
list.

**The parameter table that stood here is superseded. Use `SYSTEM-SPEC.md` section 7.2.**

It proposed a Mode B stale-anchor design for the equities, on the belief that no continuously traded
reference existed for single-name US stocks. That belief was wrong. Binance lists tokenised equities
(SPYB, NVDAB, METAB, AAPLB, TSLAB, QQQB and seven more) which trade 24/7 including the full weekend
at one token per share, with a basis of 0.999 to 1.000 and a p99 tracking error of 0.27% to 2.05%.

**Every Fables equity pool is therefore a Mode A pool and the stale-anchor mode is not needed
anywhere.** The consequence is large: the kickers in the superseded table were 3% to 8%, set by gap
risk; the measured ones in SYSTEM-SPEC are 0.75% to 2.50%, set by basis noise. The two suggestions
that followed the table, asking Robinhood to publish out-of-hours and hunting for a 24/7 proxy, are
answered: the proxy already exists.

What survives from this section is the principle, unchanged: **a pool with no live reference does not
list**, and per-asset parameters come from measurement rather than analogy.

**Rules that apply to every pool regardless of mode:**

- **The out-of-hours base may never sit below the in-hours base unless the pool is in Mode A.** This
  is the specific mistake that cost GLD its book.
- **Two independent reference sources, with a disagreement guard.** If they diverge by more than about
  1%, the keeper holds its last fee rather than acting on a number it cannot corroborate.
- **Poke TTL short in calm, long once triggered.** 2 hours renewed while `d <= kick`, 12 hours once
  `d > kick`, so a keeper failure in calm lapses back quickly but a keeper failure mid-event does not
  hand the fee back down. `MAX_POKE_TTL` is 72 hours.
- **The cap is the pool's `maxFee`**, which is bounded by that hook's `ABSOLUTE_MAX_FEE`: 15,000 on
  the GLD, SPY, META and AAPL hooks, 20,000 on NVDA, TSLA and ETH. Raising a pool's `maxFee` to its
  hook ceiling is a `setPoolConfig` call; going past the ceiling is a redeploy.
- **Every raise is logged with the deviation that caused it**, so the schedule can be re-fitted against
  its own history rather than against this single event.

**Rollout order.** GLD first, because it is live, already at cap 15,000, already in Mode A, and has the
only measured event. SPY second, because it has the tightest Mode B band and the deepest book. Then
META, NVDA, AAPL, TSLA. ETH last, and only as a deviation term layered on the existing volatility
keeper, since that pool has never had this failure and the two signals need to be shown not to fight.

---

## 11. Methods, for the fact check

Everything in this document is reproducible from `scripts/`. Nothing was taken on trust from a
third-party summary; every on-chain figure is a direct call and every market figure is a direct pull.

**Order of operations.**

```
cd scripts
npm install                     # viem only

node fetch-pools.mjs            # gateway snapshot   -> ../data/now.json
node fetch-prices.mjs           # pool price history -> ../data/prices.json
node fetch-paxg.mjs             # Binance klines     -> ../data/paxg.json
node fetch-bars.mjs             # Yahoo 1h bars      -> ../bars/  (gitignored, ~8MB)

python model.py                 # every table in sections 4 to 9
python gaps.py                  # the per-asset gap table in section 6.1
```

**Evidence probes**, each independent of the model and of each other:

```
node probe-hooks.mjs            # section 3: live caps, poke floors, bytecode constants,
                                #            and the PoolManager's protocol-fee controller
node probe-oracles.mjs          # section 5.1: which feeds exist on chain 4663 and how stale
node probe-token.mjs            # section 4.2: GLD uiMultiplier is 1e18, so no share event
node probe-rivals.mjs           # section 4.2: rival GLD pool spot prices, read from slot0
node probe-config.mjs           # section 4.2: the pool's PoolConfigured and FeePoked history
node probe-lp.mjs               # section 4.3: ModifyLiquidity over the event
```

**Things worth checking hardest, because they carry the most weight:**

1. **The basis, `RATIO = 0.091840`.** Everything about GLD's deviation scales with it. It is the
   median of GLD-ETF-close over PAXG across 1,394 overlapping hours. Recompute it over a different
   window and confirm the p99 error stays near 1.32%.
2. **The claim that gold did not move.** PAXG +0.13% across the event against the pool's +262%. If
   PAXG were wrong, the whole diagnosis is wrong. XAUT is the independent check, currently 0.138%
   away.
3. **The volume-response models.** `cpmm` and `empirical` bracket every revenue figure in this
   document and they disagree by roughly 2.7x. Neither is measured properly, because we have one
   observation. Any conclusion that depends on which one is right should be treated as unproven.
4. **The 20x fee increase that did not stop the flow** ($908,386 after the raise). This is the single
   empirical fact carrying the cap argument, and it is one observation on one pool on one weekend.
5. **The tier boundaries** in `session_of()`, taken from `be2.py` and `SessionLib`. If the hook's real
   session boundaries differ, the base-fee column shifts, though the deviation term does not.

**Data provenance.** `data/now.json` and `data/prices.json` are the Uniswap gateway
(`interface.gateway.uniswap.org`, chain ROBINHOOD). `data/paxg.json` is Binance spot klines.
`bars/` is Yahoo Finance hourly, not committed, per this repo's existing convention. All on-chain
reads go to `https://rpc.mainnet.chain.robinhood.com`.

---

## 12. What this does not settle

- **Whether the event was manipulation or a broken market.** 171x churn on a $33k pool, oscillating
  between $1,200 and $1,971 for sixteen hours while a fee-denominated points programme was running,
  has the shape of deliberate churn. It does not change the proposal: if it is churn, a higher fee
  taxes the churner, and the asymmetry in section 7 is chosen specifically so the round trip does not
  get cheap. But the counterparty has not been identified and should be.
- **Why the chain's GLD is dislocated at all.** Every venue on chain 4663 prices GLD around $1,400 to
  $1,520 against a real ETF at $409, and it has persisted for more than two days. Either the mint and
  redeem path is closed or broken, or something about the token's redeemability is not what we assume.
  That question is upstream of this document and matters more than the fee.
- **The LP damage, precisely.** Net liquidity fell 15% over the event, but separating trading losses
  from withdrawals needs per-position accounting we have not done.
- **n = 1.** Every revenue figure here is a replay of a single weekend on a single pool. The gap
  distributions in section 6.1 rest on 124 to 151 real observations each and are the solid part; the
  cap argument rests on one natural experiment and is the weak part.
- **Whether a deviation term interacts badly with the ETH volatility keeper.** They have never run
  together. That is why ETH is last in the rollout.
