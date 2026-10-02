// prompt-flags: session flags set in a prompt (#BetterExplanation=YES), kept per session in ~/.axon/state/sessions,
// and restated to Claude as context on every prompt while any flag differs from its default.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stateDir } from './state.mjs';

export const REGISTRY = JSON.parse(readFileSync(new URL('../config/flags.json', import.meta.url), 'utf8'));
const BY_NAME = new Map(REGISTRY.flags.flatMap(f => [f.name, ...(f.aliases ?? [])].map(n => [n.toLowerCase(), f])));
const VALUE = { yes: 'YES', on: 'YES', true: 'YES', no: 'NO', off: 'NO', false: 'NO' };

// Canonical form: #Name=YES|NO (unknown names are reported). Aliases (#Name ON, #Name: false) count only for known
// names, so "#tag on" or "issue #123" in ordinary text is never a flag.
export function parseFlags(prompt) {
  const set = {};
  const unknown = [];
  const re = /(?:^|\s)#([A-Za-z]\w*)(\s*=\s*|\s*:\s*|\s+)(yes|no|on|off|true|false)\b/gi;
  for (const m of String(prompt).matchAll(re)) {
    const flag = BY_NAME.get(m[1].toLowerCase());
    if (flag) set[flag.name] = VALUE[m[3].toLowerCase()];
    else if (m[2].includes('=')) unknown.push(m[1]);
  }
  return { set, unknown, status: /(?:^|\s)#FlagStatus\b/i.test(prompt) };
}

const file = session => path.join(stateDir(), 'sessions', `${String(session).replace(/[^\w-]/g, '_')}.json`);

export function loadFlags(session) {
  try { return JSON.parse(readFileSync(file(session), 'utf8')).flags ?? {}; } catch { return {}; }
}

export function saveFlags(session, flags) {
  const f = file(session);
  mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ flags, updated: new Date().toISOString() }, null, 2));
  renameSync(tmp, f);
}

const valueOf = (flags, f) => flags[f.name] ?? f.default;
const describe = (f, v) => (v === f.default ? (f.default === 'NO' ? 'deactivated' : 'default restored') : f.effect);

// Returns the context text for this prompt, or null when there is nothing to say.
export function flagContext(session, prompt) {
  const parsed = parseFlags(prompt);
  const flags = loadFlags(session);
  const changed = Object.entries(parsed.set).filter(([n, v]) => valueOf(flags, BY_NAME.get(n.toLowerCase())) !== v);
  for (const [n, v] of Object.entries(parsed.set)) flags[n] = v;
  if (changed.length || Object.keys(parsed.set).length) saveFlags(session, flags);

  const active = REGISTRY.flags.filter(f => valueOf(flags, f) !== f.default);
  const lines = [];
  if (changed.length) {
    const turnedOff = REGISTRY.flags.filter(f => changed.some(([n]) => n === f.name) && valueOf(flags, f) === f.default);
    const block = [...active, ...turnedOff].map(f => `  #${f.name}=${valueOf(flags, f)} - ${describe(f, valueOf(flags, f))}`);
    lines.push(`Session flags changed in this prompt. Under the session-flag contract the reply starts with this block, before any tool call:\n🚩 Flags active this session:\n${block.join('\n')}\n${REGISTRY.nonNegotiable}`);
  } else if (active.length) {
    lines.push(`Session flags active: ${active.map(f => `#${f.name}=${valueOf(flags, f)} (${f.effect})`).join('; ')}.`);
  }
  if (parsed.status) {
    const rows = REGISTRY.flags.map(f => `  #${f.name}=${valueOf(flags, f)} (${f.name in flags ? 'set this session' : 'default'})${valueOf(flags, f) === f.default ? '' : ` - ${f.effect}`}`);
    lines.push(`Flag status requested (#FlagStatus). Current values, session scope:\n${rows.join('\n')}`);
  }
  for (const name of parsed.unknown) {
    lines.push(`#${name} is not a known flag. Known flags: ${REGISTRY.flags.map(f => `#${f.name}`).join(', ')}.`);
  }
  return lines.length ? lines.join('\n\n') : null;
}
