// Issue tracker: one Markdown file per issue plus a generated INDEX.md.
// The script owns ids, fields, status changes and the index; the session writes the narrative sections.
// Rules enforced in code: valid field values, no id reuse, no "fixed" without a filled root cause, a filled fix and evidence.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const TYPES = ['bug', 'regression', 'gap', 'risk', 'doc'];
export const FOUND_IN = ['plan', 'implementation', 'review', 'test', 'production'];
export const STATUSES = ['open', 'in-progress', 'fixed', 'wont-fix', 'duplicate'];
const FIELDS = ['id', 'title', 'status', 'severity', 'type', 'feature', 'found', 'found_in', 'found_by', 'files', 'fixed', 'fix_commit', 'verified_by', 'related'];
const SECTIONS = ['What happened', 'How it was found', 'Root cause', 'Impact', 'Fix', 'Verification', 'Lessons'];
const TODO = '_TODO_';
const SEQ = '.sequence';

const day = d => d.toISOString().slice(0, 10);
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const pad = n => `ISS-${String(n).padStart(4, '0')}`;

export function resolveIssuesDir({ cwd, home }) {
  if (process.env.AXON_ISSUES_DIR) return path.resolve(process.env.AXON_ISSUES_DIR);
  let dir = path.resolve(cwd);
  while (true) {
    const cfg = path.join(dir, '.axon', 'config.json');
    if (existsSync(cfg)) {
      const d = JSON.parse(readFileSync(cfg, 'utf8'))?.issues?.dir;
      if (d) return path.resolve(dir, d);
    }
    if (existsSync(path.join(dir, '.git')) || path.dirname(dir) === dir) break;
    dir = path.dirname(dir);
  }
  const repo = existsSync(path.join(dir, '.git')) ? dir : path.resolve(cwd);
  // Documents live in ~/.axon/docs: Claude Code asks before every edit under ~/.claude.
  const docs = process.env.AXON_DOCS_DIR ? path.resolve(process.env.AXON_DOCS_DIR) : path.join(process.env.AXON_HOME || path.join(home, '.axon'), 'docs');
  return path.join(docs, 'issues', path.basename(repo));
}

export function parseIssue(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) throw new Error('Issue file has no front matter');
  const out = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  out.body = text.slice(m[0].length);
  return out;
}

function render(fields, body) {
  const fm = FIELDS.map(k => `${k}: ${fields[k] ?? ''}`).join('\n');
  return `---\n${fm}\n---\n${body}`;
}

function issueFiles(dir) {
  return existsSync(dir) ? readdirSync(dir).filter(f => /^ISS-\d{4}-.*\.md$/.test(f)).sort() : [];
}

function fileOf(dir, id) {
  const f = issueFiles(dir).find(f => f.startsWith(`${id}-`));
  if (!f) throw new Error(`${id} not found in ${dir}`);
  return path.join(dir, f);
}

export function readIssue(dir, id) {
  return { ...parseIssue(readFileSync(fileOf(dir, id), 'utf8')), path: fileOf(dir, id) };
}

function update(dir, id, changes) {
  const file = fileOf(dir, id);
  const issue = parseIssue(readFileSync(file, 'utf8'));
  writeFileSync(file, render({ ...issue, ...changes }, issue.body));
  writeIndex(dir);
}

function nextId(dir) {
  const seqFile = path.join(dir, SEQ);
  const fromFiles = Math.max(0, ...issueFiles(dir).map(f => Number(f.slice(4, 8))));
  const fromSeq = existsSync(seqFile) ? Number(readFileSync(seqFile, 'utf8').trim()) || 0 : 0;
  const n = Math.max(fromFiles, fromSeq) + 1;
  writeFileSync(seqFile, `${n}\n`);
  return pad(n);
}

function check(value, allowed, name) {
  if (!allowed.includes(value)) throw new Error(`Invalid ${name} "${value}". Use one of: ${allowed.join(', ')}`);
}

export function newIssue(dir, { title, severity, type, foundIn, foundBy = '', feature = '', files = [], related = '', force = false, now = new Date() }) {
  if (!title || !title.trim()) throw new Error('A title is required');
  const norm = t => t.trim().toLowerCase().replace(/\s+/g, ' ');
  const same = listIssues(dir).find(i => i.status !== 'duplicate' && norm(i.title) === norm(title));
  if (same && !force) throw new Error(`${same.id} already tracks "${same.title}" (status ${same.status}). If it came back, log a regression with --related ${same.id} --force`);
  check(severity, SEVERITIES, 'severity');
  check(type, TYPES, 'type');
  check(foundIn, FOUND_IN, 'found-in');
  mkdirSync(dir, { recursive: true });
  const id = nextId(dir);
  const file = path.join(dir, `${id}-${slug(title)}.md`);
  const body = `\n# ${id}: ${title.trim()}\n\n` + SECTIONS.map(s => `## ${s}\n\n${TODO}\n`).join('\n');
  writeFileSync(file, render({ id, title: title.trim(), status: 'open', severity, type, feature, found: day(now), found_in: foundIn,
    found_by: foundBy, files: files.join(', '), related }, body));
  writeIndex(dir);
  return { id, file };
}

export function setStatus(dir, id, status) {
  check(status, ['open', 'in-progress'], 'status');
  update(dir, id, { status });
}

function sectionText(body, name) {
  const m = new RegExp(`## ${name}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(body);
  return m ? m[1].trim() : '';
}

export function fixIssue(dir, id, { verifiedBy, commit = '', files = [], now = new Date() }) {
  const issue = readIssue(dir, id);
  for (const s of ['Root cause', 'Fix']) {
    const t = sectionText(issue.body, s);
    if (!t || t === TODO) throw new Error(`${id}: fill in the "${s}" section before marking it fixed`);
  }
  if (!verifiedBy || !verifiedBy.trim()) throw new Error(`${id}: verification evidence is required (a test name, command output or check)`);
  const allFiles = [...new Set([...issue.files.split(',').map(s => s.trim()).filter(Boolean), ...files])].join(', ');
  update(dir, id, { status: 'fixed', fixed: day(now), fix_commit: commit, verified_by: verifiedBy.trim(), files: allFiles });
}

export function closeIssue(dir, id, { as, reason }) {
  check(as, ['wont-fix', 'duplicate'], 'close reason type');
  if (!reason || !reason.trim()) throw new Error(`${id}: a reason is required to close as ${as}`);
  const issue = readIssue(dir, id);
  const body = issue.body.replace(/## Lessons\n/, `## Lessons\n\nClosed as ${as}: ${reason.trim()}\n`);
  writeFileSync(issue.path, render({ ...issue, status: as }, body));
  writeIndex(dir);
}

export function listIssues(dir, { status, feature } = {}) {
  return issueFiles(dir)
    .map(f => ({ ...parseIssue(readFileSync(path.join(dir, f), 'utf8')), file: f }))
    .filter(i => !status || status === 'all' || i.status === status)
    .filter(i => !feature || i.feature === feature);
}

export function writeIndex(dir) {
  const all = listIssues(dir);
  const rank = s => ({ open: 0, 'in-progress': 1, fixed: 2, 'wont-fix': 3, duplicate: 3 }[s] ?? 4);
  const sev = s => SEVERITIES.indexOf(s);
  const sorted = [...all].sort((a, b) => rank(a.status) - rank(b.status) || sev(a.severity) - sev(b.severity) || a.id.localeCompare(b.id));
  const count = s => all.filter(i => i.status === s).length;
  const rows = sorted.map(i => `| [${i.id}](${i.file}) | ${i.status} | ${i.severity} | ${i.type} | ${i.title} | ${i.found} | ${i.found_in} | ${i.fixed || '-'} | ${i.feature || '-'} |`);
  writeFileSync(path.join(dir, 'INDEX.md'),
    `# Issue tracker\n\nGenerated by \`axon issue\`. Do not edit by hand.\n\n` +
    `${count('open')} open, ${count('in-progress')} in progress, ${count('fixed')} fixed, ${count('wont-fix') + count('duplicate')} closed\n\n` +
    `| ID | Status | Severity | Type | Title | Found | Found in | Fixed | Feature |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
}
