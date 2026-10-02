---
id: ISS-0004
title: Nested scoped setting can be replaced instead of global
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer scoped-settings fixture
files: vscode-settings-templates/vscode-settings-templates
fixed: 2026-10-01
fix_commit:
verified_by: scoped-settings fixture plus /bin/sh vscode-settings-templates/verify.sh
related:
---

# ISS-0004: Nested scoped setting can be replaced instead of global

## What happened

The CLI scalar replacement could match a nested language-scoped setting before the intended global setting.

## How it was found

The reviewer used an isolated valid settings fixture with a `[javascript]` scoped key and reproduced the incorrect match.

## Root cause

The replacement regex matched any indented key line rather than restricting the match to the two-space top-level settings entries.

## Impact

A template could silently change a scoped override and fail to update the global setting it was meant to control.

## Fix

Restricted scalar replacement to the repository's top-level two-space settings keys.

## Verification

The scoped-settings regression was addressed and all 20 template dry-runs pass through `vscode-settings-templates/verify.sh`.

## Lessons

Settings merge tests need nested scope fixtures, not only flat settings files.
