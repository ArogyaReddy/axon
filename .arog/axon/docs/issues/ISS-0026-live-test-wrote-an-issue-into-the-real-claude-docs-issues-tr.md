---
id: ISS-0026
title: Live test wrote an issue into the real ~/.claude/docs/issues: tracker ignores AXON_DOCS_DIR
status: fixed
severity: medium
type: bug
feature: core-skills
found: 2026-10-01
found_in: test
found_by: P1b git-push live run
files: plugins/axon-core/lib/issues.mjs
fixed: 2026-10-01
fix_commit: 
verified_by: issues env override test; live rerun wrote to scratch, real ~/.claude/docs/issues absent
related: 
---

# ISS-0026: Live test wrote an issue into the real ~/.claude/docs/issues: tracker ignores AXON_DOCS_DIR

## What happened

A live git-push test logged its reviewer finding into the real ~/.claude/docs/issues/repo/ instead of the test's scratch folder.

## How it was found

The live result asked for permission to edit /Users/arog/.claude/docs/issues/repo/ISS-0001-...; `ls ~/.claude/docs/issues` showed a folder created at 23:59 by the test.

## Root cause

`resolveIssuesDir` honoured only `<repo>/.axon/config.json` and `$HOME`; the test harness redirected plans and docs (`AXON_PLANS_DIR`, `AXON_DOCS_DIR`) but the tracker ignored them.

## Impact

Medium: test data written into the user's real docs (removed: the folder did not exist before and contained only the test's files).

## Fix

`plugins/axon-core/lib/issues.mjs`: `AXON_ISSUES_DIR` first, then `AXON_DOCS_DIR/issues/<repo>`, then `~/.claude/docs/issues/<repo>`. Polluted folder removed.

## Verification

Test `issues dir honours AXON_ISSUES_DIR, then AXON_DOCS_DIR` failed first, passes now; rerun live: issue landed in the scratch docs, `ls ~/.claude/docs/issues` = No such file.

## Lessons

Every component that writes files needs a test override, and every live test must assert the real home folder was not touched.
