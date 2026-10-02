// axon-guard state and rules: which files are tests or source, what a test run reported, and the task phase machine.
// State is kept per repository in $AXON_STATE_DIR (default ~/.axon/state), written only by code (hooks and CLIs),
// never by the model. Events are ordered by a sequence counter, not by time, so "after" is never ambiguous.
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

export const PHASES = ['RED', 'GREEN', 'REFACTOR', 'DONE'];
const DEFAULT_TEST_PATTERNS = ['**/*.test.*', '**/*.spec.*', 'test/**', 'tests/**', '**/__tests__/**'];
const DEFAULT_SOURCE_EXT = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.py', '.go', '.java', '.kt', '.rb', '.rs', '.cs', '.php', '.swift', '.scala', '.sql'];
const TEST_COMMAND = /(^|[\s;&|(])(node\s+(?:[^\s]+\s+)*--test|npx\s+jest|jest|npm\s+(?:run\s+)?test|yarn\s+test|pnpm\s+test|pytest|vitest|npx\s+vitest|mocha|npx\s+mocha)(\s|$)/;

// Everything axon writes at runtime lives under one folder: state, logs and the per-machine local.json.
export function axonHome() {
  return process.env.AXON_HOME || path.join(os.homedir(), '.axon');
}

export function stateDir() {
  return process.env.AXON_STATE_DIR || path.join(axonHome(), 'state');
}

// Resolve symlinks, also for a file that does not exist yet (a Write creating it): resolve the deepest existing
// ancestor and append the rest. Hooks see the path Claude used, the CLI sees process.cwd() (already resolved), so
// every path is normalised before it is compared or used as a key (ISS-0022).
export function realish(p) {
  let head = path.resolve(p);
  const tail = [];
  while (!existsSync(head)) {
    const up = path.dirname(head);
    if (up === head) return path.resolve(p);
    tail.unshift(path.basename(head));
    head = up;
  }
  return path.join(realpathSync(head), ...tail);
}

export function repoRoot(start) {
  if (!start) return null;
  let dir = realish(start);
  if (existsSync(dir) && !isDir(dir)) dir = path.dirname(dir);
  while (!existsSync(dir)) dir = path.dirname(dir);
  for (;;) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

export function projectConfig(root) {
  const f = path.join(root, '.axon', 'config.json');
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return {}; }
}

export function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const atStart = i === 0 || glob[i - 1] === '/';
      if (glob[i + 2] === '/' && atStart) { re += '(?:.*/)?'; i += 2; }
      else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function classify(root, file) {
  const rel = path.relative(realish(root), realish(file)).split(path.sep).join('/');
  if (rel.startsWith('..')) return 'other';
  const cfg = projectConfig(root);
  const patterns = [...DEFAULT_TEST_PATTERNS, ...(cfg.tests?.patterns ?? [])];
  if (patterns.some(p => globToRegex(p).test(rel))) return 'test';
  const exts = cfg.source?.extensions ?? DEFAULT_SOURCE_EXT;
  return exts.includes(path.extname(rel)) ? 'source' : 'other';
}

export function parseTestRun(command, output = '', exit = 0) {
  if (!TEST_COMMAND.test(command ?? '')) return { isTest: false };
  const text = String(output);
  const jestLine = text.split('\n').find(l => /^\s*Tests:\s/.test(l));
  const scope = jestLine ?? text;
  const num = re => { const m = re.exec(scope); return m ? Number(m[1]) : null; };
  let pass = num(/(?:ℹ pass|# pass) (\d+)/) ?? num(/(\d+) passed/);
  let fail = num(/(?:ℹ fail|# fail) (\d+)/) ?? num(/(\d+) failed/);
  if (fail === null) fail = exit !== 0 ? 1 : 0;
  if (pass === null) pass = 0;
  return { isTest: true, pass, fail, exit };
}

// ---------- persistence ----------

function fileFor(root) {
  return path.join(stateDir(), 'repos', `${createHash('sha1').update(root).digest('hex').slice(0, 16)}.json`);
}

export function load(root) {
  const f = fileFor(root);
  if (!existsSync(f)) return { root, seq: 0, task: null, lastSourceEditSeq: 0, verify: null };
  return JSON.parse(readFileSync(f, 'utf8'));
}

export function save(state) {
  const f = fileFor(state.root);
  mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, f);
}

function archive(state, outcome) {
  const dir = path.join(stateDir(), 'history');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(path.join(dir, `${path.basename(state.root)}-${state.task.slug}-${stamp}.json`),
    JSON.stringify({ root: state.root, outcome, task: state.task, verify: state.verify }, null, 2));
}

const tick = s => ++s.seq;
const now = () => new Date().toISOString();

// ---------- events recorded by hooks ----------

export function recordEdit(root, file) {
  const kind = classify(root, file);
  if (kind === 'other') return kind;
  const s = load(root);
  const seq = tick(s);
  if (kind === 'source') s.lastSourceEditSeq = seq;
  if (kind === 'test' && s.task) s.task.testEditSeqs.push(seq);
  save(s);
  return kind;
}

export function recordRun(root, command, run) {
  const s = load(root);
  const seq = tick(s);
  const entry = { seq, at: now(), command, pass: run.pass, fail: run.fail, exit: run.exit };
  s.lastRun = entry;
  if (s.task) s.task.runs.push(entry);
  save(s);
}

// ---------- decisions used by hooks ----------

export function editDecision(root, file) {
  const s = load(root);
  if (!s.task) return { allow: true };
  const kind = classify(root, file);
  const rel = path.relative(realish(root), realish(file));
  if (s.task.phase === 'RED' && kind === 'source') {
    return { allow: false, hook: 'tdd-gate', reason: `[axon-guard] tdd-gate: task "${s.task.slug}" is in RED. Write a failing test first, run it, then \`axon-task phase GREEN\`. Blocked edit: ${rel}` };
  }
  if ((s.task.phase === 'GREEN' || s.task.phase === 'REFACTOR') && kind === 'test' && !s.task.unlocked.some(u => u.file === rel)) {
    return { allow: false, hook: 'test-lock', reason: `[axon-guard] test-lock: tests are locked in ${s.task.phase}. If this test is wrong, ask the user to approve \`axon-unlock-test ${rel} --reason "<why>"\`.` };
  }
  return { allow: true };
}

export function stopDecision(root) {
  const s = load(root);
  if (!s.lastSourceEditSeq) return { block: false };
  const fresh = s.verify?.ok && s.verify.seq > s.lastSourceEditSeq;
  if (fresh) return { block: false };
  return { block: true, reason: '[axon-guard] stop-gate: source files changed since the last passing `axon-verify`. Run `axon-verify` and report its result, or state clearly why verification is not possible.' };
}

// ---------- task commands ----------

export function startTask(root, slug, { commit = '' } = {}) {
  if (!slug) throw new Error('A task name is required: axon-task start <name>');
  const s = load(root);
  if (s.task) throw new Error(`Task "${s.task.slug}" is already active (${s.task.phase}). Finish it or run: axon-task abort --reason "<why>"`);
  const seq = tick(s);
  s.task = { slug, startedAt: now(), startSeq: seq, startCommit: commit, phase: 'RED', testEditSeqs: [], runs: [], unlocked: [], transitions: [] };
  save(s);
  return s.task;
}

export function setPhase(root, to) {
  if (!PHASES.includes(to) || to === 'RED') throw new Error(`Unknown phase "${to}". Use GREEN, REFACTOR or DONE`);
  const s = load(root);
  const t = s.task;
  if (!t) throw new Error('No active task. Start one: axon-task start <name>');
  const from = t.phase;
  const lastTestEdit = Math.max(0, ...t.testEditSeqs);
  const enteredGreen = t.transitions.find(x => x.to === 'GREEN')?.seq ?? 0;

  if (to === 'GREEN') {
    if (from !== 'RED') throw new Error(`Cannot go from ${from} to GREEN`);
    if (!lastTestEdit) throw new Error('RED -> GREEN refused: no test file was written or changed in this task yet');
    if (!t.runs.some(r => r.seq > lastTestEdit && r.fail > 0)) throw new Error('RED -> GREEN refused: run the tests after your last test edit and show at least one failing test');
  } else if (to === 'REFACTOR') {
    if (from !== 'GREEN') throw new Error(`Cannot go from ${from} to REFACTOR`);
    const after = Math.max(s.lastSourceEditSeq, enteredGreen);
    if (!t.runs.some(r => r.seq > after && r.fail === 0 && r.pass > 0)) throw new Error('GREEN -> REFACTOR refused: run the tests after your last source edit; all must pass');
  } else if (to === 'DONE') {
    if (from !== 'GREEN' && from !== 'REFACTOR') throw new Error(`Cannot go from ${from} to DONE`);
    const ok = s.verify?.ok && s.verify.seq > s.lastSourceEditSeq && s.verify.seq > t.startSeq;
    if (!ok) throw new Error('DONE refused: run `axon-verify` after your last source edit; it must pass');
  }
  const seq = tick(s);
  t.transitions.push({ from, to, seq, at: now() });
  t.phase = to;
  if (to === 'DONE') { archive(s, 'done'); s.task = null; }
  save(s);
  return { from, to };
}

export function abortTask(root, reason) {
  if (!reason || !reason.trim()) throw new Error('A reason is required: axon-task abort --reason "<why>"');
  const s = load(root);
  if (!s.task) throw new Error('No active task');
  s.task.abortReason = reason.trim();
  archive(s, 'aborted');
  s.task = null;
  tick(s);
  save(s);
}

export function unlockTest(root, file, reason) {
  if (!reason || !reason.trim()) throw new Error('A reason is required: axon-unlock-test <file> --reason "<why the test is wrong>"');
  const s = load(root);
  if (!s.task) throw new Error('No active task; tests are not locked');
  const abs = realish(file);
  if (classify(root, abs) !== 'test') throw new Error(`${file} is not a test file`);
  const rel = path.relative(realish(root), abs);
  s.task.unlocked.push({ file: rel, reason: reason.trim(), at: now(), seq: tick(s) });
  save(s);
  return rel;
}

export function recordVerify(root, ok, results) {
  const s = load(root);
  s.verify = { seq: tick(s), at: now(), ok, results };
  save(s);
}
