# CORRECTIONS PASS, 2026-08-30 evening. Recomputes every figure the dual review flagged, on a
# single consistent basis, and prints the corrected values for the documents.
#
# Fixes applied here:
#  1. The fee bucketing bug. analyze_pool.py used int(round(pips/100)*100) on a fee derived as
#     1e6*f/v, so a 250-pip tier lands at 249.99998 or 250.00001 and scatters into two buckets.
#     Bucket on the ROUNDED-TO-1-PIP realised fee instead, then group exactly.
#  2. Measured dollars per hour printed beside the inferred revenue index, because the two
#     disagree in sign.
#  3. NVDA field recomputed with and without the two venues that were dead for most of the window.
#  4. k on ONE basis for every pool: the window-median virtual over TVL.
#  5. The fee regime timeline per pool per day, because no pool held one config across the window.
import json, datetime as dt, statistics as st

import os as _os
_D = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'data')
_open = open
def open(f, *a, **k):
    if isinstance(f, str) and f.startswith('data/'):
        f = _os.path.join(_D, f[5:])
    return _open(f, *a, **k)

ET_OFF = None
from zoneinfo import ZoneInfo
ET = ZoneInfo('America/New_York')

C = json.load(open('data/census.json'))
PF = {r['id'].lower(): r for r in json.load(open('data/protofee.json'))}
FAB = {
    'SPY': '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd',
    'NVDA': '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd',
    'META': '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5',
    'GLD': '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a',
    'ETH': '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551',
}
DEAD_NVDA = {
    '0x3d4db2a47686c5d019bbb49b2be17851eae586b52891bb4e0562bcbfe99fbb38',
    '0x1bdf79cae9c6a83216a659974c9915e632bdd6916736bf29ea1d8211310048d2',
}
QUOTES = {'USDG', 'WETH', 'ETH'}
BY = {p['id'].lower(): p for p in C['out']}


def asset_of(p):
    non = [s for s in ((p.get('sym0') or '?'), (p.get('sym1') or '?')) if s not in QUOTES]
    return 'ETH' if not non else ('/'.join(sorted(non)) if len(non) == 2 else non[0])


def sess(h):
    t = dt.datetime.fromtimestamp(h, ET)
    if t.weekday() >= 5 or (t.weekday() == 4 and t.hour >= 16):
        return 'CLOSED'
    if t.weekday() == 0 and t.hour < 9:
        return 'OVERNIGHT'
    return 'OPEN' if 9 <= t.hour < 16 else 'OVERNIGHT'


def lp(p, pips):
    r = PF.get(p['id'].lower())
    if not r or not r.get('protocolFeeRaw'):
        return 1.0
    raw = r['protocolFeeRaw']
    if r.get('proto') == 'v3':
        n = raw & 0xF
        return (1 - 1 / n) if n else 1.0
    return max(0.0, 1 - (raw & 0xFFF) / pips) if pips else 1.0


LAST = max(b['t'] for p in C['out'] for b in p['buckets'] if p['buckets'])
HRS = sorted({b['t'] for p in C['out'] for b in p['buckets'] if LAST - 167 * 3600 <= b['t'] < LAST})

print('=' * 108)
print('1. NVDA FIELD, WITH AND WITHOUT THE TWO VENUES THAT WERE DEAD FOR MOST OF THE WINDOW')
print('   (0x3d4db2a4 last traded 2026-08-27T12:00Z, 0x1bdf79ca last traded 2026-08-25T15:00Z)')
pools = [p for p in C['out'] if asset_of(p) == 'NVDA' and p['buckets']]
fab = BY[FAB['NVDA']]
print(f'{"session":11}{"mktFee":>9}{"exDead":>9}{"ours":>8}{"xIncl":>7}{"xExcl":>7}{"mktAPR":>9}{"exAPR":>9}{"ourAPR":>9}{"xIncl":>7}{"xExcl":>7}')
for g in ['ALL', 'OPEN', 'OVERNIGHT', 'CLOSED']:
    hs = HRS if g == 'ALL' else [h for h in HRS if sess(h) == g]
    n = len(hs)
    tv = tf = tfn = ttvl = xv = xf = xfn = xtvl = ov = of = 0
    for p in pools:
        bs = [b for b in p['buckets'] if b['t'] in hs]
        v = sum(b['v'] for b in bs)
        f = sum(b['f'] for b in bs)
        pips = (1e6 * f / v) if v else 0
        tv += v; tf += f; tfn += f * lp(p, pips); ttvl += p['tvlUsd'] or 0
        if p['id'] not in DEAD_NVDA:
            xv += v; xf += f; xfn += f * lp(p, pips); xtvl += p['tvlUsd'] or 0
        if p['id'] == fab['id']:
            ov, of = v, f
    mf = 1e6 * tf / tv if tv else 0
    xm = 1e6 * xf / xv if xv else 0
    om = 1e6 * of / ov if ov else 0
    ma = tfn * (8760 / n) / ttvl * 100 if ttvl else 0
    xa = xfn * (8760 / n) / xtvl * 100 if xtvl else 0
    oa = of * lp(fab, om) * (8760 / n) / (fab['tvlUsd'] or 1) * 100
    print(f'{g:11}{mf:>9,.0f}{xm:>9,.0f}{om:>8,.0f}{(om/mf if mf else 0):>7.2f}{(om/xm if xm else 0):>7.2f}'
          f'{ma:>9,.1f}{xa:>9,.1f}{oa:>9,.1f}{(oa/ma if ma else 0):>7.2f}{(oa/xa if xa else 0):>7.2f}')

print()
print('=' * 108)
print('2. THE FEE REGIME TIMELINE. No pool held one config across the window, so "realised now" blends configs.')
print('   Realised pips per ET day per session, from census.json.')
for a in ['SPY', 'NVDA', 'META', 'GLD', 'ETH']:
    p = BY[FAB[a]]
    print(f'  {a}')
    days = sorted({dt.datetime.fromtimestamp(b['t'], ET).date() for b in p['buckets'] if b['t'] in HRS})
    hdr = '    ' + 'session'.ljust(11) + ''.join(f'{str(d)[5:]:>9}' for d in days)
    print(hdr)
    for g in ['OPEN', 'OVERNIGHT', 'CLOSED']:
        row = '    ' + g.ljust(11)
        for d in days:
            bs = [b for b in p['buckets'] if b['t'] in HRS and sess(b['t']) == g
                  and dt.datetime.fromtimestamp(b['t'], ET).date() == d and b['v'] > 0]
            v = sum(b['v'] for b in bs); f = sum(b['f'] for b in bs)
            row += f'{(1e6*f/v):>9,.0f}' if v else f'{"-":>9}'
        print(row)

print()
print('=' * 108)
print('3. ELASTICITY, BUCKETING BUG FIXED, WITH MEASURED DOLLARS BESIDE THE INFERRED INDEX')
print('   Bucket key is the realised fee rounded to 1 pip, so one tier is one row.')
for a in ['SPY', 'NVDA', 'META', 'GLD']:
    p = BY[FAB[a]]
    field = [q for q in C['out'] if asset_of(q) == a and q['buckets']]
    print(f'  {a}')
    print(f'    {"pips":>8}{"hrs":>5}{"ourVol$":>13}{"meanShare%":>12}{"fees$":>10}{"$/hour":>9}{"index":>9}{"sessions":>28}')
    buckets = {}
    for b in p['buckets']:
        if b['t'] not in HRS or b['v'] <= 0:
            continue
        tot = sum(x['v'] for q in field for x in q['buckets'] if x['t'] == b['t'])
        if not tot:
            continue
        key = round(1e6 * b['f'] / b['v'])
        buckets.setdefault(key, []).append({'sh': b['v'] / tot, 'v': b['v'], 'f': b['f'], 's': sess(b['t']),
                                            'd': dt.datetime.fromtimestamp(b['t'], ET).date()})
    for k in sorted(buckets):
        g = buckets[k]
        if len(g) < 2 and sum(x['v'] for x in g) < 1000:
            continue
        ms = st.mean(x['sh'] for x in g)
        ss = {}
        for x in g:
            ss[x['s']] = ss.get(x['s'], 0) + 1
        nd = len({x['d'] for x in g})
        lab = ' '.join(f'{kk[:4]}{vv}' for kk, vv in sorted(ss.items())) + f' /{nd}d'
        print(f'    {k:>8}{len(g):>5}{sum(x["v"] for x in g):>13,.0f}{100*ms:>11.2f}%'
              f'{sum(x["f"] for x in g):>10,.2f}{sum(x["f"] for x in g)/len(g):>9,.2f}{k*100*ms:>9,.0f}{lab:>28}')

print()
print('=' * 108)
print('4. k ON ONE BASIS: window-median virtual over TVL, from the 48h chain scans')
for a in ['SPY', 'NVDA', 'META', 'GLD']:
    try:
        S = json.load(open(f'data/{a.lower()}_series.json'))
    except Exception:
        continue
    rows = []
    for kk, vv in S['series'].items():
        m = vv['meta']
        pid = (m.get('id') or m.get('addr') or '').lower()
        tvl = float(m['tvl']) if m.get('tvl') else ((BY.get(pid) or {}).get('tvlUsd') or 0)
        vi = [r['virtual'] for r in vv['rows'] if r['virtual']]
        if not vi or not tvl:
            continue
        rows.append((kk, st.median(vi), tvl, st.median(vi) / tvl))
    rows.sort(key=lambda r: -r[3])
    ours = next((r for r in rows if 'FABLES' in r[0]), None)
    if ours:
        print(f'  {a}: ours k={ours[3]:.1f}  rank {rows.index(ours)+1}/{len(rows)}  field {rows[-1][3]:.1f} to {rows[0][3]:.1f}')

print()
print('=' * 108)
print('5. PROTOCOL FEE: how many rivals also keep 100%')
n0 = [r for r in PF.values() if not r.get('protocolFeeRaw')]
print(f'   {len(n0)} of {len(PF)} pools read carry protocolFeeRaw = 0 and keep 100%, Fables included.')
raws = sorted({r['protocolFeeRaw'] for r in PF.values() if r.get('protocolFeeRaw') and r.get('proto') == 'v4'})
print(f'   v4 protocol fee is an absolute pip amount, not a proportion. Observed raw values: {raws}')
