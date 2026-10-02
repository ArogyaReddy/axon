// Stop: no "done" while source changed without a passing axon-verify. Blocks once; stop_hook_active prevents loops.
import { runHook } from '../../lib/hook-io.mjs';
import { repoRoot, stopDecision } from '../../lib/state.mjs';
import { enabled } from '../../lib/switches.mjs';
import { logDecision } from '../../lib/log.mjs';

await runHook(p => {
  if (p.stop_hook_active) return null;
  const root = repoRoot(p.cwd);
  if (!root || !enabled('stop-gate', root)) return null;
  const d = stopDecision(root);
  if (!d.block) return null;
  logDecision({ hook: 'stop-gate', decision: 'block', rule: 'unverified-source', session: p.session_id, cwd: p.cwd });
  return { decision: 'block', reason: d.reason };
});
