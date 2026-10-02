## STEP 2 - BUILD MARKMAP OUTLINE

Write a `.md` file following this exact structure. Use the reference template below.

### Frontmatter (always include)

Note: `axon-mindmap` will fill defaults if missing, but always include explicitly:

```markdown
---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: {depth}      ← use --depth value (default: 2; use -1 to expand all)
  maxWidth: 420
---
```

### Root Title

```markdown
# {domain} Events
```

### One H2 per event (or per concept if not event-based)

For each event:
```
## {event_canonical}

### Triggers
- [how it starts]

### Inputs (Required)
- `field` TypeScript: `FieldName` | UI: "Label text" | Validation: V-NNN

### Inputs (Optional)
- `field` TypeScript: `FieldName` | UI: "Label" | Default: [value]

### Lambda Pipeline ({N} Stages)
- Stage N: stageName()
  - [what this stage does]

### Validation Rules
- V-NNN
  - [what it checks]
  - Error: `ERROR_KEY`

### DB Writes
- `table.name`
  - `dsql_column` = [value source] | TypeScript: `PascalCase` | UI: "[label]"
  - `clientid` = session.clientID ← **ALWAYS from session** (never input)

### DSQL Verify After .{EVENT}
- [description of what to check]
  - `SELECT ... FROM data.{table} WHERE ... AND _validityenddatetime >= '9999-12-31'`
  - Expected: [what correct results look like]
- [second check e.g. idempotency, status distribution]
  - `SELECT ... GROUP BY status_code`

### GQL Mutation - .{EVENT}
- `mutation {mutationName}($input: {InputType}!) { {mutationName}(input: $input) { {fields} } }`
- Variables example
  - `{ "fieldName": "value", "contextCountryCode": "US" }`
- GQL result shape
  - `{ "data": { "{mutationName}": { "id": "uuid", "status": "value" } } }`
- Error shape (if relevant)
  - `{ "errors": [{ "message": "ERROR_KEY", "extensions": { "code": "VALIDATION_ERROR" } }] }`

### Output Returned to UI
- `fieldName`: [UI shows this as "label text"]

### Chain Factory
- [what fires next, conditions]

### Error Paths
- [error description]
```

### Lifecycle Summary Section (always add at end)

```
## Policy Lifecycle - Full Picture

### State Machine
- [each state and what transitions it]

### Tables - Who Writes What
- [per-table, per-event matrix]

### Security Rules (All Events)
- [clientid rule, cross-tenant protection, etc.]

### DSQL Master Queries - Full Domain State
- Complete overview (all tables joined)
  - `SELECT ... FROM data.{entity} p LEFT JOIN data.{entity}acknowledgement a ON ... GROUP BY p.id`
  - Expected shape: name, version, doc_count, url_count, assigned_count, pending_count, acked_count
- Find overdue subjects
  - `SELECT subjectid, duedatetime, EXTRACT(DAY FROM (NOW()-duedatetime)) AS days_overdue FROM ... WHERE duedatetime < NOW() AND _validityenddatetime >= '9999-12-31'`
- Find all active entities for client
  - `SELECT id, name, versionnumber, type_code FROM data.{entity} WHERE clientid = 'CLIENT_ID' AND _validityenddatetime >= '9999-12-31' ORDER BY name`

### GQL Queries - Read Operations
- Fetch entity detail
  - `query GetEntity { {entityQuery}(id: "abc-123") { id name versionNumber documents { documentID } urls { url urlName } } }`
- Fetch acknowledgement status
  - `query GetStatus { {ackQuery}(entityID: "abc-123") { subjectID status acknowledgedAt dueDateTime } }`
- List all active entities
  - `query ListEntities($clientID: String!) { {listQuery}(clientID: $clientID, activeOnly: true) { id name type } }`
```

### DB Schema Section (add when --include-db is true, default: true)

```
## 🗄️ Database Schema Reference

### Column Name Rule - CRITICAL
- TypeScript code writes: PascalCase e.g. `OrganizationPolicyID`
- Aurora DSQL stores/returns: lowercase e.g. `organizationpolicyid`
- In DSQL SQL: always lowercase | In TypeScript: always PascalCase

### {table_name} - {N} rows ({environment})
- Purpose: [one-line description]
#### {Group Name}
- `dsql_column` TYPE
  - TypeScript: `PascalCaseName`
  - UI: "[label shown to user]" or "Not shown"
  - Source: [how it gets its value]
  - [Special note if any, e.g. security, V-005, placeholder]
```

For every table write all columns grouped by: Identity | Content | Due Date | Status | Timestamps | Bi-Temporal  
For every security-sensitive column: `clientid ← ALWAYS from session (never input)`  
For every bi-temporal column: note the 9999-12-31 = active pattern

### Data Journey Section (add when --include-journey is true, default: true)

```
## 🔗 Data Journey: UI → Code → DB → UI

### How Column Names Change Across Layers
- UI label → GQL field → TypeScript name → DSQL column
- "Policy Name" → policyName → PolicyName → policyname

### Journey N: [actor does action]
- [actor] [action in UI]
  - [UI field] → GQL: `fieldName` → TypeScript: `input.FieldName`
  - [another field] → [mapping]
- [Lambda stage] runs
  - [what happens]
- Lambda commit() writes to DSQL
  - `dsql_column` = [value] ← [source note]
  - `clientid` = session.clientID ← NOT from form!
- Response back to UI
  - `fieldName` returned ← [how UI uses it]
```

Include at minimum: Create journey, Assign journey, Respond journey, Compliance view journey

### Gotchas Section (add when --include-gotchas is true, default: true)

```
## ⚠️ Common Gotchas: Code vs DB vs UI

### Gotcha N: [short title]
- WRONG: [the incorrect assumption]
- RIGHT: [the correct behavior]
- Error symptom: [what breaks when wrong]
```

Always include: column case (PascalCase vs lowercase), clientid source (session not input),  
bi-temporal active filter (`_validityenddatetime >= '9999-12-31'`), timestamp placeholders vs real values

### Rules for good markmap outlines

1. **Depth limit**: max 5 levels deep (# ## ### - - -)
2. **Leaf nodes**: 1 short sentence or key:value pair - no paragraphs
3. **No blank lines** inside a list block
4. **Backtick code** for field names, error keys, table names
5. **Bold** for critical rules: `- **ALWAYS from session** (never input)`
6. **Events filter**: if `--events` provided, only include those events
7. **colorFreezeLevel: 2** → each H2 section gets its own color branch

---

