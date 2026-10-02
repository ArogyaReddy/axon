# Set up axon on a new Mac (the work laptop)

Follow the steps in order. About 15 minutes. Every step can be undone (step 10).

Rehearsed on 2026-10-01 on this Mac for real (backup, back to the old setup, then steps 4-9; record:
`16-real-machine.md`) and with a home folder built like the work laptop (old `ar-*` skills, agents and commands, old
hooks in `settings.json` including one whose script is missing, Bedrock model and AWS profile, the ADP plugin
marketplace, a `CLAUDE.md` and `mandatory.md` naming `ar-*` skills): steps 1-6 took 9 seconds, `doctor` then flagged
exactly the two leftovers in the step 6 table, and step 10 restored every file and setting. It also installs from a
copy without the `.git` folder.

Short version, once you know it:

```bash
AXON=~/.claude/.arog/axon/bin/axon
$AXON legacy archive              # retire the old ar-* setup (moved, not deleted)
$AXON install --profile work      # settings, rules, plugins, tools
$AXON doctor                      # all ok
```

## 0. On the personal Mac: package the folder

Copy the whole folder, including the hidden `.git` folder (it holds the history; axon also works without it). Nothing
secret is in the folder: secrets live in `~/.axon/secrets`, which is not copied.

```bash
cd ~/.claude/.arog && git -C axon status --short     # empty: everything committed
ditto -c -k --keepParent axon ~/Desktop/axon.zip     # one zip, hidden files included
```

Move `axon.zip` to the work laptop the way your company allows (for example OneDrive or a company-approved USB drive).

## 1. On the work laptop: check what is needed

```bash
node -v          # v20 or newer
git --version
claude --version # 2.1.283 or newer recommended; older works with a warning
```

Also needed: Google Chrome (for browser QA), and Claude Code already working with Bedrock (you use it today). If
`node` is missing or older than 20, install it first (for example `brew install node`). If `claude --version` is older
than 2.1.283, update it the way it was installed (`claude update` for the native installer); the VS Code extension
brings its own, newer Claude Code.

## 2. Back up the current ~/.claude

Do **not** delete `~/.claude`: it holds your Bedrock and AWS settings, your sign-in, your history and your projects.
axon merges into it. Take a backup instead:

```bash
B=~/claude-backup-$(date +%Y-%m-%d)
ditto ~/.claude $B                          # the folder (links are copied as links)
cp -L ~/.claude/settings.json $B-settings.json   # the real settings content, even if settings.json is a link
cp ~/.claude.json $B-claude.json            # Claude Code's own app state (MCP servers, sign-in info)
```

## 3. Put axon in place

```bash
mkdir -p ~/.claude/.arog
ditto -x -k ~/Downloads/axon.zip ~/.claude/.arog      # creates ~/.claude/.arog/axon
AXON=~/.claude/.arog/axon/bin/axon
$AXON doctor | tail -1                                # it runs: "... pass, ... warn, ... fail"
```

Keep it at exactly `~/.claude/.arog/axon`: the install writes this path into your settings. If you ever move the
folder, run step 5 again.

Optional, so you can type `axon` instead of the full path:

```bash
echo 'alias axon=~/.claude/.arog/axon/bin/axon' >> ~/.zshrc && source ~/.zshrc
```

## 4. Retire the old setup (moved, never deleted)

```bash
$AXON legacy archive --dry-run    # lists what would move and which old hooks would be unhooked
$AXON legacy archive              # does it
```

What it does:

- moves the old `ar-*` skills and agents, the skills and commands axon replaced, `settings-me.json` and `ar-config.yaml`
  to `~/.axon/legacy/<date>/` (the full map: [docs/inventory.md](docs/inventory.md));
- unhooks entries in `~/.claude/settings.json` that run scripts from `~/.claude/hooks/` (axon's hooks replace them; a
  copy of the settings from before is kept);
- moves your documents from `~/.claude/docs` to `~/.axon/docs` (plans, issues, guides, reviews), where axon now writes
  them: Claude Code asks before every edit under `~/.claude`, so documents there would interrupt every workflow. A
  name that already exists in `~/.axon/docs` is left where it is;
- leaves everything else alone: your other skills, `bin/`, `templates/`, and the ADP plugins.

If it says your settings are managed by home-manager, remove the listed hooks in your dotfiles yourself.

## 5. Install

```bash
$AXON install --profile work --dry-run    # shows every settings change
$AXON install --profile work
```

This merges axon's settings into `~/.claude/settings.json` (backup in `~/.axon/backups/`; your own values such as the
Bedrock model and AWS settings win), links the global rules as `~/.claude/rules/axon`, installs the plugins
`axon-core`, `axon-guard`, `axon-qa`, `axon-learn` and `axon-adp`, and installs the pinned `playwright-cli` and
`markmap-cli` into `~/.axon/tools`.

- If npm downloads are blocked, the install says so and everything else is already done: run `$AXON tools install`
  later (only browser QA and mind maps need the tools).
- If `~/.claude/settings.json` is a home-manager link into your dotfiles, add `--write-through`; if axon says the file
  lives in the nix store, paste the printed settings into your dotfiles and run `home-manager switch`.

## 6. Check

```bash
$AXON doctor
```

Expected: every line `ok`, except possibly the Claude Code version warning. What to do with anything else:

| Line | Fix |
|---|---|
| `plugins` fail | run `$AXON install --profile work` again; if `claude plugin` fails, update Claude Code |
| `playwright-cli` / `markmap` warn | `$AXON tools install` |
| `legacy-hooks` warn | `$AXON legacy archive` (step 4) |
| `legacy-references` warn | the named files (your `CLAUDE.md`, a rules file) still mention `ar-*` skills or the AROG gate: change them to the axon names ([docs/inventory.md](docs/inventory.md)) or remove those lines |
| `dangerous-settings` fail | remove the named key (for example `skipDangerousModePermissionPrompt`) from `~/.claude/settings.json` |
| `global-rules` warn | `~/.claude/rules/axon` exists but is not axon's link: move it away, run step 5 again |

## 7. First session

Restart VS Code (or open a new terminal and run `claude`). In any project:

```
/axon-core:prime
```

The first time Claude edits files in a project it asks you once (normal Claude Code behaviour; Shift+Tab switches
to accepting edits). axon's documents go to `~/.axon/docs` without asking.

In the terminal (`claude`) you should see the axon status line at the bottom; in a git repo, sessions start with a
short brief (branch, last commit, uncommitted files). A quick safety
check in a throwaway folder: `mkdir /tmp/t && cd /tmp/t && git init -q && claude`, then ask it to run
`git reset --hard`; axon blocks it.

## 8. Your work repositories

Once per repository (existing files are never overwritten; each kit's README says what it adds):

```bash
$AXON install --project ~/path/to/adp-e-product    --kit adp-e-product
$AXON install --project ~/path/to/adp-e-automation --kit adp-e-automation
$AXON install --project ~/path/to/pacer            --kit pacer
```

Then, inside each repo, `/axon-core:verify` runs that repo's checks. Use your real paths. The kits were built from the
repos' CLAUDE.md files; this is their first run, so note anything that looks wrong and we fix the kit.

## 9. Copilot (optional)

```bash
$AXON export --copilot
```

Copies axon's hooks, skills, the `reviewer` and `verifier` agents and the rules to `~/.copilot` for VS Code Copilot.

## 10. Undo

```bash
$AXON export --copilot --remove   # if you did step 9
$AXON uninstall                   # plugins, settings back to the backup, rules link removed
$AXON legacy restore              # old skills, agents, commands, hooks and documents back
```

Full fallback: your backup from step 2 (`~/claude-backup-<date>`).

## Daily use and updates

- What to type for each job: [CHEATSHEET.md](CHEATSHEET.md). End-to-end workflows: [docs/guides/workflows.md](docs/guides/workflows.md).
- Claude Code loads axon straight from `~/.claude/.arog/axon`, so a newer copy takes effect in the next session: replace
  the folder's contents (same path), then run `$AXON update` (adds new plugins, refreshes the Copilot copies) and
  `$AXON doctor`.
- `axon` disables bypass mode: `claude --dangerously-skip-permissions` (or an alias using it) is refused.
