---
name: plan-track
description: Feature > Story > Task tracker so a multi-story plan never drifts, stories routed to tdd. Use to create a tracker, for "where are we / what's next" on a feature, or when work drifts.
argument-hint: "new <feature> | status | story <description> | update"
---

# Plan track (anti-drift)

The failure this prevents: a plan is written, execution starts, an issue becomes the focus, the plan is lost, and at the end
nobody knows which story is done. Fix: the plan is a living file, every finding is logged against a story, every task has
provable done criteria.

## Files

`~/.claude/docs/plans/<feature-slug>/` (or `$AXON_PLANS_DIR/<feature-slug>/`):
- `BOOK.md`: knowledge index (chapters first), then a link to PLAN.md and to the feature's issues.
- `PLAN.md`: feature header, story dashboard, one section per story with its task table.
- Findings are **issues**: `axon-issue new "<title>" ... --feature <feature-slug>`; `axon-issue list --feature <feature-slug>`
  shows them. There is no separate FINDINGS file.

## Mandatory fields

FEATURE and every STORY: a table with WHAT (one sentence), WHY (business or technical reason), WHERE (files, systems,
environments), HOW (approach, tools, commands), ACCEPTANCE (provable: exact output, file or test), STATUS
(Planned / In progress / Done / Partial / Blocked -> ISS-id).

TASK rows: `| T<story>.<n> | What | How (exact command or step) | Expected | Done when (provable) | Status | Evidence |`

Story types: `implementation` (route to `tdd` with the story's acceptance criteria), `investigation`, `documentation`,
`integration` (run inline; UI flows through `ui-acceptance`).

## Commands

| Command | Do |
|---|---|
| `new <feature>` | read the related code and plan doc, create BOOK.md and PLAN.md with all stories and tasks, show the dashboard, wait for GO |
| `status` | read PLAN.md, git log and the feature's issues; show the dashboard, the current story and task, blockers; propose the next task |
| `story <description>` | add a story with all six fields and its tasks |
| `update` | after work: mark tasks done ONLY with evidence (command output, test name, commit); set story status; link new issues |

Rules: a task is Done only with evidence in its row; a blocked task names its ISS-id; never delete a story, mark it Dropped
with the reason; re-read PLAN.md before choosing the next task, every time.
