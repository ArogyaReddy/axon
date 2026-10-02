---
id: ISS-0001
title: Home-manager two-hop symlink not detected; install would replace the link
status: fixed
severity: high
type: bug
feature: p0-installer
found: 2026-10-01
found_in: implementation
found_by: axon doctor run on the real Mac (read-only)
files: installer/homemanager.mjs, installer/install.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: tests/install.test.mjs: out-of-store link + write-through tests; real-machine doctor
related: 
---

# ISS-0001: Home-manager two-hop symlink not detected; install would replace the link

## What happened

`axon doctor` reported ~/.claude/settings.json as writable although home-manager owns it. A real `axon install` would have replaced the symlink with a plain file, breaking the dotfiles link.

## How it was found

Ran `bin/axon doctor` and `bin/axon install --dry-run` on this Mac; doctor said `settings file is writable by axon`. `readlink ~/.claude/settings.json` showed `/nix/store/...-home-manager-files/.claude/settings.json`, whose realpath is `~/dotfiles/dotfiles/home/.claude/settings.json`.

## Root cause

`detectNixManaged` only compared the final realpath with `/nix/store`. home-manager uses an out-of-store symlink: link > nix store entry > dotfiles file, so the final target is outside the store. Separately, `atomicWrite` renamed onto the link path, which replaces any symlink with a regular file.

## Impact

High: silent breakage of the user's home-manager setup on the first real install.

## Fix

`installer/homemanager.mjs`: new `symlinkChain()`; a file is managed if ANY hop is inside the store; reports the real source path. `installer/install.mjs` `atomicWrite` and uninstall write to `realpathSync(file)` so links survive. ADR-0002.

## Verification

Tests `out-of-store home-manager link ... is detected as managed` and `a plain (non-nix) symlinked settings file is written through` failed before the fix and pass after (`npm test`). Real Mac: doctor now reports the dotfiles source path; settings.json checksum unchanged.

## Lessons

Run every installer step against the real machine read-only before trusting fixture tests; fixtures were built from an assumption (single-hop link).
