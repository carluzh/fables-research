# Ladder correction: the shipping table was written against the wrong baseline

**2026-08-30, in response to `LADDER_RECONCILIATION.md`. Every number below is a chain read, not a
document read.** Reproduce with `../deviation/scripts/live-ladder.mjs`, `ladder-history.mjs`,
`ladder-roles.mjs`, `ladder-admins.mjs`; raw output in `../deviation/data/`.

The review is right on its central point, and the shipping table in
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md) section 2 and [OVERVIEW.md](OVERVIEW.md) section 3
must not be executed as written. It is also wrong in four places, and it misses the finding that
matters most. All three are below.

---

## 1. The full config history, which nobody had

`PoolConfigured` carries the whole struct, so the ladder's history is on chain. Scanned 30M blocks
(35 days) on every hook. This table did not exist before and it settles the dispute by itself.

| pool | set at (UTC) | open | o/n | closed | spikeMult | closedSpike | descent | closeFloor / before / after | cap |
|---|---|---|---|---|---|---|---|---|---|
| SPY | 2026-08-15 16:25:40 | 500 | 350 | 300 | 0 | 0 | 0 | 0 / 0 / 0 | 8,000 |
| SPY | **2026-08-28 04:41:12** | **800** | **350** | **250** | 0 | 0 | 0 | 0 / 0 / 0 | 8,000 |
| NVDA | 2026-08-15 16:25:38 | 700 | 400 | 300 | 8 | 3,200 | 7,200 | 1,500 / 1,800 / 900 | 8,000 |
| NVDA | **2026-08-28 04:42:49** | **1,000** | **800** | **300** | **5** | **4,000** | 7,200 | **2,200 / 1,800 / 0** | 8,000 |
| GLD | 2026-08-24 12:24:20 | 500 | 350 | 300 | 0 | 0 | 0 | 0 / 0 / 0 | 8,000 |
| GLD | 2026-08-28 04:43:43 | 1,500 | 1,500 | 300 | 0 | 0 | 0 | 0 / 0 / 0 | 8,000 |
| GLD | **2026-08-29 19:19:30** | **3,000** | **3,000** | **6,000** | 0 | 0 | 0 | 0 / 0 / 0 | **15,000** |
| META | 2026-08-24 12:24:23 | 500 | 350 | 300 | 0 | 0 | 0 | 0 / 0 / 0 | 8,000 |
| META | **2026-08-28 04:44:26** | **900** | **750** | **250** | 0 | 0 | 0 | 0 / 0 / 0 | 8,000 |
| TSLA | **2026-08-20 07:46:51** | **900** | **500** | **400** | **8** | **4,000** | 7,200 | 1,600 / 1,800 / 900 | 10,000 |
| AAPL | **2026-08-20 07:46:49** | **500** | **350** | **300** | 0 | 0 | 0 | 0 / 0 / 0 | 8,000 |
| ETH | never | `FablesLVR`, no calendar. Keeper-driven: `pokeFloor` 100, `flatFee` 450, `maxFee` 3,000 | | | | | | | |

Bold rows were live at the time of writing, confirmed by a direct `floorConfig(poolId)` read at head
block 50,182,193.

> **ONE ROW HAS MOVED SINCE, 2026-08-31.** Rescanning `PoolConfigured` from block 50,100,000 to head
> 51,001,838 returns exactly one event across all eight calendar hooks:
>
> | pool | set at (UTC) | open | o/n | closed | cap |
> |---|---|---|---|---|---|
> | META | **2026-08-30 21:49:39**, blk 50,341,839 | 900 | 750 | **450** | 8,000 |
>
> That is the one tier the per-pool work signed off, shipped as a single `setPoolConfig` twelve minutes
> before the deviation keeper booted, and it is why the keeper's own boot log reads "META/USDG:
> poke_floor moved 250 -> 450 on chain". META's row in the table above should be read as 900 / 750 /
> **450**, not 250. Nothing else changed: SPY, NVDA, GLD, TSLA and AAPL are still on their 28 August
> rows and section 6's GLD question is still open. Re-read with `fee-rerun-2026-08-30/cfghist.mjs`.

**What the 28 August change actually did.** It was a broad raise on OPEN and OVERNIGHT and a small
CUT on CLOSED:

| pool | open | overnight | closed |
|---|---|---|---|
| SPY | 500 to 800, **+60%** | 350, unchanged | 300 to 250, **-17%** |
| NVDA | 700 to 1,000, **+43%** | 400 to 800, **+100%** | 300, unchanged |
| META | 500 to 900, **+80%** | 350 to 750, **+114%** | 300 to 250, **-17%** |
| GLD | 500 to 1,500, then 3,000 | 350 to 1,500, then 3,000 | 300, then 6,000 |

**The shipping table proposes the reverse of that change on every single tier.** It cuts OPEN and
OVERNIGHT, which were just raised, and raises CLOSED, which was just cut. That is not a coincidence:
it is what you get when you re-derive a ladder from a window that mostly measures the config the
change replaced.

## 2. Why the 167h window cannot see it, tier by tier

The window is 2026-08-23 11:00Z to 2026-08-30 09:00Z. The change landed 113.7 hours in, so **68% of
the window is pre-change** (not the 80% the review states, though its point stands).

The composition matters more than the total, and it explains exactly which moves survive:

| tier | cash sessions / blocks in window | how many ran the live config |
|---|---|---|
| OPEN | 5, Mon 24 to Fri 28 | **1**, the Friday |
| OVERNIGHT | 5 nights | **1**, the Friday |
| CLOSED | the 23rd's tail plus the 28th-to-30th weekend | **most of it, and all of the volume** |

That is the whole diagnosis. Check it against the realised fees the brief calls "was":

| pool, tier | brief's "realised now" | live config | agree? |
|---|---|---|---|
| SPY closed | 250 | **250** | yes |
| SPY overnight | 350 | **350** | yes |
| NVDA closed | 300 | **300** | yes |
| META closed | 250 | **250** | yes |
| SPY open | 528 | **800** | no, a blend |
| META overnight | 361 | **750** | no, a blend |
| META open | 579 | **900** | no, a blend |
| NVDA overnight | 417 | **800** | no, a blend |

**The four tiers where realised equals config are exactly the four raises. The four that blend are
exactly the four cuts.** Ship the first group, hold the second. Same split the review reaches, on a
test that can be checked in one line rather than on judgement.

(SPY OPEN realised 673 on the Friday against an 800 floor because the analysis calls 09:00 to 16:00
ET "OPEN" while the contract opens at 09:30. The 13:00Z bucket is half overnight at 350 and it is the
highest-volume hour of the day. It reconciles at roughly 72% weight on 800.)

## 3. The corrected shipping table

### Ship: four raises, break-evens unchanged from what was pre-registered

Because realised equals config on these four, BASELINE section 3's numbers stand as written.

| move | live | to | ratio | share now | break-even share |
|---|---|---|---|---|---|
| SPY overnight | 350 | 450 | 1.29x | 9.08% | **7.06%** |
| SPY closed | 250 | 400 | 1.60x | 10.34% | **6.46%** |
| NVDA closed | 300 | 450 | 1.50x | 0.20% | **0.133%** |
| META closed | 250 | 450 | 1.80x | 12.81% | **7.12%** |

META's 7.12% replaces BASELINE's 12.95%, which was priced on an all-tier average that is no longer
what is shipping.

### Hold: four cuts, and each is worse than merely unevidenced

A cut has to grow share to pay for itself. The multiple is just the fee ratio:

| move | live | to | share now | share needed | multiple | the evidence |
|---|---|---|---|---|---|---|
| SPY open | 800 | 550 | 4.15% | 6.04% | 1.45x | **points the other way**: BASELINE section 4 measures $9.65/h at 800 against $6.01/h at 500 |
| NVDA overnight | 800 | 550 | 0.26% | 0.378% | 1.45x | **none exists**: 800 has run about 9 hours, too few to reach the elasticity table |
| META overnight | 750 | 500 | 12.63% | 18.95% | 1.50x | the curve slopes up, and it is confounded |
| META open | 900 | 500 | 24.97% | **44.95%** | 1.80x | as above, and 45% would be nearly half the entire on-chain META market |

The review says "roughly 45%" for all four. That is right for the two 800-to-550 moves and understates
META, which needs +50% and +80%.

**One caveat that partly rescues the META cut and should be said out loud.** These "share now" figures
were themselves earned mostly under the OLD config, so the break-even is measured off a share won at a
lower fee. It is not a clean bar. It does not change the call, because the only within-pool readings
available (SPY's dollars, META's upward slope) both argue against cutting, but nobody should quote
44.95% as if it were a measured threshold.

## 4. The bell: right catch, and it also applies to the ship list

`SessionLib.floorFor` computes the opening spike at resolution rather than storing it:

```
spike = fromClosed ? closedSpike : overnightFloor * spikeMult
```

Confirmed in source and confirmed twice on chain: NVDA ran `400 x 8 = 3,200` against `closedSpike
3,200`, then `800 x 5 = 4,000` against `closedSpike 4,000`. **The two were set equal in both
configs.** That is a deliberate invariant, held across a reconfiguration, and the review is right that
dropping overnight to 550 breaks it silently: the routine bell falls to 2,750 while Monday's stays at
4,000, so Monday opens would cost more than Tuesday opens, and the OPEN tier the brief says it is
holding takes a 31% cut. No integer `spikeMult` restores 4,000 from a 550 base (7 gives 3,850, 8 gives
4,400).

**What the review does not say, and it is the more dangerous half.** `setPoolConfig` takes the whole
struct in calldata, and a struct of `(1000, 800, 450, 0, 0, 0, 0, 0, 0)` **passes every branch of the
validator**. `descentWindow == 0` with `closedSpike == 0` is legal, and `closeFloor == 0` with both
windows zero is legal. So restating NVDA's struct for the CLOSED raise alone, with the six shape
fields left off, silently deletes the opening bell and the closing ramp, and reverts nothing.

The same hazard applies to TSLA if it is ever touched: `closeAfter 900` is easy to drop.

**Every `setPoolConfig` in this repo must be written out in full, all nine fields, and diffed against
`../deviation/data/live-ladder.json` before it is queued.**

## 5. The finding neither document contains: four of six pools have the bell switched off

Grepping this folder for `spikeMult`, `closedSpike`, `descentWindow` or `closeFloor` returns **zero
hits across every file**. The per-pool work treats the ladder as three flat numbers. It is a nine-field
shape, and the shape is set on two pools and unset on four.

| pool | TVL | opening bell | closing ramp |
|---|---|---|---|
| NVDA | $30,511 | routine 4,000, Monday 4,000, over 2h | 2,200 |
| TSLA | $2,260 | routine 4,000, Monday 4,000, over 2h | 1,600 |
| **SPY** | **$464,072** | **none** | **none** |
| META | $26,148 | **none** | **none** |
| AAPL | $4,259 | **none** | **none** |
| GLD | $34,391 | **none** | **none** |

The two pools that have it are the 8th and 9th largest on the book. **Our largest equity pool has no
protection in the single window `SessionLib`'s own comments call the most toxic the calendar knows
about in advance.** The deploy template `script/02_ConfigureRWAPool.s.sol` ships a bell by default
(`spikeMult 6`, `closedSpike 3500`, `descentWindow 1800`), so the four flat pools are a departure from
the template that no document in this repo records as a decision.

**And the bell is the one thing on this book that beats its field.** NVDA OPEN is the only tier of any
Fables pool earning above its market APR, at 1.19x. Its realised OPEN fee is 1,377 pips against an
`openFloor` of 700. Reconstructing it: 2h descending 3,200 to 700 (mean 1,950) then 4.5h at 700 gives
1,085 unweighted, and volume concentrates in the descent, which lifts it to the measured 1,377.
**Without the bell that tier realises roughly 700, which is 1.2x market instead of 2.36x, and the
1.19x APR ratio falls to somewhere near 0.6x.** The bell is doing effectively all of it.

**Proposed, and this needs a decision rather than a derivation.** Turn the bell on for SPY, using the
deploy template's shape against the shipping overnight floor:

```
SPY   spikeMult 6, closedSpike 3500, descentWindow 1800
      routine bell 450 x 6 = 2,700    Monday bell 3,500    decaying over 30 min
```

Sized against measurement: SPY's overnight-gap standard deviation is **0.563%**
(`../deviation/data/gap-information.json`), and the regression of the pool's open move on that gap has
slope **1.074, r-squared 0.896**, so the gap is real and it resolves at the open. A 2,700-pip bell
recovers about half a one-sigma gap from the flow that arrives to take it. This is the cheapest
untested lever on the board: one `setPoolConfig`, no keeper, no new capital, and a working precedent
in our own NVDA pool.

Two honest limits. NVDA's 1.19x sits on $30,511 of TVL and 0.15% share, so it is a thin observation.
And the bell has never been tested against its own absence on any pool.

## 6. GLD's closed floor: 3,000, not 1,500, and not until the keeper is live

The review says the deviation spec dropped this and it now has no owner. **That is not right.** It is
in `../deviation/SYSTEM-SPEC.md` twice: section 7.1 says the revert "should happen only once the
keeper is live", and open item 10 says moving it to 1,500 drops `pokeFloor` from 3,000 to 1,500 and
opens a 50% downward poke hole, so "do not ship it as written."

> **RETRACTED 2026-09-01. Do not cut it.** Measuring the weekend gold distribution shows a 6,000
> base already fails to cover the median weekend, and cutting to 3,000 widens the unprotected set
> from 47% to 64% of weekends. The real defect is the gap between the base's 0.60% no-arb band and
> the keeper's 2.00% kicker. See [VOLUME-CHECK-2026-09-01.md](VOLUME-CHECK-2026-09-01.md) section 11.

The original recommendation, kept for the record: **revert the closed tier to 3,000, not 1,500, and
only after the keeper is live.** At 3,000 all three tiers are equal, `pokeFloor` stays at 3,000, and the 50%
hole never opens. 1,500 was only ever an artefact of the pre-dislocation ladder.

Leaving 6,000 in the meantime is the right default, not a failure: it is the manual stand-in for a
deviation keeper that does not exist yet, and it is 1.52x GLD's market fee of 3,937 pips at a moment
when the pool is being arbitraged. The keeper's design is base 3,000 poked toward the 15,000 cap on
deviation, which is what 6,000 is approximating by hand.

## 7. Where the review is wrong

Four things, none of which changes its conclusion, all of which would be wrong in a document Yanis
acts on.

1. **"The rate history is per pool, only the recipient is hook-wide."** Backwards, and both halves are
   wrong. `claimFeeBps`, `claimFeeRecipient` and `_claimFeeHistory` are all single hook-wide variables
   (`FablesLedger.sol:115,116,134`). The per-key structure is `claimFeeSyncIndex[rangeId]`, which is
   **per LP position**, not per pool. It happens to behave per pool because all nine Fables pools sit
   on nine distinct hook deployments, verified: GLD `0xB608`, SPY `0xA0E8`, NVDA `0x6662`, META
   `0x8AF9`, TSLA `0x67D8`, AAPL `0x70a9`, ETH `0x06a8`, NVDA/SPY `0x7957`, SPY/GLD `0xA457`. That is
   a deployment fact, and it stops being true the day one hook serves two pools.
2. **"The recipient is one-way, once set it can never return to zero."** The opposite.
   `LedgerLib.claimFeeFor:209` reads `rate = claimFeeRecipient == address(0) ? 0 : claimFeeBps`, and
   `recordClaimFee:246` sets `effective = recipient == address(0) ? 0 : bps`. **Zeroing the recipient
   is the documented off switch.** What is one-way is `claimFeeAllTimeMin`, which ratchets DOWN and
   never up, so it can only ever undercharge. Getting this backwards makes a reversible parameter look
   like a permanent commitment.
3. **The 3,600s figure is not an execution delay.** `getTargetAdminDelay` is the delay on ADMIN
   operations against the target (`setTargetFunctionRole`, `setTargetClosed`), not on calling
   `setPoolConfig`. The gating delay is the per-account one in `hasRole(0, account)`. See section 8:
   it is **zero**, so no scheduling is needed. Everything else in that paragraph checks out: one
   AccessManager at `0xA362D98B33A7bb5B5E2180a05f995A70FB404f30`, `setPoolConfig` (selector
   `0xe8fe08b8`) bound to role 0 on all seven hooks, `isTargetClosed` false everywhere.
4. **68% pre-change, not 80%**, and **"roughly 45%"** holds for two of the four cuts, not four.

Its **$4,108 against $688** protocol-fee illustration does not reproduce from anything in this repo
(GLD's 167h fees are $7,482.77, so 10% is $748). The conclusion it supports does not depend on it.

**What the review got right and should be carried verbatim:** there is no v4 protocol fee anywhere in
Fables, `0x2bad...46cd` owns the fee controller and the PoolManager and appears nowhere in our
contracts (it is the chain deployer's), and the mechanism we actually have is
`FablesLedger.setClaimFee`, capped at 20% by `MAX_CLAIM_FEE_BPS = 2000` in bytecode and already wired
into `06_ConfigureProtocol.s.sol:125`. **That closes `SYSTEM-SPEC.md` section 6**, which is the only
place that spec says "unknown".

## 8. Who executes, resolved

The review left this open. `RoleGranted` on the AccessManager, cross-checked against live `hasRole`:

| role | holder | kind | execution delay |
|---|---|---|---|
| **0 (ADMIN)** | `0x359856655934338d798F9ccE1f181486301D36a5` | **EIP-7702 delegated EOA** to `0x5a7fc113...96f6d` (11,162 bytes) | **0** |
| 1 (poker) | `0xb9e8Db60...03D9`, `0x1B6a8808...d429` | EOA, EOA | 0, 0 |
| 2 | `0xb9e8Db60...03D9` | EOA | 3,600 |
| 4 | `0x5cDa43Da...721c` | EOA | 0 |
| 5, 6 | `0x359856655934338d798F9ccE1f181486301D36a5` | as above | 0 |

**One key can execute `setPoolConfig` on all seven hooks immediately, with no delay and no second
signature.** It is not a multisig; it is a single EOA carrying a 7702 delegation. That is the answer
to `SYSTEM-SPEC.md` section 5's question about whether an admin multisig gates any of this: today,
nothing does.

Operationally this is fine for shipping the three calls below. As a standing arrangement it is the
largest single point of failure on the book, and it should be written down somewhere that is not this
document.

## 9. What to execute

Three `setPoolConfig` calls, all nine fields written out, diffed against `live-ladder.json` first. The
only side effect is `pokeFloor` rising with the minimum floor (SPY 250 to 400, NVDA 300 to 450, META
250 to 450), which is harmless: the deviation keeper only ever pokes up.

```
SPY   0xA0E8fBFf13E24Af2b5e61A72800E08a161bDe080
      open 800   o/n 450   closed 400
      spikeMult 0   closedSpike 0   descentWindow 0
      closeFloor 0   closeBefore 0   closeAfter 0
      cap 8000
      (or, if the section 5 bell is taken: spikeMult 6, closedSpike 3500, descentWindow 1800)

NVDA  0x66622f77B797D506e5376F7798b67ab288966080
      open 1000   o/n 800   closed 450
      spikeMult 5   closedSpike 4000   descentWindow 7200
      closeFloor 2200   closeBefore 1800   closeAfter 0
      cap 8000

META  0x8AF95932eC4484fb10C641a4cBcf19a798cB2080
      open 900   o/n 750   closed 450
      spikeMult 0   closedSpike 0   descentWindow 0
      closeFloor 0   closeBefore 0   closeAfter 0
      cap 8000
```

Held pending a window that contains the current config: SPY open, NVDA overnight, META open, META
overnight. Re-measure with BASELINE section 6 once five cash sessions have run on the live ladder,
which is Friday 2026-09-04 at the earliest.

**Sequencing for the keeper, agreeing with the review.** Dry-run all seven pools now; nothing here
blocks that. Do not enable live poking on SPY, NVDA or META until the ladder window closes, because a
poke inside it contaminates the share test that is the whole pre-registered experiment. GLD goes first
regardless, since it is excluded from the ladder change and it is the pool the keeper exists for.

## 10. Still open

- Whether to turn the bell on for SPY and META, section 5. A decision, not a derivation.
- Whether the four cuts are wanted at all once a clean window exists, or whether the 28 August levels
  were right.
- Whether a single 7702-delegated EOA at zero delay is the intended custody of the fee ladder,
  section 8.
