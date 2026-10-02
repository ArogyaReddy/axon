---
id: ISS-0028
title: Model closed a money-rounding issue as wont-fix without asking the user
status: fixed
severity: high
type: gap
feature: core-skills
found: 2026-10-01
found_in: test
found_by: P1b handoff live run closed the reviewer's ISS-0001 as wont-fix
files: global/settings/base.json, plugins/axon-core/skills/issue-tracker/SKILL.md
fixed: 2026-10-01
fix_commit: 
verified_by: install test ask rule; live precedence spike: close denied, list allowed, issue stayed open
related: 
---

# ISS-0028: Model closed a money-rounding issue as wont-fix without asking the user

## What happened

In the handoff live run, the model closed the reviewer's money-rounding issue as wont-fix on its own judgment.

## How it was found

handoff result: 'ISS-0001 ... logged as wont-fix'.

## Root cause

`Bash(axon-issue *)` was allowed, which included `close`; the skill text did not say who decides.

## Impact

High: risk acceptance on money logic decided by the model.

## Fix

base.json `ask` includes `Bash(axon-issue close *)`; issue-tracker skill step 7 says closing is the user's decision.

## Verification

Install test asserts the ask rule (failed first). Live precedence spike: with allow `Bash(axon-issue *)` and ask `Bash(axon-issue close *)` in dontAsk mode, `axon-issue list` ran and `axon-issue close` was denied; the issue stayed open.

## Lessons

Decisions that belong to the user must be enforced by a permission rule, not only described in a skill.
