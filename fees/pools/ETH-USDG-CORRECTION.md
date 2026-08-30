# ETH/USDG: the fee is not the problem, and two of the three headline numbers are wrong

**2026-08-30. Corrects [ETH-USDG.md](ETH-USDG.md) and the ETH rows of [OVERVIEW.md](OVERVIEW.md).**
Reproduce with `Research/Fables/fee-rerun-2026-08-30/`: `ethfield.py`, `eth-tvl-drift.mjs`,
`eth-depth.mjs`, `eth-elasticity.mjs`, `eth-markout3.mjs`.

The case against our ETH fee was three numbers: we charge **5.37x the market**, we hold **0.52% of
flow on 5.9% of TVL**, and we earn **0.62x the market APR**. The middle one holds. The other two do
not survive being checked, and the conclusion they supported (cut the fee) is contradicted by every
direct test.

**I proposed the cut and I was wrong.** What follows is why.

---

## 1. "5.37x the market" is one pool's price, not a clearing price

`ethfield.py`, rebuilt from the raw hourly buckets, restricted to ETH quoted against USDG, which is
the pair we actually quote.

| pair | proto | fee | 167h volume | share | pips | TVL | turnover/wk |
|---|---|---|---|---|---|---|---|
| WETH/USDG | v3 | 100 | $1,230,405,476 | **90.0%** | 100 | $7,689,005 | 160.0x |
| WETH/USDG | v3 | 500 | $54,165,355 | 4.0% | 500 | $2,817,463 | 19.2x |
| **ETH/USDG** | **v4** | **577** | **$41,351,644** | **3.0%** | **577** | **$2,605,672** | **15.9x** |
| WETH/USDG | v4 | 252 | $24,799,780 | 1.8% | 252 | $369,659 | 67.1x |
| **ETH/USDG** | **v4** | **dyn** | **$7,190,775** | **0.5%** | **773** | **$1,042,590** | **6.9x** |
| WETH/USDG | v3 | 3000 | $2,754,830 | 0.2% | 3,000 | $1,806,895 | 1.5x |
| ETH/USDG | v4 | 625 | $2,374,278 | 0.2% | 625 | $157,289 | 15.1x |
| WETH/USDG | v4 | dyn | $2,057,498 | 0.2% | **0** | $275,382 | 7.5x |
| WETH/USDG | v4 | 625 | $764,344 | 0.1% | 625 | $105,234 | 7.3x |
| WETH/USDG | v4 | dyn | $622,661 | 0.0% | **0** | $180,127 | 3.5x |

Fifteen venues, $1,367,282,549, volume-weighted **144 pips**, which reproduces the number in
OVERVIEW exactly. But the average is one venue:

| field definition | venues | volume | pips |
|---|---|---|---|
| all | 15 | $1,367,282,549 | **144** |
| excluding the v3 100 giant | 14 | $136,877,073 | **543** |
| v4 only | 10 | $79,657,862 | **478** |
| v4 only, excluding the zero-fee pools | 8 | $76,977,703 | **495** |

**Against the v4 field we charge 1.6x, not 5.4x.** The 5.37x is our price against a single
$7.7M v3 pool running 100 pips on 13.3M lifetime transactions, which no dynamic-fee v4 hook is going
to underprice and which nothing in our design was ever trying to.

## 2. "0.62x the market APR" is a TVL snapshot artefact, and ours is the worst-hit pool

OVERVIEW's own caveat 1 says every APR divides a week of fees by one end-of-window TVL read, and that
our ETH TVL moved +74.7% in the final 24 hours. It is much worse than that.

`eth-tvl-drift.mjs` recovers the missing series without an archive node: every v4 Swap carries
`liquidity` and `sqrtPriceX96`, so `virtual = 2 x L x sqrt(P)` is readable at every swap, and with
range placement roughly fixed it tracks TVL.

| day | our implied TVL | vs the snapshot | the 577 pool | vs its snapshot |
|---|---|---|---|---|
| 08-24 | **$56,825** | 0.05x | $1,135,907 | 0.44x |
| 08-25 | $94,658 | 0.09x | $1,160,211 | 0.45x |
| 08-26 | $257,643 | 0.25x | $1,247,628 | 0.48x |
| 08-27 | $416,905 | 0.40x | $1,085,626 | 0.42x |
| 08-28 | $359,006 | 0.34x | $1,266,034 | 0.49x |
| 08-29 | $766,797 | 0.74x | $1,946,715 | 0.75x |
| 08-30 | $1,042,590 | 1.00x | $2,605,672 | 1.00x |
| **window average** | **$427,775** | **0.41x** | **$1,492,542** | **0.57x** |

**Our ETH pool grew 18x during the measurement week.** The fees in the numerator were earned on an
average base of $428k, not the $1.04M in the denominator.

Independently corroborated: `REPRO-NOTES.md` recorded our ETH TVL going $282,628 to $1,040,994 over
three days, a 3.68x. The same three days here read $257,643 to $1,042,590, a 4.05x. Two unrelated
methods agree, so the reconstruction is sound.

| | reported | corrected | |
|---|---|---|---|
| our APR | 27.8% | **68.2%** | 2.45x understated |
| our turnover | 6.9x/wk | **16.8x/wk** | |
| the 577 pool's APR | 48.0% | **83.9%** | 1.75x understated |
| **us vs the closest comparable** | **0.58x** | **0.81x** | |

We are behind the best v4 pool on our own pair, but by 19%, not by 42%. **Every APR figure in
`pools/` carries this error and ours carries the largest dose of it.**

## 3. Three direct tests, and all three say price is not what moves flow here

### Two pools charge literally nothing and it buys them nothing

`v4 WETH/USDG dyn` realised **0.0 pips** on $2,057,498, and a second realised **0.0 pips** on
$622,661. We charged 773 pips and traded **$7,190,775**, which is 3.5x the larger free pool, on an
average TVL of $428k against their $275k snapshot. Even taking OVERVIEW's higher chain-scan reading
for those pools ($3.5M and $1.09M) we still traded 2.1x the bigger one.

**A pool giving liquidity away for free does not win this market.** No fee we can set is more
attractive than zero.

### Two pools charge the identical 625 pips and differ 2.1x

`v4 ETH/USDG 625` turns over 15.1x a week. `v4 WETH/USDG 625` turns over 7.3x. Same price, same
chain, same week. Price explains none of the spread between them.

### We already quote the same depth as the pool doing 5.75x our volume

`eth-depth.mjs`, six-hour median of `2 x L x sqrt(P)` at every swap, every v4 venue on the pair:

| venue | fee | median virtual depth | TVL | **k** | k vs ours | turnover/wk |
|---|---|---|---|---|---|---|
| **ours, v4 ETH/USDG dyn** | 773 | **$45,484,891** | $1,042,590 | **43.6** | 1.00x | 6.9x |
| v4 WETH/USDG 252 | 252 | $6,994,734 | $369,659 | 18.9 | 0.43x | **67.1x** |
| v4 ETH/USDG 577 | 577 | **$44,268,421** | $2,605,672 | 17.0 | 0.39x | 15.9x |
| v4 ETH/USDG 625 | 625 | $1,143,581 | $157,289 | 7.3 | 0.17x | 15.1x |
| v4 WETH/USDG 625 | 625 | $540,738 | $105,234 | 5.1 | 0.12x | 7.3x |
| v4 WETH/USDG 565 | 565 | $290,820 | $122,274 | 2.4 | 0.05x | 3.4x |

**We quote more absolute depth than the 577 pool and 2.6x more depth per dollar of capital, and it
trades 5.75x our volume.** The 625 pool quotes one fortieth of our depth and still does a third of
our volume.

**And we are the only venue that breaks the pattern.** Across the five rivals turnover tracks k
almost monotonically (18.9 to 67.1x, 17.0 to 15.9x, 7.3 to 15.1x, 5.1 to 7.3x, 2.4 to 3.4x): quote
more depth per dollar, win more flow per dollar, exactly as it should work. **We hold the highest k
in the field and the second-lowest turnover.** Every other pool converts depth into flow and ours
does not, which is the signature of a pool that is not being reached rather than one that is priced
or ranged wrong.

OVERVIEW's structural claim that "depth does not exist for ETH's field" holds only for a full scan.
k is a level, not a flow, and six hours of swaps settles it for every v4 venue on the pair.

## 4. What the revenue data actually says about cutting

`eth-elasticity.mjs`, 19,501 swaps over 7 days, 169 hourly buckets. Our USD volume per $1M of Binance
ETHUSDT volume is the share proxy, which strips market-wide activity.

| fee band | hrs | mean fee | **our $/hour** | share per $1M | ann vol |
|---|---|---|---|---|---|
| 0-500 | 67 | 456 | **$33.42** | $6,154 | 20.4% |
| 500-700 | 27 | 572 | **$20.25** | $1,953 | 36.0% |
| 700-1000 | 26 | 847 | $29.27 | $1,288 | 43.0% |
| 1000-1500 | 22 | 1,236 | $45.81 | $803 | 54.8% |
| 1500-3001 | 27 | 2,159 | **$73.46** | $444 | 84.8% |

**Revenue rises with the fee, monotonically, with exactly one dip.** Confounded, because the keeper
raises when volatility rises and volatility brings volume. So hold volatility roughly fixed:

| vol tercile | fee half | hrs | mean fee | **our $/hour** | implied revenue elasticity |
|---|---|---|---|---|---|
| low | cheap | 30 | 450 | **$31.76** | |
| low | dear | 26 | 538 | **$31.70** | **-0.01, a wash** |
| mid | cheap | 29 | 500 | **$26.56** | |
| mid | dear | 27 | 936 | **$25.98** | **-0.03, a wash** |
| high | cheap | 29 | 938 | $36.36 | |
| high | dear | 28 | 2,109 | **$79.83** | **+0.97, flow is inelastic** |

**In calm and mid markets the fee level is revenue-neutral. In volatile markets charging more is
close to free money.** There is no revenue case for a cut anywhere on this curve.

**The regression disagrees and it is the one to distrust.** `log(share)` on `log(fee)` with
`log(sigma)` as control gives an elasticity of **-1.478 (se 0.267, t = -5.53)**, and anything steeper
than -1.00 implies a cut wins revenue. It should be ignored, because the keeper computes
`fee = 40 x sigma^2`, so `log(fee)` and `log(sigma)` are collinear by construction and the control
cannot separate them. The tell is in the fit: adding sigma moves R-squared only 0.485 to 0.509 while
dragging the coefficient from -2.080 to -1.478, which is the signature of a control that is absorbing
the regressor rather than the confound. Measured dollars beat an inferred index here, which is the
same lesson `BASELINE-2026-08-30.md` correction 1 already learned on the RWA pools.

## 5. What this means for the keeper, with the markout beside it

`eth-markout3.mjs` measured per-swap adverse selection against Binance ETHUSDT over two 48h windows,
the never-run open item 1 of `../FEE-POSITION.md`. Adverse selection rises monotonically with the fee
the keeper charges, in both windows, every t-stat significant. **The signal works.**

Setting the two studies side by side, by the band the keeper was in:

| fee band | adverse selection, calm window | adverse selection, volatile window | our $/hour | verdict |
|---|---|---|---|---|
| 0-500 | 57 pips vs 450 charged, **7.9x covered** | 544 vs 450, 0.8x | $33.42 | profitable, and cutting it is a wash on revenue |
| **500-700** | **1,465 vs 582, 0.4x** | **777 vs 608, 0.8x** | **$20.25** | **loses money AND earns least** |
| 700-1000 | 1,173 vs 996, 0.8x | 930 vs 900, 1.0x | $29.27 | roughly break-even |
| 1000-1500 | | | $45.81 | |
| 1500-3001 | 2,018 vs 2,078, 1.0x | 2,776 vs 2,380, 0.9x | $73.46 | correctly priced |

**The 500-700 band is the only defect, and it is the only band that is bad on both measures at
once.** It under-collects against adverse selection in both windows and it is the worst revenue band
of the five despite sitting in the middle of the fee range. That is the signature of a keeper
arriving late: the market has already moved, we are still quoting the previous regime's price, and
the flow that shows up is the flow taking us at it.

### The mechanism, found in the keeper source

This is not a calibration problem. It is a hard reaction-speed threshold, and it sits in
`engine.py:125`:

```python
if desired > gate:                                    # poke_gate = 500
    delta = abs(desired - self.current_onchain_fee)
    if delta >= self.params.push_delta_immediate:     # 500 pips
        target = desired                              # push NOW
    elif elapsed >= self.params.heartbeat_s and delta >= self.params.push_delta_heartbeat:
        target = desired                              # heartbeat_s = 900s
```

The pool rests at `min_fee` 450. So an immediate push needs `|desired - 450| >= 500`, which means
**desired >= 950 pips**. Anything below that waits on the 15-minute heartbeat.

Running that through the keeper's own `fee_pips = 0.40 x sigma_pct^2`:

| desired fee | needs realised vol | what the keeper does |
|---|---|---|
| 450 | 33.5% | rests at the flat |
| 600 | 38.7% | **waits up to 15 minutes** |
| 700 | 41.8% | **waits up to 15 minutes** |
| **950** | **48.7%** | first fee that pushes instantly |
| 1,082 | 52.0% | instant |

**The keeper does not react in real time until realised volatility crosses roughly 49% annualised.**
Below that, every fee change in the entire 500 to 950 range is on a quarter-hour clock, and 500 to
950 is exactly the range where the markouts show us under-collecting.

It also explains why the two windows disagreed. Window A ran at **27.6%** and Window B at **52.0%**,
one either side of the 48.7% threshold. In B the keeper was firing immediately and priced correctly
in every band. In A it was on the heartbeat and the transition bands got picked off. That is not
regime-dependent calibration, which is how I first read it. It is one threshold, and my two windows
happened to straddle it.

**The edit: `push_delta_immediate` 500 to 150.** That drops the instant-reaction threshold from 48.7%
to 38.7% realised vol and covers the whole transition. Nothing else moves: `min_fee` stays 450,
`max_fee` stays 3,000, `C` stays 40, the ladder is untouched.

Pure LP protection with no revenue cost, because sections 3 and 4 establish that flow does not
respond to our price in either direction at these levels. **It is also small**: the 500-700 band was
27 of 169 hours and $955,611 of volume, under-collecting by 170 to 880 pips depending on the window,
so it is worth roughly $160 to $840 a week. Worth doing because it is one constant and it cannot cost
anything, not because it is large.

**Withdrawn:** the earlier suggestion to drop the keeper's `min_fee` from 450 toward the chain's
225 floor. In the calm window the 450 floor collects 8x its own adverse selection and cutting it is
revenue-neutral, so the cut gives up pure profit and buys nothing.

## 6. The real constraint, and it is not a fee parameter

Not price: free pools win nothing, identical prices differ 2.1x, revenue is flat to rising in the
fee. Not depth: we quote the same absolute depth as the pool doing 5.75x our volume, and a pool with
one fortieth of our depth does a third of it. Not capital: we hold 5.9% of the pair's TVL.

What is left is **router and aggregator inclusion**, which OVERVIEW open question 3 suspected and
nobody tested. It is now the only surviving explanation, and unlike the others it is directly
testable rather than inferable from share: request a quote for ETH to USDG on whatever aggregator
serves Robinhood Chain, at sizes spanning $1k to $500k, and see whether our pool appears in the route
at all.

**That test costs an afternoon and it decides whether any fee work on this pool is worth doing.**

## 7. What to change in the existing documents

- `ETH-USDG.md` and OVERVIEW section 2: "5.37x the market" needs the v4 field beside it (1.6x).
- Every APR in `pools/`: the snapshot denominator understates ours by 2.45x and the 577 pool's by
  1.75x. The fee, volume and share columns are unaffected.
- OVERVIEW's structural fact "depth does not exist for ETH's field": false. Six hours of swaps gives
  k for every v4 venue, and the numbers are in section 3.
- OVERVIEW open question 2 (per-window markouts) is now answered for ETH, section 5.
- OVERVIEW open question 8 (is k a choice) is answered for ETH: ours is the highest in the field and
  raising it further would not help.
