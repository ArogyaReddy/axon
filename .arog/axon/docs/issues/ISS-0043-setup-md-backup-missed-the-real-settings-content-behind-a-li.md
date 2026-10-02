---
id: ISS-0043
title: SETUP.md backup missed the real settings content behind a link and ~/.claude.json
status: fixed
severity: medium
type: gap
feature: axon-p9
found: 2026-10-01
found_in: test
found_by: real-machine rehearsal of SETUP.md (2026-10-01)
files: SETUP.md
fixed: 2026-10-01
fix_commit: 
verified_by: real-machine rehearsal 2026-10-01; see 16-real-machine.md
related: 
---

# ISS-0043: SETUP.md backup missed the real settings content behind a link and ~/.claude.json

## What happened

SETUP.md step 2 backed up ~/.claude with ditto, which copies symlinks as links: on a Mac where settings.json is a home-manager link, the real settings content was not in the backup; ~/.claude.json (MCP servers, sign-in state) was not backed up at all.

## How it was found

Backing up this Mac before the rehearsal.

## Root cause

The guide assumed plain files in ~/.claude.

## Impact

The full-fallback promise of the backup did not hold for linked settings.

## Fix

Step 2 now also copies the resolved settings (`cp -L`) and ~/.claude.json.

## Verification

Backup taken on this Mac: ~/claude-backup-2026-10-01 plus -settings.json (content equal to the live file) and -claude.json.

## Lessons

A backup step names what it restores from, and is checked against links.
