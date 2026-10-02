---
name: go-until-done
description: Run one task to a verified finish unattended - DONE WHEN checks, RED > GREEN > VERIFY per chunk, an honest BLOCKED instead of a fake pass. Use for "keep going", "don't stop", "go until done".
argument-hint: "<task and what done looks like> [--max-iterations N]"
---

# Go until done (autonomous, evidence-gated)

You keep going without asking for approval between steps. The axon-guard hooks still apply: RED before GREEN, tests
locked, no DONE without a passing `axon-verify`. Persistence never means cheating.

## Always-on boundaries

Stay inside the task's scope (say so if you must step out). Never push to a remote, deploy, or touch production. Never use
real credentials beyond what the task requires. Never run a destructive or irreversible command unless it IS the task.
Never fake a pass.

## Steps

0. **Defer to a specific skill** when one exists for this kind of work (for example `ui-acceptance` for UI stories, ADP
   skills for event specs). Note the decision.
1. **Scope (no pause):** what exactly is asked; what exists (read it); what "done" means as a runnable check (derive one if
   missing and state it); task-specific boundaries. A part with two materially different valid readings becomes BLOCKED at
   once; do not guess intent for something consequential.
2. **Plan:** chunks ordered foundations first, each with `DONE WHEN: <exact command> -> <expected result>`.
3. **Per chunk:** `axon-task start <chunk>`; RED (failing test or reproduced failure, real output captured);
   `axon-task phase GREEN`; minimal change; run the DONE WHEN check. On failure: read the real error, trace it to its cause,
   form a hypothesis you can falsify, check it, then fix. Each retry must use new evidence. After `--max-iterations`
   (default 5) cycles the chunk becomes BLOCKED with the best root-cause understanding, and you move on.
   When green: `axon-verify`, `axon-task phase DONE`.
4. **Integration verify:** one end-to-end check of the whole task (full suite, build). A regression becomes a new chunk.
5. **Self-skeptical re-check before writing DONE anywhere:** recount every number you report; re-check that boundaries were
   honoured; re-run any claim you have not seen with your own eyes in this pass. For money, data or security code, spawn the
   `verifier` agent with the DONE WHEN criteria and fix what it proves.
6. **Report** to `${AXON_DOCS_DIR:-~/.claude/docs}/reports/<YYYY-MM-DD>-<slug>.md`: status (DONE_VERIFIED | DONE_WITH_DEFERRED_ITEMS | BLOCKED),
   scope, plan, per-chunk results with the real command and output, bugs found and fixed, deferred or blocked items and why,
   integration verify output, self-check findings. Log every bug found with `issue-tracker`.
7. **Reply** with the status, the report path, the single most important verified command and output, and the deferred
   list.

## The persistence rule

Keep going until the criteria pass. Missing imports, wrong paths, type errors, failing tests caused by your code: fix them
and continue. Never make a check pass by weakening or skipping a test, changing the acceptance criteria, hardcoding expected
values or silencing an error. If a test itself is wrong, record why and request `axon-unlock-test` (the user approves).
Stop only when the criteria pass or the blocker is outside your control (missing access, a decision only the user can make,
a destructive or production action).
