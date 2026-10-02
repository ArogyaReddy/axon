---
id: ISS-0016
title: POC pipeline: planner wrote a wrong expected value, test lock caused 3 useless retries
status: fixed
severity: medium
type: risk
feature: quality-core
found: 2026-10-01
found_in: test
found_by: POC pipeline run 1
files: poc/runs/pipeline-1, plugins/axon-guard/lib/state.mjs, plugins/axon-guard/bin/axon-unlock-test
fixed: 2026-10-01
fix_commit: 
verified_by: tests/guard.test.mjs unlock test; axon-unlock-test in permissions.ask
related: 
---

# ISS-0016: POC pipeline: planner wrote a wrong expected value, test lock caused 3 useless retries

## What happened

The plan phase wrote total 9094 (correct 10094); the build could not edit tests and retried 3 times ($0.85).

## How it was found

poc/runs/pipeline-1 `node --test` output.

## Root cause

A rigid rule (never edit tests) with no judgment step that can declare a test wrong.

## Impact

Medium: wasted cost; in a real run, a false failure.

## Fix

Designed: test-lock allows an unlock with the user's approval and a recorded reason; pipelines keep a retry cap and a judgment step (plan D15, 8.2b). Implementation in P1.

## Verification

tests/guard.test.mjs `unlock needs a reason, then allows that one test file and records the reason`; base.json puts `axon-unlock-test` in ask so the user approves.

## Lessons

A strict rule needs a controlled, recorded escape hatch, or it turns one bad input into an endless loop.
