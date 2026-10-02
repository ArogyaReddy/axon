// Pinned external tools (config/tools.json): one module reports what is installed, installs only what is missing or
// drifted (so `axon install` can run it every time), and feeds axon doctor a check per tool.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolStatus, installTools } from '../installer/tools.mjs';
import { doctor } from '../installer/doctor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function homeWith(installed) {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-tools-'));
  mkdirSync(path.join(home, '.claude'));
  for (const [name, pkg, version] of installed) {
    const dir = path.join(home, '.axon', 'tools', name, 'node_modules', ...pkg.split('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: pkg, version }));
  }
  return home;
}

test('status: every pin with the version installed (or none)', () => {
  const home = homeWith([['playwright-cli', '@playwright/cli', '0.1.22'], ['markmap', 'markmap-cli', '0.17.0']]);
  const s = Object.fromEntries(toolStatus({ home, axonRoot: ROOT }).map(t => [t.name, t]));
  assert.deepEqual([s['playwright-cli'].have, s['playwright-cli'].want], ['0.1.22', '0.1.22']);
  assert.deepEqual([s.markmap.have, s.markmap.want], ['0.17.0', '0.18.12']);
});

test('install: only missing or drifted tools, with the exact pinned package; nothing when all match', () => {
  const home = homeWith([['playwright-cli', '@playwright/cli', '0.1.22'], ['markmap', 'markmap-cli', '0.17.0']]);
  const calls = [];
  const run = args => { calls.push(args); return { status: 0 }; };
  const r = installTools({ home, axonRoot: ROOT, run });
  assert.deepEqual(r.installed, ['markmap']);
  assert.deepEqual(calls, [['install', '--no-audit', '--no-fund', '--prefix', path.join(home, '.axon', 'tools', 'markmap'), 'markmap-cli@0.18.12']]);
  const all = homeWith([['playwright-cli', '@playwright/cli', '0.1.22'], ['markmap', 'markmap-cli', '0.18.12']]);
  assert.deepEqual(installTools({ home: all, axonRoot: ROOT, run: () => assert.fail('no install expected') }).installed, []);
});

test('install: a failing npm stops with the package named', () => {
  const home = homeWith([]);
  assert.throws(() => installTools({ home, axonRoot: ROOT, run: () => ({ status: 1 }) }), /@playwright\/cli@0\.1\.22/);
});

test('doctor: one check per pinned tool', () => {
  const home = homeWith([['playwright-cli', '@playwright/cli', '0.1.22']]);
  const r = doctor({ home, axonRoot: ROOT, PATH: '/nonexistent' });
  assert.equal(r.checks.find(c => c.id === 'playwright-cli').status, 'pass');
  const mm = r.checks.find(c => c.id === 'markmap');
  assert.equal(mm.status, 'warn');
  assert.match(mm.message, /axon tools install/);
});
