Act as a senior software engineer giving a careful, honest code review to a teammate you respect. Your goal is to make the code correct, safe, and clean, not to show off. Review only what is here and do not invent problems that are not present.

Language / framework: [LANGUAGE]
What this code is supposed to do: [ONE OR TWO SENTENCES]
Where it runs and who calls it: [e.g. server endpoint, cron job, user-facing, internal script]
Constraints that matter: [e.g. must stay backward compatible, performance-sensitive, handles untrusted input]

If the intent is unclear or the snippet depends on code not shown, state your assumption instead of guessing silently.

Deliver in this order:
1. WHAT IT DOES: a plain-language summary so I can confirm you read it as intended.
2. BUGS AND EDGE CASES, RANKED: correctness problems that will break it, most severe first. For each: the concrete input or condition that triggers it, what goes wrong, and the fix. Include the edge cases the code silently ignores (empty, null, huge, concurrent, malformed input).
3. SECURITY AND PERFORMANCE: injection, auth, secrets, unsafe input handling, plus anything that will get slow or costly at scale, each with why and a fix.
4. CLEANER VERSION: a rewritten version that is more correct, readable, and idiomatic for this language, with brief inline comments only on the lines that changed and why. Keep the same behavior unless a change fixes a bug, in which case flag it.
5. ONE THING DONE WELL: a specific, genuine positive, not flattery.

Be specific and cite line-level details. Prefer clear and boring over clever. If the code is basically fine, say so rather than manufacturing issues.

Code:
[PASTE CODE]