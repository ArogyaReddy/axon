---
id: ISS-0015
title: Runtime settings backups must not ship
status: fixed
severity: high
type: risk
feature: vscode-settings-templates
found: 2026-10-01
found_in: review
found_by: Independent reviewer publish-set inspection
files: vscode-settings-templates/backups, vscode-settings-templates/backups/.gitignore
fixed: 2026-10-01
fix_commit:
verified_by: backup publish-set inspection and axon-verify
related:
---

# ISS-0015: Runtime settings backups must not ship

## What happened

The runtime backup directory contained personal settings snapshots generated during CLI testing, including extension configuration and approval data.

## How it was found

The independent reviewer inspected the intended publish set before commit.

## Root cause

The backup directory was not ignored, so generated JSON snapshots appeared as untracked files eligible for staging.

## Impact

Personal settings and potentially sensitive configuration could be published accidentally.

## Fix

Removed generated snapshots and added `vscode-settings-templates/backups/.gitignore` to ignore runtime JSON backups while retaining the directory.

## Verification

The publish directory contains no runtime JSON snapshots, and the repository gate still passes.

## Lessons

Runtime artifacts need ignore rules before any backup-producing CLI is committed.
