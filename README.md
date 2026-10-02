# Axon

Axon is a portable AI engineering framework for Claude Code and VS Code Copilot. It turns an AI coding session into a checked engineering workflow: understand the real problem, write a failing test when code changes, make the smallest fix, verify it with executable checks, and review the result before publishing it.

Axon is designed around one principle:

> Do the work inline in the current session, let code enforce the important steps, and use an agent only when independent judgment or real parallelism is valuable.

The framework is intended for personal development environments and work repositories. It is not an autonomous deployment system, a replacement for project tests, or a guarantee that an AI-generated change is correct.

## What Is In This Repository?

This repository is a workspace bundle. The canonical Axon source is under `.arog/axon/`.

```text
.
├── .arog/axon/       Canonical Axon source, plugins, tests, installer, and docs
├── .arog/bowser/     Companion browser tooling retained in the workspace bundle
├── agents/           Older workspace agents and captured configuration
├── commands/         Older workspace commands and captured configuration
├── hooks/            Older workspace hooks and captured configuration
├── plugins/          Workspace plugin data and caches
├── rules/            Workspace rules, including Axon-related rules
├── skills/           Workspace skills, including tools that are not part of Axon
├── bin/              Workspace utilities and session tooling
├── docs/             Workspace runbooks and records
└── STATE-SNAPSHOT.*  Workspace state snapshots, not Axon runtime state
```

The root-level workspace directories are preserved context and historical tooling. They are not the Axon installation surface. To install or develop Axon, work from `.arog/axon/`.

The project source itself contains:

```text
.arog/axon/
├── bin/              The `axon` terminal CLI
├── installer/        Install, update, uninstall, migration, doctor, and tools logic
├── plugins/          The six Axon plugins
├── global/           Shared rules, settings, profiles, and status line
├── copilot/          VS Code Copilot and Copilot CLI adapter/export
├── project-kits/     Repository-specific configuration kits
├── tests/             Node test suite and fixtures
├── docs/              Inventory, threat model, decisions, and guides
├── *.md              Build plan, acceptance records, setup, and component catalog
└── package.json       Node 20+ scripts and package metadata
```

## Why Axon Exists

AI coding tools are productive, but instructions alone do not reliably enforce process. A session can claim that a test failed before a fix, that verification ran, or that a review happened without producing evidence.

Axon moves the important parts of that process into executable hooks and scripts:

- A TDD gate blocks source edits until a new failing test has been recorded.
- A test lock protects tests during the GREEN and REFACTOR phases unless a human explicitly unlocks a test.
- `axon-verify` runs the configured lint, type, test, and domain checks and records evidence.
- A stop gate blocks a premature done state when source changes lack fresh verification.
- File and shell guards protect secrets, generated files, protected paths, and dangerous commands.
- An independent reviewer checks the diff before the push workflow proceeds.
- The issue tracker records bugs, gaps, risks, root causes, fixes, and verification.

The result is a repeatable workflow with visible evidence rather than a larger prompt that merely asks the model to behave well.

## What Axon Provides

### Six plugins

| Plugin | Purpose |
| --- | --- |
| `axon-core` | Project context, planning, bug analysis, TDD, verification, issue tracking, handoff, review, push, and technical councils |
| `axon-guard` | Lifecycle hooks, task state, TDD gates, test evidence, file and shell protection, plan validation, and `axon-verify` |
| `axon-qa` | Browser acceptance testing with YAML user stories, Playwright sessions, screenshots, saved logins, and learned replays |
| `axon-learn` | WH explainers, code mentoring, mind maps, interactive books, courses, change records, and guided sessions |
| `axon-adp` | ADP-specific project kits, PILOT branch synchronization, domain checkers, and work-repository rules |
| `axon-observe` | Optional redacted event logging, session tracing, and the local activity dashboard |

### The global layer

The plugins are supported by a global layer that is installed separately from the plugin marketplace:

- Global rules in `global/rules/axon.md`.
- Personal and work settings profiles in `global/settings/`.
- A compact status line in `global/statusline/`.
- The terminal installer and lifecycle commands in `bin/axon` and `installer/`.
- Copilot export support in `copilot/`.
- Project kits in `project-kits/`.

### Skills and agents

Axon ships 21 inline skills. The core workflow is:

1. `prime` loads the repository rules, handoff, task state, git state, and open issues.
2. `understand` investigates a change or bug, proves the root cause, and writes a plan.
3. `tdd` enforces RED, GREEN, REFACTOR, and VERIFY for implementation work.
4. `verify` runs executable checks and reports evidence.
5. `git-push` reviews the diff, creates an honest commit, and publishes only when the proof and review are acceptable.
6. `handoff` reconciles the repository and records what is done, verified, blocked, and next.

Other skills cover feature planning, multi-story tracking, persistence until acceptance criteria pass, issue tracking, technical councils, browser QA, explanation, learning, and ADP branch work.

Axon deliberately keeps ordinary work in the current session. The four agent roles are narrow:

- `reviewer` independently reviews code and the diff.
- `verifier` tries to disprove that acceptance criteria are complete.
- `qa-agent` learns a browser story once and records a replay.
- `council-advisor` supplies one independent opinion in a technical decision council.

## How The Quality Loop Works

```text
User request
    |
    v
prime -> understand / plan
    |
    v
RED: write a test and record a real failure
    |
    v
GREEN: implement the smallest fix
    |
    v
REFACTOR: improve without changing the behavior
    |
    v
VERIFY: run checks and record evidence
    |
    v
reviewer -> commit -> push
```

The hooks observe tool calls and test results. A failing test may arrive through a failed tool event, so Axon records both successful and failed tool-result events. State is keyed by canonical repository path, which keeps separate worktrees independent.

Important enforcement points:

- `tdd-gate` blocks source edits before RED evidence.
- `test-lock` blocks test edits during GREEN and REFACTOR; `axon-unlock-test` requires a reason.
- `test-evidence` records commands, exit codes, counts, and timing.
- `post-edit-check` runs syntax or fast checks for changed files and emits project reminders.
- `guard-bash` blocks destructive commands such as force pushes, hard resets, dangerous recursive deletes, and unsafe production operations.
- `guard-files` protects secrets, generated files, lock files, and configured protected paths.
- `stop-gate` blocks a done state when verification is stale or missing.

The guards fail open on their own internal errors with a visible warning, while permission and sandbox protections remain in force.

## Safety And Data Boundaries

Axon uses layered controls rather than a single permission setting:

- The personal profile uses a Claude Code sandbox and credential scrubbing.
- Secrets belong in `~/.axon/secrets/` and are never committed.
- Runtime state, plans, issues, reviews, logs, evidence, backups, and tools live under `~/.axon/`.
- Install backs up settings before merging Axon configuration.
- Legacy migration moves old files to `~/.axon/legacy/<date>/`; it does not delete them.
- Uninstall restores the settings backup and removes Axon-managed links and plugins.
- Browser login state is stored separately from the repository.
- Observability is opt-in and records redacted event data rather than prompt text.

Read the [threat model](.arog/axon/docs/threat-model.md) before using Axon with sensitive repositories. Review project-specific protected paths and permission rules before enabling a work profile.

## Installation

### Requirements

- macOS
- Node.js 20 or newer
- Git
- Claude Code, with version 2.1.283 or newer recommended
- Google Chrome for browser QA

### Install on a new machine

The detailed, reversible procedure is in [SETUP.md](.arog/axon/SETUP.md). The short form is:

```bash
AXON=~/.claude/.arog/axon/bin/axon
$AXON legacy archive --dry-run
$AXON legacy archive
$AXON install --profile personal    # use work for the ADP work profile
$AXON doctor
```

Installation:

1. Merges Axon settings into `~/.claude/settings.json`, preserving user values except keys Axon manages.
2. Backs up the previous settings under `~/.axon/backups/`.
3. Links Axon global rules into `~/.claude/rules/axon`.
4. Installs the local Axon plugins.
5. Installs pinned `playwright-cli` and `markmap-cli` into `~/.axon/tools` when needed.
6. Supports `--dry-run`, `--write-through` for home-manager links, and `--no-tools`.

Check the result with:

```bash
$AXON doctor
```

### Project kits

A project kit adds repository-specific verify commands, path-scoped rules, protected paths, data-investigation rules, and permission gates without overwriting existing files:

```bash
$AXON install --project ~/path/to/project --kit <available-kit>
```

The available kits are specialized for their target repositories and require validation on the relevant work machine. See `project-kits/` and each kit's README for the supported names and additions.

### Copilot export

Claude Code plugins are not automatically visible to VS Code Copilot. Export creates a Copilot-compatible copy:

```bash
$AXON export --copilot
$AXON export --copilot --repo /path/to/repository
$AXON export --copilot --observe
```

The exporter adapts tool names, input fields, multi-file edits, matchers, and response shapes for VS Code and Copilot CLI. It copies hooks, skills, agents, and rules, and uses a manifest so it does not overwrite files it did not create or files a user changed. Remove only Axon-owned unchanged files with:

```bash
$AXON export --copilot --remove
```

The Copilot CLI has not been live-tested in this workspace. The VS Code Local agent path has been tested with real hook payloads and a destructive-command denial.

## Daily Commands

### Terminal commands

| Command | Purpose |
| --- | --- |
| `axon doctor` | Read-only installation and health check |
| `axon update` | Add missing plugins and refresh Copilot exports after an Axon update |
| `axon dashboard` | Open the local observability page when `axon-observe` is enabled |
| `axon tools install` | Install pinned browser and mind-map CLIs |
| `axon legacy archive` | Move the old setup aside without deleting it |
| `axon legacy restore` | Restore the archived setup |
| `axon uninstall` | Remove Axon-managed installation changes and restore settings |
| `axon export --copilot` | Export Axon to `~/.copilot` or a repository `.github` directory |

### Session skills

```text
/axon-core:prime
/axon-core:understand <bug or change>
/axon-core:tdd
/axon-core:verify
/axon-core:git-push
/axon-core:handoff
```

The complete command map is in [CHEATSHEET.md](.arog/axon/CHEATSHEET.md), and end-to-end recipes are in [workflows.md](.arog/axon/docs/guides/workflows.md).

## Browser QA

`axon-qa` uses user stories in `<repo>/.axon/user_stories/*.yaml`. A story can be learned once by the QA agent and then replayed by code, reducing model use on repeat runs. Reports and screenshots are written under `~/.axon/docs/qa/app-tests/<run>/`.

Use `playwright-cli` directly for a one-off browser task. Save login state under `~/.axon/secrets/playwright/`, never in the repository.

## Observability

`axon-observe` is optional. When enabled, it provides:

- A redacted event log under `~/.axon/events/`.
- `axon-trace` for recent session activity.
- A local dashboard at `http://127.0.0.1:47301`.

Observability is separate from the guard path and is not required for the core workflow.

## Development

Axon is an ES module Node project. Work from the canonical source directory:

```bash
cd .arog/axon
npm install
npm test
npm run lint
npm run bench
```

The package requires Node 20 or newer and uses Node's built-in test runner. `npm test` exercises the CLI, installer, hooks, guards, issue tracker, Copilot adapter, plugins, QA, status line, structure, and tool behavior. `npm run lint` runs the structure test suite. `npm run bench` measures hook latency.

For a feature or bug fix:

1. Read the component catalog before adding a new surface.
2. Work on a branch or worktree because a live Claude session loads Axon directly from its checkout.
3. Add or update a focused test and observe the RED result.
4. Implement the smallest change.
5. Run `npm test`, `npm run lint`, and the relevant acceptance checks.
6. Run `axon-verify` from the Axon project root.
7. Use the reviewer and verifier workflows for changes involving money, data, security, production paths, or shared hooks.
8. Update the relevant decision or acceptance record when behavior or architecture changes.

The component catalog is the source of truth for the shipped surface: [03-component-catalog.md](.arog/axon/03-component-catalog.md).

## Evidence And Design Decisions

Axon was built through measured proof-of-concept and acceptance cycles, not only documentation:

- The design comparison found inline execution equal on the hidden task set while using less time and model cost than orchestration-heavy alternatives. Hooks supply the process enforcement that inline execution alone lacks.
- The P1 acceptance record demonstrates RED to GREEN to REFACTOR to DONE with recorded evidence and shows why an independent verifier matters for rounding and other subtle defects.
- The Copilot acceptance record documents the adapter, payload mapping, export manifest, and a live VS Code guard denial.
- ADR-0004 explains self-contained plugins, per-repository state, ordered evidence, both test-result hook events, fail-open hook behavior, and JSON permission denials.
- ADR-0009 explains the single Copilot adapter and manifest-owned copied exports.

Relevant records:

- [Build plan and acceptance records](.arog/axon/)
- [Component catalog](.arog/axon/03-component-catalog.md)
- [Threat model](.arog/axon/docs/threat-model.md)
- [Workflow guide](.arog/axon/docs/guides/workflows.md)
- [Legacy inventory](.arog/axon/docs/inventory.md)
- [Architecture decisions](.arog/axon/docs/decisions/)
- [Operational setup](.arog/axon/SETUP.md)

## Runtime Layout

Axon keeps installation, source, and runtime data separate:

| Location | Contents |
| --- | --- |
| `~/.claude/.arog/axon` | Axon checkout loaded by Claude Code |
| `~/.claude/settings.json` | Merged Claude settings, with a backup created before installation |
| `~/.claude/rules/axon` | Link to Axon global rules |
| `~/.axon/docs` | Plans, reviews, issues, guides, changes, and QA reports |
| `~/.axon/state` | Per-repository task phases and evidence |
| `~/.axon/logs` | Redacted guard decisions and hook diagnostics |
| `~/.axon/events` | Optional observability events |
| `~/.axon/tools` | Pinned CLI tools |
| `~/.axon/backups` | Settings backups |
| `~/.axon/legacy` | Archived old setup, retained for restore |
| `~/.axon/secrets` | Local credentials and browser state, never committed |
| `<repo>/.axon/config.json` | Project verify commands, protected paths, and hook switches |

## Current Boundaries

Axon is deliberately explicit about what is and is not complete:

- ADP project kits are built from repository rules but need end-to-end runs on the work Mac.
- Copilot CLI behavior is designed and covered by fixtures, but it has not been live-tested here.
- Browser QA requires Chrome and the pinned CLI tools.
- The framework cannot replace project-specific tests, code review, deployment approvals, or production change controls.
- The root repository contains historical and neighboring workspace assets. Only `.arog/axon/` is the portable Axon product.

## License And Ownership

This repository does not currently declare a license file. Review the repository owner and organization policy before redistributing Axon or incorporating it into another product.
