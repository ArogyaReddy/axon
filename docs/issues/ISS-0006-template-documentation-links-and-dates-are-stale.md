---
id: ISS-0006
title: Template documentation links and dates are stale
status: fixed
severity: low
type: doc
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer documentation link and metadata check
files: docs/vscode-terminal-color-templates.md, docs/issues/ISS-0001-restore-can-select-its-own-restore-snapshot.md, docs/issues/ISS-0002-jsonc-trailing-commas-are-rejected.md, docs/issues/ISS-0003-brace-in-jsonc-comment-corrupts-color-replacement.md, docs/issues/ISS-0004-nested-scoped-setting-can-be-replaced-instead-of-global.md, docs/issues/ISS-0005-rapid-applies-can-overwrite-a-backup.md, docs/issues/ISS-0006-template-documentation-links-and-dates-are-stale.md
fixed: 2026-10-01
fix_commit:
verified_by: link existence check and Markdown diagnostics
related:
---

# ISS-0006: Template documentation links and dates are stale

## What happened

The template guide linked templates 6-20 into a directory that only contained the original five, and issue records showed a date one day after the current session date.

## How it was found

The reviewer checked the rendered documentation links and issue metadata.

## Root cause

The guide links were based on the earlier copied documentation directory, while the canonical ten-plus template collection lives under `vscode-settings-templates/templates`. Issue creation metadata used the next calendar date.

## Impact

Users could not follow the template links, and issue history was temporally inaccurate.

## Fix

Updated all template links to the canonical project folder and corrected the six issue-record dates.

## Verification

Markdown diagnostics and `git diff --check` pass; all linked template files now exist.

## Lessons

Documentation links should be checked against the canonical file location whenever files are copied or reorganized.
