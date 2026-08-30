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
| RSS | 79.8 MB | 431 MB physical | 11% of RAM |
| CPU | 0.4% | under 2.8% | load average is currently 0.00 |
| connections | 4 | 28 | |
| **chain reads** | **push only** | **per pool per cycle, forever** | **needs sizing** |

The last row is the one real new draw and the spec now says so: the ETH keeper touches chain only
when it pushes, this one reads the pool and its ladder every cycle. Give it a fixed poll cadence and
size it against the Alchemy plan, which nobody has read yet.

**Binance is not a constraint either.** The price feed is a websocket, so it consumes no REST weight
at all. The limits are 6,000 request-weight per minute and 300,000 raw requests per five minutes per
IP, and the second-source guard is a weight-1 ticker read. Seven pools use a rounding error of that.

**Blast radius, corrected.** I had this wrong in the first draft and a review pass caught it. It is
two-sided, not overcharge-only: a poke computed against one session's base and still live in the next
resolves to `max(pokeFloor, base_now/2)`, so it **undercharges by up to 50%**, and NVDA and TSLA carry
4,000-pip opening bells right inside that hole. Duration is 72h on chain, and unbounded while a live
buggy keeper keeps renewing; only a dead one lapses in 2h. Containment is the guardian's `clearPoke`
at zero delay, held by a key that is not the poker. The fix is reading `base` from chain every cycle,
which the spec now requires.

**One thing actively favours doing them together.** GLD and META take the four-argument `pokeFee`;
SPY, NVDA, TSLA, AAPL and ETH take the legacy three-argument one. A GLD-only build implements one
path and then gets retrofitted.

**The one thing the keeper must not do:** hold `base` as a config constant. It reads
`feeFloorAt(floorConfig(poolId), now)` from the pool's own hook every cycle, and re-pokes whenever
that changes. NVDA and TSLA do not step at the open, they ramp: `spikeMult` 5 and 8 with a 4,000-pip
bell decaying over two hours, which a keeper-side constant cannot express.

Suggested shape: **dry-run all seven from day one**, then enable live poking pool by pool over days,
gated on each dry run being clean rather than on a calendar. One caveat I got wrong first time: the
template's `--dry-run` returns before it builds the web3 client, so as inherited it exercises neither
the pool read nor the orientation assertion. Keep the read path live in dry run, which makes it the
real resource test rather than a free one.

## You are not waiting on the parameters

The **deviation** parameters are done and in `SYSTEM-SPEC.md` section 7: GLD locked, and a kicker and
full point for every asset with a live reference, from a rule a script applies.

The **calendar ladder**, the per-session base fees, is the separate per-pool work in `../pools/`,
which has now landed and ships its own numbers. Those are a different layer and **the keeper does not depend
on them**, precisely because it reads the base from chain every cycle rather than holding it: a later
ladder change is a `setPoolConfig` and touches no keeper code. That is true only with the
read-from-chain design above; the first draft of this spec held base as a constant and the claim would
have been false. Build now.

## Reference is Binance, with OKX as the guard

The tokenised equities (SPYB, NVDAB, METAB and nine more) trade 24/7 through the weekend at one token
per share, basis 0.999 to 1.000. Gold is the exception and needs PAXG converted from an ounce to an
ETF share by a measured basis of 0.091804.

Moving a reference 2% costs $186k to $479k on the equities and millions on gold, against $837 to move
our own GLD pool the same distance: 3,597x harder. OKX lists all twelve within 0.12% of Binance and is
the disagreement guard, not a fallback to trade off. Section 4.4.

## Your work, used

I read the keeper on `lvrfee-engine` and modelled the new one on it: same push policy, poke
lifecycle, RPC fallback, `depeg.py` guard pattern, `--dry-run`. **Engine copied, signal not**: no
volatility term, because the RWA calendar already prices session vol and a live term would charge
twice.

Your asymmetric fee work is deployed on GLD, META and SPY/GLD, so those use the two-sided poke with
the inbound leg at a third. The other four are symmetric and permanently so.

## One thing I need from you

**The protocol fee.** I could not find how Fables sets one. Section 6 has four specific questions and
is the only place the spec says "unknown" instead of giving a number. Until it is answered the keeper
ships with no treasury cut.

The poking role is **no longer** an ask: a review pass verified it on chain. `getTargetFunctionRole`
binds the 4-arg selector to role 1 on GLD, META and SPY/GLD and the 3-arg to role 1 on the other six,
`isTargetClosed` is false everywhere, both poker keys hold role 1 at zero delay, and a `pokeFee`
`eth_call` from the poker key succeeds under each pool's own ABI. Sorry for the false alarm.

## Calibration

Four things in here I got wrong and corrected, all left visible in the documents rather than quietly
fixed, so you can see which claims have been stress-tested:

- Read asymmetry availability off `audit/cofounder-fixes` and concluded no pool had it. Wrong: GLD,
  META and SPY/GLD have it.
- Over-read the replay model on symmetric versus asymmetric. The model cannot answer that question.
- **Locked a GLD base of 1,500 out of hours, below the pool's own `pokeFloor` of 3,000.** Every poke
  from d = 2.00% to 2.889% would have reverted `FeeBelowFloor`. This is why the spec now reads `base`
  from chain instead of carrying it as a constant.
- Called the poking role an unchecked blocker when it is bound correctly on all nine hooks.

Every number is reproducible. `python scripts/model.py` prints its output labelled by document
section, so checking it is a diff.

## The three things worth hitting hardest

- **The protocol fee**, because it is open.
- **Whether the ramp shape is right at all.** The kicker and cap are measured; the linear ramp
  between them is a judgement call, and no data in here distinguishes it from any other monotonic
  curve.
- **n = 1.** Every revenue figure replays one weekend on one pool, bracketed by two volume models
  that disagree by 2.7x.
