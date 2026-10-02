---
id: ISS-0007
title: Scalar replacement matches commented keys
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer commented-key fixture
files: vscode-settings-templates/vscode-settings-templates, vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and /bin/sh vscode-settings-templates/verify.sh
related:
---

# ISS-0007: Scalar replacement matches commented keys

## What happened

The CLI could rewrite a commented-out top-level setting instead of the active setting.

## How it was found

The independent reviewer reproduced this with a commented-key JSONC fixture.

## Root cause

The scalar replacement used a line regex without excluding comments.

## Impact

A template could silently leave the active setting unchanged while modifying only documentation text.

## Fix

Replaced regex matching with a comment-aware structural top-level key scanner.

## Verification

The commented-key and structural indentation fixtures passed, followed by the full 20-template verification gate.

## Lessons

Merge logic must identify syntax nodes, not text that merely resembles a key.
