---
id: ISS-0015
title: CATER skill+agent pairs were first misjudged as duplicates
status: fixed
severity: medium
type: doc
feature: design
found: 2026-10-01
found_in: plan
found_by: user review
files: 03-component-catalog.md
fixed: 2026-10-01
fix_commit: 
verified_by: 03-component-catalog.md revision 3
related: 
---

# ISS-0015: CATER skill+agent pairs were first misjudged as duplicates

## What happened

The first catalog collapsed the user's skill+agent pairs as duplication.

## How it was found

User pushback.

## Root cause

The review judged structure without reading the user's design rationale (CATER).

## Impact

Medium: wrong catalog, rework.

## Fix

Catalog revisions 2-3; the later measured decision is recorded in the catalog section 1.

## Verification

03-component-catalog.md revision 3.

## Lessons

Read the design docs of the existing system before judging its structure.
