---
name: issue-tracker
description: Log, update and close issues (bugs, regressions, gaps, risks) found at any stage - planning, implementation, review, testing or production - in the project's issue tracker, with root cause, fix location and verification. Use whenever a defect or problem is discovered, when fixing a logged issue, or when the user asks what issues exist.
argument-hint: "[new <title> | list | show <ID> | fix <ID> | close <ID>]"
---

# Issue tracker

Every problem found while working gets a record: what happened, how it was found, why it happened, how and where it was fixed,
and the proof the fix works. The `axon-issue` command (on Claude's PATH; in your terminal use `bin/axon issue`) owns ids, fields, status and the INDEX; you write the narrative.

## When to log (no exceptions)

Log an issue the moment you find any of these, at any stage (plan, implementation, review, test, production):
- a bug or regression, **even if you fix it a minute later** (the record is the value, not the open status)
- a gap: something the plan or code is missing
- a risk you are accepting or deferring
- a wrong statement in a doc, plan or earlier answer that someone acted on

Do not log: typos you fix in the same edit, or ideas that are not problems.

## How

1. Create it right away, before fixing:
   `axon-issue new "<short title>" --severity <critical|high|medium|low> --type <bug|regression|gap|risk|doc> --found-in <plan|implementation|review|test|production> --found-by "<how: test name, command, review, user report>" [--feature <slug>] [--files a,b]`
2. Open the file it prints and fill **What happened** and **How it was found** (exact steps or command to reproduce).
3. While working: `axon-issue start <ID>`.
4. After the cause is proven: fill **Root cause** (the full causal chain) and **Impact**.
5. After the fix: fill **Fix** (what changed, in which files and functions, why it fixes the cause) and **Verification**
   (the test that failed before and passes after, with the command), then:
   `axon-issue fix <ID> --verified-by "<test name or check>" [--commit <sha>] [--files a,b]`
   The command refuses while Root cause or Fix are empty, or without evidence. That is intentional.
6. Fill **Lessons**: what would have caught it earlier (a test, a hook, a check). If the lesson is a missing guard, log that as a
   `gap` issue too.
7. Not fixing it is **the user's decision**, never yours: propose it with the reason and let the user approve
   `axon-issue close <ID> --as wont-fix --reason "<why>"` (or `--as duplicate --reason "duplicate of ISS-n"`). The settings ask the
   user before every close.

## Severity

| Severity | Meaning |
|---|---|
| critical | Data loss, security hole, production down, or wrong money/payroll values |
| high | A core flow is broken or could silently break the user's setup |
| medium | Wrong behaviour with a workaround, or a misleading result |
| low | Cosmetic, docs, small friction |

## Reading the tracker

- `axon-issue list --status open` for what is still open; `INDEX.md` in the tracker folder is the always-current table.
- Before working on an area, list its issues (`--feature <slug>`) so known problems are not rediscovered.
- `plan-track` features link to issues through `--feature`; there is no separate findings log.

Where issues live: `<repo>/.axon/config.json` `issues.dir` if set (axon itself uses `docs/issues`), otherwise
`~/.claude/docs/issues/<repo-name>/` so team repositories are never touched.
