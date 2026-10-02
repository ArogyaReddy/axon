---
id: ISS-0022
title: Task state keyed by unresolved path: hooks and CLI disagree through symlinked paths
status: fixed
severity: high
type: bug
feature: quality-core
found: 2026-10-01
found_in: test
found_by: tests/guard.test.mjs: 10 failures; macOS /var -> /private/var
files: plugins/axon-guard/lib/state.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: tests/guard.test.mjs ISS-0022 test: fails with fix disabled, passes with fix; suite 76/76
related: 
---

# ISS-0022: Task state keyed by unresolved path: hooks and CLI disagree through symlinked paths

## What happened

The CLI (`axon-task`) and the hooks computed different repository keys for the same repo, so they read and wrote different state files. The TDD gates silently did nothing.

## How it was found

First run of tests/guard.test.mjs: 10 failures. `node -e` check showed `os.tmpdir()` gives `/var/folders/...` while `process.cwd()` gives `/private/var/folders/...`.

## Root cause

`repoRoot()` used `path.resolve`, which does not resolve symlinks. Hooks receive the path Claude used (possibly through a symlink); the CLI uses `process.cwd()`, which is already resolved. The state file name is a hash of the root path, so two spellings of one repo gave two state files.

## Impact

High: on any repo opened through a symlinked path the gates would silently not apply.

## Fix

`plugins/axon-guard/lib/state.mjs`: new `realish()` resolves symlinks, also for files that do not exist yet (deepest existing ancestor + rest); used in `repoRoot`, `classify`, `editDecision` and `unlockTest`.

## Verification

Test `a repo reached through a symlink shares one state (ISS-0022)` fails with the fix disabled (pass 0, fail 1) and passes with it; full suite 76/76.

## Lessons

Any path used as a key must be canonical. Tests on macOS temp folders catch this class for free; keep fixtures in os.tmpdir().
