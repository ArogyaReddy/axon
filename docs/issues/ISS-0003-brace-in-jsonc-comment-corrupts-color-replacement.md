---
id: ISS-0003
title: Brace in JSONC comment corrupts color replacement
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer comment-aware brace fixture
files: vscode-settings-templates/vscode-settings-templates
fixed: 2026-10-01
fix_commit:
verified_by: comment-brace fixture plus /bin/sh vscode-settings-templates/verify.sh
related:
---

# ISS-0003: Brace in JSONC comment corrupts color replacement

## What happened

The CLI could corrupt the settings file when a JSONC comment inside `workbench.colorCustomizations` contained a closing brace.

## How it was found

The reviewer used an isolated settings fixture with `}` inside a comment and found the rewritten settings no longer parsed.

## Root cause

`find_matching_brace()` counted braces without tracking line and block comments.

## Impact

Applying a template could leave VS Code settings invalid and prevent VS Code from loading them.

## Fix

Made brace matching comment-aware while preserving string handling.

## Verification

The comment-brace regression was covered during review follow-up and all 20 template dry-runs pass through `vscode-settings-templates/verify.sh`.

## Lessons

Structured-text scanners must account for strings and comments before interpreting delimiters.
