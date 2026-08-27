import json, math, datetime as dt
from zoneinfo import ZoneInfo
ET=ZoneInfo('America/New_York')
tv=json.load(open('tiervar.json'))
d=json.load(open('now.json')); rows={r['key']:r for r in d['out']}
LAST=max(b['t'] for r in d['out'] for b in r['buckets'])
def tier(ts):
    t=dt.datetime.fromtimestamp(ts,ET); wd=t.weekday(); h=t.hour
    if (wd==4 and h>=16) or wd>=5: return 'CLOSED'
    if wd==0 and h<9: return 'OVERNIGHT'
    if 9<=h<16: return 'OPEN'
    return 'OVERNIGHT'
HRS={'OPEN':35,'OVERNIGHT':77,'CLOSED':56}
K={'F-SPY':82.1,'F-NVDA':20.3}   # MEASURED: k = 2L*sqrtP / TVL from live Swap events
print("BREAK-EVEN FEE BY TIER  f_T = (sigma_T^2/8) * k * (hours_T/8760) * TVL / Volume_T")
print("volume measured on-chain, last 7d of hourly buckets (CLOSED tier = the 22-23 Aug weekend, PRE-routing, so its volume is understated and its break-even overstated)\n")
for key,sym in [('F-SPY','SPY'),('F-NVDA','NVDA')]:
    r=rows[key]; tvl=r['tvlUsd']; k=K[key]
    b=[x for x in r['buckets'] if x['t']<LAST]
    vol={}; fee={}; hrs={}
    for x in b:
        t=tier(x['t']); vol[t]=vol.get(t,0)+x['v']; fee[t]=fee.get(t,0)+x['f']; hrs[t]=hrs.get(t,0)+1
    print(f"--- {key}  TVL ${tvl:,.0f}  k={k}")
    print(f"{'tier':11}{'sigma%':>8}{'hrs obs':>9}{'volume$':>13}{'vol%':>7}{'realised bps':>14}{'LVR $/wk':>11}{'break-even bps':>16}{'ratio':>8}")
    tot=sum(vol.values())
    be={}
    for t in ['OPEN','OVERNIGHT','CLOSED']:
        v2=tv[sym][t]                       # variance per hour
        lvr = (v2/8)*k*tvl*HRS[t]           # $ per week
        volw = vol.get(t,0)*(HRS[t]/max(hrs.get(t,1),1))   # volume scaled to a full week's worth of that tier
        f = 10000*lvr/volw if volw>0 else float('nan')
        be[t]=f
        rb = 10000*fee.get(t,0)/vol[t] if vol.get(t,0) else 0
        print(f"{t:11}{100*math.sqrt(v2*24*365):>8.1f}{hrs.get(t,0):>9}{vol.get(t,0):>13,.0f}{100*vol.get(t,0)/tot:>6.1f}%{rb:>14.2f}{lvr:>11,.0f}{f:>16.1f}{f/be['OPEN']:>8.2f}x")
    print(f"   shape (break-even, OPEN=1):  OPEN 1.00x   OVERNIGHT {be['OVERNIGHT']/be['OPEN']:.2f}x   CLOSED {be['CLOSED']/be['OPEN']:.2f}x")
    print(f"   current ladder ratio:        OPEN 1.00x   OVERNIGHT {(350/500 if key=='F-SPY' else 400/700):.2f}x   CLOSED {(300/500 if key=='F-SPY' else 300/700):.2f}x")
    print(f"   pure sigma^1 rule:           OPEN 1.00x   OVERNIGHT {math.sqrt(tv[sym]['OVERNIGHT']/tv[sym]['OPEN']):.2f}x   CLOSED {math.sqrt(tv[sym]['CLOSED']/tv[sym]['OPEN']):.2f}x")
    print(f"   pure sigma^2 rule:           OPEN 1.00x   OVERNIGHT {tv[sym]['OVERNIGHT']/tv[sym]['OPEN']:.2f}x   CLOSED {tv[sym]['CLOSED']/tv[sym]['OPEN']:.2f}x")
    print()

print("LVR-vs-FEE TEST, whole week, at measured k")
print(f"{'pool':10}{'k':>7}{'LVR APR%':>10}{'fee APR%':>10}{'net':>10}   verdict")
for key,sym in [('F-SPY','SPY'),('F-NVDA','NVDA')]:
    r=rows[key]; tvl=r['tvlUsd']; k=K[key]
    b=[x for x in r['buckets'] if x['t']<LAST]
    lvr=sum((tv[sym][t]/8)*k*tvl*HRS[t] for t in HRS)
    fees=sum(x['f'] for x in b)
    la=lvr*52/tvl*100; fa=fees*52/tvl*100
    print(f"{key:10}{k:>7.1f}{la:>10.1f}{fa:>10.1f}{fa-la:>10.1f}   {'LVR-POSITIVE' if fa>la else 'LOSING TO LVR'}")
