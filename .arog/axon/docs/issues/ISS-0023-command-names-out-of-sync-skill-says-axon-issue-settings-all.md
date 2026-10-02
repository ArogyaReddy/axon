---
id: ISS-0023
title: Command names out of sync: skill says axon issue, settings allow axon task / axon unlock-test, PATH has axon-issue / axon-task
status: fixed
severity: high
type: bug
feature: quality-core
found: 2026-10-01
found_in: test
found_by: P1 live E2E: permission denial on 'axon issue list'
files: global/settings/base.json, plugins/axon-core/skills/issue-tracker/SKILL.md, tests/structure.test.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: tests: install rule assertions + skill-command structure test, failed first, now pass; 77/77
related: 
---

# ISS-0023: Command names out of sync: skill says axon issue, settings allow axon task / axon unlock-test, PATH has axon-issue / axon-task

## What happened

In the live P1 run Claude tried `axon issue list` and was denied; it could not log the 3 bugs it found.

## How it was found

P1 live E2E result: permission_denials contained `axon issue list --status open`.

## Root cause

When the CLIs moved into plugins (ADR-0004 design), their names on Claude's PATH became `axon-issue`, `axon-task`, `axon-unlock-test`, but the issue-tracker skill still said `axon issue` and base.json still allowed `Bash(axon task *)` and asked for `Bash(axon unlock-test *)`.

## Impact

High: the issue tracker was unusable from Claude, and permission rules for the task and unlock commands did not match.

## Fix

base.json: `Bash(axon-task *)`, `Bash(axon-verify)`, `Bash(axon-verify *)`, `Bash(axon-issue *)` allowed; `Bash(axon-unlock-test *)` in ask. issue-tracker SKILL.md uses `axon-issue`. Plan and catalog renamed. New structure test: every backticked `axon-*` command in a skill must exist in a plugin bin, and no space-separated `axon issue|task|unlock-test|verify` may appear.

## Verification

New tests failed first (install rule assertions, skill-command test) and pass now; suite 77/77.

## Lessons

Names that cross files (skills, settings, bins) need a test that checks them against each other.
