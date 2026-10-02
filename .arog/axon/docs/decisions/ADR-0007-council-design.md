# ADR-0007: Agent council - code runs the rounds, the session judges

Date: 2026-10-01. Status: accepted. Evidence: `09-p4-acceptance.md` (six live councils on the same question).

## Context

The legacy council made 11 model calls (5 advisors, 5 reviewers, a chairman agent) plus a model-written HTML report.
The first axon version (skill spawns `council-advisor` five times "in one message") cost $1.70 and took 342 s: the
model spawned the ten agents one at a time, so later prompts were written after earlier answers had been read, and
the main session paid about 20 turns of a growing context.

## Decision

1. **Names:** skill `agent-council` (the council), agent `council-advisor` (one seat; spawned five times). Decided with
   the user: a shared name would invite spawning one advisor and calling it the council.
2. **`axon-council` CLI runs both rounds** as parallel `claude -p --agent axon-core:council-advisor` processes:
   parallelism and independence are guaranteed by code, letters are random, each reviewer sees a rotated order, and the
   transcript is written by code (no tokens spent re-typing ten answers).
3. **Cost controls, each measured:** nested calls use project settings only and `effortLevel: medium` (advise -13%,
   review -23%); reviews run without tools; `--files` are read once and sent as the system prompt, which is cached, and
   each round starts one call 4 s before the other four so they read that cache instead of each writing it.
4. **The session is the chairman** and does only what needs judgment: frame (under 1,500 characters, files listed not
   quoted, at most one read), verdict, ADR. `axon-council --slug` works out paths and dates, `--verdict` fills the
   transcript, so the chairman needs no probing, Read or Edit.
5. **No HTML report** (output tokens for a page; the verdict, transcript and ADR carry the content).
6. The peer review round stays: in the live runs it caught a factual error in one advisor's argument and surfaced
   points no advisor raised (shadow mode, exit metrics).

## Results (same question, six runs)

| Run | Design | Advisors+reviews | Chairman | Total | Wall (council) |
|---|---|---|---|---|---|
| 1 | skill spawns agents | - | - | $1.70 | 342 s |
| 2 | axon-council | $0.97 | $0.74 | $1.71 | 77 s |
| 3 | + project settings, medium effort, stagger, no review tools | $0.43 | $0.62 | $1.05 | 38 s |
| 4 | + short framing, no probing | $0.71 | $0.33 | $1.04 | 50 s |
| 5 | + `--files` as cached system prompt | $0.43 | $0.49 | $0.92 | 47 s |
| 6 | + `--slug` (paths in code) | $0.31 | $0.33 | **$0.64 (-62%)** | 37 s |

## Open

- Nested `claude -p` with `--setting-sources project` relies on settings `env` (Bedrock at work) reaching the call
  through the process environment `{NOT SURE: verify on the work Mac}`.
- `--plugin-dir` is passed even when axon-core is installed from the marketplace; check for a duplicate-plugin warning
  at install time (P9).
