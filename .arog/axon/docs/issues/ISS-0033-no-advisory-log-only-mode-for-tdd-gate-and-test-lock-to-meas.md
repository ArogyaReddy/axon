---
id: ISS-0033
title: no advisory (log-only) mode for tdd-gate and test-lock to measure false blocks before enforcing
status: open
severity: low
type: gap
feature: guard-hooks
found: 2026-10-01
found_in: review
found_by: P4 agent-council peer review on H-Q3
files: plugins/axon-guard/lib/switches.mjs
fixed: 
fix_commit: 
verified_by: 
related: 
---

# ISS-0033: no advisory (log-only) mode for tdd-gate and test-lock to measure false blocks before enforcing

## What happened

Hook switches are on or off. There is no mode where tdd-gate/test-lock log what they would deny without blocking.

## How it was found

The P4 live council peer review: no advisor proposed it; reviewers flagged that the rollout debate argued from priors instead of measured false-block rates.

## Root cause

_TODO_

## Impact

Rolling out enforcement to a team (adp-e-product) without data on false blocks; an advisory mode would give that data within a sprint (P6).

## Fix

_TODO_

## Verification

_TODO_

## Lessons

_TODO_
