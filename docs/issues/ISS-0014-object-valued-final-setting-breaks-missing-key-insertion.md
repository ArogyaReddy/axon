---
id: ISS-0014
title: Object-valued final setting breaks missing-key insertion
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer object-last-entry fixture
files: vscode-settings-templates/vscode-settings-templates, vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and axon-verify
related:
---

# ISS-0014: Object-valued final setting breaks missing-key insertion

## What happened

Missing-key insertion treated the final top-level object or array value as a scalar and could insert the new setting inside it.

## How it was found

The independent reviewer reproduced the issue with an object-valued final property.

## Root cause

Insertion used scalar-end scanning for the last property instead of matching complete structured values.

## Impact

Valid settings could become invalid JSONC or receive a setting in the wrong scope.

## Fix

Added complete object/array value matching before inserting a missing top-level setting.

## Verification

The object-last regression in `test_cli.py` and the full `axon-verify` gate pass.

## Lessons

Merge tests need final scalar, object, and array property fixtures.
