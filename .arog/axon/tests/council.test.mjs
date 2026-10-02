// axon-council: runs the five advisors and five reviewers as parallel `claude -p --agent council-advisor` processes,
// anonymizes and rotates answers in code, and writes the transcript itself. Driven here with a fake claude binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, chmodSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'plugins', 'axon-core', 'bin', 'axon-council');
const LENSES = ['Contrarian', 'First principles', 'Expansionist', 'Outsider', 'Executor'];

// Fake claude: logs its argv and prompt, sleeps, answers like `claude -p --output-format json`.
function setup({ sleep = 0.6, failFirstFor = '', stagger = 300 } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-council-'));
  const log = path.join(dir, 'calls');
  mkdirSync(log);
  const fake = path.join(dir, 'claude');
  writeFileSync(fake, `#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
const args = process.argv.slice(2); const prompt = args[args.indexOf('-p') + 1];
const id = Date.now() + '-' + Math.random().toString(16).slice(2);
fs.writeFileSync(path.join(${JSON.stringify(log)}, id + '.json'), JSON.stringify({ args, prompt, start: Date.now() }));
const lens = (/Lens: ([^.]+)\\./.exec(prompt) || [])[1];
const marker = path.join(${JSON.stringify(dir)}, 'failed-once');
if (${JSON.stringify(failFirstFor)} && lens === ${JSON.stringify(failFirstFor)} && !fs.existsSync(marker)) { fs.writeFileSync(marker, ''); process.exit(1); }
setTimeout(() => {
  const result = lens ? 'Answer from ' + lens + '. Position: do it.' : 'Strongest: A. Blind spot: C. Missed: rollout.';
  process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result, total_cost_usd: 0.05 }));
}, ${sleep * 1000});
`);
  chmodSync(fake, 0o755);
  const question = path.join(dir, 'question.md');
  writeFileSync(question, 'Should we turn tdd-gate on by default?\n');
  const out = path.join(dir, 'transcript.md');
  const env = { ...process.env, AXON_CLAUDE_BIN: fake, AXON_COUNCIL_STAGGER_MS: String(stagger) };
  const run = (...extra) => spawnSync(process.execPath, [CLI, '--question', question, '--out', out, ...extra], { encoding: 'utf8', env });
  const calls = () => readdirSync(log).map(f => JSON.parse(readFileSync(path.join(log, f), 'utf8')));
  return { run, calls, out };
}

test('runs 5 advisors then 5 reviewers, each round in parallel', () => {
  const t = setup({ sleep: 0.8 });
  const t0 = Date.now();
  const r = t.run();
  const wall = (Date.now() - t0) / 1000;
  assert.equal(r.status, 0, r.stderr);
  const calls = t.calls();
  assert.equal(calls.length, 10);
  assert.ok(wall < 4, `two parallel rounds of 0.8 s took ${wall.toFixed(1)} s (sequential would be 8 s)`);
  const advise = calls.filter(c => c.prompt.startsWith('Mode ADVISE.'));
  assert.deepEqual(advise.map(c => /Lens: ([^.]+)\./.exec(c.prompt)[1]).sort(), [...LENSES].sort());
  const firstReview = Math.min(...calls.filter(c => c.prompt.startsWith('Mode REVIEW.')).map(c => c.start));
  assert.ok(Math.max(...advise.map(c => c.start)) < firstReview, 'reviews start after all advice is in');
});

test('every call is Sonnet, as the council-advisor agent, with no session saved', () => {
  const t = setup({ sleep: 0 });
  t.run();
  for (const c of t.calls()) {
    assert.equal(c.args[c.args.indexOf('--model') + 1], 'sonnet');
    assert.match(c.args[c.args.indexOf('--agent') + 1], /(^|:)council-advisor$/);
    assert.ok(c.args.includes('--no-session-persistence'));
    assert.ok(c.args.includes('--strict-mcp-config'));
  }
});

test('reviewers see anonymized answers: no lens names, letters A-E, a different first answer each', () => {
  const t = setup({ sleep: 0 });
  t.run();
  const reviews = t.calls().filter(c => c.prompt.startsWith('Mode REVIEW.'));
  assert.equal(reviews.length, 5);
  for (const c of reviews) {
    assert.doesNotMatch(c.prompt, /Lens:/);
    for (const L of 'ABCDE') assert.match(c.prompt, new RegExp(`### Answer ${L}`));
  }
  const firstShown = reviews.map(c => /### Answer ([A-E])/.exec(c.prompt)[1]);
  assert.equal(new Set(firstShown).size, 5, `first answer per reviewer: ${firstShown}`);
});

test('the transcript is written by code: question, answers by lens, letter map, reviews, cost', () => {
  const t = setup({ sleep: 0 });
  const r = t.run();
  const md = readFileSync(t.out, 'utf8');
  assert.match(md, /Should we turn tdd-gate on by default\?/);
  for (const lens of LENSES) assert.match(md, new RegExp(`## ${lens}\\n\\nAnswer from ${lens}`));
  assert.match(md, /Letter map: A = [A-Za-z ]+, B = /);
  assert.equal((md.match(/Strongest: A/g) || []).length, 5);
  assert.match(md, /Cost: \$0\.50 \(10 calls\)/);
  assert.match(md, /## Verdict\n\n_\(chairman: add the verdict here\)_/);
  assert.match(r.stdout, /transcript\.md/);
  assert.match(r.stdout, /## Contrarian/, 'stdout carries the answers for the chairman');
});

test('a failed advisor call is retried once', () => {
  const t = setup({ sleep: 0, failFirstFor: 'Outsider' });
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(t.calls().filter(c => c.prompt.includes('Lens: Outsider.')).length, 2);
  assert.match(readFileSync(t.out, 'utf8'), /Answer from Outsider/);
});

test('cost controls: project settings only, medium effort; reviews run without tools', () => {
  const t = setup({ sleep: 0 });
  t.run();
  for (const c of t.calls()) {
    assert.equal(c.args[c.args.indexOf('--setting-sources') + 1], 'project');
    assert.equal(JSON.parse(c.args[c.args.indexOf('--settings') + 1]).effortLevel, 'medium');
    const review = c.prompt.startsWith('Mode REVIEW.');
    assert.equal(c.args.includes('--tools') && c.args[c.args.indexOf('--tools') + 1] === '', review, c.prompt.slice(0, 30));
  }
});

// Parallel calls cannot reuse each other's prompt cache, so each round starts one call first and the other four
// after a short delay, once the shared prefix is cached (cache writes cost 20x cache reads).
// Start times are taken inside the fake claude, after Node starts, which varies by 100+ ms under a parallel test run:
// the stagger is wide (1500 ms) and the checks compare against half of it, so load cannot flip the result.
test('each round starts one call, then the other four after the stagger delay', () => {
  const t = setup({ sleep: 0.2, stagger: 1500 });
  t.run();
  for (const mode of ['Mode ADVISE.', 'Mode REVIEW.']) {
    const starts = t.calls().filter(c => c.prompt.startsWith(mode)).map(c => c.start).sort((a, b) => a - b);
    assert.ok(starts[1] - starts[0] >= 750, `${mode} second call ${starts[1] - starts[0]} ms after the first`);
    assert.ok(starts[4] - starts[1] < 750, `${mode} the other four start together (${starts[4] - starts[1]} ms spread)`);
  }
});

test('--verdict fills the transcript placeholder from stdin, once', () => {
  const t = setup({ sleep: 0 });
  t.run();
  const put = text => spawnSync(process.execPath, [CLI, '--verdict', t.out], { input: text, encoding: 'utf8' });
  const r = put('VERDICT: pilot on payroll paths\n');
  assert.equal(r.status, 0, r.stderr);
  const md = readFileSync(t.out, 'utf8');
  assert.match(md, /## Verdict\n\nVERDICT: pilot on payroll paths/);
  assert.doesNotMatch(md, /chairman: add the verdict here/);
  assert.notEqual(put('again').status, 0, 'a second verdict is refused');
});

// Files are read once by code and sent as the system prompt, which Claude Code caches: one cache write, nine reads.
test('--files: numbered file contents in the system prompt, identical for all 10 calls; no tools then', () => {
  const t = setup({ sleep: 0 });
  const dir = path.dirname(t.out);
  writeFileSync(path.join(dir, 'a.md'), 'alpha\nbeta\n');
  writeFileSync(path.join(dir, 'b.js'), 'const x = 1;\n');
  const r = spawnSync(process.execPath, [CLI, '--question', path.join(dir, 'question.md'), '--out', t.out, '--files', 'a.md,b.js'],
    { encoding: 'utf8', cwd: dir, env: { ...process.env, AXON_CLAUDE_BIN: path.join(dir, 'claude'), AXON_COUNCIL_STAGGER_MS: '0' } });
  assert.equal(r.status, 0, r.stderr);
  const calls = t.calls();
  const sys = calls.map(c => c.args[c.args.indexOf('--append-system-prompt') + 1]);
  assert.equal(new Set(sys).size, 1, 'same system prompt for every call, so it is cached once');
  assert.match(sys[0], /=== a\.md ===\n {4}1\talpha\n {4}2\tbeta/);
  assert.match(sys[0], /=== b\.js ===\n {4}1\tconst x = 1;/);
  for (const c of calls) assert.equal(c.args[c.args.indexOf('--tools') + 1], '', 'no tools when the files are given');
  for (const c of calls) assert.ok(!c.prompt.includes('alpha'), 'file text is not repeated in the user message');
});

test('--files: a missing file is refused; oversized context is capped', () => {
  const t = setup({ sleep: 0 });
  const dir = path.dirname(t.out);
  const base = { encoding: 'utf8', cwd: dir, env: { ...process.env, AXON_CLAUDE_BIN: path.join(dir, 'claude'), AXON_COUNCIL_STAGGER_MS: '0' } };
  const args = f => [CLI, '--question', path.join(dir, 'question.md'), '--out', t.out, '--files', f];
  const missing = spawnSync(process.execPath, args('nope.md'), base);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /nope\.md/);
  writeFileSync(path.join(dir, 'big.txt'), 'x'.repeat(200).concat('\n').repeat(2000));
  assert.equal(spawnSync(process.execPath, args('big.txt'), base).status, 0);
  const sys = t.calls().at(-1).args[t.calls().at(-1).args.indexOf('--append-system-prompt') + 1];
  assert.ok(sys.length < 130000, `context ${sys.length} chars`);
  assert.match(sys, /truncated/);
});

// One command, no paths to work out: the question arrives on stdin, the CLI picks the docs folder and the date.
test('--slug: question from stdin, files placed under AXON_DOCS_DIR/council with the date', () => {
  const t = setup({ sleep: 0 });
  const dir = path.dirname(t.out);
  const docs = path.join(dir, 'docs');
  const r = spawnSync(process.execPath, [CLI, '--slug', 'tdd-gate-default'], { input: 'Turn tdd-gate on by default?\n', encoding: 'utf8',
    env: { ...process.env, AXON_CLAUDE_BIN: path.join(dir, 'claude'), AXON_COUNCIL_STAGGER_MS: '0', AXON_DOCS_DIR: docs } });
  assert.equal(r.status, 0, r.stderr);
  const day = new Date().toISOString().slice(0, 10);
  const files = readdirSync(path.join(docs, 'council')).sort();
  assert.deepEqual(files, [`${day}-tdd-gate-default.md`, `${day}-tdd-gate-default.question.md`]);
  assert.match(readFileSync(path.join(docs, 'council', files[1]), 'utf8'), /Turn tdd-gate on by default\?/);
  assert.match(r.stdout, new RegExp(`Transcript: .*${day}-tdd-gate-default\.md`));
  const v = spawnSync(process.execPath, [CLI, '--verdict', 'tdd-gate-default'], { input: 'VERDICT: yes', encoding: 'utf8', env: { ...process.env, AXON_DOCS_DIR: docs } });
  assert.equal(v.status, 0, v.stderr);
  assert.match(readFileSync(path.join(docs, 'council', files[0]), 'utf8'), /VERDICT: yes/);
});

test('refuses to run without a question file', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8', input: '' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--slug/);
});
