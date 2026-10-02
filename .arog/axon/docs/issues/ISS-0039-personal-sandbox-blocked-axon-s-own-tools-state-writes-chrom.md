---
id: ISS-0039
title: personal sandbox blocked axon's own tools: state writes, Chrome, local test servers
status: fixed
severity: high
type: bug
feature: axon-p9
found: 2026-10-01
found_in: test
found_by: P9 real install on this Mac (live session and sandboxed npm test)
files: global/settings/profiles/personal.json, tests/qa.test.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: fresh claude -p session: axon-task, guard, playwright-cli all work; npm test 266+1 skip sandboxed, 267/267 in terminal
related: 
---

# ISS-0039: personal sandbox blocked axon's own tools: state writes, Chrome, local test servers

## What happened

After the real install (personal profile, sandbox on), inside Claude Code: `axon-task start` failed with EPERM creating ~/.axon/state/repos; `playwright-cli open` failed (daemon files in ~/Library/Caches/ms-playwright, then Chrome itself: mach bootstrap 'Permission denied'); `npm test` failed the two tests that start a server on 127.0.0.1 (listen EPERM). So tdd, go-until-done, verify and ui-acceptance could not work in a sandboxed session.

## How it was found

Running axon commands in this session right after the install (the settings hot-reloaded the sandbox), then a fresh `claude -p` session in a throwaway repo, then the test suite inside the sandbox.

## Root cause

The P3 sandbox trial ran before axon's own commands were used under it. The sandbox only allows writes to the working folder, temp and Edit-allowed paths; ~/.axon was none of them. Chrome cannot start under macOS Seatbelt at all, and local port binding is off by default.

## Impact

Every axon workflow that records state or drives a browser broke on the personal profile; any project test suite that starts a local server failed inside Claude.

## Fix

personal profile: `sandbox.filesystem.allowWrite` for ~/.axon/{state,logs,events,cache} only (never ~/.axon/secrets or ~/.claude), `sandbox.excludedCommands` ["playwright-cli *", "axon-qa *"] (axon's pinned browser tools; permission rules still apply), `sandbox.network.allowLocalBinding: true`. The real-Chrome integration test skips only when SANDBOX_RUNTIME=1, with the reason; it runs in a terminal.

## Verification

Test in tests/install.test.mjs (failed first). Fresh `claude -p` session with the installed settings: axon-task started RED (state written), git reset --hard blocked by axon-guard, playwright-cli open / snapshot ('heading "hello axon"') / close worked. npm test: 266 pass + 1 skipped inside the sandbox; 267/267 outside it, including the real Chrome test.

## Lessons

A sandbox trial must run the framework's own commands (state, browser, tests), not just a shell command or two.
