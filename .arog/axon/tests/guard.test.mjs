// P1 quality core: tdd-gate, test-lock, test-evidence, stop-gate, axon-task, axon-unlock-test, axon-verify.
// Hooks are driven exactly as Claude Code drives them: JSON on stdin, decision JSON on stdout.
// Payloads come from real captures (tests/fixtures/payloads), with paths replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, parseTestRun } from '../plugins/axon-guard/lib/state.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(ROOT, 'plugins', 'axon-guard');
const HOOK = name => path.join(GUARD, 'hooks', 'bin', `${name}.mjs`);
const BIN = name => path.join(GUARD, 'bin', name);
const fixture = name => readFileSync(path.join(ROOT, 'tests', 'fixtures', 'payloads', `${name}.json`), 'utf8');

function repo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-repo-'));
  mkdirSync(path.join(dir, '.git'));
  mkdirSync(path.join(dir, 'src'));
  mkdirSync(path.join(dir, 'test'));
  writeFileSync(path.join(dir, 'src', 'calc.js'), 'module.exports = {};\n');
  const state = mkdtempSync(path.join(tmpdir(), 'axon-state-'));
  const home = mkdtempSync(path.join(tmpdir(), 'axon-home-')); // decision logs stay out of the real ~/.axon
  return { dir, env: { ...process.env, AXON_HOME: home, AXON_STATE_DIR: state } };
}

function payload(name, r, patch = {}) {
  const p = JSON.parse(fixture(name).replaceAll('${REPO}', r.dir));
  return { ...p, ...patch, tool_input: { ...p.tool_input, ...(patch.tool_input ?? {}) } };
}

function hook(name, r, body) {
  const res = spawnSync(process.execPath, [HOOK(name)], { input: JSON.stringify(body), encoding: 'utf8', env: r.env });
  let json = null;
  try { json = res.stdout.trim() ? JSON.parse(res.stdout) : null; } catch { /* not JSON */ }
  return { code: res.status, json, stdout: res.stdout, stderr: res.stderr };
}

function cli(name, r, ...args) {
  const res = spawnSync(process.execPath, [BIN(name), ...args], { cwd: r.dir, encoding: 'utf8', env: r.env });
  return { code: res.status, out: res.stdout + res.stderr };
}

const edit = (r, rel) => payload('pre-write', r, { tool_input: { file_path: path.join(r.dir, rel), content: 'x' } });
const edited = (r, rel) => payload('post-write', r, { tool_input: { file_path: path.join(r.dir, rel), content: 'x' } });
const denied = res => res.json?.hookSpecificOutput?.permissionDecision === 'deny';
const failRun = r => payload('post-bash-fail', r);
const passRun = r => payload('post-bash-ok', r, { tool_input: { command: 'node --test' }, tool_response: { stdout: 'ℹ tests 2\nℹ pass 2\nℹ fail 0\n', stderr: '' } });

// ---------- classification and parsing ----------

test('classify: tests, source and other files', () => {
  const r = repo();
  assert.equal(classify(r.dir, path.join(r.dir, 'test', 'a.test.mjs')), 'test');
  assert.equal(classify(r.dir, path.join(r.dir, 'src', 'x.spec.ts')), 'test');
  assert.equal(classify(r.dir, path.join(r.dir, 'tests', 'hr', 'events', 'a.ts')), 'test');
  assert.equal(classify(r.dir, path.join(r.dir, '__tests__', 'a.js')), 'test');
  assert.equal(classify(r.dir, path.join(r.dir, 'src', 'calc.js')), 'source');
  assert.equal(classify(r.dir, path.join(r.dir, 'src', 'ui', 'Form.tsx')), 'source');
  assert.equal(classify(r.dir, path.join(r.dir, 'README.md')), 'other');
  assert.equal(classify(r.dir, path.join(r.dir, 'i18n', 'messages-en.json')), 'other');
});

test('classify honours .axon/config.json tests.patterns', () => {
  const r = repo();
  mkdirSync(path.join(r.dir, '.axon'));
  writeFileSync(path.join(r.dir, '.axon', 'config.json'), JSON.stringify({ tests: { patterns: ['qa/**'] } }));
  assert.equal(classify(r.dir, path.join(r.dir, 'qa', 'flow.js')), 'test');
});

test('parseTestRun understands node --test, jest, pytest; ignores other commands', () => {
  assert.deepEqual(parseTestRun('node --test', 'ℹ pass 1\nℹ fail 2', 1), { isTest: true, pass: 1, fail: 2, exit: 1 });
  assert.deepEqual(parseTestRun('TEST_BUSINESS_DOMAIN=hr npx jest tests/a.spec.ts', 'Tests:       1 failed, 3 passed, 4 total', 1), { isTest: true, pass: 3, fail: 1, exit: 1 });
  assert.deepEqual(parseTestRun('pytest -q', '2 failed, 5 passed in 0.12s', 1), { isTest: true, pass: 5, fail: 2, exit: 1 });
  assert.deepEqual(parseTestRun('npm test', 'Tests:       4 passed, 4 total', 0), { isTest: true, pass: 4, fail: 0, exit: 0 });
  assert.equal(parseTestRun('git status', '', 0).isTest, false);
});

// ---------- no task: hooks stay out of the way ----------

test('without an active task, source edits are allowed', () => {
  const r = repo();
  const res = hook('pre-edit', r, edit(r, 'src/calc.js'));
  assert.equal(res.code, 0);
  assert.ok(!denied(res));
});

// ---------- RED ----------

test('RED: source edits are denied, test and other edits allowed', () => {
  const r = repo();
  assert.equal(cli('axon-task', r, 'start', 'add-discount').code, 0);
  const src = hook('pre-edit', r, edit(r, 'src/calc.js'));
  assert.ok(denied(src), src.stdout);
  assert.match(src.json.hookSpecificOutput.permissionDecisionReason, /RED/);
  assert.ok(!denied(hook('pre-edit', r, edit(r, 'test/calc.test.mjs'))));
  assert.ok(!denied(hook('pre-edit', r, edit(r, 'README.md'))));
});

test('RED -> GREEN is refused without a test edit followed by a failing run', () => {
  const r = repo();
  cli('axon-task', r, 'start', 't');
  assert.equal(cli('axon-task', r, 'phase', 'GREEN').code, 1, 'no evidence at all');
  hook('post-tool', r, failRun(r)); // a failing run, but no test was written in this task
  const res = cli('axon-task', r, 'phase', 'GREEN');
  assert.equal(res.code, 1);
  assert.match(res.out, /no test file was written/i);
});

test('a failing run BEFORE the test edit does not count', () => {
  const r = repo();
  cli('axon-task', r, 'start', 't');
  hook('post-tool', r, failRun(r));
  hook('post-tool', r, edited(r, 'test/calc.test.mjs'));
  assert.equal(cli('axon-task', r, 'phase', 'GREEN').code, 1);
});

test('test edit, then a failing run (PostToolUseFailure), allows GREEN', () => {
  const r = repo();
  cli('axon-task', r, 'start', 't');
  hook('post-tool', r, edited(r, 'test/calc.test.mjs'));
  hook('post-tool', r, failRun(r));
  const res = cli('axon-task', r, 'phase', 'GREEN');
  assert.equal(res.code, 0, res.out);
});

// ---------- GREEN / test-lock ----------

function toGreen(r) {
  cli('axon-task', r, 'start', 't');
  hook('post-tool', r, edited(r, 'test/calc.test.mjs'));
  hook('post-tool', r, failRun(r));
  assert.equal(cli('axon-task', r, 'phase', 'GREEN').code, 0);
}

test('GREEN: source edits allowed, test edits locked', () => {
  const r = repo();
  toGreen(r);
  assert.ok(!denied(hook('pre-edit', r, edit(r, 'src/calc.js'))));
  const t = hook('pre-edit', r, edit(r, 'test/calc.test.mjs'));
  assert.ok(denied(t));
  assert.match(t.json.hookSpecificOutput.permissionDecisionReason, /axon-unlock-test/);
});

test('unlock needs a reason, then allows that one test file and records the reason', () => {
  const r = repo();
  toGreen(r);
  assert.equal(cli('axon-unlock-test', r, 'test/calc.test.mjs').code, 1);
  assert.equal(cli('axon-unlock-test', r, 'test/calc.test.mjs', '--reason', 'expected total was 9094, correct is 10094').code, 0);
  assert.ok(!denied(hook('pre-edit', r, edit(r, 'test/calc.test.mjs'))));
  assert.ok(denied(hook('pre-edit', r, edit(r, 'test/other.test.mjs'))), 'only the unlocked file');
  assert.match(cli('axon-task', r, 'status').out, /9094/);
});

test('GREEN -> REFACTOR needs a passing run after the last source edit', () => {
  const r = repo();
  toGreen(r);
  hook('post-tool', r, edited(r, 'src/calc.js'));
  assert.equal(cli('axon-task', r, 'phase', 'REFACTOR').code, 1, 'no passing run yet');
  hook('post-tool', r, passRun(r));
  assert.equal(cli('axon-task', r, 'phase', 'REFACTOR').code, 0);
});

// ---------- DONE / axon-verify ----------

function verifyConfig(r, command) {
  mkdirSync(path.join(r.dir, '.axon'), { recursive: true });
  writeFileSync(path.join(r.dir, '.axon', 'config.json'), JSON.stringify({ verify: { commands: [command] } }));
}

test('DONE needs a passing axon-verify newer than the last source edit', () => {
  const r = repo();
  toGreen(r);
  hook('post-tool', r, edited(r, 'src/calc.js'));
  hook('post-tool', r, passRun(r));
  assert.equal(cli('axon-task', r, 'phase', 'DONE').code, 1, 'no verify yet');
  verifyConfig(r, 'node -e "process.exit(1)"');
  assert.equal(cli('axon-verify', r).code, 1);
  assert.equal(cli('axon-task', r, 'phase', 'DONE').code, 1, 'verify failed');
  verifyConfig(r, 'node -e "process.exit(0)"');
  assert.equal(cli('axon-verify', r).code, 0);
  assert.equal(cli('axon-task', r, 'phase', 'DONE').code, 0);
  assert.match(cli('axon-task', r, 'status').out, /no active task/i, 'task archived');
});

test('a source edit after verify makes DONE stale', () => {
  const r = repo();
  toGreen(r);
  verifyConfig(r, 'node -e "process.exit(0)"');
  cli('axon-verify', r);
  hook('post-tool', r, edited(r, 'src/calc.js'));
  assert.equal(cli('axon-task', r, 'phase', 'DONE').code, 1);
});

test('axon-verify with no configured or detectable commands fails loudly', () => {
  const r = repo();
  const res = cli('axon-verify', r);
  assert.equal(res.code, 1);
  assert.match(res.out, /no verify commands/i);
});

test('axon-verify runs package.json scripts lint, typecheck, test when present', () => {
  const r = repo();
  writeFileSync(path.join(r.dir, 'package.json'), JSON.stringify({ scripts: { lint: 'node -e "0"', test: 'node -e "0"' } }));
  const res = cli('axon-verify', r);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /npm run lint/);
  assert.match(res.out, /npm test/);
});

// ---------- transitions ----------

test('invalid transitions and phases are refused', () => {
  const r = repo();
  assert.equal(cli('axon-task', r, 'phase', 'GREEN').code, 1, 'no task');
  cli('axon-task', r, 'start', 't');
  assert.equal(cli('axon-task', r, 'phase', 'DONE').code, 1, 'RED -> DONE');
  assert.equal(cli('axon-task', r, 'phase', 'BLUE').code, 1, 'unknown phase');
  assert.equal(cli('axon-task', r, 'start', 'other').code, 1, 'one active task per repo');
});

test('abort needs a reason and ends the task', () => {
  const r = repo();
  cli('axon-task', r, 'start', 't');
  assert.equal(cli('axon-task', r, 'abort').code, 1);
  assert.equal(cli('axon-task', r, 'abort', '--reason', 'requirements changed').code, 0);
  assert.ok(!denied(hook('pre-edit', r, edit(r, 'src/calc.js'))));
});

// ---------- stop-gate ----------

test('stop-gate: blocks once when source changed without a passing verify', () => {
  const r = repo();
  hook('post-tool', r, edited(r, 'src/calc.js'));
  const res = hook('stop-gate', r, payload('stop', r));
  assert.equal(res.json?.decision, 'block');
  assert.match(res.json.reason, /axon-verify/);
  const again = hook('stop-gate', r, payload('stop', r, { stop_hook_active: true }));
  assert.notEqual(again.json?.decision, 'block', 'never loops');
});

test('stop-gate: allows when nothing changed or verify passed after the change', () => {
  const r = repo();
  assert.notEqual(hook('stop-gate', r, payload('stop', r)).json?.decision, 'block');
  hook('post-tool', r, edited(r, 'src/calc.js'));
  verifyConfig(r, 'node -e "process.exit(0)"');
  cli('axon-verify', r);
  assert.notEqual(hook('stop-gate', r, payload('stop', r)).json?.decision, 'block');
});

test('stop-gate: docs-only changes do not require verify', () => {
  const r = repo();
  hook('post-tool', r, edited(r, 'README.md'));
  assert.notEqual(hook('stop-gate', r, payload('stop', r)).json?.decision, 'block');
});

// ---------- robustness ----------

test('hooks fail open on malformed input, with a visible warning', () => {
  const r = repo();
  const res = spawnSync(process.execPath, [HOOK('pre-edit')], { input: '{ not json', encoding: 'utf8', env: r.env });
  assert.equal(res.status, 0);
  assert.match(res.stderr, /axon-guard/);
});

test('state is per repository', () => {
  const a = repo();
  const b = { ...repo(), env: a.env }; // same state dir, different repo
  cli('axon-task', a, 'start', 't');
  assert.ok(denied(hook('pre-edit', a, edit(a, 'src/calc.js'))));
  assert.ok(!denied(hook('pre-edit', b, edit(b, 'src/calc.js'))));
});

test('files outside any git repo are never gated', () => {
  const r = repo();
  cli('axon-task', r, 'start', 't');
  const outside = mkdtempSync(path.join(tmpdir(), 'axon-outside-'));
  const res = hook('pre-edit', r, payload('pre-write', r, { cwd: outside, tool_input: { file_path: path.join(outside, 'x.js'), content: 'x' } }));
  assert.ok(!denied(res));
});

test('hooks.json registers PostToolUseFailure, so failing test runs are recorded', () => {
  const h = JSON.parse(readFileSync(path.join(GUARD, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const ev of ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop']) assert.ok(h[ev], ev);
  assert.ok(existsSync(BIN('axon-task')) && existsSync(BIN('axon-unlock-test')) && existsSync(BIN('axon-verify')));
});

test('a repo reached through a symlink shares one state (ISS-0022)', () => {
  const r = repo();
  const linkParent = mkdtempSync(path.join(tmpdir(), 'axon-link-'));
  const link = path.join(linkParent, 'linked-repo');
  symlinkSync(r.dir, link);
  cli('axon-task', r, 'start', 't'); // CLI runs in the real path
  const viaLink = { ...r, dir: link };
  assert.ok(denied(hook('pre-edit', r, edit(viaLink, 'src/calc.js'))), 'hook sees the symlinked path and must still find the task');
});
