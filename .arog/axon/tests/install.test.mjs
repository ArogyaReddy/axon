import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, uninstall, buildOverlay } from '../installer/install.mjs';
import { detectNixManaged } from '../installer/homemanager.mjs';

const AXON_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempHome(settings) {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-home-'));
  mkdirSync(path.join(home, '.claude'), { recursive: true });
  if (settings !== undefined) writeFileSync(path.join(home, '.claude', 'settings.json'), settings);
  return home;
}
const settingsOf = home => JSON.parse(readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));

test('dry run writes nothing and returns a diff', () => {
  const home = tempHome('{\n  "effortLevel": "medium"\n}\n');
  const before = readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');
  const r = install({ home, axonRoot: AXON_ROOT, profile: 'personal', dryRun: true });
  assert.equal(r.mode, 'dry-run');
  assert.match(r.diff, /\+.*outputStyle/);
  assert.equal(readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), before);
  assert.ok(!existsSync(path.join(home, '.axon')));
});

test('apply merges base + profile, keeps user values, backs up, records state', () => {
  const home = tempHome('{\n  "effortLevel": "medium",\n  "permissions": { "allow": ["Bash(custom)"] }\n}\n');
  const r = install({ home, axonRoot: AXON_ROOT, profile: 'personal' });
  assert.equal(r.mode, 'applied');
  const s = settingsOf(home);
  assert.equal(s.effortLevel, 'medium', 'user value wins');
  assert.equal(s.outputStyle, 'axon-learn:lean', 'plugin styles need the plugin prefix (spike S2)');
  assert.ok(s.permissions.allow.includes('Bash(custom)'));
  for (const r of ['Bash(axon-task *)', 'Bash(axon-verify)', 'Bash(axon-verify *)', 'Bash(axon-issue *)', 'Bash(axon-plan-check *)', 'Bash(axon-plan-new *)', 'Read(~/.axon/docs/**)', 'Edit(~/.axon/docs/**)']) assert.ok(s.permissions.allow.includes(r), r);
  assert.ok(!JSON.stringify(s.permissions).match(/axon (task|unlock-test|issue)/), 'no stale space-separated command names (ISS-0023)');
  assert.ok(s.permissions.allow.includes('Bash(TEST_BUSINESS_DOMAIN=* npx jest *)'), 'env-prefixed ADP test command (spike S5)');
  assert.ok(s.permissions.ask.includes('Bash(axon-unlock-test *)'));
  assert.ok(s.permissions.ask.includes('Bash(axon-issue close *)'), 'closing as wont-fix or duplicate is the user decision (ISS-0028)');
  assert.equal(s.env.CLAUDE_CODE_SUBAGENT_MODEL, 'sonnet');
  assert.equal(s.env.AXON_PROFILE, 'personal');
  assert.equal(s.extraKnownMarketplaces.axon.source.path, AXON_ROOT, 'placeholder replaced with the real path');
  assert.ok(!JSON.stringify(s).includes('${AXON_ROOT}'));
  assert.deepEqual(s.attribution, { commit: '', pr: '' });
  assert.equal(readdirSync(path.join(home, '.axon', 'backups')).length, 1);
  assert.ok(existsSync(path.join(home, '.axon', 'state', 'installed.json')));
});

test('install twice changes nothing the second time', () => {
  const home = tempHome('{}\n');
  install({ home, axonRoot: AXON_ROOT, profile: 'personal' });
  const first = readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');
  const r2 = install({ home, axonRoot: AXON_ROOT, profile: 'personal' });
  assert.equal(r2.changes, 0);
  assert.equal(readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), first);
});

test('uninstall restores the original file byte for byte when untouched since install', () => {
  const original = '{\n    "effortLevel":"medium",   "env": {"X": "1"}\n}\n'; // unusual formatting on purpose
  const home = tempHome(original);
  install({ home, axonRoot: AXON_ROOT, profile: 'personal' });
  const r = uninstall({ home });
  assert.equal(r.mode, 'restored-backup');
  assert.equal(readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), original);
  assert.ok(!existsSync(path.join(home, '.axon', 'state', 'installed.json')));
});

test('uninstall keeps edits the user made after install', () => {
  const home = tempHome('{\n  "effortLevel": "medium"\n}\n');
  install({ home, axonRoot: AXON_ROOT, profile: 'personal' });
  const s = settingsOf(home);
  s.myLaterKey = 42;
  writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify(s, null, 2) + '\n');
  const r = uninstall({ home });
  assert.equal(r.mode, 'reversed-changes');
  assert.deepEqual(settingsOf(home), { effortLevel: 'medium', myLaterKey: 42 });
});

test('uninstall removes the file when there was none before install', () => {
  const home = tempHome(undefined);
  install({ home, axonRoot: AXON_ROOT, profile: 'personal' });
  assert.ok(existsSync(path.join(home, '.claude', 'settings.json')));
  uninstall({ home });
  assert.ok(!existsSync(path.join(home, '.claude', 'settings.json')));
});

test('a settings file that is not valid JSON aborts without writing', () => {
  const home = tempHome('{ not json');
  assert.throws(() => install({ home, axonRoot: AXON_ROOT, profile: 'personal' }), /not valid JSON/);
  assert.equal(readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), '{ not json');
});

test('home-manager (nix store) settings are never written; a snippet is returned instead', () => {
  const home = tempHome(undefined);
  const fakeStore = mkdtempSync(path.join(tmpdir(), 'axon-nix-'));
  const target = path.join(fakeStore, 'nix', 'store', 'abc-settings.json');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, '{"effortLevel":"high"}');
  symlinkSync(target, path.join(home, '.claude', 'settings.json'));
  const r = install({ home, axonRoot: AXON_ROOT, profile: 'personal', nixStorePrefix: path.join(fakeStore, 'nix', 'store') });
  assert.equal(r.mode, 'home-manager');
  assert.ok(r.mergedJson.includes('"outputStyle": "axon-learn:lean"'));
  assert.equal(readFileSync(target, 'utf8'), '{"effortLevel":"high"}');
});

test('detectNixManaged follows symlinks', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-nixd-'));
  const store = path.join(dir, 'nix', 'store');
  mkdirSync(store, { recursive: true });
  writeFileSync(path.join(store, 'f.json'), '{}');
  symlinkSync(path.join(store, 'f.json'), path.join(dir, 'link.json'));
  writeFileSync(path.join(dir, 'plain.json'), '{}');
  assert.equal(detectNixManaged(path.join(dir, 'link.json'), store).managed, true);
  assert.equal(detectNixManaged(path.join(dir, 'plain.json'), store).managed, false);
  assert.equal(detectNixManaged(path.join(dir, 'missing.json'), store).managed, false);
});

test('--write-through: an out-of-store home-manager link gets its dotfiles file merged, links kept; uninstall restores it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-oos-'));
  const store = path.join(dir, 'nix', 'store');
  const dotfile = path.join(dir, 'dotfiles', 'settings.json');
  mkdirSync(store, { recursive: true });
  mkdirSync(path.dirname(dotfile), { recursive: true });
  writeFileSync(dotfile, '{"effortLevel":"high"}');
  symlinkSync(dotfile, path.join(store, 'hm-settings.json'));
  const home = tempHome(undefined);
  const link = path.join(home, '.claude', 'settings.json');
  symlinkSync(path.join(store, 'hm-settings.json'), link);

  const dry = install({ home, axonRoot: AXON_ROOT, profile: 'personal', nixStorePrefix: store, writeThrough: true, dryRun: true });
  assert.equal(dry.mode, 'dry-run');
  assert.equal(readFileSync(dotfile, 'utf8'), '{"effortLevel":"high"}');
  const r = install({ home, axonRoot: AXON_ROOT, profile: 'personal', nixStorePrefix: store, writeThrough: true });
  assert.equal(r.mode, 'applied');
  assert.ok(lstatSync(link).isSymbolicLink() && lstatSync(path.join(store, 'hm-settings.json')).isSymbolicLink(), 'both links survive');
  const merged = JSON.parse(readFileSync(dotfile, 'utf8'));
  assert.equal(merged.outputStyle, 'axon-learn:lean');
  assert.equal(merged.effortLevel, 'high');
  assert.equal(uninstall({ home }).mode, 'restored-backup');
  assert.equal(readFileSync(dotfile, 'utf8'), '{"effortLevel":"high"}');
  assert.ok(lstatSync(link).isSymbolicLink());
});

test('--write-through refuses a settings file whose real content lives in the nix store', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-instore-'));
  const store = path.join(dir, 'nix', 'store');
  mkdirSync(store, { recursive: true });
  writeFileSync(path.join(store, 'hm-settings.json'), '{}');
  const home = tempHome(undefined);
  symlinkSync(path.join(store, 'hm-settings.json'), path.join(home, '.claude', 'settings.json'));
  const r = install({ home, axonRoot: AXON_ROOT, profile: 'personal', nixStorePrefix: store, writeThrough: true });
  assert.equal(r.mode, 'home-manager');
  assert.match(r.note, /nix store/);
  assert.equal(readFileSync(path.join(store, 'hm-settings.json'), 'utf8'), '{}');
});

test('out-of-store home-manager link (link > nix store link > dotfiles file) is detected as managed', () => {
  // Reproduces this Mac: ~/.claude/settings.json -> /nix/store/...-home-manager-files/... -> ~/dotfiles/.../settings.json
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-oos-'));
  const store = path.join(dir, 'nix', 'store');
  const dotfile = path.join(dir, 'dotfiles', 'settings.json');
  mkdirSync(store, { recursive: true });
  mkdirSync(path.dirname(dotfile), { recursive: true });
  writeFileSync(dotfile, '{"effortLevel":"high"}');
  symlinkSync(dotfile, path.join(store, 'hm-settings.json'));
  const home = tempHome(undefined);
  symlinkSync(path.join(store, 'hm-settings.json'), path.join(home, '.claude', 'settings.json'));

  const d = detectNixManaged(path.join(home, '.claude', 'settings.json'), store);
  assert.equal(d.managed, true);
  assert.equal(d.realpath, realpathSync(dotfile), 'reports the dotfiles source file');

  const r = install({ home, axonRoot: AXON_ROOT, profile: 'personal', nixStorePrefix: store });
  assert.equal(r.mode, 'home-manager');
  assert.equal(r.realpath, realpathSync(dotfile));
  assert.ok(lstatSync(path.join(home, '.claude', 'settings.json')).isSymbolicLink(), 'symlink must survive');
  assert.equal(readFileSync(dotfile, 'utf8'), '{"effortLevel":"high"}', 'source file untouched');
});

test('a plain (non-nix) symlinked settings file is written through, and the symlink survives', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-link-'));
  const target = path.join(dir, 'my-settings.json');
  writeFileSync(target, '{\n  "effortLevel": "medium"\n}\n');
  const home = tempHome(undefined);
  symlinkSync(target, path.join(home, '.claude', 'settings.json'));
  install({ home, axonRoot: AXON_ROOT, profile: 'personal' });
  assert.ok(lstatSync(path.join(home, '.claude', 'settings.json')).isSymbolicLink(), 'symlink must survive');
  assert.equal(JSON.parse(readFileSync(target, 'utf8')).outputStyle, 'axon-learn:lean', 'change landed in the target file');
  uninstall({ home });
  assert.ok(lstatSync(path.join(home, '.claude', 'settings.json')).isSymbolicLink(), 'symlink survives uninstall');
  assert.equal(readFileSync(target, 'utf8'), '{\n  "effortLevel": "medium"\n}\n');
});

test('work profile adds Bedrock and the Sonnet alias mapping', () => {
  const home = tempHome('{}\n');
  install({ home, axonRoot: AXON_ROOT, profile: 'work' });
  const s = settingsOf(home);
  assert.equal(s.env.CLAUDE_CODE_USE_BEDROCK, '1');
  assert.equal(s.env.ANTHROPIC_DEFAULT_SONNET_MODEL, 'us.anthropic.claude-sonnet-4-6[1m]');
  assert.equal(s.env.CLAUDE_CODE_SUBAGENT_MODEL, 'sonnet');
  assert.equal(s.env.AXON_PROFILE, 'work');
});

test('unknown profile is rejected', () => {
  const home = tempHome('{}\n');
  assert.throws(() => install({ home, axonRoot: AXON_ROOT, profile: 'nope' }), /Unknown profile/);
});

// Found in the P9 real install: with the personal sandbox on, axon-task could not create ~/.axon/state (EPERM) and
// playwright-cli could not write its daemon files, so tdd, verify and ui-acceptance failed inside Claude Code.
test('personal sandbox lets axon tools write their own runtime folders, nothing broader', () => {
  const allow = buildOverlay(AXON_ROOT, 'personal').sandbox.filesystem.allowWrite;
  for (const p of ['~/.axon/state', '~/.axon/logs', '~/.axon/events', '~/.axon/cache']) assert.ok(allow.includes(p), p);
  assert.ok(!allow.some(p => ['~', '~/', '~/.axon', '~/.axon/secrets', '~/.claude'].includes(p)), allow.join(', '));
  // Chrome cannot start under macOS Seatbelt (mach bootstrap "Permission denied"), so the browser tools run outside
  // the sandbox; permission rules still apply to them.
  assert.deepEqual(buildOverlay(AXON_ROOT, 'personal').sandbox.excludedCommands, ['playwright-cli *', 'axon-qa *']);
  // Test suites that start a server on 127.0.0.1 (axon's own dashboard and QA tests, most web projects) need it.
  assert.equal(buildOverlay(AXON_ROOT, 'personal').sandbox.network?.allowLocalBinding, true);
});

test('settings carry AXON_ROOT (the project kits\' git hooks find the axon checkout through it)', () => {
  assert.equal(buildOverlay(AXON_ROOT, 'personal').env.AXON_ROOT, AXON_ROOT);
});

test('documents: axon may read and write ~/.axon/docs without asking, and asks nothing for ~/.claude/docs', () => {
  const allow = buildOverlay(AXON_ROOT, 'personal').permissions.allow;
  for (const r of ['Read(~/.axon/docs/**)', 'Edit(~/.axon/docs/**)']) assert.ok(allow.includes(r), r);
  assert.ok(!allow.some(r => r.includes('.claude/docs')), allow.filter(r => r.includes('.claude/docs')).join(', '));
});

// Found in the real-machine rehearsal: on Claude Code 2.1.197 sandboxed commands such as `node -e` still asked for
// approval, so `understand` stalled on its reproduction step. Deny rules, ask rules (git commit/push) and axon's
// hooks still apply in auto-allow mode.
test('personal sandbox runs sandboxed commands without asking (auto-allow), work profile has no sandbox', () => {
  assert.equal(buildOverlay(AXON_ROOT, 'personal').sandbox.autoAllowBashIfSandboxed, true);
  assert.equal(buildOverlay(AXON_ROOT, 'work').sandbox, undefined);
});

// Claude Code 2.1.286 warns that Write(path) permission rules are never matched: Edit(path) rules cover every file
// write. A Write rule would look like protection (or access) and be neither.
test('permission rules use Edit(path) for files, never Write(path)', () => {
  const p = buildOverlay(AXON_ROOT, 'work').permissions;
  for (const r of [...p.allow, ...p.ask, ...p.deny]) assert.doesNotMatch(r, /^Write\(/, r);
  assert.ok(p.deny.includes('Edit(**/CHANGELOG.md)'));
});
