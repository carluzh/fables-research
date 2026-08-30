# WHAT IS THE ETH FIELD ACTUALLY MADE OF?
#
# "The market clears at 144 pips" is what makes our 776 look like a mistake. But a volume-weighted
# average over a field that is 90% one venue is not a clearing price, it is that venue's price. The
# question a pricing decision needs is different: is there a venue on OUR pair, at a price we could
# plausibly move to, doing better than us per dollar of capital?
#
# Restricted to ETH quoted against USDG, which is the pair we actually quote. Reads the raw hourly
# buckets so the 167h window is rebuilt here rather than inherited.
import json

OUR_ID = '0xbac3aa3b91584a53a579b3c999a56756e954e59247e497bad1d25a4334bde551'
d = json.load(open('census.json'))
rows = d['out']

ETH = {'ETH', 'WETH'}
eth = []
for r in rows:
    s0, s1 = r.get('sym0'), r.get('sym1')
    if not ((s0 in ETH and s1 == 'USDG') or (s1 in ETH and s0 == 'USDG')):
        continue
    v = sum(b['v'] for b in r.get('buckets', []))
    f = sum(b['f'] for b in r.get('buckets', []))
    if v <= 0:
        continue
    tvl = r.get('tvlUsd') or 0
    eth.append({
        'pair': f"{s0}/{s1}", 'proto': r['proto'],
        'tier': 'dyn' if r.get('isDynamicFee') else str(r.get('feeTier')),
        'v': v, 'f': f, 'pips': 1e6 * f / v, 'tvl': tvl,
        'turn': (v / tvl) if tvl > 0 else None,
        'apr': (f / tvl) * (365 * 24 / 167) * 100 if tvl > 0 else None,
        'id': r['id'], 'ours': r['id'] == OUR_ID, 'tx': r.get('txCount'),
    })

tot = sum(r['v'] for r in eth)
totf = sum(r['f'] for r in eth)
print(f"ETH/USDG field: {len(eth)} venues with volume, 167h volume ${tot:,.0f}, fees ${totf:,.0f}, "
      f"volume-weighted fee {1e6 * totf / tot:.0f} pips")
print()
hdr = (f"{'pair':11s} {'proto':5s} {'tier':>6s} {'vol 167h':>16s} {'shr':>6s} {'fees':>11s} "
       f"{'pips':>6s} {'tvl':>12s} {'turn/wk':>8s} {'LP APR':>8s} {'tx':>9s}")
print(hdr)
print('-' * len(hdr))
eth.sort(key=lambda r: -r['v'])
for r in eth:
    mark = '  <- US' if r['ours'] else ''
    print(f"{r['pair'][:11]:11s} {r['proto']:5s} {r['tier']:>6s} ${r['v']:15,.0f} {100 * r['v'] / tot:5.1f}% "
          f"${r['f']:10,.2f} {r['pips']:6.0f} ${r['tvl']:11,.0f} "
          f"{(f'{r['turn']:.1f}x' if r['turn'] else '-'):>8s} "
          f"{(f'{r['apr']:.1f}%' if r['apr'] is not None else '-'):>8s} {str(r['tx']):>9s}{mark}")

us = next(r for r in eth if r['ours'])

print()
print('THE FIELD UNDER DIFFERENT DEFINITIONS. The headline 144 is one venue, not a clearing price.')
for label, keep in [
    ('all venues', lambda r: True),
    ('excluding the v3 100 giant', lambda r: not (r['proto'] == 'v3' and r['tier'] == '100')),
    ('v4 only', lambda r: r['proto'] == 'v4'),
    ('v4 only, excluding zero-fee', lambda r: r['proto'] == 'v4' and r['pips'] >= 10),
    ('TVL over $100k', lambda r: r['tvl'] >= 100000),
]:
    g = [r for r in eth if keep(r)]
    v = sum(r['v'] for r in g)
    f = sum(r['f'] for r in g)
    print(f"  {label:34s} {len(g):2d} venues  ${v:15,.0f}  {1e6 * f / v:6.0f} pips")

print()
print('THE COMPARISON THAT MATTERS: venues on our own pair with real capital, ranked by LP APR.')
print('If a venue charging LESS earns MORE per dollar, the gap is not the fee level.')
print()
hdr2 = f"{'venue':26s} {'fee pips':>9s} {'TVL':>12s} {'turn/wk':>9s} {'LP APR':>9s} {'vs us':>8s}"
print(hdr2)
print('-' * len(hdr2))
peers = [r for r in eth if r['tvl'] >= 100000 and r['apr'] is not None]
peers.sort(key=lambda r: -r['apr'])
for r in peers:
    name = f"{r['proto']} {r['pair']} {r['tier']}" + ('  <- US' if r['ours'] else '')
    print(f"{name[:26]:26s} {r['pips']:9.0f} ${r['tvl']:11,.0f} {r['turn']:8.1f}x {r['apr']:8.1f}% "
          f"{r['apr'] / us['apr']:7.2f}x")

print()
print(f"Ours: {us['pips']:.0f} pips, ${us['tvl']:,.0f} TVL, {us['turn']:.1f}x turnover, {us['apr']:.1f}% APR.")
print('Decomposition against each peer, APR = turnover x fee, so the ratio splits cleanly:')
print()
print(f"{'peer':26s} {'APR ratio':>10s} {'from fee':>10s} {'from turnover':>14s}")
for r in peers:
    if r['ours']:
        continue
    print(f"{(r['proto'] + ' ' + r['pair'] + ' ' + r['tier'])[:26]:26s} "
          f"{r['apr'] / us['apr']:9.2f}x {r['pips'] / us['pips']:9.2f}x {r['turn'] / us['turn']:13.2f}x")
