# axon cheat sheet

## Job -> command (in Claude Code)

| Job | Command | Output |
|---|---|---|
| Start or resume work | `/axon-core:prime` | context in the session |
| Analyse a bug or change, plan it | `/axon-core:understand <text \| trac:N \| file:path \| git:ref>` | `~/.axon/docs/plans/<slug>.plan.md`, waits for GO |
| Frame a new feature | `/axon-core:plan-feature` | plan doc, waits for GO |
| Track a multi-story feature | `/axon-core:plan-track` | Feature > Story > Task doc |
| Build test-first | `/axon-core:tdd` | RED > GREEN > REFACTOR > VERIFY, enforced by hooks |
| Run one task to a verified finish | `/axon-core:go-until-done` | DONE with evidence, or an honest BLOCKED |
| Quality gate | `/axon-core:verify [--deep]` | lint, types, tests, checkers; `--deep` adds the `verifier` agent |
| Commit and push with proof | `/axon-core:git-push` | verify + `reviewer` agent + commit message with evidence; asks before push |
| End a session | `/axon-core:handoff` | `SESSION-HANDOFF.md` |
| Log or fix an issue | `/axon-core:issue-tracker` | `~/.axon/docs/issues/<repo>/ISS-NNNN-*.md` |
| Pressure-test a decision | `/axon-core:agent-council` (only when you ask; never automatic) | five advisors in parallel, verdict + transcript (about $0.64) |
| Acceptance-test a web app | `/axon-qa:ui-acceptance` | stories in `.axon/user_stories/*.yaml`; replays cost $0 once learned |
| One-off browser task | `/axon-qa:playwright-browser` | inline `playwright-cli` session |
| Explain (WH questions) | `/axon-learn:wh-explainer` | explanation with diagrams |
| Teach code to a beginner | `/axon-learn:code-mentor` | small steps, diagrams |
| Record a change | `/axon-learn:explain-changes` | `~/.axon/docs/changes/*.md` |
| Mind map | `/axon-learn:mindmaps <topic or doc>` | `.md` + offline `.html` |
| Course from a codebase | `/axon-learn:codebase-to-course` | single-page HTML course |
| Review a living doc | `/axon-learn:interactive-book` | answers inline, `axon-book-verify` |
| Guided rounds in your terminal | `/axon-learn:interactive-session <topic>` | `~/.axon/docs/guides/interactive-session-<topic>.md` |
| PILOT into a feature branch (adp-e-product) | `/axon-adp:git-pilot-feature-changes` | `pilot-sync` does the mechanics |

Agents (spawned by the skills, Sonnet): `reviewer`, `verifier`, `council-advisor`, `qa-agent`.

## Commands Claude runs (on its PATH through the plugins)

`axon-task start|phase|status|abort`, `axon-verify`, `axon-unlock-test <file> --reason` (asks you), `axon-issue`,
`axon-plan-new`, `axon-plan-check`, `axon-council`, `axon-qa run [--filter] [--parallel N] [--headed] [--no-relearn]`,
`playwright-cli`, `axon-mindmap`, `axon-book-verify`, `axon-trace`, `pilot-sync`, `check-*`, `adp-domain-check`.

## Commands you run (terminal)

| Command | What |
|---|---|
| `axon install [--profile personal\|work] [--dry-run] [--write-through] [--no-tools]` | settings + rules link + plugins + pinned tools |
| `axon install --project <repo> --kit adp-e-product\|adp-e-automation\|pacer` | a work repo's verify commands, rules, protected paths, permission gates |
| `axon update` | after `git pull`: add new or missing plugins, refresh a Copilot export (sessions load axon from the checkout) |
| `axon doctor` | read-only health check |
| `axon tools install` | pinned playwright-cli and markmap-cli into `~/.axon/tools` |
| `axon legacy archive [--dry-run]` / `axon legacy restore` | move the old `~/.claude` items axon replaces, or bring them back |
| `axon export --copilot [--repo dir] [--observe] [--remove]` | Copilot copies in `~/.copilot` or `<repo>/.github` |
| `axon dashboard` | local activity page on http://127.0.0.1:47301 (needs `axon-observe` on) |
| `axon issue list\|show\|new\|fix\|close` | the issue tracker |
| `axon uninstall` | plugins, settings (restored), rules link |
| `claude plugin install axon-observe@axon` | turn on the event log (`axon-trace --last`, dashboard) |

## Hooks and how to switch one off

| Hook | Blocks or adds |
|---|---|
| `guard-bash` | destructive commands (reset --hard, force push, rm -rf of key paths, sudo, PROD) |
| `guard-files` | writes to secrets, generated files (CHANGELOG.md, lock files) and the project's protected paths |
| `tdd-gate` | source edits while a task is in RED (write the failing test first) |
| `test-lock` | test edits in GREEN/REFACTOR (`axon-unlock-test` asks you) |
| `post-edit-check` | syntax errors back to Claude; locale drift and project reminders as context |
| `stop-gate` | "done" while source changed without a passing `axon-verify` (blocks once) |
| `session-brief` | a short git/task brief at session start |
| `prompt-flags` | session flags set in a prompt, such as `#BetterExplanation=YES` (`plugins/axon-guard/config/flags.json`) |

Any "off" wins:

- this shell: `AXON_DISABLE=tdd-gate,stop-gate claude`
- this machine: `~/.axon/local.json` -> `{ "hooks": { "stop-gate": "off" } }`
- this project: `<repo>/.axon/config.json` -> `{ "hooks": { "tdd-gate": "off" } }`

A guard that has a bug fails open (logged in `~/.axon/logs/`); permissions and the sandbox stay in force.

## Where outputs go

Plans, reviews, issues, guides, changes: `~/.axon/docs/<type>/`. Task state and test evidence: `~/.axon/state/`.
Guard decisions: `~/.axon/logs/<day>.jsonl`. QA reports and screenshots: `~/.axon/docs/qa/app-tests/<run>/`; learned replays: `<repo>/.axon/user_stories/.replay/`. Backups:
`~/.axon/backups/`. Secrets (QA logins): `~/.axon/secrets/` (unreadable to Claude).
