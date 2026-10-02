---
id: ISS-0010
title: test-lock could be bypassed: Claude could run axon unlock-test itself
status: duplicate
severity: high
type: gap
feature: quality-core
found: 2026-10-01
found_in: review
found_by: final audit of the plan (revision 7)
files: global/settings/base.json
fixed: 2026-10-01
fix_commit: 
verified_by: tests/install.test.mjs ask-rule assertion
related: 
---

# ISS-0010: test-lock could be bypassed: Claude could run axon unlock-test itself

## What happened

The design let the session unlock a locked test with a stated reason, which makes the lock meaningless.

## How it was found

Final plan audit, reading the TDD hook rules end to end.

## Root cause

The unlock path had no human in the loop.

## Impact

High: tests could be weakened during GREEN without anyone noticing.

## Fix

`Bash(axon unlock-test *)` is in `permissions.ask` in base.json, so every unlock needs the user's approval; the reason is recorded in EVIDENCE.md (plan 8.2b).

## Verification

tests/install.test.mjs asserts `permissions.ask` contains `Bash(axon unlock-test *)`.

## Lessons

Closed as duplicate: duplicate of ISS-0004: the backfill script ran twice (see the harness issue logged below)

For every enforcement rule, ask who can switch it off.
