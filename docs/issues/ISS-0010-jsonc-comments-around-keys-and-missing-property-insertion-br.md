---
id: ISS-0010
title: JSONC comments around keys and missing-property insertion break merges
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer comment-between-key and trailing-comment insertion fixtures
files: vscode-settings-templates/vscode-settings-templates, vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and /Users/arog/.claude-axon/.arog/axon/plugins/axon-guard/bin/axon-verify
related:
---

# ISS-0010: JSONC comments around keys and missing-property insertion break merges

## What happened

The CLI failed on valid JSONC with comments between a key and colon/value, and could insert a missing setting after a trailing line comment without a valid separator.

## How it was found

The independent reviewer reproduced both cases with focused JSONC fixtures.

## Root cause

Whitespace skipping handled only literal whitespace, and missing-key insertion used the final text before the closing brace without locating top-level trailing comments.

## Impact

Applying a template could duplicate settings or leave the user settings file invalid.

## Fix

Added comment-aware token skipping and a top-level trailing-comment locator that inserts the missing property before the comment with a valid separator.

## Verification

The new fixtures pass in `test_cli.py`, and the full `axon-verify` gate passes.

## Lessons

JSONC merge tests need comments between tokens and comments immediately before the root closing brace.
