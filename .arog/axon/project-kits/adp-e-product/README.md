# adp-e-product project kit

Installed with `axon install --project <path to adp-e-product> --kit adp-e-product`. Existing files are never
overwritten; the command lists what it skipped.

| File | Purpose |
|---|---|
| `.axon/config.json` | `axon-verify` runs the ADP checkers and the domain tsc/tests; post-edit reminders for meta and shared; `meta/build` protected |
| `.claude/rules/*.md` | path-scoped rules: they load only when Claude works on events, i18n, meta, shared, tests or data (`data.md`: read-only, ClientID-scoped, active rows, gate, retry once) |
| `git-hooks/pre-commit`, `pre-push` | copied into `.git/hooks/` (local, not committed): ADP checkers before commit, domain checks before push |

Committing `.axon/` and `.claude/rules/` shares them with the team (their Claude sessions load the rules too); that is
your call per repo. If `.axon/config.json` already exists it is skipped: merge the `verify`, `reminders` and `protected`
blocks by hand. To make the checkers compare against the PILOT branch instead of HEAD, add
`"adp": { "base": "origin/<pilot branch>" }`.

Checkers (axon-adp, on Claude's PATH): `check-i18n`, `check-lifecycle`, `check-security-fields`,
`check-shared-imports`, `check-meta-fresh`, `adp-domain-check`. Each checks the files changed against `--base <ref>`
(default: uncommitted work against HEAD); `--all` checks every tracked file.

Not yet set, waiting on decisions or facts from the work Mac:
- `tdd-gate`/`test-lock` default for this repo (H-Q3; the council advised an advisory mode first: ISS-0032, ISS-0033).
- `.worktreeinclude` (which gitignored files a worktree build needs).
- FIT saved login for `ui-acceptance`: save once with `playwright-cli state-save ~/.axon/secrets/playwright/fit-<user>.json`
  after logging in by hand (see the ui-acceptance skill).
- Verified on a real checkout: none of the checkers or `pilot-sync` has been run against adp-e-product yet.
