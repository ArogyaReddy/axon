# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

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

## Engine selection

| Engine                                 | Flag                | Status                                                                                           |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| AG-UI (`agent/chat`, SSE, AWS Strands) | `--engine agui`     | **Required for `worker.hire`.** Confirmed correct via DevTools 2026-08-12. Default as of v0.2.0. |
| conv-api/v1                            | `--engine conv-api` | Legacy/fallback only. Unverified for all canonicals since AG-UI discovery.                       |

## Skills & agents catalog

Real slash-commands in `skills/<name>/SKILL.md` (+ matching `agents/*.md`),
same inventory as [AGENTS.md](AGENTS.md#skills--agents-catalog--this-repos-shipped-product):

- **PACER**: `pacer` (run/score/verify/triage doctrine), `pacer-run` (drives a
  canonical end-to-end by hand-reasoning), `pacer-setup` (pre-flight: import
  YAML, check test-data, dry-run)
- **PlayWell**: `playwell` (Playwright authoring/review doctrine),
  `playwell-run` (drives a canonical through the real browser UI, inline),
  `playwell-setup` (same pre-flight pipeline, PlayWell side)
- **Plotter**: `plotter` (YAML authoring/validation/repair CLI wrapper),
  `plotter-setup` / `plotter-run` (same pre-flight pipeline, two more aliases)
- **Prober**: `prober` (intent-routing + API-contract doctrine), `prompter`
  (generates intent-routing test phrases)
- **Front door**: `rooter` (classifies a PACER/PlayWell/Plotter/Prober
  question, hands off to the right one)
- **Arize / reporting**: `agentic-conversation-test` /
  `ar-agentic-conversation-test`, `agentic-arize-trace`,
  `agentic-arize-evaluator`, `agentic-arize-annotation`, `ar-agentic-report`,
  `ar-agentic-prompt-bank`, `ar-agentic-testing`, `ar-connect-dots`
- **QA automation**: `automation-agent`, `reproduce-agent`, `qa-judge-proof`

## Commands

### Python engine (run from `runner/`)

```bash
source .venv/bin/activate

# Run a live conversation
python pacer_runner.py worker.hire --mode positive --engine agui --scenario WH-001

# Interactive runner (menu-driven)
python run_real.py

# Check which scenarios are runnable
python testdata_loader.py --check

# YAML validator
python yaml_validator.py worker.hire

# Coverage advisor (advisory, non-blocking)
python coverage_advisor.py worker.hire
```

### Tests

```bash
# Python unit tests (offline, no creds needed)
cd runner && python -m pytest tests/unit/ -q

# Python integration tests (live FIT + Arize, ~14 min)
cd runner && python -m pytest tests/integration/ -q -m integration -s

# Next.js unit tests (pure lib functions only — lib/*.ts)
cd runner/dashboard/web && npm run test

# Next.js e2e tests (Playwright, requires `npm run dev` running on :3001)
cd runner/dashboard/web && npm run test:e2e

# Local CI gate (same 3 checks as GitHub Actions + Jenkinsfile.smoke)
bash runner/scripts/ci-check.sh
```

### API contract tests (run from `runner/`)

```bash
source .venv/bin/activate

python api_runner.py --list                     # 24 endpoints in catalog · 17 selected
python api_runner.py --unauthenticated-only     # the 7 needing no credentials at all
python api_runner.py --all                      # the default 17, live against FIT
python api_runner.py --category graph-devtools  # one slice
python api_runner.py --id health.get            # one endpoint
python api_runner.py --sweep                    # clean up after a crashed run

# Offline unit coverage
python -m pytest tests/unit/test_api_contract_config.py tests/unit/test_api_contract_assertions.py \
  tests/unit/test_api_contract_fixtures.py tests/unit/test_api_contract_auth.py \
  tests/unit/test_sse_invariants.py tests/unit/test_api_runner_cli.py \
  tests/unit/test_api_contract_provenance.py tests/unit/test_api_contract_dashboard.py -q

# Live coverage
python -m pytest tests/integration/test_api_contract_live.py -q -m integration -s
```

**5 endpoints write to shared storage and 2 spend real model money. All 7 are OFF
by default.** A write additionally needs `global.destructive_operations` on, a
`PACER_<runid>_` name prefix, and a ledger entry written before the call. The
delete guard only ever matches `^PACER_[0-9a-f]{8}[_.]` and is code, not
configuration — no flag can switch it off.

### Feature flags

```bash
cd runner
python pacer_flags.py list                              # all 19 flags, value + layer
python pacer_flags.py explain api.include_streaming     # which layer supplied it
python pacer_flags.py set api.include_streaming true    # writes runner/flags.local.yaml
python pacer_flags.py set api.include_destructive true --yes   # dangerous needs --yes
python pacer_flags.py reset --all
```

Committed defaults: `runner/flags.yaml`. Machine-local overrides:
`runner/flags.local.yaml` (gitignored). Dashboard equivalent: `/flags`.

### Dashboard

```bash
# Start both Python API (port 8766) + Next.js UI (port 3001) together
./runner/pacer.sh

# Run a canonical from anywhere via pacer.sh
./runner/pacer.sh run worker.hire --mode positive --engine agui

# Start dashboard only (if you already have the Python API running)
cd runner/dashboard/web && npm run dev
```

### Next.js dashboard (from `runner/dashboard/web/`)

```bash
npm run lint
npm run build
```

## Architecture

### Python engine (`runner/`)

- `pacer_runner.py` — CLI entry point. Orchestrates a run: calls `run_real.run_conversation()`, emits `PACER_RESULT_JSON` to stdout, then writes a findings doc via `findings.py`.
- `run_real.py` — interactive CLI wrapper; also `run_conversation()` which is the actual conversation execution function.
- `yaml_oracle.py` — reads `runner/flow/*.yaml` to return expected fields/tools for a canonical. These are PACER's local assertion model — **not** FIT engine config. Never update YAML to paper over a real engine bug.
- `scenario_loader.py` / `testdata_loader.py` — resolve scenario JSON from `runner/datasets/*.scenarios.json`.
- `arize_span_reader.py` / `span_assertions.py` — fetch and assert Arize tool-call spans post-run.
- `agui_client.py` / `agui_turn_runner.py` — AG-UI (SSE) transport for the `--engine agui` path.
- `real_engine_client.py` — conv-api/v1 transport.
- `findings.py` — writes structured finding docs; `load_regression_history` / `save_regression_history`.

### Plotter (`runner/`)

- `pacer_plotter.py` — CLI entry point (14 subcommands: import/inspect/audit/validate/repair/generate/export/...).
- `plotter_scorer.py` — the 0-100 quality scorer; `plotter_rules.py` — the ported product verifier rules.
- `plotter_repairer.py` / `plotter_drift_checker.py` / `plotter_generator.py` / `plotter_navigator.py` / `plotter_advisor.py` / `plotter_survey.py` — repair, drift-check, generation, and advisory helpers.

### Prober (`runner/`)

- `intent_routing_runner.py` — PACER-side ground truth for intent/routing: one real HTTP call, reads which of 3 real tools actually fired.
- `playwell_intent_check.py` — PlayWell-side check: a real browser, matches the visible reply against known canonical fingerprints.
- `intent_scoring.py` — scores both sides' results; never blends them into one number.
- `run_production_intent_check.py` — replays real, anonymized production phrases through the same routing checker.
- `runner/api_contract/` — the API-contract half: `endpoints.yaml` (the 24-endpoint catalog), `executor.py`, `assertions.py`, `provenance.py`, `ledger.py`, `prompt_drift.py`, `sse_invariants.py`. CLI is `api_runner.py`.
- `canonical_name_check.py` / `flow_preflight.py` — companion diagnostics, not part of either main pipeline.

### Dashboard (`runner/dashboard/`)

- `server.py` — stdlib-only HTTP server on `127.0.0.1:8766`. No web framework. Routes documented in the file's module docstring.
- Module files (`overview.py`, `catalog.py`, `health.py`, `report_loader.py`, `run_launcher.py`, `agent_bridge.py`, etc.) each own one API domain.
- **Does not hot-reload.** After editing any `dashboard/*.py`, kill and restart the process.

### Next.js dashboard (`runner/dashboard/web/`)

- Talks to the Python API at `http://127.0.0.1:8766` through `src/lib/api.ts`.
- `npm run test` (vitest) covers only pure functions in `lib/*.ts`. UI behavior is tested exclusively via Playwright e2e specs in `e2e/*.spec.ts`.
- Uses `@tanstack/react-query`, `@tremor/react`, shadcn/ui, Tailwind v4.
- **Next.js 16 is in use** — APIs may differ from your training data. Check `node_modules/next/dist/docs/` before writing Next.js-specific code.

## Credentials

All credentials live in `runner/.env` (loaded automatically by `python-dotenv` at process start):

- `AGENTIC_TEST_USERNAME` / `AGENTIC_TEST_PASSWORD` — FIT login
- `ADP_GATEWAY_CLIENT_SECRET`, `AI_CLIENT_ID`, `AI_TOKEN_URL`, `AI_SCOPE`, `AI_GATEWAY_URL` — ADP AI Gateway (Bedrock Converse API, not Anthropic Messages API)
- `ARIZE_*` — Arize span verification keys

## Conventions

- **Never add a new file directly at the bare repo root.** Every new script,
  test, or generated file goes into the folder that matches what it is
  (`scripts/` for operational scripts, `docs/` for documents, a domain
  folder for domain code, etc.) — root stays reserved for the small set of
  conventional entry files every repo already has (README, AGENTS.md,
  CLAUDE.md, `.gitignore`, `install.sh`, `Jenkinsfile.smoke`). Confirmed
  precedent: `doctor.sh`/`doctor.test.js` used to sit loose at root and were
  moved into `scripts/` for exactly this reason (2026-09-16) — check for an
  existing matching folder before creating a new one.

## Critical pitfalls

- **Never run a second terminal command while a live PACER run or `npm run flow` is in progress** — commands can land in the same shared terminal and SIGINT the running one.
- `server.py` (port 8766) does not hot-reload. Always restart after editing any `dashboard/*.py` file.
- `getByRole`/`getByText` in Playwright e2e specs must use `{ exact: true }` — substring matching has produced false-pass tests here before.
- Never pass `shell=True` or unvalidated user input to `subprocess` — follow the `shell=False` + regex-allowlist pattern in `playwell_plotter.py`.
- The `skills/` and `agents/` directories contain this repo's **shipped product** (slash-command wrappers for Claude Code / Copilot). They are not instructions for developing this repo itself.
- `runner/flow/*.yaml` files are PACER's local assertion model. If expected tools don't match a real FIT run, investigate whether the YAML is wrong (wrong assertion) or the engine has a bug — never update YAML to hide a real engine bug.

<!-- AR-VERIFY-FIX:START -->

## Evidence-gated verification

Read `.arog/WORKFLOW.md` before investigating or modifying code. Use `.arog/bin/ar-start`, `.arog/bin/ar-check`, and `.arog/bin/ar-complete` (`.cmd` variants on Windows). Never claim a verified finding or fix when the gate reports NOT VERIFIED or BLOCKED.

<!-- AR-VERIFY-FIX:END -->
