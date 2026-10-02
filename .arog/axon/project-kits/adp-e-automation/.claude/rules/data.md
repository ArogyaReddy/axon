---
paths: ["utils/**", "test-inputs/queries.ts", "metagen/**", "**/*.sql", "**/*.graphql"]
---

# Data investigation (read-only)

- Read-only: SELECT and GraphQL queries only. No insert, update, delete, DDL or mutation against a shared environment
  unless the user says yes to the exact statement and environment.
- Scope every query by ClientID (from the ticket or the test data); never query across clients.
- Bi-temporal tables: current rows only, `TransactionEndDateTime > now()`; add effective dates when the question is
  about a past state.
- Gate first: when the question is vague (which client, environment, period), ask before running anything.
- Read only the tables the question needs: list candidate tables, then read only their definitions.
- On a query error, read it, correct the query once and retry; a second failure goes back to the user with both errors.
- Report the exact query, the environment, the row count, and what the result does and does not prove. Summarize
  personal data; never paste it into documents or chat.
- Here: `gqlHelper` `customSql` (needs the SSH tunnel and AWS credentials); test cases live in `QA.TestCase`.
