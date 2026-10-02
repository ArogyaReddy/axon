---
id: ISS-0013
title: Missing direct four-space replacement regression
status: fixed
severity: low
type: gap
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer test-coverage review
files: vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and axon-verify
related:
---

# ISS-0013: Missing direct four-space replacement regression

## What happened

The regression suite covered insertion with four-space indentation but did not directly assert replacement of an existing four-space-indented setting.

## How it was found

The independent reviewer identified the missing assertion during final test-coverage review.

## Root cause

The test fixture checked only that a new key used the inferred indentation.

## Impact

Future changes could break existing four-space replacement while the gate continued to pass.

## Fix

Added an existing four-space key fixture and asserted exactly one replacement with the expected parsed value.

## Verification

The direct regression and full `axon-verify` gate pass.

## Lessons

Alternative indentation needs both insertion and replacement assertions.
