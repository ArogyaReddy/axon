# 02 - Getting Started with Resources

> What each online resource (GitHub repo) under `~/.claude/.arog/` actually contains, what is valuable for your work,
> and what to leave behind. Covers tasks.md steps 4-5. Every asset listed was opened and read.

Repos reviewed:

| # | Repo | Author | One-line essence |
|---|---|---|---|
| R1 | `bowser` | IndyDevDan (disler) | 4-layer browser automation / UI QA: Skill -> Subagent -> Command -> Justfile |
| R2 | `claude-code-hooks-mastery` | disler | All 13 hook events, security hooks, validators, builder/validator team, meta-agent, output styles, 9 status lines |
| R3 | `claude-code-hooks-multi-agent-observability` | disler | Hooks -> HTTP -> Bun server -> SQLite -> WebSocket -> Vue live dashboard, plus HITL, worktrees, meta-skill |
| R4 | `multi-agent-postgres-data-analytics` | disler | Natural-language-to-SQL multi-agent system (AutoGen / OpenAI, 2023-24) - patterns, not a framework |
| R5 | `super-simple-software-factory` (SSSF) | disler | Deterministic code owns the loop; agents are bounded phases with typed envelopes, gates, SQLite trace |

---

## R1 - Bowser (browser automation and UI testing)

### What it is
A composable browser-automation system. Each layer does one job and delegates down:

| Layer | Name | Role | Asset |
|---|---|---|---|
| 4 | Just | Reusability: one terminal command | `justfile` |
| 3 | Command | Orchestration: discover stories, fan out agents, aggregate | `.claude/commands/ui-review.md`, `bowser/hop-automate.md` |
| 2 | Subagent | Scale: parallel, isolated, structured report | `bowser-qa-agent`, `playwright-bowser-agent`, `claude-bowser-agent` |
| 1 | Skill | Capability: drive a browser | `playwright-bowser` (playwright-cli), `claude-bowser` (Chrome MCP), `just` |

### Key assets
- **`playwright-bowser` skill** - `playwright-cli` (token-efficient, no tool schemas in context), headless by default, **named sessions** `-s=<name>` for parallel isolated browsers, `--persistent` profiles, viewport via env, opt-in vision mode, always close the session.
- **`bowser-qa-agent`** - parses a user story (sentence, imperative steps, Given/When/Then, narrative assertions, checklist), screenshots every step to `screenshots/bowser-qa/<story>_<uuid>/NN_step.png`, stops at first FAIL, captures console errors, returns a strict PASS/FAIL table.
- **`/ui-review`** - globs `ai_review/user_stories/*.yaml`, creates a team, spawns one QA agent per story **in one message (parallel)**, collects `RESULT: PASS|FAIL | Steps: x/y`, aggregates a summary with screenshot paths.
- **`/bowser:hop-automate`** - a higher-order prompt: resolves skill/mode/vision from keywords, loads a saved workflow `.md` with a `{PROMPT}` placeholder and runs it.
- **`just` skill** + 5 example justfiles (node, bun, python venv, uv, multi-module).
- `/prime`, `/build <plan>`, `/list-tools`, `TOOLS.md` (a full tool signature reference).

### Why it is valuable for you
- Your core product is a **chat UI** (`e.fit.adpeai.com/agentic`, Roll). User stories in YAML + parallel QA agents + step screenshots is exactly the "be picky about pixels" E2E evidence your CLAUDE.md demands.
- Complements (does not replace) `adp-e-automation` (scripted regression) and PlayWell (flow-contract replay): Bowser is **exploratory / acceptance QA driven by plain-language stories**.
- The 4-layer pattern is a reusable **architecture rule** for every axon capability, not only browsers.

### Leave behind
Amazon / blog demo workflows; `--dangerously-skip-permissions` in every just recipe; hard `model: opus` on every agent.

### Prerequisites
`npm i -g @playwright/cli@latest` (verified on the npm registry 2026-09-30: package `@playwright/cli` v0.1.22, binary `playwright-cli`, repo `github.com/microsoft/playwright-cli`; this is NOT the `@playwright/test` runner used by `npx playwright test`), optional `just`, Chrome + `claude --chrome` for the personal-browser variant. None installed on this Mac yet. Bowser uses only `playwright-cli`; it never calls `npx playwright`.

---

## R2 - Claude Code Hooks Mastery

### What it is
A reference implementation of every hook event with UV single-file Python scripts, plus sub-agent engineering, team validation, output styles and status lines.

### Key assets

| Area | Assets | Standout idea |
|---|---|---|
| Hook lifecycle (13 events) | `user_prompt_submit, pre_tool_use, post_tool_use, post_tool_use_failure, permission_request, notification, stop, subagent_start, subagent_stop, pre_compact, session_start, session_end, setup` | Every event logged as JSON; one script per event |
| Security | `pre_tool_use.py` | Blocks `rm -rf` variants and `.env` access (allows `.env.sample`), exit code 2 feeds reason back to Claude |
| Flow control doc | README | Exit 0 / 2 / other semantics per event; JSON `decision: block`, `continue: false`; `stop_hook_active` guard against infinite loops |
| Context injection | `session_start.py`, `user_prompt_submit.py` | Load git status / context files at start; add context or block a prompt before Claude sees it |
| Safety net | `pre_compact.py` | Back up transcript before compaction |
| Validators | `validators/ruff_validator.py`, `ty_validator.py`, `validate_new_file.py`, `validate_file_contains.py` | **Self-validating commands**: a command's own frontmatter `hooks: Stop:` checks it produced a spec file with required sections, else Claude keeps working |
| Team | `agents/team/builder.md` (all tools + lint hooks), `validator.md` (`disallowedTools: Write, Edit`) | Builder/validator pairing: more compute for more trust |
| Planning | `/plan`, `/plan_w_team` (TaskCreate / TaskUpdate / blockedBy / owner / resume / background), `/build` | Template meta-prompt: plan format is fixed, so output is predictable |
| Meta | `meta-agent.md` | Agent that writes agents (name, color, minimal tools, delegation description) |
| Output styles | `ultra-concise, table-based, yaml-structured, bullet-points, markdown-focused, html-structured, genui, tts-summary` | Switch response format per task without rewriting CLAUDE.md |
| Status lines | v1-v9 | v5 cost + lines, v6 context bar, v7 session timer, v8 token/cache stats, v9 powerline |
| Commands | `/prime`, `/question` (answer without editing), `/cook` (parallel subagents), `/git_status`, `/update_status_line` | |
| Docs | `ai_docs/` hooks, subagents, status lines, slash commands, uv scripts | Local, agent-readable docs |

### Why it is valuable for you
- Gives the **deterministic enforcement layer** (your "Layer 1") a correct, complete model: which event can block, how, and how to avoid loops.
- Self-validating command frontmatter hooks are a cheap, deterministic way to enforce your plan template (Rule 2) without an extra agent.
- Builder/validator maps directly onto your RED/GREEN/VERIFY separation.

### Leave behind
TTS (ElevenLabs / OpenAI / pyttsx3) and LLM-generated completion messages (external API keys, cost, data leaving ADP); crypto agents and commands; `hello-world-agent`; `sentient.md`.

### Prerequisites
`uv` + Python 3.11 (the Mac has 3.9, no uv). Hooks can be ported to Node, which you already have.

---

## R3 - Multi-Agent Observability

### What it is
Real-time monitoring of many Claude Code agents: `Claude agents -> hook scripts -> HTTP POST -> Bun server -> SQLite (WAL) -> WebSocket -> Vue client`.

### Key assets
- **`send_event.py`** - one universal event sender for all 12 events, `--source-app`, `--event-type`, optional `--summarize` and `--add-chat`, forwards `tool_name`, `tool_use_id`, `agent_id`, `notification_type`; agent identity = `source_app:session_id[0:8]`.
- **Server** (`apps/server`): `POST /events`, `GET /events/recent`, `GET /events/filter-options`, `WS /stream`, SQLite migrations.
- **Client** (`apps/client`, Vue 3): timeline, multi-filter, live pulse chart, chat transcript modal, tool emojis, per-session colors.
- **Human-in-the-loop (HITL)**: agent posts a question, dashboard shows it, human answers, server pushes the answer back to the agent over WebSocket.
- **Agents**: `scout-report-suggest(-fast)` (read-only scout with a fixed report), `docs-scraper`, `meta-agent`, `create_worktree_subagent`.
- **Skills**: `meta-skill` (creates skills with progressive disclosure), `worktree-manager-skill`, `create-worktree-skill`, `video-processor`.
- **Commands**: `/t_metaprompt_workflow` (prompt that writes prompts), `/load_ai_docs` (parallel docs scraping into `ai_docs/`), `/quick-plan`, `/plan_w_team`, `/build`, worktree create/list/remove, `/convert_paths_absolute`, `bench/`.
- `justfile` recipes: `start, stop, restart, health, test-event, db-reset, hooks, open`.

### Why it is valuable for you
- You already run an always-on local dashboard (`rollup-server.js` on `127.0.0.1:47301`) with activity logging hooks. R3 shows the **event schema and transport** to make that dashboard show live multi-agent activity (useful when running parallel QA agents or team builds).
- Worktrees enable **parallel feature branches** (for example one agent on a pilot branch, one on a product branch) without clobbering.
- Scout agent + meta-skill + metaprompt accelerate building the rest of axon consistently.

### Leave behind
Firecrawl / ElevenLabs / OpenAI integrations; model-benchmark agents (`fetch-docs-haiku45/sonnet45`, `bench/`); Gemini docs.

### Prerequisites
`bun`, `uv`, `just`, `ANTHROPIC_API_KEY` for summaries. At ADP, sending prompts/summaries to an external API is likely not allowed `{NOT SURE}`.

---

## R4 - Multi-Agent Postgres Data Analytics

### What it is
A 10-part learning series (not a framework, frozen): ask a Postgres database questions in natural language. GPT-4, AutoGen, OpenAI Assistants, Guidance. Code is outdated; the **patterns** are the value.

### Patterns worth keeping
| Pattern | Where | Meaning for you |
|---|---|---|
| Gate team | `main.py` scrum_master confidence 1-5 | Reject a vague question before spending tokens or touching a DB |
| Schema RAG | `embeddings.DatabaseEmbedder`, `get_related_tables` | Send only the relevant table definitions (DSQL `data.*` has many tables) |
| Cap refs | `llm.add_cap_ref` | Name a context block (`TABLE_DEFINITIONS`) and refer to it in the prompt |
| Instruments | `agents/instruments.py` | Shared state/tools object for agents and orchestrator |
| Conversation flows | `orchestrator.sequential / broadcast / round_robin` | Choose the flow deliberately per team |
| Decision agents / structured output | `prompt_json_response`, Guidance | Agents that return decisions that drive control flow |
| Self-correcting SQL | v9 Turbo4 | On SQL error, feed the error back and retry |
| Spy on agents + cost | `spy_on_agents`, `get_cost_and_tokens`, `estimate_price_and_tokens` | Observability and cost accounting per run |

### Why it is valuable for you
Direct template for an **ADP DSQL / GraphQL analyst skill**: read-only, bi-temporal aware (active-row filter), `ClientID` scoped, gate first, schema selection, self-correcting, cost-reported. Also informs PACER Prober-style evaluation.

### Leave behind
All AutoGen / OpenAI / Guidance code, the three front-end clients, Vercel API server.

---

## R5 - Super Simple Software Factory (SSSF)

### What it is
One skill (`/sssf`) that stamps a factory into any repo. **"Agent proposes, code disposes."** Python ADW scripts (AI Developer Workflows) own sequencing, retries and acceptance; agents work inside named phases.

### Key concepts
| Concept | Meaning |
|---|---|
| Phases, 3 lanes | `engineer` (human), `agent` (`ph.call(...)`), `code` (deterministic step like commit, tests) |
| Roster | `sssf.config.yaml`: per agent model, thinking, prompts, harness, `writes:` boundary, `protected_files` |
| Envelopes | Typed JSON output per agent (`status, summary, artifacts, notes_for_next_agent` + subtype fields); parse failure re-prompts the **same** session |
| Gates | Verify claims after the fact: `artifacts_exist, files_non_empty, json_parses, diff_matches_claims, verdict_consistent, tests_pass(cmd)` |
| Permissions | Repo diff before/after each agent call; unauthorized writes rolled back, phase fails |
| Trace | Every event into SQLite (7 tables); readers poll one cursor query; read-only Vue visualizer |
| Hard rules | Validate roster first, typed outputs only, gates verify claims, 4-param rule, one agent one purpose, thin ADWs, every phase has a real description, **a known command is code not an agent**, `run.finish(accepted=)` |
| 12 starter ADWs | scout, plan, build, plan_build, build_test, build_review, plan_build_test, plan_build_test_quality, document, quality, prompt, simple_sdlc |
| Lazy routing | SKILL.md routes to 9 cookbooks, never volunteers status |

### Why it is valuable for you
- It formalizes what your current rules (CLAUDE-ME.md Rules 1-6) want (plan, test, verify, review, done = verified) as **code-enforced gates** instead of prompt promises.
- The "known command is code" rule matches your `ar-verify` = "zero AI, pure shell" instinct and the `ship-pipeline` design already in `~/.claude`.
- Per-agent model choice fits a Sonnet-first cost policy (cheap model for building, stronger model for planning/review when allowed).

### Constraints
v1 runs the **Pi coding agent only**; `claude_code` is a stub (`agent_cc.py` raises). Starter roster needs OpenRouter / Fireworks / OpenAI keys. At ADP you use Claude via Bedrock `{NOT SURE: are other providers allowed}`. To use it with your stack, the Claude Code adapter (`claude -p --output-format stream-json --resume`) must be written.

---

## Cross-repo view

### What every repo agrees on (adopt as axon principles)
1. **Layering:** capability (skill) -> scale (subagent) -> orchestration (command) -> reusability (one CLI/just recipe).
2. **Determinism where possible:** hooks, validators, gates and scripts do what code can do; agents only read and decide.
3. **Isolation:** subagents start blank; read-only validators cannot write; `writes:` boundaries.
4. **Structured output contracts:** fixed report formats, `RESULT:` lines, typed envelopes, required plan sections.
5. **Observability:** log every event, keep evidence (screenshots, envelopes, transcripts), make runs replayable.
6. **Parallelism by default** where tasks are independent (one agent per story / task).

### Overlap matrix (same idea appears in several places)

| Capability | R1 | R2 | R3 | R4 | R5 | Already in `~/.claude` |
|---|---|---|---|---|---|---|
| `/prime` context load | yes | yes | yes | - | startup table | `session-start-brief.sh`, `resume-work` |
| Plan command | - | plan, plan_w_team | quick-plan, plan_w_team | - | planner agent | ar-understand, ar-plan-track, plan-feature, ar-tdd phase 0, framing-vague-requests |
| Build from plan | build | build | build | - | builder + ADWs | ar-tdd, ar-go-until-done |
| Read-only validator/reviewer | QA agent | validator | scout | - | reviewer, `writes:` | ar-review, ar-code-reviewer, code-reviewer, security-reviewer, verifier |
| Dangerous command guard | - | pre_tool_use | pre_tool_use | - | permissions.py | block-dangerous-commands.py, ar-tool-use.sh |
| Meta (agents/skills/prompts) | - | meta-agent | meta-agent, meta-skill, metaprompt | - | make_adw, make_config | find-skills, synced skill-creator, ADP `claude-feature-builder` |
| Status line | - | v1-v9 | v6, main | - | - | nix statusline, moltamp, settings-me inline |
| Observability | screenshots | JSON logs | live dashboard | spy + cost | SQLite trace + UI | rollup dashboard, activity logger, audit-log.py |
| Browser | 2 skills + 3 agents | - | - | - | - | chrome-devtools-axi, go-to-dev playwright playbook, PlayWell (PACER) |
| Task runner | justfile | - | justfile | poetry | justfile | `bin/arog*`, npm scripts |

### Also found inside `~/.claude` (resources you downloaded earlier)
- **`go-to-dev-kit/`** - one router skill + 10 playbooks (debugging, analysis, feature, review, validation, docs, Playwright, hooks check, token cost, context hygiene) + scripts; argues for only 2 agents (verifier, reviewer) with token evidence in `PROOF.md`.
- **`ship-pipeline/`** - spec (`ACCEPTANCE.md`) -> test-first (PreToolUse blocks impl edits until a failing test is recorded) -> implement -> `verify.js` (tests + lint + typecheck + criteria mapping, Stop hook) -> isolated reviewer; fast lane for tiny changes (`classify-change.js`).
- **`docs/skills-main/`** (Matt Pocock) - small composable engineering skills: `tdd`, `diagnosing-bugs`, `code-review`, `grill-me`, `to-spec`, `to-tickets`, `handoff`, `git-guardrails-claude-code`, `setup-pre-commit`, `writing-for-agents`.

### What NOT to import anywhere
External TTS/LLM providers, crypto/demo content, Pi/OpenRouter roster as-is, `--dangerously-skip-permissions` defaults, frozen AutoGen code, duplicated status line versions, anything with hardcoded personal paths or internal endpoint values.

---

## Next
The combined design, where each piece is used, benefits and phased implementation plan are in
`~/.claude/docs/plans/axon-framework-build-2026-09-30.plan.md` (awaiting your GO).
