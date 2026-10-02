# 08 - P3 acceptance: global layer (2026-10-01)

Claude Code 2.1.197, Sonnet. Decisions: ADR-0006.

## Built

| Piece | Where | Installed by |
|---|---|---|
| Global rules (facts and non-negotiables) | `global/rules/axon.md` | `axon install` links `~/.claude/rules/axon` (never edits CLAUDE.md) |
| `lean` output style (voice and format; cheapest measured) | `plugins/axon-learn/output-styles/lean.md` | plugin; settings `outputStyle: axon-learn:lean` |
| Status line, 13 segments, one line | `global/statusline/statusline.mjs`, `lib/sources.mjs` | settings `statusLine` (`refreshInterval: 30`) |
| Personal profile: sandbox + subprocess credential scrub | `global/settings/profiles/personal.json` | `axon install --profile personal` |
| Doctor checks `statusline`, `global-rules` | `installer/doctor.mjs` | - |

Dropped: keybindings example (defaults already cover the useful actions).

## Tests

- **194/194** (`npm test`). New: `tests/statusline.test.mjs` (13), `tests/rules-install.test.mjs` (7), doctor (2),
  structure (2: output style frontmatter, statusLine script exists). The statusline, rules-install and doctor tests were run and seen failing first; the 2 structure checks were added after their files existed.
- Status line latency (`npm run bench`, 40 runs): p50 37 ms, p95 41 ms, budget 50 ms.
- Rendered output reviewed at 200/100/60 columns and in ASCII mode; review found ISS-0030 (cost dropped too early), fixed test-first:

```
payroll │ main* │ wt:feature-xyz │ Sonnet 5 high │ ▰▰▱▱▱▱▱▱ 23% │ $1.23 1h05m │ +156 -23 │ PR #1234 pending │ 5h 24% │ style:Explanatory
payroll │ main* │ Sonnet 5 high │ ▰▰▱▱▱▱▱▱ 23% │ $1.23 1h05m │ PR #1234 pending │ 5h 24%
payroll │ main* │ Sonnet 5 high │ ▰▰▱▱▱▱▱▱ 23%
```

## Live checks (real Claude)

| Check | Result | Cost |
|---|---|---|
| Symlinked user rule file in `~/.claude/rules/` loads | Answered the canary (PELICAN-42); canary removed, folder gone | $0.09 |
| Symlinked rules directory loads (what the installer creates) | Answered the canary (HERON-77); removed | $0.09 |
| Full merged personal settings accepted (not skipped) | init event `output_style: axon-learn:brief`, then rechecked after the switch: `axon-learn:lean`; empty stderr | $0.30 |
| `brief` vs default, same coding task, 2 pairs | brief cost more ($0.33/$0.22 vs $0.15/$0.19): **rejected** (cost rule) | $0.89 |
| Prompt size per style ("Say OK") | default 23,891 tokens, brief 24,414, lean 23,142 | $0.15 |
| `lean` vs default, POC task with hidden tests, 3 runs each, warm cache | lean $0.267 avg vs default $0.278; 7/7 hidden tests in all 6 runs; lean -11% output, 0 em dashes vs 4. **lean adopted** | $1.64 |
| First lean A/B (inside ~/.claude) | invalid: every edit blocked as sensitive (ISS-0031) | $1.25 |
| Sandbox (personal) | `npm test`, git: work. `ls ~/.ssh`, `touch ~/x`: Operation not permitted. curl: blocked by proxy (403) | $0.23 |

Total P3 live spend: about $4.50 (including the invalid A/B run).

## Instruction size per session

| | Files | ~tokens |
|---|---|---|
| Legacy (work Mac) | CLAUDE-ME.md + STATE-SNAPSHOT.md + FRAMEWORK-FEATURE-FLAGS.md | 5,670 |
| axon | rules/axon.md + lean style (flags injected only when used) | about 1,000 (-82%) |

## On your machine (read-only so far)

`axon doctor`: statusline renders; global rules not linked yet; settings are home-manager managed (install prints the
merged JSON). `axon install --dry-run` reports the one rules link it would create. Nothing under `~/.claude` was
changed by P3 (the two canaries were removed).

## Still open

- H-Q1 workspace trust and plugin hooks: one manual check in a real terminal (ADR-0006).
- After install, your current `~/.claude/CLAUDE.md` repeats rules now in `axon.md`; trim it in the P9 migration.
