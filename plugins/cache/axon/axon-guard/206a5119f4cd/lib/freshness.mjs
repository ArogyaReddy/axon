// Is the installed plugin copy older than the axon checkout? Claude Code keeps installed plugins in
// ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/, and axon's plugins carry no version, so <version> is the
// start of the commit they were installed from (ADR-0010). A plugin loaded from the checkout itself is never stale.
import { execFileSync } from 'node:child_process';

export function staleInstall(pluginRoot, axonRoot) {
  if (!axonRoot || !pluginRoot) return false;
  const m = /[\\/]plugins[\\/]cache[\\/][^\\/]+[\\/][^\\/]+[\\/]([0-9a-f]{7,40})[\\/]?$/.exec(pluginRoot);
  if (!m) return false;
  let head;
  try { head = execFileSync('git', ['-C', axonRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return false; }
  return !head.startsWith(m[1]);
}
