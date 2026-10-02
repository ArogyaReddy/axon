import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { newIssue, listIssues, setStatus, fixIssue, closeIssue, readIssue, resolveIssuesDir, parseIssue } from '../plugins/axon-core/lib/issues.mjs';

const tracker = () => mkdtempSync(path.join(tmpdir(), 'axon-issues-'));
const NOW = new Date('2026-09-30T12:00:00Z');

function fillSections(file, { root = 'The detector only checked the final symlink target.', fix = 'Check every hop; write through symlinks. installer/homemanager.mjs' } = {}) {
  let t = readFileSync(file, 'utf8');
  t = t.replace(/## Root cause\n\n_TODO_/, `## Root cause\n\n${root}`).replace(/## Fix\n\n_TODO_/, `## Fix\n\n${fix}`);
  writeFileSync(file, t);
}

test('new issue gets the next id, a slug file, all fields and all sections', () => {
  const dir = tracker();
  const a = newIssue(dir, { title: 'Home-manager symlink not detected', severity: 'high', type: 'bug', foundIn: 'implementation', foundBy: 'axon doctor on real machine', files: ['installer/homemanager.mjs'], now: NOW });
  const b = newIssue(dir, { title: 'Second one', severity: 'low', type: 'gap', foundIn: 'review', now: NOW });
  assert.equal(a.id, 'ISS-0001');
  assert.equal(b.id, 'ISS-0002');
  assert.equal(path.basename(a.file), 'ISS-0001-home-manager-symlink-not-detected.md');
  const text = readFileSync(a.file, 'utf8');
  for (const s of ['## What happened', '## How it was found', '## Root cause', '## Impact', '## Fix', '## Verification', '## Lessons']) assert.ok(text.includes(s), s);
  const issue = parseIssue(text);
  assert.equal(issue.status, 'open');
  assert.equal(issue.severity, 'high');
  assert.equal(issue.found, '2026-09-30');
  assert.equal(issue.found_in, 'implementation');
  assert.equal(issue.files, 'installer/homemanager.mjs');
});

test('invalid severity, type or found-in are rejected', () => {
  const dir = tracker();
  assert.throws(() => newIssue(dir, { title: 'x', severity: 'urgent', type: 'bug', foundIn: 'review' }), /severity/);
  assert.throws(() => newIssue(dir, { title: 'x', severity: 'low', type: 'feature', foundIn: 'review' }), /type/);
  assert.throws(() => newIssue(dir, { title: 'x', severity: 'low', type: 'bug', foundIn: 'lunch' }), /found-in/);
  assert.throws(() => newIssue(dir, { title: '', severity: 'low', type: 'bug', foundIn: 'review' }), /title/);
});

test('fix is refused without verification evidence', () => {
  const dir = tracker();
  const a = newIssue(dir, { title: 'Bug', severity: 'high', type: 'bug', foundIn: 'test', now: NOW });
  fillSections(a.file);
  assert.throws(() => fixIssue(dir, 'ISS-0001', { verifiedBy: '' }), /evidence/);
});

test('fix is refused while root cause or fix sections are still TODO', () => {
  const dir = tracker();
  newIssue(dir, { title: 'Bug', severity: 'high', type: 'bug', foundIn: 'test', now: NOW });
  assert.throws(() => fixIssue(dir, 'ISS-0001', { verifiedBy: 'tests/x.test.mjs' }), /Root cause/);
});

test('fix records status, date, commit, evidence and files', () => {
  const dir = tracker();
  const a = newIssue(dir, { title: 'Bug', severity: 'high', type: 'bug', foundIn: 'test', now: NOW });
  fillSections(a.file);
  fixIssue(dir, 'ISS-0001', { verifiedBy: 'tests/install.test.mjs: out-of-store link detected', commit: 'abc1234', files: ['installer/install.mjs'], now: NOW });
  const i = readIssue(dir, 'ISS-0001');
  assert.equal(i.status, 'fixed');
  assert.equal(i.fixed, '2026-09-30');
  assert.equal(i.fix_commit, 'abc1234');
  assert.equal(i.verified_by, 'tests/install.test.mjs: out-of-store link detected');
  assert.match(i.files, /installer\/install\.mjs/);
});

test('start and close (wont-fix needs a reason)', () => {
  const dir = tracker();
  newIssue(dir, { title: 'A', severity: 'low', type: 'risk', foundIn: 'plan', now: NOW });
  setStatus(dir, 'ISS-0001', 'in-progress');
  assert.equal(readIssue(dir, 'ISS-0001').status, 'in-progress');
  assert.throws(() => closeIssue(dir, 'ISS-0001', { as: 'wont-fix', reason: '' }), /reason/);
  closeIssue(dir, 'ISS-0001', { as: 'wont-fix', reason: 'Accepted risk for personal use' });
  assert.equal(readIssue(dir, 'ISS-0001').status, 'wont-fix');
});

test('unknown id is a clear error', () => {
  assert.throws(() => readIssue(tracker(), 'ISS-0099'), /ISS-0099 not found/);
});

test('INDEX.md is regenerated on every change, open issues first', () => {
  const dir = tracker();
  const a = newIssue(dir, { title: 'Fixed one', severity: 'critical', type: 'bug', foundIn: 'test', now: NOW });
  newIssue(dir, { title: 'Open one', severity: 'medium', type: 'gap', foundIn: 'review', now: NOW });
  fillSections(a.file);
  fixIssue(dir, 'ISS-0001', { verifiedBy: 'test', now: NOW });
  const index = readFileSync(path.join(dir, 'INDEX.md'), 'utf8');
  assert.ok(index.indexOf('ISS-0002') < index.indexOf('ISS-0001'), 'open before fixed');
  assert.match(index, /1 open, 0 in progress, 1 fixed, 0 closed/);
});

test('list filters by status and feature', () => {
  const dir = tracker();
  newIssue(dir, { title: 'A', severity: 'low', type: 'bug', foundIn: 'test', feature: 'policy-create', now: NOW });
  newIssue(dir, { title: 'B', severity: 'low', type: 'bug', foundIn: 'test', now: NOW });
  setStatus(dir, 'ISS-0002', 'in-progress');
  assert.deepEqual(listIssues(dir, { status: 'open' }).map(i => i.id), ['ISS-0001']);
  assert.deepEqual(listIssues(dir, { feature: 'policy-create' }).map(i => i.id), ['ISS-0001']);
  assert.equal(listIssues(dir).length, 2);
});

test('issues dir: repo config wins, otherwise ~/.axon/docs/issues/<repo>', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-h-'));
  const repo = mkdtempSync(path.join(tmpdir(), 'my-repo-'));
  assert.equal(resolveIssuesDir({ cwd: repo, home }), path.join(home, '.axon', 'docs', 'issues', path.basename(repo)));
  mkdirSync(path.join(repo, '.axon'));
  writeFileSync(path.join(repo, '.axon', 'config.json'), JSON.stringify({ issues: { dir: 'docs/issues' } }));
  assert.equal(resolveIssuesDir({ cwd: path.join(repo), home }), path.join(repo, 'docs', 'issues'));
});

test('a second issue with the same title is refused unless forced (ISS-0021)', () => {
  const dir = tracker();
  newIssue(dir, { title: 'Login breaks', severity: 'high', type: 'bug', foundIn: 'test', now: NOW });
  assert.throws(() => newIssue(dir, { title: '  login BREAKS ', severity: 'high', type: 'bug', foundIn: 'test', now: NOW }), /ISS-0001 already tracks/);
  assert.equal(newIssue(dir, { title: 'Login breaks', severity: 'high', type: 'regression', foundIn: 'test', related: 'ISS-0001', force: true, now: NOW }).id, 'ISS-0002');
});

test('ids keep counting after files are removed (no reuse)', () => {
  const dir = tracker();
  newIssue(dir, { title: 'A', severity: 'low', type: 'bug', foundIn: 'test', now: NOW });
  const b = newIssue(dir, { title: 'B', severity: 'low', type: 'bug', foundIn: 'test', now: NOW });
  rmSync(b.file); // someone deletes the newest issue file
  assert.equal(readdirSync(dir).filter(f => f.startsWith('ISS-')).length, 1);
  assert.equal(newIssue(dir, { title: 'C', severity: 'low', type: 'bug', foundIn: 'test', now: NOW }).id, 'ISS-0003');
});

test('issues dir honours AXON_ISSUES_DIR, then AXON_DOCS_DIR (tests never touch the real ~/.axon/docs)', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-h-'));
  const repo = mkdtempSync(path.join(tmpdir(), 'my-repo-'));
  const docs = mkdtempSync(path.join(tmpdir(), 'axon-docs-'));
  const saved = { i: process.env.AXON_ISSUES_DIR, d: process.env.AXON_DOCS_DIR };
  try {
    process.env.AXON_DOCS_DIR = docs; delete process.env.AXON_ISSUES_DIR;
    assert.equal(resolveIssuesDir({ cwd: repo, home }), path.join(docs, 'issues', path.basename(repo)));
    process.env.AXON_ISSUES_DIR = path.join(docs, 'explicit');
    assert.equal(resolveIssuesDir({ cwd: repo, home }), path.join(docs, 'explicit'));
  } finally {
    for (const [k, v] of [['AXON_ISSUES_DIR', saved.i], ['AXON_DOCS_DIR', saved.d]]) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
