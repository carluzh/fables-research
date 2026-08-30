"""Every number in DEVIATION-FEE.md, in one script.

Inputs, all produced by the fetchers in this directory:
    ../data/now.json     gateway pool snapshot: TVL, hourly volume and fee buckets  (fetch-pools.mjs)
    ../data/prices.json  gateway hourly price history per pool                      (fetch-prices.mjs)
    ../data/paxg.json    Binance PAXG and XAUT hourly klines                        (fetch-paxg.mjs)
    ../bars/y_GLD_1h.json  Yahoo GLD ETF hourly bars                                (fetch-bars.mjs)

Each block prints the section of DEVIATION-FEE.md it backs. Run it and diff against the document.

WHAT THIS MODEL CANNOT DO, stated up front because one of its outputs was over-read once already.
It REPLAYS the actual historical volume path and reprices it. Volume is exogenous: the `cpmm`
response only adjusts how far one arbitrageur walks the pool, and against a 381% mispricing a 1.5%
fee barely changes that. So any comparison that charges more per unit of volume wins almost by
construction. In particular the symmetric-versus-asymmetric revenue ranking in section 7 is NOT
evidence about which is better. There is no trade diversion here, no cost for the residual
dislocation a higher repair fee leaves behind, and only one event, a 381% one, in which our pool is
21% cheaper than the next venue so the repair flow arrives whatever we charge. Answering the
asymmetry question properly needs an equilibrium model with venue choice, which this is not.
"""
import json, math, os, bisect, statistics as st, datetime as dt
from zoneinfo import ZoneInfo

ET = ZoneInfo('America/New_York')
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
BARS = os.path.join(HERE, '..', 'bars')
J = lambda n: json.load(open(os.path.join(DATA, n)))

# The dislocation window: from the Friday cash close, which is when the session floor drops to its
# closed tier, through the last hour in the snapshot.
EVENT_START = int(dt.datetime(2026, 8, 28, 16, 0, tzinfo=ET).timestamp())

# ---------------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------------
def at(keys, m, t):
    """last value at or before t"""
    i = bisect.bisect_right(keys, t) - 1
    return m[keys[i]] if i >= 0 else None


def hourfloor(t):
    return t - (t % 3600)


def yahoo(sym):
    with open(os.path.join(BARS, 'y_%s_1h.json' % sym)) as f:
        r = json.load(f)['chart']['result'][0]
    return sorted((int(t), c) for t, c in zip(r['timestamp'], r['indicators']['quote'][0]['close']) if c is not None)


def session_of(t):
    """The hook's own session tiers, from SessionLib / be2.py."""
    e = dt.datetime.fromtimestamp(t, ET)
    wd, h = e.weekday(), e.hour
    if (wd == 4 and h >= 16) or wd >= 5:
        return 'CLOSED'
    if wd == 0 and h < 9:
        return 'OVERNIGHT'
    if 9 <= h < 16:
        return 'OPEN'
    return 'OVERNIGHT'


def hr(t):
    return dt.datetime.fromtimestamp(t, ET).strftime('%a %m-%d %H:%M')


def head(n, title):
    print('\n' + '=' * 96)
    print('SECTION %s  %s' % (n, title))
    print('=' * 96)


# ---------------------------------------------------------------------------------------------
now = J('now.json')
prices = J('prices.json')
px = J('paxg.json')
rows = {r['key']: r for r in now['out']}

PAXG = {r['t']: r['c'] for r in px['PAXGUSDT']}
XAUT = {r['t']: r['c'] for r in px['XAUTUSDT']}
pk, xk = sorted(PAXG), sorted(XAUT)


def pool_series(label, dur='WEEK'):
    return {hourfloor(p['t']): p['usdPerAsset'] for p in prices[label]['series'][dur]}


POOL = pool_series('F-GLD')
RIV3 = pool_series('R-GLD-v3-3000')
RIV10 = pool_series('R-GLD-v3-10000')
GLDE = yahoo('GLD')

# =============================================================================================
head('5', 'THE REFERENCE: the PAXG basis and how tight it holds')
# =============================================================================================
rat = [(t, c / at(pk, PAXG, t)) for t, c in GLDE if at(pk, PAXG, t) and t >= pk[0]]
vals = [r for _, r in rat]
RATIO = st.median(vals)
adev = sorted(abs(v / RATIO - 1) for v in vals)
qq = lambda a, p: a[min(len(a) - 1, int(len(a) * p))]
print('GLD ETF close / PAXG, overlapping hours only, n=%d over %s .. %s'
      % (len(vals), dt.date.fromtimestamp(rat[0][0]), dt.date.fromtimestamp(rat[-1][0])))
print('  mean %.6f   median %.6f   sd %.6f (%.3f%% of mean)'
      % (st.mean(vals), RATIO, st.pstdev(vals), 100 * st.pstdev(vals) / st.mean(vals)))
print('  |basis error| vs the median:  median %.2f%%   p90 %.2f%%   p99 %.2f%%   max %.2f%%'
      % (100 * qq(adev, .5), 100 * qq(adev, .90), 100 * qq(adev, .99), 100 * adev[-1]))
print('  RATIO to use: %.6f   PAXG vs XAUT right now: %.3f%% apart (independent cross-check)'
      % (RATIO, 100 * (PAXG[pk[-1]] / XAUT[xk[-1]] - 1)))
sat = [r for r in px['PAXGUSDT'] if dt.datetime.fromtimestamp(r['t'], dt.timezone.utc).weekday() == 5]
print('  PAXG Saturday coverage: %d hourly bars over the pulled window, median volume %.0f PAXG'
      % (len(sat), st.median([r['v'] for r in sat])))

# =============================================================================================
head('4', 'THE EVENT: the pool against a reference that never went dark')
# =============================================================================================
gb = {hourfloor(b['t']): b for b in rows['F-GLD']['buckets']}
EV = []
for t in sorted(set(POOL) | set(gb)):
    if t < EVENT_START:
        continue
    p = POOL.get(t)
    b = gb.get(t)
    if p is None or b is None or b['v'] <= 0:
        continue
    g = at(pk, PAXG, t)
    ref = RATIO * g if g else None
    EV.append({'t': t, 'pool': p, 'riv3': RIV3.get(t), 'riv10': RIV10.get(t), 'paxg': g, 'ref': ref,
               'dev': (p / ref - 1) if ref else None, 'v': b['v'], 'f': b['f'],
               'feePips': 1e6 * b['f'] / b['v']})
ACT_V = sum(r['v'] for r in EV)
ACT_F = sum(r['f'] for r in EV)
print('window %s to %s, %d hours with volume' % (hr(EV[0]['t']), hr(EV[-1]['t']), len(EV)))
print('  volume $%s   fees $%s   realised %.0f pips   peak deviation %+.0f%%'
      % (format(ACT_V, ',.0f'), format(ACT_F, ',.0f'), 1e6 * ACT_F / ACT_V, 100 * max(abs(r['dev']) for r in EV)))
lo = [r for r in EV if r['feePips'] <= 400]
print('  of that, at the 300-pip closed floor: $%s of volume earning $%s'
      % (format(sum(r['v'] for r in lo), ',.0f'), format(sum(r['f'] for r in lo), ',.0f')))
print('  churn: %.0fx the $%s pool' % (ACT_V / rows['F-GLD']['tvlUsd'], format(rows['F-GLD']['tvlUsd'], ',.0f')))
print('\n  %-18s %10s %11s %10s %9s %13s %8s' % ('hour (ET)', 'PAXG $', 'implied GLD', 'pool $', 'dev %', 'volume $', 'fee pip'))
for r in EV[::3]:
    print('  %-18s %10.2f %11.2f %10.2f %+9.1f %13s %8.0f'
          % (hr(r['t']), r['paxg'], r['ref'], r['pool'], 100 * r['dev'], format(r['v'], ',.0f'), r['feePips']))
print('  PAXG moved %+.2f%% across the whole event. The pool moved %+.0f%%.'
      % (100 * (EV[-1]['paxg'] / EV[0]['paxg'] - 1), 100 * (EV[-1]['pool'] / EV[0]['pool'] - 1)))
xv = [abs(r['pool'] / r['riv3'] - 1) for r in EV if r['riv3']]
print('\n  cross-venue |Fables / rival-3000 - 1|: median %.2f%%  p90 %.2f%%  max %.2f%%'
      % (100 * qq(sorted(xv), .5), 100 * qq(sorted(xv), .90), 100 * max(xv)))
print('  every GLD venue on the chain moved together, so a purely on-chain cross-venue trigger')
print('  would never have fired. An external reference is not optional.')

# =============================================================================================
# the policy
# =============================================================================================
EPS = math.log(3.64) / math.log(20.0)   # fitted below, section 8.1


def vol_cpmm(v, f_new, f_old, d):
    """Volume needed to walk the pool from mispricing d down to the fee band, relative to the
    volume needed to walk it to the fee actually charged. The physically grounded model."""
    a = math.sqrt(1 + d) - math.sqrt(1 + f_new / 1e6)
    b = math.sqrt(1 + d) - math.sqrt(1 + f_old / 1e6)
    return v * max(0.0, a / b) if b > 0 else 0.0


def vol_emp(v, f_new, f_old, d):
    """V ~ f^-EPS, fitted from the one natural experiment in the data. Deliberately pessimistic."""
    return v * (f_new / max(f_old, 1.0)) ** (-EPS)


def base_of(t, open_pips, closed_pips):
    return closed_pips if session_of(t) == 'CLOSED' else open_pips


def ramp(d, kick, full, base, cap):
    if d <= kick:
        return base
    if d >= full:
        return cap
    return base + (cap - base) * (d - kick) / (full - kick)


def score(open_pips=3000, closed_pips=1500, kick=.02, full=.10, cap=15000, inbound_share=0.33, lag=1):
    """Returns fees under both volume models, plus the leg averages and when it first bites."""
    tc = te = 0.0
    prev = None
    first = None
    outs, ins = [], []
    for i, r in enumerate(EV):
        d = abs(r['dev'])
        leg = 'out' if (prev is None or d >= prev) else 'in'
        prev = d
        j = max(0, i - lag)
        dsig = abs(EV[j]['dev'])
        base = base_of(r['t'], open_pips, closed_pips)
        hi = ramp(dsig, kick, full, base, cap)
        f = hi if leg == 'out' else base + (hi - base) * inbound_share
        if first is None and f > base + 1:
            first = r['t']
        (outs if leg == 'out' else ins).append(f)
        tc += vol_cpmm(r['v'], f, r['feePips'], d) * f / 1e6
        te += vol_emp(r['v'], f, r['feePips'], d) * f / 1e6
    return {'cpmm': tc, 'emp': te, 'first': hr(first) if first else 'never',
            'avg_out': sum(outs) / len(outs) if outs else 0, 'avg_in': sum(ins) / len(ins) if ins else 0}


# =============================================================================================
head('8.1', 'THE VOLUME RESPONSE: the one natural experiment we have')
# =============================================================================================
before = [r for r in EV if r['feePips'] <= 400]
after = [r for r in EV if r['feePips'] > 400]
vb = sum(r['v'] for r in before) / len(before)
va = sum(r['v'] for r in after) / len(after)
print('  at 300 pips : %2d hours, $%s/hour' % (len(before), format(vb, ',.0f')))
print('  at 6000 pips: %2d hours, $%s/hour' % (len(after), format(va, ',.0f')))
print('  fee went up %.0fx, hourly volume fell %.2fx  ->  V ~ f^-%.3f' % (6000 / 300, vb / va, EPS))
print('  This over-states the elasticity, because the event was also decaying while the fee rose,')
print('  so treat the "emp" column below as a floor and "cpmm" as the physical estimate.')

# =============================================================================================
head('6.3', 'THE CAP: what the incumbents on this chain charge')
# =============================================================================================
print('  %-24s %10s %14s %10s' % ('pool', 'fee pips', 'TVL $', 'as %'))
for k in ['R-GLD-v3-3000', 'R-GLD-v3-10000', 'R-SPY-v4-625', 'R-SPY-v4-3499', 'R-NVDA-v3-500', 'R-NVDA-v4-3499', 'R-ETH-v4-577', 'R-ETH-v3-100']:
    r = rows[k]
    print('  %-24s %10s %14s %9.2f%%' % (k, int(r['feeTier']), format(r['tvlUsd'], ',.0f'), r['feeTier'] / 10000))
print('\n  fees earned over the event at each candidate cap (kick 2%, full 10%, inbound 33%):')
print('  %-14s %12s %12s' % ('cap', 'cpmm', 'emp'))
for cap in [3000, 6000, 8000, 10000, 15000, 20000]:
    s = score(cap=cap)
    print('  %-14s %12s %12s' % ('%d (%.2f%%)' % (cap, cap / 10000), format(s['cpmm'], ',.0f'), format(s['emp'], ',.0f')))

# =============================================================================================
head('7', 'THE ASYMMETRY: what the corrective leg should pay')
# =============================================================================================
prev = None
ov = iv = 0.0
oh = ih = 0
for r in EV:
    d = abs(r['dev'])
    leg = 'out' if (prev is None or d >= prev) else 'in'
    prev = d
    if leg == 'out':
        ov += r['v']; oh += 1
    else:
        iv += r['v']; ih += 1
print('  outbound (|deviation| grew): %2d hours, $%s, %.0f%% of the event' % (oh, format(ov, ',.0f'), 100 * ov / (ov + iv)))
print('  inbound  (|deviation| fell): %2d hours, $%s, %.0f%% of the event' % (ih, format(iv, ',.0f'), 100 * iv / (ov + iv)))
print('\n  %-26s %12s %12s %10s %10s %13s' % ('inbound share of the ramp', 'cpmm', 'emp', 'avg out', 'avg in', 'avg round trip'))
for sh, lbl in [(0.0, '0% (base only)'), (0.33, '33%'), (0.5, '50%'), (1.0, '100% (symmetric)')]:
    s = score(inbound_share=sh)
    print('  %-26s %12s %12s %9.0f %10.0f %12.2f%%'
          % (lbl, format(s['cpmm'], ',.0f'), format(s['emp'], ',.0f'), s['avg_out'], s['avg_in'], (s['avg_out'] + s['avg_in']) / 1e4))
print('\n  A round trip at full ramp costs the churner out + in:')
for sh, lbl in [(0.0, '0%'), (0.33, '33%'), (1.0, '100%')]:
    print('    inbound %-5s -> %.2f%% + %.2f%% = %.2f%%' % (lbl, 1.5, 1.5 * sh + 0.15 * (1 - sh), 1.5 + 1.5 * sh + 0.15 * (1 - sh)))

# =============================================================================================
head('8.2', 'SCORING the schedule and its neighbours')
# =============================================================================================
print('  %-58s %12s %12s %16s' % ('schedule', 'cpmm', 'emp', 'first raise'))
print('  %-58s %12s %12s %16s' % ('what actually happened', format(ACT_F, ',.0f'), format(ACT_F, ',.0f'), 'Sat 08-29 15:00'))
CANDS = [
    ('flat 0.30/0.15, no trigger', dict(kick=9.9, full=9.9)),
    ('THE SCHEDULE: 0.30/0.15, kick 2%, full 10%, cap 1.50%, in 33%', dict()),
    ('  same, inbound 0% (pure asymmetric)', dict(inbound_share=0.0)),
    ('  same, inbound 100% (symmetric)', dict(inbound_share=1.0)),
    ('  same, closed base 0.30% instead of 0.15%', dict(closed_pips=3000)),
    ('  same, cap 1.00%', dict(cap=10000)),
    ('  same, kick 1%', dict(kick=.01)),
    ('  same, kick 5%', dict(kick=.05)),
    ('  same, full 5%', dict(full=.05)),
    ('  same, full 20%', dict(full=.20)),
]
for lbl, kw in CANDS:
    s = score(**kw)
    print('  %-58s %12s %12s %16s' % (lbl, format(s['cpmm'], ',.0f'), format(s['emp'], ',.0f'), s['first']))
print('\n  keeper lag (hours between the deviation and the poke that prices it):')
for lag in [0, 1, 2, 4, 8]:
    s = score(lag=lag)
    print('    %2dh  cpmm $%-12s emp $%-12s first raise %s' % (lag, format(s['cpmm'], ',.0f'), format(s['emp'], ',.0f'), s['first']))

# =============================================================================================
head('9', 'THE TREASURY CUT via the claim fee that already exists')
# =============================================================================================
s = score()
print('  FablesLedger.claimFeeBps is a share of fees COLLECTED (max 2000 = 20%), routed to')
print('  FablesTreasurySplitter. It scales with the premium by construction.\n')
print('  %-16s %18s %18s %18s' % ('claimFeeBps', 'treasury (cpmm)', 'treasury (emp)', 'on what happened'))
for bps in [500, 1000, 1500, 2000]:
    print('  %-16s %18s %18s %18s'
          % ('%d (%d%%)' % (bps, bps // 100), format(s['cpmm'] * bps / 1e4, ',.0f'),
             format(s['emp'] * bps / 1e4, ',.0f'), format(ACT_F * bps / 1e4, ',.0f')))

# =============================================================================================
head('8.3', 'THE FEE PATH the schedule would have set, hour by hour')
# =============================================================================================
print('  %-18s %10s %9s %6s %9s %9s %13s' % ('hour (ET)', 'pool $', 'dev %', 'leg', 'actual', 'policy', 'volume $'))
prev = None
for i, r in enumerate(EV):
    d = abs(r['dev'])
    leg = 'out' if (prev is None or d >= prev) else 'in'
    prev = d
    dsig = abs(EV[max(0, i - 1)]['dev'])
    base = base_of(r['t'], 3000, 1500)
    hi = ramp(dsig, .02, .10, base, 15000)
    f = hi if leg == 'out' else base + (hi - base) * 0.33
    print('  %-18s %10.2f %+9.1f %6s %9.0f %9.0f %13s' % (hr(r['t']), r['pool'], 100 * d, leg, r['feePips'], f, format(r['v'], ',.0f')))

json.dump({'ratio': RATIO, 'event': EV, 'actual': {'volume': ACT_V, 'fees': ACT_F}},
          open(os.path.join(DATA, 'panel.json'), 'w'))
print('\nwrote data/panel.json')
