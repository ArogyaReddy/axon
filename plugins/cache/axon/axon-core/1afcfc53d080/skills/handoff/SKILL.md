---
name: handoff
description: Close a working session so the next one can continue without re-explaining - reconcile with git, update SESSION-HANDOFF.md (done, verified how, next, decisions, blocked on the user), append one line to the session journal. Use when the user says stop here, wrap up, end the session, or hand off.
---

# Handoff (leave the project resumable)

The test of a good handoff: a fresh session reading only that file and the git state continues the work without asking the
user anything twice. `prime` reads this file at the start of the next session.

1. **Reconcile reality:** `git status`, `git log --oneline -5`, `axon-task status`. If uncommitted work remains, ask: commit
   it (`git-push`), stash it, or leave it, and record the answer.
2. **Update `SESSION-HANDOFF.md`** at the project root (create it if missing) with these sections:
   - **Last session (date):** 3-5 lines on what was done and where it stopped; branch and last commit.
   - **Verified this session:** what, where, and HOW it was verified (test name, command, evidence level).
   - **Still to do:** prioritised; split into "blocked on the user" and "next work"; each item self-contained enough to act
     on cold.
   - **Decisions:** rulings made this session that must not be re-debated.
   - **Open issues:** `axon-issue list --status open` ids touched or found this session.
   - **How to resume:** the first concrete action for next time.
   Over about 150 lines: move older history to `SESSION-ARCHIVE.md` (move, never delete) and say so.
3. **Session journal:** append one line to `${AXON_DOCS_DIR:-~/.claude/docs}/sessions/sessions.jsonl`:
   `{"date":"<ISO>","project":"<repo>","branch":"<b>","commit":"<sha>","summary":"<one line>","verified":[...],"next":"<one line>"}`.
4. **Commit the handoff only if the project tracks it** (ask the first time): `docs: session handoff YYYY-MM-DD`, handoff
   files only, never code.
5. **Say goodbye usefully:** three plain lines on what awaits next time, starting with anything blocked on the user.
