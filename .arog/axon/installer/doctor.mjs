// axon doctor: read-only health checks. Never changes anything.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { detectNixManaged, NIX_STORE } from './homemanager.mjs';
import { settingsPath, buildOverlay } from './install.mjs';
import { enabledPlugins } from './plugins.mjs';
import { toolStatus } from './tools.mjs';
import { legacyHooks } from './legacy.mjs';
import { exportStatus } from '../copilot/export.mjs';

export const MIN_CLAUDE = '2.1.283';
const MIN_NODE_MAJOR = 20;

export function parseClaudeVersion(text) {
  const m = /(\d+\.\d+\.\d+)/.exec(text ?? '');
  return m ? m[1] : null;
}

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

function run(cmd, args, PATH, env = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, PATH, ...env }, timeout: 15000 });
  return r.error || r.status !== 0 ? null : (r.stdout || '').trim();
}

export function doctor({ home, axonRoot, PATH = process.env.PATH, nixStorePrefix = NIX_STORE }) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add('node', nodeMajor >= MIN_NODE_MAJOR ? 'pass' : 'fail', `Node ${process.versions.node} (need >= ${MIN_NODE_MAJOR})`);

  const cv = parseClaudeVersion(run('claude', ['--version'], PATH));
  if (!cv) add('claude-version', 'fail', 'Claude Code CLI not found on PATH');
  else if (compareVersions(cv, MIN_CLAUDE) < 0) add('claude-version', 'warn', `Claude Code ${cv} is older than the recommended ${MIN_CLAUDE}; axon runs in reduced mode (some settings keys and plugin eval unavailable). Upgrade recommended`);
  else add('claude-version', 'pass', `Claude Code ${cv}`);

  // Plugins, as `claude plugin list` reports them for this home. A local directory marketplace loads them in place from
  // the checkout (verified on 2.1.197 with --debug-file), so only missing or disabled plugins matter.
  let listed = null;
  try { listed = JSON.parse(run('claude', ['plugin', 'list', '--json'], PATH, { HOME: home }) ?? ''); } catch { /* claude missing or old */ }
  if (Array.isArray(listed)) {
    let profile = 'personal';
    try { profile = JSON.parse(readFileSync(path.join(home, '.axon', 'state', 'installed.json'), 'utf8')).profile ?? profile; } catch { /* not installed */ }
    const on = new Set(listed.filter(p => p.id?.endsWith('@axon') && p.enabled !== false).map(p => p.id.slice(0, -'@axon'.length)));
    const missing = enabledPlugins(buildOverlay(axonRoot, profile)).filter(p => !on.has(p));
    if (missing.length) add('plugins', 'fail', `axon plugins not installed or disabled: ${missing.join(', ')} (run: axon install, or axon update)`);
    else add('plugins', 'pass', `axon plugins installed and enabled (${on.size}), loaded from the checkout`);
  }

  for (const t of toolStatus({ home, axonRoot })) {
    const why = t.name === 'playwright-cli' ? 'needed for axon-qa' : t.name === 'markmap' ? 'needed for mindmaps' : 'pinned tool';
    if (!t.have) add(t.name, 'warn', `${t.name} not installed (${why}; run: axon tools install)`);
    else if (t.have !== t.want) add(t.name, 'warn', `${t.name} ${t.have} installed, ${t.want} pinned (run: axon tools install)`);
    else add(t.name, 'pass', `${t.name} ${t.have} (pinned)`);
  }

  const sp = settingsPath(home);
  const nix = detectNixManaged(sp, nixStorePrefix);
  const stores = [nixStorePrefix, ...(existsSync(nixStorePrefix) ? [realpathSync(nixStorePrefix)] : [])];
  const realInStore = nix.realpath && stores.some(s => nix.realpath === s || nix.realpath.startsWith(`${s}/`));
  if (!nix.managed) add('settings-owner', 'pass', 'settings file is writable by axon');
  else if (realInStore) add('settings-owner', 'warn', `~/.claude/settings.json lives in the nix store (${nix.realpath}); axon install prints the merged settings for your dotfiles instead of writing`);
  else add('settings-owner', 'pass', `home-manager edit-in-place link to ${nix.realpath}; axon install --write-through writes that file`);

  let settings = {};
  if (existsSync(sp)) {
    try { settings = JSON.parse(readFileSync(sp, 'utf8')); add('settings-json', 'pass', 'settings.json parses'); }
    catch (e) { add('settings-json', 'fail', `settings.json is not valid JSON: ${e.message}`); }
  } else add('settings-json', 'pass', 'no user settings file yet');

  const installed = existsSync(path.join(home, '.axon', 'state', 'installed.json'))
    || settings?.extraKnownMarketplaces?.axon !== undefined;
  add('axon-installed', installed ? 'pass' : 'warn', installed ? 'axon settings layer is installed' : 'axon settings layer not installed (run: axon install --dry-run)');

  const dangerous = ['skipDangerousModePermissionPrompt', 'dangerouslySkipPermissions'].filter(k => settings?.[k] === true);
  if (settings?.permissions?.defaultMode === 'bypassPermissions') dangerous.push('permissions.defaultMode=bypassPermissions');
  const oldHooks = legacyHooks(settings);
  add('legacy-hooks', oldHooks.length ? 'warn' : 'pass', oldHooks.length
    ? `settings still run ${oldHooks.length} legacy hook(s) from ~/.claude/hooks (${oldHooks.map(h => h.hook.command).join('; ').slice(0, 160)}); axon replaces them: run axon legacy archive`
    : 'no legacy hooks wired in settings');
  // Your own instructions naming retired legacy skills (ar-*) or the AROG gate send Claude to things that no longer exist.
  const LEGACY_NAME = /(?:^|[\s/`'"(])ar-[a-z][a-z-]+|\bAROG\b|\.arog\/bin/m;
  const mdFiles = dir => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.name === 'axon' && dir === path.join(home, '.claude', 'rules') ? [] : d.isDirectory() ? mdFiles(path.join(dir, d.name)) : d.name.endsWith('.md') ? [path.join(dir, d.name)] : []) : []);
  const mentions = [path.join(home, '.claude', 'CLAUDE.md'), ...mdFiles(path.join(home, '.claude', 'rules'))]
    .filter(f => { try { return LEGACY_NAME.test(readFileSync(f, 'utf8')); } catch { return false; } })
    .map(f => path.relative(home, f));
  add('legacy-references', mentions.length ? 'warn' : 'pass', mentions.length
    ? `${mentions.join(', ')} still name retired ar-* skills or the AROG gate; change them to the axon names (docs/inventory.md)`
    : 'your CLAUDE.md and rules name no retired skills');
  add('dangerous-settings', dangerous.length ? 'fail' : 'pass', dangerous.length ? `Unsafe settings enabled: ${dangerous.join(', ')}` : 'no unsafe settings');

  const sl = spawnSync(process.execPath, [path.join(axonRoot, 'global', 'statusline', 'statusline.mjs')], {
    input: JSON.stringify({ model: { display_name: 'Sonnet' }, context_window: { used_percentage: 12 } }),
    encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', COLUMNS: '120' }, timeout: 5000 });
  const line = (sl.stdout || '').trim();
  add('statusline', sl.status === 0 && line.includes('Sonnet') ? 'pass' : 'fail', sl.status === 0 ? `renders: ${line}` : `status line failed: ${(sl.stderr || '').trim().slice(0, 200)}`);

  const rulesLink = path.join(home, '.claude', 'rules', 'axon');
  let linked = false;
  try { linked = realpathSync(rulesLink) === realpathSync(path.join(axonRoot, 'global', 'rules')); } catch { /* not linked */ }
  add('global-rules', linked ? 'pass' : 'warn', linked ? 'global rules loaded from ~/.claude/rules/axon' : 'global rules not linked (run: axon install)');

  add('axon-root', existsSync(path.join(axonRoot, '.claude-plugin', 'marketplace.json')) ? 'pass' : 'fail', `axon root: ${axonRoot}`);

  for (const x of exportStatus({ axonRoot, home })) {
    add('copilot-export', x.stale.length ? 'warn' : 'pass', x.stale.length
      ? `${x.stale.length} file(s) in ${x.target} are older than this axon; run: ${x.command}`
      : `Copilot export in ${x.target} is current`);
  }

  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status]++;
  return { checks, summary };
}
