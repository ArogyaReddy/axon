# 13 - P8 acceptance: Copilot export (2026-10-01)

VS Code 1.140.0 with Copilot Chat 0.68.0 (Local agent). Copilot CLI: not installed on this Mac. Design: ADR-0009.

## What was built

| Piece | What |
|---|---|
| `copilot/map.mjs` | Copilot payload -> Claude shape: tool names and input fields of both harnesses, one payload per file for `multi_replace_string_in_file` and `apply_patch`, result text as `tool_response.stdout`, camelCase CLI fields; answers merged (any deny wins) and written in the VS Code and the CLI shape |
| `copilot/hook.mjs` | the adapter every exported hook calls: applies the Claude matcher, runs the unchanged axon hook script, always exits 0 with valid JSON (Copilot treats a failing PreToolUse hook as a deny) |
| `copilot/export.mjs`, `axon export --copilot [--repo] [--observe] [--dry-run] [--remove]` | writes `hooks/axon.json`, 21 skills (commands by full path), `reviewer` and `verifier` agents, `instructions/axon.instructions.md` to `~/.copilot` or `<repo>/.github`; manifest-tracked, never overwrites or removes a file it did not write or that you changed |
| `axon doctor` | `copilot-export` check: warns with the exact command when an export is older than the checkout |

Tool-name map (Copilot -> Claude), from the installed extension (`toolCall.name` is what hooks receive) and from real
sessions on this Mac: `run_in_terminal`, `bash`, `powershell` -> Bash; `create_file`, `create` -> Write;
`replace_string_in_file`, `insert_edit_into_file`, `edit`, `str_replace` -> Edit; `multi_replace_string_in_file`,
`apply_patch` -> one Edit/Write per file; `edit_notebook_file` -> NotebookEdit; `read_file`, `view` -> Read.

## Tests

**249/249** (`npm test`). New: `tests/copilot.test.mjs` (17): mapping for both harnesses, multi-file split, result text,
unknown tools untouched, answer widening; the adapter driving the real axon-guard scripts (terminal deny, CLI force
push, `.env` / CHANGELOG.md / `.pem` inside multi-file edits, camelCase CLI payload, Stop block in the VS Code shape,
fail open for crash / garbage / bad input / missing script); event log with `source: copilot`; export plan (hook file,
skills with existing full paths and no PATH claims, agents, instructions, no em dash); write / idempotent / foreign
file kept / user-changed file kept on remove / empty folders pruned; CLI dry run, `--repo`, `--remove`. Plus one doctor
test. Seen failing first (module missing; then the PATH-wording test before its fix).

## Live (VS Code, a throwaway repo exported with `--repo --observe`)

| Check | Result |
|---|---|
| Agent asked to run `git reset --hard` | VS Code called `run_in_terminal`; the adapter answered `deny` in 90 ms; VS Code accepted it ("Tool execution denied: [axon-guard] Blocked (git-reset-hard)..."); the uncommitted change survived |
| SessionStart | axon's session brief injected ("cp-live on branch main, last commit ..., 2 uncommitted files") |
| UserPromptSubmit, Stop | prompt-flags and stop-gate ran (Success, no output) |
| Event log | SessionStart, UserPromptSubmit, Stop recorded with `source: copilot` and the VS Code session id |
| Real payloads (VS Code Hooks log) | `tool_name: run_in_terminal`, `session_id`, `transcript_path`, `cwd` = workspace folder, `stop_hook_active`; SessionStart also `source: "new"`, `model: "auto"` - matches the fixtures |
| `apply_patch` input | real `*** Begin Patch / *** Update File: <abs path>` text (from the misrouted run below) matches the parser |

Cost: 2 Copilot requests, $0 Claude.

Incident (ISS-0037, fixed): the second live prompt went to your own VS Code window (`code chat -r` = last active
window) and its agent created `~/.claude/.env` (`TOKEN=x`). Removed after an identity check; its two other edits failed
(files absent). axon no longer drives your VS Code; the rest is the manual check below.

## Manual check for you (VS Code, about 3 minutes)

```bash
mkdir /tmp/axon-copilot-check && cd /tmp/axon-copilot-check && git init -q && echo a > a.txt && git add . && git commit -qm init
~/.claude/.arog/axon/bin/axon export --copilot --repo /tmp/axon-copilot-check
open -a "Visual Studio Code" /tmp/axon-copilot-check   # `code` on this Mac opens Cursor
```

In that window's Chat (Agent mode):

1. "Create a file named .env containing TOKEN=x" -> expect "Tried to use create_file - [axon-guard] .env is protected
   (secret ...)" and no `.env`.
2. Type `/` -> `mindmaps`, `ui-acceptance`, `tdd`, ... are listed.
3. Agents dropdown -> `reviewer` and `verifier` are listed; pick one and note the model it shows
   `{NOT SURE: whether 'Claude Sonnet 4.6 (copilot)' matches a model name on your account}`.

Then `~/.claude/.arog/axon/bin/axon export --copilot --repo /tmp/axon-copilot-check --remove`.

## Open

- Copilot CLI: built from its hooks reference and a real CLI session's tool calls; not run live (not installed).
- 196 lines from earlier test runs are still in `~/.axon/logs/2026-10-01.jsonl` (ISS-0038; removing lines from the
  decision log was refused as audit tampering, so it is your call). To drop them, keeping a backup:
  `cp ~/.axon/logs/2026-10-01.jsonl ~/.axon/logs/2026-10-01.bak && grep -v -e '"cwd":"/var/folders/' -e '"cwd":null' ~/.axon/logs/2026-10-01.bak > ~/.axon/logs/2026-10-01.jsonl`
- Not exported to `~/.copilot` on this Mac yet: that is part of the P9 install.
- VS Code also reads `~/.claude/skills` and `~/.claude/rules`: until P9 retires the legacy `ar-*` skills, Copilot
  would list both generations.
