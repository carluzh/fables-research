import json, math, statistics as st, datetime as dt
from zoneinfo import ZoneInfo
ET=ZoneInfo('America/New_York')

def bars(sym):
    j=json.load(open(f'y_{sym}_1h.json')); r=j['chart']['result'][0]
    ts=r['timestamp']; q=r['indicators']['quote'][0]
    return [(t,q['close'][i]) for i,t in enumerate(ts) if q['close'][i]]
def hourvar(sym, drop_extreme=True):
    """variance per hour by ET hour-of-day, weekdays; robust to earnings jumps via 99% winsorise"""
    b=bars(sym); d={}
    for i in range(1,len(b)):
        t0,c0=b[i-1]; t1,c1=b[i]
        if not (3000<=t1-t0<=4200): continue
        et=dt.datetime.fromtimestamp(t0,ET)
        if et.weekday()>=5: continue
        d.setdefault(et.hour,[]).append(math.log(c1/c0))
    out={}
    for h,v in d.items():
        if len(v)<25: continue
        if drop_extreme and len(v)>=100:
            v=sorted(v); k=max(1,int(len(v)*0.005)); v=v[k:len(v)-k]   # winsorise 0.5% tails
        out[h]=st.pvariance(v)
    return out

SPY=hourvar('SPY'); ES=hourvar('ES_F'); NVDA=hourvar('NVDA')
# NVDA deep-night proxy: scale ES night by NVDA/ES ratio in the pre-market hours where both exist
pre=[h for h in range(4,9) if h in NVDA and h in ES]
beta2=st.mean([NVDA[h]/ES[h] for h in pre])
def fv(sym,h):
    """fair-value variance per hour at ET hour h (weekday)"""
    base = SPY if sym=='SPY' else NVDA
    if h in base: return base[h]
    if h in ES: return ES[h]*(1.0 if sym=='SPY' else beta2)
    return None
print(f"NVDA/ES pre-market variance ratio (used to fill deep night) = {beta2:.2f}\n")

# hook tiers, hours-of-week
def tier_hours():
    T={'OPEN':[], 'OVERNIGHT':[], 'CLOSED':[]}
    for wd in range(7):
        for h in range(24):
            if (wd==4 and h>=16) or wd==5 or wd==6: T['CLOSED'].append((wd,h))
            elif wd==0 and h<9: T['OVERNIGHT'].append((wd,h))
            elif 9<=h<16: T['OPEN'].append((wd,h))
            else: T['OVERNIGHT'].append((wd,h))
    return T
T=tier_hours()
print("hours/week  OPEN %d  OVERNIGHT %d  CLOSED %d\n"%(len(T['OPEN']),len(T['OVERNIGHT']),len(T['CLOSED'])))

ESW=None
b=bars('ES_F'); wk=[]
for i in range(1,len(b)):
    t0,c0=b[i-1]; t1,c1=b[i]
    if not (3000<=t1-t0<=4200): continue
    if dt.datetime.fromtimestamp(t0,ET).weekday()>=5: wk.append(math.log(c1/c0))
ESW=st.pvariance(wk)
print(f"ES weekend (Sunday-evening reopen) variance/hour -> annualised sigma {100*math.sqrt(ESW*24*365):.1f}%")
print("Saturday and Sunday daytime have NO reference price: diffusion LVR treated as 0, the variance is realised as the reopen JUMP.\n")

RES={}
for sym in ['SPY','NVDA']:
    RES[sym]={}
    for tn,hrs in T.items():
        vs=[]
        for wd,h in hrs:
            if tn=='CLOSED':
                if wd==6 and h>=18: vs.append(ESW*(1.0 if sym=='SPY' else beta2))   # futures reopen Sun 18:00 ET
                else: vs.append(0.0)                                                 # no reference, no arb
            else:
                v=fv(sym,h)
                if v is not None: vs.append(v)
        RES[sym][tn]=(st.mean(vs), len(hrs))
    print(f"{sym}: fair-value annualised sigma by tier  "+"  ".join(
        f"{tn} {100*math.sqrt(RES[sym][tn][0]*24*365):.1f}%" for tn in ['OPEN','OVERNIGHT','CLOSED']))
json.dump({s:{t:RES[s][t][0] for t in RES[s]} for s in RES}, open('tiervar.json','w'))
