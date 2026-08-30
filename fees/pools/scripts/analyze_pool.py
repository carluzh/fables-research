# Generalised analyser for a pool_series.mjs output. Prints the 48h totals, the session split,
# utilisation, the fee-vs-share relationship and the time-weighted APR, all LP-net.
#
#   python analyze_pool.py data/<asset>_series.json
import json, sys, datetime as dt, statistics as st
from zoneinfo import ZoneInfo

import os as _os
_D = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'data')
_open = open
def open(f, *a, **k):
    if isinstance(f, str) and f.startswith('data/'):
        f = _os.path.join(_D, f[5:])
    return _open(f, *a, **k)

ET = ZoneInfo('America/New_York')
S = json.load(open(sys.argv[1]))
series = S['series']
C = json.load(open('data/census.json'))
BY = {p['id'].lower(): p for p in C['out']}
try:
    PF = {r['id'].lower(): r for r in json.load(open('data/protofee.json'))}
except Exception:
    PF = {}

POOLS = list(series.keys())
hours = sorted({r['h'] for k in POOLS for r in series[k]['rows']})
HRS = hours[-48:]


def pid_of(k):
    m = series[k]['meta']
    return (m.get('id') or m.get('addr') or '').lower()


def tvl_of(k):
    m = series[k]['meta']
    if m.get('tvl'):
        return float(m['tvl'])
    return (BY.get(pid_of(k)) or {}).get('tvlUsd') or 0.0


def lp_share(k, pips):
    r = PF.get(pid_of(k))
    if not r or not r.get('protocolFeeRaw'):
        return 1.0
    raw = r['protocolFeeRaw']
    if r.get('proto') == 'v3':
        n = raw & 0xF
        return (1 - 1 / n) if n else 1.0
    p0 = raw & 0xFFF
    return max(0.0, 1 - p0 / pips) if pips else 1.0


def sess(h):
    t = dt.datetime.fromtimestamp(h, ET)
    if t.weekday() >= 5 or (t.weekday() == 4 and t.hour >= 16):
        return 'CLOSED'
    if t.weekday() == 0 and t.hour < 9:
        return 'OVERNIGHT'
    return 'OPEN' if 9 <= t.hour < 16 else 'OVERNIGHT'


comp = {}
for h in HRS:
    comp[sess(h)] = comp.get(sess(h), 0) + 1
ASSET = S.get('asset') or sys.argv[1].split('/')[-1].split('_')[0].upper()
print(f'{ASSET}  chain scan, head block {S["headBlock"]} at {dt.datetime.fromtimestamp(S["headTs"], dt.timezone.utc).isoformat()}')
print(f'{len(HRS)} hours: ' + ', '.join(f'{k} {v}' for k, v in sorted(comp.items())) + f'   ({len({dt.datetime.fromtimestamp(h, ET).date() for h in HRS if sess(h) == "OPEN"})} cash session day(s))')
print('Fees in PIPS. All APR figures are LP-NET, after the protocol fee each venue pays.')
print()

rows = []
tot_v = 0
for k in POOLS:
    rs = [r for r in series[k]['rows'] if r['h'] in HRS]
    v = sum(r['vol'] for r in rs)
    tot_v += v
for k in POOLS:
    rs = [r for r in series[k]['rows'] if r['h'] in HRS]
    v = sum(r['vol'] for r in rs)
    f = sum(r['fee'] for r in rs)
    sw = sum(r['swaps'] for r in rs)
    vi = [r['virtual'] for r in rs if r['virtual']]
    virt = st.median(vi) if vi else 0.0
    virt_end = st.mean([r['virtual'] for r in rs[-6:] if r['virtual']] or [virt or 1])
    tvl = tvl_of(k)
    pips = (1e6 * f / v) if v else 0.0
    sh = lp_share(k, pips)
    fn = f * sh
    tw = st.mean([tvl * r['virtual'] / virt_end for r in rs if r['virtual']] or [tvl]) if virt_end else tvl
    rows.append({
        'k': k, 'swaps': sw, 'v': v, 'f': f, 'fn': fn, 'pips': pips, 'share': (v / tot_v if tot_v else 0),
        'virt': virt, 'tvl': tvl, 'tw': tw, 'util': (v / virt if virt else 0),
        'aprVirt': (fn * (8760 / len(HRS)) / virt * 100) if virt else float('nan'),
        'aprFlat': (fn * (8760 / len(HRS)) / tvl * 100) if tvl else float('nan'),
        'aprTW': (fn * (8760 / len(HRS)) / tw * 100) if tw else float('nan'),
        'mliq': series[k]['meta'].get('drift', {}).get('events', 0),
    })

print('48h TOTALS')
print(f'{"pool":22}{"swaps":>8}{"vol$":>15}{"fees$":>11}{"LPnet$":>10}{"pips":>8}{"share%":>8}{"virt$":>14}{"TVL$":>12}{"util":>8}{"aprTW%":>9}{"aprFlat%":>10}')
for r in sorted(rows, key=lambda r: -r['v']):
    mark = '>>' if 'FABLES' in r['k'] else '  '
    print(f'{mark}{r["k"]:20}{r["swaps"]:>8,}{r["v"]:>15,.0f}{r["f"]:>11,.2f}{r["fn"]:>10,.2f}{r["pips"]:>8,.0f}'
          f'{100*r["share"]:>7.1f}%{r["virt"]:>14,.0f}{r["tvl"]:>12,.0f}{r["util"]:>8.3f}{r["aprTW"]:>9.1f}{r["aprFlat"]:>10.1f}')
print()

print('RANK over the 48h window, LP-net, among venues with more than $1,000 of volume')
for label, key, rev in [('APR on TVL, time-weighted', 'aprTW', True), ('APR on working capital', 'aprVirt', True),
                        ('cheapest for the trader', 'pips', False), ('flow share', 'share', True), ('utilisation', 'util', True)]:
    g = [r for r in rows if r['v'] > 1000 and r[key] == r[key]]
    g.sort(key=lambda r: r[key], reverse=rev)
    i = next((j for j, r in enumerate(g) if 'FABLES' in r['k']), None)
    print(f'  {label:28} Fables {("rank " + str(i+1) + "/" + str(len(g))) if i is not None else "n/a":>10}   leader: {g[0]["k"]} ({g[0][key]:,.2f})')
print()

print('BY SESSION')
for g in ['OPEN', 'OVERNIGHT', 'CLOSED']:
    hs = [h for h in HRS if sess(h) == g]
    if not hs:
        continue
    tot = sum(sum(r['vol'] for r in series[k]['rows'] if r['h'] in hs) for k in POOLS)
    print(f'=== {g} ({len(hs)} hours) ===  total {ASSET} volume ${tot:,.0f}')
    print(f'{"pool":22}{"vol$":>15}{"share%":>9}{"pips":>8}{"fees$":>11}{"virt$":>14}{"util":>9}{"aprVirt%":>10}')
    out = []
    for k in POOLS:
        rs = [r for r in series[k]['rows'] if r['h'] in hs]
        v = sum(r['vol'] for r in rs)
        f = sum(r['fee'] for r in rs)
        vi = [r['virtual'] for r in rs if r['virtual']]
        virt = st.median(vi) if vi else 0.0
        pips = (1e6 * f / v) if v else 0.0
        sh = lp_share(k, pips)
        out.append((k, v, f, pips, virt, (v / virt if virt else 0), (f * sh * (8760 / len(hs)) / virt * 100) if virt else float('nan')))
    for k, v, f, pips, virt, util, apr in sorted(out, key=lambda a: -a[1]):
        mark = '>>' if 'FABLES' in k else '  '
        print(f'{mark}{k:20}{v:>15,.0f}{(100*v/tot if tot else 0):>8.1f}%{pips:>8,.0f}{f:>11,.2f}{virt:>14,.0f}{util:>9.3f}{apr:>10.2f}')
    print()

fk = next((k for k in POOLS if 'FABLES' in k), None)
if fk:
    print('FABLES: WHAT WE CHARGE AGAINST WHAT WE WIN, hourly')
    buckets = {}
    pairs = []
    for r in series[fk]['rows']:
        if r['h'] not in HRS or not r['vol'] or not r['pips']:
            continue
        tot = sum((next((x for x in series[k]['rows'] if x['h'] == r['h']), {'vol': 0})['vol']) for k in POOLS)
        if not tot:
            continue
        pairs.append((r['pips'], r['vol'] / tot))
        key = int(round(r['pips'] / 100.0) * 100)
        buckets.setdefault(key, []).append({'share': r['vol'] / tot, 'v': r['vol'], 'f': r['fee']})
    print(f'{"charged pips":>14}{"hours":>7}{"our vol$":>14}{"mean share%":>13}{"our fees$":>11}{"fee x share":>13}')
    for kf in sorted(buckets):
        g = buckets[kf]
        ms = st.mean(x['share'] for x in g)
        print(f'{kf:>14}{len(g):>7}{sum(x["v"] for x in g):>14,.0f}{100*ms:>12.1f}%{sum(x["f"] for x in g):>11,.2f}{kf*100*ms:>13,.0f}')
    if len(pairs) > 3:
        xs = [p[0] for p in pairs]
        ys = [p[1] for p in pairs]
        mx, my = st.mean(xs), st.mean(ys)
        cov = sum((x - mx) * (y - my) for x, y in pairs) / len(pairs)
        sx, sy = st.pstdev(xs), st.pstdev(ys)
        if sx and sy:
            print(f'\ncorrelation fee charged vs share won, hourly, n={len(pairs)}: {cov/(sx*sy):+.3f}')
