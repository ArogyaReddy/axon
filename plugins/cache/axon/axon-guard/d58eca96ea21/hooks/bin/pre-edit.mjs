// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): guard-files (secrets, generated and protected paths), then tdd-gate
// (no source edits in RED) and test-lock (no test edits in GREEN/REFACTOR).
import { runHook, filePathOf, deny } from '../../lib/hook-io.mjs';
import { repoRoot, editDecision } from '../../lib/state.mjs';
import { enabled } from '../../lib/switches.mjs';
import { fileVerdict, displayPath } from '../../lib/rules.mjs';

await runHook(p => {
  const file = filePathOf(p.tool_input);
  if (!file) return null;
  const root = repoRoot(file);
  if (enabled('guard-files', root)) {
    const v = fileVerdict(root, file);
    if (v) {
      const shown = displayPath(root, file);
      return deny(p, 'guard-files', v.id, `[axon-guard] ${shown} is protected (${v.id}: ${v.why}). The user makes changes to this file, or exempts the path in .axon/config.json "protected.allow".`, shown);
    }
  }
  if (!root) return null;
  const d = editDecision(root, file);
  if (d.allow || !enabled(d.hook, root)) return null;
  return deny(p, d.hook, d.hook, d.reason, displayPath(root, file));
});
