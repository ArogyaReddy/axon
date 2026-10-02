// Project kits (one per work repository): valid config, path-scoped rules (they load only when Claude touches matching
// files, so they cost no tokens otherwise), safety gates for each repo's dangerous commands, and the data-investigation
// rule built from the multi-agent-postgres-data-analytics patterns (read-only, scoped, active rows, gate, retry once).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installKit } from '../installer/kit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KITS = path.join(ROOT, 'project-kits');
const read = (...p) => readFileSync(path.join(KITS, ...p), 'utf8');

test('kits exist for the three work repositories', () => {
  assert.deepEqual(readdirSync(KITS).sort(), ['adp-e-automation', 'adp-e-product', 'pacer']);
});

test('every kit: verify commands, README, rules scoped by paths, a data rule', () => {
  for (const kit of readdirSync(KITS)) {
    const cfg = JSON.parse(read(kit, '.axon', 'config.json'));
    assert.ok(cfg.verify.commands.length && cfg.verify.commands.every(c => typeof c === 'string' && c.trim()), kit);
    assert.ok(existsSync(path.join(KITS, kit, 'README.md')), kit);
    for (const r of readdirSync(path.join(KITS, kit, '.claude', 'rules'))) {
      assert.match(read(kit, '.claude', 'rules', r), /^---\npaths: \[.+\]\n---\n/, `${kit}/${r} must be path-scoped`);
    }
    const data = read(kit, '.claude', 'rules', 'data.md');
    for (const must of [/read-only/i, /TransactionEndDateTime/, /ClientID/, /only the tables/i, /once/i]) assert.match(data, must, `${kit} data rule: ${must}`);
  }
});

test('adp-e-automation: lint verify, npm start rule, test.json protected, metagen DB sync asks first', () => {
  const cfg = JSON.parse(read('adp-e-automation', '.axon', 'config.json'));
  assert.ok(cfg.verify.commands.includes('npm run lint'));
  assert.ok(cfg.protected.paths.includes('test.json'));
  assert.match(read('adp-e-automation', '.claude', 'rules', 'tests.md'), /npm start/);
  const s = JSON.parse(read('adp-e-automation', '.claude', 'settings.local.json'));
  assert.ok(s.permissions.ask.includes('Bash(bash utils/syncMetagenToDB.sh)'));
  assert.ok(s.permissions.allow.includes('Bash(bash utils/syncMetagenToDB.sh --dry-run)'));
});

test('pacer: the local CI gate as verify; destructive API flags and live sweeps ask first; e2e exact matching rule', () => {
  const cfg = JSON.parse(read('pacer', '.axon', 'config.json'));
  assert.deepEqual(cfg.verify.commands, ['bash runner/scripts/ci-check.sh']);
  const s = JSON.parse(read('pacer', '.claude', 'settings.local.json'));
  for (const c of ['Bash(python pacer_flags.py set api.include_destructive *)', 'Bash(python api_runner.py --sweep*)']) assert.ok(s.permissions.ask.includes(c), c);
  assert.match(read('pacer', '.claude', 'rules', 'e2e.md'), /exact: true/);
  assert.match(read('pacer', '.claude', 'rules', 'flows.md'), /never\s+edit YAML to hide/i);
});

test('installing a kit copies it and never overwrites an existing file', () => {
  for (const kit of ['adp-e-automation', 'pacer']) {
    const repo = mkdtempSync(path.join(tmpdir(), `axon-kit-${kit}-`));
    mkdirSync(path.join(repo, '.git', 'hooks'), { recursive: true });
    const first = installKit({ axonRoot: ROOT, repo, kit });
    assert.ok(first.copied.includes('.axon/config.json'), kit);
    const again = installKit({ axonRoot: ROOT, repo, kit });
    assert.equal(again.copied.length, 0, kit);
  }
});
