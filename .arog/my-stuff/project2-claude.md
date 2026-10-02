# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is `adp-e-product`, the main business domain repository for the ADP-e platform. It implements a multi-domain microservices architecture using TypeScript, React, and AWS Lambda. The codebase is organized into 15+ business domains (accounting, benefits, core, crm, hr, insurance, leave, payroll, staffing, support, system, talent, testing, time) with a shared foundation.

## Architecture

### Multi-Domain Structure

The repository follows a domain-driven design with each domain in `src/`:

- Each domain is a separate package with its own `package.json`, TypeScript config, and ESLint config
- **`src/shared/`** - Foundation layer providing common types, GraphQL schemas, utilities, controllers, and React components used across all domains
- **Domain directories** - Each domain (e.g., `src/core/`, `src/payroll/`, etc.) contains:
  - `controllers.ts` - Registers business conversation controllers organized by country code
  - `events.ts` - Registers event handlers using the event-driven architecture
  - `api.ts` - Entry point for API handlers
  - `triggers.ts` - Entry point for trigger handlers
  - `skills.ts` - Entry point for skill handlers (state decision functions)
  - `controllers/` - Business conversation controllers (`.ctrl.tsx` files)
  - `events/` - Event implementations organized by event canonical name
  - `skills/` - Skill implementations organized by event canonical name
  - `config/` - Domain-specific configuration
  - `triggers/` - Trigger implementations

### Key Architectural Patterns

**Controllers (Conversation Pattern)**:

- Controllers are React-based business conversation flows (`.ctrl.tsx` files)
- Extend `BaseBusinessController` from `src/shared/controllers`
- Use a props/state pattern similar to React components
- Support country-specific implementations (e.g., `US/`, `IE/` subdirectories)
- Controllers are registered in `controllers.ts` with country codes (`'00'` for global, `'US'`, `'IE'`, etc.)
- Controllers communicate via chat messages using React components like `<PlainTextMessage>`
- Example: `src/core/controllers/conversations/invite.accept.ctrl.tsx`

**Events (Event-Driven Pattern)**:

- Events follow a canonical naming convention (e.g., `user.logout`, `invite.accept`)
- Each event directory contains:
  - `index.ts` - Exports `getEventStructures()` returning `EventStructure[]` with context and implementations
  - Event implementation files with country-specific logic
  - Optional `workflow-mappings/` for complex event chains
- Events are registered in domain `events.ts` by importing and spreading their event structures
- Events use the `@adplabs/e-event-engine` framework

**Skills (State Decision Pattern)**:

- Skills are Lambda-hosted functions that evaluate state transitions for agentic flows
- Organized under `src/<domain>/skills/<canonical>/` (mirroring events directory structure)
- Each skill directory contains:
  - `index.ts` - Exports `getSkillStructures()` returning `SkillStructure[]`
  - `evaluateStateDecision.ts` - Takes event input + `currentState`, returns `nextState`
- Skills are registered in domain `skills.ts` via `LambdaLayer.register` with names like `{canonical}/evaluateStateDecision`
- Shared types in `src/shared/types/skills/index.ts`; shared handler utility in `src/shared/skills.ts`
- Each skill's `evaluateStateDecision` function uses the corresponding event's typed Input (e.g., `WorkerHireEvent.Input`)
- Only domains with event subdirectories have skills scaffolding (benefits, staffing, talent are excluded)

**GraphQL Schema**:

- Centralized in `src/shared/graphql/`
- Types organized by entity (Person, Invite, etc.) in `src/shared/graphql/types/`
- Enums in `src/shared/graphql/enums/`
- Controllers use GraphQL queries via `this.session.api.query()`

**Country-Specific Logic**:

- The codebase supports multi-country implementations
- Controllers and events are registered with country codes (`'00'` = global, `'US'`, `'IE'`, etc.)
- Use subdirectories like `controllers/conversations/US/` for country-specific controllers

**Internationalization (i18n)**:

- Translation files in `i18n/` directory organized by domain, controller, and language
- Controllers use `this.translate()` method with paths like `'Invite/Accept/ALREADY_HAVE_ACCOUNT'`
- Build i18n with `npm run i18n:run` or `npm run i18n:runLocal`

**Metadata System**:

- `meta/` directory contains metadata definitions for events, forms, grids, etc.
- Metadata built separately with `make meta`

**Experiences**:

- Special metadata-driven entities supporting business workflows with optional lambda functions
- Located in `src/hr/experiences/` and `src/payroll/experiences/`
- Follow `<noun>.<verb>` naming convention (e.g., `company.setup`, `payroll.prepare`)
- Each experience directory contains:
  - `experience_meta.ts` - Required stub. Field metadata is NO LONGER defined here — it was migrated to `meta/src/event/*.ts` and is served at runtime via GQL `eventVocabularyMeta` (see `meta/EXPERIENCE-META-MIGRATION-REPORT.md`). This file must keep `fieldMeta` empty (`export const fieldMeta = {};`); it exists only so the experience appears in `experiences-manifest.json` and to carry `metaCanonical` (the event canonical, when the experience name differs). A CI guard `bin/check-experience-meta.js` enforces the empty `fieldMeta`.
  - `form/` - Optional Handlebars templates for custom forms
  - `index.ts` - Optional lambda handler entry point for backend logic
- Most experiences are meta-only; lambda is opt-in for complex business logic

## Lambda Packaging and Deployment

### Lambda Naming Convention

When deployed to AWS, lambdas follow these naming patterns:

**Domain Lambdas** - `adp-e-{type}-{domain}`:

- `adp-e-event-{domain}` - Event handlers (e.g., `adp-e-event-hr`, `adp-e-event-payroll`)
- `adp-e-ctrl-{domain}` - Controller handlers (e.g., `adp-e-ctrl-hr`, `adp-e-ctrl-shared`)
- `adp-e-api-{domain}` - API handlers (e.g., `adp-e-api-hr`, `adp-e-api-payroll`)
- `adp-e-triggers-{domain}` - Trigger handlers (e.g., `adp-e-triggers-hr`)
- `adp-e-skills-{domain}` - Skill handlers (e.g., `adp-e-skills-hr`, `adp-e-skills-core`)

**Experience Lambdas** - `adp-e-exp-{experienceName}`:

- Only deployed if experience has `index.ts` file
- Examples: `adp-e-exp-payrollPrepare`, `adp-e-exp-companySetup`
- Support multiple actions via function parameter (e.g., `/render`, `/calculate`, `/submit`)

**Grid Lambdas** - `adp-e-grid-{gridName}.read`:

- Examples: `adp-e-grid-workforceIndicativeDataGrid.read`

During deployment, branch/version info may be appended (e.g., `adp-e-event-hr-3885-product.25.1.0`).

### Build and Package Process

The lambda packaging process is managed by `bin/bundle.sh` for each domain:

**1. Domain Compilation**:

- Install dependencies: `npm install`
- Validation: `npm run check-event-types`, `npm run check-controllers`
- Linting: `npm run lint`
- TypeScript compilation: `npm run compile` (outputs to `dist/`)
- Bundle with esbuild: `node esbuild.config.mjs {domain}` (outputs to `build-es/`)
- Unit tests: `TEST_BUSINESS_DOMAIN={domain} npm run test`

**2. Domain Lambda Packaging** (bundle.sh:112-135):

- Creates deployment packages for four lambda types per domain:
  - `events` → `adp-e-event-{domain}.zip`
  - `controllers` → `adp-e-ctrl-{domain}.zip`
  - `api` → `adp-e-api-{domain}.zip`
  - `triggers` → `adp-e-triggers-{domain}.zip`
- Each package includes:
  - Compiled JavaScript from `build-es/{domain}/{type}.*`
  - Configuration files from `config/`
  - SSL certificates from `.e-ssl/`
- Outputs to `deployment-packages/` directory

**3. Grid Packaging** (bundle-grids.sh):

- Discovers grid definitions in `build-es/{domain}/grids/`
- Packages each grid as separate lambda
- Naming: `adp-e-grid-{gridName}.read.zip`

**4. Experience Packaging** (bundle-experiences.sh):

- Discovers experiences in `build-es/{domain}/experiences/`
- Packages three types of artifacts:
  - **Metadata** (`experience_meta.json`) - Always included if present
  - **Forms** (`.handlebars` templates) - Included if `form/` directory exists
  - **Lambda** - Only included if `index.js` exists
- Lambda-backed experiences packaged as: `adp-e-exp-{experienceName}.zip`
- Tracks three lists:
  - `LAMBDA_EXPERIENCE_NAMES[]` - Experiences with lambda handlers
  - `META_EXPERIENCE_NAMES[]` - Experiences with metadata
  - `FORM_EXPERIENCE_NAMES[]` - Experiences with forms

### Deployment to AWS

**S3 Upload Locations**:

Domain lambdas:

```
s3://adp-e-lambda-functions/business/adp-e-{type}-{domain}-{TAGNAME}.zip
```

Experience lambdas:

```
s3://adp-e-lambda-functions/business/adp-e-exp-{experienceName}-{TAGNAME}.zip
```

Experience metadata:

```
s3://adp-e-assets-us-east-1/{PACKAGE}/{DOMAIN}/{EXPERIENCE_NAME}/experience/experience_meta.json
```

Experience forms:

```
s3://adp-e-assets-us-east-1/{PACKAGE}/{DOMAIN}/{EXPERIENCE_NAME}/experience/form/
```

**Manifest Recording**:

- Lambda functions tracked via `roll-cli manifest record`
- Lambda aliases recorded per package/branch
- Tracks domain lambdas, microservices, grids, and experience lambdas

### Key Differences: Experiences vs Domain Lambdas

| Aspect           | Domain Lambdas                                         | Experience Lambdas                     |
| ---------------- | ------------------------------------------------------ | -------------------------------------- |
| **Naming**       | `adp-e-{type}-{domain}`                                | `adp-e-exp-{experienceName}`           |
| **Grouping**     | Grouped by domain and type                             | One lambda per experience              |
| **Deployment**   | Always deployed per domain                             | Optional (only if `index.ts` exists)   |
| **Actions**      | Single handler per lambda                              | Multi-action (render/calculate/submit) |
| **Metadata**     | No separate metadata                                   | Metadata deploys separately to S3      |
| **Entry Points** | `events.ts`, `controllers.ts`, `api.ts`, `triggers.ts`, `skills.ts` | `index.ts` with action routing         |

## Build System

### Make-Based Build

The build system uses Make with dependency tracking:

**Initial setup** (must be done sequentially):

```bash
make root      # Install root dependencies
make shared    # Build shared domain (required by all others)
```

**Build all domains** (can be parallelized after setup):

```bash
make -j 6 all
```

**Build specific domain**:

```bash
make accounting
make core
make payroll
# etc.
```

**Clean builds**:

```bash
make clean              # Clean all domains
make clean/accounting   # Clean specific domain
make deep-clean         # Clean everything including assets
```

**Quick setup script**:

```bash
./bin/setup.sh [jobs]   # Defaults to 6 parallel jobs
npm run setup           # Alternative
```

### Domain Compilation

Each domain can be compiled individually:

```bash
cd src/core && npm run compile
```

Or compile all domains:

```bash
npm run compile-all
./bin/compile.sh
```

Compile specific domains:

```bash
./bin/compile.sh accounting benefits core
```

## Testing

**Run tests**:

```bash
npm test                          # Run tests for current package/domain
npm run test-all                  # Run all domain tests
TEST_BUSINESS_DOMAIN=core npm test   # Run tests for specific domain
```

**Test configuration**:

- Jest configuration in `jest.config.js`
- Tests located in `tests/` directories
- Test files must match `**/*.spec.ts` pattern
- Can filter by domain using `TEST_BUSINESS_DOMAIN` environment variable

**Domain-specific testing**:

```bash
cd src/core && npm test           # Run core domain tests
```

## Linting

**Run linters**:

```bash
npm run lint                      # Lint all domains
npm run lint:fix                  # Lint and auto-fix
npm run lint:cost                 # Check for expensive operations
```

**Domain-specific linting**:

```bash
cd src/core && npm run lint
cd src/core && npm run lint:fix
```

**Controller validation**:

```bash
npm run check-controllers         # Check controller naming conventions
npm run check-controller-types    # Validate controller type definitions
npm run check-event-types         # Validate event type definitions
```

**Circular dependency detection**:

```bash
npm run detect-circular-dependencies
```

### Package.json Linting (plint)

`plint` validates `package.json` files against rule sets. Run from root with `npm run plint` (which calls `node bin/check-package-json.js`).

Configuration files:
- `.plintrc.json` — default rules for the root package.json
- `.plintrc.domains.json` — stricter rules for domain packages (bans `@aws-sdk/*`, build tooling, and test frameworks from dependencies)
- `.plintrc.meta.json` — rules for the `meta/` package (requires `compile` script)

Key rules enforced:
- `no-restricted-dependencies` — bans legacy test/lint packages (mocha, chai, sinon, tslint, nyc) and, for domains, build-time tools that should live at root
- `no-restricted-devDependencies` — same bans in devDependencies
- `prefer-scripts` — requires `lint` and `test` scripts (domains also require `compile`)
- `no-duplicate-properties` — catches duplicate keys in package.json

### Boundary Checking (boundary.config.json)

`boundary.config.json` enforces architectural import boundaries between module layers within each domain. Run per-domain with `npm run lint:boundaries` (calls `e-boundary-check` from `@adplabs/e-boundary-check`).

The config defines:
- **`domains`** — list of all business domains
- **`bannedPackages`** — packages that must never be imported (legacy utilities, deprecated HTTP clients)
- **`bannedImports`** — path patterns that must never be imported (e.g., `meta/**` is build-time only)
- **`boundaries`** — directional import rules between layers:
  - `controllers` cannot import from `events` or `queries`
  - `events` cannot import from `controllers` or `queries`
  - `shared` cannot import from any domain-specific layer (terminal dependency)
  - `shared/types` cannot import from `utils` (types must be pure)
  - `api` and `triggers` cannot import from `controllers` or `queries`
  - `microservices` cannot import from `queries`
- **`allowlist`** — explicit exceptions with documented justification

Each boundary rule has a `message` with a `Fix:` hint explaining how to resolve the violation.

## Development

### Local Development Server

**Start development API server**:

```bash
npm run dev:api               # Requires PACKAGE env var set
```

**Start development with local platform**:

```bash
npm run dev:start             # For platform developers
```

**Load metadata to environment**:

```bash
npm run dev:load-meta         # Defaults to STG
npm run dev:load-meta:dit     # Load to DIT
npm run dev:load-meta:fit     # Load to FIT
npm run dev:load-meta:stg     # Load to STG
```

**Check metadata status**:

```bash
npm run dev:meta-status       # Check STG status
npm run dev:meta-status:dit
npm run dev:meta-status:fit
```

### Package/Branch Context

Many scripts auto-detect the current package/business domain using `bin/echo-package.sh`. This determines which domain to operate on based on your current directory or git branch.

### Adding New Events

1. Create event directory: `src/<domain>/events/<noun>.<verb>/`
2. Create `index.ts` exporting `getEventStructures()`
3. Implement event handler class
4. Import and register in `src/<domain>/events.ts`
5. Add translation keys to `i18n/event/<noun>.<verb>/`
6. Run `npm run check-event-types` to validate

### Adding New Controllers

1. Create controller file: `src/<domain>/controllers/<path>/<noun>.<verb>.ctrl.tsx`
2. Extend `BaseBusinessController` from `src/shared/controllers`
3. Implement `onStart()` method
4. Import and register in `src/<domain>/controllers.ts` with country code
5. Add translation keys to `i18n/controllers/<path>/`
6. Run `npm run check-controllers` to validate naming
7. Run `npm run check-controller-types` to validate types

### Working with Shared Code

- Changes to `src/shared/` require rebuilding all domains that depend on it
- After modifying shared code: `make shared` then rebuild affected domains
- Shared types are in `src/shared/types/`
- Shared GraphQL schemas are in `src/shared/graphql/`
- Shared controllers/utilities are in `src/shared/controllers/` and `src/shared/utils/`

## Internationalization

**Run i18n builds**:

```bash
npm run i18n:run              # Build all i18n files
npm run i18n:runLocal         # Build i18n locally
npm run i18n:event            # Build event translations
npm run i18n:common           # Build common translations
```

**Translation file structure**:

- Files in `i18n/` directory
- Organized by type: `controllers/`, `event/`, `forms/`, `grid/`
- Suffixed by language: `-en.json`, `-es.json`
- Controllers reference translations via paths like `'Module/Controller/KEY'`

## Event Specifications

Event specifications are structured business documentation generated from implementation code. They describe **what** an event does in business terms — never referencing source files, code patterns, or TypeScript internals.

### Location

Specs live under `docs/` following the event's canonical path:

```
docs/<domain>/<service>/<feature>/<function>/events/<eventName>/
```

Example: the canonical `/hr/workerManagement/lifecycleManagement/worker.hire` maps to:

```
docs/hr/workerManagement/lifecycleManagement/events/worker.hire/
```

### Directory Structure

```
events/<eventName>/
├── EVENT-META.md                  # Event metadata (kind, version, priority, roles)
├── GLOBAL/
│   ├── 00/                        # Base specification (always complete)
│   │   ├── INPUT.md
│   │   ├── OUTPUT.md
│   │   ├── WORKAREA.md
│   │   ├── WORKFLOW.md
│   │   └── <eventName>.md         # Main spec with lifecycle methods
│   ├── US/                        # Country extension (sparse — differences only)
│   │   ├── INPUT.md
│   │   └── <eventName>.md
│   └── IE/
│       └── ...
├── SBS/                           # Business unit extension (sparse)
│   └── 00/
│       └── INPUT.md
└── PAAS/                          # Business unit extension (sparse)
    └── 00/
        └── ...
```

### Hierarchy Files

Each level of the canonical path has a single-paragraph business description file:

| File | Depth | Example |
|------|-------|---------|
| `DOMAIN.md` | 1 | `docs/hr/DOMAIN.md` |
| `SERVICE.md` | 2 | `docs/hr/workerManagement/SERVICE.md` |
| `FEATURE.md` | 3 | `docs/hr/workerManagement/lifecycleManagement/FEATURE.md` |
| `FUNCTION.md` | 4 | `docs/hr/workerManagement/lifecycleManagement/workerManagement/FUNCTION.md` |

### Applicability and Inheritance

- **`GLOBAL/00/`** is the base — always complete and self-contained
- **`GLOBAL/<CC>/`** (e.g., `GLOBAL/US/`) extends the base — only lists entries that differ or are added
- **`SBS/00/`**, **`PAAS/00/`** are business unit extensions — sparse, only differences from GLOBAL
- Extension files typically have 1–5 entries; they inherit everything else from the base
- Create a directory only if at least one entry targets that business unit / country combination

### Spec File Formats

**EVENT-META.md** — Extracted from `meta/src/event/<eventName>.ts`:

```markdown
# <eventName>

## Canonical
`/domain/service/feature/function/<eventName>`

## Description
<description from EventType>

## Event Meta
- **kind** : `<value>`
- **version** : `<value>`
```

Only include fields that are explicitly set (non-empty).

**INPUT.md / OUTPUT.md / WORKAREA.md** — Field listings grouped by applicability:

```markdown
# <eventName>

## Applicability
- **Business Unit** : `GLOBAL`
- **Country** : `All Countries`

## Input
- **fieldPath** : description *(required)* *(array)* *(hidden)*
  - **vocabulary** : `Noun.Field`
  - **sampleData** : `value`
  - **required** : `true`
```

Array notation: `[0]` for single item, `[n]` for iterated, `[m]` for nested.

**WORKFLOW.md** — Event chaining and orchestration:

```markdown
## Workflow

### <Workflow Title>
- **targetEventAction** : `Chain`
- **targetEvent** : `<full canonical>`
- **currentEventStatus** : `<status>`

**Conditions:**
<human-readable condition expression>

#### Workflow Mappings
**Field Mappings:**
- `source.path` -> target `input.field`
```

Write "No workflow file exists for this event." if there are no workflows.

**`<eventName>.md`** — Main specification with lifecycle methods:

```markdown
# <eventName>

## Applicability
- **Business Unit** : `GLOBAL`
- **Country** : `All Countries`

## Specification

### initialize
<business description>

### setTitle
### validateInput
### setWorkArea
### validateEvent
### setOutput
### setSummary
### preCommit
### commit
### postCommit
```

Lifecycle method order is fixed. Use explicit variable paths (`input.<field>`, `output.<field>`, `workArea.<field>`). In `commit`, list database tables and columns with ` : ` separator.

Extension specs state "All lifecycle methods from the global (00) specification apply." and only document methods that differ.

### Spec Rules

- **Business meaning only** — never mention source files, code patterns, facades, mixins, factories, or delegates
- **Always use explicit variable paths** — `input.agreementCode`, `output.associate.referenceID`, `workArea.isRehire`
- **Explain business concepts** — say `input.agreementCode` = `FirstPartyContract` (1099 independent contractor), not "first-party contract"
- **For shared functions**, reference the function name; don't expand internal logic
- **For shared events**, reference the canonical; don't expand internal behavior
- **Never write stubs** like "See implementation for details" — read the code and describe the logic

### Generating and Verifying Specs

Use the workspace skills:

- `/e-spec-from-event` — Generate specs from implementation code
- `/e-spec-verify` — Verify spec compliance
- `/e-spec-generate-and-verify` — Generate and verify with automatic regeneration
- `/e-spec-verify-and-fix` — Verify existing specs and regenerate non-compliant ones

## Important Patterns and Conventions

### File Naming

- Controllers: `<noun>.<verb>.ctrl.tsx` (e.g., `invite.accept.ctrl.tsx`)
- Events: Directory named `<noun>.<verb>/` (e.g., `user.logout/`)
- TypeScript files use `.ts` extension, React files use `.tsx`

### Event Canonical Names

- Format: `<noun>.<verb>` (e.g., `'user.logout'`, `'invite.accept'`)
- Must match the event directory name
- Defined as static property: `UserLogoutEvent.CANONICAL`

### Country Code System

- `'00'` - Global/default implementation
- `'US'` - United States
- `'IE'` - Ireland
- Controllers and events register with specific country contexts

### Controller Lifecycle

- `onStart()` - Initial entry point, must be implemented
- `done()` - Completes the controller and returns to parent
- `create()` - Static method to instantiate a controller
- Controllers can nest sub-controllers and use `onEnd` callbacks

### Conversation Setup — End to End

Conversations are multi-layered. Here is the full stack from Lambda entry point down to individual controller files.

**1. Lambda entry point — `src/<domain>/controllers.ts`**

This file is the Lambda handler for all conversation routes in a domain. It:
- Imports controller modules grouped by country (`GlobalConversations`, `USConversations`, `IEConversations`, etc.)
- Iterates each group with `loadCountry(countryCode, modules)`, building an `allControllers` array of `{ implementation, context: { countryCode, name } }`
- Registers everything with `getAvailableControllersInstance().add(allControllers)`
- Exports `handler(request)` which calls `routeController(request)` from `@adplabs/e-engine-core` — the engine matches the inbound `name` + `countryCode` and instantiates the correct class

```ts
loadCountry('00', [GlobalConversations, GlobalLegalEntity]);
loadCountry('IE', [IEConversations]);
loadCountry('US', [USConversations]);
getAvailableControllersInstance().add(allControllers);
export async function handler(request) { return routeController(request); }
```

**2. Barrel export — `controllers/conversations/index.ts`**

Re-exports every controller in the folder (`export * from './invite.accept.ctrl'`). Country variants live in `conversations/US/index.ts`, `conversations/IE/index.ts`, each with their own barrel.

**3. Controller class — `<noun>.<verb>.ctrl.tsx`**

Each controller is a class that:
- Extends `BaseBusinessController` (→ `BusinessController` from `@adplabs/e-engine-core`)
- Has typed `Props` and `State` namespaces
- Sets `static package` to its directory path
- Implements `onStart()` as the entry point — fetches data, sends messages, delegates to sub-controllers
- Sends chat UI via `this.sendChatMessage(<PlainTextMessage actor="e" message={...} />)` (JSX)
- Ends with `this.done()` or passes control to a sub-controller via `SubController.create({ ...props, onEnd: this.callback })`

```tsx
export class InviteAcceptController extends BaseBusinessController<Props, State> {
    static package = 'core/controllers/conversations';
    async onStart() { ... return this.checkPerson(); }
    async checkPerson() { ... return SubController.create({ onEnd: this.onConfirmed }); }
    async onConfirmed(state) { ... return this.done(); }
}
```

**4. Sub-conversations**

Complex flows delegate to child controllers. `SubController.create({ ...props, onEnd: callback })` returns a `Controller` action; the engine runs the sub-controller and invokes `onEnd` when it calls `done()`. Sub-controllers follow the exact same class structure.

**5. Routing summary**

`controllers.ts` (Lambda + registry) → `index.ts` (barrel) → `.ctrl.tsx` (class) → `onStart()` → `sendChatMessage()` / `SubController.create()` → `done()`

`'00'` is the global fallback country code used when no country-specific controller is registered for the inbound request's country.

### GraphQL Queries

- Controllers access GraphQL via `this.session.api.query(query)`
- Query structure: `{ query: string, variables: object }`
- Session provides authenticated context

### Build Artifacts

- TypeScript compiles to `dist/` in each domain
- Build assets tracked in `assets/*.asset` files
- Lambda deployment packages in `deployment-packages/` (not in git)

## Dependencies

- **Framework**: `@adplabs/e-product-sdk`, `@adplabs/e-engine-core`, `@adplabs/e-event-engine`
- **AWS SDKs**: v3 SDK clients (S3, DynamoDB, Lambda, etc.)
- **React**: v16.14.0 (used for controller UI components)
- **TypeScript**: v4.6.3
- **Testing**: Jest
- **Build**: esbuild, SWC for fast compilation

## Related Repositories

This repository integrates with other ADP-e platform repositories:

- `@adplabs/e-gateway` - API Gateway
- `@adplabs/e-localize-db` - Localization database

## Git Workflow

### Branch Structure

- **Main branch**: `master` (maps to package `latest`)
- **Latest branch**: `latest` (maps to package `latest`)

### Branch Naming Conventions

**Product Releases** (`product/X.Y.Z`):
- Official product release branches
- Example: `product/25.4.0`, `product/26.0.0`, `product/27.0.0`
- Maps to package: `product/X.Y.Z`
- Can deploy to all environments (DIT, FIT, STG, PROD)

**Pilot Branches** (`pilot/[version]/PilotName`):
- Named pilot branches for testing/validation before product release
- Version can be `latest` or `X.Y.Z`
- Examples: `pilot/latest/recruiting`, `pilot/25.4.0/leftovers`
- Maps to package: `pilot/[version]/PilotName`
- **Constraint**: Can only deploy to STG environment
- Automatically deploys after successful build
- Does not trigger database migrations
- Does not update package aliases (`alias:latest` or `alias:stable`)

**Feature Branches**:
- Off master: `feature/master/<description>` → maps to `latest`
- Off product: `feature/X.Y.Z/<description>` → maps to `product/X.Y.Z`
- Off pilot: `feature/pilot/[version]/PilotName/<description>` → maps to `pilot/[version]/PilotName`

### Branch-to-Package Mapping

The `bin/echo-package.sh` script determines the package identifier from branch names:

| Branch Pattern | Package Identifier | Notes |
|----------------|-------------------|-------|
| `master`, `latest` | `latest` | Main development |
| `feature/master/*` | `latest` | Features off master |
| `pilot/latest/PilotName` | `pilot/latest/PilotName` | Named pilot on latest |
| `pilot/X.Y.Z/PilotName` | `pilot/X.Y.Z/PilotName` | Named pilot on version |
| `product/X.Y.Z` | `product/X.Y.Z` | Official release |
| `feature/pilot/*/PilotName/*` | `pilot/*/PilotName` | Features off pilot |
| `feature/X.Y.Z/*` | `product/X.Y.Z` | Features off product |

### Pilot Branch Behavior

Pilot branches have special handling in the CI/CD pipeline:
- Environment automatically defaults to STG (validation enforced)
- Full builds always run (BUILD_META flag ignored)
- Automatic deployment to STG after successful build
- DB deployment skipped (lambdas only)
- Package aliases not updated (preserves official release pointers)

## Additional Notes

- The Makefile enforces sequential builds of `root` and `shared` before parallel domain builds
- Changes to `meta/src/i18n` require manual copy with `npm run i18n:copy` (not automatic)
- Build assets use timestamp tracking via `.asset` files for incremental builds
- The repository uses Husky for git hooks (see `prepare` script)

## graphify - Knowledge Graph (MUST USE)

This project has a pre-built knowledge graph at `graphify-out/` with 45,649 nodes and 49,315 edges covering all domains, meta, and @adplabs SDK.

### MANDATORY: Query the graph BEFORE searching files

**This is a BLOCKING REQUIREMENT. Do NOT skip this step.**

When asked about architecture, how things connect, where something is, or how something works:

1. **FIRST** - Run this Bash command immediately (no Explore agent, no Glob, no Grep):
   ```bash
   $(cat graphify-out/.graphify_python) -c "
   import json, networkx as nx
   from networkx.readwrite import json_graph
   from pathlib import Path
   data = json.loads(Path('graphify-out/graph.json').read_text())
   G = json_graph.node_link_graph(data, edges='links')
   terms = [t.lower() for t in 'QUESTION_HERE'.split() if len(t) > 2]
   scored = [(sum(1 for t in terms if t in G.nodes[n].get('label','').lower()), n) for n in G.nodes()]
   scored.sort(reverse=True)
   starts = [n for _,n in scored[:3] if scored[0][0] > 0]
   visited, frontier = set(starts), set(starts)
   edges = []
   for _ in range(3):
       nxt = set()
       for n in frontier:
           for nb in G.neighbors(n):
               if nb not in visited: nxt.add(nb); edges.append((n,nb))
       visited.update(nxt); frontier = nxt
   for n in sorted(visited, key=lambda n: G.degree(n), reverse=True)[:30]:
       d=G.nodes[n]; print(f'NODE {d.get(\"label\",n)} [src={d.get(\"source_file\",\"\")}]')
   for u,v in edges[:30]:
       d=G.edges[u,v]; print(f'EDGE {G.nodes[u].get(\"label\",u)} --{d.get(\"relation\",\"\")}--> {G.nodes[v].get(\"label\",v)} [{d.get(\"confidence\",\"\")}]')
   "
   ```
   Replace QUESTION_HERE with the user's actual question.

2. **THEN** answer based on graph output. Only search raw files if the graph returned no matching nodes.

3. **NEVER use Explore agent as the first step.** The graph has 45K nodes and already knows the answer. Explore agent wastes time re-scanning 15K files.

The graph already knows:
- All event registrations, controller mappings, and cross-domain dependencies
- God nodes (core abstractions): getEventStructures, BaseInputValidator, WorkerTerminateController, etc.
- 14,894 communities with labeled clusters (Tax Jurisdiction, Payroll Engine, Company Setup, etc.)
- Cross-cutting connections between meta/, src/, and @adplabs SDK

### Query commands
```
/graphify query "how does X work?"           # BFS traversal from matching nodes
/graphify query "what connects X to Y?" --dfs  # trace a specific path
/graphify path "NodeA" "NodeB"               # shortest path between concepts
/graphify explain "SomeClass"                # full details of a node
```

### Incremental updates
After code changes: `/graphify --update --follow-symlinks`
