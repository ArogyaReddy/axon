---
id: ISS-0005
title: Rapid applies can overwrite a backup
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer timestamp collision inspection
files: vscode-settings-templates/vscode-settings-templates
fixed: 2026-10-01
fix_commit:
verified_by: microsecond backup naming inspection plus isolated apply/restore
related:
---

# ISS-0005: Rapid applies can overwrite a backup

## What happened

Two applies in the same second could produce the same backup filename and overwrite the earlier backup.

## How it was found

The reviewer identified the collision from the second-resolution timestamp implementation.

## Root cause

Backup names used `%Y%m%d-%H%M%S` without subsecond precision or exclusive creation.

## Impact

Rapid template switching could destroy the exact rollback point needed to recover the previous appearance.

## Fix

Added microseconds to normal and pre-restore backup filenames.

## Verification

The backup naming implementation now includes `%f`; the full 20-template gate and isolated apply/restore checks pass.

## Lessons

Backup paths should be collision-resistant and covered by rapid-repeat tests.
