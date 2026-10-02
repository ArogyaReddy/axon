# Chapter 1 - Overview & Requirements

[📖 Book Index](./BOOK.md) · Chapter 2 ➡ [Rollout Runbook](./chapter-2-example.md)

**Chapter status:** 🟠 In Review - 1 open thread
**Last touched:** 2026-07-31

| ID  | Section           | Status                                       |
| --- | ----------------- | -------------------------------------------- |
| S1  | Goals & Scope     | 🟢 Resolved                                  |
| S2  | Approval Workflow | 🟢 Resolved - 3 rounds of Q&A, see below     |
| S3  | Rollout Trigger   | 🟠 Clarifying - drill-down spawned Chapter 2 |

---

## S1 · Goals & Scope

The redesign covers the first 30 days of a new hire's onboarding, replacing the
current five-email sequence with a single guided checklist.

<a id="c1-s1-q1"></a>

<details>
<summary>❓ <strong>Q:</strong> Does this include contractors, or employees only?</summary>

**A:** Employees only for v1. Contractors follow a separate, existing process -
out of scope here, not forgotten.

</details>

---

## S2 · Approval Workflow

Every new checklist item needs sign-off from the hiring manager before it's
visible to the new hire. There are three approval steps: draft, manager review,
HRBP review.

This section is the live example of **multiple rounds on the same point**:
nothing gets overwritten, every round stays visible, stacked in order.

<a id="c1-s2-q1"></a>

<details>
<summary>❓ <strong>Q1:</strong> Why three steps and not two?</summary>

**A:** HRBP review is required for anything touching compliance-tagged tasks
(I-9, tax forms). Manager review alone isn't enough for those.

</details>

<a id="c1-s2-q2"></a>

<details>
<summary>❓ <strong>Q2 (follow-up to Q1):</strong> Can HRBP review be skipped for non-compliance items?</summary>

**A:** Yes - skip logic added: HRBP step only triggers if the item is tagged
`compliance`. Everything else goes draft → manager → published.

</details>

<a id="c1-s2-q3"></a>

<details>
<summary>❓ <strong>Q3 (follow-up to Q2):</strong> Who tags an item as compliance - the manager or the system?</summary>

**A:** The system, from a fixed lookup table maintained by HRBP, not the
manager - keeps it consistent and out of individual judgment.

</details>

**All three rounds stay here, in order, permanently** - this is what "do we see
every iteration" looks like at three rounds; a fourth or fifth question would
stack the same way underneath. Once a thread gets long, the convention is to
add one **consolidated summary** `<details>` at the top with the final answer,
and leave the full round-by-round history below it - nothing is ever deleted,
just organized once it's long enough to need it.

---

## S3 · Rollout Trigger

<a id="c1-s3-q1"></a>

<details>
<summary>❓ <strong>Q:</strong> What actually kicks off the rollout once this is approved?</summary>

**A (short, inline):** That's its own runbook, not a paragraph here - new
scope, new chapter:

- 📖 **Full detail:** [Chapter 2 - Rollout Runbook](./chapter-2-example.md), S1
- ↩ **Chapter 2's S1 says:** "Originated from: Chapter 1, S3, this question."

</details>

---

## Ledger

### Q1

- Section: S1
- Asked: 2026-07-31
- Question: Does this include contractors, or employees only?
- Answer: Employees only for v1; contractors are a separate, existing process.
- Status: Resolved

### Q2

- Section: S2
- Asked: 2026-07-31
- Question: Why three approval steps and not two?
- Answer: HRBP review is required for compliance-tagged items only.
- Status: Resolved

### Q3

- Section: S2 (follow-up to Q2)
- Asked: 2026-07-31
- Question: Can HRBP review be skipped for non-compliance items?
- Answer: Yes - HRBP step only triggers for items tagged `compliance`.
- Status: Resolved

### Q4

- Section: S2 (follow-up to Q3)
- Asked: 2026-07-31
- Question: Who tags an item as compliance - manager or system?
- Answer: The system, from a fixed HRBP-maintained lookup table.
- Status: Resolved

### Q5

- Section: S3
- Asked: 2026-07-31
- Question: What kicks off the rollout once this is approved?
- Answer: Moved to its own chapter - see Chapter 2, S1. Backlink recorded both directions.
- Status: Resolved - spawned Chapter 2

---

[⬅ Book Index](./BOOK.md) · [Chapter 2 ➡](./chapter-2-example.md)
