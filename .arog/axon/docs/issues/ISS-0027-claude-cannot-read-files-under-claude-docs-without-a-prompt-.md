---
id: ISS-0027
title: Claude cannot read files under ~/.claude/docs without a prompt (issues, plans, reports)
status: fixed
severity: high
type: gap
feature: core-skills
found: 2026-10-01
found_in: test
found_by: P1b git-push live run: Read denials on the issue file
files: global/settings/base.json
fixed: 2026-10-01
fix_commit: 
verified_by: install test Read rule; live rerun with real permissions: no Read denials
related: 
---

# ISS-0027: Claude cannot read files under ~/.claude/docs without a prompt (issues, plans, reports)

## What happened

Claude could not read the issue file it had just created under ~/.claude/docs (outside the project) without a permission prompt.

## How it was found

P1b git-push live run: Read denials on the issue file.

## Root cause

base.json allowed Edit and Write under ~/.claude/docs but not Read.

## Impact

High: every plan, issue and report under ~/.claude/docs would prompt on read in interactive sessions.

## Fix

base.json allows `Read(~/.claude/docs/**)`.

## Verification

Install test asserts the rule (failed first); live rerun with the real axon permissions (generated from base.json) had no Read denials on docs.

## Lessons

Run live tests with the real permission set generated from base.json, not hand-picked flags.
