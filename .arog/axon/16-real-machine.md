# 16 - Real-machine rehearsal of SETUP.md (2026-10-01)

Goal: replace the old `~/.claude` setup on this Mac with axon by following SETUP.md, prove the workflows in live
sessions, and fix what breaks before the work laptop.

## What was done

1. **Backup** (step 2): `~/claude-backup-2026-10-01` (141 MB) plus `-settings.json` (the real content behind the
   home-manager link) and `-claude.json`. The guide was missing the last two (ISS-0043, fixed).
2. **Back to the old setup** (step 10 on the real machine): Copilot copies removed, plugins removed, settings restored
   (deep-equal to the pre-axon original), 51 legacy items back.
3. **Install from the guide** (steps 4-6, 9): legacy archive (51 items; documents moved to `~/.axon/docs`), install
   `--profile personal --write-through` (5 s), `doctor` 14 pass / 1 warn (CLI version), Copilot export.

## Live sessions (fresh `claude -p` in a throwaway repo under the home folder)

| Scenario | Result |
|---|---|
| Session start | plugins axon-core, axon-guard, axon-qa, axon-learn; style `axon-learn:lean`; 20 axon skills, 0 `ar-*`; session brief "1 uncommitted file" |
| Safety | `git reset --hard` blocked by axon-guard (work kept); `.env` write blocked (no file); SSH key read refused |
| `/axon-core:tdd` (2.1.197) | RED with the failing test shown, GREEN, DONE refused until `axon-verify` passed; the issue tracker logged and filled in an issue in `~/.axon/docs` with 0 permission denials; 20 turns, $0.56 |
| `/axon-core:understand` | reproduced the bug, plan in `~/.axon/docs/plans`, `axon-plan-check` OK, stopped for GO, source unchanged; $0.66 |
| `/axon-core:tdd` (2.1.286, the VS Code version) | same flow, phase gate refused GREEN -> REFACTOR once until a plain test run was recorded; 12 turns, $0.22, 0 denials |

## Found and fixed

| Issue | Fix |
|---|---|
| ISS-0041 (high): every edit under `~/.claude/docs` asks, whatever the allow rules ("a sensitive file") | documents live in `~/.axon/docs`; legacy archive moves the old ones; test keeps them out of `~/.claude` |
| ISS-0042: `Write(path)` permission rules are never matched (2.1.286 warns) | removed; `Edit(path)` rules cover writes; test forbids `Write(` rules |
| ISS-0043: backup step missed linked settings content and `~/.claude.json` | SETUP.md step 2 copies both |
| Sandboxed commands such as `node -e` asked for approval | personal profile sets `autoAllowBashIfSandboxed: true` explicitly (deny rules, ask rules and hooks still apply) |

## Not provable here

- Sandbox auto-allow: non-interactive sessions do not use the sandbox (debug log), so it can only show in an
  interactive session; the setting matches the documented default.
- `claude -p --permission-mode acceptEdits` refused writes even without axon (plain Claude Code too): a non-interactive
  quirk; interactive sessions ask once or accept with Shift+Tab.
- Work profile specifics (Bedrock, ADP marketplace, the three kits on real repos): rehearsed on a fake work home only.

Spend: about $3 in live sessions.
