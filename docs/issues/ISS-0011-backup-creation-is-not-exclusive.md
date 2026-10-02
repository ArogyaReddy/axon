---
id: ISS-0011
title: Backup creation is not exclusive
status: fixed
severity: medium
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer backup collision analysis
files: vscode-settings-templates/vscode-settings-templates, vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and axon-verify
related:
---

# ISS-0011: Backup creation is not exclusive

## What happened

Backup filenames were generated from timestamps and copied with overwrite semantics, so a repeated timestamp could replace an earlier rollback point.

## How it was found

The independent reviewer identified the collision risk from the implementation.

## Root cause

Backup creation used `shutil.copy2` directly on a timestamp-derived path without exclusive creation or a collision suffix.

## Impact

Rapid template switches could destroy a previous backup needed for rollback.

## Fix

Added exclusive backup creation with `xb` mode and a numeric suffix fallback for both normal and pre-restore backups.

## Verification

The dedicated CLI regression suite and `axon-verify` pass after the change.

## Lessons

Rollback artifacts should use exclusive creation rather than relying only on timestamp precision.
