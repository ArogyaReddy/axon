---
id: ISS-0042
title: Write(path) permission rules are never matched; only Edit(path) rules are
status: fixed
severity: medium
type: bug
feature: axon-p9
found: 2026-10-01
found_in: test
found_by: real-machine rehearsal of SETUP.md (2026-10-01)
files: global/settings/base.json
fixed: 2026-10-01
fix_commit: 
verified_by: real-machine rehearsal 2026-10-01; see 16-real-machine.md
related: 
---

# ISS-0042: Write(path) permission rules are never matched; only Edit(path) rules are

## What happened

Claude Code 2.1.286 warns at start: Write(~/.axon/docs/**) (allow) and Write(**/CHANGELOG.md) (deny) are not matched by file permission checks; only Edit(path) rules are.

## How it was found

`--debug-file` log of a session with the installed settings.

## Root cause

File writes are governed by Edit(path) rules; Write(path) rules were written by analogy and never checked.

## Impact

None in practice (the matching Edit rules existed), but the deny rule looked like protection and was not; noise in every session's log.

## Fix

Removed the Write(...) rules from base.json; a test forbids Write(path) rules and checks Edit(**/CHANGELOG.md) stays denied.

## Verification

Debug log of a fresh 2.1.286 session: 0 warnings about permissions, hooks or plugins; settings contain no Write( rule.

## Lessons

Read Claude Code's own warnings (debug log) after changing settings.
