# Same decomposition as SPY, for every asset with a 48h chain scan.
# APR = turnover x fee. So a pool underperforms its field for exactly one of three reasons:
#   PRICE      we charge less than the field for the same flow
#   DEPTH      our capital quotes less depth than theirs, so we win less flow per dollar
#   REACH      the flow is in a pair we do not quote at all
# The tell is share versus depth share: a pool that gets its depth share is depth-constrained,
# a pool that gets more than its depth share is buying flow with price.
import json, statistics as st, datetime as dt, sys
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
BY = {p['id'].lower(): p for p in C['out']}
FAB = {'SPY': '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd',
       'NVDA': '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd',
       'META': '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5',
       'GLD': '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a'}


def sess(h):
    t = dt.datetime.fromtimestamp(h, ET)
    if t.weekday() >= 5 or (t.weekday() == 4 and t.hour >= 16):
        return 'CLOSED'
    return 'OPEN' if 9 <= t.hour < 16 else 'OVERNIGHT'


for asset in ['NVDA', 'META', 'GLD']:
    S = json.load(open(f'data/{asset.lower()}_series.json'))
    ser = S['series']
    HRS = sorted({r['h'] for k in ser for r in ser[k]['rows']})[-48:]
    rows = []
    for k, v in ser.items():
        m = v['meta']
        pid = (m.get('id') or m.get('addr') or '').lower()
        tvl = float(m['tvl']) if m.get('tvl') else ((BY.get(pid) or {}).get('tvlUsd') or 0)
        rs = [r for r in v['rows'] if r['h'] in HRS]
        vi = [r['virtual'] for r in rs if r['virtual']]
        vol = sum(r['vol'] for r in rs)
        fee = sum(r['fee'] for r in rs)
        if not tvl or vol < 1000:
            continue
        virt = st.median(vi) if vi else 0
        rows.append({'k': k, 'tvl': tvl, 'virt': virt, 'kk': (virt / tvl if tvl else 0),
                     'vol': vol, 'fee': fee, 'pips': 1e6 * fee / vol if vol else 0,
                     'turn': vol / tvl, 'fab': 'FABLES' in k})
    tv = sum(r['vol'] for r in rows)
    tt = sum(r['tvl'] for r in rows)
    tvirt = sum(r['virt'] for r in rows)
    ours = next((r for r in rows if r['fab']), None)
    print('=' * 104)
    print(f'{asset}   48h chain scan, {len(rows)} venues with over $1,000 of volume')
    print(f'{"pool":22}{"TVL$":>12}{"medianVirt$":>16}{"k":>8}{"fee":>8}{"vol$":>14}{"share%":>8}{"depth%":>8}{"turn":>8}')
    for r in sorted(rows, key=lambda r: -r['vol']):
        m = '>>' if r['fab'] else '  '
        print(f'{m}{r["k"]:20}{r["tvl"]:>12,.0f}{r["virt"]:>16,.0f}{r["kk"]:>8.1f}{r["pips"]:>8,.0f}'
              f'{r["vol"]:>14,.0f}{100*r["vol"]/tv:>7.1f}%{100*r["virt"]/tvirt if tvirt else 0:>7.1f}%{r["turn"]:>8.2f}')
    if ours:
        sh = ours['vol'] / tv
        dsh = ours['virt'] / tvirt if tvirt else 0
        tsh = ours['tvl'] / tt
        krank = sorted(rows, key=lambda r: -r['kk']).index(ours) + 1
        print()
        print(f'  our volume share {100*sh:.2f}%   depth share {100*dsh:.2f}%   TVL share {100*tsh:.2f}%')
        print(f'  share / depth share = {sh/dsh if dsh else float("nan"):.2f}   share / TVL share = {sh/tsh if tsh else 0:.2f}')
        print(f'  k = {ours["kk"]:.1f}, rank {krank}/{len(rows)}   field k {min(r["kk"] for r in rows):.1f} to {max(r["kk"] for r in rows):.1f}')
        # the nearest-size rival is the fair comparison
        riv = [r for r in rows if not r['fab']]
        near = min(riv, key=lambda r: abs(r['tvl'] - ours['tvl'])) if riv else None
        if near:
            print(f'  nearest-size rival: {near["k"]}  TVL ${near["tvl"]:,.0f} ({near["tvl"]/ours["tvl"]:.2f}x ours), '
                  f'fee {near["pips"]:,.0f} ({near["pips"]/ours["pips"] if ours["pips"] else 0:.2f}x), '
                  f'k {near["kk"]:.1f} ({near["kk"]/ours["kk"] if ours["kk"] else 0:.2f}x), '
                  f'share {100*near["vol"]/tv:.2f}% ({near["vol"]/ours["vol"]:.2f}x)')
        # verdict
        verdict = []
        ratio = sh / dsh if dsh else float('nan')
        if ratio > 1.5:
            verdict.append('share exceeds depth share, so PRICE is what buys our flow and depth is not the ceiling')
        elif ratio >= 0.8:
            verdict.append('share tracks depth share, so DEPTH is the binding constraint')
        else:
            verdict.append('share is BELOW depth share: the depth is there and is not converting, '
                           'so flow here is not depth-driven (arbitrage, or we are outside the routing set)')
        if ours['kk'] < st.median([r['kk'] for r in rows]):
            verdict.append(f'k below the field median ({st.median([r["kk"] for r in rows]):.1f})')
        else:
            verdict.append(f'k at or above the field median ({st.median([r["kk"] for r in rows]):.1f})')
        print(f'  VERDICT: ' + '; '.join(verdict))
    # reach: how much of the asset flow is in a pair we do not quote
    off = sum(r['vol'] for r in rows if not r['fab'] and 'USDG' not in r['k'] and 'v3 500' not in r['k'] and 'v4' not in r['k'].split()[0])
    weth = sum(r['vol'] for r in rows if 'WETH' in r['k'])
    cross = sum(r['vol'] for r in rows if '/' in r['k'] and 'WETH' not in r['k'])
    print(f'  REACH: ${weth:,.0f} ({100*weth/tv:.1f}%) is WETH-quoted and ${cross:,.0f} ({100*cross/tv:.1f}%) is a cross. We quote neither.')
    print()
