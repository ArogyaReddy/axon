---
id: ISS-0037
title: Live Copilot check sent a prompt to the user's own VS Code window
status: fixed
severity: high
type: bug
feature: axon-p8
found: 2026-10-01
found_in: test
found_by: P8 live check (VS Code Copilot Chat logs)
files: copilot/export.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: ~/.claude/.env removed after identity check; no GUI-driven checks; manual checklist instead
related: 
---

# ISS-0037: Live Copilot check sent a prompt to the user's own VS Code window

## What happened

The second P8 live prompt (`code chat -r -m agent ...`) went to the user's own VS Code window (workspace ~/.claude) instead of the throwaway test window. The agent there created ~/.claude/.env with `TOKEN=x`; its two other edits (CHANGELOG.md, src/a.js) failed because those files do not exist in ~/.claude. axon hooks were not installed in that window, so nothing blocked it.

## How it was found

No hook events arrived for the second prompt; window1's Copilot Chat log showed the request with tool calls create_file and apply_patch on /Users/arog/.claude paths.

## Root cause

`code chat -r` means "last active window", not "the window just opened"; between the two prompts the user's own window became the last active one. The check depended on GUI focus, which the test does not control.

## Impact

One unwanted file in ~/.claude (a test secret value, not a real one) and a test conversation in the user's own chat history. No other file changed: the log shows only file_search/read_file, one create_file and two failed apply_patch calls.

## Fix

Removed ~/.claude/.env after confirming it was the test file (born 13:01:13, the second of the create_file call; content exactly `TOKEN=x`). Decision: axon never drives the user's VS Code GUI again; remaining VS Code checks are a manual checklist in 13-p8-acceptance.md, run by the user.

## Verification

`ls ~/.claude/.env`: no such file. ~/.claude/CHANGELOG.md and ~/.claude/src do not exist (never created).

## Lessons

A live check must target its environment explicitly (a path, a session id, a profile), never "the last active" anything. When the only trigger is a shared GUI, make it a manual check.
