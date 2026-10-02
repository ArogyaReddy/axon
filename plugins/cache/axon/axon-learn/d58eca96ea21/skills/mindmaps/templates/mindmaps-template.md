---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 2
  maxWidth: 420
---

<!--
  AUTHORING RULES (from mindmap-markmap-viewer docs/demo.md):
  - Root title: 1 line, 4-8 words
  - H2 branches off root: 5-8 branches max (events + DB + Journey + Gotchas)
  - H3 groups per H2: 3-6 groups
  - Leaf labels: 1-3 words preferred, max 10 words
  - Depth: max 5 levels deep (# ## ### - - -)
  - No blank lines inside a list block
  - Backticks for code/field names
  - Bold sparingly for critical rules only
  - NO LaTeX ($...$) - renders as plain text, use backticks instead
  - One --- frontmatter block only at the very top
-->

# {domain} Events

## {event}.CREATE

### Triggers
- HR Admin opens Create form
  - Conversation controller: {event}.create.ctrl.tsx
- Optional auto-chain to .ASSIGN after create

### Inputs (Required)
- `name` TypeScript: `Name` | UI: "Name" text input
- `type_code` TypeScript: `Type_Code` (enum) | UI: "Type" dropdown
- `contextCountryCode` TypeScript: `ContextCountryCode` | 2-char e.g. "US"

### Inputs (Optional)
- `description` TypeScript: `Description` | UI: "Description" rich-text
- `dueDurationPeriod` TypeScript: `DueDurationPeriod` | ISO 8601 e.g. "P30D"
- `dueDate` TypeScript: `DueDate` | Fixed date e.g. "2025-12-31"
- `recurringIndicator` TypeScript: `RecurringIndicator` | 1=yes 0=no
- `configurationOption` TypeScript: `ConfigurationOption` | JSON for eligibility rules

### Lambda Pipeline (8 Stages)
- Stage 1: setWorkArea() - init empty scratchpad
- Stage 2: initialize() - validate legalEntity + generate UUID
- Stage 3: validateInput() - field-level checks
- Stage 4: validateEvent() - business rules
- Stage 5: preCommit() - prepare rows, pre-gen UUIDs
- Stage 6: commit() - INSERT to DSQL
- Stage 7: setOutput() - build output object
- Stage 8: setSummary() - render chat card

### DB Writes
- `data.{entity}` - INSERT v1 row
  - `id` = crypto.randomUUID() | TypeScript: `ID` | UI: Hidden
  - `clientid` = session.clientID | **ALWAYS from session - never input**
  - `_validityenddatetime` = 9999-12-31 | **9999 = ACTIVE**
  - `eventid` = this.eventID | TypeScript: `EventID` | UI: Not shown
### DSQL Verify After .CREATE
- Check entity was created
  - `SELECT id, name, versionnumber, type_code, _validityenddatetime FROM data.{entity} WHERE clientid = 'CLIENT_ID' AND _validityenddatetime >= '9999-12-31' ORDER BY _validitystartdatetime DESC LIMIT 5`
  - Expected: new row versionnumber=1, _validityenddatetime=9999-12-31
- Check attached documents/URLs
  - `SELECT COUNT(*) FROM data.{entity}url WHERE entityid = 'NEW_ID' AND _validityenddatetime >= '9999-12-31'`
  - Expected: count = number of URLs added

### GQL Mutation - .CREATE
- `mutation create{Entity}($input: {Entity}Input!) { create{Entity}(input: $input) { id name versionNumber } }`
- Variables example
  - `{ "name": "Policy Name 2025", "typeCode": "General", "contextCountryCode": "US", "dueDurationPeriod": "P30D" }`
- GQL result shape
  - `{ "data": { "create{Entity}": { "id": "uuid-here", "name": "Policy Name 2025", "versionNumber": 1 } } }`
### Output Returned to UI
- `id`: returned - use in subsequent .ASSIGN calls
- `name`: confirmed value

### Chain Factory
- Optional: auto-chain to .ASSIGN if configured

### Error Paths
- `NAME_REQUIRED` - name empty
- `INVALID_TYPE_CODE` - unknown enum value
- `COUNTRY_CODE_INVALID` - not 2-char uppercase

---

## {event}.ASSIGN

### Triggers (4 ways)
- Manual: HR Admin via Chat UI
- Auto-chain from .CREATE
- Auto-chain from worker.HIRE (onboarding)
- Auto-chain from .RESPOND (recurring cycle)

### Assignment Modes
- MANUAL: `subjectIDs[]` provided, no configOption → no EE call
- BULK: no subjectIDs, `configOption` JSON provided → EE evaluates all
- MIXED: both provided → EE filters the provided list

### Inputs (Required)
- `entityID` - what to assign
- `contextCountryCode` - 2-char

### Inputs (Optional - at least one required)
- `subjectIDs[]` - specific people to assign to
- `configurationOptionOverride` - JSON eligibility rules

### Lambda Pipeline (8 Stages)
- Stage 2: initialize() - fetch entity, determine mode, validate IDs
- Stage 4: validateEvent()
  - V-002: has subjectIDs OR configOption
  - V-003: count ≤ limit (500 SB / 5000 Enterprise)
  - V-007: all subjectIDs exist
- Stage 5: preCommit()
  - EE call if bulk/mixed
  - V-006: filter already-Pending subjects
  - Pre-generate UUIDs - ensures idempotency on retry
- Stage 6: commit() - INSERT one acknowledgement row per subject

### DB Writes
- `data.{entity}` - READ only (fetches config)
- `data.{entity}acknowledgement` - INSERT N rows
  - `subjectid` = one per subject
  - `clientid` = session.clientID | **ALWAYS from session**
  - `status_code` = 'Pending' | **ALWAYS at .assign**
  - `duedatetime` = V-005 calculated | TypeScript: `DueDateTime` | UI: due date countdown
  - `_validityenddatetime` = 9999-12-31
### DSQL Verify After .ASSIGN
- Count assigned rows
  - `SELECT COUNT(*) AS assigned_count FROM data.{entity}acknowledgement WHERE entityid = 'ENTITY_ID' AND _validityenddatetime >= '9999-12-31'`
  - Expected: N rows = number of subjects assigned
- Confirm all are Pending, none other status
  - `SELECT status_code, COUNT(*) FROM data.{entity}acknowledgement WHERE entityid = 'ENTITY_ID' AND _validityenddatetime >= '9999-12-31' GROUP BY status_code`
  - Expected: status_code=Pending COUNT=N
- Idempotency - no duplicates
  - `SELECT subjectid, COUNT(*) FROM data.{entity}acknowledgement WHERE entityid = 'ENTITY_ID' AND status_code = 'Pending' AND _validityenddatetime >= '9999-12-31' GROUP BY subjectid HAVING COUNT(*) > 1`
  - Expected: 0 rows

### GQL Mutation - .ASSIGN
- `mutation assign{Entity}($input: Assign{Entity}Input!) { assign{Entity}(input: $input) { recordsCreated assignedSubjectIDs skippedSubjectIDs dueDateTimeFormatted assignmentMode } }`
- Variables - MANUAL mode
  - `{ "entityID": "abc-123", "subjectIDs": ["sub-001", "sub-002"], "contextCountryCode": "US" }`
- Variables - BULK mode (EE)
  - `{ "entityID": "abc-123", "configurationOptionOverride": "{\"department\":\"Sales\"}", "contextCountryCode": "US" }`
- GQL result shape
  - `{ "data": { "assign{Entity}": { "recordsCreated": 2, "assignedSubjectIDs": ["sub-001","sub-002"], "skippedSubjectIDs": [], "assignmentMode": "manual" } } }`
- Error shape (V-001 - entity not found)
  - `{ "errors": [{ "message": "ENTITY_INVALID_OR_DELETED", "extensions": { "code": "VALIDATION_ERROR" } }] }`
### Output Returned to UI
- `assignedSubjectIDs[]` - got new rows
- `skippedSubjectIDs[]` - already had Pending
- `recordsCreated` - count
- `dueDateTimeFormatted` - human-readable

### Chain Factory
- Creates one .RESPOND task per assigned subject

### Validation Rules Quick Ref
- V-001 entity must exist and belong to this client
- V-002 must have targets (IDs or configOption)
- V-003 count within limit
- V-004 configOption valid JSON
- V-005 due date: duration > date > null (applied silently)
- V-006 no duplicate Pending rows (silent skip on ER_DUP_ENTRY/23505)
- V-007 all IDs exist in this client

---

## {event}.RESPOND

### Triggers
- Subject clicks "Acknowledge" or "Decline" on their task

### Inputs
- `acknowledgementID` - the specific Pending row
- `status` - Acknowledged OR Declined
- `statusReasonCode` - required if Declined
- `electronicSignatureID` - required if e-sig configured

### Lambda commit() - BI-TEMPORAL CLOSE + INSERT
- CLOSE Pending row: `_validityenddatetime` = NOW
- INSERT new row: status = Acknowledged/Declined, acknowledgementdatetime = NOW

### DSQL Verify After .RESPOND
- See full bi-temporal history for one subject
  - `SELECT status_code, acknowledgementdatetime, _validitystartdatetime, _validityenddatetime FROM data.{entity}acknowledgement WHERE subjectid = 'SUB_ID' AND entityid = 'ENTITY_ID' ORDER BY _validitystartdatetime`
  - Expected: 2 rows - Row1 status=Pending _validityenddatetime=real-date (CLOSED); Row2 status=Acknowledged _validityenddatetime=9999 (ACTIVE)
- Status distribution after respond
  - `SELECT status_code, COUNT(*) FROM data.{entity}acknowledgement WHERE entityid = 'ENTITY_ID' AND _validityenddatetime >= '9999-12-31' GROUP BY status_code`
  - Example: Pending=45, Acknowledged=120, Declined=3

### GQL Mutation - .RESPOND
- `mutation respond{Entity}($input: Respond{Entity}Input!) { respond{Entity}(input: $input) { status acknowledgedAt nextCycleDate } }`
- Variables - Acknowledge
  - `{ "acknowledgementID": "uuid-row", "status": "Acknowledged", "contextCountryCode": "US" }`
- Variables - Decline
  - `{ "acknowledgementID": "uuid-row", "status": "Declined", "statusReasonCode": "Declined_IncompleteInfo", "contextCountryCode": "US" }`
- GQL result shape
  - `{ "data": { "respond{Entity}": { "status": "Acknowledged", "acknowledgedAt": "2025-07-05T14:32:00Z", "nextCycleDate": null } } }`

### Output
- `status`, `acknowledgedAt`, `nextCycleDate` if recurring

---

## {event}.UPDATE

### Lambda commit() - BI-TEMPORAL VERSION UPDATE
- CLOSE v1: UPDATE `_validityenddatetime` = NOW (same ID)
- INSERT v2: versionnumber+1, updated fields, `_validityenddatetime` = 9999
- SAME primary ID across all versions - history preserved

### DSQL Verify After .UPDATE
- See version history
  - `SELECT versionnumber, name, _validitystartdatetime, _validityenddatetime FROM data.{entity} WHERE id = 'abc-123' ORDER BY _validitystartdatetime`
  - Expected: Row1 v1 _validityenddatetime=real-date (CLOSED); Row2 v2 _validityenddatetime=9999 (ACTIVE)
- Confirm acknowledgements unchanged
  - `SELECT COUNT(*) FROM data.{entity}acknowledgement WHERE entityid = 'abc-123' AND _validityenddatetime >= '9999-12-31'`
  - Should be same count as before update

### GQL Mutation - .UPDATE
- `mutation update{Entity}($input: Update{Entity}Input!) { update{Entity}(input: $input) { id name newVersionNumber updatedAt } }`
- Variables example
  - `{ "entityID": "abc-123", "name": "Updated Name 2026", "contextCountryCode": "US" }`
- GQL result shape
  - `{ "data": { "update{Entity}": { "id": "abc-123", "name": "Updated Name 2026", "newVersionNumber": 2 } } }`

### Effect on existing tasks
- Acknowledgement rows: NOT touched
- UI: shows new name immediately via JOIN

---

## {event}.DELETE

### Lambda commit() - CLOSE ONLY
- CLOSE entity row: `_validityenddatetime` = NOW
- CLOSE all link rows (docs, URLs)
- Acknowledgement rows: **NOT TOUCHED - audit preservation**

### DSQL Verify After .DELETE
- Confirm entity end-dated
  - `SELECT name, _validityenddatetime FROM data.{entity} WHERE id = 'abc-123'`
  - Expected: _validityenddatetime = real date (NOT 9999)
- Confirm no active row
  - `SELECT COUNT(*) FROM data.{entity} WHERE id = 'abc-123' AND _validityenddatetime >= '9999-12-31'`
  - Expected: 0
- Confirm acknowledgements still exist (audit preserved)
  - `SELECT COUNT(*) FROM data.{entity}acknowledgement WHERE entityid = 'abc-123'`
  - Expected: rows still present - required for compliance audit

### GQL Mutation - .DELETE
- `mutation delete{Entity}($input: Delete{Entity}Input!) { delete{Entity}(input: $input) { id name deletedAt status } }`
- Variables example
  - `{ "entityID": "abc-123", "contextCountryCode": "US" }`
- GQL result shape
  - `{ "data": { "delete{Entity}": { "id": "abc-123", "name": "Policy Name", "status": "Deleted" } } }`
- Error - wrong client
  - `{ "errors": [{ "message": "ENTITY_NOT_FOUND_FOR_CLIENT", "extensions": { "code": "VALIDATION_ERROR" } }] }`

---

## {Domain} Lifecycle - Full Picture

### State Machine
- CREATED → entity active, no tasks yet
- ASSIGNED → N Pending task rows created
- RESPONDED → Pending closed, Acknowledged/Declined inserted
- UPDATED → entity versioned (same ID), tasks unchanged
- DELETED → entity closed, tasks preserved

### Tables - Who Writes What
- `data.{entity}` - WRITE: .create .update .delete | READ: .assign .respond
- `data.{entity}acknowledgement` - WRITE: .assign .respond | NOT TOUCHED: .create .update .delete
- `data.{entity}attachment` - WRITE: .create .update .delete | READ: .assign .respond

### Security Rules (All Events)
- `clientid` ALWAYS from `session.clientID` - never from input
- All GQL queries filter by clientid automatically
- Subjects validated to belong to this client
- Bi-temporal: nothing is ever truly deleted

### DSQL Master Queries - Full Domain State
- Complete overview (all tables joined)
  - `SELECT e.name, e.versionnumber, COUNT(DISTINCT d.docid) AS docs, COUNT(DISTINCT u.urlid) AS urls, COUNT(DISTINCT a.subjectid) FILTER (WHERE a._validityenddatetime >= '9999-12-31') AS assigned, COUNT(DISTINCT a.subjectid) FILTER (WHERE a.status_code='Pending' AND a._validityenddatetime >= '9999-12-31') AS pending, COUNT(DISTINCT a.subjectid) FILTER (WHERE a.status_code='Acknowledged' AND a._validityenddatetime >= '9999-12-31') AS acknowledged FROM data.{entity} e LEFT JOIN data.{entity}document d ON e.id = d.entityid AND d._validityenddatetime >= '9999-12-31' LEFT JOIN data.{entity}url u ON e.id = u.entityid AND u._validityenddatetime >= '9999-12-31' LEFT JOIN data.{entity}acknowledgement a ON e.id = a.entityid WHERE e.id = 'abc-123' AND e._validityenddatetime >= '9999-12-31' GROUP BY e.name, e.versionnumber`
- Find overdue subjects
  - `SELECT subjectid, duedatetime, EXTRACT(DAY FROM (NOW()-duedatetime)) AS days_overdue FROM data.{entity}acknowledgement WHERE entityid = 'abc-123' AND status_code = 'Pending' AND duedatetime IS NOT NULL AND duedatetime < NOW() AND _validityenddatetime >= '9999-12-31' ORDER BY duedatetime`
- Find all active entities for client
  - `SELECT id, name, versionnumber, type_code FROM data.{entity} WHERE clientid = 'CLIENT_ID' AND _validityenddatetime >= '9999-12-31' ORDER BY name`

### GQL Queries - Read Operations
- Fetch entity detail (before assign)
  - `query GetEntity { {entityQuery}(id: "abc-123") { id name versionNumber dueDurationPeriod recurringIndicator configurationOption documents { documentID } urls { url urlName } } }`
- Fetch acknowledgement status
  - `query GetStatus { {ackQuery}(entityID: "abc-123") { subjectID status acknowledgedAt dueDateTime } }`
- List all active entities
  - `query ListEntities($clientID: String!) { {listQuery}(clientID: $clientID, activeOnly: true) { id name typeCode recurringIndicator } }`

---

## 🗄️ Database Schema Reference

### Column Name Rule - CRITICAL
- TypeScript code: **PascalCase** e.g. `OrganizationPolicyID`
- Aurora DSQL stores: **lowercase** e.g. `organizationpolicyid`
- PostgreSQL folds all identifiers to lowercase
- In DSQL SQL queries: always use lowercase
- In TypeScript: always use PascalCase (from databaseSchemas/)
- The adapter maps these transparently

### data.{entity} - {N} rows ({env})
- Purpose: [one-line description]
#### Identity
- `id` UUID ← PK
  - TypeScript: `{Entity}ID`
  - UI: Hidden - returned to caller, used in .assign
  - Source: `crypto.randomUUID()` at .create preCommit()
- `clientid` UUID ← SECURITY
  - TypeScript: `ClientID`
  - UI: Never shown
  - Source: `session.clientID` ALWAYS - never from input
- `eventid` UUID
  - TypeScript: `EventID`
  - UI: Not shown - audit/CloudWatch trace only
#### Content
- `name` VARCHAR ← REQUIRED
  - TypeScript: `Name`
  - UI: "[Name Label]" text input - shown everywhere
  - Source: user input, validated non-empty
- `type_code` VARCHAR
  - TypeScript: `Type_Code` (enum)
  - UI: "[Type Label]" dropdown
  - Valid values: [list enum values]
#### Bi-Temporal
- `_validityenddatetime` TIMESTAMP
  - TypeScript: `_ValidityEndDateTime`
  - 9999-12-31 = ACTIVE | real date = CLOSED
  - Active filter: `WHERE _validityenddatetime >= '9999-12-31'`
- `_validitystartdatetime` TIMESTAMP
  - TypeScript: `_ValidityStartDateTime`
  - Set: `session.dataDb.transactionDateTime` at INSERT

### data.{entity}acknowledgement - {N} rows ({env})
- Purpose: Each subject's task card - one row per person per cycle
#### Keys
- `acknowledgementid` UUID ← PK
  - TypeScript: `{Entity}AcknowledgementID`
  - Source: Pre-generated `crypto.randomUUID()` in preCommit()
  - Why pre-generate: ensures idempotency on Lambda retry
- `entityid` UUID ← FK
  - TypeScript: `{Entity}ID`
  - UI: Shown as entity name (via JOIN to entity table)
- `subjectid` UUID ← FK
  - TypeScript: `SubjectID`
  - UI: Subjects see only their own tasks
#### Status
- `status_code` VARCHAR
  - TypeScript: `Status_Code` (enum)
  - UI: "Pending" badge | "Acknowledged ✓" | "Declined ✗"
  - .assign writes: `Pending` ALWAYS
  - .respond writes: `Acknowledged` or `Declined`
- `statusreason_code` VARCHAR NULL
  - TypeScript: `StatusReason_Code`
  - .assign writes: NULL
  - .respond writes: reason code if Declined
#### Timestamps
- `acknowledgementdatetime` TIMESTAMP
  - TypeScript: `AcknowledgementDateTime`
  - .assign writes: NOW() PLACEHOLDER
  - .respond writes: actual acknowledge time
  - UI: Shows .respond time (not .assign placeholder)
- `duedatetime` TIMESTAMP NULL
  - TypeScript: `DueDateTime`
  - UI: "Due: [date]" countdown on task card
  - V-005: dueDurationPeriod → dueDate → null
#### Bi-Temporal
- `_validityenddatetime` = 9999 active | real date = closed by .respond
- Legacy rows may show `1000-01-01` timestamps (seeded data - normal)

---

## 🔗 Data Journey: UI → Code → DB → UI

### How Column Names Change Across Layers
- UI label → GQL mutation field → TypeScript name → DSQL column
- "Name" field → `name` (GQL) → `Name` (TypeScript) → `name` (DSQL)

### Journey 1: Subject Creates Entity
- Subject fills form → GQL fires → Lambda runs
- Lambda commit() writes:
  - `id` = crypto.randomUUID() ← NEW
  - `clientid` = session.clientID ← NOT from form!
  - `_validityenddatetime` = 9999-12-31 ← active
- Response: `id` returned → used in .assign

### Journey 2: Entity Assigned to Subjects
- Assigner selects entity + subjects → GQL fires
- Lambda loop: INSERT one row per subject
  - `status_code` = 'Pending' ← hardcoded
  - `duedatetime` = V-005 calc from entity config
  - `clientid` = session.clientID ← NEVER from input
- Subject sees: new task card Status = "Pending"

### Journey 3: Subject Responds to Task
- Subject clicks Acknowledge → GQL fires
- Lambda bi-temporal:
  - CLOSE Pending: `_validityenddatetime` = NOW
  - INSERT Acknowledged: `acknowledgementdatetime` = NOW (real time!)
- Subject sees: "Acknowledged ✓" on task card

---

## ⚠️ Common Gotchas: Code vs DB vs UI

### Gotcha 1: Column Case
- WRONG: SQL using `OrganizationPolicyID` (PascalCase in DSQL)
- RIGHT: SQL using `organizationpolicyid` (lowercase)
- Error: column not found or no results returned

### Gotcha 2: clientid Source
- WRONG: using `input.clientID` from user-provided data
- RIGHT: ALWAYS `session.clientID` in Lambda code
- Error: cross-tenant data exposure if wrong

### Gotcha 3: Acknowledgement Timestamp
- WRONG: assuming acknowledgementdatetime from .assign is the real time
- RIGHT: .assign writes placeholder NOW(); .respond overwrites with real time
- Error: wrong "acknowledged on" date shown in UI

### Gotcha 4: Active Record Filter
- WRONG: `SELECT * FROM data.entity WHERE id = ?`
- RIGHT: `SELECT * FROM data.entity WHERE id = ? AND _validityenddatetime >= '9999-12-31'`
- Error: returns all versions including old closed ones

### Gotcha 5: V-005 DueDateTime Priority
- WRONG: assuming dueDate is used when both dueDate and dueDurationPeriod are set
- RIGHT: dueDurationPeriod WINS over dueDate if both present
- Error: wrong deadline shown

### Gotcha 6: Pre-Generated UUIDs
- WRONG: generating UUID inside commit() loop
- RIGHT: pre-generate all UUIDs in preCommit() before any INSERTs
- Error: Lambda retry creates duplicate rows if UUID generated fresh each time
