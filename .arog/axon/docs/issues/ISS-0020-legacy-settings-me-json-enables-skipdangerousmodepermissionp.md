---
id: ISS-0020
title: Legacy: settings-me.json enables skipDangerousModePermissionPrompt
status: open
severity: high
type: risk
feature: legacy-migration
found: 2026-10-01
found_in: review
found_by: settings review
files: ~/.claude/settings-me.json
fixed: 
fix_commit: 
verified_by: 
related: 
---

# ISS-0020: Legacy: settings-me.json enables skipDangerousModePermissionPrompt

## What happened

The bypass-permissions warning is disabled.

## How it was found

Reading settings-me.json.

## Root cause

Convenience setting.

## Impact

High: removes a safety prompt. axon base settings set `disableBypassPermissionsMode` and `axon doctor` fails on this key.

## Fix

Partly: settings-me.json (never loaded by Claude Code; nothing references it) is archived, and axon's settings set `permissions.disableBypassPermissionsMode: "disable"`, so bypass mode cannot start while axon is installed. Open: the dotfiles alias `cc = "claude --dangerously-skip-permissions"` (home.nix line 38) now fails with axon's setting; keeping, removing or changing it is the user's decision.

## Verification

`axon doctor`: dangerous-settings ok; settings.json has disableBypassPermissionsMode "disable".

## Lessons

Turning off a safety prompt belongs in an explicit, visible decision, not a side file.
