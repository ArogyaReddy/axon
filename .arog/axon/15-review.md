# 15 - Review against the original goal (2026-10-01)

Yardstick: `my-stuff/tasks.md`, `my-stuff/start-with-me.md`, and the rules agreed during the build (lower cost and
tokens, evidence, test first then live checks, Sonnet for agents, never costlier than plain Claude Code).

## Requirement by requirement

| # | Your requirement | Status | Evidence |
|---|---|---|---|
| 1 | One platform for Claude Code and Copilot | Done for Claude Code; Copilot in VS Code: hooks live-verified, skills and agents listing is your manual check; Copilot CLI built, not run | 14-p9, 13-p8 |
| 2 | Reusable, repeatable, "copy it and use it" | Done: one repo, `axon install` does settings, rules, plugins and pinned tools; 10 s on a fresh home; profiles; uninstall and legacy restore | 14-p9 |
| 3 | Combine the five resource repos | bowser -> `axon-qa` (learn once, replay at $0); hooks-mastery -> hooks, status line, output style, settings; observability -> `axon-observe` (opt-in); postgres analytics -> the data-investigation rule in every kit (added in this review); SSSF -> "code orchestrates" in `axon-council`, `axon-qa`, `pilot-sync`; the full factory is P10 (optional, not built) | catalog, ADR-0007/0008 |
| 4 | Settings, hooks, process, agents, skills, commands, status lines, output styles, Playwright CLI and browser | All present; old commands became skills | CHEATSHEET |
| 5 | Bring in your existing `~/.claude` | 51 legacy items replaced and archived (nothing deleted); the rest kept on purpose | docs/inventory.md |
| 6 | A plan before building | Plan rev 20, ADR-0001 to ADR-0010, one acceptance record per phase | this folder |
| 7 | Fit your work (ADP ROLL / Payroll / HR, your stack, PACER family) | Kits for adp-e-product, adp-e-automation and PACER (the last two added in this review), ADP checkers, `pilot-sync`, W1-W9 workflows; **none run on the work Mac yet** | kit READMEs |
| 8 | Lower cost, fewer tokens | Each feature measured against plain Claude Code (lean style, council $1.70 -> $0.64, QA replay $0, inline skills); always-on overhead measured in this review, below | below |
| 9 | Quality, evidence, test first | 277 tests (276 + 1 skipped only inside the sandbox), 40 issues logged with root cause and verification, live checks per phase | `npm test`, docs/issues |
| 10 | Fully automatic | Hooks enforce on their own; skills load from natural requests (verified for mind maps); one-command install; `axon update` adds plugins and refreshes Copilot copies. Deliberately not automatic: the council (costs money), deleting the legacy archive, anything irreversible | below |
| 11 | Flexible | Profiles (personal, work), per-hook switches (shell, machine, project), per-project config, kits, Copilot export targets | CHEATSHEET |

## Fixed in this review

- **Tokens:** skill and agent descriptions cut from 7,907 to under 5,200 characters with the triggers kept (a test
  holds the budget); the council can only be started by you; the ADP plugin loads only on the work profile.
- **One command:** `axon install` also installs the pinned tools; `axon doctor` checks every pinned tool (markmap was
  unchecked).
- **Your work repos:** kits for adp-e-automation (lint verify, `npm start` rule, `test.json` protected, the metagen DB
  sync asks first) and PACER (CI gate as verify, flow / e2e / Python rules, live runs and destructive API flags ask
  first); a data-investigation rule in all three kits (read-only, ClientID-scoped, active rows, gate vague questions,
  only the needed tables, one corrected retry). All rules are path-scoped: no tokens unless Claude touches those files.
- **ISS-0040:** P9 said sessions run committed plugin copies. Wrong: Claude Code loads a local marketplace in place from
  the checkout. `axon update`, `doctor` and the docs are corrected; a staleness notice built on the wrong model removed.

## Measurements

Prompt tokens of one turn, no tools, Sonnet, fresh session in a throwaway repo:

| Setup | Before review | After review |
|---|---|---|
| Your full setup with axon | 30,424 | 29,236 |
| No user settings (no axon) | 24,315 | 23,915 |
| axon overhead per turn | 6.1K | 5.3K |

Where the 5.3K goes: the Claude Code sandbox text about 2.2K (the security boundary; turning the sandbox off removes
it), the global rules about 1.3K, skill and agent listings about 1.5K, hooks under 0.4K. The `lean` style saves about
0.35K. On Sonnet with caching that is about $0.002 per turn, about $0.08 for a 30-turn session; the per-feature savings
measured during the build (council, QA replays, inline skills) are larger.

Skill selection after the trim: "Make a mind map of README.md" loaded `mindmaps` first; a small bug report was handled
by the `understand` discipline inline (read the code, no defect in `sub`, asked one question, changed nothing), the
same with the old and the new descriptions; a fresh session lists every axon skill as usable except the council.

## Still open

| Item | Owner |
|---|---|
| Work Mac: install with `--profile work`, run the P6 checklist, install the three kits, confirm Bedrock | you, then me |
| H-Q1 trust check; Copilot skills and agents listing (steps in 14-p9 and 13-p8) | you (a few minutes each) |
| Decisions: the `cc` alias (ISS-0020), deleting the legacy archive, H-Q3 tdd-gate default, committing the dotfiles settings change | you |
| Upgrade the `claude` CLI to 2.1.283+ (`doctor` warning) | you |
| P10 factory (optional) | separate go-ahead |
| `council-advisor` and `qa-agent` are listed in every session though only axon's CLIs start them (about 110 tokens) | possible later trim |

Review spend: about $5 in live runs (several were repeated because runs nested in this session's sandbox were invalid).
