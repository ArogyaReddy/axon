---
id: ISS-0009
title: Scalar replacement drops trailing comments
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer trailing-comment fixture
files: vscode-settings-templates/vscode-settings-templates, vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and /Users/arog/.claude-axon/.arog/axon/plugins/axon-guard/bin/axon-verify
related:
---

# ISS-0009: Scalar replacement drops trailing comments

## What happened

The CLI could remove a scalar's comma and trailing `//` comment while replacing the value, producing invalid JSONC when another setting followed.

## How it was found

The independent reviewer reproduced this with a scalar line formatted as `"target": "old", // comment`.

## Root cause

Replacement rebuilt the entire line and determined the comma from the line ending, where a trailing comment hid the comma.

## Impact

Applying a template could corrupt the settings file and prevent VS Code from parsing it.

## Fix

Changed scalar replacement to locate and replace only the value span, preserving the existing comma, whitespace, and trailing comment.

## Verification

The trailing-comment fixture passes in `test_cli.py`, and the full `axon-verify` gate passes.

## Lessons

Value replacement should preserve all syntax outside the value token, including comments and separators.
