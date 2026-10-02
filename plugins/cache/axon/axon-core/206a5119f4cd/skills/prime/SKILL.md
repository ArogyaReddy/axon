---
name: prime
description: Load project context at the start or after a gap - rules, last handoff checked against git, active task and plan, open issues - and propose one next action. Use when starting, resuming, or "where are we".
---

# Prime (load context, reconcile, propose)

Read real files; never rely on memory of earlier sessions.

1. **Rules:** the project `CLAUDE.md` and any `.claude/rules/` files that apply.
2. **Handoff:** `SESSION-HANDOFF.md` in full if it exists (it is written by `handoff`).
3. **Git reality:** `git status`, `git log --oneline -5`, current branch. Reconcile with the handoff: does the branch match,
   does the last commit match, are there uncommitted changes the handoff does not mention? Flag every divergence first.
   A stale handoff silently trusted is worse than none.
4. **Active work:** `axon-task status` (phase and evidence of any active TDD task); the most recent plan doc in
   `~/.claude/docs/plans/` for this project; `plan-track` PLAN.md if one exists for the feature.
5. **Known problems:** `axon-issue list --status open` (and `in-progress`); mention critical and high ones by id.
6. **Report in plain language, short:** where the project stands, what was verified last time and how, what is in progress,
   open critical/high issues.
7. **Propose ONE next action**: the first item blocked on the user if any, otherwise the top next item, with its size
   (small/medium/large) and whether it touches money, data or security. Wait for the user's choice; the handoff is context,
   not a mandate.
