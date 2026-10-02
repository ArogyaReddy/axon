---
id: ISS-0040
title: P9 claimed sessions run committed plugin copies; Claude Code loads a local marketplace in place
status: fixed
severity: medium
type: bug
feature: axon-p9
found: 2026-10-01
found_in: review
found_by: P9 review (a staleness notice that never fired)
files: installer/plugins.mjs, docs/decisions/ADR-0010-install-and-migration.md
fixed: 2026-10-01
fix_commit: 
verified_by: debug log + session PATH show checkout paths; 276 pass
related: 
---

# ISS-0040: P9 claimed sessions run committed plugin copies; Claude Code loads a local marketplace in place

## What happened

P9 docs, ADR-0010 and `axon update` assumed sessions run the plugin copies in ~/.claude/plugins/cache, so only committed changes would reach them and `axon update` would refresh them. A session-start staleness notice built on that never fired in a live session.

## How it was found

The notice worked when the hook ran by hand but not in a live session; `claude --debug-file` showed hooks.json and skills read from ~/.claude/.arog/axon/plugins/..., and a session's PATH held the checkout's bin folders.

## Root cause

The P9 experiment checked what `claude plugin update` writes into the cache, not what a session loads. For a local directory marketplace, Claude Code 2.1.197 loads plugins in place.

## Impact

Wrong guidance: uncommitted edits in the checkout do run in the next session; `doctor` warned about plugin age that does not matter; `axon update` claimed to refresh copies. No wrong behaviour in sessions.

## Fix

Removed the staleness notice (freshness.mjs) and the age warning in doctor; `axon update` now adds new or missing plugins and refreshes a Copilot export; README, cheat sheet, workflows, threat model and ADR-0010 say the checkout is what runs and to develop axon on a branch or worktree; correction appended to 14-p9-acceptance.md.

## Verification

`--debug-file` log and session PATH (checkout paths); npm test 276 pass + 1 sandbox skip; doctor plugins check passes with all four plugins enabled.

## Lessons

Verify what the runtime loads (debug log, PATH), not what an installer writes.
