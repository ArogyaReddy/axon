// Shared hook plumbing: read the JSON payload from stdin, and fail open (with a visible warning) on internal errors.
// Permissions and the sandbox are the hard backstop (plan D14), so a bug in a guard must never block every session.
import { logDecision } from './log.mjs';

export async function runHook(handler) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const out = await handler(JSON.parse(raw));
    if (out) process.stdout.write(JSON.stringify(out));
    process.exitCode = 0;
  } catch (e) {
    logDecision({ hook: process.argv[1]?.split('/').pop(), decision: 'error', detail: e.stack ?? e.message });
    process.stderr.write(`[axon-guard] hook error, allowing the action (fail open): ${e.message}\n`);
    process.exitCode = 0;
  }
}

export function filePathOf(toolInput = {}) {
  return toolInput.file_path ?? toolInput.notebook_path ?? null;
}

export function deny(p, hook, rule, reason, detail) {
  logDecision({ hook, decision: 'deny', rule, session: p.session_id, cwd: p.cwd, detail });
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}

export const context = (event, text) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
