@~/.claude/STATE-SNAPSHOT.md
@~/.claude/FRAMEWORK-FEATURE-FLAGS.md

# CLAUDE.md — AROG

## Identity

I am Arogya Reddy — Senior Lead Software Developer at ADP.
Platform: adp-e-product (ADP Employee Experience — payroll, HR, policy management).
Model: Sonnet-only. Token cost and efficiency are hard constraints.
Every decision considers: is this minimal? is this verified? is this production-safe?

## adp-e-product — Personal Defaults & Session Context

Verified personal defaults (environment=FIT, session-startup commands,
current pilot/feature branch, in-progress events, corrected command
reference): `~/.claude/docs/guides/adp-e-product-my-defaults.md`.
Repo-scoped facts/gotchas: `/memories/repo/adp-e-product.md`. Mandatory
non-negotiable rules for that repo: `~/.claude/rules/adp-e-product/mandatory.md`.

## Operating Framework: AROG

Three layers, priority order:

- Layer 1 — ENFORCEMENT: git hooks + pre-tool-use.sh that exit 1. Cannot be bypassed.
- Layer 2 — CONTEXT: STATE-SNAPSHOT.md + FRAMEWORK-FEATURE-FLAGS.md loaded above (RUNNING-LOG/DECISIONS on-demand).
- Layer 3 — PATTERNS: 7 skills, on-demand only.

## The Mandatory Order — Every Task, No Exceptions

```
ANALYSE → PLAN → SHOW → APPROVAL → TESTS (RED) → IMPLEMENTATION (GREEN) → REFACTOR (BLUE)
```

1. **ANALYSE** — read codebase, understand what exists
2. **PLAN** — write to `~/.claude/docs/plans/<slug>.plan.md` (files, tests, architecture)
3. **SHOW** — post summary + plan path in chat. Wait.
4. **APPROVAL** — hard stop. No tests, no code until user says GO.
5. **TESTS** — failing tests only. Show FAIL output.
6. **IMPLEMENTATION** — only after tests fail.

⛔ Tests before approval = violation. Code before tests fail = violation. Skip plan = violation.

## Rule 1 — NO TEST = NO CODE

Pre-commit hook exits 1 if source `.ts` staged without `.test.ts`.
Inside Claude Code: the mandatory order above applies. Failing test FIRST. Show FAIL output. Then implement.
Structural `assert(src.includes('x'))` does not count. Real test = fires input, asserts output, FAILS before fix, PASSES after.

**Test approval gate:** Before writing any `.test.ts` file, post TEST APPROVAL REQUEST and wait for YES. On YES, run: `touch ~/.claude/.test-approval-this-session` — then write the test.

## Rule 2 — NO UNDERSTANDING = NO START

Before any multi-step task, analyse and write the plan. Then post this block and WAIT:

```
PLAN: ~/.claude/docs/plans/<slug>.plan.md

UNDERSTAND: [one sentence — what is being asked]
OWNERSHIP:  [what exists already that touches this]
WHAT CHANGES: [exact files + what changes in each]
TEST LIST:  [test IDs that will be written]
RECOMMEND:  [approach + why]

Say GO to proceed to tests. Say EDIT <section> to change. Say STOP to cancel.
⛔ NO TESTS OR CODE UNTIL YOU SAY GO
```

## Rule 3 — NO REPRODUCTION = NO BUG FIX

Before touching any bug: write a failing test that reproduces it.
Show FAIL output. Fix. Show PASS output.
Skipping = the exact problem this rule exists to prevent.

**Bug fix gate:** After writing repro test, run: `touch ~/.claude/.bug-hunt-session-active` — this unblocks source file editing for the session.

## Rule 4 — DONE = DONE_VERIFIED

Before claiming done:

1. Run `/ar-verify` (pure shell gate — zero AI)
2. Run `/ar-review` (adversarial review)
3. Show output of both

Plain DONE without these = NOT DONE.

## Rule 5 — AROG Guard (always active)

1. No silent assumptions — state before non-trivial changes, wait if load-bearing
2. Minimal solution — no uninstructed abstractions, no "I also added..."
3. Orthogonal change prevention — only modify what was asked
4. Verify before irreversible — state it, wait for explicit confirmation

## Rule 6 — NO GUESSING, NO ASSUMPTIONS (hardens Rule 5.1 — no "non-trivial" carve-out)

Every ambiguous point is an explicit question to the user. Never assume and proceed, never fill a gap silently to be "helpful."

1. Hit an unknown/ambiguous fact → ASK the user directly. Do not guess, do not infer, do not pick "the most likely" answer.
2. User answers "I don't know" / doesn't answer → write it as `{NOT SURE}` in the relevant doc/plan and STOP on that point.
3. Only proceed past a `{NOT SURE}` after the user explicitly says to guess/assume and continue.
4. This applies to every question, not just load-bearing/non-trivial ones — the user decides what's trivial, not me.
5. Verified fact (read the actual file/output/config) is not a guess — state it plainly. The rule targets assumptions, not confirmed information.

## Document Output Rule

ALL generated documents go into `~/.claude/docs/<subfolder>`. No exceptions.

| Document type                                                                                     | Folder                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Code reviews, PR reviews                                                                          | `~/.claude/docs/code-reviews/`       |
| Plans, task plans                                                                                 | `~/.claude/docs/plans/`              |
| Guides, how-to, impl guides                                                                       | `~/.claude/docs/guides/`             |
| Change explanations, diffs                                                                        | `~/.claude/docs/changes/`            |
| ar-review reports                                                                                 | `~/.claude/docs/reviews/`            |
| Session summaries                                                                                 | `~/.claude/docs/session-summaries/`  |
| Specs, event specs                                                                                | `~/.claude/docs/specs/`              |
| Framework docs                                                                                    | `~/.claude/docs/framework/`          |
| AROG global knowledge (GLOBAL-WIKI/LEARNINGS/TASKS/PLAN)                                          | `~/.claude/docs/global/`             |
| Canonical/event pipeline gates (golden-tests-tracker, LEARNINGS, defects-reference, release-gate) | `~/.claude/docs/events/{canonical}/` |
| QA app-tests reports + evidence + config                                                          | `~/.claude/docs/qa/app-tests/`       |
| Task status (qa-dev-architect)                                                                    | `~/.claude/docs/tasks/<task-id>/`    |

Never write docs to project repo dirs or `~/.claude/` root. **One deliberate exception:**
`{project-root}/.arog/ar-config.local.yaml` — a per-project config override — stays repo-local
because it can't mean anything from a single global path. Repo-local `.gate` semaphore/lock
directories (git-push gates) also stay repo-local — they're operational state, not documents.

## Skill Routing

- New code / bug fix: `/ar-tdd`
- ADP-e event: `/ar-event-from-spec` → `/ar-event-code-reviewer`
- Any code review: `/ar-code-reviewer`
- Pre-commit check: `/ar-verify`
- Post-session review: `/ar-review`

## Output Rules — MANDATORY

Every response MUST follow:

1. No narration — never write "Now I will...", "Let me check...", "I've read..."
2. State results only — what was found, what changed, what's blocked
3. One sentence per update between tool calls
4. No trailing summaries after completing work — user can read the diff
5. Before first tool call: one sentence stating what you're doing
6. End of turn: max 2 sentences — what changed and what's next
7. Do NOT create planning docs, decision docs, or analysis docs unless explicitly asked — exception: the mandatory PLAN step (Rule 2) always writes a plan file

**Feature flag overrides (session-scoped):**
- `#BeProActive=YES` overrides rules 3, 4, and 6 — full 7-step loop replaces terse output
- `#ExplainWithResults=YES` overrides rule 4 — work trail + verbatim evidence required on every response
- Both flags together: full loop AND full evidence trail every turn
- These overrides apply for the rest of the session once set, until explicitly turned off

**MANDATORY — when any flag is set:** The FIRST line of the response must be the acknowledgment block from FRAMEWORK-FEATURE-FLAGS.md. No exceptions. No tool calls before it. Missing acknowledgment = flag not honored = framework failure.

## Effort Routing

Default: `high` (set in settings.json). Change for a session with `/effort <level>` — applies until changed again or session ends.

| Task type                           | Effort | How to set                                      |
| ----------------------------------- | ------ | ----------------------------------------------- |
| File reads, grep, exploration       | `low`  | `/effort low` at session start                  |
| Code edits, bug fixes, reviews      | `high` | Default — no action needed                      |
| Architecture, security review       | `high` | Default — no action needed                      |
| 10+ file refactors, novel algorithm | `max`  | `/effort max` then back to `/effort high` after |

`/effort max` costs ~3× tokens vs `high`. Reset with `/effort high` immediately after the heavy task.

## Code Generation Rule

For new files over 100 lines: scaffold empty structure first (Write), then fill sections with Edit operations. Edit sends only the diff — up to 15× cheaper than Write on existing files.

<!-- CODELENS_MANAGED_START -->
## CodeLens Graph — Mandatory Search Protocol

This workspace has a live codebase knowledge graph via **CodeLens Graph** MCP.
The graph contains **2858 symbols** across **255 files**, updated on every save.

### RULE 1 — Triage first to establish the baseline
Before starting a task, call `codelens_triage` to classify it.
Use the triage response to pick the most efficient tool path. You have full flexibility to choose other tools as necessary:
- **Tier 1 (typo/formatting)**: No tools needed.
- **Tier 2 (symbol lookup / search)**: Call `codelens_search` (for classes, functions, types) or `codelens_text_search` (for strings, comments, local variables).
- **Tier 3 (features / bugfixes)**: Start with `codelens_context`. Use `mode: "short"` to quickly see the file/symbol map (cheapest), or `mode: "deep"` only if you need full implementations.
- **Tier 4 (refactoring)**: Use `codelens_context` + `codelens_impact` to map dependencies and prevent breaking changes.

### RULE 2 — Use specific tools instead of scanning files
Avoid generic workspace scans (grep, ls, find) or reading whole files. Use these targeted tools:
| Task / Need | Recommended Tool | Why It Saves Tokens |
|---|---|---|
| Locate symbol definition | `codelens_search` | Returns exact file:line + signature |
| Search text, comments, or strings | `codelens_text_search` | Searches line-by-line using fuzzy text index |
| Inspect 1 class/function code | `codelens_node` (with `with_snippet: true`) | Avoids reading the whole file containing it |
| Understand feature context | `codelens_context` | Returns a minimal subgraph of only related files |
| Find callers/callees of a function | `codelens_relations` | Lists callers, callees, or both for a given symbol |
| See transitive dependencies | `codelens_impact` | Automatically runs BFS to map the blast radius |
| Check directory structure | `codelens_files` | Returns category-grouped file list |

### RULE 3 — Read only what CodeLens points to
When CodeLens tools return a `file:line` range, read only that specific range using the `view_file` tool (with StartLine and EndLine).
Do NOT read whole files, and never read files that are not listed in the graph response.

### RULE 4 — Check before creating
Before writing a new function, class, or file, run `codelens_search` to ensure you are not creating a duplicate. Duplication is the #1 source of code rot.

### RULE 5 — Keep the graph updated
The knowledge graph is updated automatically on file save. You can run `codelens_status` to verify the index is healthy and up to date.

### RULE 6 — Query dependencies and configs strategically
Only search for package dependencies, type definitions, or configuration files (like package.json, tsconfig.json) when asked or if context is missing.
Use `codelens_search` or `codelens_files` with `scope: "deps"`, or use `codelens_dependencies` directly.

### Available tools (MCP server: codelens)
`codelens_triage` · `codelens_search` · `codelens_context` · `codelens_dependencies`
`codelens_relations` · `codelens_impact` · `codelens_text_search`
`codelens_node` · `codelens_files` · `codelens_status`
<!-- CODELENS_MANAGED_END -->
