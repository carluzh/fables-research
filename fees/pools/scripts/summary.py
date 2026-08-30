import json, sys, datetime as dt, statistics as st
from zoneinfo import ZoneInfo
import os as _os
_D = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'data')
_open = open
def open(f, *a, **k):
    if isinstance(f, str) and f.startswith('data/'):
        f = _os.path.join(_D, f[5:])
    return _open(f, *a, **k)

ET=ZoneInfo('America/New_York')
C=json.load(open('data/census.json')); BY={p['id'].lower():p for p in C['out']}
try: PF={r['id'].lower():r for r in json.load(open('data/protofee.json'))}
except Exception: PF={}
def sess(h):
    t=dt.datetime.fromtimestamp(h,ET)
    if t.weekday()>=5 or (t.weekday()==4 and t.hour>=16): return 'CLOSED'
    if t.weekday()==0 and t.hour<9: return 'OVERNIGHT'
    return 'OPEN' if 9<=t.hour<16 else 'OVERNIGHT'
print(f'{"asset":6}{"session":11}{"hrs":>5}{"mkt vol$":>15}{"mkt fee":>9}{"our fee":>9}{"x mkt":>7}{"mkt APR%":>10}{"our APR%":>10}{"x mkt":>7}{"our share%":>12}{"our depth%":>12}')
for f,asset in [('data/spy_series.json','SPY'),('data/nvda_series.json','NVDA'),('data/meta_series.json','META'),('data/gld_series.json','GLD')]:
    try: S=json.load(open(f))
    except Exception: continue
    series=S['series']; POOLS=list(series.keys())
    HRS=sorted({r['h'] for k in POOLS for r in series[k]['rows']})[-48:]
    def pid(k):
        m=series[k]['meta']; return (m.get('id') or m.get('addr') or '').lower()
    def tvl(k):
        m=series[k]['meta']
        if m.get('tvl'): return float(m['tvl'])
        return (BY.get(pid(k)) or {}).get('tvlUsd') or 0.0
    def lps(k,p):
        r=PF.get(pid(k))
        if not r or not r.get('protocolFeeRaw'): return 1.0
        raw=r['protocolFeeRaw']
        if r.get('proto')=='v3':
            n=raw&0xF; return (1-1/n) if n else 1.0
        p0=raw&0xFFF; return max(0.0,1-p0/p) if p else 1.0
    for g in ['ALL','OPEN','OVERNIGHT','CLOSED']:
        hs=HRS if g=='ALL' else [h for h in HRS if sess(h)==g]
        if not hs: continue
        tv=tf=tfn=ttvl=tvirt=0; ov=of=ovirt=otvl=0
        for k in POOLS:
            rs=[r for r in series[k]['rows'] if r['h'] in hs]
            v=sum(r['vol'] for r in rs); fe=sum(r['fee'] for r in rs)
            vi=[r['virtual'] for r in rs if r['virtual']]; virt=st.median(vi) if vi else 0
            pp=(1e6*fe/v) if v else 0
            tv+=v; tf+=fe; tfn+=fe*lps(k,pp); ttvl+=tvl(k); tvirt+=virt
            if 'FABLES' in k: ov,of,ovirt,otvl=v,fe,virt,tvl(k)
        n=len(hs)
        mf=(1e6*tf/tv) if tv else 0; ma=(tfn*(8760/n)/ttvl*100) if ttvl else 0
        ofee=(1e6*of/ov) if ov else 0; oa=(of*lps([k for k in POOLS if 'FABLES' in k][0],ofee)*(8760/n)/otvl*100) if otvl else 0
        print(f'{asset:6}{g:11}{n:>5}{tv:>15,.0f}{mf:>9,.0f}{ofee:>9,.0f}{(ofee/mf if mf else 0):>7.2f}{ma:>10.1f}{oa:>10.1f}{(oa/ma if ma else 0):>7.2f}{(100*ov/tv if tv else 0):>11.2f}%{(100*ovirt/tvirt if tvirt else 0):>11.2f}%')
    print()
