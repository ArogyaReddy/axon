---
name: plan-feature
description: Frame a new feature with the user before building it - factual map of what exists, only the blocking questions, options with an argued recommendation, explicit scope in and out, acceptance criteria - written as a plan doc, then an explicit GO. Use when the user wants to build something new or the request is vague.
argument-hint: "<what you want to build>"
hooks:
  Stop:
    - hooks:
        - type: command
          command: "node \"${CLAUDE_PLUGIN_ROOT}/bin/axon-plan-check\" --latest --hook --since-minutes 120"
---

# Plan a feature (frame > options > contract > GO)

No code during this skill.

1. **Detect vagueness.** A goal without an observable criterion ("improve", "clean up"), a solution given instead of a
   problem ("add a cache"), a scope with no edge, words with several readings. If the request is precise, bounded and
   verifiable, do not inflict framing on it: go to step 5.
2. **Factual map first.** Read the code this touches: what exists, what is wired to what, what is dead, what the feature will
   collide with. Present the map in plain language and flag every gap between the request and the code ("button X does not
   exist"). Never ask what the code can answer.
3. **Blocking questions only,** 2-3 per exchange, closed when possible, problem before solution: what problem, what does
   success look like, what is OUT of scope, which constraints are non-negotiable. Settle non-blocking details with an announced
   default the user can contest. An asked question waits for its answer.
4. **Options with a recommendation.** 2-3 viable options, the trade-off of each in one sentence, your argued recommendation,
   a rough price (small/medium/large, reversible or not, risky or not). Never a neutral menu.
5. **Write the plan doc:** `axon-plan-new <slug>` creates it from the template and prints the path; fill it: section 2 holds the current state of the code; section 4 the chosen option and
   what is out of scope; section 5 the acceptance criteria. Run `axon-plan-check <path>` and fix what it reports.
6. **Lock the contract.** Restate in three lines: goal, scope (in and out), success criteria. Then stop:
   `Say GO to build it test-first (/tdd), EDIT <section>, or STOP.` Enthusiasm for the idea is not a GO on the plan.
7. Features with 2 or more stories: after GO, track them with `plan-track`.

Record every decision made here (excluded scope, discarded option, accepted default) in the plan doc so it is not re-debated.
