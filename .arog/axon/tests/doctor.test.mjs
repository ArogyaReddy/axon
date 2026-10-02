import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctor, parseClaudeVersion, compareVersions } from '../installer/doctor.mjs';

const AXON_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeBin(dir, name, stdout) {
  const p = path.join(dir, name);
  writeFileSync(p, `#!/bin/sh\necho "${stdout}"\n`);
  chmodSync(p, 0o755);
}

function env(withClaudeVersion, extra = {}) {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-doc-'));
  mkdirSync(path.join(home, '.claude'), { recursive: true });
  const bin = mkdtempSync(path.join(tmpdir(), 'axon-bin-'));
  if (withClaudeVersion) fakeBin(bin, 'claude', `${withClaudeVersion} (Claude Code)`);
  for (const [n, out] of Object.entries(extra)) fakeBin(bin, n, out);
  symlinkSync(process.execPath, path.join(bin, 'node'));
  return { home, PATH: bin };
}
const byId = (r, id) => r.checks.find(c => c.id === id);

test('version parsing and comparison', () => {
  assert.equal(parseClaudeVersion('2.1.197 (Claude Code)'), '2.1.197');
  assert.equal(parseClaudeVersion('garbage'), null);
  assert.equal(compareVersions('2.1.197', '2.1.283'), -1);
  assert.equal(compareVersions('2.1.283', '2.1.283'), 0);
  assert.equal(compareVersions('2.10.0', '2.9.9'), 1);
});

test('old Claude Code version is a warning that names the minimum', () => {
  const e = env('2.1.197');
  const r = doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH });
  const c = byId(r, 'claude-version');
  assert.equal(c.status, 'warn');
  assert.match(c.message, /2\.1\.197.*2\.1\.283/);
});

test('current Claude Code version passes', () => {
  const e = env('2.1.300');
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'claude-version').status, 'pass');
});

test('missing claude CLI is a failure', () => {
  const e = env(null);
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'claude-version').status, 'fail');
});

function pinnedTool(home, version) {
  const dir = path.join(home, '.axon', 'tools', 'playwright-cli', 'node_modules', '@playwright', 'cli');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@playwright/cli', version }));
}

test('playwright-cli: missing is a warning, the pinned version passes, another version warns', () => {
  const a = env('2.1.300');
  assert.equal(byId(doctor({ home: a.home, axonRoot: AXON_ROOT, PATH: a.PATH }), 'playwright-cli').status, 'warn');
  const pin = JSON.parse(readFileSync(path.join(AXON_ROOT, 'config', 'tools.json'), 'utf8'))['playwright-cli'].version;
  pinnedTool(a.home, pin);
  const ok = byId(doctor({ home: a.home, axonRoot: AXON_ROOT, PATH: a.PATH }), 'playwright-cli');
  assert.equal(ok.status, 'pass', ok.message);
  pinnedTool(a.home, '0.0.1');
  const old = byId(doctor({ home: a.home, axonRoot: AXON_ROOT, PATH: a.PATH }), 'playwright-cli');
  assert.equal(old.status, 'warn');
  assert.match(old.message, /axon tools install/);
});

test('reports whether axon settings are installed', () => {
  const e = env('2.1.300');
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'axon-installed').status, 'warn');
});

test('dangerous legacy settings are flagged', () => {
  const e = env('2.1.300');
  writeFileSync(path.join(e.home, '.claude', 'settings.json'), JSON.stringify({ skipDangerousModePermissionPrompt: true }));
  const c = byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'dangerous-settings');
  assert.equal(c.status, 'fail');
  assert.match(c.message, /skipDangerousModePermissionPrompt/);
});

test('summary counts match the checks', () => {
  const e = env('2.1.300');
  const r = doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH });
  const total = r.summary.pass + r.summary.warn + r.summary.fail;
  assert.equal(total, r.checks.length);
});

test('status line: renders a sample payload', () => {
  const e = env('2.1.300');
  const c = byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'statusline');
  assert.equal(c.status, 'pass', c.message);
  assert.match(c.message, /Sonnet/);
});

test('global rules: warn when not linked, pass when ~/.claude/rules/axon points at axon', () => {
  const e = env('2.1.300');
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'global-rules').status, 'warn');
  mkdirSync(path.join(e.home, '.claude', 'rules'));
  symlinkSync(path.join(AXON_ROOT, 'global', 'rules'), path.join(e.home, '.claude', 'rules', 'axon'));
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'global-rules').status, 'pass');
});

test('copilot export: no check until exported, pass when current, warn naming the command when axon changed since', async () => {
  const { exportCopilot } = await import('../copilot/export.mjs');
  const e = env('2.1.300');
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'copilot-export'), undefined);
  const target = path.join(e.home, '.copilot');
  exportCopilot({ axonRoot: AXON_ROOT, home: e.home, target });
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'copilot-export').status, 'pass');
  const m = path.join(e.home, '.axon', 'state', 'copilot-export.json');
  const manifest = JSON.parse(readFileSync(m, 'utf8'));
  manifest.targets[target].files['hooks/axon.json'] = 'exported-by-an-older-axon';
  writeFileSync(m, JSON.stringify(manifest));
  const c = byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'copilot-export');
  assert.equal(c.status, 'warn');
  assert.match(c.message, /1 file.*axon export --copilot/);
});

test('plugins: fail when an enabled axon plugin is missing or disabled, pass when all are on', () => {
  const e = env(null);
  const fake = list => writeFileSync(path.join(e.PATH, 'claude'), `#!/bin/sh\nif [ "$1" = "plugin" ]; then echo '${JSON.stringify(list)}'; else echo "2.1.300 (Claude Code)"; fi\n`, { mode: 0o755 });
  const all = ['axon-core', 'axon-guard', 'axon-qa', 'axon-learn'];
  fake([{ id: 'axon-core@axon', enabled: true }]);
  const missing = byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'plugins');
  assert.equal(missing.status, 'fail');
  assert.match(missing.message, /axon-guard.*axon (install|update)/);
  fake(all.map(p => ({ id: `${p}@axon`, enabled: p !== 'axon-qa' })));
  assert.match(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'plugins').message, /axon-qa/);
  fake(all.map(p => ({ id: `${p}@axon`, enabled: true })));
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'plugins').status, 'pass');
});

test('settings-owner: an edit-in-place home-manager link passes and names the real file; a file in the store warns', () => {
  const e = env('2.1.300');
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-doc-hm-'));
  const store = path.join(dir, 'nix', 'store');
  mkdirSync(store, { recursive: true });
  mkdirSync(path.join(dir, 'dotfiles'));
  writeFileSync(path.join(dir, 'dotfiles', 'settings.json'), '{}');
  symlinkSync(path.join(dir, 'dotfiles', 'settings.json'), path.join(store, 'hm-settings.json'));
  symlinkSync(path.join(store, 'hm-settings.json'), path.join(e.home, '.claude', 'settings.json'));
  const c = byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH, nixStorePrefix: store }), 'settings-owner');
  assert.equal(c.status, 'pass');
  assert.match(c.message, /dotfiles\/settings\.json.*--write-through/);
  const e2 = env('2.1.300');
  writeFileSync(path.join(store, 'in-store.json'), '{}');
  symlinkSync(path.join(store, 'in-store.json'), path.join(e2.home, '.claude', 'settings.json'));
  assert.equal(byId(doctor({ home: e2.home, axonRoot: AXON_ROOT, PATH: e2.PATH, nixStorePrefix: store }), 'settings-owner').status, 'warn');
});

test('legacy-hooks: warns while settings still run hooks from ~/.claude/hooks, names the fix', () => {
  const e = env('2.1.300');
  writeFileSync(path.join(e.home, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'bash ~/.claude/hooks/session-stop.sh' }] }] } }));
  const c = byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'legacy-hooks');
  assert.equal(c.status, 'warn');
  assert.match(c.message, /session-stop\.sh.*axon legacy archive/);
  writeFileSync(path.join(e.home, '.claude', 'settings.json'), '{}');
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'legacy-hooks').status, 'pass');
});

test('legacy-references: warns when your CLAUDE.md or rules still name retired ar-* skills or AROG; axon rules ignored', () => {
  const e = env('2.1.300');
  mkdirSync(path.join(e.home, '.claude', 'rules', 'axon'), { recursive: true });
  writeFileSync(path.join(e.home, '.claude', 'rules', 'axon', 'axon.md'), 'clean\n');
  writeFileSync(path.join(e.home, '.claude', 'CLAUDE.md'), '# me\nAlways start with /ar-understand, then ar-tdd.\n');
  writeFileSync(path.join(e.home, '.claude', 'rules', 'mandatory.md'), 'Rule 9: run the AROG gate (.arog/bin/ar-check).\n');
  const c = byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'legacy-references');
  assert.equal(c.status, 'warn');
  assert.match(c.message, /CLAUDE\.md.*mandatory\.md|mandatory\.md.*CLAUDE\.md/);
  assert.match(c.message, /docs\/inventory\.md/);
  writeFileSync(path.join(e.home, '.claude', 'CLAUDE.md'), '# me\nUse plain dashes. Prefer a car-free commute.\n');
  writeFileSync(path.join(e.home, '.claude', 'rules', 'mandatory.md'), 'Rule 9: verify before done.\n');
  assert.equal(byId(doctor({ home: e.home, axonRoot: AXON_ROOT, PATH: e.PATH }), 'legacy-references').status, 'pass');
});
