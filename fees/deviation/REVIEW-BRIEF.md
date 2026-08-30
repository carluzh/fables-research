# Deviation fee: spec for review

Specified, not built. Start with `SYSTEM-SPEC.md`; `DEVIATION-FEE.md` is the evidence behind it and
loses wherever the two disagree.

## Why

GLD ran to **+381% above fair** over the weekend of 28 to 30 Aug while gold itself moved 0.13%.
**$4.79M traded at the 300-pip closed floor and earned $1,437.** The response took 23 hours and went
through `setPoolConfig`. `FeePoked` has never fired on that pool.

## What it is

A deviation term poked on top of the session ladder. Below a per-pool kicker nothing changes and no
poke happens at all. Above it the fee ramps to the pool cap. GLD is the pilot and its parameters are
locked; every other live-reference asset has a kicker from a rule a script applies, so adding an asset
means running `reference-census.mjs`, not interpreting a paragraph.

## Reference is Binance

The tokenised equities (SPYB, NVDAB, METAB and nine more) trade 24/7 through the weekend at one token
per share, basis 0.999 to 1.000. Gold is the one exception and needs PAXG converted from an ounce to
an ETF share by a measured basis of 0.091804.

## Your work, used

I read the keeper on `lvrfee-engine` and modelled the new one on it: same push policy, poke lifecycle,
RPC fallback, `depeg.py` guard pattern, `--dry-run`. **Engine copied, signal not**: no volatility term,
because the RWA calendar already prices session vol and a live term would charge twice.

Your asymmetric fee work is deployed on GLD, META and SPY/GLD, so the pilot uses the two-sided poke
with the inbound leg at a third.

## Two things I need from you

1. **Protocol fee.** I could not find how Fables sets one. Section 6 has four specific questions and
   is the only place the spec says "unknown" instead of giving a number. Until it is answered the
   keeper ships with no treasury cut.
2. **The poking role on GLD**, under the four-argument `pokeFee` ABI specifically. Unverified, and it
   blocks everything.

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
