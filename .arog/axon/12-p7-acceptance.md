# 12 - P7 acceptance: learn skills and observability (2026-10-01)

Claude Code 2.1.197, Sonnet.

## Learn skills (axon-learn, all inline)

| Skill | From | What changed |
|---|---|---|
| `wh-explainer` | ar-wh-explainer | name only |
| `code-mentor` | ar-code-mentor | name only (references kept) |
| `explain-changes` | ar-explain-changes (+ 602-line agent) | inline: the session already holds the investigation story; the 10-section template is a reference file read only when writing |
| `mindmaps` | ar-mindmaps (+ 616-line agent) | inline; renders with `axon-mindmap` (pinned `markmap-cli` 0.18.12 `--offline`, about 350 KB, no CDN) instead of a Python renderer that does not exist here; outline rules a reference file |
| `codebase-to-course` | ar-codebase-to-course | the four asset files are copied with `cp` instead of Read + Write (about 15K output tokens saved per course) |
| `interactive-book` | ar-interactive-book | wrapper text removed; `verify.sh` is now `axon-book-verify` on PATH (the old path did not exist) |
| `interactive-session` | ar-interactive-session (+ agent) | inline; large read-only research may use the built-in Explore agent |

All files: em dashes replaced, `ar-` names and AROG wording removed, legacy eval files and renderer internals not
carried over. Read access to axon's plugin folders added to the settings so skills can read their reference files.

Not measured: `codebase-to-course` keeps its upstream parallel path (module briefs to subagents) for codebases with 6+
modules; whether it is cheaper than writing modules inline is open.

## Observability (axon-observe, opt-in)

| Piece | What |
|---|---|
| `event-log` hook (async) | one line per event in `~/.axon/events/YYYY-MM-DD.jsonl`: session, event, tool, short redacted target, outcome; prompt text never stored (length only); 14-day pruning; never blocks or fails |
| `axon-trace [--last \| --session id]` | a session timeline in the terminal, guard denies included |
| `axon dashboard` | local page on `127.0.0.1:47301`: sessions, timeline, filter, light/dark, phone layout |

Decision: axon ships its own small dashboard instead of extending the legacy rollup server (not running, not wired,
and P9 retires legacy code).

## Tests

- **231/231** (`npm test`). `tests/observe.test.mjs` (8): redacted tool records, failures, file paths relative, prompts
  never stored, malformed input, pruning, `axon-trace`, hooks.json registration (async), dashboard API and page on
  127.0.0.1. Seen failing first (8/8); one test assumption corrected (fixtures come from different captures).
- Ported skill content passes the hygiene checks (no em dash, no `/Users/` paths, every named command exists).

## Live

| Check | Result | Cost |
|---|---|---|
| Real session with axon-observe + axon-guard | events recorded for start, prompt (160 chars), tool calls, both guard denies, stop, end; `axon-trace --last` shows the timeline | $0.20 |
| Dashboard, screenshots at 1280 px light and dark, 390 px phone | first review found 6 issues (UTC vs local time, "1 sessions", baseline misalignment, broken phone layout, repeated date, favicon error); all fixed and re-checked, console clean | - |
| `/mindmaps docs/qa-layer.md` | outline with 8 branches, offline HTML rendered and checked in the browser | $0.38 |
| Same, with the global rules loaded (ISS-0036 fix) | 0 probe commands (was 2) | $0.45 |

Total P7 live spend: about $1.05.

## Findings

- ISS-0036 (fixed): skills probed for axon commands before running them (third skill with the same pattern); fixed once
  in the global rules.
- `playwright-cli` blocks `file://` pages: noted in the playwright-browser skill (serve over HTTP).
