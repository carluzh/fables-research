# RELATIVE EFFICIENCY RANKING: every pool on Robinhood Chain that trades an asset Fables runs.
# Same source for us and for every rival: gateway pool node for TVL, LiquidityService hourly
# buckets for volume and fees, so no metric is computed one way for us and another way for them.
import json, math, datetime as dt, sys
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
    '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd': 'NVDA/USDG',
    '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd': 'SPY/USDG',
    '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551': 'ETH/USDG',
    '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a': 'GLD/USDG',
    '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5': 'META/USDG',
    '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e': 'TSLA/USDG',
    '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147': 'AAPL/USDG',
    '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f': 'NVDA/SPY',
    '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f': 'SPY/GLD',
}
QUOTES = {'USDG', 'WETH', 'ETH'}
LAST = max(b['t'] for p in POOLS for b in p['buckets'] if p['buckets'])


def weekend(ts):
    t = dt.datetime.fromtimestamp(ts, ET)
    return t.weekday() >= 5 or (t.weekday() == 4 and t.hour >= 16)


def agg(buckets, lo, hi, weekdays_only=False):
    b = [x for x in buckets if lo <= x['t'] < hi and (not weekdays_only or not weekend(x['t']))]
    return sum(x['v'] for x in b), sum(x['f'] for x in b), len(b)


def metrics(p):
    tvl = p.get('tvlUsd') or 0.0
    v7, f7, h7 = agg(p['buckets'], LAST - 167 * 3600, LAST)
    v1, f1, h1 = agg(p['buckets'], LAST - 24 * 3600, LAST)
    vw, fw, hw = agg(p['buckets'], LAST - 167 * 3600, LAST, weekdays_only=True)
    ve, fe, he = agg(p['buckets'], LAST - 167 * 3600, LAST)
    wknd_v = ve - vw
    return {
        'tvl': tvl,
        'v7': v7, 'f7': f7,
        'v1': v1, 'f1': f1,
        'vw': vw, 'fw': fw, 'hw': hw,
        'apr7': (f7 * (365 / 7) / tvl * 100) if tvl > 0 else float('nan'),
        'apr1': (f1 * 365 / tvl * 100) if tvl > 0 else float('nan'),
        'aprw': (fw * (365 * 24 / hw) / tvl * 100) if tvl > 0 and hw else float('nan'),
        'turn7': (v7 / tvl) if tvl > 0 else float('nan'),
        'pips7': (1e6 * f7 / v7) if v7 > 0 else float('nan'),
        'pipsw': (1e6 * fw / vw) if vw > 0 else float('nan'),
        'wkndShare': (wknd_v / v7) if v7 > 0 else float('nan'),
    }


def asset_of(p):
    a, b = (p.get('sym0') or '?'), (p.get('sym1') or '?')
    non = [s for s in (a, b) if s not in QUOTES]
    if not non:
        return 'ETH'          # WETH/USDG and native ETH/USDG
    if len(non) == 2:
        return f'{min(non)}/{max(non)} cross'
    return non[0]


def pairname(p):
    return f"{p.get('sym0') or '?'}/{p.get('sym1') or '?'}"


rows = []
for p in POOLS:
    m = metrics(p)
    rows.append({
        'id': p['id'], 'proto': p['proto'], 'pair': pairname(p), 'asset': asset_of(p),
        'fee': p.get('feeTier'), 'dyn': p.get('isDynamicFee'), 'hook': p.get('hook'),
        'isFables': p['id'] in FABLES, **m,
    })

MIN_TVL = float(sys.argv[1]) if len(sys.argv) > 1 else 10000.0
print(f'RELATIVE EFFICIENCY, ROBINHOOD CHAIN, snapshot {d["fetchedAt"]}')
print(f'window: 7d of hourly buckets to {dt.datetime.fromtimestamp(LAST, dt.timezone.utc).isoformat()}')
print(f'universe: {len(POOLS)} pools (v3 enumerated exhaustively from factory {d["v3Factory"]}, v4 by tokenFilter, v2 top list)')
print(f'shown: pools with TVL >= ${MIN_TVL:,.0f} and 7d volume > 0. Fables rows marked >>')
print()
print('  fee APR  = 7d fees * (365/7) / TVL          the LP yield')
print('  APRwd    = same but WEEKDAY hours only, so the 29-30 Aug weekend spike is out')
print('  turn     = 7d volume / TVL                  capital turnover')
print('  pips     = 1e6 * fees / volume              what a trader actually paid (100 pips = 1 bps)')
print('  wknd%    = share of 7d volume in CLOSED hours')
print()

ORDER = ['SPY', 'NVDA', 'GLD', 'META', 'ETH', 'TSLA', 'AAPL']
groups = {}
for r in rows:
    groups.setdefault(r['asset'], []).append(r)

summary = []
for asset in ORDER + sorted(k for k in groups if k not in ORDER):
    g = [r for r in groups.get(asset, []) if r['tvl'] >= MIN_TVL and r['v7'] > 0]
    if not g:
        continue
    g.sort(key=lambda r: (-(r['apr7'] if r['apr7'] == r['apr7'] else -1)))
    print(f'=== {asset} ===  {len(g)} pools at or above the TVL floor, of {len(groups[asset])} found')
    print(f'{"":3}{"proto":6}{"pair":12}{"fee":>8}{"dyn":>4}{"TVL$":>12}{"vol7d$":>15}{"fees7d$":>10}{"feeAPR%":>10}{"APRwd%":>10}{"turn":>8}{"pips":>8}{"wknd%":>7}')
    for i, r in enumerate(g, 1):
        mark = '>>' if r['isFables'] else '  '
        print(
            f'{mark:3}{r["proto"]:6}{r["pair"]:12}{(r["fee"] if r["fee"] is not None else 0):>8.0f}{("Y" if r["dyn"] else "n"):>4}'
            f'{r["tvl"]:>12,.0f}{r["v7"]:>15,.0f}{r["f7"]:>10,.0f}{r["apr7"]:>10.1f}{r["aprw"]:>10.1f}'
            f'{r["turn7"]:>8.1f}{r["pips7"]:>8.0f}{100*r["wkndShare"]:>7.0f}'
        )
    fab = [r for r in g if r['isFables']]
    if fab:
        for f in fab:
            rank = g.index(f) + 1
            rank_wd = sorted(g, key=lambda r: -(r['aprw'] if r['aprw'] == r['aprw'] else -1)).index(f) + 1
            rank_turn = sorted(g, key=lambda r: -(r['turn7'] if r['turn7'] == r['turn7'] else -1)).index(f) + 1
            print(f'    -> Fables {f["pair"]}: rank {rank}/{len(g)} on fee APR, {rank_wd}/{len(g)} weekday-only, {rank_turn}/{len(g)} on turnover')
            summary.append({'asset': asset, 'pair': f['pair'], 'n': len(g), 'rank': rank, 'rankwd': rank_wd, 'rankturn': rank_turn,
                            'apr7': f['apr7'], 'aprw': f['aprw'], 'best': g[0]['apr7'], 'bestpair': g[0]['pair'] + ' ' + g[0]['proto'],
                            'turn': f['turn7'], 'tvl': f['tvl'], 'v7': f['v7'], 'wknd': f['wkndShare']})
    else:
        print('    -> no Fables pool at this TVL floor')
    print()

print('=' * 118)
print('SUMMARY: where Fables ranks, by asset')
print(f'{"asset":8}{"pool":12}{"field":>7}{"rankAPR":>9}{"rankWD":>8}{"rankTurn":>10}{"ourAPR%":>10}{"bestAPR%":>10}{"best pool":>22}{"wknd%":>7}')
for s in summary:
    print(f'{s["asset"]:8}{s["pair"]:12}{s["n"]:>7}{s["rank"]:>9}{s["rankwd"]:>8}{s["rankturn"]:>10}{s["apr7"]:>10.1f}{s["best"]:>10.1f}{s["bestpair"]:>22}{100*s["wknd"]:>7.0f}')
json.dump({'floor': MIN_TVL, 'last': LAST, 'rows': rows, 'summary': summary}, open('data/rank.json', 'w'), indent=1)
print('\nwrote data/rank.json')
