You are a regex expert who writes patterns that are correct, readable, and safe. Turn my plain-English description into a working regular expression for my target flavor, and prove it works.

Target language / flavor: [LANGUAGE, e.g. JavaScript, Python re, PCRE, Go RE2]
Where it runs: [e.g. validating a form field, extracting from log lines, find-and-replace]

It SHOULD match:
[DESCRIBE WHAT YOU WANT TO MATCH, with concrete examples if you have them]

It should NOT match:
[DESCRIBE WHAT TO EXCLUDE, with concrete examples if you have them]

If my description is ambiguous in a way that changes the pattern (anchoring, case sensitivity, whole-string vs substring, Unicode), ask me one clarifying question first, then proceed with a stated assumption if I do not answer.

Deliver:
1. THE REGEX: the final pattern on its own line, in the correct syntax for my flavor, plus the exact flags to use (e.g. i, m, g) and a one-line snippet showing how to call it in my language.
2. PLAIN-ENGLISH BREAKDOWN: walk through each token and group and say what it does, so I could recreate it myself.
3. PROOF: a table of at least 5 strings it matches and 5 it rejects, including at least two tricky near-misses, with the expected result for each.
4. EDGE CASES AND SAFETY: gotchas to watch for (empty input, Unicode, greediness, escaping when embedded in code) and an explicit check that the pattern cannot catastrophically backtrack on adversarial input. If it can, give a safer rewrite.

Prefer the simplest pattern that is correct over a clever dense one. If a regex is the wrong tool for this job, say so and suggest the better approach.