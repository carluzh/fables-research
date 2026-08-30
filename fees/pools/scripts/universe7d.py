# The 48h chain scan holds ONE cash session. This repeats the universe benchmark over 7 DAYS of
# hourly buckets straight from census.json, which covers every venue on chain for every asset and
# five cash sessions, so the session findings stop resting on Friday 28 August alone.
#
# What is lost at this horizon: depth. The buckets carry no liquidity, so virtual and k are not
# available here and every depth statement still rests on the 48h scan.
# What is gained: 167 hours instead of 48, and 35 session hours instead of 7.
import json, datetime as dt, statistics as st
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
try:
    PF = {r['id'].lower(): r for r in json.load(open('data/protofee.json'))}
except Exception:
    PF = {}

FABLES = {
    '0x8674c1c5544f3c9563565b5d4bd5916701d90b3559b072acf7cef5b4fc5b8dcd': 'SPY',
    '0x7990aad9e8fb048f49a155a7df5603db0366f0657035b78eb4196395cccb3dcd': 'NVDA',
    '0x4ac4259eb99dce57268a856719d087fa1a53569b2fed6f330aabe32d9a4aa4f5': 'META',
    '0xfe281bbfa9aa658c1aa9c2ad1b0c62c4286f96c7cb1074296b54e869935a7a3a': 'GLD',
    '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551': 'ETH',
    '0xd5effce87036cd858146c0c15fa825c231a9de1843200ca108e431e431331e8e': 'TSLA',
    '0xa2347ba69167e5602f74640ffbf737ee7cdd825e4726d3462564fc6533070147': 'AAPL',
    '0x988f3b6ceec4795e0d6d28a054af87ffbcbdeee2566f72ae391da5f109bd485f': 'NVDA/SPY',
    '0x118887805417a88865010dfe9ab3a516214e720aff2b01a19fcdb92b924c397f': 'SPY/GLD',
}
QUOTES = {'USDG', 'WETH', 'ETH'}


def asset_of(p):
    a, b = (p.get('sym0') or '?'), (p.get('sym1') or '?')
    non = [s for s in (a, b) if s not in QUOTES]
    if not non:
        return 'ETH'
    if len(non) == 2:
        # a cross competes only against pools quoting the SAME pair, so that is its field
        return '/'.join(sorted(non))
    return non[0]


def lp_share(p, pips):
    r = PF.get(p['id'].lower())
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


LAST = max(b['t'] for p in C['out'] for b in p['buckets'] if p['buckets'])
HRS = sorted({b['t'] for p in C['out'] for b in p['buckets'] if LAST - 167 * 3600 <= b['t'] < LAST})
print(f'UNIVERSE BENCHMARK OVER 7 DAYS, every venue on chain, {len(HRS)} hours to {dt.datetime.fromtimestamp(LAST, dt.timezone.utc).isoformat()}')
sd = {}
for h in HRS:
    sd.setdefault(sess(h), set()).add(dt.datetime.fromtimestamp(h, ET).date())
print('session days covered: ' + ', '.join(f'{k} {len(v)}' for k, v in sorted(sd.items())))
print('Depth is NOT available at this horizon. Fees in pips, APR LP-net.')
print()
print(f'{"asset":9}{"session":11}{"hrs":>5}{"venues":>8}{"mkt vol$":>16}{"mkt fee":>9}{"our fee":>9}{"x mkt":>7}{"mkt APR%":>10}{"our APR%":>10}{"x mkt":>7}{"share%":>9}{"tvl%":>8}')
for asset in ['SPY', 'NVDA', 'META', 'GLD', 'ETH', 'TSLA', 'AAPL', 'NVDA/SPY', 'GLD/SPY']:
    pools = [p for p in C['out'] if asset_of(p) == asset and p['buckets']]
    fab = next((p for p in pools if p['id'].lower() in FABLES), None)
    for g in ['ALL', 'OPEN', 'OVERNIGHT', 'CLOSED']:
        hs = HRS if g == 'ALL' else [h for h in HRS if sess(h) == g]
        tv = tf = tfn = ttvl = 0
        ov = of = otvl = 0
        nv = 0
        for p in pools:
            bs = [b for b in p['buckets'] if b['t'] in hs]
            v = sum(b['v'] for b in bs)
            f = sum(b['f'] for b in bs)
            pips = (1e6 * f / v) if v else 0
            tv += v
            tf += f
            tfn += f * lp_share(p, pips)
            ttvl += p['tvlUsd'] or 0
            if v > 0:
                nv += 1
            if fab and p['id'] == fab['id']:
                ov, of, otvl = v, f, (p['tvlUsd'] or 0)
        n = len(hs)
        mf = (1e6 * tf / tv) if tv else 0
        ma = (tfn * (8760 / n) / ttvl * 100) if ttvl else 0
        ofee = (1e6 * of / ov) if ov else 0
        oa = (of * (lp_share(fab, ofee) if fab else 1) * (8760 / n) / otvl * 100) if otvl else 0
        print(f'{asset:9}{g:11}{n:>5}{nv:>8}{tv:>16,.0f}{mf:>9,.0f}{ofee:>9,.0f}{(ofee/mf if mf else 0):>7.2f}'
              f'{ma:>10.1f}{oa:>10.1f}{(oa/ma if ma else 0):>7.2f}{(100*ov/tv if tv else 0):>8.2f}%{(100*otvl/ttvl if ttvl else 0):>7.1f}%')
    print()
