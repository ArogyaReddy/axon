---
name: git-pilot-feature-changes
description: In adp-e-product, bring the latest PILOT branch into a feature branch (merge, PILOT wins on conflicts, reinstall, rebuild, tsc and domain tests for what changed), or start a new feature branch from the latest PILOT with the full setup. Never pushes on its own. Use for "pull pilot into my branch", "sync with pilot", "new branch from pilot".
argument-hint: "--pilot <pilot branch> [--new <feature branch>] [--dry-run] [--skip-tests]"
---

# PILOT into feature (script does the mechanics, you do the judgment)

`pilot-sync` (axon-adp, on your PATH) runs every mechanical step; you only resolve conflicts and report.

## Merge PILOT into the current feature branch

1. If the PILOT branch is not given, take it from the branch name (`feature/pilot/<ver>/<name>/<topic>` has PILOT
   `pilot/<ver>/<name>`) and say which one you use.
2. `pilot-sync --pilot <pilot> --dry-run`: ahead/behind, files and domains that change. Post it in two lines.
3. `pilot-sync --pilot <pilot>`: merge, then root install, shared/domain/i18n rebuild, tsc and domain tests for the
   changed domains.
4. **Exit 3, conflicts:** for each listed file, read both sides. PILOT wins, except where this branch's own change must
   survive (a fix or feature that is the point of the branch): then keep both, PILOT's structure with this branch's
   change. Record each decision in one line. `git add` the files, then `pilot-sync --pilot <pilot> --continue`.
5. **Exit 1, a step failed:** read the real error. A failure caused by the merge is fixed test-first (`tdd`); one that
   already fails on PILOT itself is reported, not fixed here. Log it with `issue-tracker`.
6. **Done:** report the merge, the conflict decisions, and the tsc and test results. Push only through `git-push`
   (it asks the user). If `meta/src` changed, `make meta && npm run load-meta -- FIT` comes first (IFX-002).

Never `git merge --abort`, `git reset --hard` or force-push on your own: ask the user.

## New feature branch from PILOT

`pilot-sync --pilot <pilot> --new feature/pilot/<ver>/<name>/<topic>` fetches and fast-forwards PILOT, creates the
branch, runs `npm ci`, the domain setup and compile, and clears the stale meta build. It then prints the steps that
need the user's interactive login (`e-cli awsrole login --all`, `awslogin`, `npm run load-meta -- FIT`,
`npm run i18n:custom`, `npm run dev:remote:raw`): pass them on as printed, in that order.
