---
paths: ["src/**/events/**"]
---

# Event handlers (adp-e-product)

- Lifecycle methods in this order, never reordered or partially skipped: `initialize` > `validateInput` (one or
  more) > `validateEvent` > `setWorkArea` > `setOutput` > `setTitle` > `setSummary` > `preCommit` > `commit`.
  Reference: the worker.hire event handler.
- UUIDs (`uuid.v4()`) only inside `setOutput()`: one per primary entity and one per child. `validateInput` and
  `commit` can run more than once, so an id made there changes between retries.
- `ClientID` from `session.eventContext.clientID`, `EventID` from `this.eventID`, `VersionNumber` hardcoded `1` on
  create; never from input, body or client state (IFX-004, privilege escalation).
- Every insert sets the bi-temporal fields: `_TransactionStartDateTime` and `_ValidityStartDateTime` =
  `session.dataDb.transactionDateTime`, `_TransactionEndDateTime` and `_ValidityEndDateTime` = `null` (ARCH-005).
- Checked by `check-lifecycle` and `check-security-fields` (run by `axon-verify`).
