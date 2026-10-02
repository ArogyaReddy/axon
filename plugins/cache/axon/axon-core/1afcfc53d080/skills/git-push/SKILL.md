---
name: git-push
description: Commit and push the current work with proof - review exactly what changed, run axon-verify, get an independent review of the diff from the reviewer agent, write an honest commit message, push, and prepare the pull request text. Refuses to commit on red. Use when the user says commit, push, ship, or open a PR.
argument-hint: "[what this change is about]"
---

# Git push (proof before history)

Deploying, publishing or migrating data is never part of this skill; each needs the user's explicit GO.

1. **Freeze and look:** `git status`, `git diff`, `git diff --staged`. Every changed file you cannot explain gets explained
   or reverted before anything else. Lockfiles, generated files and formatting churn go in a separate commit, or the message
   says why they travel together.
2. **Prove it works:** `axon-verify`. On FAIL: stop and report. No commit on red, no "just this once", no weakened test.
   If no check covers the change, say exactly what remains unverified.
3. **Independent review:** spawn the `reviewer` agent on the diff (the branch diff against its base when pushing a branch).
   Relay its verdict and spot-check at least one blocker yourself (open the cited line, run the cited command).
   - DO NOT SHIP or a blocker you confirmed: stop, report, fix with the user's agreement, then restart from step 2.
   - Log every confirmed defect with `issue-tracker`.
4. **Commit:** a message that says WHY and claims no more than was proven. Imperative subject under 72 characters, a body
   with what changed and the evidence (checks run). Follow the project's conventions (for adp-e-product: the Trac ticket
   reference). Never add an AI co-author line; the user's rules forbid it. Separate unrelated changes into separate commits.
5. **Push:** `git push` (the permission prompt is the user's confirmation). Never `--force`; the settings deny it.
6. **PR text** (Bitbucket at ADP): title, summary, what changed per file, evidence (axon-verify result, reviewer verdict,
   new tests), risks, and what a human should check. Print it for the user to paste; create the PR only with a tool the
   project already uses and the user's GO.
7. **Report** in plain language: what changed in visible behaviour, the evidence level of each claim, what is unverified.
