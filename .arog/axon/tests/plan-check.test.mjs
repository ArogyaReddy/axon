import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, utimesSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPlan, REQUIRED_SECTIONS } from '../plugins/axon-core/lib/plan-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = readFileSync(path.join(ROOT, 'plugins', 'axon-core', 'templates', 'plan.md'), 'utf8');
const BIN = path.join(ROOT, 'plugins', 'axon-core', 'bin', 'axon-plan-check');

function goodPlan() {
  let t = TEMPLATE;
  t = t.replace(/\[[^\]\n]*\]/g, 'filled'); // fill every [placeholder]
  t = t.replace('<!-- criteria -->', '- AC1: tax on 8000 cents in TX is 500\n- AC2: SAVE10 on 10000 gives discount 1000');
  return t;
}

test('the template itself contains every required section', () => {
  for (const s of REQUIRED_SECTIONS) assert.ok(TEMPLATE.includes(`## ${s}`), s);
});

test('a filled plan passes', () => {
  assert.deepEqual(checkPlan(goodPlan()).problems, []);
});

test('the unfilled template fails: placeholders and no acceptance criteria', () => {
  const r = checkPlan(TEMPLATE);
  assert.ok(r.problems.some(p => /placeholder/i.test(p)));
  assert.ok(r.problems.some(p => /acceptance criteria/i.test(p)));
});

test('a missing section is reported by name', () => {
  const t = goodPlan().replace(/## 7\. TEST AFTER[\s\S]*?(?=\n## )/, '');
  assert.ok(checkPlan(t).problems.some(p => p.includes('7. TEST AFTER')));
});

test('acceptance criteria need at least one concrete bullet', () => {
  const t = goodPlan().replace(/- AC1[^\n]*\n- AC2[^\n]*/, '');
  assert.ok(checkPlan(t).problems.some(p => /acceptance criteria/i.test(p)));
});

test('CLI: exit 0 on a good plan, 1 with the problems on a bad one; --latest picks the newest plan', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-plans-'));
  const good = path.join(dir, 'a.plan.md'), bad = path.join(dir, 'b.plan.md');
  writeFileSync(good, goodPlan());
  writeFileSync(bad, TEMPLATE);
  assert.equal(spawnSync(process.execPath, [BIN, good], { encoding: 'utf8' }).status, 0);
  const r = spawnSync(process.execPath, [BIN, bad], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /placeholder/i);
  const old = new Date(Date.now() - 60_000);
  utimesSync(good, old, old);
  const latest = spawnSync(process.execPath, [BIN, '--latest', '--dir', dir], { encoding: 'utf8' });
  assert.equal(latest.status, 1, 'newest is the bad one');
  assert.match(latest.stdout + latest.stderr, /b\.plan\.md/);
});

test('lowercase leftovers like [path] are caught; markdown links and checkboxes are not', () => {
  const leftover = goodPlan().replace('## 3. WHERE', '## 3. WHERE\n\n| [path] | x |');
  assert.ok(checkPlan(leftover).problems.some(p => p.includes('[path]')));
  const links = goodPlan() + '\nSee [ADR-0004](docs/decisions/ADR-0004.md).\n- [ ] open item\n- [x] done item\n';
  assert.deepEqual(checkPlan(links).problems, []);
});

test('--hook mode: exit 2 (blocks) on an incomplete recent plan; exit 0 when no recent plan or plan is complete', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-plans-'));
  const env = { ...process.env, AXON_PLANS_DIR: dir };
  const run = () => spawnSync(process.execPath, [BIN, '--latest', '--hook', '--since-minutes', '60'], { encoding: 'utf8', env });
  assert.equal(run().status, 0, 'no plans at all');
  const p = path.join(dir, 'x.plan.md');
  writeFileSync(p, TEMPLATE);
  const blocked = run();
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /INCOMPLETE/);
  const old = new Date(Date.now() - 2 * 3600_000);
  utimesSync(p, old, old);
  assert.equal(run().status, 0, 'old plan is not this session\'s work');
  writeFileSync(p, goodPlan());
  assert.equal(run().status, 0);
});

test('axon-plan-new creates a plan from the template in AXON_PLANS_DIR, refuses to overwrite', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-plans-'));
  const env = { ...process.env, AXON_PLANS_DIR: dir };
  const NEW = path.join(ROOT, 'plugins', 'axon-core', 'bin', 'axon-plan-new');
  const r = spawnSync(process.execPath, [NEW, 'invoice-tax-bug-2026-10-01'], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  const file = path.join(dir, 'invoice-tax-bug-2026-10-01.plan.md');
  assert.equal(r.stdout.trim(), file, 'prints only the path');
  assert.equal(readFileSync(file, 'utf8'), TEMPLATE);
  assert.equal(spawnSync(process.execPath, [NEW, 'invoice-tax-bug-2026-10-01'], { encoding: 'utf8', env }).status, 1, 'no overwrite');
  assert.equal(spawnSync(process.execPath, [NEW, '../escape'], { encoding: 'utf8', env }).status, 1, 'slug must be a plain name');
});
