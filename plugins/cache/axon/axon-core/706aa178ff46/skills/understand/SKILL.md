---
name: understand
description: Analyse an issue, bug or change in existing code before any code is written - read the real code, prove the root cause, decide where and how to fix, define acceptance criteria and before/after tests - and write a plan doc, then STOP for the user's GO. Use for Trac tickets, bug reports, review comments, or "what would it take to change X".
argument-hint: "<description | trac:TICKET | file:PATH | git:REF>"
hooks:
  Stop:
    - hooks:
        - type: command
          command: "node \"${CLAUDE_PLUGIN_ROOT}/bin/axon-plan-check\" --latest --hook --since-minutes 120"
---

# Understand (analyse > plan > show > GO)

Order is mandatory: **analyse, write the plan doc, show it, wait for GO.** No tests or code before GO.

## 1. Input

| Input | Do |
|---|---|
| `trac:NNNN` | read the ticket and comments (ADP `trac-management` skill if available) |
| `file:PATH` | read the file as the issue source |
| `git:REF` | `git diff REF` and read every changed file |
| plain text | use it as the description; combine sources if several are given |

## 2. Analyse (read, never recall)

1. Find the affected code: search by symbol, string, event canonical or i18n key. Use the built-in Explore agent only when
   the search space is large; read the relevant files yourself in full, plus one sibling file for the local pattern.
2. Apply the project's rules (CLAUDE.md, `.claude/rules/`). For adp-e-product, the axon-adp platform patterns apply:
   event lifecycle order, i18n en+es, security-sourced fields, uuid only in setOutput, bi-temporal fields, GraphQL query vs
   mutation endpoints, CloudWatch log groups, scoped local tests, shared imports, meta build freshness.
3. **Bug:** reproduce it or state exactly why you cannot. Write the gap as "when X, I observe Y, I expected Z". Form 2-3
   hypotheses, each with a testable prediction; test the cheapest first, one variable at a time; keep going until the full
   causal chain is proven. A cause you cannot demonstrate is a hypothesis, and the plan must say so.
4. **Change/feature on existing code:** map what exists today and what the change collides with.
5. Never ask the user what the code can answer. Ask only what blocks the direction, 2-3 closed questions at most.

## 3. Write the plan doc

- Create it with `axon-plan-new <slug>` (slug like `organizationPolicy.create-bug-2026-10-01`). It copies the 11-section
  template into the plans folder and prints the path. Edit that file and fill every placeholder; keep every section.
- Acceptance criteria: observable, each with exact input and expected output (for money, the exact cents).
- Then run `axon-plan-check <plan path>` and fix every problem it lists. (A Stop hook runs the same check; you cannot
  finish with an incomplete plan.)

## 4. Show and stop

Post exactly this, then stop:

```
PLAN: <path>
UNDERSTAND: <one sentence>
ROOT CAUSE: <proven cause, or "hypothesis: ..." if not proven>
WHAT CHANGES: <files and what changes in each>
ACCEPTANCE: <the criteria, one line each>
TEST BEFORE / AFTER: <one line each>
RECOMMEND: <option and why>

Say GO to build it test-first (/tdd). Say EDIT <section> to change the plan. Say STOP to cancel.
```

| User says | You do |
|---|---|
| GO | hand over to `tdd` with the plan path |
| EDIT <section> | change that section in the file, run `axon-plan-check`, re-post the block |
| STOP | nothing more |

Log every defect you found that is not part of this plan with the `issue-tracker` skill.
