// P9 legacy retirement: `axon legacy archive` moves the legacy items axon replaces (catalog sections 7-8) out of the
// folders Claude Code loads, into ~/.axon/legacy/<stamp>/; nothing is deleted. `axon legacy restore` moves them back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planArchive, archiveLegacy, restoreLegacy } from '../installer/legacy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function legacyHome() {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-legacy-'));
  const c = path.join(home, '.claude');
  for (const s of ['ar-tdd', 'ar-mindmaps', 'demanding-proof', 'work-discipline', 'lavish', 'no-mistakes', 'synced']) {
    mkdirSync(path.join(c, 'skills', s), { recursive: true });
    writeFileSync(path.join(c, 'skills', s, 'SKILL.md'), `# ${s}\n`);
  }
  mkdirSync(path.join(c, 'agents'));
  for (const a of ['ar-tdd.agent.md', 'code-reviewer.md', 'verifier.md', 'my-own-agent.md']) writeFileSync(path.join(c, 'agents', a), a);
  mkdirSync(path.join(c, 'commands'));
  for (const m of ['ship.md', 'handoff.md', 'mine.md']) writeFileSync(path.join(c, 'commands', m), m);
  writeFileSync(path.join(c, 'settings-me.json'), '{"skipDangerousModePermissionPrompt": true}\n');
  writeFileSync(path.join(c, 'ar-config.yaml'), 'x: 1\n');
  mkdirSync(path.join(c, 'bin'));
  writeFileSync(path.join(c, 'bin', 'capture-sessions'), '#!/bin/sh\n');
  return home;
}

test('plan: only the replaced items; your own skills, agents, commands and bin stay', () => {
  const home = legacyHome();
  const rels = planArchive({ home }).map(i => i.rel).sort();
  assert.deepEqual(rels, ['agents/ar-tdd.agent.md', 'agents/code-reviewer.md', 'agents/verifier.md', 'ar-config.yaml',
    'commands/handoff.md', 'commands/ship.md', 'settings-me.json', 'skills/ar-mindmaps', 'skills/ar-tdd',
    'skills/demanding-proof', 'skills/work-discipline']);
});

test('archive moves (never deletes), records a manifest; restore puts every item back', () => {
  const home = legacyHome();
  const c = path.join(home, '.claude');
  const r = archiveLegacy({ home, now: new Date('2026-10-01T18:00:00Z') });
  assert.equal(r.moved.length, 11);
  assert.ok(!existsSync(path.join(c, 'skills', 'ar-tdd')));
  assert.ok(existsSync(path.join(c, 'skills', 'lavish', 'SKILL.md')));
  assert.ok(existsSync(path.join(c, 'agents', 'my-own-agent.md')));
  assert.ok(existsSync(path.join(c, 'commands', 'mine.md')));
  assert.equal(readFileSync(path.join(r.dir, 'skills', 'ar-tdd', 'SKILL.md'), 'utf8'), '# ar-tdd\n');
  assert.match(r.dir, /\.axon\/legacy\/2026-10-01T18-00-00Z$/);
  assert.deepEqual(archiveLegacy({ home }).moved, [], 'a second run finds nothing to move');
  const back = restoreLegacy({ home });
  assert.equal(back.restored.length, 11);
  assert.equal(readFileSync(path.join(c, 'skills', 'ar-tdd', 'SKILL.md'), 'utf8'), '# ar-tdd\n');
  assert.equal(readFileSync(path.join(c, 'settings-me.json'), 'utf8'), '{"skipDangerousModePermissionPrompt": true}\n');
});

test('restore never overwrites: an item recreated since stays, its archived copy is kept and reported', () => {
  const home = legacyHome();
  const c = path.join(home, '.claude');
  archiveLegacy({ home });
  writeFileSync(path.join(c, 'commands', 'ship.md'), 'new ship\n');
  const back = restoreLegacy({ home });
  assert.deepEqual(back.conflicts, ['commands/ship.md']);
  assert.equal(readFileSync(path.join(c, 'commands', 'ship.md'), 'utf8'), 'new ship\n');
});

test('a symlinked legacy item (for example home-manager) is left alone and reported', () => {
  const home = legacyHome();
  const c = path.join(home, '.claude');
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'axon-legacy-src-'));
  writeFileSync(path.join(elsewhere, 'ship.md'), 'linked');
  symlinkSync(path.join(elsewhere, 'ship.md'), path.join(c, 'commands', 'fix-bug.md'));
  const r = archiveLegacy({ home, dryRun: true });
  assert.ok(r.skipped.includes('commands/fix-bug.md'));
  assert.ok(!r.moved.includes('commands/fix-bug.md'));
  assert.ok(existsSync(path.join(c, 'skills', 'ar-tdd')), 'dry run moves nothing');
});

test('axon legacy archive --dry-run lists; archive and restore through the CLI', () => {
  const home = legacyHome();
  const axon = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'axon'), 'legacy', ...a, '--home', home], { encoding: 'utf8' });
  const dry = axon('archive', '--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Would move 11 item\(s\)/);
  assert.match(axon('archive').stdout, /Moved 11 item\(s\) to .*\.axon\/legacy\//);
  assert.match(axon('restore').stdout, /Restored 11 item\(s\)/);
  assert.equal(readdirSync(path.join(home, '.claude', 'skills')).length, 7);
});

// Work Mac: the legacy settings wire hooks from ~/.claude/hooks (some point at scripts that no longer exist). Archiving
// unhooks them (axon's hooks replace them), keeps every other hook, and restore puts the settings back exactly.
const LEGACY_SETTINGS = {
  model: 'us.anthropic.claude-sonnet-4-6[1m]',
  env: { AWS_PROFILE: 'work' },
  hooks: {
    SessionStart: [
      { matcher: '', hooks: [{ type: 'command', command: 'lavish-axi', timeout: 10 }] },
      { hooks: [{ type: 'command', command: 'bash ~/.claude/hooks/session-start-brief.sh' }] },
    ],
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'python3 $HOME/.claude/hooks/block-dangerous-commands.py' }, { type: 'command', command: 'node /opt/team/check.js' }] },
    ],
    Stop: [{ hooks: [{ type: 'command', command: '/home/someone/.claude/hooks/stop-handoff-check.py' }] }],
  },
};

test('archive unhooks legacy ~/.claude/hooks entries, keeps your others; restore returns the settings exactly', () => {
  const home = legacyHome();
  const file = path.join(home, '.claude', 'settings.json');
  writeFileSync(file, `${JSON.stringify(LEGACY_SETTINGS, null, 2)}\n`);
  const dry = archiveLegacy({ home, dryRun: true });
  assert.equal(dry.hooks.length, 3);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), LEGACY_SETTINGS, 'dry run writes nothing');
  const r = archiveLegacy({ home });
  assert.equal(r.hooks.length, 3);
  const after = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(after.hooks, {
    SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: 'lavish-axi', timeout: 10 }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node /opt/team/check.js' }] }],
  });
  assert.equal(after.model, LEGACY_SETTINGS.model);
  assert.deepEqual(after.env, LEGACY_SETTINGS.env);
  restoreLegacy({ home });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), LEGACY_SETTINGS);
});

test('archive never writes a settings file owned by home-manager; it lists the hooks to remove by hand', () => {
  const home = legacyHome();
  const store = mkdtempSync(path.join(tmpdir(), 'axon-nix-'));
  writeFileSync(path.join(store, 'settings.json'), JSON.stringify(LEGACY_SETTINGS));
  symlinkSync(path.join(store, 'settings.json'), path.join(home, '.claude', 'settings.json'));
  const r = archiveLegacy({ home, nixStorePrefix: store });
  assert.equal(r.hooks.length, 3);
  assert.equal(r.hooksManual, true);
  assert.deepEqual(JSON.parse(readFileSync(path.join(store, 'settings.json'), 'utf8')), LEGACY_SETTINGS);
});

test('archive moves the documents in ~/.claude/docs to ~/.axon/docs (never overwriting); restore moves them back', () => {
  const home = legacyHome();
  const old = path.join(home, '.claude', 'docs');
  mkdirSync(path.join(old, 'plans'), { recursive: true });
  writeFileSync(path.join(old, 'plans', 'a.plan.md'), 'plan a\n');
  mkdirSync(path.join(old, 'issues', 'repo1'), { recursive: true });
  writeFileSync(path.join(old, 'issues', 'repo1', 'ISS-0001.md'), 'issue\n');
  mkdirSync(path.join(home, '.axon', 'docs', 'issues'), { recursive: true });
  writeFileSync(path.join(home, '.axon', 'docs', 'issues', 'keep.md'), 'already here\n');
  const dry = archiveLegacy({ home, dryRun: true });
  assert.deepEqual(dry.docs.sort(), ['issues/repo1', 'plans']);
  const r = archiveLegacy({ home });
  assert.equal(readFileSync(path.join(home, '.axon', 'docs', 'plans', 'a.plan.md'), 'utf8'), 'plan a\n');
  assert.equal(readFileSync(path.join(home, '.axon', 'docs', 'issues', 'repo1', 'ISS-0001.md'), 'utf8'), 'issue\n');
  assert.equal(readFileSync(path.join(home, '.axon', 'docs', 'issues', 'keep.md'), 'utf8'), 'already here\n');
  assert.ok(!existsSync(path.join(old, 'plans')) && !existsSync(path.join(old, 'issues', 'repo1')));
  assert.deepEqual(r.docs.sort(), ['issues/repo1', 'plans']);
  restoreLegacy({ home });
  assert.equal(readFileSync(path.join(old, 'plans', 'a.plan.md'), 'utf8'), 'plan a\n');
  assert.equal(readFileSync(path.join(old, 'issues', 'repo1', 'ISS-0001.md'), 'utf8'), 'issue\n');
  assert.equal(readFileSync(path.join(home, '.axon', 'docs', 'issues', 'keep.md'), 'utf8'), 'already here\n');
});
