# ADR-0004: axon-guard architecture - self-contained plugins, per-repo state, both PostToolUse events

- Status: accepted (P1, 2026-10-01)

## Decisions

1. **Each plugin is self-contained.** Plugins may load from different locations (plugin cache, `--plugin-dir`), so a plugin
   never imports code from another plugin. The task state library, the hooks and the CLIs `axon-task`, `axon-unlock-test` and
   `axon-verify` live in `axon-guard`; the issue tracker and `axon-issue` live in `axon-core`. The root `bin/axon` (for your
   terminal) imports from the plugins. Plugin `bin/` folders are on Claude's PATH (verified live: a plugin bin ran by name).
2. **State is per repository**, in `$AXON_STATE_DIR` (default `~/.axon/state/repos/<hash>.json`), because Claude's shell does not
   know the session id and one active task per working tree is the natural unit (worktrees are separate trees). Paths are
   canonical (symlinks resolved) before they are used as keys (ISS-0022).
3. **Events are ordered by a sequence counter**, not timestamps, so "a failing run after the last test edit" is never ambiguous.
4. **Test runs are recorded from both `PostToolUse` and `PostToolUseFailure`.** Verified with real payloads: a failing test
   command (non-zero exit) arrives only as `PostToolUseFailure`, with `error: "Exit code N\n<output>"`; a passing one arrives as
   `PostToolUse` with `tool_response.stdout`. A hook on `PostToolUse` alone would never see a failing test.
5. **Hooks fail open** on their own internal errors, with a visible `[axon-guard]` warning (plan D14).
6. **PreToolUse denies via JSON** (`hookSpecificOutput.permissionDecision: "deny"` + reason), so the model sees the reason.

## Evidence

Real payload fixtures in `tests/fixtures/payloads/`; tests in `tests/guard.test.mjs`; live run in `05-p1-acceptance.md`.
