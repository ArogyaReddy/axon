// Status line: driven exactly as Claude Code drives it (payload JSON on stdin, COLUMNS in the environment).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'global', 'statusline', 'statusline.mjs');
const TASK = path.join(ROOT, 'plugins', 'axon-guard', 'bin', 'axon-task');
const ANSI = /\x1b\[[0-9;]*m|\x1b\]8;[^\x07]*\x07/g;
const visible = s => s.replace(ANSI, '');

function setup({ git = true, dirty = false, profile = 'personal' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-sl-'));
  if (git) {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    writeFileSync(path.join(dir, 'a.txt'), 'a\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one'], { cwd: dir });
    if (dirty) writeFileSync(path.join(dir, 'b.txt'), 'b\n');
  }
  const home = mkdtempSync(path.join(tmpdir(), 'axon-sl-home-'));
  const env = { ...process.env, HOME: home, AXON_HOME: path.join(home, '.axon'), AXON_STATE_DIR: '', AXON_PROFILE: profile, NO_COLOR: '1', AXON_STATUSLINE_ASCII: '', COLUMNS: '200' };
  delete env.AXON_STATE_DIR;
  return { dir, home, env };
}

const fixture = (name, dir) => JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', 'statusline', `${name}.json`), 'utf8').replaceAll('${REPO}', dir));

function render(t, body, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT], { input: typeof body === 'string' ? body : JSON.stringify(body), encoding: 'utf8', env: { ...t.env, ...env } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.replace(/\n$/, '');
}

test('full payload, wide terminal: every segment, in order', () => {
  const t = setup({ dirty: true });
  const out = render(t, fixture('full', t.dir));
  assert.equal(out.split('\n').length, 1, 'one line');
  const order = ['payroll', 'main*', 'wt:feature-xyz', 'Sonnet 5 high', '23%', '$1.23', '1h05m', '+156 -23', 'PR #1234 pending', '5h 24%', 'style:Explanatory'];
  let at = -1;
  for (const s of order) {
    const i = out.indexOf(s);
    assert.ok(i > at, `"${s}" missing or out of order in: ${out}`);
    at = i;
  }
});

test('narrow terminal drops low-priority segments and fits the width', () => {
  const t = setup();
  for (const cols of [60, 100]) {
    const out = render(t, fixture('full', t.dir), { COLUMNS: String(cols) });
    assert.ok(visible(out).length <= cols - 2, `${cols}: ${visible(out).length} > ${cols - 2}: ${out}`);
    for (const keep of ['payroll', 'main', 'Sonnet 5', '23%']) assert.ok(out.includes(keep), `${cols}: lost ${keep}`);
  }
  const at60 = render(t, fixture('full', t.dir), { COLUMNS: '60' });
  assert.ok(!at60.includes('+156'), 'lines +/- is dropped first');
  // Cost is a golden factor: it outlives worktree, PR and rate limits when space runs out.
  const at100 = render(t, fixture('full', t.dir), { COLUMNS: '100' });
  assert.ok(at100.includes('$1.23'), `cost dropped at 100 columns: ${at100}`);
  assert.ok(!at100.includes('wt:'), `worktree should go before cost: ${at100}`);
});

test('minimal payload renders without crashing', () => {
  const t = setup({ git: false });
  assert.match(render(t, fixture('minimal', t.dir)), /Sonnet 5/);
});

test('missing context_window: no context segment, rest intact', () => {
  const t = setup();
  const p = fixture('full', t.dir);
  delete p.context_window;
  const out = render(t, p);
  assert.ok(!out.includes('23%'));
  assert.match(out, /Sonnet 5/);
});

test('malformed stdin still prints a line and exits 0', () => {
  const t = setup();
  assert.match(render(t, 'not json'), /axon/);
});

test('outside a git repository and with git missing: no branch, line still renders', () => {
  const t = setup({ git: false });
  const p = fixture('full', t.dir);
  assert.ok(!render(t, p).includes('main'));
  const t2 = setup();
  const out = render(t2, fixture('full', t2.dir), { PATH: '/nonexistent' });
  assert.match(out, /Sonnet 5/);
  assert.ok(!out.includes('main'));
});

test('colors: context thresholds use green, yellow, red, bright red; NO_COLOR removes all codes', () => {
  const t = setup();
  const at = pct => { const p = fixture('full', t.dir); p.context_window.used_percentage = pct; return render(t, p, { NO_COLOR: '' }); };
  assert.match(at(10), /\x1b\[32m[^\x1b]*10%/);
  assert.match(at(60), /\x1b\[33m[^\x1b]*60%/);
  assert.match(at(80), /\x1b\[31m[^\x1b]*80%/);
  assert.match(at(95), /\x1b\[91m[^\x1b]*95%/);
  assert.doesNotMatch(render(t, fixture('full', t.dir)), /\x1b/);
});

test('ASCII mode prints only ASCII', () => {
  const t = setup({ dirty: true });
  const out = render(t, fixture('full', t.dir), { AXON_STATUSLINE_ASCII: '1' });
  assert.match(out, /^[\x20-\x7e]*$/, out);
});

test('axon task phase and last test run are shown while a task is active', () => {
  const t = setup();
  spawnSync(process.execPath, [TASK, 'start', 'rounding'], { cwd: t.dir, env: t.env });
  assert.match(render(t, fixture('full', t.dir)), /RED/);
});

test('active session flags are shown', () => {
  const t = setup();
  const p = fixture('full', t.dir);
  mkdirSync(path.join(t.home, '.axon', 'state', 'sessions'), { recursive: true });
  writeFileSync(path.join(t.home, '.axon', 'state', 'sessions', `${p.session_id}.json`), JSON.stringify({ flags: { BetterExplanation: 'YES', ChatOutput: 'YES' } }));
  const out = render(t, p);
  assert.match(out, /#BetterExplanation/);
  assert.ok(!out.includes('#ChatOutput'), 'flags at their default are not shown');
});

test('work profile: AWS SSO session expiry from ~/.aws/sso/cache; personal profile: none', () => {
  const t = setup({ profile: 'work' });
  const cache = path.join(t.home, '.aws', 'sso', 'cache');
  mkdirSync(cache, { recursive: true });
  writeFileSync(path.join(cache, 'a.json'), JSON.stringify({ expiresAt: new Date(Date.now() + 42 * 60000 + 30000).toISOString() }));
  const out = render(t, fixture('full', t.dir));
  assert.match(out, /aws 42m/);
  assert.match(out, /\$1\.23 est\./, 'Bedrock cost is an estimate');
  assert.ok(!render(t, fixture('full', t.dir), { AXON_PROFILE: 'personal' }).includes('aws'));
  writeFileSync(path.join(cache, 'a.json'), JSON.stringify({ expiresAt: new Date(Date.now() - 60000).toISOString() }));
  assert.match(render(t, fixture('full', t.dir)), /aws expired/);
});

test('the default output style is not shown', () => {
  const t = setup();
  const p = fixture('full', t.dir);
  for (const name of ['default', 'axon-learn:lean', 'lean']) {
    p.output_style.name = name;
    assert.ok(!render(t, p).includes('style:'), name);
  }
});

// Generous ceiling against pathological regressions; the real p95 is measured by `npm run bench`.
test('renders well below the debounce window (median < 250 ms)', () => {
  const t = setup();
  const times = [];
  for (let i = 0; i < 7; i++) {
    const s = process.hrtime.bigint();
    render(t, fixture('full', t.dir));
    times.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[3] < 250, `median ${times[3].toFixed(0)} ms`);
});
