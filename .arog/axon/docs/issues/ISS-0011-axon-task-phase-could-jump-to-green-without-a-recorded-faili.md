---
id: ISS-0011
title: axon task phase could jump to GREEN without a recorded failing test
status: duplicate
severity: high
type: gap
feature: quality-core
found: 2026-10-01
found_in: review
found_by: final audit of the plan (revision 7)
files: 
fixed: 
fix_commit: 
verified_by: 
related: 
---

# ISS-0011: axon task phase could jump to GREEN without a recorded failing test

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

_TODO_

## Lessons

Closed as duplicate: duplicate of ISS-0005: the backfill script ran twice (see the harness issue logged below)

_TODO_
