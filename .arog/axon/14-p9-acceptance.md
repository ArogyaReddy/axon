# 14 - P9 acceptance: docs, install and migration (2026-10-01)

Claude Code CLI 2.1.197 (the VS Code extension is 2.1.285). Decisions: ADR-0010.

## What was built

| Piece | What |
|---|---|
| `axon install` | also adds the axon marketplace and installs the enabled plugins (`installer/plugins.mjs`, through `claude plugin`) |
| `axon update` | installs new or missing plugins, refreshes a stale Copilot export |
| `axon uninstall` | also removes the plugins and the marketplace |
| plugins without `version` | every commit is a new version for `claude plugin update` (see the correction below: sessions load the checkout in place) |
| `axon install --write-through` | merges into the dotfiles file behind a home-manager out-of-store link; links kept; uninstall restores |
| `axon legacy archive / restore` | moves the 51 legacy items axon replaces to `~/.axon/legacy/<stamp>/`; restore never overwrites |
| `axon doctor` | new `plugins` check (missing or disabled = fail); `settings-owner` passes for an edit-in-place link |
| personal sandbox | write `~/.axon/{state,logs,events,cache}`, `playwright-cli`/`axon-qa` outside the sandbox, local port binding (ISS-0039) |
| Docs | `README.md`, `CHEATSHEET.md`, `docs/guides/workflows.md` (W1-W9), `docs/threat-model.md`, `docs/inventory.md`, ADR-0010 |

## Tests

**267** (`npm test`): 267/267 in a terminal; inside the Claude Code sandbox 266 pass and the real-Chrome test is skipped
with its reason. New: `tests/plugins.test.mjs` (8, including the CLI end to end against a fake `claude` in a temp
home), `tests/legacy.test.mjs` (5), install `--write-through` (2) and sandbox allowances (1), doctor plugins and
settings-owner (2). Fixed along the way: the council stagger test was load-sensitive (start times include Node
startup), now load-proof; three runs in a row green.

## Fresh-machine walkthrough (temporary HOME)

`git clone` -> `axon install --profile personal` -> `axon tools install` -> `axon doctor` -> `axon export --copilot`:
**10 seconds** to 9 pass / 1 warn (Claude Code version) / 0 fail, five plugins installed. Not counted: `/login` (a
temporary home is not logged in) and npm downloads (tools came from the npm cache). Target was under 10 minutes.

## Real install on this Mac

1. `axon legacy archive`: 51 items moved to `~/.axon/legacy/2026-10-01T17-22-09Z` (19 `ar-*` skills, 5 merged skills,
   16 agents, 9 commands, `settings-me.json`, `ar-config.yaml`).
2. `axon install --profile personal --write-through`: merged into `~/dotfiles/dotfiles/home/.claude/settings.json`
   (backup in `~/.axon/backups/`); your lavish-axi hook, theme and effort kept; rules linked; five plugins installed.
3. `axon export --copilot`: 46 files in `~/.copilot`.
4. `axon doctor`: 11 pass, 1 warn (Claude Code 2.1.197 older than 2.1.283), 0 fail.

## Live checks (fresh `claude -p` sessions, throwaway repos)

| Check | Result | Cost |
|---|---|---|
| Session start | plugins axon-core, axon-guard, axon-qa, axon-adp, axon-learn loaded; output style `axon-learn:lean`; no `ar-*` skills left | - |
| Global rules | the em-dash rule quoted from `~/.claude/.arog/axon/global/rules/axon.md` | $0.53 (first run, see below) |
| `axon-task start probe` | started in RED (state written inside the sandbox) | $0.36 |
| `git reset --hard` | blocked by axon-guard; the uncommitted change survived | (same) |
| `playwright-cli` open / snapshot / close | browser opened, snapshot `heading "hello axon"`, closed | (same) |
| Nested call (`--setting-sources project --plugin-dir`) | axon-core loaded once, not twice | $0.05 |

The first live run failed its commands with EPERM on `~/.claude/session-env`: an artifact of running it nested inside
this session's own sandbox, not of your setup; rerun outside it, as a terminal would, all passed.

## Issues

- ISS-0039 (fixed): the personal sandbox blocked axon's own tools; found by this install.
- ISS-0018, ISS-0019 (fixed): legacy files with `/Users/gadea` paths and missing references no longer load (archived);
  grep over the loaded config: 0.
- ISS-0020 (open, your decision): your dotfiles alias `cc = "claude --dangerously-skip-permissions"` (home.nix line 38)
  is refused now that axon disables bypass mode. Keep axon's setting and drop the alias, or tell me to allow bypass mode
  on the personal profile.

## Open

- H-Q1 (manual): does a plugin hook wait for workspace trust? `mkdir /tmp/axon-trust && cd /tmp/axon-trust && git init
  -q && claude`, accept or decline the trust dialog, then ask "What did the session brief say?".
- P8 manual Copilot check (13-p8-acceptance.md) and the P6 work-Mac checklist (11-p6-delivered.md).
- Upgrade the Claude Code CLI to >= 2.1.283 (`doctor` warning).
- Deleting `~/.axon/legacy/2026-10-01T17-22-09Z` later is a separate decision (D12).

## Correction (P9 review, 2026-10-01)

This record said installed plugins are copies and "only committed changes reach your sessions". Wrong: with a local
directory marketplace, Claude Code 2.1.197 loads skills, hooks, agents and `bin/` from the checkout itself (debug log
and a session PATH). The cache copies are bookkeeping. Consequences applied: `axon update` no longer "refreshes"
plugins, `doctor` no longer warns about plugin age, a session-start staleness notice built on the wrong model was
removed, and the docs say to develop axon on a branch or worktree. Details: `15-review.md`.

