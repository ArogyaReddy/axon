// SessionStart (startup|resume|clear|compact): session-brief. A short factual brief so a cold session, a cleared one
// or one just compacted knows where it stands: git state, the active axon task, and where the handoff is.
// Text from repository files is never copied in (ISS-0029): hook context carries more authority than a file, so a
// hostile or stale handoff must be read by Claude as a file. Live runs showed the pointer gives the same answers.
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { runHook, context } from '../../lib/hook-io.mjs';
import { repoRoot, load } from '../../lib/state.mjs';
import { enabled } from '../../lib/switches.mjs';

function git(root, ...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

await runHook(brief);

function brief(p) {
  const root = repoRoot(p.cwd);
  if (!root || !existsSync(path.join(root, '.git')) || !enabled('session-brief', root)) return null;
  const branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD') ?? 'unknown';
  const last = (git(root, 'log', '-1', '--format=%h %s') || 'none yet').slice(0, 100);
  const status = git(root, 'status', '--porcelain');
  const dirty = status === null ? 'an unknown number of' : String(status.split('\n').filter(Boolean).length);
  const lines = [`Facts gathered by the axon-guard SessionStart hook (${p.source ?? 'startup'}) from git and axon state:`,
    `- ${path.basename(root)} on branch ${branch}, last commit ${last}, ${dirty} uncommitted file${dirty === '1' ? '' : 's'}.`];
  const task = load(root).task;
  if (task) lines.push(`- Active axon task ${task.slug}, phase ${task.phase} (axon-task status for details).`);
  const handoff = path.join(root, 'SESSION-HANDOFF.md');
  if (existsSync(handoff)) {
    lines.push(`- SESSION-HANDOFF.md exists in the repo root (modified ${statSync(handoff).mtime.toISOString().slice(0, 10)}); it holds the previous session's handoff and next steps.`);
  }
  return context('SessionStart', lines.join('\n'));
}
