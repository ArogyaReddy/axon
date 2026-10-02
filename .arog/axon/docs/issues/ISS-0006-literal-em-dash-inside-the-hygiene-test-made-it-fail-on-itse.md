---
id: ISS-0006
title: Literal em dash inside the hygiene test made it fail on itself
status: fixed
severity: low
type: bug
feature: p0-installer
found: 2026-10-01
found_in: test
found_by: tests/structure.test.mjs
files: tests/structure.test.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: npm test structure suite green
related: 
---

# ISS-0006: Literal em dash inside the hygiene test made it fail on itself

## What happened

The no-em-dash test reported its own file.

## How it was found

`npm test` failure listing tests/structure.test.mjs.

## Root cause

The check was written with the literal character instead of the `\u2014` escape.

## Impact

Low.

## Fix

Replaced the literal with `\u2014` in tests/structure.test.mjs.

## Verification

`npm test` green; grep finds no literal em dash.

## Lessons

Write forbidden characters as escapes in checks.
