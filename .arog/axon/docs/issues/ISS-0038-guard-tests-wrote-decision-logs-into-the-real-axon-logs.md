---
id: ISS-0038
title: guard tests wrote decision logs into the real ~/.axon/logs
status: fixed
severity: medium
type: bug
feature: axon-p8
found: 2026-10-01
found_in: test
found_by: P8 live check (196 test lines in ~/.axon/logs)
files: tests/guard.test.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: 248/248; real ~/.axon/logs 197 -> 197 lines across a full run
related: 
---

# ISS-0038: guard tests wrote decision logs into the real ~/.axon/logs

## What happened

tests/guard.test.mjs set AXON_STATE_DIR but not AXON_HOME, so every deny, block and hook error the guard tests produce was appended to the real ~/.axon/logs/<day>.jsonl, which the dashboard and axon-trace read.

## How it was found

Reading ~/.axon/logs after the P8 live run: 196 of 197 lines today have cwd under /var/folders (test temp repos) or null.

## Root cause

The decision log path comes from axonHome() (AXON_HOME), not from AXON_STATE_DIR; the test helper only isolated the state.

## Impact

Fake sessions (session 00000000-...) and denies in the user's real decision log and dashboard after every test run.

## Fix

guard.test.mjs repo() now gives each test its own temporary AXON_HOME as well.

## Verification

Full suite (248 tests) run with line counts taken before and after: ~/.axon/logs 197 -> 197, ~/.axon/events 3 -> 3. The 196 existing test lines were left in place: removing lines from the decision log was refused as audit-log tampering, so that is the user's call (backup-and-filter command in 13-p8-acceptance.md).

## Lessons

Every test that spawns a hook or CLI sets AXON_HOME to a temp folder; isolate the home, not just one subfolder.
