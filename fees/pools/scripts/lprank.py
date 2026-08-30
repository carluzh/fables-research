# LP EFFICIENCY: where a Fables pool ranks among every venue on chain trading the same asset,
# on what an LP actually keeps per dollar deposited. 167h window, LP-net of protocol fees.
#
# Caveat carried from BASELINE: APR divides a week of fees by one end-of-window TVL snapshot, and
# our TVL moved most of anyone's (+162% on SPY in the final 24h), so our rank here is if anything
# understated. Ranks are shown at three TVL floors so a freak micro-pool cannot set the top.
import json, datetime as dt
from zoneinfo import ZoneInfo

import os as _os
_D = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'data')
_open = open
def open(f, *a, **k):
    if isinstance(f, str) and f.startswith('data/'):
        f = _os.path.join(_D, f[5:])
    return _open(f, *a, **k)

ET = ZoneInfo('America/New_York')
C = json.load(open('data/census.json'))
PF = {r['id'].lower(): r for r in json.load(open('data/protofee.json'))}
FAB = {
    '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd': 'SPY',
    '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd': 'NVDA',
    '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5': 'META',
    '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a': 'GLD',
    '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551': 'ETH',
    '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e': 'TSLA',
    '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147': 'AAPL',
    '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f': 'NVDA/SPY',
    '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f': 'GLD/SPY',
}
DEAD = {'0x3d4db2a47686c5d019bbb49b2be17851eae586b52891bb4e0562bcbfe99fbb38',
        '0x1bdf79cae9c6a83216a659974c9915e632bdd6916736bf29ea1d8211310048d2'}
QUOTES = {'USDG', 'WETH', 'ETH'}


def asset_of(p):
    non = [s for s in ((p.get('sym0') or '?'), (p.get('sym1') or '?')) if s not in QUOTES]
    return 'ETH' if not non else ('/'.join(sorted(non)) if len(non) == 2 else non[0])


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
HRS = {b['t'] for p in C['out'] for b in p['buckets'] if LAST - 167 * 3600 <= b['t'] < LAST}
N = len(HRS)


def rows_for(asset):
    out = []
    for p in C['out']:
        if asset_of(p) != asset or not p['buckets'] or p['id'] in DEAD:
            continue
        bs = [b for b in p['buckets'] if b['t'] in HRS]
        v = sum(b['v'] for b in bs)
        f = sum(b['f'] for b in bs)
        tvl = p['tvlUsd'] or 0
        pips = (1e6 * f / v) if v else 0
        fn = f * lp(p, pips)
        out.append({'id': p['id'], 'name': f"{p['sym0']}/{p['sym1']} {p['proto']} {int(p['feeTier'] or 0)}",
                    'v': v, 'fn': fn, 'tvl': tvl, 'pips': pips,
                    'apr': (fn * (8760 / N) / tvl * 100) if tvl else None,
                    'fab': p['id'] in FAB})
    return out


ORDER = ['SPY', 'NVDA', 'META', 'GLD', 'ETH', 'TSLA', 'AAPL', 'NVDA/SPY', 'GLD/SPY']
print(f'LP EFFICIENCY, 167 hours to {dt.datetime.fromtimestamp(LAST, dt.timezone.utc).isoformat()}')
print('Rank = our position on LP-net APR among every venue on chain trading that asset.')
print('Two dead NVDA venues excluded. Floors filter on TVL so a micro-pool cannot take the top slot.')
print()
print(f'{"asset":10}{"our APR%":>10}{"field APR%":>12}{"ratio":>7}   {"rank >$0":>10}{"rank >$10k":>12}{"rank >$50k":>12}   best in field')
port_f = port_t = 0
for a in ORDER:
    rs = rows_for(a)
    fab = next((r for r in rs if r['fab']), None)
    if not fab:
        continue
    tot_fn = sum(r['fn'] for r in rs)
    tot_tvl = sum(r['tvl'] for r in rs)
    field = (tot_fn * (8760 / N) / tot_tvl * 100) if tot_tvl else 0
    port_f += fab['fn']
    port_t += fab['tvl']
    ranks = []
    for floor in [0, 10000, 50000]:
        g = [r for r in rs if r['tvl'] >= floor and r['v'] > 1000 and r['apr'] is not None]
        if fab not in g:
            ranks.append('n/a')
            continue
        g.sort(key=lambda r: -r['apr'])
        ranks.append(f'{g.index(fab)+1}/{len(g)}')
    g0 = sorted([r for r in rs if r['tvl'] >= 10000 and r['v'] > 1000 and r['apr'] is not None], key=lambda r: -r['apr'])
    best = f"{g0[0]['name']} {g0[0]['apr']:,.0f}%" if g0 else '-'
    print(f'{a:10}{fab["apr"]:>10,.1f}{field:>12,.1f}{(fab["apr"]/field if field else 0):>7.2f}   '
          f'{ranks[0]:>10}{ranks[1]:>12}{ranks[2]:>12}   {best}')

print()
print('=' * 100)
print('THE WHOLE BOOK')
allf = {}
for a in ORDER:
    for r in rows_for(a):
        allf[r['id']] = r
fab_rows = [r for r in allf.values() if r['fab']]
riv_rows = [r for r in allf.values() if not r['fab']]
ours_apr = sum(r['fn'] for r in fab_rows) * (8760 / N) / sum(r['tvl'] for r in fab_rows) * 100
field_apr = sum(r['fn'] for r in allf.values()) * (8760 / N) / sum(r['tvl'] for r in allf.values()) * 100
riv_apr = sum(r['fn'] for r in riv_rows) * (8760 / N) / sum(r['tvl'] for r in riv_rows) * 100
print(f'  Fables:  TVL ${sum(r["tvl"] for r in fab_rows):,.0f}   LP-net fees ${sum(r["fn"] for r in fab_rows):,.2f}/wk   blended APR {ours_apr:,.1f}%')
print(f'  Rivals:  TVL ${sum(r["tvl"] for r in riv_rows):,.0f}   LP-net fees ${sum(r["fn"] for r in riv_rows):,.2f}/wk   blended APR {riv_apr:,.1f}%')
print(f'  Field:   TVL ${sum(r["tvl"] for r in allf.values()):,.0f}   blended APR {field_apr:,.1f}%')
print(f'  OUR RATIO TO THE FIELD: {ours_apr/field_apr:.2f}x')
print()
gl = [r for r in fab_rows if 'GLD' in r['name'] and 'SPY' not in r['name']]
fab_x = [r for r in fab_rows if r not in gl]
if gl:
    ex = sum(r['fn'] for r in fab_x) * (8760 / N) / sum(r['tvl'] for r in fab_x) * 100
    allx = [r for r in allf.values() if r not in gl]
    fx = sum(r['fn'] for r in allx) * (8760 / N) / sum(r['tvl'] for r in allx) * 100
    print(f'  Excluding the GLD dislocation: ours {ex:,.1f}% against a field of {fx:,.1f}%, ratio {ex/fx:.2f}x')

print()
print('  Where every dollar of our fee income came from, 167h:')
for r in sorted(fab_rows, key=lambda r: -r['fn']):
    print(f'    {r["name"]:26} ${r["fn"]:>10,.2f}  {100*r["fn"]/sum(x["fn"] for x in fab_rows):>5.1f}%   TVL ${r["tvl"]:>10,.0f}   APR {r["apr"]:>8,.1f}%')
