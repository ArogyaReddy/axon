#!/usr/bin/env node
// axon status line: one line of facts at a glance. Claude Code pipes the session JSON on stdin and sets COLUMNS.
// Segments are dropped by priority until the line fits. NO_COLOR removes colors; AXON_STATUSLINE_ASCII=1 uses ASCII only.
// Plan section 9. Never calls a model or the network.
import path from 'node:path';
import { gitInfo, taskInfo, activeFlags, awsMinutesLeft } from './lib/sources.mjs';

const ascii = Boolean(process.env.AXON_STATUSLINE_ASCII);
const color = !process.env.NO_COLOR;
const work = process.env.AXON_PROFILE === 'work';
const G = ascii
  ? { sep: ' | ', on: '#', off: '-', up: '^', down: 'v', open: '[', close: ']' }
  : { sep: ' │ ', on: '▰', off: '▱', up: '↑', down: '↓', open: '', close: '' };
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const DEFAULT_STYLES = new Set(['default', 'lean', 'axon-learn:lean']);

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return `${Math.floor(ms / 1000)}s`;
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

function contextBar(pct) {
  const cells = 8;
  const full = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)));
  const code = pct < 50 ? 32 : pct < 75 ? 33 : pct < 90 ? 31 : 91;
  return paint(code, `${G.open}${G.on.repeat(full)}${G.off.repeat(cells - full)}${G.close} ${Math.round(pct)}%`);
}

// keep: higher stays longer when the terminal is narrow. Drop order: lines, style, worktree, PR, rate, flags, cost
// (cost outlives the others: it is a golden factor; plan 9.4 had it third).
function segments(p) {
  const cwd = p.workspace?.current_dir ?? p.cwd;
  const out = [];
  const add = (keep, fn) => { try { const text = fn(); if (text) out.push({ keep, text }); } catch { /* segment skipped */ } };

  add(100, () => p.workspace?.repo?.name ?? (p.workspace?.project_dir || cwd ? path.basename(p.workspace?.project_dir ?? cwd) : null));
  add(99, () => {
    const g = gitInfo(cwd);
    if (!g) return null;
    const ab = `${g.ahead ? ` ${G.up}${g.ahead}` : ''}${g.behind ? ` ${G.down}${g.behind}` : ''}`;
    return paint(36, `${g.branch}${g.dirty ? '*' : ''}`) + ab;
  });
  add(3, () => { const w = p.workspace?.git_worktree ?? p.worktree?.name; return w ? `wt:${w}` : null; });
  add(97, () => {
    const t = taskInfo(cwd);
    if (!t) return null;
    const code = { RED: 31, GREEN: 32, REFACTOR: 34, DONE: 32 }[t.phase] ?? 0;
    return paint(code, t.phase) + (t.evidence ? ` ${t.evidence}` : '');
  });
  add(98, () => p.model?.display_name ? `${p.model.display_name}${p.effort?.level ? ` ${p.effort.level}` : ''}` : null);
  add(98, () => (typeof p.context_window?.used_percentage === 'number' ? contextBar(p.context_window.used_percentage) : null));
  add(96, () => {
    if (!work) return null;
    const m = awsMinutesLeft();
    if (m === null) return null;
    if (m < 0) return paint(91, 'aws expired');
    return paint(m < 10 ? 31 : m < 30 ? 33 : 0, `aws ${duration(m * 60000)}`);
  });
  add(7, () => {
    if (typeof p.cost?.total_cost_usd !== 'number') return null;
    const d = p.cost.total_duration_ms ? ` ${duration(p.cost.total_duration_ms)}` : '';
    return `$${p.cost.total_cost_usd.toFixed(2)}${work ? ' est.' : ''}${d}`;
  });
  add(1, () => {
    const a = p.cost?.total_lines_added;
    const r = p.cost?.total_lines_removed;
    return a || r ? `${paint(32, `+${a ?? 0}`)} ${paint(31, `-${r ?? 0}`)}` : null;
  });
  add(6, () => activeFlags(p.session_id).map(f => `#${f}`).join(' ') || null);
  add(4, () => (p.pr?.number ? `PR #${p.pr.number}${p.pr.review_state ? ` ${p.pr.review_state}` : ''}` : null));
  add(5, () => {
    const r = p.rate_limits?.five_hour?.used_percentage;
    return typeof r === 'number' ? `5h ${Math.round(r)}%` : null;
  });
  add(2, () => (p.output_style?.name && !DEFAULT_STYLES.has(p.output_style.name) ? `style:${p.output_style.name}` : null));
  return out;
}

const visible = s => s.replace(/\x1b\[[0-9;]*m/g, '').length;

function fit(segs, columns) {
  const kept = [...segs];
  const width = () => visible(kept.map(s => s.text).join(G.sep));
  while (kept.length > 1 && width() > columns - 2) {
    const lowest = kept.reduce((lo, s, i) => (s.keep < kept[lo].keep ? i : lo), 0);
    kept.splice(lowest, 1);
  }
  return kept.map(s => s.text).join(G.sep);
}

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let line;
try {
  line = fit(segments(JSON.parse(raw)), Number(process.env.COLUMNS) || 120);
} catch {
  line = 'axon';
}
process.stdout.write(`${line || 'axon'}\n`);
