---
id: ISS-0014
title: Plan claimed scripted pipelines are cheapest for repeatable flows; measurement disproved it
status: fixed
severity: medium
type: doc
feature: design
found: 2026-10-01
found_in: plan
found_by: POC measurement
files: axon-framework-build-2026-09-30.plan.md, 04-poc-results.md
fixed: 2026-10-01
fix_commit: 
verified_by: poc/results.jsonl; plan D15
related: 
---

# ISS-0014: Plan claimed scripted pipelines are cheapest for repeatable flows; measurement disproved it

## What happened

An earlier answer and plan draft called pipelines the lowest-cost option.

## How it was found

POC: pipeline cost 1.9x to 4x inline.

## Root cause

Claim made from reasoning, not measurement.

## Impact

Medium: it would have steered the architecture.

## Fix

04-poc-results.md records the data; plan D15 states pipelines only for unattended runs.

## Verification

poc/results.jsonl.

## Lessons

Architecture claims about cost need a measurement before they enter the plan.
