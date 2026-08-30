# Pre-flight for a chain scan: say which sessions a window of N hours ending now would contain,
# BEFORE spending 30 minutes scanning it. Added after a 24h NVDA window landed entirely inside a
# weekend and had to be thrown away.
#
#   python preflight.py <hours> [head_unix_ts]
import sys, datetime as dt
from zoneinfo import ZoneInfo

ET = ZoneInfo('America/New_York')
HOURS = int(sys.argv[1]) if len(sys.argv) > 1 else 48
HEAD = int(sys.argv[2]) if len(sys.argv) > 2 else int(dt.datetime.now(dt.timezone.utc).timestamp())


def sess(ts):
    t = dt.datetime.fromtimestamp(ts, ET)
    if t.weekday() >= 5 or (t.weekday() == 4 and t.hour >= 16):
        return 'CLOSED'
    if t.weekday() == 0 and t.hour < 9:
        return 'OVERNIGHT'
    return 'OPEN' if 9 <= t.hour < 16 else 'OVERNIGHT'


start = HEAD - HOURS * 3600
counts = {'OPEN': 0, 'OVERNIGHT': 0, 'CLOSED': 0}
days = {'OPEN': set(), 'OVERNIGHT': set(), 'CLOSED': set()}
for i in range(HOURS):
    ts = start + i * 3600
    s = sess(ts)
    counts[s] += 1
    days[s].add(dt.datetime.fromtimestamp(ts, ET).date())

print(f'window {HOURS}h')
print(f'  from {dt.datetime.fromtimestamp(start, ET).strftime("%a %Y-%m-%d %H:%M ET")}')
print(f'  to   {dt.datetime.fromtimestamp(HEAD, ET).strftime("%a %Y-%m-%d %H:%M ET")}')
print()
for s in ['OPEN', 'OVERNIGHT', 'CLOSED']:
    print(f'  {s:10} {counts[s]:>4} hours over {len(days[s])} calendar days')
print()
full = counts['OPEN'] // 7
if counts['OPEN'] == 0:
    print('  VERDICT: REJECT. No cash-session hours at all. This window cannot answer the question.')
elif counts['OPEN'] < 7:
    print(f'  VERDICT: WEAK. Only {counts["OPEN"]} session hours, not one complete session (7).')
    print('           Widen until at least one full session is inside, and do not draw a session')
    print('           conclusion from it: use the 7d buckets for that.')
else:
    print(f'  VERDICT: OK. {counts["OPEN"]} session hours across {len(days["OPEN"])} day(s), so n={len(days["OPEN"])} sessions.')
    print('           Still use the 7d buckets for the session comparison; this window is for depth.')
