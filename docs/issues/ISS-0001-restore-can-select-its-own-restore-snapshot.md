---
id: ISS-0001
title: Restore can select its own restore snapshot
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer repeated-restore test
files: vscode-settings-templates/vscode-settings-templates
fixed: 2026-10-01
fix_commit:
verified_by: isolated repeated-restore regression plus /bin/sh vscode-settings-templates/verify.sh
related:
---

# ISS-0001: Restore can select its own restore snapshot

## What happened

The restore menu searched for `settings-*.json`, which also matched the `settings-before-restore-*.json` snapshot created during a restore. A later restore could therefore choose a restore snapshot instead of the latest normal CLI backup.

## How it was found

The independent reviewer reproduced it with an isolated repeated-restore test before publication.

## Root cause

`restore_latest()` used one broad glob for both normal backups and pre-restore safety snapshots. The snapshot naming pattern overlapped the candidate pattern.

## Impact

Users could restore the wrong settings state and believe a previous template had been recovered.

## Fix

Changed `restore_latest()` to select only `settings-[0-9]*.json`, leaving `settings-before-restore-*` files as safety snapshots that are never selected as restore candidates.

## Verification

The focused isolated restore regression passed: with both backup types present, restore selected `settings-20260101-000000.json`. The full `vscode-settings-templates/verify.sh` gate also passed.

## Lessons

Use distinct filename patterns for restore candidates and safety snapshots, and include repeated-restore behavior in the verification gate.
