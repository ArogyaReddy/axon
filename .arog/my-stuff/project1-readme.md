# ADP e Platform Agentic Workspace

A meta-repository providing a standardized environment for working with ADP e Platform codebases using Claude Code AI tools and workflows.

## Who is this for?

This workspace is built for **everyone** working on or around the ADP e Platform — not just developers:

| Role                            | What you'll use                                                                                       |
|---------------------------------|-------------------------------------------------------------------------------------------------------|
| **Developers**                  | Event/grid/schema generators, code exploration, dev setup, encryption helpers, PR review skills       |
| **Business analysts**           | Event spec builders, knowledge-base Q&A, event explainers, documentation tools                        |
| **QA testers**                  | Automation triggers (Playwright + e-events), test-case search, must-test tagging, QA session tracking |
| **Performance analysts**        | GraphQL query analyzer, CloudWatch log search, manifest analyzer                                      |
| **Ops / on-call**               | Production alert researcher, lambda log-level toggling, deployment inventory, release notes           |
| **Federated team contributors** | Federated docs workflows, Trac management, link validation                                            |
| **Project managers**            | Trac ticket management, release notes, daily platform reports                                         |

You don't need to install or understand every plugin — pick the plugins that match your role and Claude Code will surface only those skills.

---

## Quick Start

### 1. Prerequisites

- [Claude Code](https://code.claude.com/docs/en/quickstart) installed and logged in
- A Bitbucket account with access to `https://bitbucket.es.ad.adp.com`
- (Devs/platform contributors only) the platform repos cloned via `./tools/setup-repos.sh`

### 2. Install plugins

```bash
npm run plugins
```

This script:
1. Backs up your existing `~/.claude/settings.json`
2. Adds this workspace as a plugin marketplace
3. Enables all plugins

Restart Claude Code after running.

### 3. Manual setup [No need to clone this repo]

If you prefer to configure manually, edit `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "adp-e-agentic-workspace": {
      "source": {
        "source": "git",
        "url": "ssh://git@bitbucket.es.ad.adp.com:7999/il/adp-e-agentic-workspace.git",
        "ref": "master"
      },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "adp-e-aisdlc@adp-e-agentic-workspace": true,
    "adp-e-database-tools@adp-e-agentic-workspace": true,
    "adp-e-doc-tools@adp-e-agentic-workspace": true,
    "adp-e-knowledge-base@adp-e-agentic-workspace": true,
    "adp-e-qa-tools@adp-e-agentic-workspace": true,
    "adp-e-quality@adp-e-agentic-workspace": true,
    "adp-e-release@adp-e-agentic-workspace": true,
    "adp-e-utilities@adp-e-agentic-workspace": true,
    "adp-e-client-success@adp-e-agentic-workspace": true,
    "adp-e-cool-cats@adp-e-agentic-workspace": true,
    "adp-e-front-end@adp-e-agentic-workspace": true,
    "adp-e-teamml@adp-e-agentic-workspace": true
  }
}
```

You don't have to enable all 12 — pick only what matches your role.

### 4. Workspace contributors (editing plugins)

If you cloned this repo to **edit** plugins (not just use them):

```bash
git clone https://bitbucket.es.ad.adp.com/scm/il/adp-e-agentic-workspace.git
cd adp-e-agentic-workspace
./tools/setup-repos.sh   # optional — clone platform repos you'll work alongside
```

This repo's `.claude/settings.json` already declares the marketplace as `directory`-sourced, so Claude Code loads plugins straight from the working tree:

```json
"extraKnownMarketplaces": {
  "adp-e-agentic-workspace": {
    "source": { "source": "directory", "path": "." }
  }
}
```

**Edit a `SKILL.md`, `plugin.json`, or `marketplace.json` → reload Claude Code (`/plugin` UI or restart) → changes are live.** No git push needed.

If a reload doesn't pick up a change (rare — usually a stale cache), fall back to launching Claude with an explicit plugin directory:

```bash
claude --plugin-dir ./plugins/adp-e-aisdlc
```

This bypasses the marketplace entirely and loads the plugin straight from disk.

---

## Available Plugins

Skills are invoked as `/plugin-name:skill-name` or `/skill-name` if unique. Claude can also auto-invoke skills when the task matches.

**Shared plugins (8)**

| Plugin                 | Skills | Audience     | Sample skills                                                              |
|------------------------|--------|--------------|----------------------------------------------------------------------------|
| `adp-e-aisdlc`         | 13     | Devs, BAs    | `/event-spec-builder`, `/event-from-spec`, `/grid-from-spec`, `/facts-query-gen` |
| `adp-e-database-tools` | 1      | Devs, perf   | `/db-connect`                                                              |
| `adp-e-doc-tools`      | 4      | All          | `/e-markitdown`, `/create-power-point`, `/export-events-from-doc-to-md`    |
| `adp-e-knowledge-base` | 3      | All          | `/qna`, `/embedded-forms`, `/event-explainer`                              |
| `adp-e-qa-tools`       | 3      | QA           | `/e-automation`, `/qa-tracker`, `/e-must-test`                             |
| `adp-e-quality`        | 1      | Devs         | `/pr-review`                                                               |
| `adp-e-release`        | 3      | Ops, release | `/e-show-package-inventory`, `/manifest-analyzer`, `/release-notes-builder` |
| `adp-e-utilities`      | 8      | All          | `/dev-setup`, `/trac-management`, `/e-ownership`, `/code-explorer`, `/e-locksmith` |

**Team-owned plugins (4)** — under `plugins/teams/`

| Plugin                 | Skills | Owner                | Sample skills              |
|------------------------|--------|----------------------|----------------------------|
| `adp-e-client-success` | 2      | Client Success team  | `/prod-alert-researcher`, `/graphql-query-analyzer` |
| `adp-e-cool-cats`      | 2      | Cool Cats team       | `/e-daily-platform-report`, `/lambda-log-level` |
| `adp-e-front-end`      | 1      | Front End team       | `/pr-review-front-end`     |
| `adp-e-teamml`         | 1      | Team ML              | `/pr-review-mlteam`        |

See each plugin's `README.md` under `plugins/` for full skill listings, prerequisites, and usage examples.

---

## Repository Structure

```
adp-e-agentic-workspace/
├── .claude/
│   └── settings.json              # Auto-enables all plugins on workspace open
├── .claude-plugin/
│   └── marketplace.json           # Marketplace registry (12 plugins)
├── plugins/                       # Installable Claude Code plugins
│   ├── adp-e-aisdlc/              # AI SDLC (13 skills)
│   ├── adp-e-database-tools/      # Database queries (1)
│   ├── adp-e-doc-tools/           # Documentation (4)
│   ├── adp-e-knowledge-base/      # Platform knowledge (3)
│   ├── adp-e-qa-tools/            # QA automation (3)
│   ├── adp-e-quality/             # Code quality / PR review (1)
│   ├── adp-e-release/             # Release engineering (3)
│   ├── adp-e-utilities/           # Cross-cutting utilities (8)
│   ├── teams/                     # Team-owned plugins
│   │   ├── adp-e-client-success/  # (2)
│   │   ├── adp-e-cool-cats/       # (2)
│   │   ├── adp-e-front-end/       # (1)
│   │   └── adp-e-teamml/          # (1)
│   └── README.md                  # Plugin contribution guide
├── tools/
│   ├── setup-repos.sh             # Clone/update platform repositories
│   ├── install-plugins.py         # Auto-configure plugins in user settings
└── [repositories]/                # Cloned platform repos (gitignored)
    ├── adp-e-platform/
    ├── adp-e-product/
    ├── adp-e-sdk/
    ├── adp-e-front-end/
    ├── adp-e-cli/
    ├── adp-e-master-data/
    ├── adp-e-db-releases/
    ├── adp-e-doc-federated/
    ├── adp-e-doc-internal/
    └── adp-e-doc-public/
```

---

## Platform Repositories

| Repository            | Purpose                                             | Audience        |
|-----------------------|-----------------------------------------------------|-----------------|
| `adp-e-platform`      | Infrastructure, ECS/Lambda services, GraphQL server | Platform team   |
| `adp-e-product`       | Business domains — controllers, events, experiences | All developers  |
| `adp-e-sdk`           | Independently versioned npm modules                 | All developers  |
| `adp-e-front-end`     | New Roll/E apps (e-auth, e-web)                     | Front-end team  |
| `adp-e-cli`           | `e-cli` and `roll-cli` binaries (Go/Cobra)          | Platform team   |
| `adp-e-master-data`   | Metadata management (METAgen)                       | All teams       |
| `adp-e-db-releases`   | Database migration scripts                          | Platform team   |
| `adp-e-doc-federated` | Public federated documentation                      | Federated teams |
| `adp-e-doc-internal`  | Internal platform documentation                     | Platform team   |
| `adp-e-doc-public`    | PaaS partner documentation                          | Platform team   |

Setup options via `./tools/setup-repos.sh`:
- **Full Platform Stack** — all repositories (platform team)
- **Product Development Only** — `adp-e-product` + `adp-e-doc-federated` (federated teams)

---

## AWS Environments

| Env  | Purpose                         | Profile                       |
|------|---------------------------------|-------------------------------|
| DIT  | Development Integration Testing | `DIT`                         |
| FIT  | Functional Integration Testing  | `FIT`                         |
| HF   | Hotfix                          | `FIT` account, `HF-` prefix   |
| STG  | Staging                         | `STG`                         |
| SB   | Sandbox                         | `STG` account, `SB-` prefix   |
| PROD | Production                      | `PROD`                        |
| PRT  | Performance Testing             | `PROD` account, `PRT-` prefix |

Resource naming: `{ENV}-resource-name` (e.g., `DIT-adp-e-rate-limiter`)

Authentication: `e-cli awsrole login --all` (expires every 12 hours)

---

## Contributing

Anyone can contribute — devs, BAs, QA, ops. The contribution model is the same regardless of role.

### Where does my plugin go — `plugins/` or `plugins/teams/`?

- **`plugins/<name>/` (shared)** — Horizontal plugins scoped by *function* (events, docs, qa, release, utilities, etc.). Anyone contributes; lifecycle is collective.
- **`plugins/teams/<name>/` (team-owned)** — Plugins maintained by a specific team. Skills inside are scoped to that team's domain; other teams are unlikely to contribute. The owning team decides what skills get added, removed, or changed.

When deciding: if a skill could reasonably accept contributions from any team, it belongs in a shared plugin. If it encodes one team's conventions, codebase, or domain knowledge that only that team will maintain, it belongs under `plugins/teams/`.

### Quick decision tree

| What you want to do                                               | Where to go                                                                           |
|-------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| Add a new skill to an existing plugin                             | [Add a skill](#add-a-skill-to-an-existing-plugin)                                     |
| Create a brand-new plugin                                         | [Create a plugin](#create-a-new-plugin)                                               |
| Fix wording, examples, or descriptions in an existing skill       | Edit the skill's `SKILL.md` directly + bump the plugin's version                      |
| Add MCP servers, hooks, or monitors                               | See [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference) |
| Convert a personal `.claude/skills/` workflow into a plugin skill | Same as adding a skill — copy `SKILL.md` and supporting files into the right plugin   |

### Add a skill to an existing plugin

1. **Pick the right plugin.** Match by domain (event work → `adp-e-event-tools`, ops → `adp-e-ops-tools`, etc.). When unsure, ask in the team channel or open a draft PR with your best guess.
2. **Create the skill folder.**
   ```bash
   mkdir -p plugins/<plugin>/skills/<skill-name>
   ```
   Skill names are kebab-case (e.g., `my-new-skill`).
3. **Write `SKILL.md`** with frontmatter:
   ```markdown
   ---
   name: my-new-skill
   description: One sentence — what it does AND when Claude should use it. This text is what triggers auto-invocation, so be specific about user-phrasings ("when the user asks to X, Y, or Z").
   allowed-tools: [Bash, Read, Grep]
   ---

   # My New Skill

   Step-by-step instructions for Claude. Use $ARGUMENTS for user input.
   ```
4. **(Optional) Add supporting files** — `bin/` for scripts, `context/` for reference data, `workflows/` for multistep routines.
5. **Update the plugin's `README.md`** — add your skill to the skill table.
6. **Bump the plugin version** — edit `plugins/<plugin>/.claude-plugin/plugin.json`:
   - **PATCH** (`1.0.0 → 1.0.1`): wording, doc, or example tweaks
   - **MINOR** (`1.0.0 → 1.1.0`): new skill or new feature
   - **MAJOR** (`1.0.0 → 2.0.0`): renamed or removed skill, breaking change
   The `version` is **only** in `plugin.json` — the marketplace entry intentionally has no `version` so the manifest is the single source of truth.
7. **Test locally.**
   ```bash
   claude --plugin-dir ./plugins/<plugin>
   /reload-plugins
   /my-new-skill   # try it
   ```
8. **Open a PR** against `master`. The PR will be reviewed by the plugin's owner team.

### Create a new plugin

Only do this if your skill family doesn't fit any existing plugin, and you have at least 2-3 skills planned.

1. **Pick a kebab-case name** prefixed with `adp-e-` (e.g., `adp-e-security-tools`).
2. **Scaffold the directory:**
   ```bash
   mkdir -p plugins/adp-e-myplugin/{.claude-plugin,skills,bin,hooks,monitors}
   touch plugins/adp-e-myplugin/{bin,hooks,monitors}/.gitkeep
   ```
3. **Create `.claude-plugin/plugin.json`:**
   ```json
   {
     "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
     "name": "adp-e-myplugin",
     "displayName": "ADP e My Plugin",
     "version": "1.0.0",
     "description": "What this plugin does — one sentence",
     "author": { "name": "ADP e Platform Team" },
     "repository": "https://bitbucket.es.ad.adp.com/scm/il/adp-e-agentic-workspace.git",
     "category": "category-name",
     "license": "UNLICENSED",
     "keywords": ["tag1", "tag2"]
   }
   ```
4. **Add at least one skill** following the [skill steps above](#add-a-skill-to-an-existing-plugin).
5. **Create the plugin's `README.md`** — overview + skill table + prerequisites.
6. **Register in `.claude-plugin/marketplace.json`:**
   ```json
   {
     "name": "adp-e-myplugin",
     "displayName": "ADP e My Plugin",
     "source": "./adp-e-myplugin",
     "description": "Same description as plugin.json",
     "keywords": ["tag1", "tag2"],
     "category": "category-name"
   }
   ```
7. **Update `.claude/settings.json`** — add `"adp-e-myplugin@adp-e-agentic-workspace": true`.
8. **Update root `README.md`** — add the plugin to the table and repository structure tree.
9. **Update `CLAUDE.md`** — add the plugin to the plugin table.
10. **Test, then PR** — same as adding a skill.

### Rules of the road

- **`adp-e-` prefix** is required on all plugin and skill directories.
- **`name` in `plugin.json` must match the directory name** exactly.
- **No files outside the plugin directory** — keep plugins self-contained.
- **No `../` in paths** — use `${CLAUDE_PLUGIN_ROOT}` for runtime references in MCP/hook configs.
- **Frontmatter `description` is required** on every `SKILL.md` — without it, Claude can't auto-invoke the skill.
- **Bump the version on every change** — without a bump, consumers won't see the update.
- **Keep skills focused** — one skill per capability, not Swiss Army knives.
- **Test locally before pushing** — `claude --plugin-dir ./plugins/<plugin>` and try every skill you changed.
- **No secrets in skill content** — passwords, tokens, internal URLs with credentials. Use `userConfig` in `plugin.json` if a skill needs user input.

### Detailed reference

For full schemas, hook events, MCP path variables, monitor formats, and SKILL.md frontmatter options, see Claude Code's official docs: [code.claude.com/docs/en/plugins](https://code.claude.com/docs/en/plugins) and [plugins-reference](https://code.claude.com/docs/en/plugins-reference).

---

## Resources

- **Claude Code project instructions**: [CLAUDE.md](CLAUDE.md)
- **Bitbucket**: `https://bitbucket.es.ad.adp.com/scm/il`
- **Claude Code plugin docs**: [code.claude.com/docs/en/plugins](https://code.claude.com/docs/en/plugins)

Internal ADP repository — not for public distribution.
