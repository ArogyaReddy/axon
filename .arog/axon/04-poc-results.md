# 04 - POC: Inline vs CATER vs Pipeline (measured 2026-09-30)

All evidence is in `poc/`: the harness (`run.mjs`), the buggy project (`fixture/`), the hidden acceptance tests
(`hidden/hidden.test.cjs`), what each run changed (`runs/`), and every measured call (`results.jsonl`).

## Setup (identical for every approach)

- Task: a 5-file Node project with a two-part bug (tax charged before the discount; cents rounded down) and a feature
  (SAVE10/SAVE25 percentage codes, case-insensitive codes).
- Same model (`sonnet`), same tools, same permissions, no user hooks or MCP (`--setting-sources project --strict-mcp-config`).
- Correctness judged only by 7 hidden acceptance tests no approach ever saw. Buggy baseline: 1/7.
- Stopped after one run per approach to limit spend (total experiment cost: $3.49).

## Results

| Approach | How it ran | Hidden tests | Cost | Time | Calls |
|---|---|---|---|---|---|
| Inline | One session: analyse, test, fix | 7/7 | **$0.285** | **68 s** | 1 |
| CATER | Orchestrator + analyst, test-writer, builder, verifier agents | 7/7 | $1.515 (5.3x) | 346 s (5.1x) | 1 (+4 agents) |
| Pipeline run 0 | Script: plan > tests > build, code gates between phases | 7/7 | $0.547 (1.9x) | 104 s (1.5x) | 3 |
| Pipeline run 1 | Same script | 7/7 code, but stuck | $1.145 (4.0x) | 459 s (6.8x) | 5 |

Fixed cost of any fresh `claude -p` call: about 21k tokens of system prompt and tools. First call $0.136; a repeat within the
cache window $0.049.

## What happened in pipeline run 1

The plan phase wrote a test case with a wrong expected total (9094; correct is 10000 - 500 + 594 = 10094). The code was right
(hidden tests 7/7), but the pipeline rule "builder must never modify tests" plus an automatic retry loop made 3 build attempts
against an impossible target: $0.85 and 6 minutes wasted. Inline and CATER sessions can notice a wrong test and fix it; a script
cannot judge that.

## Conclusions

1. **Inline is cheapest and fastest at equal quality** for a single well-defined task.
2. **CATER for everything is the most expensive**: 5x cost and 5x time for the same result. Every agent re-reads the code, and the
   orchestrator adds a layer. This difference is structural, not noise, so one run is enough to show it.
3. **Pipelines do not save cost** (2x to 4x inline here). My earlier claim that they are the cheapest for repeatable flows was wrong.
   Their real value is **control**: code proved the new tests failed first, that the test phase did not touch `src/`, and that the
   build did not touch the tests. Inline and CATER claimed TDD, but nothing enforced it.
4. **Rigid pipelines amplify one bad phase output** unless a judgment step can declare "the test itself is wrong".

## Limits of this proof

One run per approach and one small task. It is strong evidence for big structural differences (CATER 5x) and weak for small ones
(the two pipeline runs differed by 2x). On a large codebase or a long session, keeping heavy work out of the main context matters more,
which favours agents for verbose or parallel work.
