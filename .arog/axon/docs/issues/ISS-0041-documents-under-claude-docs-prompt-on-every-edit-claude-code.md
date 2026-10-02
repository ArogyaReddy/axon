---
id: ISS-0041
title: Documents under ~/.claude/docs prompt on every edit (Claude Code treats ~/.claude as sensitive)
status: fixed
severity: high
type: bug
feature: axon-p9
found: 2026-10-01
found_in: test
found_by: real-machine rehearsal of SETUP.md (2026-10-01)
files: plugins/axon-core/lib/issues.mjs, installer/legacy.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: real-machine rehearsal 2026-10-01; see 16-real-machine.md
related: 
---

# ISS-0041: Documents under ~/.claude/docs prompt on every edit (Claude Code treats ~/.claude as sensitive)

## What happened

In a live `/axon-core:tdd` session, filling in an issue under ~/.claude/docs/issues was refused: "Claude requested permissions to edit ... which is a sensitive file", although the settings allow Edit(~/.claude/docs/**). Every axon document (plans, issues, change records, guides, QA reports, council transcripts) lived there, so each edit would ask the user.

## How it was found

Tool results of the live session; a one-line probe writing ~/.claude/docs/axon-probe.md was refused the same way.

## Root cause

Claude Code protects everything under ~/.claude and asks before edits there, whatever the allow rules. The legacy convention (~/.claude/docs) predates that protection.

## Impact

Every workflow that writes a document would stop for approval (or fail in headless runs): not automatic.

## Fix

Documents now live in ~/.axon/docs: code defaults (issues, plans, plan-check, QA reports, council), skill and rule texts, permissions (Read/Edit ~/.axon/docs/**); `axon legacy archive` moves ~/.claude/docs there (never overwriting; restore moves it back); a structure test keeps shipped files from pointing documents into ~/.claude.

## Verification

Live rerun on the real install: the tdd flow plus a filled-in issue in ~/.axon/docs/issues ran with 0 permission denials; understand wrote its plan to ~/.axon/docs/plans and passed axon-plan-check; 285 tests.

## Lessons

Rehearse the whole workflow on the real machine, not only the install.
