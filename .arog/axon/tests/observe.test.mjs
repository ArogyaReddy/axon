// axon-observe: async event-log hook (one JSONL line per event, redacted, never blocks), axon-trace (timeline in the
// terminal) and the local dashboard (127.0.0.1 only). Payloads come from the real captures in tests/fixtures/payloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, utimesSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OBS = path.join(ROOT, 'plugins', 'axon-observe');
const HOOK = path.join(OBS, 'hooks', 'event-log.mjs');
const TRACE = path.join(OBS, 'bin', 'axon-trace');
const fixture = (name, repo) => JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', 'payloads', `${name}.json`), 'utf8').replaceAll('${REPO}', repo));

function setup() {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-obs-'));
  const repo = mkdtempSync(path.join(tmpdir(), 'axon-obs-repo-'));
  return { home, repo, env: { ...process.env, AXON_HOME: home } };
}
const log = (t, body) => spawnSync(process.execPath, [HOOK], { input: typeof body === 'string' ? body : JSON.stringify(body), encoding: 'utf8', env: t.env });
const events = t => {
  const dir = path.join(t.home, 'events');
  return existsSync(dir) ? readdirSync(dir).flatMap(f => readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))) : [];
};

test('a tool call becomes one redacted line: session, event, tool, target, folder', () => {
  const t = setup();
  const p = fixture('post-bash-ok', t.repo);
  const r = log(t, { ...p, tool_input: { command: 'curl -H "Authorization: Bearer abc123" https://x.test && echo password=hunter2' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'an async hook prints nothing');
  const [e] = events(t);
  assert.equal(e.session, p.session_id);
  assert.equal(e.event, 'PostToolUse');
  assert.equal(e.tool, 'Bash');
  assert.equal(e.folder, path.basename(t.repo));
  assert.ok(!JSON.stringify(e).includes('abc123') && !JSON.stringify(e).includes('hunter2'), JSON.stringify(e));
  assert.ok(e.ts);
});

test('a failed tool call records the failure; a file edit records the path relative to the folder', () => {
  const t = setup();
  log(t, fixture('post-bash-fail', t.repo));
  log(t, fixture('post-write', t.repo));
  const [fail, write] = events(t);
  assert.equal(fail.outcome, 'fail');
  assert.match(fail.detail, /Exit code/);
  assert.equal(write.tool, 'Write');
  assert.ok(!write.target.startsWith('/'), `relative path expected: ${write.target}`);
});

test('prompts are never logged, only their length', () => {
  const t = setup();
  const p = fixture('prompt-submit', t.repo);
  log(t, p);
  const [e] = events(t);
  assert.equal(e.event, 'UserPromptSubmit');
  assert.equal(e.prompt_chars, p.prompt.length);
  assert.ok(!JSON.stringify(e).includes('BetterExplanation'));
});

test('malformed input never fails the hook', () => {
  const t = setup();
  const r = log(t, 'not json');
  assert.equal(r.status, 0);
  assert.equal(events(t).length, 0);
});

test('event files older than 14 days are pruned when a new day starts', () => {
  const t = setup();
  const dir = path.join(t.home, 'events');
  mkdirSync(dir, { recursive: true });
  const old = path.join(dir, '2026-08-01.jsonl');
  writeFileSync(old, '{}\n');
  const ago = (Date.now() - 20 * 864e5) / 1000;
  utimesSync(old, ago, ago);
  log(t, fixture('session-start', t.repo));
  assert.ok(!existsSync(old));
});

test('axon-trace --last prints the latest session as a timeline', () => {
  const t = setup();
  const one = name => ({ ...fixture(name, t.repo), session_id: 'session-one' }); // fixtures come from different captures
  log(t, one('session-start'));
  log(t, one('post-bash-ok'));
  log(t, one('stop'));
  const r = spawnSync(process.execPath, [TRACE, '--last'], { encoding: 'utf8', env: t.env });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /SessionStart/);
  assert.match(r.stdout, /PostToolUse\s+Bash/);
  assert.match(r.stdout, /Stop/);
});

test('hooks.json registers the event log as an async exec-form hook on every event it records', () => {
  const cfg = JSON.parse(readFileSync(path.join(OBS, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const ev of ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd', 'Notification']) {
    const h = cfg[ev]?.[0]?.hooks?.[0];
    assert.ok(h, ev);
    assert.equal(h.async, true, ev);
    assert.equal(h.command, 'node');
    assert.match(h.args[0], /event-log\.mjs$/);
  }
});

test('dashboard: serves the page and /api/events (events and guard decisions) on 127.0.0.1 only', async t2 => {
  const t = setup();
  log(t, fixture('session-start', t.repo));
  log(t, fixture('post-bash-ok', t.repo));
  mkdirSync(path.join(t.home, 'logs'), { recursive: true });
  writeFileSync(path.join(t.home, 'logs', `${new Date().toISOString().slice(0, 10)}.jsonl`),
    `${JSON.stringify({ ts: new Date().toISOString(), hook: 'guard-bash', decision: 'deny', rule: 'git-reset-hard', session: 's1' })}\n`);
  const server = spawn(process.execPath, [path.join(OBS, 'dashboard', 'server.mjs'), '--port', '0'], { env: t.env });
  t2.after(() => server.kill());
  const url = await new Promise((resolve, reject) => {
    let out = '';
    server.stdout.on('data', d => { out += d; const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(out); if (m) resolve(m[0]); });
    server.on('exit', c => reject(new Error(`server exited ${c}`)));
  });
  const page = await (await fetch(`${url}/`)).text();
  assert.match(page, /<title>axon/);
  const data = await (await fetch(`${url}/api/events`)).json();
  assert.ok(data.events.some(e => e.event === 'PostToolUse'));
  assert.ok(data.events.some(e => e.event === 'guard' && e.rule === 'git-reset-hard'));
  assert.ok(data.sessions.length >= 1);
});
