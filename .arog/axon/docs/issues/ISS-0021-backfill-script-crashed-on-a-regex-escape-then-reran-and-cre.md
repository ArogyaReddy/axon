---
id: ISS-0021
title: Backfill script crashed on a regex escape, then reran and created duplicate issues
status: fixed
severity: low
type: bug
feature: issue-tracker
found: 2026-10-01
found_in: implementation
found_by: first real use of axon issue (backfill)
files: 
fixed: 2026-10-01
fix_commit: 
verified_by: axon issue list after resume; INDEX.md counts
related: 
---

# ISS-0021: Backfill script crashed on a regex escape, then reran and created duplicate issues

## What happened

The script that logged the first issues crashed at item 6, and a failed in-place patch let the original script run again from the start, creating ISS-0007..0012 as duplicates of ISS-0001..0006.

## How it was found

`axon issue list` showed 12 issues; `INDEX.md` counts and duplicate titles.

## Root cause

(1) `re.sub` interprets backslash escapes in the replacement text, and the ISS-0006 text contained a literal backslash-u sequence. (2) The fix was applied by patching the script through a shell heredoc whose quoting broke, so the unpatched script ran again; the script was not idempotent.

## Impact

Low: 6 duplicate records, closed as duplicates; ids are never reused, so history stays truthful.

## Fix

Plain `str.replace` instead of `re.sub` for the narrative; the script was edited with the editor tool, not shell patching; the resume step targets existing ids explicitly. Duplicates closed with `axon issue close --as duplicate`.

## Verification

`axon issue list` shows every intended issue exactly once plus 6 closed duplicates; INDEX.md counts match.

## Lessons

Scripts that create records must be idempotent (check for an existing title before creating). Applied: `axon issue new` now refuses a second issue with the same title unless `--force` (for a regression with `--related`); test `a second issue with the same title is refused unless forced (ISS-0021)`.
