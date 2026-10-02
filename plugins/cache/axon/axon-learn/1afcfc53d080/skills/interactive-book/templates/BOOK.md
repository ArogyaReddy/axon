# Example Book - New Hire Onboarding Redesign

**Book status:** 🟠 In Progress - 1 of 2 chapters Resolved
**Chapters:** 2
**Last touched:** 2026-07-31

| #   | Chapter                                                       | One-line summary                      | Status       |
| --- | ------------------------------------------------------------- | ------------------------------------- | ------------ |
| 1   | [Chapter 1 - Overview & Requirements](./chapter-1-example.md) | Goals, scope, approval workflow       | 🟠 In Review |
| 2   | [Chapter 2 - Rollout Runbook](./chapter-2-example.md)         | Spawned from Chapter 1, S3 drill-down | 🟡 Draft     |

**Read order:** 1 → 2. Every chapter links back here and to its neighbors - this
Book is walkable in either direction without hunting for links.

---

## This is a template

Copy this whole folder for any new topic, rename the chapters, replace the
example content, keep the mechanics: S-ids, status tables, the Ledger, inline
`<details>` Q&A, nav strips, and the drill-down + backlink pattern.

**This is the `interactive-book` skill's bundled copy.** The original,
human-browsable version lives at `~/.claude/docs/guides/book-template/BOOK.md`
- identical content, kept there too since other docs already link to that
path. If they ever diverge, this copy (inside the skill folder) is the one
the skill actually reads.

## How to reference anything in this Book

**Pointing at a section** (either of you, in chat or in a doc):
`Chapter <n>, S<id>` - e.g. `Chapter 1, S2`. The chapter + S-id combination is
the address. It never changes once assigned, so it stays valid across every
review round, no matter how many iterations happen.

**Pointing at a specific point inside a section** (not the whole section):
`Chapter <n>, S<id>, near "<a short exact phrase copied from the text>"` - e.g.
`Chapter 1, S2, near "three approval steps"`. Quoting a few real words from the
spot is the anchor. No special markup needed - it works because it's exact
text, not a description, so it can't be ambiguous.

**How you know it landed in the right place:** whoever answers (human or agent)
replies inline, at that exact spot, using a `<details>` block right after the
question - plus says the Chapter/S-id out loud. The Ledger entry (bottom of
each chapter) is the permanent, greppable receipt that it happened, with a
timestamp and a status - nothing lives only in chat.

**Cross-chapter references:** Chapter-id + S-id, backed by a real relative
link and a nav strip at the top/bottom of every chapter. See Chapter 1, S3 for
a live example of one chapter drilling down into another, with a backlink
recorded on both sides.

**Multiple rounds on the same point:** nothing gets overwritten. Every round
gets its own Q-id, stacked in order, permanently, in the Ledger - see Chapter
1, S2 for three stacked rounds on one point as a live example.
