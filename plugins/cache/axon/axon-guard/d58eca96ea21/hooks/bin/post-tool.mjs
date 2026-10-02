// PostToolUse and PostToolUseFailure: test-evidence (record test runs, including failing ones, which arrive as
// PostToolUseFailure with "Exit code N" in `error`), edit tracking (source/test edits for the phase rules) and
// post-edit-check (syntax errors back to Claude; locale drift and project reminders as context).
import { runHook, filePathOf, context } from '../../lib/hook-io.mjs';
import { repoRoot, recordEdit, recordRun, parseTestRun } from '../../lib/state.mjs';
import { enabled } from '../../lib/switches.mjs';
import { logDecision } from '../../lib/log.mjs';
import { postEditFindings } from '../../lib/checks.mjs';

await runHook(p => {
  if (p.tool_name === 'Bash') {
    const command = p.tool_input?.command ?? '';
    let output, exit;
    if (p.hook_event_name === 'PostToolUseFailure') {
      output = p.error ?? '';
      exit = Number((/^Exit code (\d+)/.exec(output) || [])[1] ?? 1);
    } else {
      output = `${p.tool_response?.stdout ?? ''}\n${p.tool_response?.stderr ?? ''}`;
      exit = 0;
    }
    const run = parseTestRun(command, output, exit);
    const root = run.isTest && repoRoot(p.cwd);
    if (root) recordRun(root, command, run);
    return null;
  }
  if (p.hook_event_name !== 'PostToolUse') return null;
  const file = filePathOf(p.tool_input);
  if (!file) return null;
  const root = repoRoot(file);
  if (root) recordEdit(root, file);
  if (p.tool_name === 'NotebookEdit' || !enabled('post-edit-check', root)) return null;
  const { errors, notes } = postEditFindings(root, file);
  if (errors.length) {
    logDecision({ hook: 'post-edit-check', decision: 'block', rule: 'syntax', session: p.session_id, cwd: p.cwd, detail: file });
    return { decision: 'block', reason: [...errors, ...notes].join('\n\n') };
  }
  return notes.length ? context('PostToolUse', notes.join('\n')) : null;
});
