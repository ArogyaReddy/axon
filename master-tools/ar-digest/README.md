# ar-digest

On-demand work digest — combines 3 already-written, zero-AI data sources into one
"what did I do" summary for a chosen time window.

## Why

Closes gap G2 from `docs/plans/arog-vision-gaps-2026-08-02.plan.md`: there was no
capability spanning sessions + tickets + PRs + decisions together. `chronicle`
(VS Code's built-in skill) covers Copilot chat sessions alone, on request only, and
isn't wired to JIRA/PR/Command Center data at all.

## What it reads (zero new API calls)

| Source | Written by |
| --- | --- |
| `docs/sessions/sessions.jsonl` | `capture-sessions` / `ar-session-log` |
| `docs/command-center.json` (`decisions` array) | Hand-written, Command Center |
| `STATE-SNAPSHOT.json` (tickets/PRs) | `ar-morning-brief` |

## Usage

```bash
node ar-digest.mjs --since today      # or: yesterday | week | month (default: week)
node ar-digest.mjs --since month --json
```

## Tests

```bash
node tests/digest.test.mjs
```

Pure functions only (`resolveWindow`, `filterSessionsSince`, `filterDecisionsSince`,
`buildDigest`, `formatDigestText`) — no network calls, no file I/O in the tested
functions themselves (the CLI wrapper `ar-digest.mjs` does the real file reads).

## Consistency note

`ticketsInFlight` uses the exact same "Code Review: ..." tracking-ticket exclusion
as `hooks/lib/suggestions-panel.js` (Chapter 11, S5's documented non-bug case) — the
two tools are deliberately kept in agreement on this fact.
