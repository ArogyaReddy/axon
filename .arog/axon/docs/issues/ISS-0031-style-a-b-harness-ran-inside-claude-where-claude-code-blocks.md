---
id: ISS-0031
title: style A/B harness ran inside ~/.claude where Claude Code blocks edits; all 6 runs invalid
status: fixed
severity: medium
type: bug
feature: measurement
found: 2026-10-01
found_in: test
found_by: hidden tests 1/7 on every run, both variants
files: poc/style-ab.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: rerun outside ~/.claude: 6/6 runs valid (src changed, 0 denials), 7/7 hidden tests each; harness refuses paths under .claude
related: 
---

# ISS-0031: style A/B harness ran inside ~/.claude where Claude Code blocks edits; all 6 runs invalid

## What happened

The first output-style A/B (default vs lean, 3 runs each, about $1.25) scored 1/7 hidden tests on every run of both variants. No file in any run folder had changed.

## How it was found

The hidden score was far below the original POC (7/7) and identical across variants. `diff -rq fixture <run>` showed no changes; a reproduction returned "The edit to test/invoice.test.js was blocked as a sensitive file" with Edit in `permission_denials`.

## Root cause

`poc/style-ab.mjs` created run folders under `poc/runs/`, which is inside `~/.claude`. Claude Code treats files under `~/.claude` as sensitive and blocks edits there in `-p` mode, so every run measured Claude giving up. Second cause: the harness had no validity check, so runs that did no work were recorded as results.

## Impact

About $1.25 of runs and 10 minutes wasted; had the totals been taken at face value, the style decision would have been made on runs that did no work.

## Fix

`poc/style-ab.mjs`: run folders go to `AXON_AB_DIR` or the OS temp folder and the harness refuses any path under `.claude`; each record has `valid` (src changed and no error) and `denials`. Invalid results kept as `poc/style-ab.invalid.jsonl` for the record.

## Verification

Rerun of the 6 runs outside ~/.claude (see 08-p3-acceptance.md, style A/B).

## Lessons

A measurement harness must prove the work happened (a precondition check), not only record cost. Live tests always run outside ~/.claude.
