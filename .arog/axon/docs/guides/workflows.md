# axon workflows (W1-W9)

Each workflow: when to use it, the steps, what you get, and how far it has been verified. "Work Mac" means it needs
ADP repositories or tools that are not on the personal Mac; those steps are built but not yet run end to end.

## W1 - Fix a bug (from Trac or a report)

1. `/axon-core:prime` - context, last handoff, open issues.
2. `/axon-core:understand trac:NNNN` (or the bug text) - reads the real code, reproduces the bug end to end (for UI bugs
   with `/axon-qa:ui-acceptance` or `playwright-cli`), proves the root cause, writes the plan, waits for your GO.
3. `/axon-core:tdd` - RED: a failing test that reproduces the bug, shown to you; the `tdd-gate` hook blocks source edits
   until a failing run is recorded. GREEN: the fix; `test-lock` blocks test edits. VERIFY: `axon-verify`.
4. `/axon-core:git-push` - verify, the `reviewer` agent, a commit message with the evidence; asks before pushing.

You get: a reproduction test, the run evidence, a review report, an honest commit. Verified: each step live on this Mac
(P1b, P2 acceptance records); the ADP-specific checks run on the work Mac.

## W2 - New canonical event (adp-e-product)

ADP event-spec tools -> `/axon-core:tdd` (hooks enforce RED > GREEN; `verify` runs the `check-*` checkers; `verifier`
checks the acceptance criteria) -> `make` and meta checks -> `reviewer`. Work Mac; checklist in `11-p6-delivered.md`.

## W3 - Acceptance QA on an environment

1. Write stories in `<repo>/.axon/user_stories/*.yaml` (name, url, auth, workflow steps in plain words).
2. `/axon-qa:ui-acceptance` (add `headed` to watch). `axon-qa` runs the stories in parallel browsers: a story is learned
   once by the `qa-agent`, then replayed by code at $0; a failing replay is re-learned once.
3. Read the report in `~/.axon/docs/qa/app-tests/<run>/report.md` (screenshots per step).

Logins: save a session once with `playwright-cli state-save ~/.axon/secrets/playwright/<name>.json` (steps in the skill).
Verified live (P5): learn $0.28, replay run $0.03, self-heal $0.09. ADP Cognito login: work Mac.

## W4 - Conversation engine testing

Your existing tools (Rooter, PACER, PlayWell, Plotter, Prober) run as before; `axon dashboard` (with `axon-observe` on)
shows the Claude sessions around them. Work Mac.

## W5 - Data or production investigation

Read-only by default: ADP `db-connect`, the PACER data bridge, `aws logs` through the approved profile. axon blocks PROD
profiles (`* --profile PROD*`) and asks before every `aws` command. Work Mac.

## W6 - Learn and explain

`/axon-learn:wh-explainer`, `code-mentor`, `mindmaps`, `explain-changes`, `codebase-to-course`, `interactive-book`,
`interactive-session`; `/axon-core:agent-council` for a decision. All run in your session (no agent hand-off) except the
council (five parallel advisors). Verified live (P4, P7): mind map $0.38-0.45, council $0.64.

## W7 - Extend axon

1. Check the catalog (`03-component-catalog.md`) so nothing is duplicated.
2. Add the skill, hook or command in its plugin, with a test in `tests/` that fails first.
3. `npm test`, `claude plugin validate .`, commit. Work on a branch or worktree: sessions load axon from the checkout,
   so the next session runs whatever is there. `axon update` only when you added a plugin or use the Copilot export.

Rules: skills run inline; steps that must happen are code (hooks or CLIs); agents only for parallel or independent
work, on Sonnet; no feature may cost more than plain Claude Code (measure it).

## W8 - Parallel work

One task per session, each in its own worktree: `claude --worktree <name>`. axon keeps task state per repository
folder, so each worktree has its own task and phase; two sessions in the same folder would share one task, so do not
do that. `axon dashboard` shows the sessions side by side.

## W9 - Daily ritual

Open a session: the `session-brief` hook states branch, last commit, uncommitted files and the active task. Run
`/axon-core:prime` when you need the full context. The status line shows repo, branch, task phase, model and effort,
context use and cost. End with `/axon-core:handoff`. Weekly: `axon doctor`; after a `git pull` of axon: `axon update`.
