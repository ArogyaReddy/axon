---
name: agent-council
description: Five independent advisors pressure-test a decision in parallel, then an anonymous peer review and a verdict (about $0.64 a run). Started only by the user - "council this", "pressure-test", "debate this".
argument-hint: "<the decision or question>"
disable-model-invocation: true
---

# Agent council (frame > 5 advisors > 5 reviews > verdict)

You are the chairman. The advisors give independent opinions; you weigh them. Based on Karpathy's LLM Council.

**Council only when being wrong is expensive and the options are genuinely open.** A question with one right answer, a
lookup, or a creation task: answer it directly and say why no council was needed.

## 1. Frame (you, no agents) - keep it cheap

Every token you read here is carried through the rest of the session, and the framed question is sent to all ten
advisor calls, so:

- Read at most one file, only if you cannot state the options neutrally without it. Pick the few files the decision
  rests on (the smallest set, usually 2-6) and pass them with `--files`: never quote them in the question.
- Write the framed question in under 1,500 characters: the decision, the options, the constraints, what is at stake,
  and the file paths advisors may read. Neutral: no opinion, no steering. If it is too vague to frame, ask one
  question, then proceed.

## 2. Run the council (code, not you)

One command; it works out the docs folder and the date itself:

```
axon-council --slug <short-name> --files <a,b,c> <<'EOF'
<the framed question>
EOF
```

`axon-council` is on your PATH (axon-core). Run it directly: no `command -v`, `which`, `env`, `date`, `ls`, `find` or
`mkdir` first. If it is not found, say the axon-core plugin is missing.

It runs five `council-advisor` answers (Contrarian, First principles, Expansionist, Outsider, Executor) as parallel
processes, then five anonymous reviews (random letters, a rotated order per reviewer), and writes the question and the
transcript under the council docs folder. `--files` are read once by code and given to every advisor as cached
context, numbered for `path:line` citations (about 120,000 characters at most); the advisors then need no tools. It
prints the full transcript: read it there, not again from the file. Takes about one minute. Do not spawn advisors
yourself: run one at a time they lose independence and cost more (measured: $1.70, 342 s).

## 3. Verdict (you)

Post in chat:

```
COUNCIL: <question in one line>
AGREES:     <points several advisors reached independently - high confidence>
CLASHES:    <real disagreements, both sides, why reasonable people differ>
BLIND SPOTS:<what only the peer review surfaced>
VERDICT:    <one clear recommendation with the reason; you may side with a minority if its reasoning is strongest>
FIRST STEP: <one concrete action>
```

## 4. Save

- Transcript: `axon-council --verdict <short-name> <<'EOF'` + your verdict block + `EOF`. It fills the placeholder;
  no Read or Edit of the transcript is needed.
- Technical decision: also an ADR. If the repo already has `docs/decisions/`, add the next `ADR-NNNN-<slug>.md` there;
  otherwise write it to `${AXON_DOCS_DIR:-~/.claude/docs}/decisions/`. Context, options, decision, consequences, and a
  link to the transcript.
- The decision is the user's: the verdict is advice until they accept it.
