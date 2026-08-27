import json, math, statistics as st, datetime as dt
from zoneinfo import ZoneInfo
ET=ZoneInfo('America/New_York')
def bars(sym):
    j=json.load(open(f'y_{sym}_1h.json')); r=j['chart']['result'][0]
    ts=r['timestamp']; q=r['indicators']['quote'][0]
    return {t:q['close'][i] for i,t in enumerate(ts) if q['close'][i]}
B={s:bars(s) for s in ['SPY','NVDA','GLD','TSLA','AAPL','META','ES_F','GC_F']}
def rets(sym):
    """clean 1h log returns keyed by start timestamp"""
    ks=sorted(B[sym]); out={}
    for i in range(1,len(ks)):
        d=ks[i]-ks[i-1]
        if not (3000<=d<=4200): continue
        out[ks[i-1]]=math.log(B[sym][ks[i]]/B[sym][ks[i-1]])
    return out
R={s:rets(s) for s in B}
def ratio_rets(a,b):
    common=set(R[a])&set(R[b])
    return {t:R[a][t]-R[b][t] for t in common}
R['NVDA/SPY']=ratio_rets('NVDA','SPY')
R['SPY/GLD']=ratio_rets('SPY','GLD')
def hourvar(sym):
    d={}
    for t,r in R[sym].items():
        et=dt.datetime.fromtimestamp(t,ET)
        if et.weekday()>=5: continue
        d.setdefault(et.hour,[]).append(r)
    out={}
    for h,v in d.items():
        if len(v)<25: continue
        v=sorted(v); k=max(1,int(len(v)*0.005)); v=v[k:len(v)-k]
        out[h]=st.pvariance(v)
    return out
HV={s:hourvar(s) for s in ['SPY','NVDA','GLD','TSLA','AAPL','META','ES_F','GC_F','NVDA/SPY','SPY/GLD']}
# deep-night fill: scale ES night by each asset's pre-market ratio to ES
REF=lambda sym: 'GC_F' if sym=='GLD' else 'ES_F'
def beta2(sym):
    pre=[h for h in range(4,9) if h in HV[sym] and h in HV[REF(sym)]]
    return st.mean([HV[sym][h]/HV[REF(sym)][h] for h in pre]) if pre else 1.0
def tiervar(sym, weekend_ref=False):
    b=beta2(sym); T={'OPEN':[], 'OVERNIGHT':[], 'CLOSED':[]}
    for wd in range(7):
        for h in range(24):
            if (wd==4 and h>=16) or wd>=5: key='CLOSED'
            elif wd==0 and h<9: key='OVERNIGHT'
            elif 9<=h<16: key='OPEN'
            else: key='OVERNIGHT'
            if key=='CLOSED':
                T[key].append(HV[REF(sym)].get(20,0)*b if (wd==6 and h>=18) else 0.0)
            else:
                T[key].append(HV[sym].get(h, HV[REF(sym)].get(h,0)*b))
    return {k:st.mean(v) for k,v in T.items()}
ann=lambda v: 100*math.sqrt(v*24*365)
out={}
print("FAIR-VALUE VOLATILITY BY HOOK TIER (annualised sigma %), 730d of 1h bars, futures filling the dark hours")
print(f"{'asset':11}{'OPEN':>8}{'OVERNIGHT':>11}{'CLOSED':>9}{'sigma_eff':>11}   open/night var")
HRS={'OPEN':35,'OVERNIGHT':77,'CLOSED':56}
for s in ['SPY','NVDA','GLD','TSLA','AAPL','META','NVDA/SPY','SPY/GLD']:
    tvv=tiervar(s); out[s]=tvv
    eff=math.sqrt(sum(tvv[t]*HRS[t] for t in HRS)/168*24*365)
    print(f"{s:11}{ann(tvv['OPEN']):>8.1f}{ann(tvv['OVERNIGHT']):>11.1f}{ann(tvv['CLOSED']):>9.1f}{100*eff:>11.1f}{tvv['OPEN']/max(tvv['OVERNIGHT'],1e-12):>16.2f}x")
json.dump(out, open('tiervar_all_gc.json','w'))
