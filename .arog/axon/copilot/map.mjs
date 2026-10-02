// Copilot hook payloads -> the Claude Code shape the axon hook scripts read, and their answers back in a shape both
// Copilot harnesses read. Sources (2026-10-01): VS Code 1.140 / Copilot Chat 0.68 ChatHookService (Local harness) and
// the GitHub Copilot CLI hooks reference; fixtures and notes in tests/fixtures/copilot.
import path from 'node:path';

// Copilot tool name -> Claude tool name. VS Code passes the model-facing name (run_in_terminal); internal ids
// (copilot_*) are listed too. The Copilot CLI names (bash, view, create, edit) come from a real CLI session.
const BASH = ['run_in_terminal', 'runInTerminal', 'copilot_runInTerminal', 'bash', 'powershell', 'local_shell'];
const WRITE = ['create_file', 'createFile', 'copilot_createFile', 'create'];
const EDIT = ['replace_string_in_file', 'replaceString', 'copilot_replaceString', 'insert_edit_into_file', 'insertEdit',
  'copilot_insertEdit', 'edit', 'str_replace', 'str_replace_editor', 'insert'];
const MULTI = ['multi_replace_string_in_file', 'multiReplaceString', 'copilot_multiReplaceString'];
const PATCH = ['apply_patch', 'applyPatch', 'copilot_applyPatch'];
const NOTEBOOK = ['edit_notebook_file', 'editNotebook', 'copilot_editNotebook'];
const READ = ['read_file', 'readFile', 'copilot_readFile', 'view'];

const CAMEL = { sessionId: 'session_id', toolName: 'tool_name', toolArgs: 'tool_input', toolResult: 'tool_result',
  hookEventName: 'hook_event_name', stopHookActive: 'stop_hook_active', transcriptPath: 'transcript_path' };

const parseMaybe = v => { if (typeof v !== 'string') return v ?? {}; try { return JSON.parse(v); } catch { return {}; } };
const fileOf = i => i.filePath ?? i.path ?? i.file_path ?? null;

// apply_patch input: "*** Add File: <path>", "*** Update File: <path>", "*** Delete File: <path>", "*** Move to: <path>".
function patchFiles(text) {
  return [...String(text ?? '').matchAll(/^\*\*\* (Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)]
    .map(m => ({ tool: m[1] === 'Add' ? 'Write' : 'Edit', file: (m[2] ?? m[3]).trim() }));
}

function toolCalls(name, input) {
  if (BASH.includes(name)) return [{ tool: 'Bash', input: { command: input.command ?? '', description: input.explanation ?? input.description } }];
  if (WRITE.includes(name)) return [{ tool: 'Write', input: { file_path: fileOf(input), content: input.content ?? input.file_text } }];
  if (EDIT.includes(name)) return [{ tool: 'Edit', input: { file_path: fileOf(input), old_string: input.oldString ?? input.old_str, new_string: input.newString ?? input.new_str ?? input.code } }];
  if (MULTI.includes(name)) {
    return (input.replacements ?? []).map(r => ({ tool: 'Edit', input: { file_path: fileOf(r), old_string: r.oldString, new_string: r.newString } }));
  }
  if (PATCH.includes(name)) return patchFiles(input.input).map(f => ({ tool: f.tool, input: { file_path: f.file } }));
  if (NOTEBOOK.includes(name)) return [{ tool: 'NotebookEdit', input: { notebook_path: fileOf(input) } }];
  if (READ.includes(name)) return [{ tool: 'Read', input: { file_path: fileOf(input) } }];
  return [{ tool: name, input }];
}

// One Copilot payload -> one or more Claude-shaped payloads (a multi-file edit becomes one payload per file).
export function normalize(raw, { event, cwd } = {}) {
  const p = {};
  for (const [k, v] of Object.entries(raw ?? {})) p[CAMEL[k] ?? k] = v;
  p.hook_event_name ??= event;
  p.cwd ??= cwd ?? process.cwd();
  p.axon_host = 'copilot';
  const result = p.tool_result;
  if (typeof p.tool_response === 'string') p.tool_response = { stdout: p.tool_response };
  else if (result && !p.tool_response) p.tool_response = { stdout: result.text_result_for_llm ?? result.textResultForLlm ?? '' };
  delete p.tool_result;
  if (!p.tool_name) return [p];
  const abs = f => (f && !path.isAbsolute(f) ? path.resolve(p.cwd, f) : f);
  return toolCalls(p.tool_name, parseMaybe(p.tool_input)).map(({ tool, input }) => {
    const i = { ...input };
    if (i.file_path) i.file_path = abs(i.file_path);
    if (i.notebook_path) i.notebook_path = abs(i.notebook_path);
    return { ...p, tool_name: tool, tool_input: i, copilot_tool: p.tool_name };
  });
}

// Several answers (one per file) -> one: any deny wins, any block wins, context is joined.
export function merge(outputs) {
  const outs = outputs.filter(o => o && typeof o === 'object');
  const denies = outs.filter(o => o.hookSpecificOutput?.permissionDecision === 'deny');
  if (denies.length) {
    const reason = denies.map(o => o.hookSpecificOutput.permissionDecisionReason).filter(Boolean).join('\n');
    return { hookSpecificOutput: { ...denies[0].hookSpecificOutput, permissionDecisionReason: reason } };
  }
  const blocks = outs.filter(o => o.decision === 'block');
  const context = outs.map(o => o.hookSpecificOutput?.additionalContext).filter(Boolean).join('\n');
  const event = outs.find(o => o.hookSpecificOutput)?.hookSpecificOutput.hookEventName;
  const out = {};
  if (blocks.length) Object.assign(out, { decision: 'block', reason: blocks.map(o => o.reason).filter(Boolean).join('\n\n') });
  if (context) out.hookSpecificOutput = { hookEventName: event, additionalContext: context };
  return Object.keys(out).length ? out : null;
}

// VS Code reads hookSpecificOutput (Stop: hookSpecificOutput.decision); the Copilot CLI reads top-level fields.
export function widen(out, event) {
  if (!out || typeof out !== 'object') return out;
  const w = { ...out };
  const h = w.hookSpecificOutput;
  if (h) for (const k of ['permissionDecision', 'permissionDecisionReason', 'additionalContext']) if (h[k] !== undefined && w[k] === undefined) w[k] = h[k];
  if (w.decision !== undefined && (event === 'Stop' || event === 'SubagentStop')) {
    w.hookSpecificOutput = { hookEventName: event, ...h, decision: w.decision, reason: w.reason };
  }
  return w;
}
