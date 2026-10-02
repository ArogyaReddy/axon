---
name: tdd
description: Build a change test-first - RED (failing tests) > GREEN (make them pass) > REFACTOR > VERIFY - with every step enforced by axon-guard hooks. Use for any feature or bug fix once the plan or acceptance criteria are agreed.
argument-hint: "<task name> [plan doc path]"
---

# TDD (inline, hook-enforced)

You do the work in this session. Code enforces the order: `axon-guard` blocks source edits in RED, locks tests in GREEN,
and `axon-task` refuses a phase change without recorded evidence. Never try to get around a block; it is telling you
which step is missing.

## 0. Plan (reuse, do not redo)

- If an `understand` or `plan-feature` plan doc exists for this work, read it and use its acceptance criteria.
- Otherwise write the acceptance criteria now: 2 to 6 observable statements, each with the exact input and expected
  output (for numbers, the exact value). Show them and get the user's GO unless the user already approved the plan.

## 1. Start

`axon-task start <short-task-name>`

## 2. RED

1. Write one failing test per acceptance criterion. Put tests where the project keeps them (they match the test patterns).
2. Run the tests (`node --test`, `npm test`, `TEST_BUSINESS_DOMAIN=<domain> npx jest <file>`...).
3. Check every new test fails **for the right reason** (the missing behaviour, not a typo or import error).
4. Show the failing tests to the user. Wait for GO unless they asked you to proceed autonomously.
5. `axon-task phase GREEN`. If refused, read the message: it names the missing evidence.

## 3. GREEN

1. Write the simplest source change that makes the failing tests pass. Tests are locked now.
2. Run the tests after every meaningful change. Keep going until all pass:
   read the error, find the cause, fix it, re-run. Never weaken a test, change an expected value, hardcode a result, or
   silence an error to get green.
3. If a test itself is wrong (its expected value contradicts the acceptance criteria), stop editing, explain why to the
   user, and request `axon-unlock-test <file> --reason "<why>"` (the user approves it). Fix only that test.
4. When all tests pass: `axon-task phase REFACTOR`.

## 4. REFACTOR

Improve names and structure without changing behaviour; tests stay green after each step. Skip if nothing needs it.

## 5. VERIFY

1. `axon-verify` (the project's lint, typecheck and full test suite). Fix failures in source, re-run until PASS.
2. `axon-task phase DONE`.
3. Spawn the `verifier` agent with the acceptance criteria and the changed files when the change touches money, data,
   security or a production path (payroll is money), or when the user asks for `--deep`. It tries to prove the work is not
   done. Fix every FAIL it proves (start a new task for the regression), re-run `axon-verify`, and re-run the verifier if
   behaviour changed. For low-risk changes (docs, UI copy, tooling) skip it and say so in the report.
   (Measured: the verifier caught a half-cent rounding bug that passed all hidden and own tests; it is also the main cost.)

## 6. Record and report

- Log every bug you found along the way with the `issue-tracker` skill, including ones you fixed immediately.
- Report: what changed (files), the evidence (the RED run, the GREEN run, the `axon-verify` result, the verifier verdict),
  and anything still unverified (for example UI look and feel). State the evidence level of each claim.

## Commands

| Command | When |
|---|---|
| `axon-task start <name>` | once, before the first test |
| `axon-task phase GREEN / REFACTOR / DONE` | at each phase change |
| `axon-task status` | to see phase, test runs and unlocks |
| `axon-task abort --reason "<why>"` | when the task is abandoned |
| `axon-unlock-test <file> --reason "<why>"` | a test is wrong (user approves) |
| `axon-verify` | before DONE |
