# ADR-0010: Install, update and migration

Date: 2026-10-01. Status: accepted. Evidence: `14-p9-acceptance.md`.

## Context

P9 installed axon for real on this Mac and walked a fresh home. Facts found on Claude Code 2.1.197:

- `extraKnownMarketplaces` and `enabledPlugins` in settings do not install anything by themselves (`claude plugin
  list`: none). `claude plugin marketplace add` + `claude plugin install` do, and write through a symlinked settings
  file without replacing the link.
- `claude plugin install` also writes copies to `~/.claude/plugins/cache`, but for a local directory marketplace Claude
  Code loads skills, hooks, agents and `bin/` in place from the checkout (`--debug-file` and a session PATH, checked in
  the P9 review; an earlier reading of the cache as what runs was wrong). With a fixed `version`, `claude plugin update`
  keeps the old cache copy after new commits; without one, each commit is a new version (this matters for a
  git-hosted marketplace, not for the local one).
- `~/.claude/settings.json` and `~/.claude/CLAUDE.md` are home-manager out-of-store links into the dotfiles repo; the
  CLAUDE.md target (`home/AGENTS.md`) is shared with Codex and opencode.
- With the personal sandbox on, axon's own commands failed inside Claude (ISS-0039).

## Decision

1. **`axon install` installs the plugins** through the `claude plugin` CLI (never by editing Claude Code's plugin
   files), for the plugins the profile enables; `axon update` adds new or missing ones and refreshes a Copilot
   export; `axon uninstall` removes them. The CLI runs with `HOME` set to axon's `--home`, so a test home never touches the real one.
2. **The checkout is what runs.** Any change there applies to the next session; develop axon on a branch or worktree.
   Plugins carry no version, so a future git-hosted marketplace updates per commit; `claude plugin validate`'s "No
   version specified" warning is the one accepted warning. `axon doctor` fails on missing or disabled plugins.
3. **`--write-through`** (opt-in) merges into the real file behind a home-manager out-of-store link; files whose
   content lives in the nix store are still never written (ADR-0002 stays the default).
4. **Legacy is archived, not deleted** (plan D12): `axon legacy archive` moves the items the catalog replaces to
   `~/.axon/legacy/<stamp>/`; `axon legacy restore` returns them without overwriting. Deleting the archive is a separate
   decision.
5. **CLAUDE.md is not trimmed**: it is shared with other agents; the duplicated rules cost a few hundred cached tokens.
6. **Personal sandbox allowances** (ISS-0039): write `~/.axon/{state,logs,events,cache}`, run `playwright-cli` and
   `axon-qa` outside the sandbox (Chrome cannot start under Seatbelt), allow local port binding.

## Consequences

- A new Mac is four commands plus `/login` (10 s measured to a passing doctor, tools from the npm cache).
- Old plugin copies accumulate in `~/.claude/plugins/cache` per commit until Claude Code cleans them.
- Two excluded commands run unsandboxed; the list must stay that short.
