// axon export --copilot: write axon's hooks, skills, agents and rules where VS Code Copilot (Local harness) and the
// Copilot CLI find them: ~/.copilot/{hooks,skills,agents,instructions} or <repo>/.github/{...}. Copilot cannot see the
// Claude plugin cache, so the files are copies; a manifest of what was written lets a second run update only axon's
// own files and --remove take back exactly those. A file axon did not write, or that you changed, is never touched.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';

// Agents Copilot can use as subagents. council-advisor and qa-agent only run through `claude -p --agent` from the
// axon-council and axon-qa commands, which work the same from a Copilot terminal.
const AGENTS = ['reviewer', 'verifier'];
// Claude tool -> VS Code tool set (Copilot Chat 0.68 languageModelToolSets plus the built-in execute and agent sets).
const TOOLSET = { Read: 'read', Grep: 'search', Glob: 'search', LS: 'search', Bash: 'execute', Write: 'edit', Edit: 'edit',
  MultiEdit: 'edit', NotebookEdit: 'edit', WebFetch: 'web', WebSearch: 'web', Agent: 'agent', Task: 'agent' };
// {NOT SURE: Copilot model display names; checked in the P8 live run}
const MODELS = { sonnet: ['Claude Sonnet 4.6 (copilot)', 'Claude Sonnet 4.5 (copilot)'] };
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'PostToolUseFailure']);

const q = s => `'${String(s).replaceAll("'", "'\\''")}'`;
const sha = c => createHash('sha256').update(c).digest('hex');
const listDir = d => (existsSync(d) ? readdirSync(d) : []);

function walk(dir, base = dir) {
  return listDir(dir).flatMap(n => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? walk(f, base) : [path.relative(base, f)];
  });
}

// Every command a plugin puts on Claude's PATH, plus the axon CLI, by full path.
function commands(axonRoot) {
  const map = new Map([['axon', path.join(axonRoot, 'bin', 'axon')]]);
  for (const p of listDir(path.join(axonRoot, 'plugins'))) {
    for (const c of listDir(path.join(axonRoot, 'plugins', p, 'bin'))) map.set(c, path.join(axonRoot, 'plugins', p, 'bin', c));
  }
  return map;
}

// Inside inline code and fenced blocks only, a bare command name becomes its quoted full path.
function withFullPaths(md, cmds) {
  const names = [...cmds.keys()].sort((a, b) => b.length - a.length).map(n => n.replace(/[-]/g, '\\-'));
  const re = new RegExp(`(?<![\\w/.~$'-])(${names.join('|')})(?![\\w/.'-])`, 'g');
  const fix = code => code.replace(re, n => q(cmds.get(n)));
  return md.replace(/```[\s\S]*?```|`[^`\n]+`/g, fix);
}

// Skill wording that is only true in Claude Code, where the plugin bin folders are on PATH.
const forCopilot = md => md
  .replace(/ \(on Claude's PATH; in your terminal use `[^`]+`\)/g, '')
  .replace(/, on your PATH\)/g, ')')
  .replace(/ is on your PATH \(([\w-]+)\)/g, " is axon's command ($1)")
  .replace(/ on your PATH/g, '');

function hookFile(axonRoot, observe) {
  const adapter = path.join(axonRoot, 'copilot', 'hook.mjs');
  const plugins = ['axon-guard', ...(observe ? ['axon-observe'] : [])];
  const hooks = {};
  for (const plugin of plugins) {
    const dir = path.join(axonRoot, 'plugins', plugin);
    const cfg = JSON.parse(readFileSync(path.join(dir, 'hooks', 'hooks.json'), 'utf8')).hooks;
    for (const [event, groups] of Object.entries(cfg)) {
      for (const g of groups) {
        for (const h of g.hooks) {
          const script = h.args[0].replace('${CLAUDE_PLUGIN_ROOT}', dir);
          const parts = ['node', q(adapter), '--event', q(event)];
          if (g.matcher && TOOL_EVENTS.has(event)) parts.push('--matcher', q(g.matcher));
          parts.push(q(script));
          (hooks[event] ??= []).push({ type: 'command', bash: parts.join(' '), timeoutSec: Math.max(10, (h.timeout ?? 5) * 2) });
        }
      }
    }
  }
  return `${JSON.stringify({ version: 1, hooks }, null, 2)}\n`;
}

function agentFile(src) {
  const text = readFileSync(src, 'utf8');
  const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  const field = k => (new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(front) || [])[1];
  const tools = [...new Set((field('tools') ?? '').split(',').map(s => TOOLSET[s.trim()]).filter(Boolean))];
  const lines = [`name: ${field('name')}`, `description: ${field('description')}`, `tools: [${tools.map(t => `'${t}'`).join(', ')}]`];
  const models = MODELS[field('model')];
  if (models) lines.push(`model: [${models.map(m => `'${m}'`).join(', ')}]`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

// The global rules, adapted: the Claude-only parts (output style, /effort, commands on PATH) are replaced.
function instructionsFile(axonRoot, cmds) {
  const src = readFileSync(path.join(axonRoot, 'global', 'rules', 'axon.md'), 'utf8');
  const sections = src.split(/^(?=## )/m);
  const intro = '# axon - global working rules\n\nFacts and non-negotiable rules for every project. The axon hooks also enforce the order of work (plan before\ncode, test before fix, verify before done) and say why when they block.\n\n';
  const tools = '## Tools\n\n- axon commands run by full path here, exactly as the axon skills write them. Never probe first with `which`,\n  `command -v`, `type`, `ls` or `--help`, and never install anything yourself. If one is missing, say that\n  `axon tools install` or the axon checkout provides it and stop.\n\n';
  const body = sections.slice(1).filter(s => !s.startsWith('## Effort')).map(s => (s.startsWith('## Tools') ? tools : s)).join('');
  return `---\napplyTo: '**'\ndescription: axon working rules (exported from axon by axon export --copilot)\n---\n\n${withFullPaths(intro + body, cmds).trimEnd()}\n`;
}

// Files to write, relative to the target (~/.copilot or <repo>/.github). Skills are grouped so a skill folder is
// written whole or not at all.
export function planExport({ axonRoot, target, observe = false }) {
  const cmds = commands(axonRoot);
  const files = [{ rel: 'hooks/axon.json', content: hookFile(axonRoot, observe) }];
  for (const p of listDir(path.join(axonRoot, 'plugins'))) {
    const skills = path.join(axonRoot, 'plugins', p, 'skills');
    for (const name of listDir(skills)) {
      const qualifiedName = `${p}:${name}`;
      for (const f of walk(path.join(skills, name))) {
        const src = path.join(skills, name, f);
        let content = f.endsWith('.md') ? withFullPaths(forCopilot(readFileSync(src, 'utf8')), cmds) : readFileSync(src);
        // Rewrite the name field in SKILL.md frontmatter to include the plugin prefix,
        // so VS Code Copilot Chat and Antigravity show /axon-learn:code-mentor (matching Claude Code).
        if (f === 'SKILL.md') content = content.replace(/^(name:\s*).+$/m, `$1${qualifiedName}`);
        files.push({ rel: `skills/${qualifiedName}/${f.split(path.sep).join('/')}`, content, mode: statSync(src).mode & 0o777, skill: qualifiedName });
      }
    }
  }
  for (const a of AGENTS) {
    files.push({ rel: `agents/${a}.agent.md`, content: agentFile(path.join(axonRoot, 'plugins', 'axon-core', 'agents', `${a}.md`)) });
  }
  files.push({ rel: 'instructions/axon.instructions.md', content: instructionsFile(axonRoot, cmds) });
  return files.map(f => ({ ...f, abs: path.join(target, f.rel) }));
}

const manifestPath = home => path.join(home, '.axon', 'state', 'copilot-export.json');
const loadManifest = home => (existsSync(manifestPath(home)) ? JSON.parse(readFileSync(manifestPath(home), 'utf8')) : { targets: {} });
function saveManifest(home, m) {
  mkdirSync(path.dirname(manifestPath(home)), { recursive: true });
  writeFileSync(manifestPath(home), `${JSON.stringify(m, null, 2)}\n`);
}
const hashOf = f => (existsSync(f) ? sha(readFileSync(f)) : null);

export function exportCopilot({ axonRoot, home, target, observe = false, dryRun = false }) {
  const manifest = loadManifest(home);
  const owned = manifest.targets[target]?.files ?? {};
  const files = planExport({ axonRoot, target, observe });
  const ours = rel => owned[rel] !== undefined;
  // A file is foreign when it exists, axon did not write it, and it differs from what axon would write.
  const foreign = f => existsSync(f.abs) && !ours(f.rel) && hashOf(f.abs) !== sha(f.content);
  const changedByUser = f => ours(f.rel) && existsSync(f.abs) && hashOf(f.abs) !== owned[f.rel];
  const blockedSkills = new Set(files.filter(f => f.skill && f.rel.endsWith('/SKILL.md') && foreign(f)).map(f => f.skill));
  const r = { target, written: [], unchanged: [], skipped: [], removed: [] };
  const next = {};
  for (const f of files) {
    if ((f.skill && blockedSkills.has(f.skill)) || foreign(f) || changedByUser(f)) { r.skipped.push(f.rel); if (ours(f.rel)) next[f.rel] = owned[f.rel]; continue; }
    const want = sha(f.content);
    next[f.rel] = want;
    if (hashOf(f.abs) === want) { r.unchanged.push(f.rel); continue; }
    r.written.push(f.rel);
    if (dryRun) continue;
    mkdirSync(path.dirname(f.abs), { recursive: true });
    writeFileSync(f.abs, f.content);
    if (f.mode) chmodSync(f.abs, f.mode);
  }
  // Files axon wrote before that it no longer exports (a skill was renamed or dropped).
  for (const [rel, h] of Object.entries(owned)) {
    if (next[rel] !== undefined) continue;
    const abs = path.join(target, rel);
    if (hashOf(abs) === h) { r.removed.push(rel); if (!dryRun) { rmSync(abs); pruneEmpty(path.dirname(abs), target); } }
  }
  if (!dryRun) { manifest.targets[target] = { files: next, observe, at: new Date().toISOString() }; saveManifest(home, manifest); }
  return r;
}

function pruneEmpty(dir, stop) {
  while (dir.startsWith(`${stop}${path.sep}`) && existsSync(dir) && readdirSync(dir).length === 0) {
    rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

export function removeCopilot({ home, target }) {
  const manifest = loadManifest(home);
  const owned = manifest.targets[target]?.files;
  if (!owned) return { mode: 'not-exported', removed: [], kept: [] };
  const r = { mode: 'removed', removed: [], kept: [] };
  for (const [rel, h] of Object.entries(owned)) {
    const abs = path.join(target, rel);
    if (!existsSync(abs)) continue;
    if (hashOf(abs) === h) { rmSync(abs); r.removed.push(rel); pruneEmpty(path.dirname(abs), target); } else r.kept.push(rel);
  }
  delete manifest.targets[target];
  saveManifest(home, manifest);
  return r;
}

export const SETTINGS_NOTE = `VS Code reads these locations by default; axon never edits your VS Code settings. Check:
  "chat.useHooks": true          hooks run (default on; hooks are a Preview feature)
  "chat.useClaudeHooks"          leave as you have it: it adds hooks from ~/.claude/settings.json, not axon's
Skills appear as /commands, the reviewer and verifier agents in the agents list, and the rules apply to every file.`;

// For axon doctor: per exported target, the files whose exported copy is older than what axon would write now.
export function exportStatus({ axonRoot, home }) {
  return Object.entries(loadManifest(home).targets).map(([target, { files, observe }]) => {
    const plan = new Map(planExport({ axonRoot, target, observe }).map(f => [f.rel, sha(f.content)]));
    const stale = [...plan].filter(([rel, h]) => files[rel] !== h).map(([rel]) => rel);
    const command = path.basename(target) === '.github' ? `axon export --copilot --repo ${path.dirname(target)}` : 'axon export --copilot';
    return { target, stale, command: observe ? `${command} --observe` : command };
  });
}
