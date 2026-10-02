# ADR-0009: Copilot export - one adapter, unchanged hook scripts, tracked copies

Date: 2026-10-01. Status: accepted. Evidence: `13-p8-acceptance.md`.

## Context

axon ships as Claude Code plugins. VS Code Copilot reads Claude-format skills, agents, rules and hooks from
`~/.claude/{skills,agents,rules}` and `~/.claude/settings.json`, but not from the Claude plugin cache, so none of axon is
visible to it. Two Copilot harnesses matter: VS Code's Local agent (Copilot Chat 0.68, VS Code 1.140) and the Copilot
CLI (also used by VS Code's "Copilot CLI" sessions). Facts read from the installed product and the docs that drove
the design:

- Both read `~/.copilot/hooks/*.json` and `.github/hooks/*.json`. VS Code maps the Copilot format (`version: 1`,
  `bash`, `timeoutSec`, camelCase or PascalCase events) to its own; with PascalCase events the CLI sends snake_case
  fields. So one file serves both.
- Neither honours matchers: every hook runs for every tool.
- Tool names differ: VS Code `run_in_terminal`, `create_file`, `replace_string_in_file`, `multi_replace_string_in_file`,
  `apply_patch`, `insert_edit_into_file`, `read_file`; CLI `bash`, `create`, `edit`, `view`. Input field names differ
  (`filePath`, `path`, `oldString`, `old_str`), and two tools edit several files in one call.
- Answers differ: VS Code reads `hookSpecificOutput` (Stop: `hookSpecificOutput.decision`), the CLI reads top-level
  `permissionDecision` / `additionalContext`.
- Both fail closed: a PreToolUse hook that errors denies the tool call. axon's guards fail open (D14).

## Decision

1. **One adapter, no change to the hook scripts.** `copilot/hook.mjs` maps the payload to the Claude shape
   (`copilot/map.mjs`: tool name and input fields, one payload per file for multi-file edits, `tool_response` text),
   applies the Claude matcher itself, runs the unchanged axon-guard script, merges the answers (any deny wins) and
   writes them in both shapes. It always exits 0 and prints only valid JSON, so a bug can never turn into a deny.
2. **`axon export --copilot` copies, it does not link.** Hooks (`hooks/axon.json`, axon-guard; axon-observe with
   `--observe`), all skills (commands rewritten to full paths, because Copilot's terminal does not have the plugin bin
   folders on PATH; Claude-only "on your PATH" wording dropped), the `reviewer` and `verifier` agents (Copilot tool
   sets), and the global rules as `instructions/axon.instructions.md` (Claude-only parts dropped). Target
   `~/.copilot` by default, `<repo>/.github` with `--repo` (full local paths: not for commits).
3. **A manifest owns the copies.** `~/.axon/state/copilot-export.json` holds a hash per written file. A file axon did
   not write, or one you changed, is never overwritten or removed; a skill folder is written whole or not at all.
   `--remove` takes back only unchanged axon files. `axon doctor` warns when an export is older than the checkout.
4. **Not exported:** `council-advisor` and `qa-agent` (they only run through `claude -p --agent` from `axon-council`
   and `axon-qa`, which work the same from a Copilot terminal); the status line and output style (no Copilot
   equivalent; Copilot bills per request, not per token, so `lean` buys nothing there); VS Code settings (printed,
   never edited).

## Consequences

- One code path for both tools: a guard fixed for Claude is fixed for Copilot on the next export.
- Cost: about 35 ms per hook that does not match the tool, about 70 ms per guarded call (two Node starts), against
  Copilot tool calls that take seconds.
- An axon update needs `axon export --copilot` again; `axon doctor` says so.
- `{NOT SURE: Copilot model display names in agent files; unverified}`; `{NOT SURE: Copilot CLI live behaviour; not
  installed here}`.
