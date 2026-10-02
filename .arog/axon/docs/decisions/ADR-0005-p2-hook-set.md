# ADR-0005: P2 hook set - what was built, what was dropped, and why

Date: 2026-10-01. Status: accepted. Evidence: `07-p2-acceptance.md`.

## Decisions

1. **One process per event and matcher, not one per hook name.** `pre-bash` (guard-bash), `pre-edit` (guard-files, then
   tdd-gate, test-lock), `post-tool` (test-evidence, edit tracking, post-edit-check), `stop-gate`, `session-start`
   (session-brief), `prompt-submit` (prompt-flags), `session-end`. Each named hook can still be switched off on its own
   (`AXON_DISABLE`, `~/.axon/local.json`, `<repo>/.axon/config.json` `hooks`). Fewer node cold starts per tool call.
2. **`pre-compact-backup` dropped.** Compaction does not lose the transcript: this session's transcript kept messages from
   before two compactions. The hook would copy data that is never lost.
3. **`notify` dropped.** Claude Code already sends desktop notifications (`preferredNotifChannel`: iTerm2, Ghostty, Kitty,
   bell). On 2.1.197 the `permission_prompt` notification does not fire in the VS Code extension (docs: before 2.1.233).
4. **session-brief carries facts and a pointer, never repository text** (ISS-0029). Hook context is privileged; text
   from SESSION-HANDOFF.md is read by Claude as a file. Live: same answers and cost as quoting the excerpt.
5. **Hook messages are facts, not orders.** Claude declined "Fix it before anything else." in hook output and treated
   instruction-shaped context with suspicion. Messages now state what happened and who acts.
6. **Runtime files under one folder, `~/.axon`** (`AXON_HOME`): `state/` (repos, sessions, history), `logs/` (decision
   log, redacted, 14-day rotation), `local.json` (per-machine switches). CLIs on PATH do not get `CLAUDE_PLUGIN_DATA`, so
   the plugin data folder is not used.
7. **guard-bash precision over breadth.** Commit messages (heredoc fed to `cat`, `-m` values) are text, not commands;
   a heredoc fed to a shell is still checked. SQL DROP/TRUNCATE only counts with a SQL client in the command (so
   `rg "DROP TABLE"` is allowed). New over legacy: `git-no-verify` (skipping repository git hooks), `rm-symlink-target`
   (`rm -rf link/` deletes the target's contents; home-manager uses many symlinks), production AWS profile.
8. **guard-files also protects generated files**: lockfiles, CHANGELOG.md, and any existing file whose first lines say
   `@generated`, `DO NOT EDIT` or start with an `auto-generated` comment (your CLAUDE.md rule). `credentials*` was narrowed
   to `credentials`/`credentials.json` so source files like `credentialsService.ts` are not blocked.
9. **prompt-flags** ports the legacy `#Flag=YES/NO` registry to `plugins/axon-guard/config/flags.json`; flags persist per
   session (so `--resume` keeps them) and are restated on each prompt only while a flag differs from its default.

## Still open

- H-Q1 (do plugin hooks wait for workspace trust in interactive sessions?): not determined. In an `expect`-driven
  terminal, Claude Code 2.1.197 stayed in "Bootstrapping" for minutes and fired SessionStart late even after trust was
  accepted, so "no hook before trust" could not be separated from "hooks delayed". Check in a real terminal at install
  time (P3): open `claude` in a new folder and confirm the brief appears after accepting trust.
