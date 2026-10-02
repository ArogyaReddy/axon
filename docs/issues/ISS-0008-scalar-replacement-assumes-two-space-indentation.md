---
id: ISS-0008
title: Scalar replacement assumes two-space indentation
status: fixed
severity: high
type: bug
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer four-space and tab indentation fixture
files: vscode-settings-templates/vscode-settings-templates, vscode-settings-templates/test_cli.py
fixed: 2026-10-01
fix_commit:
verified_by: vscode-settings-templates/test_cli.py and /bin/sh vscode-settings-templates/verify.sh
related:
---

# ISS-0008: Scalar replacement assumes two-space indentation

## What happened

The CLI could add a duplicate global setting when an existing valid top-level setting used four spaces or tabs.

## How it was found

The independent reviewer reproduced this with four-space and tab-indented settings fixtures.

## Root cause

The scalar replacement required exactly two spaces before a key instead of locating top-level entries structurally.

## Impact

A template could produce duplicate keys and fail to change the setting users expected.

## Fix

Replaced the indentation-dependent regex with the comment-aware structural top-level key scanner, preserving the existing indentation.

## Verification

The four-space and tab-indentation fixtures passed, followed by the full 20-template verification gate.

## Lessons

Settings merge tests must include alternative valid indentation styles.
