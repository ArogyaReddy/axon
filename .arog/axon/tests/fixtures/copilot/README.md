# Copilot hook payloads

Shapes taken from the installed products on 2026-10-01, with paths replaced by `${REPO}`:

- `vscode-*`: VS Code 1.140.0, Copilot Chat 0.68.0 (Local harness). `ChatHookService.executeHook` sends
  `timestamp`, `hook_event_name`, `session_id`, `transcript_path`, `cwd` (the workspace folder) plus the event fields:
  PreToolUse `tool_name`, `tool_input`, `tool_use_id`; PostToolUse also `tool_response` (the result text). `tool_name`
  is the model-facing name (`e.toolCall.name`); tool inputs follow the tool schemas in the extension's package.json and
  the real `run_in_terminal` calls stored in this Mac's chat sessions.
- `cli-*`: GitHub Copilot CLI hooks reference (PascalCase events send snake_case fields; camelCase events send
  `toolName`/`toolArgs`), tool arguments as recorded in a real Copilot CLI session on this Mac (`bash`, `create`,
  `edit`, `view`).

Not captured from a live hook run yet: `axon export --copilot --capture` records real payloads (P8 live check).
