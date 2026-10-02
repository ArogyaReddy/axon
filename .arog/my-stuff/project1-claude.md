# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **ADP e Platform Agentic Workspace**, a meta-repository that provides a standardized environment for working across multiple ADP e Platform codebases.

**Purpose**: Standardize agents, skills, MCPs, and tools that all team members (developers, business analysts, QA testers, performance analysts) and federated teams can use.

**What it contains**:
- Ten core ADP e Platform repositories for unified cross-repository development and analysis
- **Integrated Trac ticket management** - Create, query, update, and manage tickets directly from the workspace
- Specialized skills for common platform analysis tasks
- Command-line tools for workspace and repository management

**Key Capabilities**:
- Repository management and synchronization
- Trac integration (requires `TRAC_USERNAME` and `TRAC_PASSWORD` environment variables)
- Event analysis and documentation
- Production alert investigation
- Build inventory tracking
- Federated documentation workflows
- Database query and analysis across lower environments

## Quick Start

### Setup

To set up the workspace, run the setup script:

```bash
./tools/setup-repos.sh
```

You'll be prompted to choose your development type:

1. **Full Platform Stack** - Clones all repositories:
   - `/adp-e-platform` - Infrastructure and services
   - `/adp-e-product` - Business domains
   - `/adp-e-sdk` - SDK modules
   - `/adp-e-front-end` - Front-end applications
   - `/adp-e-cli` - Command line tools (platform developers only)
   - `/adp-e-doc-federated` - Federated documentation
   - `/adp-e-doc-internal` - Internal platform documentation (platform team only)
   - `/adp-e-doc-public` - Public documentation for PaaS partners (platform team only)
   - `/adp-e-master-data` - Master data and reference data
   - `/adp-e-db-releases` - Database migration scripts and release management
   - Best for: Core platform team members

2. **Product Development Only** (Recommended for federated teams) - Clones:
   - `/adp-e-product` - Business domains
   - `/adp-e-doc-federated` - Federated documentation
   - Best for: Business domain development, controller/event work, federated teams

To update existing repositories:
```bash
./tools/setup-repos.sh --update
```

The default Git server is configured for ADP's Bitbucket:
`https://bitbucket.es.ad.adp.com/scm/il`

### Next Steps

After setup, choose your path:

- **Developers**: See [Common Commands](docs/COMMON-COMMANDS.md) for build, test, and local development commands
- **Using Skills**: See [Skills Reference](docs/SKILLS-REFERENCE.md) for available workspace skills
- **AWS Operations**: See [AWS Environments](docs/AWS-ENVIRONMENTS.md) for account details and authentication
- **Trac Integration**: See [Trac Integration Guide](docs/TRAC-INTEGRATION.md) for ticket management setup

## Repository Overview

### CRITICAL: Front-End Migration Status

**The platform is currently running TWO front-end applications in parallel during user migration:**

1. **Legacy Roll** (in `adp-e-platform/services/adp-e-front-end/`)
   - Original Roll by ADP mobile and desktop application
   - Being phased out but still serving active users
   - Located in the platform monorepo

2. **New Roll/E** (in `adp-e-front-end/packages/apps/`)
   - Modern rewrite with improved architecture
   - New users are onboarded here
   - Separate repository with pnpm workspace

**⚠️ IMPORTANT: Until migration completes and legacy front-end is removed, ALL front-end fixes must be implemented in BOTH locations:**
   - `adp-e-platform/services/adp-e-front-end/` (legacy)
   - `adp-e-front-end/packages/apps/e-mobile/` or `e-web/` (new)

This ensures consistency for all users regardless of which front-end version they're using. Examples of parallel fixes:
- Apple-app-site-association files
- Nginx configurations
- Plaid integration
- Authentication flows
- Deep linking configurations
- Static assets on e.adp.ai domain

---

### Available Repositories

| Repository | Purpose | Audience | Details |
|------------|---------|----------|---------|
| `/adp-e-platform` | Infrastructure & legacy services | Platform team | [→ Details](docs/REPOSITORIES.md#adp-e-platform) |
| `/adp-e-product` | Business domains | All developers | [→ Details](docs/REPOSITORIES.md#adp-e-product) |
| `/adp-e-sdk` | Shared npm modules | All developers | [→ Details](docs/REPOSITORIES.md#adp-e-sdk) |
| `/adp-e-front-end` | New Roll/E applications | Front-end team | [→ Details](docs/REPOSITORIES.md#adp-e-front-end) |
| `/adp-e-cli` | Command-line tools | Platform team | [→ Details](docs/REPOSITORIES.md#adp-e-cli) |
| `/adp-e-master-data` | Metadata (METAgen) | All teams | [→ Details](docs/REPOSITORIES.md#adp-e-master-data) |
| `/adp-e-db-releases` | Database migrations | Platform team | [→ Details](docs/REPOSITORIES.md#adp-e-db-releases) |
| `/adp-e-doc-federated` | Public documentation | Federated teams | [→ Details](docs/REPOSITORIES.md#adp-e-doc-federated) |
| `/adp-e-doc-internal` | Internal documentation | Platform team | [→ Details](docs/REPOSITORIES.md#adp-e-doc-internal) |
| `/adp-e-doc-public` | PaaS partner documentation | Platform team | [→ Details](docs/REPOSITORIES.md#adp-e-doc-public) |

**→ See [docs/REPOSITORIES.md](docs/REPOSITORIES.md) for architecture, build commands, testing, deployment, and dependencies.**

## Available Plugins

Skills are organized into **12 plugins** — 8 horizontal/shared plus 4 team-owned. Shared plugins live at `plugins/<name>/`; team plugins live at `plugins/teams/<name>/`.

### Shared (8)

| Plugin | Skills | Description |
|--------|--------|-------------|
| **adp-e-aisdlc** (13) | event-from-spec, event-spec-builder, event-schema-implementer, e-spec-from-event, e-spec-verify, e-spec-verify-and-fix, e-spec-generate-and-verify, event-graphql-verification, e-logical-data-model-from-spec, e-event-prototype-from-spec, e-flow-prompt-from-meta, facts-query-gen, grid-from-spec | AI SDLC — event/spec lifecycle, code generation, prototypes, FACTS queries |
| **adp-e-database-tools** (1) | db-connect | Database queries against DIT/FIT/STG |
| **adp-e-doc-tools** (4) | e-markitdown, export-events-from-doc-to-md, start-federated-doc-work, create-power-point | Documentation — conversion, presentations |
| **adp-e-knowledge-base** (3) | event-explainer, qna, embedded-forms | Platform knowledge — Q&A, architecture, event explainer |
| **adp-e-qa-tools** (3) | e-automation, qa-tracker, e-must-test | QA automation — Playwright, Jenkins, session tracking, test tracking |
| **adp-e-quality** (1) | pr-review | Code quality and PR review tooling |
| **adp-e-release** (3) | e-show-package-inventory, manifest-analyzer, release-notes-builder | Release engineering — inventory, manifests, release notes |
| **adp-e-utilities** (8) | dev-setup, code-explorer, e-locksmith, claude-feature-builder, intent-description-generator, trac-management, e-ownership, link-check | Cross-cutting utilities — setup, Trac, ownership, encryption, code exploration |

### Team-owned (4)

| Plugin | Skills | Description |
|--------|--------|-------------|
| **adp-e-client-success** (2) | graphql-query-analyzer, prod-alert-researcher | Client Success team |
| **adp-e-cool-cats** (2) | e-daily-platform-report, lambda-log-level | Cool Cats team — DevX, AI SDLC, platform reporting |
| **adp-e-front-end** (1) | pr-review-front-end | Front End team |
| **adp-e-teamml** (1) | pr-review-mlteam | Team ML |

**Invocation**: `/plugin-name:skill-name` (e.g., `/adp-e-event-tools:event-explainer`) or `/skill-name` if unique.

**→ See [docs/SKILLS-REFERENCE.md](docs/SKILLS-REFERENCE.md) for comprehensive documentation, usage examples, and decision trees.**

## Workspace Organization

```
/
├── CLAUDE.md                          # This file - main entry point
├── docs/                              # Extracted documentation
│   ├── REPOSITORIES.md                # Detailed repository guide
│   ├── SKILLS-REFERENCE.md            # Skills catalog and reference
│   ├── AWS-ENVIRONMENTS.md            # AWS context and configuration
│   ├── COMMON-COMMANDS.md             # Command reference by repo
│   └── TRAC-INTEGRATION.md            # Trac setup and usage
├── tools/                             # Workspace tools and scripts
│   ├── setup-repos.sh                 # Clone/update repositories
│   └── show-package-inventory.sh      # Display deployment inventory
├── .claude-plugin/
│   └── marketplace.json               # Plugin marketplace index
├── plugins/                           # Plugin packages
│   ├── adp-e-aisdlc/                  # AI SDLC (13 skills)
│   ├── adp-e-database-tools/          # Database queries (1)
│   ├── adp-e-doc-tools/               # Documentation (4)
│   ├── adp-e-knowledge-base/          # Platform knowledge (3)
│   ├── adp-e-qa-tools/                # QA automation (3)
│   ├── adp-e-quality/                 # Code quality / PR review (1)
│   ├── adp-e-release/                 # Release engineering (3)
│   ├── adp-e-utilities/               # Cross-cutting utilities (8)
│   ├── teams/                         # Team-owned plugins
│   │   ├── adp-e-client-success/      # (2)
│   │   ├── adp-e-cool-cats/           # (2)
│   │   ├── adp-e-front-end/           # (1)
│   │   └── adp-e-teamml/              # (1)
│   └── README.md                      # Plugin contribution guide
└── [repositories]/                    # Cloned repositories (gitignored)
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

## Operational Instructions

### Repository Checks
- If adp-e-agentic-workspace repo itself is not up to date with origin, offer the user to update it and do a "git pull" to bring it up to date
- If repos are not present on startup, ask the user if they want to clone them now
- **When doing research, always check if the relevant repository is present before attempting to navigate its code**
  - Use `ls` or check for directory existence before reading files from a repo
  - If a repo is not present, inform the user which repo is needed and offer to clone it
  - Remember: "Product Development Only" setups only have `adp-e-product` and `adp-e-doc-federated` cloned

### Repository Management
- Each cloned repo has its own CLAUDE.md with detailed guidance - read these for repo-specific context
- Before working on a repository, check if it's up-to-date: `git fetch && git status`
- Offer to update repos with `./tools/setup-repos.sh --update` or `git pull`

### Repository Dependencies
When working across repositories, be aware of dependencies:
- adp-e-product depends on adp-e-sdk modules
- adp-e-platform has legacy modules (prefer adp-e-sdk for new code)
- adp-e-front-end uses libraries from both sdk and platform

### Front-End Special Handling
**CRITICAL: Front-end fixes must be implemented in BOTH repositories during migration:**
- Legacy Roll: `adp-e-platform/services/adp-e-front-end/`
- New Roll/E: `adp-e-front-end/packages/apps/e-mobile/` or `e-web/`
- This includes: apple-app-site-association, nginx configs, Plaid, auth flows, deep links, static assets

## Common Commands Quick Reference

| Repository | Setup | Build | Test |
|------------|-------|-------|------|
| **adp-e-platform** | `npm run setup` | `make -j 6 all` | `npm test` |
| **adp-e-product** | `bin/setup.sh` | `make -j 6 all` | `npm test` |
| **adp-e-sdk** | `make root` | `make -j 6 all` | `npm test` |
| **adp-e-front-end** | `pnpm i` | `pnpm build` | `pnpm test` |
| **adp-e-cli** | `go mod download` | `go build -tags dev` | `go test ./...` |
| **adp-e-master-data** | `make root` | `make meta` | `npm test` |
| **adp-e-doc-public** | `npm install` | `npm run build` | N/A |

**Automated setup:** `/dev-setup`

**→ See [docs/COMMON-COMMANDS.md](docs/COMMON-COMMANDS.md) for local development, troubleshooting, and environment-specific commands.**

## Documentation Maintenance

When making changes to plugins or skills, update the relevant README files:

| Change type | Update |
|-------------|--------|
| New skill added | Plugin `README.md` + marketplace version bump |
| New plugin added | Plugin `README.md` + `marketplace.json` entry + root `CLAUDE.md` plugins table |
| Plugin removed or renamed | `marketplace.json` + root `CLAUDE.md` plugins table |
| Skill behaviour changes | Plugin `README.md` |

---

## Git Commit Message Format

**First line (required):**
```
TICKET_NUMBER - MODULE - Short description
```

**Components:**
- `TICKET_NUMBER` - Trac ticket number if associated with a ticket (e.g., `17643`)
- `MODULE` - **Optional** - Include only if focused on specific event canonical, function, file, or domain
  - **Omit if changes span multiple areas**
- `Short description` - Brief summary of change in **imperative mood** ("Add", "Fix", "Update")

**Examples:**
```bash
# Focused changes (include MODULE)
17643 - user.register - Add user context preservation
15234 - EventTreeImpl - Update root event detection

# Broad changes (omit MODULE)
17643 - Preserve user context in chained events
15234 - Fix bi-temporal query performance
```

**Second message (optional body):**
Always include `Co-Authored-By-Claude` when Claude assisted
```bash
git commit -m "TICKET_NUMBER - MODULE - Short description" \
           -m "Changes:
- Component 1: What changed and why
- Component 2: What changed and why

Co-Authored-By: Claude
```

## AWS Environment Context

| Profile | Account ID | Purpose |
|---------|------------|---------|
| DIT | 781142929438 | Development/Integration Testing |
| FIT | 307472550066 | Functional Integration Testing |
| STG | 018034343515 | Staging/Demo |
| PROD | 459809240342 | Production |

**Special environments:** HF (Hotfix), SB (Sandbox) share accounts but use prefix filters.

**Authentication:** `e-cli awsrole login --all` (credentials expire after 12 hours)

**Resource naming:** `{ENV}-resource-name` (e.g., `DIT-adp-e-event-hr`)

**Region:** us-east-1 (default)

**→ See [docs/AWS-ENVIRONMENTS.md](docs/AWS-ENVIRONMENTS.md) for authentication details, common operations, and troubleshooting.**

## Trac Integration

**Prerequisites:** Set environment variables:
```bash
export TRAC_USERNAME="your-trac-username"
export TRAC_PASSWORD="your-trac-password"
```

**Usage:** `/trac-management <command>` - View tickets, create defects, query, add comments, check deployments

**→ See [docs/TRAC-INTEGRATION.md](docs/TRAC-INTEGRATION.md) for setup, usage examples, field reference, and workflows.**

## Key Technologies

- **Languages**: TypeScript, JavaScript, Go
- **Frontend**: React 16.14.0
- **Backend**: Node.js (CommonJS), AWS Lambda
- **Data**: MySQL/Aurora, Redis, GraphQL
- **Build**: GNU Make, pnpm, npm
- **Testing**: Jest, Mocha
- **CI/CD**: Jenkins

## Documentation Resources

- [Repository Reference](docs/REPOSITORIES.md) - Detailed information about each repository
- [Skills Reference](docs/SKILLS-REFERENCE.md) - Complete skills catalog with examples
- [Common Commands](docs/COMMON-COMMANDS.md) - Command reference by repository
- [AWS Environments](docs/AWS-ENVIRONMENTS.md) - AWS account details and operations
- [Trac Integration](docs/TRAC-INTEGRATION.md) - Trac ticket management guide

## Getting Help

- **Skills**: Use `/help` to get information about available skills
- **Documentation**: Browse `docs/` directory for detailed guides
- **Repository-specific**: Read `CLAUDE.md` in each cloned repository
- **Feedback**: Report issues at https://github.com/anthropics/claude-code/issues
