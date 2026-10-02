// Retire the legacy ~/.claude items axon replaces (component catalog sections 7 and 8, plan D12): they are moved out of
// the folders Claude Code loads into ~/.axon/legacy/<stamp>/, never deleted, and `restore` moves them back. Only the
// listed items move: your own skills, agents and commands, bin/, hooks/ and templates/ stay. A symlinked item (for
// example one owned by home-manager) is reported and left alone. Hooks in ~/.claude/settings.json that run scripts from
// ~/.claude/hooks/ (the legacy hook folder; axon's hooks replace them) are unhooked the same way: the settings before
// the change are kept, and restore puts them back exactly. Documents in ~/.claude/docs move to ~/.axon/docs (Claude Code
// asks before every edit under ~/.claude, so axon writes its documents there); an existing file is never overwritten.
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { detectNixManaged, NIX_STORE } from './homemanager.mjs';

const MERGED_SKILLS = ['demanding-proof', 'framing-vague-requests', 'scientific-debugging', 'ship-safely', 'work-discipline'];
const MERGED_AGENTS = ['code-reviewer.md', 'security-reviewer.md', 'verifier.md'];
const COMMANDS = ['explain.md', 'fix-bug.md', 'handoff.md', 'plan-feature.md', 'resume-work.md', 'review.md', 'risk-map.md', 'setup-project.md', 'ship.md'];
const FILES = ['settings-me.json', 'ar-config.yaml'];

const list = d => (existsSync(d) ? readdirSync(d) : []);
const statePath = home => path.join(home, '.axon', 'state', 'legacy.json');
const loadState = home => (existsSync(statePath(home)) ? JSON.parse(readFileSync(statePath(home), 'utf8')) : { archives: [] });
function saveState(home, s) {
  mkdirSync(path.dirname(statePath(home)), { recursive: true });
  writeFileSync(statePath(home), `${JSON.stringify(s, null, 2)}\n`);
}

// Same disk: rename. Another disk: copy, then remove the source.
function move(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  try { renameSync(from, to); } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    rmSync(from, { recursive: true });
  }
}

const LEGACY_HOOK = /\.claude\/hooks\//;
const isLegacy = h => typeof h?.command === 'string' && LEGACY_HOOK.test(h.command);

export function legacyHooks(settings) {
  const out = [];
  for (const [event, groups] of Object.entries(settings?.hooks ?? {})) {
    for (const g of Array.isArray(groups) ? groups : []) {
      for (const h of g?.hooks ?? []) if (isLegacy(h)) out.push({ event, matcher: g.matcher, hook: h });
    }
  }
  return out;
}

function withoutLegacy(hooks) {
  const out = {};
  for (const [event, groups] of Object.entries(hooks ?? {})) {
    const kept = (Array.isArray(groups) ? groups : []).map(g => ({ ...g, hooks: (g.hooks ?? []).filter(h => !isLegacy(h)) })).filter(g => g.hooks.length);
    if (kept.length) out[event] = kept;
  }
  return out;
}

function readSettings(home) {
  const file = path.join(home, '.claude', 'settings.json');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  try { return { file, text, value: JSON.parse(text) }; } catch { return null; }
}

function writeThrough(file, text) {
  const real = realpathSync(file);
  const tmp = `${real}.axon-tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, real);
}

// Moves that bring ~/.claude/docs into ~/.axon/docs: whole entries when the target is free, folder by folder when both
// exist; a name taken on both sides stays where it is.
export function planDocs({ home }) {
  const from = path.join(home, '.claude', 'docs');
  const to = path.join(home, '.axon', 'docs');
  const r = { moves: [], kept: [], linked: false };
  if (!existsSync(from)) return r;
  if (lstatSync(from).isSymbolicLink()) { r.linked = true; return r; }
  const walk = rel => {
    for (const name of readdirSync(path.join(from, rel))) {
      const sub = rel ? `${rel}/${name}` : name;
      const s = path.join(from, sub), d = path.join(to, sub);
      if (!existsSync(d)) r.moves.push(sub);
      else if (lstatSync(s).isDirectory() && !lstatSync(s).isSymbolicLink() && lstatSync(d).isDirectory()) walk(sub);
      else r.kept.push(sub);
    }
  };
  walk('');
  return r;
}

export function planArchive({ home }) {
  const c = path.join(home, '.claude');
  const rels = [
    ...list(path.join(c, 'skills')).filter(n => n.startsWith('ar-') || MERGED_SKILLS.includes(n)).map(n => `skills/${n}`),
    ...list(path.join(c, 'agents')).filter(n => n.startsWith('ar-') || MERGED_AGENTS.includes(n)).map(n => `agents/${n}`),
    ...list(path.join(c, 'commands')).filter(n => COMMANDS.includes(n)).map(n => `commands/${n}`),
    ...FILES.filter(f => existsSync(path.join(c, f))),
  ];
  return rels.map(rel => ({ rel, abs: path.join(c, rel), linked: lstatSync(path.join(c, rel)).isSymbolicLink() }));
}

export function archiveLegacy({ home, dryRun = false, now = new Date(), nixStorePrefix = NIX_STORE }) {
  const items = planArchive({ home });
  const movable = items.filter(i => !i.linked);
  const settings = readSettings(home);
  const hooks = settings ? legacyHooks(settings.value) : [];
  const hooksManual = hooks.length > 0 && detectNixManaged(settings.file, nixStorePrefix).managed;
  const docs = planDocs({ home });
  const r = { dir: null, moved: movable.map(i => i.rel), skipped: items.filter(i => i.linked).map(i => i.rel),
    hooks: hooks.map(h => `${h.event}: ${h.hook.command}`), hooksManual, docs: docs.moves, docsKept: docs.kept, docsLinked: docs.linked };
  if (dryRun || (!movable.length && (!hooks.length || hooksManual) && !docs.moves.length)) return r;
  r.dir = path.join(home, '.axon', 'legacy', now.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-'));
  for (const i of movable) move(i.abs, path.join(r.dir, i.rel));
  const entry = { dir: r.dir, items: r.moved, at: now.toISOString() };
  for (const rel of docs.moves) move(path.join(home, '.claude', 'docs', rel), path.join(home, '.axon', 'docs', rel));
  for (const rel of docs.moves) pruneEmpty(path.dirname(path.join(home, '.claude', 'docs', rel)), path.join(home, '.claude', 'docs'));
  if (docs.moves.length) entry.docs = docs.moves;
  if (hooks.length && !hooksManual) {
    const value = { ...settings.value, hooks: withoutLegacy(settings.value.hooks) };
    if (!Object.keys(value.hooks).length) delete value.hooks;
    const afterText = `${JSON.stringify(value, null, 2)}\n`;
    mkdirSync(r.dir, { recursive: true });
    writeFileSync(path.join(r.dir, 'settings.json.before'), settings.text);
    writeThrough(settings.file, afterText);
    entry.hooks = { file: settings.file, beforeText: settings.text, afterText, removed: hooks };
  }
  const s = loadState(home);
  s.archives.push(entry);
  saveState(home, s);
  return r;
}

// Put unhooked legacy hooks back: the exact old file if nothing changed since, otherwise the hooks re-added.
function restoreHooks(h) {
  if (!existsSync(h.file)) return;
  const current = readFileSync(h.file, 'utf8');
  if (current === h.afterText) { writeThrough(h.file, h.beforeText); return; }
  const value = JSON.parse(current);
  value.hooks ??= {};
  for (const { event, matcher, hook } of h.removed) (value.hooks[event] ??= []).push({ ...(matcher !== undefined ? { matcher } : {}), hooks: [hook] });
  writeThrough(h.file, `${JSON.stringify(value, null, 2)}\n`);
}

function pruneEmpty(dir, stop) {
  while (dir !== stop && dir.startsWith(stop) && existsSync(dir) && readdirSync(dir).length === 0) { rmdirSync(dir); dir = path.dirname(dir); }
}

export function restoreLegacy({ home }) {
  const s = loadState(home);
  const r = { restored: [], conflicts: [] };
  const c = path.join(home, '.claude');
  for (const a of [...s.archives].reverse()) {
    if (a.hooks) { restoreHooks(a.hooks); r.hooks = (r.hooks ?? 0) + a.hooks.removed.length; delete a.hooks; }
    for (const rel of a.docs ?? []) {
      const from = path.join(home, '.axon', 'docs', rel), to = path.join(c, 'docs', rel);
      if (!existsSync(from) || existsSync(to)) continue;
      move(from, to);
      pruneEmpty(path.dirname(from), path.join(home, '.axon', 'docs'));
      r.docs = (r.docs ?? 0) + 1;
    }
    delete a.docs;
    const left = [];
    for (const rel of a.items) {
      const from = path.join(a.dir, rel);
      if (!existsSync(from)) continue;
      const to = path.join(c, rel);
      let taken = true;
      try { lstatSync(to); } catch { taken = false; }
      if (taken) { r.conflicts.push(rel); left.push(rel); continue; }
      move(from, to);
      pruneEmpty(path.dirname(from), a.dir);
      r.restored.push(rel);
    }
    a.items = left;
    if (!left.length) { rmSync(path.join(a.dir, 'settings.json.before'), { force: true }); pruneEmpty(a.dir, path.dirname(a.dir)); }
  }
  s.archives = s.archives.filter(a => a.items.length || a.hooks || a.docs?.length);
  saveState(home, s);
  return r;
}
