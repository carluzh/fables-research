# UNIVERSE-LEVEL BENCHMARKS. Fixes a real flaw in the earlier per-pool work: comparing Fables
# against "the incumbent" or "the deepest rival" is a comparison against one pool, and a trader or
# an LP chooses against the whole field. Everything here is measured against the field.
#
#   market fee   = volume-weighted realised fee across EVERY venue, which is what the asset
#                  actually cost to trade, not what any one pool charged
#   best bid     = the cheapest venue that could actually absorb a clip, by depth threshold,
#                  because a 9-pip pool with no depth is not a real alternative
#   market APR   = total LP-net fees over total TVL across the field, which is what an LP would
#                  earn holding the whole asset's book. That is the number we have to beat.
#
#   python universe.py data/<asset>_series.json
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
ASSET = S.get('asset') or sys.argv[1].split('/')[-1].split('_')[0].upper()
C = json.load(open('data/census.json'))
BY = {p['id'].lower(): p for p in C['out']}
try:
    PF = {r['id'].lower(): r for r in json.load(open('data/protofee.json'))}
except Exception:
    PF = {}

POOLS = list(series.keys())
HRS = sorted({r['h'] for k in POOLS for r in series[k]['rows']})[-48:]
FAB = [k for k in POOLS if 'FABLES' in k]


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


def agg(k, hs):
    rs = [r for r in series[k]['rows'] if r['h'] in hs]
    v = sum(r['vol'] for r in rs)
    f = sum(r['fee'] for r in rs)
    vi = [r['virtual'] for r in rs if r['virtual']]
    return v, f, (st.median(vi) if vi else 0.0), len(rs)


print(f'{ASSET}  UNIVERSE BENCHMARKS, {len(HRS)}h chain scan to {dt.datetime.fromtimestamp(S["headTs"], dt.timezone.utc).isoformat()}')
print(f'{len(POOLS)} venues scanned. Fees in PIPS. APR is LP-NET.')
print()

for label, hs in [('WHOLE WINDOW', HRS)] + [(g, [h for h in HRS if sess(h) == g]) for g in ['OPEN', 'OVERNIGHT', 'CLOSED']]:
    if not hs:
        continue
    rows = []
    for k in POOLS:
        v, f, virt, n = agg(k, hs)
        tvl = tvl_of(k)
        pips = (1e6 * f / v) if v else None
        rows.append({'k': k, 'v': v, 'f': f, 'virt': virt, 'tvl': tvl, 'pips': pips,
                     'fn': f * lp_share(k, pips or 0), 'n': n, 'fab': k in FAB})
    tv = sum(r['v'] for r in rows)
    tf = sum(r['f'] for r in rows)
    tfn = sum(r['fn'] for r in rows)
    ttvl = sum(r['tvl'] for r in rows)
    tvirt = sum(r['virt'] for r in rows)
    n = len(hs)
    mkt_fee = (1e6 * tf / tv) if tv else 0
    mkt_apr = (tfn * (8760 / n) / ttvl * 100) if ttvl else 0
    ours = next((r for r in rows if r['fab']), None)

    print('=' * 112)
    print(f'{label}  ({n} hours)')
    print(f'  market volume        ${tv:,.0f}')
    print(f'  market fees          ${tf:,.2f}   LP-net ${tfn:,.2f}')
    print(f'  MARKET FEE           {mkt_fee:,.0f} pips   volume-weighted across all {len(rows)} venues')
    print(f'  market TVL           ${ttvl:,.0f}   working depth ${tvirt:,.0f}')
    print(f'  MARKET APR           {mkt_apr:,.1f}%   what an LP earns holding the whole field')
    if ours and ours['v'] > 0:
        oapr = ours['fn'] * (8760 / n) / ours['tvl'] * 100 if ours['tvl'] else float('nan')
        print(f'  OURS                 {ours["pips"]:,.0f} pips ({ours["pips"]/mkt_fee if mkt_fee else 0:.2f}x market),  '
              f'APR {oapr:,.1f}% ({oapr/mkt_apr if mkt_apr else 0:.2f}x market),  '
              f'share {100*ours["v"]/tv if tv else 0:.2f}%,  depth share {100*ours["virt"]/tvirt if tvirt else 0:.2f}%')
    elif ours:
        print('  OURS                 no volume in this window')

    # what a trader could actually get, by how much depth the venue has
    print(f'  cheapest venue by depth floor (a cheap pool with no depth is not a real alternative):')
    for floor in [0, 500_000, 2_000_000, 10_000_000]:
        cand = [r for r in rows if r['virt'] >= floor and r['v'] > 0 and r['pips'] is not None]
        if not cand:
            print(f'    virtual >= ${floor:>12,.0f}   none')
            continue
        best = min(cand, key=lambda r: r['pips'])
        prem = (ours['pips'] / best['pips']) if (ours and ours['pips'] and best['pips']) else float('nan')
        print(f'    virtual >= ${floor:>12,.0f}   {best["k"]:22} {best["pips"]:>7,.0f} pips  '
              f'(vol ${best["v"]:>13,.0f}, virt ${best["virt"]:>14,.0f})   we are {prem:>6.2f}x it')

    # the fee the market actually paid, as a distribution over volume
    print(f'  volume by fee band:')
    bands = [(0, 100), (100, 300), (300, 600), (600, 1200), (1200, 3000), (3000, 100000000)]
    for lo, hi in bands:
        vv = sum(r['v'] for r in rows if r['pips'] is not None and lo <= r['pips'] < hi)
        if vv <= 0:
            continue
        names = ', '.join(r['k'] for r in sorted([r for r in rows if r['pips'] is not None and lo <= r['pips'] < hi], key=lambda r: -r['v'])[:3])
        print(f'    {lo:>6,} to {hi if hi < 1e6 else "inf":>9}  ${vv:>14,.0f}  {100*vv/tv if tv else 0:>5.1f}%   {names}')

    if ours and ours['v'] > 0:
        cheaper_v = sum(r['v'] for r in rows if r['pips'] is not None and r['pips'] < ours['pips'] and not r['fab'])
        dearer_v = sum(r['v'] for r in rows if r['pips'] is not None and r['pips'] > ours['pips'] and not r['fab'])
        better_apr = [r for r in rows if r['tvl'] > 0 and r['v'] > 1000 and (r['fn'] * (8760 / n) / r['tvl'] * 100) > (ours['fn'] * (8760 / n) / ours['tvl'] * 100)]
        print(f'  OUR POSITION IN THE FIELD:')
        print(f'    volume trading CHEAPER than us   ${cheaper_v:>14,.0f}  {100*cheaper_v/tv if tv else 0:>5.1f}% of the market')
        print(f'    volume trading DEARER  than us   ${dearer_v:>14,.0f}  {100*dearer_v/tv if tv else 0:>5.1f}%')
        print(f'    venues beating our APR           {len(better_apr)} of {len([r for r in rows if r["v"] > 1000])}   '
              f'holding ${sum(r["tvl"] for r in better_apr):,.0f} of TVL')
    print()
