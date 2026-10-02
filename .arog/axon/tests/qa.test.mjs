// axon-qa: stories run once by the qa-agent (model), then replayed by code at no model cost; the model is called again
// only when a story changes or its replay fails. Driven with a fake claude and a fake playwright-cli; one integration
// test uses the real pinned playwright-cli and Chrome when they are installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStories, storyHash, slug } from '../plugins/axon-qa/lib/stories.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QA = path.join(ROOT, 'plugins', 'axon-qa', 'bin', 'axon-qa');
const WRAPPER = path.join(ROOT, 'plugins', 'axon-qa', 'bin', 'playwright-cli');

const STORIES = `# shop stories
stories:
  - name: "Sign in shows welcome"
    url: "http://shop.test/"
    workflow: |
      Fill email with "ana@x.test"
      Click Sign in
      Verify the page says "Welcome, ana@x.test"

  - name: Cart is empty
    url: http://shop.test/cart
    auth: shop-user
    workflow: |
      Verify the cart says "Your cart is empty"
`;

// ---------- story files ----------

test('parseStories reads the bowser story format (quoted and plain scalars, block workflow, extra keys)', () => {
  const s = parseStories(STORIES, 'shop.yaml');
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], { name: 'Sign in shows welcome', url: 'http://shop.test/',
    workflow: 'Fill email with "ana@x.test"\nClick Sign in\nVerify the page says "Welcome, ana@x.test"' });
  assert.equal(s[1].auth, 'shop-user');
  assert.equal(s[1].workflow, 'Verify the cart says "Your cart is empty"');
});

test('parseStories rejects what it does not understand, with the line number', () => {
  assert.throws(() => parseStories('stories:\n  - name: x\n    url: [a, b]\n', 'bad.yaml'), /bad\.yaml:3/);
  assert.throws(() => parseStories('stories:\n  - url: http://a\n    workflow: x\n', 'bad.yaml'), /name/);
  assert.throws(() => parseStories('tests:\n  - name: x\n', 'bad.yaml'), /stories:/);
});

test('slug and story hash: stable, and the hash changes when the story changes', () => {
  assert.equal(slug('Sign in shows welcome!'), 'sign-in-shows-welcome');
  const [a] = parseStories(STORIES, 'shop.yaml');
  assert.equal(storyHash(a), storyHash({ ...a }));
  assert.notEqual(storyHash(a), storyHash({ ...a, workflow: `${a.workflow}\nClick Logout` }));
});

// ---------- orchestrator with fakes ----------

// Fake playwright-cli: logs every call; `find` reports a match when the text is in PAGE_TEXT; a selector listed in
// FAIL_SELECTORS fails like the real tool (exit 1).
function fakes({ plan = {}, page = 'Welcome, ana@x.test|Your cart is empty', failSelectors = '', claudeSleep = 0 } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-qa-'));
  const log = path.join(dir, 'log');
  mkdirSync(log);
  const pw = path.join(dir, 'pw');
  writeFileSync(pw, `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(path.join(log, 'pw.jsonl'))}, JSON.stringify({ args, at: Date.now() }) + '\\n');
const rest = args.filter(a => !a.startsWith('-s=') && a !== '--json');
const [cmd, target] = rest;
if (process.env.FAIL_SELECTORS && process.env.FAIL_SELECTORS.split('|').includes(target)) { console.log('### Error\\nError: does not match any elements.'); process.exit(1); }
if (cmd === 'find') { const hit = process.env.PAGE_TEXT.split('|').some(t => t.toLowerCase().includes(target.toLowerCase()));
  console.log(JSON.stringify({ result: hit ? 'Found 1 match for "' + target + '":' : 'No matches found for "' + target + '".' })); process.exit(0); }
if (cmd === 'screenshot') { const f = args[args.indexOf('--filename') + 1]; fs.writeFileSync(f, 'png'); }
if (cmd === 'console') console.log('[error] boom');
process.exit(0);
`);
  chmodSync(pw, 0o755);
  // Fake claude acting as qa-agent: writes result.json and replay.json in its working directory from PLAN[story name].
  const claude = path.join(dir, 'claude');
  writeFileSync(claude, `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2); const prompt = args[args.indexOf('-p') + 1];
fs.appendFileSync(${JSON.stringify(path.join(log, 'claude.jsonl'))}, JSON.stringify({ args, prompt, cwd: process.cwd(), start: Date.now() }) + '\\n');
const name = /Story: (.*)/.exec(prompt)[1];
const plan = JSON.parse(process.env.QA_PLAN)[name];
setTimeout(() => {
  if (plan) {
    fs.writeFileSync('result.json', JSON.stringify(plan.result));
    if (plan.replay) fs.writeFileSync('replay.json', JSON.stringify(plan.replay));
  }
  fs.appendFileSync(${JSON.stringify(path.join(log, 'claude-end.jsonl'))}, JSON.stringify({ name, end: Date.now() }) + '\\n');
  process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result: 'done', total_cost_usd: 0.2 }));
}, ${claudeSleep * 1000});
`);
  chmodSync(claude, 0o755);
  const repo = path.join(dir, 'repo');
  mkdirSync(path.join(repo, '.axon', 'user_stories'), { recursive: true });
  writeFileSync(path.join(repo, '.axon', 'user_stories', 'shop.yaml'), STORIES);
  const home = path.join(dir, 'home');
  mkdirSync(path.join(home, 'secrets', 'playwright'), { recursive: true });
  writeFileSync(path.join(home, 'secrets', 'playwright', 'shop-user.json'), '{}');
  const env = { ...process.env, AXON_CLAUDE_BIN: claude, AXON_PLAYWRIGHT_BIN: pw, AXON_DOCS_DIR: path.join(dir, 'docs'), AXON_HOME: home,
    QA_PLAN: JSON.stringify(plan), PAGE_TEXT: page, FAIL_SELECTORS: failSelectors };
  const run = (...extra) => spawnSync(process.execPath, [QA, 'run', ...extra], { cwd: repo, encoding: 'utf8', env });
  const lines = f => (existsSync(path.join(log, f)) ? readFileSync(path.join(log, f), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : []);
  return { dir, repo, run, env, claudeCalls: () => lines('claude.jsonl'), claudeEnds: () => lines('claude-end.jsonl'), pwCalls: () => lines('pw.jsonl') };
}

const PASS_PLAN = {
  'Sign in shows welcome': {
    result: { status: 'PASS', steps: [{ step: 'Fill email', status: 'PASS' }, { step: 'Click Sign in', status: 'PASS' }, { step: 'Verify welcome', status: 'PASS' }] },
    replay: { steps: [
      { step: 'Fill email', cmd: ['fill', "getByRole('textbox', { name: 'Email' })", 'ana@x.test'] },
      { step: 'Click Sign in', cmd: ['click', "getByRole('button', { name: 'Sign in' })"] },
      { step: 'Verify welcome', expect: 'Welcome, ana@x.test' },
    ] },
  },
  'Cart is empty': {
    result: { status: 'PASS', steps: [{ step: 'Verify empty cart', status: 'PASS' }] },
    replay: { steps: [{ step: 'Verify empty cart', expect_element: "getByText('Your cart is empty')" }] },
  },
};

test('first run: the qa-agent learns each story (Sonnet, one browser session per story, opened and closed by code)', () => {
  const f = fakes({ plan: PASS_PLAN });
  const r = f.run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const calls = f.claudeCalls();
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.args[c.args.indexOf('--agent') + 1], 'axon-qa:qa-agent');
    assert.equal(c.args[c.args.indexOf('--model') + 1], 'sonnet');
    assert.match(c.prompt, /Session: [a-z0-9-]+/);
    assert.ok(c.cwd.includes(path.join('qa', 'app-tests')), 'the agent works inside its story evidence folder');
  }
  const pw = f.pwCalls().map(c => c.args.join(' '));
  assert.ok(pw.some(a => /^-s=sign-in-shows-welcome-[\w-]+ open http:\/\/shop\.test\/ --browser=chrome$/.test(a)), pw.join('\n'));
  assert.ok(pw.some(a => /state-load .*shop-user\.json/.test(a)), 'auth state loaded for the cart story');
  const sessions = kind => new Set(pw.filter(a => a.includes(` ${kind}`)).map(a => a.split(' ')[0]));
  assert.ok(sessions('open').size >= 2);
  assert.deepEqual([...sessions('open')].sort(), [...sessions('close')].sort(), 'every opened session is closed');
  const replays = readdirSync(path.join(f.repo, '.axon', 'user_stories', '.replay', 'shop')).sort();
  assert.deepEqual(replays, ['cart-is-empty.json', 'sign-in-shows-welcome.json']);
  assert.match(r.stdout, /2 passed, 0 failed/);
  assert.match(r.stdout, /learned/);
});

test('second run: stories replay in code with no model call', () => {
  const f = fakes({ plan: PASS_PLAN });
  f.run();
  const before = f.claudeCalls().length;
  const r = f.run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(f.claudeCalls().length, before, 'no claude call on replay');
  assert.match(r.stdout, /replayed/);
  const pw = f.pwCalls().map(c => c.args.join(' '));
  assert.ok(pw.some(a => a.includes("fill getByRole('textbox', { name: 'Email' }) ana@x.test")));
  assert.ok(pw.some(a => /--json find Welcome, ana@x.test/.test(a)));
  assert.ok(pw.some(a => /screenshot --filename .*01_fill-email\.png/.test(a)), 'a screenshot after every step');
});

test('a changed story is learned again; an unchanged one still replays', () => {
  const f = fakes({ plan: PASS_PLAN });
  f.run();
  const file = path.join(f.repo, '.axon', 'user_stories', 'shop.yaml');
  writeFileSync(file, readFileSync(file, 'utf8').replace('Verify the cart says', 'Then verify the cart says'));
  const before = f.claudeCalls().length;
  f.run();
  const after = f.claudeCalls().slice(before);
  assert.deepEqual(after.map(c => /Story: (.*)/.exec(c.prompt)[1]), ['Cart is empty']);
});

test('a failing replay is re-learned once; if the agent passes, the replay is updated', () => {
  const f = fakes({ plan: PASS_PLAN });
  f.run();
  const before = f.claudeCalls().length;
  // The app changed: the old button selector no longer matches.
  const r = spawnSync(process.execPath, [QA, 'run'], { cwd: f.repo, encoding: 'utf8',
    env: { ...f.env, FAIL_SELECTORS: "getByRole('button', { name: 'Sign in' })" } });
  assert.equal(f.claudeCalls().length - before, 1, 'one re-learn call');
  assert.match(r.stdout, /relearned/);
});

test('a real failure: FAIL with the failed step, console captured, remaining steps skipped, exit 1', () => {
  const plan = { ...PASS_PLAN, 'Cart is empty': { result: { status: 'FAIL', steps: [{ step: 'Verify empty cart', status: 'FAIL', note: 'cart has 2 items' }] } } };
  const f = fakes({ plan, page: 'Welcome, ana@x.test' });
  const r = f.run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /1 passed, 1 failed/);
  assert.ok(!existsSync(path.join(f.repo, '.axon', 'user_stories', '.replay', 'shop', 'cart-is-empty.json')), 'no replay from a failed run');
  const reports = readdirSync(path.join(f.dir, 'docs', 'qa', 'app-tests'));
  const report = readFileSync(path.join(f.dir, 'docs', 'qa', 'app-tests', reports[0], 'report.md'), 'utf8');
  assert.match(report, /\| Cart is empty \| shop \| FAIL \|/);
  assert.match(report, /cart has 2 items/);
});

test('replay failure detail: stops at the failed step, captures console, marks the rest SKIPPED', () => {
  const f = fakes({ plan: PASS_PLAN });
  f.run();
  // Make the replay fail and the re-learn fail too.
  const plan = { ...PASS_PLAN, 'Sign in shows welcome': { result: { status: 'FAIL', steps: [{ step: 'Click Sign in', status: 'FAIL', note: 'button gone' }] } } };
  const r = spawnSync(process.execPath, [QA, 'run', '--filter', 'shop'], { cwd: f.repo, encoding: 'utf8',
    env: { ...f.env, QA_PLAN: JSON.stringify(plan), FAIL_SELECTORS: "getByRole('button', { name: 'Sign in' })" } });
  assert.equal(r.status, 1);
  const runDir = readdirSync(path.join(f.dir, 'docs', 'qa', 'app-tests')).sort().at(-1);
  const replayLog = JSON.parse(readFileSync(path.join(f.dir, 'docs', 'qa', 'app-tests', runDir, 'shop', 'sign-in-shows-welcome', 'replay-result.json'), 'utf8'));
  assert.deepEqual(replayLog.steps.map(s => s.status), ['PASS', 'FAIL', 'SKIPPED']);
  assert.ok(existsSync(path.join(f.dir, 'docs', 'qa', 'app-tests', runDir, 'shop', 'sign-in-shows-welcome', 'console.txt')));
});

test('parallel stories are capped by --parallel', () => {
  const many = `stories:\n${[1, 2, 3, 4].map(i => `  - name: Story ${i}\n    url: http://shop.test/${i}\n    workflow: |\n      Verify page ${i}\n`).join('')}`;
  const plan = Object.fromEntries([1, 2, 3, 4].map(i => [`Story ${i}`, { result: { status: 'PASS', steps: [] } }]));
  const f = fakes({ plan, claudeSleep: 0.6 });
  writeFileSync(path.join(f.repo, '.axon', 'user_stories', 'shop.yaml'), many);
  f.run('--parallel', '2');
  const starts = f.claudeCalls().map(c => c.start);
  const ends = f.claudeEnds().map(c => c.end);
  const maxConcurrent = Math.max(...starts.map(s => starts.filter(x => x <= s).length - ends.filter(e => e <= s).length));
  assert.equal(maxConcurrent, 2);
});

test('--filter picks story files by name; no stories is a clear message', () => {
  const f = fakes({ plan: PASS_PLAN });
  const r = f.run('--filter', 'nomatch');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /No stories/);
});

test('an unreachable app fails the story without starting an agent (no model cost)', () => {
  const f = fakes({ plan: PASS_PLAN, failSelectors: 'http://shop.test/|http://shop.test/cart' });
  const r = f.run();
  assert.equal(r.status, 1);
  assert.equal(f.claudeCalls().length, 0);
  assert.match(r.stdout, /could not open http:\/\/shop\.test\//);
});

// ---------- the playwright-cli wrapper ----------

test('wrapper: pinned binary under AXON_HOME, chrome by default on open, clear error when missing', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-pw-'));
  const missing = spawnSync(WRAPPER, ['--version'], { encoding: 'utf8', env: { ...process.env, AXON_HOME: home } });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /axon tools install/);
  const bin = path.join(home, 'tools', 'playwright-cli', 'node_modules', '.bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'playwright-cli'), '#!/bin/sh\necho "$@"\n');
  chmodSync(path.join(bin, 'playwright-cli'), 0o755);
  const env = { ...process.env, AXON_HOME: home };
  assert.equal(spawnSync(WRAPPER, ['-s=a', 'open', 'http://x'], { encoding: 'utf8', env }).stdout.trim(), '-s=a open http://x --browser=chrome');
  assert.equal(spawnSync(WRAPPER, ['open', 'http://x', '--browser=firefox'], { encoding: 'utf8', env }).stdout.trim(), 'open http://x --browser=firefox');
  assert.equal(spawnSync(WRAPPER, ['click', 'e5'], { encoding: 'utf8', env }).stdout.trim(), 'click e5');
});

// ---------- integration: the real pinned playwright-cli and Chrome ----------

const REAL = path.join(homedir(), '.axon', 'tools', 'playwright-cli', 'node_modules', '.bin', 'playwright-cli');
test('integration: a recorded replay runs against a real page in Chrome, and a broken page fails at the right step',
  { skip: (!existsSync(REAL) && 'pinned playwright-cli not installed (axon tools install)')
      // Chrome cannot start under macOS Seatbelt; in Claude Code the skills run playwright-cli outside the sandbox
      // (excludedCommands), but a test spawning it from node cannot. Runs in a terminal.
      || (process.env.SANDBOX_RUNTIME === '1' && 'inside the Claude Code sandbox, where Chrome cannot start (run npm test in a terminal)'),
    timeout: 120000 }, async t => {
    let broken = false;
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(`<!doctype html><title>Shop</title><h1>Shop</h1><label>Email <input></label>
        <button onclick="document.querySelector('p').textContent='Welcome, '+document.querySelector('input').value">${broken ? 'Log in' : 'Sign in'}</button><p></p>`);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    t.after(() => server.close());
    const url = `http://127.0.0.1:${server.address().port}/`;
    const dir = mkdtempSync(path.join(tmpdir(), 'axon-qa-real-'));
    const repo = path.join(dir, 'repo');
    mkdirSync(path.join(repo, '.axon', 'user_stories', '.replay', 'shop'), { recursive: true });
    const story = `stories:\n  - name: Sign in shows welcome\n    url: ${url}\n    workflow: |\n      Sign in as ana\n`;
    writeFileSync(path.join(repo, '.axon', 'user_stories', 'shop.yaml'), story);
    const { storyHash: hash, parseStories: parse } = await import('../plugins/axon-qa/lib/stories.mjs');
    writeFileSync(path.join(repo, '.axon', 'user_stories', '.replay', 'shop', 'sign-in-shows-welcome.json'), JSON.stringify({
      story_hash: hash(parse(story, 'shop.yaml')[0]), steps: [
        { step: 'Fill email', cmd: ['fill', "getByRole('textbox', { name: 'Email' })", 'ana@x.test'] },
        { step: 'Click Sign in', cmd: ['click', "getByRole('button', { name: 'Sign in' })"] },
        { step: 'Verify welcome', expect: 'Welcome, ana@x.test' },
      ] }));
    const env = { ...process.env, AXON_DOCS_DIR: path.join(dir, 'docs'), AXON_CLAUDE_BIN: '/nonexistent/claude' };
    const run = () => new Promise(resolve => {
      const p = spawn(process.execPath, [QA, 'run', '--no-relearn'], { cwd: repo, env });
      let out = '';
      p.stdout.on('data', d => { out += d; });
      p.on('close', code => resolve({ code, out }));
    });
    const ok = await run();
    assert.equal(ok.code, 0, ok.out);
    assert.match(ok.out, /1 passed, 0 failed/);
    broken = true;
    const bad = await run();
    assert.equal(bad.code, 1, bad.out);
    const runDir = readdirSync(path.join(dir, 'docs', 'qa', 'app-tests')).sort().at(-1);
    const log = JSON.parse(readFileSync(path.join(dir, 'docs', 'qa', 'app-tests', runDir, 'shop', 'sign-in-shows-welcome', 'replay-result.json'), 'utf8'));
    assert.deepEqual(log.steps.map(s => s.status), ['PASS', 'FAIL', 'SKIPPED']);
  });
