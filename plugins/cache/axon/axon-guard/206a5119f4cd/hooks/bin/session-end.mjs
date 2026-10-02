// SessionEnd: housekeeping only (the shared budget is 1.5 s). Prunes session flag files older than 7 days and
// decision logs older than 14 days. Flags are not deleted at exit, so `claude --resume` keeps them.
import { readdirSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import { runHook } from '../../lib/hook-io.mjs';
import { axonHome, stateDir } from '../../lib/state.mjs';

function prune(dir, days) {
  const cutoff = Date.now() - days * 864e5;
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    const f = path.join(dir, n);
    try { if (statSync(f).mtimeMs < cutoff) rmSync(f, { force: true }); } catch { /* raced: ignore */ }
  }
}

await runHook(() => {
  prune(path.join(stateDir(), 'sessions'), 7);
  prune(path.join(axonHome(), 'logs'), 14);
  return null;
});
