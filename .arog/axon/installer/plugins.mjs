// Plugin layer of the installer, through the `claude plugin` CLI (never by editing Claude Code's plugin files).
// From a local directory marketplace, Claude Code loads skills, hooks, agents and bin/ in place from the checkout
// (verified on 2.1.197 with --debug-file); the copies under ~/.claude/plugins/cache are bookkeeping. So installing is
// about registering and enabling plugins, and changes in the checkout apply to the next session.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const MARKETPLACE = 'axon';
// Runs `claude plugin ...` for the given home, so `axon --home <dir>` never touches the real ~/.claude.
export const claudeRunner = home => args => spawnSync('claude', args, { encoding: 'utf8', timeout: 120000, env: { ...process.env, HOME: home } });
const defaultRun = args => spawnSync('claude', args, { encoding: 'utf8', timeout: 120000 });

function call(run, args) {
  const r = run(args);
  if (r.error || r.status !== 0) throw new Error(`claude ${args.join(' ')} failed: ${(r.stderr || r.stdout || r.error?.message || '').trim()}`);
  return r.stdout ?? '';
}
const json = (run, args) => { try { return JSON.parse(call(run, args) || '[]'); } catch { return []; } };
const axonIds = run => json(run, ['plugin', 'list', '--json']).map(p => p.id).filter(id => id.endsWith(`@${MARKETPLACE}`));
const nameOf = id => id.slice(0, -`@${MARKETPLACE}`.length);

export const enabledPlugins = overlay => Object.entries(overlay.enabledPlugins ?? {})
  .filter(([id, on]) => on && id.endsWith(`@${MARKETPLACE}`)).map(([id]) => nameOf(id));

export function installPlugins({ axonRoot, plugins, run = defaultRun }) {
  const market = json(run, ['plugin', 'marketplace', 'list', '--json']).find(m => m.name === MARKETPLACE);
  let marketplace = 'present';
  if (market && path.resolve(market.path ?? market.installLocation ?? '') !== path.resolve(axonRoot)) {
    throw new Error(`A marketplace named "axon" already points at ${market.path ?? market.installLocation}. Run: claude plugin marketplace remove axon, then axon install again.`);
  }
  if (!market) { call(run, ['plugin', 'marketplace', 'add', axonRoot]); marketplace = 'added'; }
  const have = new Set(axonIds(run).map(nameOf));
  const installed = [];
  for (const p of plugins) {
    if (have.has(p)) continue;
    call(run, ['plugin', 'install', `${p}@${MARKETPLACE}`]);
    installed.push(p);
  }
  return { marketplace, installed, present: plugins.filter(p => have.has(p)) };
}

export function uninstallPlugins({ run = defaultRun }) {
  const removed = axonIds(run).map(id => { call(run, ['plugin', 'uninstall', id]); return nameOf(id); });
  if (json(run, ['plugin', 'marketplace', 'list', '--json']).some(m => m.name === MARKETPLACE)) call(run, ['plugin', 'marketplace', 'remove', MARKETPLACE]);
  return { removed };
}
