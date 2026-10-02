---
name: ui-acceptance
description: Acceptance-test a web app with user stories in real browsers - stories in .axon/user_stories/*.yaml, run in parallel by axon-qa, PASS/FAIL with a screenshot per step. The qa-agent learns each story once; later runs replay it by code at no model cost. Use for "test the UI", "run the user stories", "check this flow works", acceptance or regression checks of a web page.
argument-hint: "[filter] [headed] [no-relearn]"
---

# UI acceptance (stories > axon-qa > evidence)

## Stories

`<repo>/.axon/user_stories/<area>.yaml`, one file per area:

```yaml
stories:
  - name: "Sign in shows the dashboard"
    url: "https://app.example.test/login"
    auth: fit-qa-user            # optional: saved login in ~/.axon/secrets/playwright/<name>.json
    workflow: |
      Fill email with "qa@example.test" and password with the test password
      Click Sign in
      Verify the page shows "Dashboard"
```

Each step is one action or one check, with the exact text or value that proves it. A story never contains real
passwords: use `auth` with a saved login (below).

## Run

```
axon-qa run [--filter <file text>] [--parallel 4] [--headed] [--no-relearn]
```

Run `axon-qa run` first: no `curl`, `ls`, `find` or reading the story files beforehand. axon-qa finds the stories
itself and reports an unreachable app, a missing login or a bad story file as a FAIL with the reason, without
starting an agent.

- A story whose text is unchanged and has a replay in `.axon/user_stories/.replay/` runs by code, with no model call.
- Otherwise the `qa-agent` runs it once in a browser session axon-qa opens; on PASS its replay is checked by code and
  saved. Commit `.replay/` with the stories so the team shares them.
- A replay that fails is re-learned once (the app may have changed); `--no-relearn` reports the failure instead (CI).
- Report: the table printed at the end and `report.md` in `~/.claude/docs/qa/app-tests/<run>/`, with a screenshot per
  step, `console.txt` on failure, and the agent's `result.json`.

## After a run

Post the printed table and the cost line as they are; the Detail column already carries the agent's evidence (what
it expected, what the page showed). Then stop and offer, without doing it: open a failing step's screenshot, log the
FAILs with `issue-tracker`, or rerun one file `--headed`. Never edit a story, a replay or a check to make it pass.

## Saved logins (once per environment and user)

```
playwright-cli -s=login open <login url> --headed      # log in by hand in the window
playwright-cli -s=login state-save ~/.axon/secrets/playwright/<name>.json
playwright-cli -s=login close && chmod 600 ~/.axon/secrets/playwright/<name>.json
```

Login state files are secrets: never commit, paste or upload them. Test accounts only, never production or personal
credentials.
