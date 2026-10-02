---
id: ISS-0002
title: JSONC trailing commas are rejected
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer focused parser check
files: vscode-settings-templates/vscode-settings-templates
fixed: 2026-10-01
fix_commit:
verified_by: trailing-comma parser regression plus /bin/sh vscode-settings-templates/verify.sh
related:
---

# ISS-0002: JSONC trailing commas are rejected

## What happened

The CLI rejected valid VS Code JSONC settings containing trailing commas, even though VS Code accepts that format.

## How it was found

The independent reviewer reproduced it with a focused parser check using `{"setting": true,}`.

## Root cause

The parser removed comments but passed the remaining text directly to Python's strict `json.loads`, which does not accept trailing commas.

## Impact

A user's valid settings file could not be backed up-and-switched through the CLI, blocking the core workflow.

## Fix

Added a string-aware trailing-comma pass after comment removal and before `json.loads`, preserving commas inside quoted strings while removing only commas before `}` or `]`.

## Verification

The focused parser regression passed for `{"setting": true,}`. All 20 template dry-runs and the full `vscode-settings-templates/verify.sh` gate also passed.

## Lessons

JSONC compatibility needs explicit parser tests, including comments, trailing commas, and commas inside strings.
