# IMPORTANT INFO and DETAILS BELOW

## GOAL
    - Build systematic and powerful platform for effective and best usage of AI [CLUADE CODE and COPLIT]
    - Resuable, repeatable, organized, systematic and powerful platform for development, coding, testing, building, usage

## Main : Must read : 

#### Please read all the files to understand my work, to understand my process, to understand my projects and work

    /Users/arog/.claude/.arog/my-stuff
        - It has all the files. 
        - Please read through the docs and understand my work and projects.
    /Users/arog/.claude/.arog/my-stuff/main-project
        - It has main project docs [ it's ADP, ROLL, Payroll, HR application]
        - Please read through the docs and understand my work and projects.

### PACER framework 
- To test the new agentic ai [ LLM Based conversation testing]
- We are building a new agnetic UI [LLM Based conversation based app for ROLL]
    /Users/arog/.claude/.arog/my-stuff/pacer-claude.md
    /Users/arog/.claude/.arog/my-stuff/pacer-readme.md

### Valueble Resources that I found online, github repos
- Concepts and useful stuff that I found below and I think, these are very valueable for me, for my work, for my project.

- I have the following projects, Valueble Resources under .arog
    /Users/arog/.claude/.arog
    /Users/arog/.claude/.arog/bowser
    /Users/arog/.claude/.arog/claude-code-hooks-mastery
    /Users/arog/.claude/.arog/claude-code-hooks-multi-agent-observability
    /Users/arog/.claude/.arog/multi-agent-postgres-data-analytics
    /Users/arog/.claude/.arog/super-simple-software-factory

- I am more interested on these repos and I see these projects are good with very detailed process, organization, coding, implementation using skills, agents, hooks and way of AI framework

### Working projects 
- Please read through : 
-     /Users/arog/.claude/.arog/my-stuff
-     /Users/arog/.claude/.arog/my-stuff/main-project
- I am working on ADP, ROLL, Payroll and HR app

### My tech stack that I am working on the projects are :
- TypeScript , Jascript, GrapghQL, DSQL, Cloudwatch, Lamda functions, AWS, Jenkins and so

I am also working on a project/tool :
PACER, Playwell, Plotter, Prober, Fact Checks

### PACER Framework overview
**PACER** = Persona · Agent · Conversation · Evaluate · Report — a toolkit for testing the ADP e-conversation-engine with real multi-turn conversations against the live FIT engine. The name is used two ways: the whole repo/toolkit, and one specific tool inside it (direct-API testing, below). Five pieces, four testing tools plus one router:

- **PACER** — runs real conversations via `runner/pacer_runner.py`. Driven by YAML flow contracts (`runner/flow/*.yaml`, format: `states`/`collects`/`tools`/`next`). Outputs a `PACER_RESULT_JSON` line + findings doc.
- **PlayWell** — drives a real Chromium browser. Launched, scored and displayed from this repo (`runner/dashboard/playwell_*.py`, `runner/dashboard/web/src/app/playwell*`, `runner/dashboard/web/e2e/playwell-*.spec.ts`). The browser runner itself now lives in this same repo too, at `playwell-engine/` (TypeScript) — merged in during the repo migration; previously a separate package outside this repo. Uses a flat-step YAML format (`fill`/`click`/`select`/`verify`) converted from a PACER flow. Corrected 2026-08-20 (FX-10).
- **Plotter** (renamed from "YAMLER" — the underlying files are now named `pacer_plotter.py`/`playwell_plotter.py`, matching the current name) — tooling to create/validate/repair YAML for both components. Two separate variants: `runner/pacer_plotter.py` (PACER) and `runner/dashboard/playwell_plotter.py` (PlayWell). Don't conflate them.
- **Prober** — checks a different layer, never a full conversation. Two never-averaged halves: **intent/routing testing** (does the engine send the very first message down the right path — `intent_routing_runner.py` PACER-side ground truth, `playwell_intent_check.py` browser-side, scored by `intent_scoring.py`; `run_production_intent_check.py` replays real anonymized production phrases) and **API contract testing** (deterministic HTTP checks, `runner/api_contract/` + `runner/api_runner.py`, catalog `endpoints.yaml`: 24 endpoints · 7 unauthenticated · 5 destructive · 2 streaming · 17 selected by default, pinned by `tests/unit/test_api_contract_config.py`). "Prober" is a dashboard-level name only (renamed live 2026-08-28 from "Intenter") — no file is called `prober_*.py`. Reports go to `runner/reports/api/`, never `runner/reports/`.
- **Rooter** — the front door, not a testing tool. Classifies a PACER/PlayWell/Plotter/Prober question and hands off to the right one; holds no doctrine of its own.

Full tool-by-tool detail: [docs/book-pacer-framework-guide/BOOK.md](docs/book-pacer-framework-guide/BOOK.md) (one chapter each for PACER, PlayWell, Plotter, Prober, plus a Runbook and a Test Plan chapter).

Chain: `runner/flow/*.yaml` (Plotter-authored, source of truth) → PACER runs
it directly over the API, or `playwell-engine/` converts it → PlayWell drives
it through a real browser at `https://e.fit.adpeai.com/agentic`. Both check
against Arize AX spans and the Data Bridge (`playwell_bridge_cli.py`, real
GraphQL/DSQL/CloudWatch). Prober runs independently, before or after either.


---