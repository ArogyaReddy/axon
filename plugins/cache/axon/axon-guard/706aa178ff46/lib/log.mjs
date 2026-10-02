// Decision log: one JSONL line per deny, block or hook error in ~/.axon/logs/YYYY-MM-DD.jsonl, redacted.
// It answers "why was this blocked?" and shows which rules only produce false positives (tune or remove them).
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { axonHome } from './state.mjs';

export function redact(text) {
  return String(text)
    .replace(/\b(Bearer|Basic)\s+[^\s"']+/gi, '$1 ***')
    .replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '***')
    .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+/g, '***')
    .replace(/\b([\w-]*(?:password|passwd|secret|token|api[_-]?key)[\w-]*)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s"'&;]+)/gi, '$1$2***')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***@***');
}

export function logDecision({ hook, decision, rule = null, session = null, cwd = null, detail = '' }) {
  try {
    const dir = path.join(axonHome(), 'logs');
    mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString();
    const line = { ts, hook, decision, rule, session, cwd, detail: redact(detail).slice(0, 300) };
    appendFileSync(path.join(dir, `${ts.slice(0, 10)}.jsonl`), `${JSON.stringify(line)}\n`);
  } catch { /* logging must never break a hook */ }
}
