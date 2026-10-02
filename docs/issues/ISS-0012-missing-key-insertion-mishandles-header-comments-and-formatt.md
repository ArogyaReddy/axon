---
id: ISS-0012
title: Missing-key insertion mishandles header comments and formatting
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer header-brace indentation and comment-ownership fixtures
files: vscode-settings-templates/vscode-settings-templates, vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and axon-verify
related:
---

# ISS-0012: Missing-key insertion mishandles header comments and formatting

## What happened

Missing-key insertion could mistake a brace in a header comment for the root object, hardcode two-space indentation, and move an inline comment from the existing property to the new property.

## How it was found

The independent reviewer reproduced header-brace, four-space/tab indentation, and inline-comment fixtures.

## Root cause

Root discovery used `text.find("{")`, insertion used a fixed two-space prefix, and comment insertion occurred before the comment text rather than preserving the original property line.

## Impact

Valid JSONC settings could fail to parse or lose comment ownership after applying a template.

## Fix

Added comment-aware root discovery, indentation inference from existing top-level entries, and insertion logic that preserves inline comments with their original property.

## Verification

The new header-brace, indentation, comment-ownership, full parser, and 20-template gate tests pass.

## Lessons

Missing-property merge tests must cover header comments, indentation styles, and comment placement, not only parseability.
