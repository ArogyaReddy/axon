# adp-e-automation project kit

Installed with `axon install --project <path to adp-e-automation> --kit adp-e-automation`. Existing files are never
overwritten; the command lists what it skipped.

| File | Purpose |
|---|---|
| `.axon/config.json` | `axon-verify` runs `npm run lint`; reminders for metagen (shared DB sync) and intents; `test.json` (written by `run.sh`) protected |
| `.claude/rules/tests.md` | loads when Claude works on tests, test data, page objects or controllers: `npm start` only, findNextQuestion with intent keys, loadJSON pattern, standards |
| `.claude/rules/data.md` | loads when Claude works on utils, queries or metagen: read-only, ClientID-scoped, active rows, gate, retry once |
| `.claude/settings.local.json` | your local permissions for this repo (not committed): the metagen DB sync and test runs ask first; the dry run and lint are allowed |

Playwright runs stay with the repo's own `run.sh` (`npm start`); axon's `ui-acceptance` is for acceptance stories, not
for replacing this suite.

Built from the repo's CLAUDE.md on 2026-10-01; not yet run against a real checkout (work Mac).
