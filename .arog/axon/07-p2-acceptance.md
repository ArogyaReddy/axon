# 07 - P2 acceptance: guard hooks (2026-10-01)

Claude Code 2.1.197, Sonnet, `axon-guard` loaded with `--plugin-dir`. Decisions: ADR-0005.

## Built

| Hook (switch name) | Event | Does |
|---|---|---|
| `guard-bash` | PreToolUse Bash | Denies 14 rule kinds: recursive delete of /, root folders, home or its parents, `.`, `..`, bare globs; `rm -rf link/` on a symlink; sudo rm; force push (lease allowed); reset --hard; clean -f; discard-all; --no-verify; chmod 777; curl to shell; SQL DROP/TRUNCATE via a SQL client; disk writes; reading `.env`; PROD AWS profile |
| `guard-files` | PreToolUse Write/Edit/MultiEdit/NotebookEdit | Secrets and keys, `~/.aws/credentials`, generated files (lockfiles, CHANGELOG.md, `@generated` / `DO NOT EDIT` markers), project `protected.paths` and legacy `.claude/protected-paths.txt`; `protected.allow` exempts |
| `post-edit-check` | PostToolUse | Syntax of JSON (JSONC tolerated), JS/MJS/CJS (JSX in .js tolerated), sh/bash/zsh, Python (no `__pycache__`); locale key parity (`messages-en.json` vs `messages-es.json`); project `reminders` by path |
| `session-brief` | SessionStart startup/resume/clear/compact | Facts only: branch, last commit, uncommitted count, active axon task, pointer to SESSION-HANDOFF.md |
| `prompt-flags` | UserPromptSubmit | `#Flag=YES/NO` (10 legacy flags), aliases, `#FlagStatus`, unknown-flag notice; per-session state |
| `session-end` | SessionEnd | Prunes session flag files (7 days) and decision logs (14 days) |
| decision log | all denies/blocks/errors | `~/.axon/logs/YYYY-MM-DD.jsonl`, redacted (tokens, AWS keys, JWTs, passwords, emails) |

Dropped with evidence: `pre-compact-backup`, `notify` (ADR-0005).

## Tests

- **170/170** (`npm test`), of which 82 are in `tests/hooks.test.mjs`, driven through real captured payloads
  (SessionStart, UserPromptSubmit, SessionEnd added to `tests/fixtures/payloads/`).
- **Mutation check** (the tests were written before the code but first run after it, so their power was proven
  separately): each component neutralised in a scratch copy, every mutation caught.

| Mutation | Failing tests |
|---|---|
| bashVerdict returns null | 31 |
| fileVerdict returns null | 5 |
| switches always on | 4 |
| no post-edit findings | 3 |
| commit-message stripping off | 2 |
| redact is identity | 2 |
| brief not capped (pre-ISS-0029 design) | 2 |
| generated marker, locale parity, flag persistence, session-end pruning, each off | 1 each |

- **Latency** (`npm run bench`, 40 runs, fresh node process per call, this Mac):

| Hook | p50 ms | p95 ms | Budget |
|---|---|---|---|
| pre-bash | 38 | 48 | 80 |
| pre-edit | 37 | 41 | 80 |
| post-tool (edit, JSON) | 36 | 38 | 300 |
| post-tool (test run) | 35 | 38 | 50 |
| prompt-submit | 38 | 41 | 80 |
| session-start | 74 | 77 | 400 |
| stop-gate | 36 | 38 | 150 |
| session-end | 34 | 38 | 300 |

## Live checks (real Claude)

| Check | Result | Cost |
|---|---|---|
| Flags: `#BetterExplanation=YES` | Reply started with the acknowledgment block and applied the flag (Mermaid diagram) | $0.19 |
| `git reset --hard HEAD` with no axon permission rules | Denied by guard-bash, reason quoted verbatim by Claude, logged | $0.24 (one run, 4 checks) |
| Write `.env` | Denied by guard-files, file not created, logged | (same run) |
| Add a key to `messages-en.json` only | Claude got the parity note and added `"farewell": "Adiós"` to `messages-es.json` | (same run) |
| Write broken JSON | Syntax error returned to Claude, logged | (same run) |
| Session brief, natural prompt "what next?" | Correct next step from the handoff in 4/4 runs; ISS-0029 fixed (pointer only) with equal results | 6 runs, $0.08-0.16 each |
| Commit message has no co-author line | Control without axon settings: `Co-Authored-By: Claude Sonnet 5`. With axon's `attribution` settings: none | $0.18 x 2 |
| Plugin hooks vs workspace trust (H-Q1) | **Not determined**: the `expect`-driven terminal stalls Claude Code in "Bootstrapping"; moved to P3 install check | ~$0 (no model call reached) |

Total P2 live spend: about $1.70 metered, plus the interactive `expect` attempts.

## Findings

- ISS-0029 (fixed): session-brief copied repository text into privileged hook context.
- Hook output phrased as orders is treated with suspicion; all messages reworded as facts.
- Real Notification payload seen (`notification_type: permission_prompt`, `message: "Claude needs your permission"`).
