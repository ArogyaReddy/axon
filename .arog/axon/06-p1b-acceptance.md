# 06 - P1b acceptance: core skills, live (2026-10-01)

One live run per skill family, with real Claude (Sonnet), the `axon-core` and `axon-guard` plugins loaded, and the **real axon
permission rules** generated from `global/settings/base.json` (docs paths pointed at a scratch folder).

| Family | Skill(s) | Result | Cost |
|---|---|---|---|
| Planning | `understand` | First run: no plan, the template inside the plugin folder could not be read (ISS-0025). After `axon-plan-new`: complete 11-section plan, `axon-plan-check` OK, correct root cause and hand-checked acceptance values. The prompt asked for sections 1-4 only; Claude reported "The Stop hook required the full 11-section doc, so I completed sections 5-11" | $0.34 + $0.88 |
| Delivery | `git-push` + `reviewer` | Reviewer found two genuine edge cases (non-string code throws TypeError; negative-amount rounding). First run polluted the real docs folder (ISS-0026) and could not read docs files (ISS-0027). Rerun with real permissions: `axon-verify` PASS, review done, issue logged in scratch; the commit stopped for user approval as designed (`git commit` is in `ask`) | $0.88 + $0.98 |
| Session | `handoff` then `prime` (fresh session) | Handoff: all six sections + journal line; staged work left untouched. Prime: reconciled with git (no divergence), surfaced the open issue, flagged money, proposed one next action. Handoff closed a money issue as wont-fix on its own (ISS-0028): closing now needs the user's approval (verified live) | $0.43 + $0.16 |

Not live-tested in P1b (and why): `plan-feature` shares the planning machinery proven by `understand`; `plan-track` and
`go-until-done` reuse the `axon-task` gates proven in P1. Still to observe in a real interactive session (P2): an approved commit's
message has no co-author line (backed by the `attribution` setting proven accepted in ADR-0003 and the skill rule).

Findings fixed during P1b: ISS-0025, ISS-0026, ISS-0027, ISS-0028 (each with a failing test first and a live rerun).
