---
name: interactive-book
description: Review and clarify one living "Book" document (or its chapters) section by section - every question answered inline at the exact point it was asked (a details block) and logged in the doc's own Ledger, never only in chat and never in a new DOC2. Use for "Chapter 2, S1, clarify this", "review this doc properly", "add this to the ledger".
argument-hint: "<doc or chapter> [S<id> near \"<exact words>\"]"
---

# interactive-book (one living doc, answered in place, inline)

The work edits the real doc and waits on the user's next message, turn after turn, so it always runs in this session.

**Sibling to `interactive-session`, not the same skill:** that skill's
loop is _"instruct a real terminal command → wait for real pasted output →
verdict it,"_ with a linear chronological session log as its Result. This
skill's loop is _"point at a doc section → answer inline in that same doc →
update its status table + Ledger,"_ with the **doc itself** as the Result -
no separate log file. Different core loop, different artifact, kept as
separate skills on purpose (see `docs/guides/doc-review-traceability-protocol.md`,
Ledger Q5, for the full reasoning behind not repurposing the existing skill).

---

## Usage

```
/interactive-book <doc path>
DOC1, S3, near "three approval steps" - question is...
Chapter 2, S1 - clarify this
```

Also triggers implicitly, no slash command required, whenever the user
points at a specific section + point in an existing doc and asks a question,
or asks to start reviewing a doc "properly" / "section by section."

---

## The Round Protocol (mandatory structure for every round)

1. **Locate** - resolve `<Doc/Chapter>, S<id>` to the real section; if a
   specific point was quoted (`, near "..."`), find that exact text inside
   the section. If the doc has no S-ids/status table/Ledger yet, this is
   Round 1: retrofit that structure first (see Doc Structure below) before
   answering anything.
2. **Log the question** - append a new Q-id to the doc's own Ledger (never
   a new doc), linked to the Section-id, with the question text verbatim
   and status `Open`.
3. **Answer inline** - write the answer directly into the doc at that exact
   point, as a `<details>`/`<summary>` block (or a short blockquote pointer
   if the fuller answer lives in a linked chapter - see Drill-Down below).
   If the section covers more than one topic, also apply Precise
   Point-Linking below so proximity alone isn't the only signal of what the
   question is about. Chat gets a mirror of the same answer, never a
   different one.

   **Block placement rule (permanent, non-negotiable):** Every new Q block
   MUST be appended AFTER the last existing Q block in the section - never
   prepended before it. The correct `old_string` anchor to use in the Edit
   call is the LAST block's closing `</details>` tag (or a line immediately
   after it), not the first block's opening anchor. Inserting before an
   existing anchor reverses the display order. After every insertion, run
   `grep -n '<a id="c.*-q' <file>` to confirm anchor line numbers are
   strictly ascending (Q1 line < Q2 line < Q3 line ...). If they are not,
   stop and reorder before proceeding.

   **Separator rule (permanent, non-negotiable):** Every Q block - including
   the LAST one in a section - must be separated from whatever comes after it
   (the next Q block OR the section's body content like a table or heading)
   by a `\n\n---\n` horizontal rule. "Last block" means there is no Qn+1
   yet - but the section body that follows still needs the separator. Never
   omit the trailing `---` on the assumption that the block is last.

   **Mermaid node text color rule (permanent, non-negotiable):** Every
   Mermaid `style` line that sets `fill:` MUST also set `color:#000000`.
   Without it, node text color is inherited from the viewer theme - in dark
   mode this produces white/grey text on a light-colored fill, making text
   unreadable. The correct form is always:
   `style <ID> fill:#RRGGBB,stroke:#RRGGBB,color:#000000`
   This applies to every colored node in every diagram in every chapter of
   every Book. A `style` line without `color:#000000` is incomplete.

   **Breadcrumb rule (permanent, non-negotiable):** Every `<summary>` line
   MUST include a breadcrumb path showing exactly where in the conversation
   the question came from. Format:
   `❓ Qn · <Chapter> › <Section> [› <parent Q-id> [› <parent sub-part>]] - <question text>`
   Examples:
   - Top-level: `❓ Q1 · Chapter 1 › S5 - What is the first step?`
   - Follow-up on Q1: `❓ Q2 · Chapter 1 › S5 › Q1 follow-up - I see X, what does it mean?`
   - Follow-up on Q2 Part 6: `❓ Q3 · Chapter 1 › S5 › Q2 › Part 6 - How do I do Y?`
   - Follow-up on Q3 Option A: `❓ Q4 · Chapter 1 › S5 › Q3 › Option A - I see Z now, what next?`
   This breadcrumb is the ONLY place in the doc where a reader can see the
   full question lineage without opening the Ledger. Never omit it.
4. **Update status** - section status → `Clarifying` while awaiting
   confirmation. Never mark a section or Q-id `Resolved` from assumption -
   only after the user actually confirms.
5. **Verify** - grep/read the file back to confirm the edit landed exactly
   where intended (see Verification below); show the real output, not a
   claim that it worked.
6. **Wait for the user's real reply** - confirm → `Resolved`; follow-up →
   new Q-id, back to step 2, stacked under the same section (never
   overwritten); defer → `Parked` with a one-line reason.

---

## Doc Structure (the "Book" conventions this protocol assumes)

Full reference implementation and live worked examples:

- `~/.claude/docs/guides/book-template/BOOK.md` - the Book index/cover +
  the addressing rules, written out
- `~/.claude/docs/guides/book-template/chapter-1-example.md` - a simple
  inline Q&A, a **3-round stacked Q&A** on one point, and a drill-down
- `~/.claude/docs/guides/book-template/chapter-2-example.md` - the
  drill-down target, with a real two-way backlink
- `~/.claude/docs/guides/doc-review-traceability-protocol.md` - the real,
  lived worked example this whole skill was extracted from (5 real rounds,
  Q1–Q5, across multiple sessions, zero forked docs)

Copy the `book-template` folder's structure for any new doc under review.
Concretely, every doc this skill touches needs:

- **A dedicated folder, isolated from unrelated material** - every Book
  (single doc or multi-chapter) gets its own folder containing *only* that
  Book's files (cover/index + chapters), never mixed in with background
  reference docs a chapter merely cites. `book-template/` already
  demonstrates this (3 files, nothing else - "copy this whole folder for
  any new topic"). Mandatory reason, not just tidiness: chapter filenames
  are commonly numeric (`001-`, `002-`, ...) - two Books sharing one flat
  folder will eventually produce two different `001-*.md` files, ambiguous
  in any listing or grep. Real precedent: the `agentic-ai-testing` Book
  originally lived flat next to ~20 background docs, which forced its own
  BOOK.md to carry a disclaimer explaining which files were actually
  chapters - reorganized into its own folder on 2026-08-01 once this rule
  was made explicit. Background/reference material a chapter cites stays
  *outside* the Book's folder, linked to, not co-located.
- **The folder name must be a meaningful slug unique to that Book's own
  subject - never a generic word** like `book/`, `chapters/`, or `docs/`.
  A topic parent folder can and will eventually host more than one Book
  (e.g. a second Book on a different aspect of the same topic) - a generic
  folder name collides the instant that happens, which defeats the whole
  point of the dedicated-folder rule above. Recommended pattern: prefix
  with `book-` (matching the existing `book-template/` precedent) followed
  by a short kebab-case slug drawn from the Book's own title, e.g.
  `book-understanding-framework-rehearsal/` for a Book titled "Agentic AI
  Testing: Understanding, Framework & First Rehearsal" - the `book-` prefix
  also means every Book folder sorts and greps together as a family in a
  listing, distinct from loose background docs. **Real mistake, corrected
  same day (2026-08-01):** the `agentic-ai-testing` Book was first moved
  into a folder literally named `book/` - technically isolated, but still
  generic and would have collided with any second Book dropped into the
  same `agentic-ai-testing/` parent. Caught and renamed before it caused a
  real collision; don't repeat it.
- **Stable Section IDs** (`S1`, `S2`, ...) baked into heading text, never
  renamed once assigned (anchors must stay stable across every round)
- **A status rollup table** near the top: `🟡 Draft / 🔵 Under Review /
🟠 Clarifying (Qn) / 🟢 Resolved / 🔴 Parked`
- **A Ledger** at the bottom (or a companion `<doc>.ledger.md` for very
  large docs) - one `### Qn` entry per question, append-only, never
  overwritten, never deleted
- **A nav strip** (`📖 Book Index · ⬅ Prev · Next ➡`) on every chapter, if
  the doc is part of a multi-chapter Book

---

## Drill-Down (new chapter vs. answer inline)

A question is a **clarification** (stays inline, in this doc's own Ledger)
unless it's genuinely **new scope** (a real new deliverable, not just a
deeper explanation). When it's new scope:

- Leave a short inline answer + `📖 Full detail: <new chapter>, S1`
- The new chapter's own S1 records `↩ Originated from: <this doc>, S<id>,
"<the question>"`
- Register the new chapter in the Book's index (`BOOK.md`) if one exists

Never spin up a new doc just to answer a question about an existing one -
that is the exact failure mode this skill exists to prevent.

---

## Precise Point-Linking (when a section covers more than one topic)

Proximity alone ("the `<details>` block right after the section") stops
being enough once a section/paragraph contains more than one distinct topic
or claim - a reader can't tell which part a `, near "..."` question is about
just from it appearing at the end. Discovered and applied for the first time
2026-07-31 (a two-topic paragraph in a real Book, Arize AX + the offline
rehearsal in the same paragraph). Whenever this applies, every point-linked
answer does all of:

1. **Bold the exact quoted phrase** in the source text (word-for-word, not a
   paraphrase), and append a jump-link right after it, reusing the same
   anchor id already placed before the `<details>` block:
   `**<phrase>** [❓ Qn](#<anchor-id>)`.
2. **Anchor-id naming** - `c<chapter>-s<section>-q<question>` (e.g.
   `c1-s2-q1` for Chapter 1, S2, Q1), matching the `<a id="..."></a>`
   already placed immediately before the `<details>` block. Keep reusing the
   same id in both the jump-link and the anchor tag.
3. **Open the `<details>` block** with a one-line locator before the answer:
   `> 📍 **Re:** <Doc/Chapter>, S<id>, near "<exact phrase>"`.
4. **Add a `Near: "<exact phrase>"` bullet** to the Ledger entry, right
   after `Section:`.

Skip all 4 when the whole section is already single-topic - the `<details>`
block right after it is unambiguous by proximity alone, and bolding/linking
every sentence in an already-unambiguous section is just noise.

---

## Verification (mandatory after every inline edit)

Run the bundled checker instead of composing ad-hoc grep commands each time:

```
axon-book-verify <file>
```

It checks, in one pass: zero `\uFFFD` corruption (astral-plane status emoji
🟠 🔵 🟢 🔴 🟡 typed as escaped `\uXXXX\uXXXX` sequences in a tool call reliably
corrupt into the replacement character - always type the literal glyph
instead), `<details>` block count, every `### Qn` Ledger entry, Mermaid
diagram count, and total line count. Exits non-zero if corruption is found.

Never say a question was answered or a section resolved without pasting the
real verification output.

---

## Safety Rules

- Never mark a Q-id or section `Resolved` without the user's actual
  confirmation - `Answered` and `Resolved` are different states.
- Never overwrite a prior round's Q&A - every round gets its own Q-id,
  stacked in order, permanently.
- Never create a second doc to answer a question about the first one - only
  for genuinely new scope, and always with a two-way backlink.
- One doc/topic per Book unless the user explicitly starts a new one.

---

## My Steps

1. Resolve the doc + Section-id (+ quoted point, if given). Read the current
   file first - it may have changed since last touched.
1a. **Check for PLAN.md in the same folder** - if it exists, note it at the
   start of the first round:
   ```
   📋 Execution plan linked: <path to PLAN.md>
      Stories: <count> · Status: <feature STATUS from PLAN.md>
      → Use /plan-track to see the Story Dashboard and pick up execution
   ```
   This surfaces the connection between research (this book) and execution
   (PLAN.md) so neither is lost. Only show once per session, not every round.
2. If the doc lacks the Book structure (S-ids/status table/Ledger), retrofit
   it before answering (Round 1).
3. Log the question as a new Q-id in the Ledger.
4. Answer inline at the exact point (or leave a drill-down pointer + spin up
   a linked chapter, if it's genuinely new scope) - apply Precise
   Point-Linking if the section covers more than one topic.
   **Placement check:** use `grep -n '<a id="c.*-q' <file>` BEFORE inserting
   to find the last existing Q block's anchor line. Insert the new block
   AFTER its closing `</details>`, separated by `\n\n---\n`. After inserting,
   re-run the grep to confirm ascending line-number order.
5. Update section/doc status, verify with real grep/read output, show it.
6. Wait for the user's real reply; resolve, follow-up, or park accordingly.
7. Repeat until the doc (or Book) reaches Done - every section Resolved or
   consciously Parked.

---

## Reference session (built this pattern from a real run)

`~/.claude/docs/guides/doc-review-traceability-protocol.md` - the doc this
skill was extracted from: 5 real Ledger rounds (Q1–Q5) across multiple
sessions, a mid-course correction when a recommendation read as ambiguous
(Q3), a deep third-party tool investigation before recommending against
adopting it prematurely (S15), and zero forked DOC2/DOC3s anywhere in the
whole thread. Read it for a concrete example of the shape this protocol
produces under real, messy, multi-round conditions.
