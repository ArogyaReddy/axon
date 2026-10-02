// Event records for axon-observe: one JSONL line per hook event in ~/.axon/events/YYYY-MM-DD.jsonl.
// What is kept: when, which session, which event, which tool, a short redacted target, the outcome. What is never
// kept: prompt text (only its length), tool output, file contents. Files older than 14 days are pruned.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const home = () => process.env.AXON_HOME || path.join(os.homedir(), '.axon');
const KEEP_DAYS = 14;

export function redact(text) {
  return String(text)
    .replace(/\b(Bearer|Basic)\s+[^\s"']+/gi, '$1 ***')
    .replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '***')
    .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+/g, '***')
    .replace(/\b([\w-]*(?:password|passwd|secret|token|api[_-]?key)[\w-]*)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s"'&;]+)/gi, '$1$2***')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***@***');
}

const short = (s, n = 160) => { const t = redact(String(s).replace(/\s+/g, ' ').trim()); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export function record(p) {
  const cwd = p.cwd ?? '';
  const e = { ts: new Date().toISOString(), session: p.session_id ?? null, event: p.hook_event_name, folder: path.basename(cwd) || null };
  if (p.agent_type) e.agent = p.agent_type;
  if (p.axon_host) e.source = p.axon_host;
  if (p.tool_name) {
    e.tool = p.tool_name;
    const i = p.tool_input ?? {};
    const file = i.file_path ?? i.notebook_path;
    const target = i.command ?? (file ? (cwd && file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : path.basename(file)) : i.pattern ?? i.url ?? i.description ?? '');
    if (target) e.target = short(target);
  }
  if (p.hook_event_name === 'PostToolUseFailure') { e.outcome = 'fail'; e.detail = short(p.error ?? '', 200); }
  if (p.hook_event_name === 'UserPromptSubmit') e.prompt_chars = String(p.prompt ?? '').length;
  if (p.hook_event_name === 'SessionStart') e.detail = p.source;
  if (p.hook_event_name === 'SessionEnd') e.detail = p.reason;
  if (p.hook_event_name === 'Notification') e.detail = p.notification_type;
  return e;
}

export function append(e) {
  const dir = path.join(home(), 'events');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${e.ts.slice(0, 10)}.jsonl`);
  if (!existsSync(file)) prune(dir);
  appendFileSync(file, `${JSON.stringify(e)}\n`);
}

function prune(dir) {
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  for (const f of readdirSync(dir)) {
    try { if (statSync(path.join(dir, f)).mtimeMs < cutoff) rmSync(path.join(dir, f)); } catch { /* raced */ }
  }
}

const readLines = f => { try { return readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };

// Events plus axon-guard decisions (denies, blocks, hook errors), newest last, for the last `days` days.
export function load({ days = 2 } = {}) {
  const since = Date.now() - days * 864e5;
  const fromDir = (sub, map) => {
    const dir = path.join(home(), sub);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => f.endsWith('.jsonl')).flatMap(f => readLines(path.join(dir, f))).map(map);
  };
  const events = fromDir('events', e => e);
  const guard = fromDir('logs', d => ({ ts: d.ts, session: d.session, event: 'guard', hook: d.hook, decision: d.decision, rule: d.rule, target: d.detail ? short(d.detail) : undefined }));
  return [...events, ...guard].filter(e => e.ts && Date.parse(e.ts) >= since).sort((a, b) => a.ts.localeCompare(b.ts));
}

export function sessions(all) {
  const by = new Map();
  for (const e of all) {
    if (!e.session) continue;
    const s = by.get(e.session) ?? { session: e.session, folder: e.folder, first: e.ts, last: e.ts, events: 0, tools: 0, failures: 0, denies: 0 };
    s.last = e.ts; s.events++; s.folder ??= e.folder;
    if (e.tool) s.tools++;
    if (e.outcome === 'fail') s.failures++;
    if (e.event === 'guard') s.denies++;
    by.set(e.session, s);
  }
  return [...by.values()].sort((a, b) => b.last.localeCompare(a.last));
}
