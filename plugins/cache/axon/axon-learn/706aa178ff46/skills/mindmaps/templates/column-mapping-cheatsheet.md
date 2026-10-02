# mindmaps - Column Mapping Cheat Sheet

## The 3-Layer Rule

Every column in the DB should be documented across 3 layers:

```
UI Label  →  TypeScript Name  →  DSQL Column
"Policy Name"  →  PolicyName  →  policyname
```

## Column Case Rule (CRITICAL)

| Layer | Case | Example |
|-------|------|---------|
| TypeScript code | **PascalCase** | `OrganizationPolicyID` |
| Aurora DSQL/PostgreSQL | **lowercase** | `organizationpolicyid` |
| UI labels | **Human words** | "Policy Name" |

## 3-Layer Column Block Format

```markdown
- `dsql_column_name` TYPE [NULL]
  - TypeScript: `PascalCaseName`
  - UI: "Human Label" shown to user  (or "Not shown" / "Hidden" / "Audit only")
  - Source: [how value is set]
  - [Special rule if any]
```

### Examples

```markdown
- `organizationpolicyid` UUID ← PK
  - TypeScript: `OrganizationPolicyID`
  - UI: Hidden - returned after .create, used in .assign dropdown
  - Source: `crypto.randomUUID()` at .create preCommit()

- `clientid` UUID ← SECURITY
  - TypeScript: `ClientID`
  - UI: Never shown
  - Source: `session.clientID` ALWAYS - never from input

- `policyacknowledgementstatus_code` VARCHAR
  - TypeScript: `PolicyAcknowledgementStatus_Code` (enum)
  - UI: "Pending" badge | "Acknowledged ✓" | "Declined ✗"
  - .assign writes: `Pending` ALWAYS
  - .respond writes: `Acknowledged` or `Declined`

- `_validityenddatetime` TIMESTAMP
  - TypeScript: `_ValidityEndDateTime`
  - 9999-12-31 = ACTIVE row | real date = CLOSED
  - Active filter: `WHERE _validityenddatetime >= '9999-12-31'`
  - UI: Not shown (internal bi-temporal field)

- `duedatetime` TIMESTAMP NULL
  - TypeScript: `DueDateTime`
  - UI: "Due: July 10, 2025" countdown on task card
  - Set: V-005 calculation at .assign time
  - V-005 priority: dueDurationPeriod → dueDate → null
```

---

## Data Journey Format

```markdown
### Journey N: [Actor] does [Action]
- [Actor] [action in UI]
  - "[UI field]" → GQL: `fieldName` → TypeScript: `input.FieldName`
  - "[UI field 2]" → GQL: `fieldName2` → DSQL: `fieldname2`
- Lambda commit() writes to DSQL
  - `dsql_column` = [value] ← [source note]
  - `clientid` = session.clientID ← NOT from form!
  - `_validityenddatetime` = 9999-12-31 ← active
- Response to UI
  - `returnedField` → UI shows "[what the user sees]"
```

---

## Bi-Temporal Patterns

### Active record query
```sql
WHERE _validityenddatetime >= '9999-12-31'
```

### Close + Insert (UPDATE / RESPOND events)
```
1. UPDATE old row: _validityenddatetime = NOW()
2. INSERT new row: _validityenddatetime = 9999-12-31
   → Same primary ID, new version
```

### Why 9999-12-31?
- Code sets: `new Date('9999-12-31T00:00:00.000Z')`
- DSQL stores: `9999-12-31 00:00:00.000000`
- Comparison: `>= '9999-12-31'` catches both active and any edge cases

---

## Gotchas Quick Reference

| # | Gotcha | Wrong | Right |
|---|--------|-------|-------|
| 1 | Column case | `OrganizationPolicyID` in SQL | `organizationpolicyid` |
| 2 | clientid | from input/form | `session.clientID` always |
| 3 | Ack timestamp | .assign time = acknowledge time | .assign = placeholder, .respond = real time |
| 4 | Active filter | no `_validityenddatetime` filter | `AND _validityenddatetime >= '9999-12-31'` |
| 5 | Due date priority | dueDate wins | dueDurationPeriod wins over dueDate |
| 6 | UUID generation | generate in commit() loop | pre-generate in preCommit() |

---

## Markmap Frontmatter

```yaml
---
markmap:
  colorFreezeLevel: 2       # each H2 gets unique color
  initialExpandLevel: 2     # start at: root + H2 + H3 visible
  maxWidth: 420             # wrap long leaf text
---
```

## Rendering

```python
import sys
sys.path.insert(0, '/path/to/mindmap-markmap-viewer/scripts')
from render_markmap import write_mindmap

src = open('output.md').read()
write_mindmap(src, 'output.html', height=1000, toolbar=True, inline=True)
```

Output: self-contained offline HTML ~680-700k
- markmap-lib + D3 + toolbar all inlined (no CDN needed)
- Works in any browser, offline
- Toolbar: zoom / expand-all / collapse-all / export-SVG
