# adp-e-agentic-automation (PACER)

**New here?** Run `./install.sh`, then read [INSTALL.md](INSTALL.md).

Test the ADP e-conversation-engine with real multi-turn conversations — scenario-driven scoring, Arize tool-call span verification, and structured findings — packaged as slash-command skills for both **Claude Code** and **GitHub Copilot**.

**Confirmed backend for `worker.hire`:** `agent/chat` (AG-UI / SSE / AWS Strands). Use `--engine agui`. The old `conv-api/v1` backend is the default for the other 11 canonicals but has not been re-verified against the right backend since the AG-UI discovery.

See [docs/README.md](docs/README.md) for the quick-start (clone → install deps → first test run).

## What this framework actually is

Four tools test the same conversation engine four different ways, plus one front door:

- **Pacer** — talks to the engine directly over the API, no browser (this repo's own `pacer_runner.py`)
- **PlayWell** — drives a real Chromium browser through the same conversation, proving the whole product, not just the API
- **Plotter** — authors, scores, and repairs the YAML "flow contract" that Pacer and PlayWell both run against
- **Prober** — checks the engine's very first response and its raw HTTP surface, independent of a full conversation
- **Rooter** — the front door; routes a question to whichever of the four actually owns it

Full picture, with a diagram of how they connect: [docs/book-pacer-framework-guide/BOOK.md](docs/book-pacer-framework-guide/BOOK.md).

## Ownership

Owned by `gadea` (Arogya Gade) and `patelni` (Nilesh Patel) — see [.bitbucket/CODEOWNERS](.bitbucket/CODEOWNERS).

## Quick start

See [docs/README.md](docs/README.md#first-test-run) — the one real copy of
the setup and run commands, kept current there instead of duplicated here.

## Engine Selection

| Engine                                 | Flag                | When to use                                                                                                                                                                            |
| -------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG-UI (`agent/chat`, SSE, AWS Strands) | `--engine agui`     | **Required for `worker.hire`. Recommended for all canonicals.** Confirmed correct backend 2026-08-12 via DevTools capture.                                                             |
| conv-api/v1                            | `--engine conv-api` | **Legacy/fallback only.** Has not been verified against the right backend since the AG-UI discovery. Do not use for new runs unless agui is confirmed broken for a specific canonical. |

**Default if `--engine` is omitted:** `agui` (as of v0.2.0). A new team member running any canonical without specifying `--engine` will get AG-UI, which is correct.

## What's confirmed working today

- `worker.hire` first real E2E completion: `conv_id=8bfbb864`, 2026-08-12, via `--engine agui`
- 4/5 test modes (positive/negative/adversarial/mixed) confirmed on worker.hire via agui
- 54/60 worker.hire scenarios runnable (6 blocked on missing FIT rehire/position IDs)
- 479 unit tests passing

## What's open

- OI-2 (`policySearch_associateBusinessPolicies` missing at `collectCompensation`) — still UNCONFIRMED on the real AG-UI backend; no run has reached that state with valid FIT data yet
- 11 of 12 canonicals have zero scenario coverage and an unverified backend

## Layout

| Folder                       | What it is                                                      |
| ---------------------------- | --------------------------------------------------------------- |
| `runner/`                    | Python engine — `pacer_runner.py` is the CLI entry point        |
| `runner/datasets/`           | Scenario JSON files (60 for `worker.hire`, stubs for 11 others) |
| `runner/dashboard/`          | HTML report generator + comparison dashboard server             |
| `skills/`                    | Slash-command wrappers for Claude Code / Copilot                |
| `agents/`                    | Companion agents — isolated context, do the actual work         |
| `.claude-plugin/plugin.json` | Plugin manifest                                                 |

## Coding-agent tracing

GitHub Copilot sessions working in this repo are traced to Arize AX (project
`agentic-toolkit-copilot`). Hooks live in `.github/hooks/hooks.json`; confirmed
registered via `./install.sh status`. A real span from a live Copilot session
in this exact workspace has not been confirmed yet — that needs a session
opened directly on this folder, not a session working on it from elsewhere.

## Origin

Packaged from the personal `real-engine-runner` project. The original design-rationale history is internal project history and is not included in this repo.
