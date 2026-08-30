# Deviation fee: spec for review

Specified, not built. Start with `SYSTEM-SPEC.md`; `DEVIATION-FEE.md` is the evidence behind it and
loses wherever the two disagree.

## Why

GLD ran to **+381% above fair** over the weekend of 28 to 30 Aug while gold itself moved 0.13%.
**$4.79M traded at the 300-pip closed floor and earned $1,437.** The response took 23 hours and went
through `setPoolConfig`. `FeePoked` has never fired on that pool.

## What it is

A deviation term poked on top of the session ladder. Below a per-pool kicker nothing changes and no
poke happens at all. Above it the fee ramps to the pool cap.

## Build it for all seven pools, not GLD alone

You were right to push back. **Nothing made GLD uniquely vulnerable; it just went first.** As this is
written, on a Sunday, SPY, NVDA, META, TSLA and AAPL are all resting at 250 to 400 pips, which is the
same 0.025% to 0.04% in the same blind window that cost GLD its book.

**Capacity is not a constraint.** Measured on `lvrfee-engine` (e2-medium, 2 vCPU, 3,924 MB) with the
ETH keeper up 5 days 23 hours:

| | now, one pool | seven pools | headroom |
|---|---|---|---|
| RSS | 79.8 MB | 559 MB | 14% of RAM |
| CPU | 0.4% | 2.8% | load average is currently 0.00 |
| connections | 4 | 28 | |

**Binance is not a constraint either.** The price feed is a websocket, so it consumes no REST weight
at all. The limits are 6,000 request-weight per minute and 300,000 raw requests per five minutes per
IP, and the second-source guard is a weight-1 ticker read. Seven pools use a rounding error of that.

**Blast radius is bounded and expiring.** A poke resolves inside `[max(pokeFloor, autonomous/2), cap]`
and lapses at its TTL, so the worst a bug does is overcharge for 2h in calm or 12h once triggered.
The keeper only ever computes `ramp(d) >= base`, so assert that and refuse to poke below the session
base: the downward half of the range becomes unreachable.

**One thing actively favours doing them together.** GLD and META take the four-argument `pokeFee`;
SPY, NVDA, TSLA, AAPL and ETH take the legacy three-argument one. A GLD-only build implements one
path and then gets retrofitted.

Suggested shape: **dry-run all seven from day one** (`--dry-run` exists and pokes nothing, so it is
free), then enable live poking pool by pool over days, gated on each dry run being clean rather than
on a calendar.

## You are not waiting on the parameters

The **deviation** parameters are done and in `SYSTEM-SPEC.md` section 7: GLD locked, and a kicker and
full point for every asset with a live reference, from a rule a script applies.

The parameters still landing are the **calendar ladder**, the per-session base fees, from the separate
per-pool competitive work in `../pools/`. Those are a different layer and **the keeper does not depend
on them**: it reads whatever base the pool is configured with and adds a deviation term on top. A
later ladder change is a `setPoolConfig` and touches no keeper code. Build now.

## Reference is Binance, with OKX as the guard

The tokenised equities (SPYB, NVDAB, METAB and nine more) trade 24/7 through the weekend at one token
per share, basis 0.999 to 1.000. Gold is the exception and needs PAXG converted from an ounce to an
ETF share by a measured basis of 0.091804.

Moving a reference 2% costs $186k to $479k on the equities and millions on gold, against $1,682 to
move our own GLD pool the same distance. OKX lists all twelve within 0.12% of Binance and is the
disagreement guard, not a fallback to trade off. Section 4.4.

## Your work, used

I read the keeper on `lvrfee-engine` and modelled the new one on it: same push policy, poke
lifecycle, RPC fallback, `depeg.py` guard pattern, `--dry-run`. **Engine copied, signal not**: no
volatility term, because the RWA calendar already prices session vol and a live term would charge
twice.

Your asymmetric fee work is deployed on GLD, META and SPY/GLD, so those use the two-sided poke with
the inbound leg at a third. The other four are symmetric and permanently so.

## Two things I need from you

1. **Protocol fee.** I could not find how Fables sets one. Section 6 has four specific questions and
   is the only place the spec says "unknown" instead of giving a number. Until it is answered the
   keeper ships with no treasury cut.
2. **The poking role**, per pool, under the right `pokeFee` ABI: four-argument on GLD and META,
   three-argument on the rest. Unverified, and it blocks everything.

## Calibration

Two things in here I got wrong and corrected: I read asymmetry availability off
`audit/cofounder-fixes` and concluded no pool had it, and I over-read the replay model on symmetric
versus asymmetric. Both retractions are in the documents rather than quietly fixed, so you can see
which claims have been stress-tested and which have not.

Every number is reproducible. `python scripts/model.py` prints its output labelled by document
section, so checking it is a diff.

## The three things worth hitting hardest

- **The protocol fee**, because it is open.
- **SPY's base.** An adversarial verifier broke the 600-pip route-ceiling premise that both prior
  documents rested on: two thirds of open-session SPY volume trades above it. Section 9.
- **n = 1.** Every revenue figure replays one weekend on one pool, bracketed by two volume models
  that disagree by 2.7x.
