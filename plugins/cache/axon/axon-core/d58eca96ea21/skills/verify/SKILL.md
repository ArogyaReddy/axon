---
name: verify
description: Quality gate - lint, types, tests and ADP checkers through axon-verify, real result reported; --deep adds the verifier agent. Use before saying work is done, before committing, or when asked to verify.
argument-hint: "[--deep] [acceptance criteria]"
---

# Verify

1. Run `axon-verify`. It runs `.axon/config.json` `verify.commands`, or the package.json scripts lint, typecheck and test.
2. Report each check as PASS or FAIL with the command, exactly as printed. Never summarise a FAIL as "mostly passing".
3. On FAIL: show the relevant output lines, find the cause, and fix it (or say why you cannot). Re-run until PASS.
4. With `--deep`, or when the change matters (production behaviour, money, data, security): spawn the `verifier` agent
   with the acceptance criteria and the list of changed files. Relay its verdict per criterion with its evidence, and
   spot-check at least one of its claims yourself before relaying (a subagent report is not proof until checked).
5. If verification is impossible (no commands configured, environment missing), say so plainly and say what would verify
   it. Never claim done without a passing `axon-verify` or a stated reason.

Evidence levels, strongest first: a test that failed before and passes now > observed command output > the user's visual
check > reading the code > intention. Every "done" names its level.
