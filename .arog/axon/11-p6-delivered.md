# 11 - P6 delivered: ADP layer (2026-10-01) - NOT YET VERIFIED

Built on the personal Mac, where adp-e-product does not exist. By your decision, no new tests and no live runs for
P6; the existing 223 tests still pass (nothing else broke). Everything below is unverified against the real repo
until the checklist at the end is done on the work Mac.

## Built

| Piece | Where | Based on |
|---|---|---|
| `check-i18n` | `plugins/axon-adp/bin/` | platform patterns 2 and 11: translate() keys exist in en and es; en/es key parity |
| `check-lifecycle` | same | patterns 1 and 4: lifecycle definition order; UUIDs only in setOutput() |
| `check-security-fields` | same | pattern 3 (IFX-004): ClientID/EventID/VersionNumber not from input (heuristic) |
| `check-shared-imports` | same | pattern 12 (IFX-001): src/shared imports listed in the root package.json |
| `check-meta-fresh` | same | pattern 13 (IFX-002): meta/build newer than changed meta/src |
| `adp-domain-check` | same | pattern 8: tsc + `TEST_BUSINESS_DOMAIN=<d> npx jest` for changed domains |
| `pilot-sync` | same | legacy ar-git-pilot-feature-changes (commands, make flags, gotchas); never pushes |
| `git-pilot-feature-changes` skill | `plugins/axon-adp/skills/` | legacy skill; conflicts decided by the session, push via git-push |
| adp-e-product kit | `project-kits/adp-e-product/` | path-scoped rules, verify commands, reminders, protected meta/build, local git hooks |
| `axon install --project <repo> --kit <name>` | `installer/kit.mjs`, `bin/axon` | never overwrites; hooks into `.git/hooks/` |

Changed or dropped from the plan:
- The legacy pre-commit's guards (`ar-compile-guard`, `ar-i18n-guard`, ...) do not exist anywhere (ISS-0019); the kit's
  pre-commit runs the five checkers instead. Its "new source file needs a test" rule is covered by `tdd-gate`.
- `presets/{understand,mindmaps,flows}`: not built. `understand` already applies the ADP patterns; mindmaps and flows
  belong to the P7 learn skills.
- Kits for adp-e-automation and PACER: not built; no facts about those repos are available here.
- `pilot-sync` pushes nothing (the legacy agent pushed on its own); `git-push` asks you.

## Checklist for the work Mac (about 30 minutes)

1. `axon doctor`; `axon tools install`.
2. `axon install --project ~/<path>/adp-e-product --kit adp-e-product --dry-run`, then without `--dry-run`.
3. In adp-e-product, on a feature branch with no changes: each checker with `--all`. Expect findings to be real; note
   every false positive (the `translate(` call form and the event file layout are `{NOT SURE}`), and log each with
   `axon-issue`.
4. Seed one violation per checker (an English-only key, a uuid in validateInput, `ClientID: input.clientID`, an
   import missing from the root package.json, a touched meta/src file) and confirm each is caught; then revert.
5. `pilot-sync --pilot <pilot> --dry-run` on a real feature branch; then a real merge when one is due.
6. `adp-domain-check` on a small change in one domain; confirm the jest command and the domain names.
7. Decide H-Q3 (tdd-gate default; council advice in 09-p4-acceptance.md).
