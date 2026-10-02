---
id: ISS-0035
title: axon-qa reported 'the qa-agent wrote no result.json' and counted agent runs when the browser could not open
status: fixed
severity: low
type: bug
feature: qa
found: 2026-10-01
found_in: test
found_by: P5 unit test for unreachable apps
files: plugins/axon-qa/bin/axon-qa
fixed: 2026-10-01
fix_commit: 
verified_by: tests/qa.test.mjs unreachable-app test (RED then green)
related: 
---

# ISS-0035: axon-qa reported 'the qa-agent wrote no result.json' and counted agent runs when the browser could not open

## What happened

With an unreachable app, a learn-mode story reported 'the qa-agent wrote no result.json' and the cost line counted it as an agent run, although no agent was started.

## How it was found

A new unit test (unreachable app must fail without starting an agent) failed on the message.

## Root cause

runStory ignored the return value of withSession in learn mode, so the open error was lost and the code fell through to reading result.json.

## Impact

Misleading failure detail and cost line.

## Fix

plugins/axon-qa/bin/axon-qa: track whether the agent ran; if not, return FAIL mode 'setup' with the open error; agent runs counted only for learned/relearned.

## Verification

tests/qa.test.mjs 'an unreachable app fails the story without starting an agent' (failed first, then passed); 14/14.

## Lessons

Write the test for each claim a skill makes about the code (the skill said 'without starting an agent').
