# 03 - axon component catalog

Revision 3, 2026-09-30. Decided with you, based on the measured POC (`04-poc-results.md`).
This file is the single source of truth for WHAT axon ships and WHY. The plan
(`axon-framework-build-2026-09-30.plan.md`) refers here instead of keeping its own list.

**The design in one sentence: do the work inline in your session, let code check every step, and use an agent only where
a session cannot do the job.**

**Result: 21 skills, ~10 hooks, a few scripts, 4 agents (all Sonnet), 1 output style, 1 CLI, 6 plugins.**

---

## 1. Why this design (evidence)

Same task, same model, judged by 7 hidden tests (full report: `04-poc-results.md`):

| Approach | Hidden tests | Cost | Time |
|---|---|---|---|
| Inline | 7/7 | $0.29 | 68 s |
| CATER (orchestrator + 4 agents) | 7/7 | $1.52 (5.3x) | 346 s (5.1x) |
| Pipeline (fixed `claude -p` phases + code gates) | 7/7 | $0.55 to $1.15 (1.9x to 4x) | 104 to 459 s |

- Inline is the cheapest and fastest at equal quality.
- CATER for everything costs about 5x for the same result.
- Pipelines are not cheaper; their value is control (code proved the tests failed first and were not edited). One wrong
  expected value from the plan phase locked a pipeline into 3 useless retries.
- Inline's weakness: nothing enforced test-first; the model only said it did. **Hooks fix that at inline cost.**

## 2. Rules used to choose

| Rule | Meaning |
|---|---|
| R1 Inline first | Every skill runs in your session. This is the default |
| R2 Code checks the steps | Rules that matter (test before fix, tests locked during the fix, no "done" without evidence, protected files) are enforced by hooks and scripts, not by instructions |
| R3 A known command is a script | Lint, tsc, tests, checkers, data gathering: zero model tokens |
| R4 Agent only for 3 reasons | (a) real parallelism, (b) independent judgment that must not share the author's assumptions, (c) independent opinions that must not see each other |
| R5 Heavy one-off job = fresh session | For jobs like `codebase-to-course`, start a fresh session (`/clear`) instead of an agent: same clean context, no orchestration overhead |
| R6 Pipeline only when unattended | Nightly QA, CI, scheduled merges; always with a retry cap and a judgment step that may declare "the test itself is wrong" |
| R7 Built-in first | Explore and general-purpose agents, `--worktree`, ADP `db-connect`; built-in `/code-review` and `/security-review` stay available as optional extras (not verified to review in a fresh context, so not the standard review) |
| R8 Sonnet only | Every agent `model: sonnet` |
| R9 Names | Your names without `ar-`; unclear repo names renamed; no clash with built-ins or ADP plugin skills |

---

## 3. Skills (21, all inline)

| # | Skill | Plugin | Job | Code checks / agents it uses |
|---|---|---|---|---|
| 1 | `prime` | axon-core | Load project context: CLAUDE.md, handoff, git state, active plan, open findings | - |
| 2 | `plan-feature` | axon-core | Frame a new feature with you: facts map, 2-3 blocking questions, options with a recommendation, GO | Plan template validators |
| 3 | `understand` | axon-core | Analyse an issue/bug/change: root cause, where, how, test before/after, plan doc, GO/EDIT/STOP | Plan template validators; Explore agent (built-in) for wide searches |
| 4 | `plan-track` | axon-core | Feature > Story > Task tracking; prevents plan drift. Findings are issues in `issue-tracker` tagged with the feature (one tracker, no separate FINDINGS log) | - |
| 5 | `tdd` | axon-core | PLAN (reuses the `understand` plan) > RED > GREEN > REFACTOR > VERIFY | `tdd-gate`, `test-lock`, `test-evidence`, `verify`; `verifier` agent at the end |
| 6 | `go-until-done` | axon-core | Run one task until its DONE WHEN criteria pass, or honest BLOCKED; never cheats (section 6) | same gates as `tdd`; `verifier` before declaring DONE |
| 7 | `verify` | axon-core | Gate script: lint, typecheck, tests, ADP checkers; writes evidence. `--deep` adds the `verifier` agent | `bin/axon-verify` |
| 8 | `git-push` | axon-core | Status/diff, run `verify`, independent review of the diff, honest commit message, push, PR text (Bitbucket). Review blockers stop the push | `stop-gate` evidence; `reviewer` agent |
| 9 | `agent-council` | axon-core | 5 independent advisors, anonymous peer review, verdict (your session is the chairman); ADR for technical decisions | `council-advisor` x5 in parallel |
| 10 | `wh-explainer` | axon-learn | WHAT / WHERE / WHY / HOW DO WE KNOW / BEFORE / AFTER / HOW TO FIX, colored Mermaid | - |
| 11 | `code-mentor` | axon-learn | Beginner explanation: meaning, 3-7 step flow, Mermaid, YES/NO paths, pseudo code | - |
| 12 | `mindmaps` | axon-learn | Offline markmap HTML + markdown (ADP preset: DB schema, code-DB-UI mapping, data journeys) | render script |
| 13 | `explain-changes` | axon-learn | Change record: investigation story, root cause, before/after diff, risk, verification | - |
| 14 | `codebase-to-course` | axon-learn | Interactive HTML course from a codebase (run in a fresh session, R5) | - |
| 15 | `interactive-book` | axon-learn | One living doc, questions answered inline at the exact point, Ledger | - |
| 16 | `interactive-session` | axon-learn | You run, I instruct and review, round by round, with a session log | - |
| 17 | `ui-acceptance` | axon-qa | YAML user stories run in parallel in real browsers, PASS/FAIL with screenshots; saved ADP flows | `qa-agent` xN in parallel |
| 18 | `playwright-browser` | axon-qa | How to drive `playwright-cli` (named sessions, snapshot refs, saved login, always close) | - |
| 19 | `git-pilot-feature-changes` | axon-adp | PILOT > feature merge (pilot wins), rebuild, TSC + domain tests, push; or new branch from PILOT | `bin/pilot-sync` script does the mechanical steps; your session handles conflicts and failures |
| 20 | `handoff` | axon-core | Close a session: reconcile git, write SESSION-HANDOFF.md (done, verified how, next, decisions, blocked on you), append one line to the session journal. Required: `prime`, the `session-brief` hook and the `stop-gate` reminder all read this file | - |
| 21 | `issue-tracker` | axon-core | Log every bug, regression, gap or risk found at any stage; record root cause, fix (what, where, how), verification and lessons | `axon issue` CLI: ids, fields, status, INDEX; refuses "fixed" without root cause, fix and evidence; refuses duplicate titles |

## 4. Agents (4, all `model: sonnet`)

| Agent | Plugin | Tools | Reason (R4) | Used by |
|---|---|---|---|---|
| `verifier` | axon-core | Read, Grep, Glob, Bash (no Write/Edit, no Agent) | (b) independent judgment: tries to prove "done" is false; PASS/FAIL/UNVERIFIABLE with command output. Short, read-only, so cheap | `tdd`, `go-until-done`, `verify --deep` |
| `reviewer` | axon-core | Read, Grep, Glob, Bash (read-only git and test commands; no Write/Edit, no Agent) | (b) independent judgment: reviews the diff in a fresh context, so it does not share the author's assumptions. 8 categories: correctness, plan completeness, silent failures, integration contracts, type safety, edge cases, security, ADP rules (incl. raw SQL for GraphQL-queryable data). Loads the project REVIEW-CHECKLIST. Verdict SHIP / SHIP WITH FIXES / DO NOT SHIP; each finding with file:line, why it matters, smallest fix | `git-push`; on request (`@agent-axon-core:reviewer`) |
| `qa-agent` | axon-qa | Bash, Read, Write | Runs one story once in a session opened by `axon-qa` and records a replay; later runs replay by code with no model. Ad-hoc browser tasks run inline (`playwright-browser`), not through this agent | ADP checkers | CLIs (axon-adp), run by `axon-verify` in adp-e-product | `check-i18n`, `check-lifecycle`, `check-security-fields`, `check-shared-imports`, `check-meta-fresh`, `adp-domain-check`: changed files against a base, `file:line` findings. Unverified on the real repo (11-p6-delivered.md) |
| `axon-qa` |
| `council-advisor` | axon-core | Read | (c) independent opinions: one lens per spawn, cannot see the others | `agent-council` |

Not agents, on purpose: planner (`understand`), builder (your session, guarded by hooks), test-writer/refactorer (TDD phases run
inline; hooks enforce the order), validator (`verifier`), scout (built-in Explore), playwright agent (`qa-agent` with one story), security reviewer (a category inside `reviewer`).

`verifier` and `reviewer` are different jobs: `verifier` checks BEHAVIOUR against the acceptance criteria by running things; `reviewer` checks the CODE (diff) for defects by reading it.
A strict-isolation option (`tdd --isolated`, separate test-writer/builder agents) can be added later if a very large change needs it.

## 5. Code checks (hooks and scripts) - the quality core

| Check | Type | Rule enforced |
|---|---|---|
| `tdd-gate` | PreToolUse hook (Write/Edit) | While a `tdd`/`go-until-done` task is active: edits to source files are blocked until a test run with at least one failing new test is recorded (RED before GREEN) |
| `test-lock` | PreToolUse hook (Write/Edit) | During GREEN and REFACTOR: edits to test files are blocked. To change a test, `axon-unlock-test <file> --reason` asks **you** to approve; Claude cannot unlock silently. A wrong test can still be fixed (the POC pipeline lesson) without silently weakening tests |
| `axon-qa` | CLI (ui-acceptance) | Runs user stories in parallel browser sessions: replays by code when a verified replay exists ($0), otherwise the qa-agent learns the story once; self-heals a failing replay once. Measured: learn $0.09/story, replay $0 |
| `axon-mindmap`, `axon-book-verify` | CLIs (axon-learn) | Render a markmap outline to offline HTML (pinned markmap-cli); check an interactive-book doc after edits |
| `event-log`, `axon-trace`, `axon dashboard` | async hook + CLIs (axon-observe, opt-in) | One redacted line per event in ~/.axon/events (no prompt text); session timeline; local activity page on 127.0.0.1:47301 |
| `axon-council` | CLI (agent-council) | Runs the council's two rounds as parallel `council-advisor` processes, anonymizes and rotates answers, writes the transcript; files given once as cached context. Measured $0.64 per council |
| `axon-plan-new` / `axon-plan-check` | CLI + skill Stop hook | `understand` and `plan-feature` create plans from the template with `axon-plan-new`; `axon-plan-check` (also run as their Stop hook, exit 2 blocks) rejects missing sections, unfilled placeholders and plans without acceptance criteria |
| `axon issue` | CLI (tracker) | One Markdown file per issue + generated INDEX.md. Enforces valid fields, no id reuse, no duplicate titles, and no "fixed" without a filled root cause, fix and verification evidence |
| `axon-task` | CLI (state) | Records the task phase in a file the hooks read. Refuses to skip steps: GREEN only after a recorded failing new test, DONE only after a passing `verify` newer than the last edit |
| `test-evidence` | PostToolUse hook (Bash) | Records every test run: command, exit code, pass/fail counts, time |
| `stop-gate` | Stop hook | Source changed but no passing `verify` evidence: block "done" once, with the reason |
| `guard-bash`, `guard-files` | PreToolUse hooks | Destructive or irreversible commands; secrets, generated files (lockfiles, CHANGELOG.md, `@generated`/`DO NOT EDIT`) and protected paths. Every deny is logged (redacted) in `~/.axon/logs` |
| `post-edit-check` | PostToolUse hook | Syntax/lint on the changed file; ADP fast checks by path: `i18n/**/messages-en.json` or `-es.json` edited > key parity check (missing Spanish key renders as a raw key, a known incident class); `meta/src/**` edited > reminder that `meta/build` must be rebuilt (project `reminders`). Syntax errors go back to Claude; parity and reminders are context |
| plan validators | Stop hook on planning skills | The plan doc must contain every required section |
| `session-brief` | SessionStart hook | Facts only: git state, active axon task, and a pointer to SESSION-HANDOFF.md (never its text, ISS-0029) |
| `prompt-flags` | UserPromptSubmit hook | Session flags `#Flag=YES/NO` (legacy registry), restated while active; `#FlagStatus` |
| `session-end` | SessionEnd hook | Prunes old session flags and decision logs |
| `axon-verify` | script | lint + tsc + tests + ADP checkers, evidence file |
| ADP checkers | scripts | i18n en+es, event lifecycle, security fields, shared imports, meta freshness |
| `pilot-sync` | script | fetch, merge, install, compile, tsc, domain tests for `git-pilot-feature-changes` |

Full hook contracts: plan section 8.

## 6. Persistence rule (go-until-done and the GREEN phase)

> Keep going until the acceptance criteria pass. When something fails: read the error, find the cause, fix it, re-run, repeat.
> Never make a check pass by weakening or skipping a test, changing the acceptance criteria, hardcoding expected values, or
> silencing an error. If a test itself is wrong, say why, unlock it, fix it, and record that in the evidence.
> Stop only when the criteria pass (with command output as evidence) or the blocker is outside your control (missing access,
> a decision only the user can make, a destructive or production action). Then report BLOCKED with the exact error, what you
> tried, and what is needed.

## 7. What each skill keeps from its sources

| Skill | Built from (best parts kept) |
|---|---|
| `prime` | R1-R3 prime + session-start brief + resume-work's reconcile-with-git |
| `handoff` | handoff command (reconcile git, handoff sections, archive over 150 lines) + ar-session-log's journal line |
| `plan-feature` | plan-feature command + framing-vague-requests |
| `understand` | ar-understand (inputs, platform checks, 10-section template, GO gate) + scientific-debugging (bug mode) + R2 plan's acceptance criteria and validation commands |
| `plan-track` | ar-plan-track |
| `tdd` | ar-tdd phases, pre-RED approval, EVIDENCE.md, deployment test plan; phases now inline with hook enforcement |
| `go-until-done` | ar-go-until-done (DONE WHEN, self-skeptical re-check, honest BLOCKED) |
| `verify` | ar-verify stage gates, ar-tdd VERIFY gates, ar-code-reviewer scripts, demanding-proof evidence levels |
| `git-push` | ship + ship-safely + Bitbucket PR template |
| `agent-council` | ar-agent-council (engineering examples, ADR output) |
| `wh-explainer`, `code-mentor`, `mindmaps`, `explain-changes`, `codebase-to-course`, `interactive-book`, `interactive-session` | the legacy skills, `ar-` removed; agent wrappers removed (work runs inline) |
| `ui-acceptance` | bowser ui-review + hop-automate (saved flows) |
| `playwright-browser` | bowser playwright-bowser + its CLI reference |
| `git-pilot-feature-changes` | ar-git-pilot-feature-changes; mechanical steps moved into `pilot-sync` |

Global rules (always loaded, short): work-discipline and demanding-proof.

## 8. Left out (with reason)

Also left out after P2/P3 evidence: `pre-compact-backup` and `notify` hooks (ADR-0005), the keybindings example (ADR-0006).

| Item | Reason |
|---|---|
| All 15 legacy skill-executor agents (ar-understand, ar-tdd, ar-plan-track, ...) | Work runs inline (POC: 5x cheaper) |
| builder, validator, test-writer, refactorer, planner, scout, playwright-cli agents | Inline session + hooks, `verifier`, built-in Explore |
| session-log, digest, resume-work, setup-project, risk-map | Not in your list (`prime` covers resuming; `handoff` writes the journal line; templates kept) |
| ar-review, ar-code-reviewer, code-reviewer, security-reviewer, review command | Merged into the one `reviewer` agent (best parts: ar-review's 8 categories and scoring, code-reviewer's verdict format and checklist loading, security-reviewer's hunt list); ADP pipeline scripts move into `verify` |
| ar-analyzer | `axon doctor` |
| code-explorer, create-power-point | ADP plugins |
| claude-bowser, meta-agent, meta-skill, docs tooling, worktree kit, just, TTS, demos | Built-ins, Firecrawl dependency, not in your stack, or demos |
| SSSF factory | Its ideas used in R6 for unattended pipelines; full adoption deferred |

## 9. Defects found in the legacy setup

| Defect | Fix in axon |
|---|---|
| `ar-tdd` spawned `tdd-red/green/blue`, which never existed: TDD always ran in one context with nothing enforcing the order | `tdd-gate` + `test-lock` hooks enforce it |
| `ar-code-reviewer` description "ADP-e Product Code Reviewer." never auto-triggers | Scripts in `verify` |
| `ar-verify` skill calls agent `ar-verify-done` | One `verify` skill |
| `ar-review` ran a full review on every Stop | `stop-gate` checks evidence instead |
| Resource-repo agents hardcode `model: opus` | Sonnet only |
| `ar-tdd` PLAN repeats `ar-understand` | `tdd` reuses the plan doc |

## 10. Plugins (6)

| Plugin | Contents |
|---|---|
| `axon-core` | prime, handoff, issue-tracker, plan-feature, understand, plan-track, tdd, go-until-done, verify, git-push, agent-council; agents `verifier`, `reviewer`, `council-advisor`; `bin/axon-verify` |
| `axon-guard` | all hooks (section 5, plan section 8) |
| `axon-qa` | ui-acceptance, playwright-browser; agent `qa-agent`; flows, story templates |
| `axon-learn` | wh-explainer, code-mentor, mindmaps, explain-changes, codebase-to-course, interactive-book, interactive-session; output style `lean` |
| `axon-adp` | git-pilot-feature-changes; `bin/pilot-sync`; ADP checkers; ADP rules; presets |
| `axon-observe` | event-log hook, dashboard events endpoint |

## 11. Global layer (not a plugin)

| Piece | What | Where |
|---|---|---|
| Global rules | Facts and non-negotiable rules for every project | `global/rules/axon.md`, loaded through the link `~/.claude/rules/axon` |
| `lean` output style | Cheapest measured style: compact coding instructions, cost-aware behaviour, results first, evidence named, no em dash | `plugins/axon-learn/output-styles/lean.md` |
| Status line | One line: repo, branch, worktree, axon task phase, model and effort, context bar, AWS expiry (work), cost, lines, flags, PR, rate limit, style. Drops segments by priority, cost last | `global/statusline/statusline.mjs` |
| Settings | `global/settings/base.json` + `profiles/{personal,work}.json`; personal adds the sandbox and credential scrub | merged by `axon install` |
| Installer | `axon install` (settings, rules link, plugins, pinned tools; `--write-through` for home-manager edit-in-place links), `axon update`, `axon uninstall`, `axon legacy archive/restore`, `axon doctor` (ADR-0010) | `installer/`, `bin/axon` |
| Project kits | adp-e-product, adp-e-automation, pacer: verify commands, path-scoped rules incl. data investigation, protected paths, local permission gates (`axon install --project`) | `project-kits/` |
| Copilot export | `axon export --copilot`: axon-guard hooks (through one adapter that maps Copilot payloads and answers), all skills, the reviewer and verifier agents and the rules, copied to `~/.copilot` or `<repo>/.github`, manifest-tracked; `axon doctor` flags a stale export (ADR-0009) | `copilot/` |
