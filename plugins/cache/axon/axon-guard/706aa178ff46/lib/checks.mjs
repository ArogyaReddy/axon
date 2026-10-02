// post-edit-check: fast checks on the one file just edited. Errors (broken syntax) go back to Claude to fix at once;
// notes (locale key drift, project reminders) are added as context. Full lint, type checks and tests belong to axon-verify.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { globToRegex, projectConfig, realish } from './state.mjs';

const MAX = 600;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 10000 });
  if (r.error) return null; // the checker is not installed here: skip
  return r.status === 0 ? null : (r.stderr || r.stdout).trim().slice(-MAX);
}

// JSON with comments and trailing commas (tsconfig.json, .vscode/*.json) is valid JSONC.
function stripJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function jsonError(file) {
  const text = readFileSync(file, 'utf8');
  try { JSON.parse(text); return null; } catch (e) {
    try { JSON.parse(stripJsonc(text)); return null; } catch { return e.message; }
  }
}

const SYNTAX = {
  '.json': jsonError,
  '.js': f => { const e = run(process.execPath, ['--check', f]); return e && /Unexpected token '<'/.test(e) ? null : e; }, // JSX in .js
  '.mjs': f => run(process.execPath, ['--check', f]),
  '.cjs': f => run(process.execPath, ['--check', f]),
  '.sh': f => run('bash', ['-n', f]),
  '.bash': f => run('bash', ['-n', f]),
  '.zsh': f => run('zsh', ['-n', f]),
  '.py': f => run('python3', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1]).read(), sys.argv[1])', f]), // no __pycache__
};

// ---------- locale parity: messages-en.json and messages-es.json must define the same keys ----------

const LOCALE_FILE = /^(.*?[-_.])([a-z]{2}(?:[-_][A-Za-z]{2})?)\.json$/;
const LOCALE_TAIL = /^[a-z]{2}(?:[-_][A-Za-z]{2})?\.json$/;

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

function readObject(file) {
  try { const v = JSON.parse(readFileSync(file, 'utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

function missing(from, to, fromName, toName) {
  const have = new Set(to);
  const gone = from.filter(k => !have.has(k));
  if (!gone.length) return [];
  const list = gone.slice(0, 10).join(', ') + (gone.length > 10 ? `, and ${gone.length - 10} more` : '');
  return [`[axon-guard] i18n: ${toName} is missing ${gone.length} key${gone.length > 1 ? 's' : ''} present in ${fromName}: ${list}. axon rule: all locales change together.`];
}

function localeParity(file) {
  const base = path.basename(file);
  const m = LOCALE_FILE.exec(base);
  if (!m) return [];
  const mine = readObject(file);
  if (!mine) return [];
  const dir = path.dirname(file);
  const siblings = readdirSync(dir).filter(f => f !== base && f.startsWith(m[1]) && LOCALE_TAIL.test(f.slice(m[1].length)));
  return siblings.flatMap(sib => {
    const other = readObject(path.join(dir, sib));
    if (!other) return [];
    const a = keys(mine);
    const b = keys(other);
    return [...missing(a, b, base, sib), ...missing(b, a, sib, base)];
  });
}

function reminders(root, rel) {
  return (projectConfig(root).reminders ?? [])
    .filter(r => (r.paths ?? []).some(g => globToRegex(g).test(rel)))
    .map(r => `[axon-guard] reminder for ${rel}: ${r.message}`);
}

export function postEditFindings(root, file) {
  const abs = realish(file);
  if (!existsSync(abs)) return { errors: [], notes: [] };
  const inside = root && !path.relative(realish(root), abs).startsWith('..');
  const rel = inside ? path.relative(realish(root), abs).split(path.sep).join('/') : abs;
  const check = SYNTAX[path.extname(abs).toLowerCase()];
  const error = check ? check(abs) : null;
  const errors = error ? [`[axon-guard] post-edit-check: ${rel} has a syntax error:\n${error}\nThe file is saved in this broken state.`] : [];
  const notes = [...(error ? [] : localeParity(abs)), ...(inside ? reminders(root, rel) : [])];
  return { errors, notes };
}
