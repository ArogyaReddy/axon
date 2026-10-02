// P9 plugin layer of the installer: axon install adds the axon marketplace and installs the enabled plugins,
// axon update adds new or missing ones, axon uninstall removes them. Claude Code loads them in place from the checkout. Driven through a fake `claude plugin` runner that keeps state like the real CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installPlugins, uninstallPlugins, enabledPlugins } from '../installer/plugins.mjs';
import { buildOverlay } from '../installer/install.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeClaude({ marketplaces = [], plugins = [] } = {}) {
  const state = { marketplaces: [...marketplaces], plugins: [...plugins], calls: [] };
  const run = args => {
    state.calls.push(args.join(' '));
    const [, cmd, sub, arg] = args;
    const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
    if (cmd === 'list') return ok(JSON.stringify(state.plugins.map(id => ({ id, enabled: true, scope: 'user' }))));
    if (cmd === 'marketplace' && sub === 'list') return ok(JSON.stringify(state.marketplaces));
    if (cmd === 'marketplace' && sub === 'add') { state.marketplaces.push({ name: 'axon', path: arg }); return ok(); }
    if (cmd === 'marketplace' && sub === 'remove') { state.marketplaces = state.marketplaces.filter(m => m.name !== arg); return ok(); }
    if (cmd === 'marketplace' && sub === 'update') return ok();
    if (cmd === 'install') { state.plugins.push(sub); return ok(`Successfully installed plugin: ${sub}`); }
    if (cmd === 'uninstall') { state.plugins = state.plugins.filter(p => p !== sub); return ok(); }
    if (cmd === 'update') return ok(sub === 'axon-guard@axon' ? `Plugin "axon-guard" updated from a1 to b2` : `${sub} is already at the latest version`);
    return { status: 1, stdout: '', stderr: `unknown ${args.join(' ')}` };
  };
  return { state, run };
}

test('plugins carry no version: from a git-hosted marketplace each commit is an update (ADR-0010)', () => {
  for (const p of readdirSync(path.join(ROOT, 'plugins'))) {
    const m = JSON.parse(readFileSync(path.join(ROOT, 'plugins', p, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(m.version, undefined, p);
  }
});

test('enabled plugins come from the profile: ADP tools only on work, axon-observe opt-in everywhere', () => {
  assert.deepEqual(enabledPlugins(buildOverlay(ROOT, 'personal')).sort(), ['axon-core', 'axon-guard', 'axon-learn', 'axon-qa']);
  assert.deepEqual(enabledPlugins(buildOverlay(ROOT, 'work')).sort(), ['axon-adp', 'axon-core', 'axon-guard', 'axon-learn', 'axon-qa']);
});

test('install: adds the marketplace once, installs only missing plugins, is idempotent', () => {
  const f = fakeClaude({ plugins: ['axon-core@axon', 'other@elsewhere'] });
  const r = installPlugins({ axonRoot: ROOT, plugins: ['axon-core', 'axon-guard'], run: f.run });
  assert.deepEqual([r.marketplace, r.installed, r.present], ['added', ['axon-guard'], ['axon-core']]);
  assert.ok(f.state.calls.includes(`plugin marketplace add ${ROOT}`));
  const again = installPlugins({ axonRoot: ROOT, plugins: ['axon-core', 'axon-guard'], run: f.run });
  assert.deepEqual([again.marketplace, again.installed], ['present', []]);
});

test('install: an axon marketplace at another path is an error, nothing installed', () => {
  const f = fakeClaude({ marketplaces: [{ name: 'axon', path: '/somewhere/else' }] });
  assert.throws(() => installPlugins({ axonRoot: ROOT, plugins: ['axon-core'], run: f.run }), /\/somewhere\/else.*claude plugin marketplace remove axon/);
  assert.ok(!f.state.calls.some(c => c.startsWith('plugin install')));
});

test('install: a failing claude command stops with its message', () => {
  const run = args => (args[1] === 'install' ? { status: 1, stdout: '', stderr: 'boom' } : { status: 0, stdout: '[]', stderr: '' });
  assert.throws(() => installPlugins({ axonRoot: ROOT, plugins: ['axon-core'], run }), /claude plugin install axon-core@axon failed: boom/);
});

test('uninstall: removes axon plugins and the marketplace, leaves other plugins', () => {
  const f = fakeClaude({ marketplaces: [{ name: 'axon', path: ROOT }], plugins: ['axon-core@axon', 'other@elsewhere'] });
  const r = uninstallPlugins({ run: f.run });
  assert.deepEqual(r.removed, ['axon-core']);
  assert.deepEqual(f.state.plugins, ['other@elsewhere']);
  assert.deepEqual(f.state.marketplaces, []);
});

// End to end through bin/axon with a fake `claude` first on PATH that keeps state in its HOME, like the real one.
test('axon install / update / uninstall drive claude plugin in the --home given, never the real one', async () => {
  const { mkdtempSync, writeFileSync, chmodSync, mkdirSync, existsSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const bin = mkdtempSync(path.join(tmpdir(), 'axon-fakebin-'));
  writeFileSync(path.join(bin, 'claude'), `#!${process.execPath}
const fs = require('fs'), path = require('path');
const f = path.join(process.env.HOME, 'fake-claude.json');
const s = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { marketplaces: [], plugins: [] };
const [, cmd, sub, arg] = process.argv.slice(2);
let out = '';
if (cmd === 'list') out = JSON.stringify(s.plugins.map(id => ({ id })));
else if (cmd === 'marketplace' && sub === 'list') out = JSON.stringify(s.marketplaces);
else if (cmd === 'marketplace' && sub === 'add') s.marketplaces.push({ name: 'axon', path: arg });
else if (cmd === 'marketplace' && sub === 'remove') s.marketplaces = [];
else if (cmd === 'install') s.plugins.push(sub);
else if (cmd === 'uninstall') s.plugins = s.plugins.filter(p => p !== sub);
else if (cmd === 'update') out = sub + ' is already at the latest version';
fs.writeFileSync(f, JSON.stringify(s));
process.stdout.write(out);
`);
  chmodSync(path.join(bin, 'claude'), 0o755);
  const home = mkdtempSync(path.join(tmpdir(), 'axon-cli-home-'));
  mkdirSync(path.join(home, '.claude'));
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: '/nonexistent-real-home' };
  const axon = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'axon'), ...a, '--home', home], { encoding: 'utf8', env });
  const state = () => JSON.parse(readFileSync(path.join(home, 'fake-claude.json'), 'utf8'));
  const i = axon('install', '--no-tools');
  assert.equal(i.status, 0, i.stderr);
  assert.match(i.stdout, /Plugins: installed axon-core, axon-guard, axon-qa, axon-learn \(axon marketplace added\)/);
  assert.equal(state().plugins.length, 4);
  assert.ok(!existsSync('/nonexistent-real-home'));
  const u = axon('update');
  assert.equal(u.status, 0, u.stderr);
  assert.match(u.stdout, /all installed already[\s\S]*start a new session/);
  const x = axon('uninstall');
  assert.equal(x.status, 0, x.stderr);
  assert.match(x.stdout, /Removed plugins: axon-core/);
  assert.deepEqual(state(), { marketplaces: [], plugins: [] });
});
