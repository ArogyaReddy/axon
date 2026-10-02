---
id: ISS-0016
title: Missing array-final-value insertion regression
status: fixed
severity: low
type: gap
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer coverage review
files: vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and axon-verify
related:
---

# ISS-0016: Missing array-final-value insertion regression

## What happened

The dedicated insertion regression suite did not directly cover an array-valued final top-level setting.

## How it was found

The independent reviewer identified the coverage gap during final review.

## Root cause

The suite had scalar and object final-value fixtures but no array fixture.

## Impact

Future changes to structured-value boundary matching could break array-final insertion without failing the gate.

## Fix

Added an array-valued final-setting fixture and assertions that preserve the array while inserting the new setting.

## Verification

The expanded `test_cli.py` suite and `axon-verify` pass.

## Lessons

Structured-value insertion coverage should include scalar, object, and array values.
