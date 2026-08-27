import json, math, datetime as dt
from zoneinfo import ZoneInfo
ET=ZoneInfo('America/New_York')
tv=json.load(open('tiervar.json'))
d=json.load(open('now.json')); rows={r['key']:r for r in d['out']}
LAST=max(b['t'] for r in d['out'] for b in r['buckets'])
K={'F-SPY':82.1,'F-NVDA':20.3}
HRS={'OPEN':35,'OVERNIGHT':77,'CLOSED':56}
def tier(ts):
    t=dt.datetime.fromtimestamp(ts,ET); wd=t.weekday(); h=t.hour
    if (wd==4 and h>=16) or wd>=5: return 'CLOSED'
    if wd==0 and h<9: return 'OVERNIGHT'
    if 9<=h<16: return 'OPEN'
    return 'OVERNIGHT'
print("BREAK-EVEN BY TIER, POST-ROUTING WINDOW ONLY (last 48h, Mon 08-24 20:00Z onward: no weekend inside)")
print("CLOSED tier has no post-routing observation yet, shown from the 22-23 Aug weekend for reference\n")
for key,sym in [('F-SPY','SPY'),('F-NVDA','NVDA')]:
    r=rows[key]; tvl=r['tvlUsd']; k=K[key]
    print(f"--- {key}  TVL ${tvl:,.0f}  k={k}")
    print(f"{'tier':11}{'window':>10}{'hrs':>5}{'vol/hr $':>11}{'break-even bps':>16}{'current':>9}{'gap':>8}")
    cur={'F-SPY':{'OPEN':500,'OVERNIGHT':350,'CLOSED':300},'F-NVDA':{'OPEN':700,'OVERNIGHT':400,'CLOSED':300}}[key]
    for t in ['OPEN','OVERNIGHT','CLOSED']:
        for lab,lo in [('7d',LAST-167*3600),('48h',LAST-48*3600)]:
            b=[x for x in r['buckets'] if lo<=x['t']<LAST and tier(x['t'])==t]
            if not b: continue
            vph=sum(x['v'] for x in b)/len(b)
            lvr_ph=(tv[sym][t]/8)*k*tvl
            be=10000*lvr_ph/vph if vph>0 else float('nan')
            print(f"{t:11}{lab:>10}{len(b):>5}{vph:>11,.0f}{be:>16.1f}{cur[t]/100:>9.2f}{be/(cur[t]/100):>7.1f}x")
    print()
