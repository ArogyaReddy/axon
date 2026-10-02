# 09 - P4 acceptance: agent council (2026-10-01)

Claude Code 2.1.197, Sonnet. Decision record: ADR-0007.

## Built

| Piece | Where |
|---|---|
| `agent-council` skill (frame, run, verdict, save) | `plugins/axon-core/skills/agent-council/SKILL.md` |
| `council-advisor` agent (read-only, Sonnet, ADVISE and REVIEW modes, five lenses) | `plugins/axon-core/agents/council-advisor.md` |
| `axon-council` CLI (parallel rounds, anonymization, transcript, `--files`, `--slug`, `--verdict`) | `plugins/axon-core/bin/axon-council` |
| Permission `Bash(axon-council *)` | `global/settings/base.json` |

## Tests

- **208/208** (`npm test`). `tests/council.test.mjs` (12) drives the CLI with a fake `claude` binary: both rounds run
  in parallel (two 0.8 s rounds finish under 4 s, sequential would be 8 s), every call is Sonnet as `council-advisor`
  with no session saved, reviewers see no lens names and a different first answer each, the transcript is written by
  code, one retry on failure, project settings and medium effort, no tools for reviews, the stagger, `--files` as one
  identical system prompt with numbered lines and a size cap, `--slug`, `--verdict`. Each was seen failing first,
  except the skill wording checks in `tests/structure.test.mjs`, added together with the wording.

## Live (real Claude, same decision each time: H-Q3, tdd-gate default for adp-e-product)

| Run | Change | Total | Notes |
|---|---|---|---|
| 1 | skill spawns the agents | $1.70 | 10 messages with 1 agent each: sequential, 342 s |
| 2 | `axon-council` CLI | $1.71 | parallel (77 s), but nested calls loaded user settings at high effort; chairman probed for the command |
| 3 | project settings, medium effort, stagger, no review tools | $1.05 | advisors -56% |
| 4 | short framing, no probing | $1.04 | chairman -47%, but five advisors each read and cache-wrote the same files |
| 5 | `--files` as cached system prompt | $0.92 | advisors cited `path:line` with no tools |
| 6 | `--slug` computes paths | **$0.64** | 8 chairman turns, verdict in chat, transcript filled by code, ADR written |

Single-call measurements behind the cost controls: advise $0.068 -> $0.059, review $0.078 -> $0.060 (output
2,220 -> 467 tokens) with project settings and medium effort.

Total P4 live spend: about $7.40 (six councils and the single-call measurements).

## Findings logged

- ISS-0032 (open): one active task per repo; multi-domain monorepo work collides (raised by 4 of 5 advisors).
- ISS-0033 (open): no advisory (log-only) mode for tdd-gate/test-lock.

## The council's advice on H-Q3 (yours to accept)

Hybrid: run tdd-gate/test-lock in advisory (log-only) mode first to measure false blocks, fix per-domain task state
(ISS-0032), then make them blocking by default for payroll and HR. Transcript and proposed ADR were produced in the
scratch run; the decision is open in plan section 8.11 until you rule on it.
