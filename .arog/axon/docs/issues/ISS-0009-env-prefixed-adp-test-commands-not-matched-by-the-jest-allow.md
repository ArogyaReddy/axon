---
id: ISS-0009
title: Env-prefixed ADP test commands not matched by the jest allow rule
status: duplicate
severity: medium
type: gap
feature: p0-installer
found: 2026-10-01
found_in: test
found_by: P0 spike S5
files: global/settings/base.json
fixed: 2026-10-01
fix_commit: 
verified_by: ADR-0003 spike S5b; tests/install.test.mjs rule assertion
related: 
---

# ISS-0009: Env-prefixed ADP test commands not matched by the jest allow rule

## What happened

`Bash(npx jest *)` does not allow `TEST_BUSINESS_DOMAIN=hr npx jest`, the form every ADP test run uses.

## How it was found

Spike S5: `Bash(node *)` denied `FOO=1 node --version` in dontAsk mode; S5b `Bash(FOO=* node *)` allowed it.

## Root cause

Permission rules match the command text from its start; an env assignment prefix is part of that text.

## Impact

Medium: a permission prompt on every ADP test run.

## Fix

Added `Bash(TEST_BUSINESS_DOMAIN=* npx jest *)` to `permissions.allow` in base.json (narrow form, not `Bash(* ...)`).

## Verification

Spike S5b; install test asserts the rule is present.

## Lessons

Closed as duplicate: duplicate of ISS-0003: the backfill script ran twice (see the harness issue logged below)

Test permission rules with the exact command shapes of each stack.
