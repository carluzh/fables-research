# NVDA/SPY (cross)

**State: baseline frozen 2026-08-30. No change shipping.** Cross-asset frozen state in
[BASELINE-2026-08-30.md](BASELINE-2026-08-30.md); method in [README.md](README.md).

Fees in pips: 100 pips = 1 bps. Pool id `0x988f3b6c...bd485f`, hook
`0x79576FBAD6e83915630BBB5D5658483F05532080`, dynamic fee, `protocolFee = 0` and `lpFeeOnChain = 0`
(`protofee.json`). The live tier read at 2026-08-30 10:09 UTC, a Sunday, was **300 pips**
(`now.json`), consistent with the closed rung. No cap or pokeFloor for this pool is recorded
anywhere under `fee-rerun-2026-08-30`, so none is quoted here.

Window: 167 hourly buckets, 2026-08-23 11:00 UTC through 2026-08-30 09:00 UTC inclusive
(`census.json`, fetched 10:47:35 UTC). Session days covered: **OPEN 5, OVERNIGHT 5, CLOSED 4**.
There is **no 48h chain scan for this pair**, so nothing below carries depth, k or utilisation.

---

## 1. This is a dust pool and the document says so first

$4,395 of TVL earning **$2.25 of fees in a week** on $5,767 of volume. That is **0.27% of the
$1,609,701 Fables book and 0.015% of the $15,061.85 the book earned in the window** (nine pools,
`census.json`). It is not in the shipping fee change and it should not be: no fee set on this pool
produces a number large enough to measure against anything.

It does hold one distinction. At **0.05x the field APR** it is the worst APR ratio of any Fables
pool, and its **closed row at 0.03x is the lowest single cell in the whole 36-row table**
(`universe7d.txt`).

---

## 2. The 167h field, by session

Every venue on chain quoting this pair, five cash sessions, four closed blocks. All MEASURED,
straight from `universe7d.txt`.

| session | hrs | venues | market vol | mkt fee | our fee | vs mkt | mkt APR | our APR | vs mkt | our share | our TVL share |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 167 | 3 | $4,031,108 | 620 | 390 | 0.63x | 49.8% | 2.7% | **0.05x** | 0.14% | 1.7% |
| OPEN | 35 | 3 | $1,374,465 | 619 | 495 | 0.80x | 80.8% | 5.3% | 0.07x | 0.14% | 1.7% |
| OVERNIGHT | 77 | 3 | $1,801,625 | 620 | 350 | 0.56x | 48.2% | 2.7% | 0.06x | 0.17% | 1.7% |
| CLOSED | 55 | 3 | $855,018 | 623 | 300 | 0.48x | 32.2% | 0.9% | **0.03x** | 0.10% | 1.7% |

Our own side of it, per session (`census.json`):

| tier | realised | hours with volume | our volume | our fees |
|---|---|---|---|---|
| OPEN | 495 | 32 of 35 | $1,894 | $0.94 |
| OVERNIGHT | 350 | 56 of 77 | $3,012 | $1.05 |
| CLOSED | 300 | 37 of 55 | $861 | $0.26 |

125 of 167 hours had any volume at all. The largest single hour of the week earned **$0.156**, 6.9%
of the week's fees, on $446 of volume; the top five hours are 23.6%.

The fee ran a flat calendar ladder with **zero within-session variation**: exactly 500 pips in 29
of the 32 open hours that traded, exactly 350 in all 56 overnight hours, exactly 300 in all 37
closed hours. The three odd open hours realised 466, 481 and 493 and are session-boundary buckets.
So fee is perfectly collinear with session here and **no elasticity is identifiable, even in
principle**.

---

## 3. The field is three venues and one of them is 96.5% of it

Per venue over the same 167 hours, from `census.json`:

| venue | fee | TVL | 167h volume | share | 167h fees | hrs with vol | lifetime tx | LP keep |
|---|---|---|---|---|---|---|---|---|
| v4 SPY/NVDA 625 | 625 static | $254,283 | $3,889,098 | **96.48%** | $2,430.69 | 167 of 167 | 47,667 | unread |
| v3 SPY/NVDA 500 | 500 static | $4,886 | $136,243 | 3.38% | $68.12 | 132 of 167 | 4,135 | unread |
| **Fables, dynamic** | 300 to 500 | **$4,395** | **$5,767** | **0.14%** | **$2.25** | 125 of 167 | 880 | **100%** |

**Read the ratios in section 2 knowing what they are.** The 620-pip "market fee" is the 625
incumbent's flat fee re-derived to within 5 pips, and the 49.8% "market APR" is 96.5% one venue's.
This is a single-rival comparison wearing a field label, which is the exact error the whole-field
method exists to prevent. It is unavoidable here: three venues is the entire on-chain market for
the pair.

Two further reasons the ratios are softer than they look:

- **The rivals' LP keep is unread.** `protofee.json` covers 50 of 138 census pools and neither
  rival is among them, so `universe7d.py`'s `lp_share()` defaults both to 100%. That is **99.86% of
  this field's APR numerator on a charged basis, not LP-net**, against our own verified
  `protocolFee = 0`. If the two rivals paid at the non-Fables field's volume-weighted keep of
  75.7%, the market APR falls from 49.8% to 37.7% and our ratio rises from 0.05x to 0.07x
  (INFERRED, the haircut is assumed not measured). Still the worst on the board.
- **The field definition is a lower bound on the alternative set.** `universe7d.py` scopes a cross
  to pools quoting the *same pair*, but a NVDA-for-SPY trader can route through USDG. Over the same
  167 hours the cheapest venue on each leg realised **9 pips** (`v4 USDG/NVDA` 0-fee dynamic,
  $1,670,249 of volume) and **75 pips** (`v4 SPY/USDG 75`, $716,038), so the two hops price at
  **84 pips against the cross field's 620** (INFERRED as a route: depth is unmeasured on both legs
  and the 9-pip NVDA venue is the one [NVDA-USDG.md](NVDA-USDG.md) flags at an implausible
  k = 2,019). Against that route we are not 0.63x of market, we are 4.6x it.

---

## 4. What the numbers say

**Price is not what is holding this pool back, and the field contains the control that proves it.**
`v3 SPY/NVDA 500` holds **$4,886 of TVL, 1.11x ours**, quotes a **flat 500 pips** which equals ours
in session and sits 43% to 67% above ours overnight and closed, and it did **$136,243 against our
$5,767**. That is **23.6x our volume on 1.11x our capital: 21.3x the volume per dollar of TVL, at
a price that is never below ours.** In the open session it takes 4.73% share against our 0.14%.

Same pair, same order of size, same chain, dearer fee, 24x the flow. A fee cut cannot buy what that
pool has and a fee raise is not what cost us it.

**Every APR here divides a week of fees by an end-of-window TVL snapshot**, the error README
section 4 forbids, and on this pool the exposure is the largest on the board: `now.json` records
our TVL up **+328.1% in the 24 hours** to 2026-08-30 10:09 UTC. On the implied pre-growth TVL of
about $1,027 the same $2.25 annualises to **11.5%** rather than 2.7% (INFERRED from a single 24h
change), which is 0.23x the field rather than 0.05x. The v3 comparison moves the same way and
survives it: on the pre-growth denominator that pool held 4.76x our TVL and still did **5.0x our
volume per dollar**. Neither rival's TVL change is measured at all; `now.json` holds no NVDA/SPY
rival.

The capital-to-flow conversion, volume share over TVL share, is **0.086x** on the snapshot, the
lowest of the nine Fables pools and marginally under ETH's 0.089x. Treat the ordering as unstable:
the snapshot denominator is the inflated one, and on the pre-growth TVL the same ratio is about
0.36x.

---

## 5. What is missing

- **No depth, no k, no utilisation, no per-swap fee.** No chain scan was run for this pair.
  `kall.json` samples k live for seven Fables pools and neither cross is in it, because `kmeas.mjs`
  derives virtual depth from the USDG-leg reserve and a cross has no USDG leg. So nothing in this
  baseline says whether our $4,395 quotes a wide range or a single tick, and that is precisely the
  measurement that would distinguish "not in the routing set" from "routable but too shallow to
  win a quote".
- **The scan is cheap and has not been spent.** The three venues carry **52,682 lifetime
  transactions between them**, against 206,361 SPY swaps in 48 hours alone. This is the cheapest
  field on the chain to scan.
- **Rival protocol fees.** Two reads would put this field's APR on the same LP-net basis as every
  other document.

---

## 6. Recommendation

1. **Leave the fee where it is.** Not because 390 is right, but because no fee on this pool is
   measurable. At $2.25 a week a 3x raise that lost no share moves annual revenue from about $118
   to $354 (INFERRED: assumes the week repeats and share holds), and both sit inside a single hour
   of noise on SPY. Changing it only adds a confound to the SPY, NVDA and META experiment that is
   actually running.
2. **Run the routing test, not a fee change.** Same open question as
   [NVDA-USDG.md](NVDA-USDG.md) section 5: is the hook pool in the router's set at all. Here it is
   sharper, because the v3 500 control removes price as the explanation. One test decides whether
   the $4,395 stays.
3. **If a scan budget exists, spend it here before spending it on anything else small.** 52,682
   lifetime transactions across the field buys depth and k for all three venues, and it is the only
   route to the one number this document is missing.
4. **Do not rank this pool.** State the field price, state ours, state that we are 0.14% of it.

---

## 7. What this does not settle

- **Sample size, and it is decisive.** The whole week is **$2.25 of fees over 125 trading hours**,
  largest hour $0.156. Nothing here supports a ranking, an elasticity, or a session conclusion.
  The three per-session fees are one level each, so fee and session are perfectly collinear and
  there is no elasticity to fit.
- **The benchmark is one rival.** 96.5% of the field volume and the 620-pip market fee are a single
  static-625 venue. Every ratio in section 2 is a comparison against it wearing a field label.
- **Every APR is on an end-of-window TVL denominator** that grew 328.1% in the window's last 24
  hours, and the rivals' denominators are unmonitored. The volume and share columns are unaffected.
- **The market APR is charged, not LP-net, for 99.86% of the field.** Two protocol-fee reads fix
  this; until then the 0.05x is a floor, not a level.
- **Whether the two-hop USDG route is real.** The cheapest legs price at 84 pips against a direct
  cross that clears at 620, yet 96.5% of the pair's flow pays 625 in one pool. Either the route is
  not available at size or that flow is not shopping. The data is consistent with both and settles
  neither.
- **The window sits inside the points programme**, live since 2026-08-24, accruing on fees, and per
  `REPRO-NOTES.md` open question 5 that is "the same day routing was approved", so volume from that
  date carries two effects at once and the share figures are not a steady state.
- **CLOSED covers 4 day-blocks, not 5.** Only OPEN and OVERNIGHT carry five.
