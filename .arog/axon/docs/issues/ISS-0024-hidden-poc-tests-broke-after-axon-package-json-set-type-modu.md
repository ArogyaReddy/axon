---
id: ISS-0024
title: Hidden POC tests broke after axon package.json set type module
status: fixed
severity: low
type: regression
feature: design
found: 2026-10-01
found_in: test
found_by: P1 live E2E scoring: require is not defined in ES module scope
files: poc/hidden/hidden.test.cjs
fixed: 2026-10-01
fix_commit: 
verified_by: hidden tests 7/7 on P1 run, baseline 1/7
related: 
---

# ISS-0024: Hidden POC tests broke after axon package.json set type module

## What happened

Scoring the P1 run gave pass 0 / fail 1: the hidden test file crashed on load.

## How it was found

`require is not defined in ES module scope`.

## Root cause

P0 added axon/package.json with `"type": "module"`; the CommonJS hidden test under poc/hidden now loaded as ESM.

## Impact

Low: the scoring harness only; it could have been misread as a failed run.

## Fix

Renamed to poc/hidden/hidden.test.cjs; poc/run.mjs and 04-poc-results.md updated.

## Verification

Hidden tests: P1 run 7/7, buggy baseline still 1/7.

## Lessons

A 0-of-1 result is a load error, not a score: always look at the error before concluding.
