---
id: ISS-0030
title: status line dropped session cost before worktree and PR on narrow terminals
status: fixed
severity: low
type: gap
feature: statusline
found: 2026-10-01
found_in: test
found_by: P3 visual review of rendered status line
files: global/statusline/statusline.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: tests/statusline.test.mjs narrow-terminal test (RED then green); rendered output at 100 columns keeps cost
related: 
---

# ISS-0030: status line dropped session cost before worktree and PR on narrow terminals

## What happened

At COLUMNS=100 the rendered line kept `wt:feature-xyz` and `PR #1234 pending` but dropped `$1.23 1h05m`.

## How it was found

Visual review of the real rendered output at 200/100/60 columns after the status line tests passed.

## Root cause

Plan section 9.4 drop order put cost third (after lines and style), ahead of worktree, PR and rate limits. Cost is one of the user's golden factors, so it should be among the last to go.

## Impact

Session cost invisible on mid-width terminals, exactly when it matters for cost control.

## Fix

`global/statusline/statusline.mjs`: drop order is now lines, style, worktree, PR, rate, flags, cost. Test added first in `tests/statusline.test.mjs` (cost kept and worktree dropped at 100 columns): failed, then passed.

## Verification

`node --test tests/statusline.test.mjs` 13/13; rendered at 100 columns: `payroll │ main* │ Sonnet 5 high │ ▰▰▱▱▱▱▱▱ 23% │ $1.23 1h05m │ PR #1234 pending │ 5h 24%`.

## Lessons

Passing tests do not replace looking at the UI. Priorities in a plan are hypotheses; check them against the golden factors when the real output is visible.
