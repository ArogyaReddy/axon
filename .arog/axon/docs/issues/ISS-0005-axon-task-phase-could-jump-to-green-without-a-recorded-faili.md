---
id: ISS-0005
title: axon task phase could jump to GREEN without a recorded failing test
status: fixed
severity: high
type: gap
feature: quality-core
found: 2026-10-01
found_in: review
found_by: final audit of the plan (revision 7)
files: plugins/axon-guard/lib/state.mjs, plugins/axon-guard/bin/axon-task
fixed: 2026-10-01
fix_commit: 
verified_by: tests/guard.test.mjs transition tests (refuse GREEN without test edit + later failing run)
related: 
---

# ISS-0005: axon task phase could jump to GREEN without a recorded failing test

## What happened

The phase CLI accepted any transition, so RED could be skipped by declaring GREEN.

## How it was found

Final plan audit.

## Root cause

Phase state was a plain setter with no preconditions.

## Impact

High: the TDD gate would only be as strong as the model's honesty.

## Fix

Designed (plan 8.2b): `axon task phase` refuses GREEN without a recorded failing new test, and DONE without a passing verify newer than the last edit. Implementation is part of P1.

## Verification

tests/guard.test.mjs: `RED -> GREEN is refused without a test edit followed by a failing run`, `a failing run BEFORE the test edit does not count`, `invalid transitions and phases are refused`.

## Lessons

State machines that guard quality must refuse transitions on evidence recorded by code, never on the model's claim.
