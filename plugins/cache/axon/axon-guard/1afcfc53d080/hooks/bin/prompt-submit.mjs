// UserPromptSubmit: prompt-flags. Never blocks; adds context only when flags are set, active or asked for.
import { runHook, context } from '../../lib/hook-io.mjs';
import { repoRoot } from '../../lib/state.mjs';
import { enabled } from '../../lib/switches.mjs';
import { flagContext } from '../../lib/flags.mjs';

await runHook(p => {
  if (!p.session_id || !enabled('prompt-flags', repoRoot(p.cwd))) return null;
  const text = flagContext(p.session_id, p.prompt ?? '');
  return text ? context('UserPromptSubmit', text) : null;
});
