"""Per-asset gap distribution: how far does a reference market move while it is shut?

This is what sets the trigger band for any pool whose reference is NOT continuously observable.
A gap is any step between consecutive 1h bars longer than 70 minutes; weekend gaps are those longer
than 36 hours, everything else is a session break (the daily 17:00 to 18:00 ET futures halt, or the
overnight equity close).

Run `node fetch-bars.mjs` first. Reproduces DEVIATION-FEE.md section 6.1.
"""
import json, math, os, statistics as st

HERE = os.path.dirname(os.path.abspath(__file__))
BARS = os.path.join(HERE, '..', 'bars')

ASSETS = ['SPY', 'NVDA', 'META', 'AAPL', 'TSLA', 'GLD', 'ES_F', 'GC_F']


def bars(sym):
    with open(os.path.join(BARS, 'y_%s_1h.json' % sym)) as f:
        r = json.load(f)['chart']['result'][0]
    return sorted((int(t), c) for t, c in zip(r['timestamp'], r['indicators']['quote'][0]['close']) if c is not None)


def q(a, p):
    return a[min(len(a) - 1, int(len(a) * p))] if a else float('nan')


print('PER-ASSET GAP DISTRIBUTION, 730d of 1h bars.')
print('A gap is a step over 70 minutes; a weekend gap is a step over 36 hours.\n')
print('%-7s %7s %8s %8s %8s %8s   %7s %8s %8s %8s'
      % ('asset', 'n_wknd', 'median', 'p90', 'p99', 'MAX', 'n_break', 'p90', 'p99', 'MAX'))
out = {}
for s in ASSETS:
    b = bars(s)
    wk, br = [], []
    for i in range(1, len(b)):
        t0, c0 = b[i - 1]
        t1, c1 = b[i]
        d = t1 - t0
        if d <= 4200:
            continue
        r = abs(math.log(c1 / c0))
        (wk if d > 36 * 3600 else br).append(r)
    wk.sort()
    br.sort()
    out[s] = {
        'weekend': {'n': len(wk), 'median': st.median(wk), 'p90': q(wk, .90), 'p99': q(wk, .99), 'max': wk[-1]},
        'break': {'n': len(br), 'median': st.median(br), 'p90': q(br, .90), 'p99': q(br, .99), 'max': br[-1]},
    }
    print('%-7s %7d %7.2f%% %7.2f%% %7.2f%% %7.2f%%   %7d %7.2f%% %7.2f%% %7.2f%%'
          % (s, len(wk), 100 * st.median(wk), 100 * q(wk, .90), 100 * q(wk, .99), 100 * wk[-1],
             len(br), 100 * q(br, .90), 100 * q(br, .99), 100 * br[-1]))

with open(os.path.join(HERE, '..', 'data', 'gaps.json'), 'w') as f:
    json.dump(out, f, indent=1)
print('\nwrote data/gaps.json')
print('\nRead this as: for a pool whose reference is only observable during market hours, the trigger')
print('band must clear that asset\'s weekend p99, and the full-cap point must clear its max, or the')
print('keeper will tax an honest gap. A pool with a CONTINUOUS reference (see model.py, the PAXG')
print('basis for GLD) is not bound by this table at all and can run an order of magnitude tighter.')
