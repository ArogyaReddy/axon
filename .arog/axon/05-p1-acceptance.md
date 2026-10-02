# 05 - P1 acceptance: the quality core, live (2026-10-01)

Same task and hidden tests as the POC (`04-poc-results.md`), run by real Claude (Sonnet) with the `/tdd` skill and the
`axon-guard` hooks loaded (`--plugin-dir`), in a throwaway copy of the project with its own state folder.

## Result

| Check | Result |
|---|---|
| Hidden acceptance tests | **7/7** (buggy baseline 1/7) |
| Evidence recorded by code (not by the model) | Task 1: run with 5 failing tests (seq 3) > RED->GREEN (seq 4) > passing run (seq 9) > GREEN->REFACTOR (seq 10) > passing `axon-verify` > DONE (seq 12) |
| Verifier agent | Found a floating-point rounding bug in the first implementation (`200 * 0.0725 = 14.499999999999998`, should round to 15). That version had passed all 7 hidden tests and its own tests |
| Second cycle | Task 2 (regression): failing run 8 pass / 1 fail (seq 18) > GREEN (seq 19) > passing run (seq 21) > DONE (seq 24) |
| Issue tracker | Blocked: wrong command names (ISS-0023, now fixed) |
| Cost / time | $2.11 / 394 s (plain inline POC: $0.29 / 68 s) |

## Where the cost went

The hooks cost no model tokens. The extra cost came from the process the skill asks for: writing tests first, a full
`axon-verify`, two `verifier` agent runs (the second one ran an exact-arithmetic scan), and a complete second TDD cycle
for the bug the verifier found. The run's cost breakdown per subagent is not reported by `claude -p`; the total is measured.

## What it proves

1. The enforcement works live: hooks fired on 2.1.197, phase changes were refused or allowed from recorded evidence, and
   the archived evidence shows RED before GREEN in both cycles.
2. Hidden tests alone are not enough for money logic: an implementation passing 7/7 still had a half-cent rounding defect.
   The independent verifier caught it.
3. The quality gain is paid for mainly by the verifier and the extra cycle, not by the hooks.

## Decision for the default

- Hooks, `axon-task`, `axon-verify`: always on (zero model cost).
- `verifier`: always for money, data, security and production-path code (payroll is money); opt-in with `verify --deep`
  for low-risk changes (docs, UI copy, tooling). Encoded in the `tdd` skill.
