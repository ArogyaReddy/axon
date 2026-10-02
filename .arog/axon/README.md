# axon

A portable AI engineering setup for Claude Code (and VS Code Copilot): skills that run in your session, hooks that
enforce the order of work (plan, failing test, fix, verify), a safe default configuration, and browser QA that costs
nothing once a story is learned. Measured rule: no axon feature costs more than plain Claude Code.

## Install (about 5 minutes on a new Mac)

Step-by-step guide for the work laptop, including retiring an old setup and undoing everything: [SETUP.md](SETUP.md).

Needs: macOS, Node 20+, git, Claude Code (2.1.283 or newer recommended), Google Chrome for browser QA.

```bash
git clone <axon repo> ~/.claude/.arog/axon
~/.claude/.arog/axon/bin/axon install --profile personal     # or --profile work
claude                                                       # first run: /login
~/.claude/.arog/axon/bin/axon doctor                         # every line ok (a version warning is fine)
```

`axon install` does four things, each reversible:

1. merges axon's settings into `~/.claude/settings.json` (a backup goes to `~/.axon/backups/` first; your own values win
   except on the keys axon manages);
2. links the global rules as `~/.claude/rules/axon`;
3. installs the plugins `axon-core`, `axon-guard`, `axon-qa`, `axon-learn` (plus `axon-adp` on the work profile) from
   the local marketplace;
4. installs the pinned `playwright-cli` and `markmap-cli` into `~/.axon/tools` when missing (`--no-tools` skips it).

Try `--dry-run` first to see every change. Measured on a fresh home: 10 seconds to a passing `axon doctor` (tools
already in the npm cache; login not counted).

**Settings managed by home-manager.** If `~/.claude/settings.json` is a home-manager link, axon prints the merged JSON
instead of writing. When the link ends in a file in your dotfiles repo (an `mkOutOfStoreSymlink`, edit in place), use
`axon install --write-through`: axon writes that file, the links stay, and `axon uninstall` restores it.

**Moving from an older ~/.claude setup.** `axon legacy archive --dry-run` lists the old items axon replaces (`ar-*`
skills and agents, merged skills, old commands); `axon legacy archive` moves them to `~/.axon/legacy/<date>/`. Nothing
is deleted; `axon legacy restore` puts them back. See [docs/inventory.md](docs/inventory.md).

## First three commands

In a project, start Claude Code and type (typing `/` and the skill name finds them in the menu):

| Command | What happens |
|---|---|
| `/axon-core:prime` | loads the project rules, the last handoff and open issues |
| `/axon-core:understand <bug or change>` | reads the real code, proves the root cause, writes a plan, waits for your GO |
| `/axon-core:tdd` | failing test first, then the fix; the hooks block skipped steps |

Then `/axon-core:verify` before you call it done, and `/axon-core:git-push` to commit with proof. One page of everything else:
[CHEATSHEET.md](CHEATSHEET.md). End-to-end workflows: [docs/guides/workflows.md](docs/guides/workflows.md).

## Update

```bash
cd ~/.claude/.arog/axon && git pull
bin/axon update      # adds new or missing plugins, refreshes a Copilot export
```

Claude Code loads axon's skills, hooks, agents and commands straight from this checkout, so a pull (or any edit, even
uncommitted) takes effect in the next session. Keep this checkout clean: try changes to axon on a branch or in a
worktree, not in the folder your sessions load.

## Work repositories

`axon install --project <repo> --kit <adp-e-product | adp-e-automation | pacer>` adds the repo's verify commands,
path-scoped rules (they load only when Claude touches matching files), protected paths, a data-investigation rule
(read-only, ClientID-scoped, active rows) and local permission gates for that repo's risky commands. Existing files are
never overwritten. Each kit's README lists what it adds; all three were built from the repos' CLAUDE.md files and still
need a run on the work Mac.

## Copilot

`axon export --copilot` copies the hooks (through an adapter), all skills, the `reviewer` and `verifier` agents and the
rules to `~/.copilot` for VS Code Copilot and the Copilot CLI. `--remove` takes them back. Details:
[ADR-0009](docs/decisions/ADR-0009-copilot-export.md).

## Uninstall

```bash
bin/axon export --copilot --remove   # if you exported
bin/axon uninstall                   # plugins, settings (restored from the backup), rules link
bin/axon legacy restore              # if you archived the old setup and want it back
```

## Safety defaults

Destructive commands (`git reset --hard`, force push, `rm -rf` on important paths, PROD profiles) are blocked by
permissions and by the `guard-bash` hook; secrets and generated files cannot be written; bypass mode is off. The
personal profile runs shell commands in the Claude Code sandbox (credentials unreadable; axon's own state folders,
local test servers and its pinned browser tools allowed). Every hook can be switched off: see the cheat sheet.
Threat model: [docs/threat-model.md](docs/threat-model.md).

## Where things live

| Path | What |
|---|---|
| `~/.claude/.arog/axon` | this repo: plugins, global rules and settings, installer, Copilot export, tests |
| `~/.axon/` | runtime: `docs/` (plans, issues, reports), `state/` (task phases, evidence), `logs/` (guard decisions), `events/` (opt-in event log), `tools/` (pinned CLIs), `backups/`, `legacy/`, `secrets/` (never committed), `local.json` (machine switches) |
| `~/.axon/docs/` | generated documents: plans, reviews, issues, guides, changes (not under `~/.claude`: Claude Code asks before every edit there) |
| `<repo>/.axon/config.json` | per-project verify commands, protected paths, hook switches |

## For maintainers

`npm test` (267 tests; inside the Claude Code sandbox the real-Chrome test is skipped with its reason), `npm run bench`
(hook latency). Decisions: [docs/decisions/](docs/decisions/). Build plan and acceptance records: the numbered files in
this folder.
