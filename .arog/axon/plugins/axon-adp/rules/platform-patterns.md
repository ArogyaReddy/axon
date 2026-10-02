# ADP-e platform patterns (axon-adp)

Used by `understand`, `tdd` and `reviewer` when working in adp-e-product. Concrete ids and endpoints come from
`~/.axon/local.json` (never from this file).

Reference patterns, snippets and conventions for analysing and changing adp-e-product code.

---

## 1. ADP-e Event Lifecycle Order

**Mandatory order - never reordered or partially skipped:**

```typescript
initialize()
  -> validateInput() // x n (can have multiple validation steps)
  -> validateEvent()
  -> setWorkArea()
  -> setOutput()
  -> setTitle()
  -> setSummary()
  -> preCommit()
  -> commit()
```

**Source:** Verified convention from worker.hire (GOLDEN event handler).

---

## 2. i18n Key Pattern

Every `translate()` call must have a matching key in the domain's i18n file.

**Location pattern:**
```
src/{domain}/controllers/conversations/{noun.verb}.ctrl.tsx  → uses translate(key)
i18n/controllers/{noun.verb}/messages-en.json                → defines key
i18n/controllers/{noun.verb}/messages-es.json                → Spanish translation
```

**Event i18n pattern:**
```
src/{domain}/events/{noun.verb}/{noun.verb}.tsx
i18n/event/{noun.verb}/messages-en.json
i18n/event/{noun.verb}/messages-es.json
```

**Missing key behavior:** A missing key does **not throw** - it silently renders the raw key string (e.g., `PROMPT/DUE_TIME`) directly in production UI.

**Verification:** Always check BOTH `-en.json` and `-es.json` files when updating i18n keys.

---

## 3. Security-Sourced Fields

These three fields must **NEVER** be read from user-supplied input, request body, or client-controlled state:

| Field | Correct Source | Reason |
|-------|----------------|--------|
| `ClientID` | `session.eventContext.clientID` | User-controlled ClientID = privilege escalation |
| `EventID` | `this.eventID` | User-controlled EventID = event hijacking |
| `VersionNumber` | Hardcoded `1` on create | User-controlled version = data corruption |

**Source:** IFX-004 (real incident - privilege escalation via manipulated ClientID).

---

## 4. UUID Generation - setOutput() Only

Generate UUIDs (`uuid.v4()`) **only inside `setOutput()`** - one per primary entity and one per child entity (docs, URLs, etc).

**Never generate in:**
- `validateInput()` - can run multiple times per request
- `commit()` - can run multiple times per retry

**Why:** Inconsistent IDs across retries or validation re-runs.

**Pattern:**
```typescript
setOutput(): Promise<void> {
  const organizationPolicyID = uuid.v4();
  const documentID = uuid.v4();
  // ...
}
```

---

## 5. Bi-Temporal DB Pattern

Every table insert must set:

```typescript
_TransactionStartDateTime = session.dataDb.transactionDateTime
_TransactionEndDateTime   = null   // set only when row is superseded
_ValidityStartDateTime    = session.dataDb.transactionDateTime  // same as _TransactionStartDateTime on create
_ValidityEndDateTime      = null   // set only when row expires
```

**Source:** ARCH-005 (bi-temporal audit pattern - mandated for all e Platform tables).

**Verification:** Check all `INSERT INTO` statements in `commit()` method.

---

## 6. GraphQL Query vs Mutation Endpoints

**Two different endpoints:**

| Type | Endpoint |
|------|----------|
| Query (GET/POST) | `https://internal-us-east-1.{env}.adpeai.com/graphql/v2/query` |
| Mutation (POST) | `https://internal-us-east-1.{env}.adpeai.com/wsapi/v1/graphql/query` |

**Source:** `~/.axon/local.json` lines 93-100.

**Testing:**
- GraphiQL UI for queries: `{gql_graphiql_query_url}`
- GraphiQL UI for mutations: `{gql_graphiql_mutation_url}`

**Auth:** Bearer token from `~/.e-ssl/token` or `ADP_E_FIT_BEARER_TOKEN` env var.

---

## 7. CloudWatch Log Pattern

**Lambda naming convention:**
```
{ENV}-adp-e-event-{domain}
```

Examples:
- `FIT-adp-e-event-hr`
- `FIT-adp-e-event-payroll`

**Log group:**
```
/aws/lambda/{ENV}-adp-e-event-{domain}
```

**Common log patterns to search:**
```bash
# Error logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/FIT-adp-e-event-hr \
  --filter-pattern "ERROR" \
  --profile FIT

# Specific event canonical
aws logs filter-log-events \
  --log-group-name /aws/lambda/FIT-adp-e-event-hr \
  --filter-pattern "organizationPolicy.create" \
  --profile FIT
```

**Source:** `~/.axon/local.json` lines 121-136.

---

## 8. Local Test Execution (VERIFIED 2026-07-13)

**Scoped test - correct way:**
```bash
TEST_BUSINESS_DOMAIN={domain} npx jest {path/to/file.spec.ts} --no-coverage
```

**Why scoped only:**
- Unscoped `npm test` (plain `jest`, no domain filter) iterates the entire 15-domain monorepo
- Genuinely slow - not suitable for quick verification
- Scoped runs are fast and show real PASS/FAIL output

**Source:** `mandatory.md` rule 12 (verified empirically 2026-07-13).

**Use case:** Verify a fix locally before claiming DONE_VERIFIED.

---

## 9. Import Path Depth in Tests

Test files at `tests/{domain}/events/{noun.verb}/*.spec.ts` are **4 directories deep** from workspace root.

**Correct import:**
```typescript
import { EventTreeImpl } from '../../../../src/shared/EventTreeImpl';
```

**Incorrect (fails in Jenkins):**
```typescript
import { EventTreeImpl } from '../../../src/shared/EventTreeImpl';
```

**Why:** Jenkins runs from workspace root; incorrect depth resolves to non-existent `tests/src/` path.

**Source:** `mandatory.md` rule 11 (Jenkins failure pattern).

---

## 10. DSQL / Aurora Connection

**FIT cluster:**
```
{dsql_cluster_fit} = <from ~/.axon/local.json: adp.dsql_cluster_fit>
```

**STG/DIT:** Not available - DSQL not provisioned (ETIMEDOUT expected).

**Auth:** AWS STS token via `aws sts` + `dsql token-auth` using `{aws_profile_fit}`.

**Testing:** Use `db-connect` skill or direct connection from adp-e-product via `npm run dev:remote`.

**Source:** `~/.axon/local.json` lines 73-83.

---

## 11. i18n Spanish Translation Verification

When updating English i18n keys, **ALWAYS** update Spanish keys in the same PR.

**Pattern:**
```
i18n/event/{noun.verb}/messages-en.json   → English
i18n/event/{noun.verb}/messages-es.json   → Spanish
```

**Why:** Leaving Spanish unchanged causes Spanish users to see old strings.

**Verification checklist:**
- [ ] English key updated
- [ ] Spanish key updated with correct translation
- [ ] Both files committed in same PR

---

## 12. Shared/ Imports - ROOT package.json Only

**Rule:** Never add an import in `src/shared/` without confirming the package is listed in the **ROOT `package.json`** (not just a domain's `package.json`).

**Why:** A package only in a domain's `devDependencies` breaks Jenkins for every domain that depends on `shared/`, not just the one you're working in.

**Verification:** The `check-shared-imports` checker (run by `axon-verify` in adp-e-product) enforces this.

**Source:** `mandatory.md` rule 1 (IFX-001 - real incident).

---

## 13. Meta Build Freshness

**Rule:** Never push a change touching `meta/src/` without rebuilding `meta/build/` first.

**Command:**
```bash
make meta
npm run load-meta -- FIT
```

**Why:** Stale `meta/build/` causes a silent `C_AUTH_ERROR` in STG with no compile-time signal.

**Verification:** The `check-meta-fresh` checker (run by `axon-verify` in adp-e-product) and the `post-edit-check` reminder enforce this.

**Source:** `mandatory.md` rule 2 (IFX-002 - real incident).

---

## 14. Cognito Authentication (E2E Testing)

**User pool:** `{cognito_user_pool_id}` = `<from ~/.axon/local.json: adp.cognito_user_pool_id>`

**Client IDs:**
- Backend service calls: `{cognito_app_client_id}` = `<from ~/.axon/local.json: adp.cognito_gateway_client_id>`
- Gateway-accepted tokens: `{cognito_gateway_client_id}` = `<from ~/.axon/local.json: adp.cognito_gateway_client_id>`

**Why two client IDs:** SSM `adp-e-idp-user-pool-ids-us-east-1` only maps eWebFE/eGqlFE/eMobileFE, NOT the `e` client. Use `cognito_gateway_client_id` with `AdminInitiateAuth` when testing `/user/v1` or any `securedPathRoute(rollFrontEnd:true)`.

**Source:** `~/.axon/local.json` lines 145-156.

---

## 15. Bug-Fix Protocol - 5 Mandatory Steps

| Step | Action | Gate |
|------|--------|------|
| 1 | Reproduce - fresh run, not from old logs | Show actual error output |
| 2 | Write failing test (RED) | Show FAIL output |
| 3 | Fix - minimum change | Code diff |
| 4 | Test passes (GREEN) | Show PASS output |
| 5 | Confirm end-to-end | Show working result |

**Why:** Using an old log file as "reproduction" instead of a fresh run does not satisfy Step 1.

**Source:** `mandatory.md` rule 9 (real FAIL: session 2026-05-28, scored 20/50).

---

## 16. GraphQL Schema Location

GraphQL schema definitions are located in:
```
src/{domain}/graphql/schema/
```

**Pattern:**
- Query definitions: `{noun}.query.graphql`
- Mutation definitions: `{noun}.mutation.graphql`
- Type definitions: `{noun}.type.graphql`

**Resolvers:** Located in `src/{domain}/graphql/resolvers/`

**Verification:** When analysing GraphQL-related issues, always check:
1. Schema definition (`.graphql` file)
2. Resolver implementation (`.ts` file)
3. Event handler integration (if mutation triggers an event)

---

## 17. Logging Patterns

**Shared logger import:**
```typescript
import { log } from '../../shared/logger';
```

**Common patterns:**
```typescript
log.info({ message: 'Description', data: { key: value } });
log.error({ message: 'Error description', data: { errorMessage: e.message }, stack: e.stack });
log.warn({ message: 'Warning description' });
```

**Why structured:** CloudWatch Insights queries rely on JSON-structured logs.

**Verification:** When adding logs, always use structured format with `message` and `data` fields.

---

## Gold Standard Reference

**Best example plan document:** `~/.axon/docs/code-reviews/demo-review-notes-2026-07-14.md`

This doc demonstrates:
- Clear root cause analysis
- Exact file/line/key locations
- Multiple fix options with recommendations
- BEFORE/AFTER test protocols
- Impact analysis
- Cross-language considerations (English + Spanish i18n)

**Use this as the model for plan docs written by `understand`.** (The original lives on the work Mac; see ISS-0019.)
