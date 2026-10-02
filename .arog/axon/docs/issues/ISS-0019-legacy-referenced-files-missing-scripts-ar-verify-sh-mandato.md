---
id: ISS-0019
title: Legacy: referenced files missing (scripts/ar-verify.sh, mandatory.md rules 9-12, review doc)
status: fixed
severity: high
type: gap
feature: legacy-migration
found: 2026-10-01
found_in: review
found_by: analysis
files: 
fixed: 2026-10-01
fix_commit: 
verified_by: no loaded skill/agent/command references the missing files; legacy archived
related: 
---

# ISS-0019: Legacy: referenced files missing (scripts/ar-verify.sh, mandatory.md rules 9-12, review doc)

## What happened

/ar-verify and /ar-understand cannot run as designed on this Mac.

## How it was found

Following every path the skills reference.

## Root cause

Files live only on the work Mac.

## Impact

High: rules 9-12 of the ADP mandatory rules are unknown. Needs the originals from the work Mac (open question 9).

## Fix

The skills that referenced the missing files (ar-verify, ar-understand) were replaced by axon's `verify` and `understand`, which use `axon-verify` and `axon-plan-check`; the legacy copies are archived (P9).

## Verification

No loaded skill, agent or command references `ar-verify.sh` or `mandatory.md` (grep: 0). axon's hygiene test checks that every command a skill names exists.

## Lessons

A skill may only name files and commands that ship with it; a test checks every reference.
