---
id: ISS-0018
title: Legacy: 8 files hardcode /Users/gadea
status: fixed
severity: medium
type: bug
feature: legacy-migration
found: 2026-10-01
found_in: review
found_by: grep during analysis
files: 
fixed: 2026-10-01
fix_commit: 
verified_by: grep /Users/gadea in loaded ~/.claude config: 0 files; legacy archived
related: 
---

# ISS-0018: Legacy: 8 files hardcode /Users/gadea

## What happened

Legacy skills, agents and settings break on any other machine.

## How it was found

`grep -rl '/Users/gadea' ~/.claude/...` returned 8 files.

## Root cause

Paths written literally instead of from config or `$HOME`.

## Impact

Medium.

## Fix

Replaced, not patched: axon's skills and agents take paths from `$HOME`, AXON_HOME and project config. P9 `axon legacy archive` moved the legacy files out of ~/.claude into ~/.axon/legacy/2026-10-01T17-22-09Z (kept, not deleted).

## Verification

`grep -rl /Users/gadea` over ~/.claude/{skills,agents,commands,rules}, CLAUDE.md and settings.json: 0 files (the 6 remaining hits are in the archive). axon's structure test rejects `/Users/` paths in shipped files.

## Lessons

Paths in shared config come from `$HOME` or config, never literals; a structure test enforces it.
