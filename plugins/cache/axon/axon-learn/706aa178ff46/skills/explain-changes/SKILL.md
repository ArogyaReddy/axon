---
name: explain-changes
description: Write a change record for a code change (bug fix, refactor, feature) - how it was found, root cause, before/after diff, why the fix works, risk, verification - to ~/.claude/docs/changes/. Use for "explain what we changed", "document this fix", "why did we change this file", "before and after".
argument-hint: "[file | noun.verb | (none = uncommitted changes)] [--context \"...\"]"
---

# Explain changes (story + evidence > change record)

Runs in this session, so the investigation story is the conversation you already have: use it, and say which parts
come from the conversation and which from git.

## 1. What changed

| Argument | Files |
|---|---|
| none | `git diff --name-only` + `git diff --cached --name-only` (all uncommitted changes) |
| `noun.verb` (adp-e-product) | `src/*/events/<noun.verb>/` and `src/*/controllers/conversations/<noun.verb>.ctrl.tsx` |
| a path (or several) | those files |

Nothing changed and no argument: say so and stop.

## 2. Evidence (read, never recall)

- `git diff` (and `git diff --cached`) for those files; `git log -5 --format='%h %s' -- <file>` for history.
- The plan doc in `~/.claude/docs/plans/` and any issue in `axon-issue list` that this change fixes: link them.
- One quick search for callers of the changed functions, to state the blast radius.
- An existing record in `~/.claude/docs/changes/` for the same files: update it instead of writing a second one.

## 3. Write the record

Path: `${AXON_DOCS_DIR:-~/.claude/docs}/changes/<noun-verb-or-area>-<what>-<bugfix|feature|refactor>-<MMDDYY>.md`.
Follow `references/template.md` (read it now): investigation story, summary, problem, root cause, how it was found,
before/after code, why the fix works, a Mermaid diagram where the flow matters, risk and files not affected,
expected outcome, verification steps with the real commands and results.

Rules: real content in every section (no "N/A", no placeholders); before/after code is copied from the diff, never
retyped from memory; the verification section names what was run and its result, or says "not run".

## 4. Reply

The path, the root cause in one sentence, and the verification status, in three lines.
