// Content rules that permission patterns cannot express. A verdict is { id, why } or null.
// Permissions (settings deny/ask) and the sandbox stay the hard boundary; these rules add precision and a clear reason.
// Add a rule only after a real incident; remove one that only produces false positives (see ~/.axon/logs).
import { existsSync, lstatSync, openSync, readSync, closeSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { globToRegex, projectConfig, realish } from './state.mjs';

// ---------- guard-bash ----------

// Text that is data, not commands: `cat <<EOF` heredoc bodies (the usual commit-message form) and -m/--message values.
// A heredoc fed to a shell (`bash <<EOF`) is NOT stripped.
function stripText(cmd) {
  return cmd
    .replace(/\bcat\s+<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g, 'cat <<TEXT')
    .replace(/(\s(?:-m|--message)(?:\s+|=))("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1TEXT');
}

const RM_PREFIX = new Set(['sudo', 'command', 'exec', 'nice', 'time', 'xargs']);
const unquote = w => w.replace(/^(['"])(.*)\1$/, '$2');

// rm -r aimed at /, a root-level folder, the home folder or one of its parents, the current or parent folder, or a bare glob.
function isCritical(target, cwd) {
  if (/^\*+$/.test(target) || ['.', './', './*', '..', '../', '../*'].includes(target)) return true;
  const home = os.homedir();
  const expanded = target.replace(/^~(?=\/|$)/, home).replace(/^\$\{?HOME\}?(?=\/|$)/, home);
  if (expanded.includes('$')) return false; // another variable: cannot know, permissions and the sandbox still apply
  const base = path.resolve(cwd, expanded.replace(/\/\*$/, '').replace(/\/+$/, '') || '/');
  return base === '/' || path.dirname(base) === '/' || base === home || home.startsWith(`${base}/`);
}

function rmVerdict(cmd, cwd) {
  for (const segment of cmd.split(/&&|\|\||[;|&\n()`]/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean).map(unquote);
    const k = words.findIndex(w => /^(?:.*\/)?rm$/.test(w));
    if (k < 0 || !words.slice(0, k).every(w => /^\w+=/.test(w) || RM_PREFIX.has(w) || w.startsWith('-'))) continue;
    const args = words.slice(k + 1);
    const end = args.indexOf('--');
    const flags = (end < 0 ? args : args.slice(0, end)).filter(a => a.startsWith('-'));
    const targets = args.filter((a, i) => !(a.startsWith('-') && (end < 0 || i < end)) && a !== '--');
    if (!flags.some(f => f === '--recursive' || /^-[a-zA-Z]*[rR]/.test(f))) continue;
    for (const t of targets) {
      if (isCritical(t, cwd)) return { id: 'rm-critical', why: `recursive delete of ${t}` };
      if (t.endsWith('/') && !t.includes('$')) {
        const link = path.resolve(cwd, t.replace(/^~(?=\/)/, os.homedir()).replace(/\/+$/, ''));
        try {
          if (lstatSync(link).isSymbolicLink()) {
            return { id: 'rm-symlink-target', why: `${t} is a symlink; the trailing slash deletes the target's contents (use unlink to remove the link)` };
          }
        } catch { /* does not exist */ }
      }
    }
  }
  return null;
}

function discardAll(cmd) {
  const m = /\bgit\s+(checkout|restore)\b([^;&|\n]*)/.exec(cmd);
  if (!m) return false;
  const args = m[2].trim().split(/\s+/);
  if (!args.includes('.')) return false;
  return !(m[1] === 'restore' && args.includes('--staged') && !args.includes('--worktree'));
}

const BASH_RULES = [
  ['sudo-rm', c => /\bsudo\s+(?:-\S+\s+)*rm\b/.test(c), 'deleting files with administrator rights'],
  ['git-force-push', c => /\bgit\s+push\b[^;&|\n]*?\s(?:--force(?=\s|$)|-[a-zA-Z]*f[a-zA-Z]*(?=\s|$)|\+[\w./-]+)/.test(c),
    'force push rewrites shared history (use --force-with-lease, on your own branch only)'],
  ['git-reset-hard', c => /\bgit\s+reset\b[^;&|\n]*\s--hard\b/.test(c), 'discards uncommitted work'],
  ['git-clean', c => /\bgit\s+clean\b[^;&|\n]*\s-[a-zA-Z]*f/.test(c), 'permanently deletes untracked files'],
  ['git-discard-all', discardAll, 'discards every local change at once'],
  ['git-no-verify', c => /\bgit\s+(?:commit|push|merge|rebase)\b[^;&|\n]*\s--no-verify\b/.test(c), 'skips the repository git hooks (pre-commit and pre-push checks)'],
  ['chmod-777', c => /\bchmod\s+(?:-\w+\s+)*0?777\b/.test(c), 'makes files writable by everyone'],
  ['pipe-to-shell', c => /\b(?:curl|wget)\b[^|;&\n]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/.test(c), 'runs a downloaded script without inspecting it'],
  ['sql-destructive', c => /\b(?:psql|mysql|sqlite3|sqlcmd|mongosh|rds-data|dsql)\b[^\n]*\b(?:DROP|TRUNCATE)\s+(?:TABLE|DATABASE|SCHEMA)\b/i.test(c),
    'destructive database statement'],
  ['disk-write', c => /\bdd\b[^|;&\n]*\bof=\/dev\/|\bmkfs(?:\.\w+)?\b|:\(\)\s*\{\s*:\s*\|\s*:/.test(c), 'writes raw data to a disk or formats it'],
  ['env-file-read', c => /(?:^|[\s;&|(])(?:cat|less|more|head|tail|bat|source|\.)\s+(?:[^;&|\n]*\s)?(?:[^\s;&|'"]*\/)?\.env(?:\.(?!example\b|sample\b|template\b|dist\b)[\w.-]+)?(?=$|[\s;&|)'"])/.test(c),
    'reads a .env secrets file'],
  ['aws-prod', c => /(?:--profile[=\s]+["']?|AWS_PROFILE=["']?)prod(?:uction)?(?![\w-])/i.test(c), 'targets the production AWS account'],
];

export function bashVerdict(command, cwd) {
  const cmd = stripText(String(command ?? ''));
  const rm = rmVerdict(cmd, cwd || process.cwd());
  if (rm) return rm;
  for (const [id, test, why] of BASH_RULES) if (test(cmd)) return { id, why };
  return null;
}

// ---------- guard-files ----------

const SECRET = ['.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx', 'id_rsa*', 'id_ed25519*', 'id_ecdsa*',
  '**/secrets/**', '**/.ssh/**', '**/.aws/credentials', 'credentials', 'credentials.json'];
const SECRET_OK = /(?:^|\/)\.env\.(?:example|sample|template|dist)$/;
const GENERATED = ['CHANGELOG.md', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'Cargo.lock'];
const WHY = {
  secret: 'secrets and keys are never written by the agent',
  generated: 'generated file; change its source or rerun its generator',
  project: "listed in the project's protected paths",
};

// A glob without "/" matches the file name anywhere; with "/" it matches the path relative to the repo.
const matches = (rel, glob) => globToRegex(glob).test(glob.includes('/') ? rel : path.posix.basename(rel));

function head(file, bytes = 1024) {
  try {
    const fd = openSync(file, 'r');
    try { const buf = Buffer.alloc(bytes); return buf.toString('utf8', 0, readSync(fd, buf, 0, bytes, 0)); }
    finally { closeSync(fd); }
  } catch { return ''; }
}

function hasGeneratedMarker(file) {
  const top = head(file).split('\n').slice(0, 5).join('\n');
  return /@generated\b/.test(top) || /\bDO NOT EDIT\b/.test(top)
    || /^\s*(?:\/\/|#|\/?\*+|<!--|--)\s*(?:this file (?:is|was) )?auto-?generated\b/im.test(top);
}

function legacyProtected(root) {
  const f = path.join(root, '.claude', 'protected-paths.txt');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

export function fileVerdict(root, file) {
  const abs = realish(file);
  const inside = root && !path.relative(realish(root), abs).startsWith('..');
  const rel = (inside ? path.relative(realish(root), abs) : abs.replace(/^\/+/, '')).split(path.sep).join('/');
  const cfg = inside ? projectConfig(root) : {};
  const verdict = id => ({ id, why: WHY[id] });
  if ((cfg.protected?.allow ?? []).some(g => matches(rel, g))) return null;
  if (!SECRET_OK.test(rel) && SECRET.some(g => matches(rel, g))) return verdict('secret');
  if (GENERATED.includes(path.posix.basename(rel))) return verdict('generated');
  if (inside && [...(cfg.protected?.paths ?? []), ...legacyProtected(root)].some(g => matches(rel, g))) return verdict('project');
  if (existsSync(abs) && hasGeneratedMarker(abs)) return verdict('generated');
  return null;
}

export function displayPath(root, file) {
  const abs = realish(file);
  if (!root) return abs;
  const rel = path.relative(realish(root), abs);
  return rel.startsWith('..') ? abs : rel;
}
