---
name: interactive-session
description: Human-in-the-loop rounds - "you instruct, I run it in my terminal, I report, you review" - for testing, learning, guiding or fixing something together, with a session log kept at ~/.claude/docs/guides/interactive-session-<topic>.md. Use for "let's test X interactively", "walk me through Y", "you instruct and I'll run it".
argument-hint: "<topic>"
---

# interactive-session (rounds with a real person, inline)

The work is a live conversation: the user runs each step in their own terminal and reports back, round after round.
It always runs in this session; nothing is delegated.

---

## Usage

```
/interactive-session checkgate
/interactive-session <any tool, script, migration, config change, or concept to learn/debug>
```

Also triggers implicitly - no slash command required - when the user proposes
a "you instruct, I execute, I report, you review" style session in plain
language.

---

## The Round Protocol (mandatory structure for every round)

Every instruction to the user MUST contain all four parts, in order:

1. **PURPOSE** - what to do, one line
2. **NEED** - why this specific check/step matters, what it proves or rules out
3. **ACTION** - the exact command/step, copy-pasteable
4. **RESULTS (expected)** - what output means pass/fail/skip, so the user can self-check before even reporting back

Then: **wait for the user's real report.** Never simulate, assume, or guess
what the output "probably" was. Review what they actually pasted, give a
plain verdict (✅ pass / ❌ fail / ⚠️ gap), and only then give the next round.

If a claim needs verifying (e.g. "why did X fail"), **verify it with a real
tool call** (read the source, run a read-only diagnostic) before stating it as
fact - see the controller-guard investigation in the reference session below
for the pattern: don't accept the first plausible theory, re-check when the
next round's real result contradicts it.

---

## Session Log (mandatory, update after every round)

Path: `~/.claude/docs/guides/interactive-session-<topic-slug>.md`

Create it on Round 1. After every round, append/update:
- The round's PURPOSE/NEED/ACTION
- The user's real reported result (verbatim data, not paraphrase, for tables/numbers)
- The verdict, and a **correction note** if a prior verdict turns out wrong
- Anything found that's out of scope for right now

This is the single source of truth for "what did we already establish" -
re-read it instead of re-deriving facts from memory if the session is long.

---

## Escalation Protocol - "log for later" vs. "fix now"

Findings during testing fall into two buckets. **The user decides which,
explicitly - never assume:**

- **Log for later** (default for anything not blocking the current goal): add
  it to a "Review Notes" section in the log with today's date, mark it
  **not yet addressed**, keep testing. Do not fix it uninstructed.
- **Escalate to fix now**: user says things like "this should be fixed," "we
  need to fix it," "it's a bug," "high issue." Mark the note **ESCALATED** in
  the log, then move to a real fix - but:
  - **Before touching more than 3 files**, stop and present **TASK / FILES /
    APPROACH**, and wait for explicit GO. This applies even mid-session, even
    after a general "go ahead and implement" - a big-blast-radius change still
    gets its own checkpoint.
  - If the thing under test has its own existing test suite, **do not regress
    it** - re-run it after the fix, show the before/after.
  - Follow the repo's own bug-fix discipline (reproduce for real, failing
    test/observation first, then the minimal fix, then show it passes).

---

## Safety Rules

- Never instruct the user to run a destructive/irreversible action (real
  push, `--confirm`, force flags, deletes) as part of routine testing - only
  after the user explicitly, separately asks to go live.
- Never mark a round "done" or a fix "verified" from assumption - only from a
  real pasted result or a real tool call you made yourself.
- If an earlier verdict in the log turns out wrong once more evidence comes
  in, **correct it explicitly in the log** - don't quietly overwrite it.
- One goal per turn. If the user bundles a status-check + a new build request
  + a go-ahead in one message, answer the status honestly first, then do
  what they explicitly sequenced next.

---

## Research inside a round

Quick checks (read a file, grep, run a read-only command) stay inline. A large read-only investigation (for example
"read this 600-line script and find how it decides X") may go to the built-in Explore agent so the conversation stays
small; the rounds themselves always stay here.

---

## My Steps

1. Confirm the topic + read any existing log file for this topic first (don't restart work already logged).
2. Create/open `~/.claude/docs/guides/interactive-session-<topic-slug>.md`.
3. Give Round 1 using the 4-part protocol. **Stop and wait.**
4. On the user's report: verdict it, update the log, give the next round.
5. Repeat until the user says the goal is met, or nothing new is surfacing.
6. Close with a compiled verdict in the log + chat: what was tested, what passed, what's fixed, what's still deferred/open.

---

## Reference session (built this pattern from a real run)

`~/.claude/docs/guides/interactive-session-checkgate.md` (legacy name, if present) - a worked
example: 6 rounds testing a check gate tool, a wrong-verdict
self-correction, a root-cause investigation that overturned an earlier fix
suggestion, and a user escalation from "log for later" to "fix now" with a
TASK/FILES/APPROACH checkpoint. Read it for a concrete example of the shape
this protocol produces.
