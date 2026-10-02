// PreToolUse (Bash): guard-bash. Denies catastrophic or irreversible commands with a reason Claude can act on.
import { runHook, deny } from '../../lib/hook-io.mjs';
import { repoRoot } from '../../lib/state.mjs';
import { enabled } from '../../lib/switches.mjs';
import { bashVerdict } from '../../lib/rules.mjs';

await runHook(p => {
  if (p.tool_name !== 'Bash') return null; // Copilot ignores matchers
  if (!enabled('guard-bash', repoRoot(p.cwd))) return null;
  const command = String(p.tool_input?.command ?? '');
  const v = bashVerdict(command, p.cwd);
  if (!v) return null;
  return deny(p, 'guard-bash', v.id, `[axon-guard] Blocked (${v.id}): ${v.why}. Commands like this are run by the user, not the agent; if it is needed, the user can run it.`, command);
});
