# [Title]

**Date:** [YYYY-MM-DD] | **Type:** [Bug | Feature | Refactor | Review comment] | **Source:** [trac:NNNN | file | git ref | user report]
**Affected:** [module, event canonical, files]

---

## 1. UNDERSTAND

[One paragraph: what is being asked, or what is wrong, what was expected, what happens instead. Facts you read, not memory.]

## 2. ROOT CAUSE

[Bug: the proven causal chain - file, line, current value, why it is wrong. Feature: the current state of the code this builds on.]

## 3. WHERE

| File | Line / symbol | Current | Proposed |
|---|---|---|---|
| [path] | [line] | [current] | [proposed] |

## 4. HOW

**Option A (recommended):** [the approach and why]
**Option B:** [the alternative and why not]
**Out of scope:** [what this deliberately does not do]

## 5. ACCEPTANCE CRITERIA

Each criterion is observable, with the exact input and expected output. `tdd` writes one test per criterion.

<!-- criteria -->

## 6. TEST BEFORE

[Steps or command that reproduce the problem today, and the wrong output you expect to see.]

## 7. TEST AFTER

[Commands and checks that prove it works: new tests, axon-verify, manual checks, edge cases (empty, boundaries, rounding, locale).]

## 8. IMPACT

| Aspect | Risk | Notes |
|---|---|---|
| Scope | [Low/Medium/High] | [files, modules] |
| Data / migration | [No/Yes] | [details] |
| Breaking change | [No/Yes] | [mitigation] |

## 9. PLATFORM CONTEXT

[Only what applies, from the project's rules (for adp-e-product: GraphQL, DSQL, CloudWatch, i18n en+es, event lifecycle, E2E flow). Write "Not applicable" otherwise.]

## 10. TRACKER

| Task | Status | Evidence |
|---|---|---|
| [task] | [TODO / DONE] | [test or command output] |

## 11. FILE CHANGE SUMMARY

| File | Change |
|---|---|
| [path] | [change] |
