---
id: ISS-0034
title: ui-acceptance session probed the app with curl and ls instead of running axon-qa
status: fixed
severity: medium
type: bug
feature: qa
found: 2026-10-01
found_in: test
found_by: P5 live run of /ui-acceptance
files: plugins/axon-qa/skills/ui-acceptance/SKILL.md
fixed: 2026-10-01
fix_commit: 
verified_by: structure test (RED then green); live /ui-acceptance: 1 tool call, 2 turns, $0.107
related: 
---

# ISS-0034: ui-acceptance session probed the app with curl and ls instead of running axon-qa

## What happened

Live /ui-acceptance runs: first the session never ran axon-qa (11 turns of ls/find/curl, then asked for approval, $0.20); after a first fix it ran axon-qa but then opened screenshots, read the axon-qa source, spawned an agent and retried axon-issue (29 turns, $0.65).

## How it was found

P5 live runs of the skill through claude -p, tool calls listed from stream-json.

## Root cause

The skill did not say that axon-qa needs no pre-checks, and its 'After a run' section told the session to open the failing screenshot and log every FAIL, which pulled it into exploration.

## Impact

Every QA run paid a large session overhead; auto-logging every FAIL on every run would also create duplicate issues.

## Fix

plugins/axon-qa/skills/ui-acceptance/SKILL.md: run axon-qa first with no curl/ls/find/reads; after the run post the table and cost, then stop and offer (screenshot, issue-tracker, headed rerun). Pinned by tests/structure.test.mjs (failed first, then passed).

## Verification

Third live run: 1 tool call (axon-qa run), 2 turns, $0.107 session + $0.03 agent.

## Lessons

Skill text that asks for follow-up actions gets them every time; follow-ups that cost tokens are offered, not done. Same lesson as the council's probing (ADR-0007).
