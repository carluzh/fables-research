import json, datetime as dt
d=json.load(open('/private/tmp/claude-501/-Users-carlschmidt-Desktop-Projects/fae2a16e-daa5-42c7-bfe1-211269ebbec0/scratchpad/now.json'))
rows={r['key']:r for r in d['out']}
LAST=max(b['t'] for r in d['out'] for b in r['buckets'])
def tier(ts):
    t=dt.datetime.fromtimestamp(ts,dt.timezone.utc)-dt.timedelta(hours=4)  # ET (EDT)
    wd=t.weekday()
    if wd>=5 or (wd==4 and t.hour>=16): return 'CLOSED'
    if wd==0 and t.hour<9: return 'OVERNIGHT'
    m=t.hour*60+t.minute
    if 9*60+30 <= m < 16*60: return 'OPEN'
    return 'OVERNIGHT'
print('POST-ROUTING WINDOW: last 72h (08-23 20:00Z -> 08-26 20:00Z), by session tier')
print(f"{'pool':10}{'tier':11}{'hrs':>5}{'volume$':>13}{'vol%':>7}{'fees$':>10}{'bps':>7}")
for k in ['F-ETH','F-SPY','F-GLD','F-NVDA','F-META']:
    b=[x for x in rows[k]['buckets'] if x['t']>=LAST-72*3600 and x['t']<LAST]
    tot=sum(x['v'] for x in b) or 1
    for tn in ['OPEN','OVERNIGHT','CLOSED']:
        w=[x for x in b if tier(x['t'])==tn]
        v=sum(x['v'] for x in w); f=sum(x['f'] for x in w)
        print(f"{k:10}{tn:11}{len(w):>5}{v:>13,.0f}{100*v/tot:>6.1f}%{f:>10.2f}{(10000*f/v if v else 0):>7.2f}")
    print()
print('COUNTERFACTUAL 24h APR at multiples of the realised fee (volume held constant, no elasticity)')
print(f"{'pool':10}{'TVL$':>10}{'bps':>7}{'APR x1':>9}{'x1.5':>8}{'x2':>8}{'x3':>8}{'x8.7':>8}   best rival APR / its bps")
best={'F-ETH':('R-ETH-v4-577',),'F-SPY':('R-SPY-v4-625',),'F-GLD':('R-GLD-v3-3000',),'F-NVDA':('R-NVDA-v3-500',)}
res=json.load(open('/private/tmp/claude-501/-Users-carlschmidt-Desktop-Projects/fae2a16e-daa5-42c7-bfe1-211269ebbec0/scratchpad/res.json'))
for k,(rk,) in best.items():
    r=res[k]; rv=res[rk]
    a=r['a24']
    print(f"{k:10}{r['tvl']:>10,.0f}{r['bps']:>7.2f}{a:>9.1f}{a*1.5:>8.1f}{a*2:>8.1f}{a*3:>8.1f}{a*8.7:>8.1f}   {rv['note']} {rv['a24']:.1f}% @ {rv['bps']:.2f}bps")
