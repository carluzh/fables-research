# Second pass: robustness of the ranking to the TVL floor, flow share per asset, the price a
# trader pays, and the counterfactual "what if Fables charged what the field charges".
import json, math, datetime as dt
from zoneinfo import ZoneInfo

import os as _os
_D = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'data')
_open = open
def open(f, *a, **k):
    if isinstance(f, str) and f.startswith('data/'):
        f = _os.path.join(_D, f[5:])
    return _open(f, *a, **k)

ET = ZoneInfo('America/New_York')
d = json.load(open('data/census.json'))
POOLS = d['out']
FABLES = {
    '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd': 'NVDA',
    '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd': 'SPY',
    '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551': 'ETH',
    '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a': 'GLD',
    '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5': 'META',
    '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e': 'TSLA',
    '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147': 'AAPL',
    '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f': 'NVDA/SPY cross',
    '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f': 'SPY/GLD cross',
}
QUOTES = {'USDG', 'WETH', 'ETH'}
LAST = max(b['t'] for p in POOLS for b in p['buckets'] if p['buckets'])


def weekend(ts):
    t = dt.datetime.fromtimestamp(ts, ET)
    return t.weekday() >= 5 or (t.weekday() == 4 and t.hour >= 16)


def asset_of(p):
    a, b = (p.get('sym0') or '?'), (p.get('sym1') or '?')
    non = [s for s in (a, b) if s not in QUOTES]
    if not non:
        return 'ETH'
    if len(non) == 2:
        return f'{min(non)}/{max(non)} cross'
    return non[0]


rows = []
for p in POOLS:
    b7 = [x for x in p['buckets'] if LAST - 167 * 3600 <= x['t'] < LAST]
    bw = [x for x in b7 if not weekend(x['t'])]
    tvl = p.get('tvlUsd') or 0.0
    v7 = sum(x['v'] for x in b7); f7 = sum(x['f'] for x in b7)
    vw = sum(x['v'] for x in bw); fw = sum(x['f'] for x in bw)
    rows.append({
        'id': p['id'], 'proto': p['proto'], 'pair': f"{p.get('sym0')}/{p.get('sym1')}", 'asset': asset_of(p),
        'fee': p.get('feeTier') or 0, 'dyn': bool(p.get('isDynamicFee')), 'tvl': tvl,
        'v7': v7, 'f7': f7, 'vw': vw, 'fw': fw, 'hw': len(bw),
        'apr7': (f7 * (365 / 7) / tvl * 100) if tvl > 0 else float('nan'),
        'aprw': (fw * (365 * 24 / len(bw)) / tvl * 100) if tvl > 0 and bw else float('nan'),
        'turn': (v7 / tvl) if tvl > 0 else float('nan'),
        'pips': (1e6 * f7 / v7) if v7 > 0 else float('nan'),
        'pipsw': (1e6 * fw / vw) if vw > 0 else float('nan'),
        'isF': p['id'] in FABLES,
    })

ORDER = ['SPY', 'NVDA', 'GLD', 'META', 'ETH', 'TSLA', 'AAPL']

print('1. IS THE RANKING ROBUST TO THE TVL FLOOR?')
print('   Fables rank on 7d fee APR among pools at or above each floor (rank / field size)')
print(f'{"asset":8}' + ''.join(f'{("$" + str(int(f/1000)) + "k"):>14}' for f in [0, 10000, 25000, 50000, 100000, 250000]))
for a in ORDER:
    line = f'{a:8}'
    for floor in [0, 10000, 25000, 50000, 100000, 250000]:
        g = [r for r in rows if r['asset'] == a and r['tvl'] >= floor and r['v7'] > 0]
        f = [r for r in g if r['isF']]
        if not f:
            line += f'{"-":>14}'
            continue
        g.sort(key=lambda r: -(r['apr7'] if r['apr7'] == r['apr7'] else -1))
        line += f'{(str(g.index(f[0]) + 1) + "/" + str(len(g))):>14}'
    print(line)
print()

print('2. THE PRICE A TRADER PAYS (realised pips, weekday hours only). Lower is cheaper.')
print('   Fables rank among pools at or above $10k TVL, ranked CHEAPEST first.')
print(f'{"asset":8}{"our pips":>10}{"rank":>8}{"field":>7}{"cheapest rival":>18}{"their pips":>12}{"median field":>14}')
for a in ORDER:
    g = [r for r in rows if r['asset'] == a and r['tvl'] >= 10000 and r['vw'] > 0]
    f = [r for r in g if r['isF']]
    if not f or not g:
        continue
    g.sort(key=lambda r: r['pipsw'])
    riv = [r for r in g if not r['isF']]
    med = sorted(r['pipsw'] for r in riv)[len(riv) // 2] if riv else float('nan')
    print(f'{a:8}{f[0]["pipsw"]:>10.0f}{g.index(f[0]) + 1:>8}{len(g):>7}{(riv[0]["pair"] + " " + riv[0]["proto"]):>18}{riv[0]["pipsw"]:>12.0f}{med:>14.0f}')
print()

print('3. FLOW SHARE: our slice of all on-chain volume in that asset (7d, every pool found)')
print(f'{"asset":8}{"our vol7d$":>15}{"chain vol7d$":>17}{"our share":>11}{"our TVL$":>13}{"chain TVL$":>14}{"TVL share":>11}{"vol/TVL us":>12}{"vol/TVL field":>15}')
for a in ORDER:
    g = [r for r in rows if r['asset'] == a]
    f = [r for r in g if r['isF']]
    if not f:
        continue
    tv = sum(r['v7'] for r in g); tt = sum(r['tvl'] for r in g)
    ov = f[0]['v7']; ot = f[0]['tvl']
    rest_v = tv - ov; rest_t = tt - ot
    print(f'{a:8}{ov:>15,.0f}{tv:>17,.0f}{100*ov/tv:>10.1f}%{ot:>13,.0f}{tt:>14,.0f}{100*ot/tt:>10.1f}%{ov/ot:>12.1f}{(rest_v/rest_t if rest_t else float("nan")):>15.1f}')
print()

print('4. COUNTERFACTUAL: our 7d fees and APR if we had charged what the field charges,')
print('   holding our own volume constant (no elasticity, so an upper bound).')
print(f'{"asset":8}{"our pips":>10}{"field median":>14}{"our fees7d$":>13}{"at field px$":>14}{"our APR%":>10}{"APR at field%":>15}{"rank then":>11}')
for a in ORDER:
    g = [r for r in rows if r['asset'] == a and r['tvl'] >= 10000 and r['v7'] > 0]
    f = [r for r in g if r['isF']]
    riv = [r for r in g if not r['isF']]
    if not f or not riv:
        continue
    med = sorted(r['pips'] for r in riv)[len(riv) // 2]
    ours = f[0]
    newfees = ours['v7'] * med / 1e6
    newapr = newfees * (365 / 7) / ours['tvl'] * 100
    ranked = sorted([r['apr7'] for r in riv] + [newapr], reverse=True)
    print(f'{a:8}{ours["pips"]:>10.0f}{med:>14.0f}{ours["f7"]:>13,.0f}{newfees:>14,.0f}{ours["apr7"]:>10.1f}{newapr:>15.1f}{(str(ranked.index(newapr) + 1) + "/" + str(len(ranked))):>11}')
print()

print('5. HEAD TO HEAD against the single deepest rival pool in each asset')
print(f'{"asset":8}{"rival":>20}{"their TVL$":>13}{"our TVL$":>12}{"their vol7d$":>16}{"our vol7d$":>14}{"their APR%":>12}{"our APR%":>10}{"their pips":>12}{"our pips":>10}')
for a in ORDER:
    g = [r for r in rows if r['asset'] == a and r['v7'] > 0]
    f = [r for r in g if r['isF']]
    riv = [r for r in g if not r['isF']]
    if not f or not riv:
        continue
    dp = max(riv, key=lambda r: r['tvl'])
    o = f[0]
    print(f'{a:8}{(dp["pair"] + " " + dp["proto"] + " " + str(int(dp["fee"]))):>20}{dp["tvl"]:>13,.0f}{o["tvl"]:>12,.0f}{dp["v7"]:>16,.0f}{o["v7"]:>14,.0f}{dp["apr7"]:>12.1f}{o["apr7"]:>10.1f}{dp["pips"]:>12.0f}{o["pips"]:>10.0f}')
