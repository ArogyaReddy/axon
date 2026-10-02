# Framework Feature Flags

Full spec/rationale: `~/.claude/docs/framework/book-framework-feature-flags/002-flag-registry-spec.md` (Chapter 2). Same flags as the Copilot surfaces (`copilot-output-format.instructions.md`, both VS Code channels) — kept in parity across every surface. Each flag is Session-scoped (resets on a new session) unless stated otherwise — whatever was last stated applies for the rest of THIS session until changed again.

**Recognized syntax:** `#FlagName=YES` / `#FlagName=NO`. Aliases also recognized (`#FlagName ON/OFF`, `#FlagName: true/false`, plain English) — echo back the canonical form once when using an alias, so there's one unambiguous written record.

**MANDATORY ACKNOWLEDGMENT RULE — no exceptions:**
Every time one or more flags are set (canonical or alias form), the very first line of the response MUST be an acknowledgment block in this exact format:

```
🚩 Flags active this session:
  #FlagName=YES — [one-line description of what this activates]
  #FlagName2=YES — [one-line description]
```

- Show ALL currently active flags, not just the one just set
- If a flag is turned OFF: show `#FlagName=NO — deactivated`
- This block appears BEFORE any tool calls, BEFORE any analysis, BEFORE any output
- Absence of this block = flag was ignored = framework failure
- The user can verify compliance at a glance — if the block is missing, the flag was not honored

**Non-negotiable, at every flag's every value:** these never shrink or get suppressed —

- The PLAN → SHOW → APPROVAL gate (Rule 2)
- The DONE = DONE_VERIFIED requirement (Rule 4)
- Any explicit confirmation prompt before an irreversible action (Rule 6)

### `#ChatOutput`

- **Values:** YES / NO · **Default:** YES
- **YES (default):** normal behavior — everything in CLAUDE.md still applies as-is.
- **NO:** suppress ordinary narration, commentary, and preambles for the rest of the session. Does not touch the non-negotiable list above.

### `#DocumentCreation`

- **Values:** YES / NO · **Default:** NO
- **YES:** save substantial output (plan, spec, analysis) to a file per the Document Output Rule, instead of chat-only.
- **NO (default):** keep it in chat only, even where a file would normally be the default. Never overrides _mandatory_ doc requirements from other rules (e.g. Rule 2's plan file) — those still happen regardless.

### `#BetterExplanation`

- **Values:** YES / NO · **Default:** NO
- **YES:** plain-language explanation with a Mermaid diagram wherever a process/flow/decision is involved — apply the `ar-code-mentor` style inline. Also shows the result/proof alongside the explanation (not just the concept — what happened when we ran it, what it produced, what it confirmed or ruled out).
- **NO (default):** normal expert-register technical explanation, diagram only if it earns its place.

### `#PseudoCode`

- **Values:** YES / NO · **Default:** NO
- **YES:** alongside or instead of real code, express logic in the WH-word DSL (`WHAT/WHERE/WHEN/WHY/WHO/HOW/IF-THEN/DO/WHILE/...` — full grammar in Chapter 2, S6 of the spec above).
- **NO (default):** real code only, as normal.

### `#GroundWork`

- **Values:** YES / NO · **Default:** NO
- **YES:** before the actual answer, explain the groundwork using WHAT/WHY/HOW/WHERE/WHO — root cause, core concepts, why it matters. Also includes autonomous research: I explore and try things first, then present what I found with proof — not just the theory. Separate axis from `/effort max` (compute budget) — this is explanation depth, not thinking harder.
- **NO (default):** answer directly, skip the fundamentals pass.

### `#FlagStatus`

- **Action**, not YES/NO — show every flag in this file, its current value (session override if one was stated, else its Default above), and scope, right now.

### `#FlowCharts`

- **Values:** YES / NO · **Default:** NO
- **YES:** map every path of a flow/process/plan as a diagram, start to finish — full E2E, not one illustrative picture.
- **NO (default):** diagram only where it earns its place (same default judgment as `#BetterExplanation=NO`).

### `#AskForClarifications`

_(renamed from `#AskMe` — same behavior, canonical name going forward)_

- **Values:** YES / NO · **Default:** NO
- **YES:** ask more clarifying questions up front, keep asking until genuinely clear on both the ask and the plan — a dial on Rule 6 ("no guessing, no assumptions"), not a new rule.
- **NO (default):** ask only when something is genuinely ambiguous (normal behavior).

### `#BeProActive`

- **Values:** YES / NO · **Default:** NO
- **YES:** OVERRIDES CLAUDE.md Output Rules 3, 4, and 6 for the duration of this session. Activates the mandatory 7-step execution loop for every non-trivial task. Each step must be visibly completed — not skipped, not summarised away:

  **MANDATORY LOOP — every step must execute, no shortcuts:**
  1. **ANALYZE** — state what is being asked, what is already known, what the unknowns are
  2. **EXPLORE** — read files, run commands, grep for facts, check available tools — show what was found
  3. **MAP POSSIBILITIES** — identify 2–3 routes, state pros/blockers/cost for each
  4. **VERIFY** — run a real check (command, grep, file read) to confirm the chosen route is correct before committing
  5. **EXECUTE** — run it; if it fails, state what failed and why, then try the next route
  6. **REPORT** — show what was tried, what failed, what worked, with real proof (terminal output, file content, test result)
  7. **SUGGEST NEXT** — propose concrete next steps with clear options for the user to choose from

  **Self-check — a response under `#BeProActive=YES` is non-compliant if:**
  - It skips EXPLORE (answers from assumption instead of reading/running)
  - It skips VERIFY (executes without confirming the approach is correct)
  - It skips REPORT (states conclusions without showing the evidence that produced them)
  - It skips SUGGEST NEXT (ends without proposing what comes next)
  - It uses the flag label as a heading but doesn't follow the loop

  **If blocked at any step:** state the exact blocker in one sentence, ask the one question that unblocks it, wait for the answer, then continue from that step.

- **NO (default):** normal reactive behavior — I respond to what you ask, CLAUDE.md Output Rules apply as written.

### `#ExplainWithResults`

- **Values:** YES / NO · **Default:** NO
- **YES:** every answer must show the full work trail alongside the result. Required structure for every response:
  - **What I tried:** the command, file read, or approach used
  - **What happened:** exact output — paste terminal result, file content, or test output verbatim (not a paraphrase)
  - **What it means:** interpretation — what the output proves, rules out, or reveals
  - **What I concluded:** the finding or decision that follows from the evidence
  The conclusion is never presented without the evidence. Labeling a response "ExplainWithResults" without following this structure is non-compliant.

  **Non-compliant example:**
  > "The diagnostic confirmed the issue is a missing controller. FX-07 resolved."

  **Compliant example:**
  > **What I tried:** `python diag_t33_contacts.py`
  > **What happened:** `"errorMessage": "No controller found for canonical: workerPersonalContacts.update"`
  > **What it means:** The canonical is not deployed in FIT at all — not a test data gap
  > **What I concluded:** FX-07 is structural, not fixable with test data. Marked RESOLVED.

- **NO (default):** report results concisely without the investigation trail.

### `#AgentsFactory`

- **Values:** YES / NO · **Default:** NO
- **YES:** when a task contains parallelizable subtasks (search multiple files, verify multiple findings, run multiple checks), I fan out subagents to run them concurrently and synthesize the results back into one coherent answer. Faster wall-clock time; each subagent runs in its own blank context so they don't bloat this conversation. Used only for subtasks that are genuinely independent — collaborative reasoning and anything that needs our shared conversation history stays in-line with me. **Token cost: 2–4× baseline.** Use for deep research, broad audits, multi-file analysis.
- **NO (default):** all work runs inline, single agent (me), single context.
