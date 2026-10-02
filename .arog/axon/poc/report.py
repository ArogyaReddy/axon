import json, statistics as st, sys
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
rows = [r for r in rows if r["run"] >= 1]
print(f"{'approach':9} {'run':>3} {'hidden':>6} {'cost$':>7} {'wall_s':>6} {'calls':>5} {'turns':>5} {'out_tok':>7} {'c_write':>8} {'c_read':>9}  notes")
for r in sorted(rows, key=lambda r: (r["approach"], r["run"])):
    print(f"{r['approach']:9} {r['run']:>3} {r['hidden_pass']}/7{'':>2} {r['cost_usd']:>7.3f} {r['wall_s']:>6} {r['calls']:>5} {r['turns']:>5} {r['output']:>7} {r['cache_write']:>8} {r['cache_read']:>9}  {'; '.join(r['notes'])[:90]}")
print()
print(f"{'approach':9} {'pass_rate':>9} {'cost_mean':>9} {'cost_min':>8} {'cost_max':>8} {'wall_mean':>9} {'turns_mean':>10} {'tokens_mean':>11}")
for a in ["inline", "cater", "pipeline"]:
    rs = [r for r in rows if r["approach"] == a]
    if not rs: continue
    tok = [r["input"] + r["output"] + r["cache_write"] + r["cache_read"] for r in rs]
    print(f"{a:9} {sum(r['hidden_pass'] for r in rs)}/{7*len(rs):<6} {st.mean(r['cost_usd'] for r in rs):>9.3f} {min(r['cost_usd'] for r in rs):>8.3f} {max(r['cost_usd'] for r in rs):>8.3f} {st.mean(r['wall_s'] for r in rs):>9.0f} {st.mean(r['turns'] for r in rs):>10.1f} {st.mean(tok):>11.0f}")
