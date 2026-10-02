// Data the payload does not carry: git branch state (cached 5 s per directory), the axon task and session flags,
// and the AWS SSO session expiry (work profile). Every source returns null on any failure: a missing tool or file
// removes its segment, never the line.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { axonHome, load, repoRoot } from '../../../plugins/axon-guard/lib/state.mjs';
import { REGISTRY, loadFlags } from '../../../plugins/axon-guard/lib/flags.mjs';

const GIT_TTL_MS = 5000;

function parseGit(text) {
  const out = { branch: null, ahead: 0, behind: 0, dirty: 0 };
  for (const line of text.split('\n')) {
    if (line.startsWith('# branch.head ')) out.branch = line.slice(14);
    else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) { out.ahead = Number(m[1]); out.behind = Number(m[2]); }
    } else if (line && !line.startsWith('#')) out.dirty++;
  }
  return out.branch ? out : null;
}

export function gitInfo(cwd) {
  if (!cwd) return null;
  const cache = path.join(axonHome(), 'cache', `statusline-git-${createHash('sha1').update(cwd).digest('hex').slice(0, 16)}.json`);
  try {
    const c = JSON.parse(readFileSync(cache, 'utf8'));
    if (Date.now() - c.at < GIT_TTL_MS) return c.data;
  } catch { /* no cache yet */ }
  let data = null;
  try {
    data = parseGit(execFileSync('git', ['status', '--porcelain=v2', '--branch'], { cwd, encoding: 'utf8', timeout: 1000, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { data = null; }
  try {
    mkdirSync(path.dirname(cache), { recursive: true });
    const tmp = `${cache}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ at: Date.now(), data }));
    renameSync(tmp, cache);
  } catch { /* cache is optional */ }
  return data;
}

// The active task phase and the evidence behind it, from the state axon-task and the guard hooks write.
export function taskInfo(cwd) {
  try {
    const root = cwd && repoRoot(cwd);
    if (!root) return null;
    const s = load(root);
    if (!s.task) return null;
    const last = s.task.runs.at(-1);
    let evidence = '';
    if (s.verify && s.verify.seq > s.lastSourceEditSeq) evidence = s.verify.ok ? 'verify ok' : 'verify FAIL';
    else if (last) evidence = last.fail > 0 ? `${last.fail} failing` : `${last.pass} passing`;
    return { phase: s.task.phase, evidence };
  } catch { return null; }
}

export function activeFlags(session) {
  if (!session) return [];
  try {
    const flags = loadFlags(session);
    return REGISTRY.flags.filter(f => (flags[f.name] ?? f.default) !== f.default).map(f => f.name);
  } catch { return []; }
}

// Minutes until the newest AWS SSO token expires (negative once expired). Read-only; never calls the AWS CLI.
export function awsMinutesLeft() {
  try {
    const dir = path.join(os.homedir(), '.aws', 'sso', 'cache');
    const newest = readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => ({ f, t: statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { f } of newest) {
      const exp = JSON.parse(readFileSync(path.join(dir, f), 'utf8')).expiresAt;
      if (exp) return Math.floor((Date.parse(exp) - Date.now()) / 60000);
    }
  } catch { /* no SSO cache */ }
  return null;
}
