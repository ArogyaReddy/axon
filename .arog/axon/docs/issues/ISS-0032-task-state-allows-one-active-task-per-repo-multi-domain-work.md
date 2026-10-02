---
id: ISS-0032
title: task state allows one active task per repo; multi-domain work in one monorepo checkout collides
status: open
severity: medium
type: gap
feature: guard-hooks
found: 2026-10-01
found_in: review
found_by: P4 agent-council run on H-Q3 (4 of 5 advisors)
files: plugins/axon-guard/lib/state.mjs
fixed: 
fix_commit: 
verified_by: 
related: 
---

# ISS-0032: task state allows one active task per repo; multi-domain work in one monorepo checkout collides

## What happened

startTask refuses a second task while one is active (plugins/axon-guard/lib/state.mjs startTask), and state is keyed by repo root only. In adp-e-product one developer may work payroll and HR in the same checkout.

## How it was found

The P4 live council on H-Q3: four of five advisors independently raised it, citing state.mjs:178-186.

## Root cause

_TODO_

## Impact

Blocks or confuses tdd-gate enforcement for multi-domain work in the monorepo; must be settled before tdd-gate is on by default there (P6).

## Fix

_TODO_

## Verification

_TODO_

## Lessons

_TODO_
