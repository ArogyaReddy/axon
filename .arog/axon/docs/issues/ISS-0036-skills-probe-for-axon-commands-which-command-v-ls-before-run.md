---
id: ISS-0036
title: skills probe for axon commands (which, command -v, ls) before running them; seen in council, ui-acceptance, mindmaps
status: fixed
severity: medium
type: gap
feature: skills
found: 2026-10-01
found_in: test
found_by: P4, P5 and P7 live skill runs
files: global/rules/axon.md
fixed: 2026-10-01
fix_commit: 
verified_by: mindmaps live rerun with global rules: 0 probes (was 2)
related: 
---

# ISS-0036: skills probe for axon commands (which, command -v, ls) before running them; seen in council, ui-acceptance, mindmaps

## What happened

In live runs of three different skills the session probed for the axon command before running it: agent-council (command -v x4, P4), ui-acceptance (ls/curl, P5), mindmaps (`which axon-mindmap || axon tools install`, P7). The last one even tried to install a tool.

## How it was found

Tool-call listings from stream-json of each live skill run.

## Root cause

Nothing told the model that the commands a skill names are on PATH, so it verified first; per-skill wording fixed each skill but not the pattern.

## Impact

Wasted turns in every skill run (each turn re-reads the whole context), and an unrequested install attempt.

## Fix

global/rules/axon.md, new 'Tools' section: commands a skill names are on PATH, run them directly, never probe or install; if one is missing, say what provides it and stop. mindmaps no longer suggests installing by itself.

## Verification

Same mindmaps task rerun with the rules loaded: 0 probe commands (before: 2), axon-mindmap run directly. 231/231 tests.

## Lessons

When the same failure shows up in a third skill, fix the pattern once in the global rules instead of per skill.
