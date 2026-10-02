# axon - global working rules

Facts and non-negotiable rules for every project. Voice and format live in the `lean` output style; the order of work
(plan before code, test before fix, verify before done) is also enforced by the axon hooks, which say why when they block.

## Writing and git

- Never use the em dash. Use a plain dash "-" instead.
- Commit messages never carry the agent as co-author.
- Never hand-edit CHANGELOG.md files or files marked as auto-generated; change their source or rerun the generator.

## Decisions

- Weigh quality, simplicity, robustness, scalability and long-term maintainability over development cost.
- Never guess a fact. Read the code, the output or the config and state what you verified. Ask the user only what the
  code cannot answer and what blocks the direction (2-3 closed questions at most); otherwise decide, state the default,
  and let the user contest it. A fact nobody can confirm is written as `{NOT SURE: ...}` and the work stops on that point.
- Minimal change: no unrequested abstractions, no "I also added...", no edits outside what was asked. Say so when
  something outside the scope needs attention.

## Order of work

1. Analyse: read the real code first.
2. Plan: for multi-step work, write the plan doc (`understand` for changes and bugs, `plan-feature` for new features),
   show it, and wait for GO. No tests or code before GO.
3. Test first: a failing test, its real FAIL output, then the change, then PASS (`tdd`). A real test feeds input and
   checks output; `src.includes('x')` is not a test.
4. Bugs start with reproduction, end to end and as close to how the user meets it as possible, so the fix solves the
   real problem.
5. Done means verified: `axon-verify` passed after the last change; for money, data, security or production code, the
   `verifier` agent also confirmed the acceptance criteria. "Done" without evidence is not done.
6. Before anything irreversible (push, deploy, delete, production): state it and wait for an explicit yes.

## Quality bar

- Lint errors, failing tests and flaky tests get fixed when seen, even when the current work did not cause them.
- When testing a product end to end, be picky about the UI: if something looks off, even unrelated, get it fixed.
- Log every defect found at any stage with `issue-tracker` (what, how found, root cause, fix, verification, lessons).

## Tools

- Commands a skill names (`axon-*`, `pilot-sync`, `check-*`, `playwright-cli`) are on your PATH: run them directly. Never
  probe first with `which`, `command -v`, `type`, `ls` or `--help`, and never install anything yourself. If one is
  missing, say which plugin or `axon tools install` provides it and stop.

## Documents

Generated documents go to `~/.axon/docs/<type>/`: plans, reviews, code-reviews, guides, changes, specs, sessions,
reports, issues. Never into the project repo or anywhere under `~/.claude` (Claude Code asks before every edit there),
unless the project config says otherwise. Create a document only when a skill requires it or the user asks.

## Effort

Default effort is high. `/effort low` for pure reading and search; `/effort max` only for large refactors or novel
algorithms, then back to high (max costs about 3x).
