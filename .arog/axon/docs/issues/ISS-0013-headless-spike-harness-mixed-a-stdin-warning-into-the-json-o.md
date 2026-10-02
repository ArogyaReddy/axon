---
id: ISS-0013
title: Headless spike harness mixed a stdin warning into the JSON output
status: fixed
severity: low
type: bug
feature: p0-installer
found: 2026-10-01
found_in: test
found_by: P0 spike run
files: 
fixed: 2026-10-01
fix_commit: 
verified_by: ADR-0003 rerun output
related: 
---

# ISS-0013: Headless spike harness mixed a stdin warning into the JSON output

## What happened

All 9 spike results were unparseable on the first run (paid calls wasted).

## How it was found

Harness printed NON-JSON for every call.

## Root cause

`claude -p` waits 3 s for stdin and prints a warning; the harness captured stderr together with stdout.

## Impact

Low: about $0.45 spent twice.

## Fix

Run with `< /dev/null 2>/dev/null` (scratchpad spike/run.sh).

## Verification

Rerun produced clean JSON for all 9 spikes (ADR-0003).

## Lessons

Smoke-test a harness with one call before running a batch.
