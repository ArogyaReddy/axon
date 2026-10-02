# Legacy ~/.claude -> axon

What happened to each part of the old setup. "Archived" means `axon legacy archive` moved it to
`~/.axon/legacy/<date>/` (nothing deleted; `axon legacy restore` brings it back). On this Mac: archived 2026-10-01,
51 items, folder `~/.axon/legacy/2026-10-01T17-22-09Z`. Why each part was kept, merged or left out:
`03-component-catalog.md` sections 7 and 8.

## Replaced and archived

| Legacy | axon |
|---|---|
| `skills/ar-understand`, `ar-tdd`, `ar-plan-track`, `ar-go-until-done`, `ar-verify` | `axon-core`: `understand`, `tdd`, `plan-track`, `go-until-done`, `verify` (inline, hook-enforced) |
| `skills/ar-agent-council` | `axon-core:agent-council` + `axon-council` CLI |
| `skills/ar-git-pilot-feature-changes` | `axon-adp:git-pilot-feature-changes` + `pilot-sync` |
| `skills/ar-wh-explainer`, `ar-code-mentor`, `ar-explain-changes`, `ar-mindmaps`, `ar-codebase-to-course`, `ar-interactive-book`, `ar-interactive-session` | `axon-learn`: same names without `ar-` |
| `skills/ar-review`, `ar-code-reviewer` | `reviewer` agent (via `git-push`) |
| `skills/ar-session-log`, `ar-digest` | `handoff` (journal line); digest dropped |
| `skills/ar-analyzer` | `axon doctor` |
| `skills/demanding-proof`, `work-discipline` | global rules (`~/.claude/rules/axon`) and `verify` |
| `skills/framing-vague-requests` | `plan-feature` |
| `skills/scientific-debugging` | `understand` (bug mode) |
| `skills/ship-safely` | `git-push` |
| `agents/ar-*.agent.md` (13 skill executors) | none: the work runs inline (measured 5x cheaper) |
| `agents/code-reviewer.md`, `security-reviewer.md` | `reviewer` agent |
| `agents/verifier.md` | `verifier` agent (`axon-core`) |
| `commands/handoff`, `plan-feature`, `ship`, `review`, `explain`, `fix-bug` | `handoff`, `plan-feature`, `git-push`, `reviewer`, `wh-explainer`, `understand` + `tdd` |
| `commands/resume-work`, `setup-project`, `risk-map` | `prime`; `axon install --project`; dropped |
| `settings-me.json` | never loaded by Claude Code; axon settings via `axon install` (ISS-0020) |
| `ar-config.yaml` | per-project `.axon/config.json` |

## Left in place

| Legacy | Why |
|---|---|
| `hooks/*` | never wired into the active settings, so they do not run; axon's hooks replace them (catalog section 4) |
| `bin/*` (ar-rollup, capture-sessions, meeting-notes, ...) | `capture-sessions` runs as a LaunchAgent; not axon's to remove |
| `templates/*` | kept; axon's plan template lives in `axon-core` |
| `skills/chrome-devtools-axi`, `lavish`, `find-skills`, `no-mistakes`, `code-explorer`, `create-power-point`, `synced` | not part of axon (other tools, ADP plugins, synced skills) |
| `CLAUDE.md` (your dotfiles `home/AGENTS.md`) | shared with Codex and opencode; its rules repeat axon's global rules on purpose, so it is not trimmed |
| `CLAUDE-ME.md`, `FRAMEWORK-FEATURE-FLAGS.md`, `STATE-SNAPSHOT.*`, `my-notes.md` | not loaded by Claude Code; notes. The feature flags live on in `prompt-flags` |

## Settings

The active settings file (`~/.claude/settings.json` -> your dotfiles) kept your values (the lavish-axi SessionStart
hook, theme, effort) and gained axon's permissions, sandbox, status line, output style and plugins
(`axon install --write-through`). The original is in `~/.axon/backups/`; `axon uninstall` restores it.
