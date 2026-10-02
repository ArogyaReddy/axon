---
id: ISS-0017
title: Legacy: ar-tdd spawns tdd-red/green/blue agents that never existed
status: fixed
severity: high
type: bug
feature: legacy-migration
found: 2026-10-01
found_in: review
found_by: component review
files: ~/.claude/agents/ar-tdd.agent.md, plugins/axon-guard
fixed: 2026-10-01
fix_commit: 
verified_by: P1 live E2E evidence: RED before GREEN recorded by hooks; hidden tests 7/7
related: 
---

# ISS-0017: Legacy: ar-tdd spawns tdd-red/green/blue agents that never existed

## What happened

TDD always ran its fallback (one context, nothing enforcing order).

## How it was found

Reading ar-tdd.agent.md and listing ~/.claude/agents.

## Root cause

Phase agent files were referenced but never created.

## Impact

High: the TDD guarantee did not exist.

## Fix

Replaced in axon by hook enforcement (tdd-gate, test-lock); implementation in P1.

## Verification

Live P1 E2E: archived task evidence shows RED run (fail 5) before RED->GREEN, passing run before REFACTOR, passing axon-verify before DONE; hidden tests 7/7.

## Lessons

An enforcement design that depends on files existing must be tested end to end; ar-tdd's never ran isolated and nothing noticed.
