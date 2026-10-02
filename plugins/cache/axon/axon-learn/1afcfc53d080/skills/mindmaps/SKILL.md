---
name: mindmaps
description: Build an interactive offline mind map (markmap .md source + self-contained .html) of a domain, event, feature or document - events, DB schema, code-DB-UI column mapping, data journeys, gotchas. Use for "mind map", "mindmap", "visualize this feature/event/doc", "map the DB schema".
argument-hint: "<domain | noun.verb | path to a doc> [--events \"create assign\"] [--depth N] [--output <dir>] [--no-html]"
---

# Mind maps (read sources > outline > render)

## 1. Sources (read, never recall)

- A path given: that document. A domain or event (adp-e-product): the first that exists of
  `docs/**/<domain>/E2E-FLOWCHARTS.md`, `DATABASE-INTEGRATION-GUIDE.md`, `IMPLEMENTATION-GUIDE.md`, any `.md` in
  `docs/**/<domain>/`, then `docs/**/*<domain>*.md`; also read the sibling `QUICK-REFERENCE.md` and `specs/*.md`.
  Nothing found: say so and ask for `--source`; do not invent a map from memory.
- When docs are thin, read the code they describe (event handlers, controllers, GraphQL types, migrations) and say
  which parts came from code.
- Extract every event, trigger, input (required/optional), validation rule and error key, lifecycle stage, DB table and
  operation, column (UI label / TypeScript / DSQL name), output, chain, error path, security rule (clientid from
  session), bi-temporal pattern, data journey (UI > GQL > Lambda > DSQL > UI), GQL mutation/query, and known gotcha.

## 2. Outline

Read `references/outline-rules.md` and follow it; `templates/mindmaps-template.md` is the gold-standard shape and
`templates/column-mapping-cheatsheet.md` the column table. Essentials: `# <domain> Events`, one `##` per event or
concept, then DB Schema, Data Journey and Gotchas branches; at most 5 levels; leaves are one short line; backticks for
field, table and error names; bold for critical rules; no blank lines inside a list. `--events` limits the events.

Write `<output>/<domain>-mindmaps.md` (default output: a `mindmaps/` folder next to the source doc, else
`docs/<domain>/mindmaps/`). The markmap options (`initialExpandLevel` = `--depth`, default 2) go in the frontmatter;
without them `axon-mindmap` adds sensible defaults.

## 3. Render

`axon-mindmap <output>/<domain>-mindmaps.md` writes the `.html` next to it: one self-contained offline file (about
350 KB, no CDN), with zoom, fit and dark-mode buttons. Skip with `--no-html`. If it reports markmap-cli missing, tell the user to run `axon tools install`.

## 4. Reply

The `.md` and `.html` paths, the top-level branches, and anything you could not find in the sources.
