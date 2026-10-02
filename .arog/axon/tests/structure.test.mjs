// Structure and hygiene of the framework itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS = ['axon-core', 'axon-guard', 'axon-qa', 'axon-learn', 'axon-adp', 'axon-observe'];
const SHIPPED = ['bin', 'installer', 'global', 'config', 'plugins', 'tests', 'docs/decisions'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const shippedFiles = () => SHIPPED.filter(d => existsSync(path.join(ROOT, d))).flatMap(d => walk(path.join(ROOT, d)));

test('marketplace lists exactly the six plugins with matching manifests', () => {
  const m = JSON.parse(readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(m.name, 'axon');
  assert.ok(m.owner?.name);
  assert.deepEqual(m.plugins.map(p => p.name).sort(), [...PLUGINS].sort());
  for (const entry of m.plugins) {
    assert.equal(entry.source, `./plugins/${entry.name}`);
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'plugins', entry.name, '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(manifest.name, entry.name, 'entry name must equal plugin.json name');
    assert.equal(manifest.version, undefined, 'no version: the git commit versions each install (tests/plugins.test.mjs)');
  }
});

test('claude plugin validate accepts the marketplace', { skip: spawnSync('claude', ['--version']).status !== 0 && 'claude CLI not installed' }, () => {
  const r = spawnSync('claude', ['plugin', 'validate', ROOT], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const p of PLUGINS) {
    const v = spawnSync('claude', ['plugin', 'validate', path.join(ROOT, 'plugins', p)], { encoding: 'utf8' });
    assert.equal(v.status, 0, v.stdout + v.stderr);
    // The one accepted warning: no version on purpose (ADR-0010: from a git-hosted marketplace each commit is an update).
    const out = (v.stdout + v.stderr).replace(/^.*version: No version specified.*$/m, '').replace(/Found 1 warning|passed with warnings/g, '');
    assert.doesNotMatch(out, /warning|❯/i, `${p} must validate without other warnings`);
  }
});

test('every .mjs file parses', () => {
  for (const f of shippedFiles().filter(f => f.endsWith('.mjs'))) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}\n${r.stderr}`);
  }
});

test('every .json file parses', () => {
  for (const f of shippedFiles().filter(f => f.endsWith('.json'))) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(f, 'utf8')), f);
  }
});

test('no em dash anywhere in shipped files or docs', () => {
  const files = [...shippedFiles(), ...readdirSync(ROOT).filter(f => f.endsWith('.md')).map(f => path.join(ROOT, f))];
  const bad = files.filter(f => readFileSync(f, 'utf8').includes('\u2014'));
  assert.deepEqual(bad, []);
});

test('no hardcoded user home paths in shipped files', () => {
  const bad = shippedFiles()
    .filter(f => !f.endsWith('structure.test.mjs'))
    .filter(f => /\/Users\/[a-z]/i.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});

test('every agent file pins model: sonnet', () => {
  const agents = PLUGINS.flatMap(p => {
    const d = path.join(ROOT, 'plugins', p, 'agents');
    return existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.md')).map(f => path.join(d, f)) : [];
  });
  for (const f of agents) assert.match(readFileSync(f, 'utf8'), /^model: sonnet$/m, f);
});

test('skills only reference commands that exist on Claude\'s PATH (ISS-0023)', () => {
  const bins = new Set(PLUGINS.flatMap(p => { const d = path.join(ROOT, 'plugins', p, 'bin'); return existsSync(d) ? readdirSync(d) : []; }));
  const skills = PLUGINS.flatMap(p => { const d = path.join(ROOT, 'plugins', p, 'skills'); return existsSync(d) ? readdirSync(d).map(s => path.join(d, s, 'SKILL.md')) : []; });
  for (const f of skills) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /`axon (issue|task|unlock-test|verify)\b/, `${f} uses a space-separated axon command`);
    for (const m of text.matchAll(/`(axon-[a-z-]+)/g)) if (!PLUGINS.includes(m[1])) assert.ok(bins.has(m[1]), `${f} references ${m[1]}, which no plugin ships`);
  }
});

test('no real Cognito pool ids or client ids in shipped files', () => {
  const bad = shippedFiles().filter(f => !f.endsWith('structure.test.mjs')).filter(f => {
    const t = readFileSync(f, 'utf8');
    return /us-(east|west)-\d_[A-Za-z0-9]{9}\b/.test(t) || /\b[a-z0-9]{26}\b/.test(t.replace(/[0-9a-f]{40}/g, ''));
  });
  assert.deepEqual(bad, []);
});

test('output styles: known frontmatter keys only, name matches the file, never force-for-plugin', () => {
  const styles = PLUGINS.flatMap(p => {
    const dir = path.join(ROOT, 'plugins', p, 'output-styles');
    return existsSync(dir) ? readdirSync(dir).map(f => path.join(dir, f)) : [];
  });
  assert.ok(styles.some(f => f.endsWith(path.join('axon-learn', 'output-styles', 'lean.md'))), 'lean style ships in axon-learn');
  for (const f of styles) {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(f, 'utf8'));
    assert.ok(m, `${f}: frontmatter`);
    const fm = Object.fromEntries(m[1].split('\n').map(l => l.split(/:\s*/, 2)));
    for (const k of Object.keys(fm)) assert.ok(['name', 'description', 'keep-coding-instructions'].includes(k), `${f}: key ${k}`);
    assert.equal(fm.name, path.basename(f, '.md'));
    assert.ok(fm.description);
  }
  const base = JSON.parse(readFileSync(path.join(ROOT, 'global', 'settings', 'base.json'), 'utf8'));
  const [plugin, style] = base.outputStyle.split(':');
  assert.ok(existsSync(path.join(ROOT, 'plugins', plugin, 'output-styles', `${style}.md`)), `settings outputStyle ${base.outputStyle} exists`);
});

test('settings statusLine points at a status line script that exists', () => {
  const base = JSON.parse(readFileSync(path.join(ROOT, 'global', 'settings', 'base.json'), 'utf8'));
  const rel = /\$\{AXON_ROOT\}\/([^"\s]+)/.exec(base.statusLine.command)[1];
  assert.ok(existsSync(path.join(ROOT, rel)), rel);
});

test('council: advisor is read-only and Sonnet; the skill runs it through axon-council with all five lenses', () => {
  const agent = readFileSync(path.join(ROOT, 'plugins', 'axon-core', 'agents', 'council-advisor.md'), 'utf8');
  const skill = readFileSync(path.join(ROOT, 'plugins', 'axon-core', 'skills', 'agent-council', 'SKILL.md'), 'utf8');
  assert.match(agent, /^tools: Read, Grep, Glob$/m);
  assert.match(agent, /^disallowedTools: .*Write.*Edit.*Bash.*Agent/m);
  assert.match(agent, /Mode ADVISE/);
  assert.match(agent, /Mode REVIEW/);
  for (const lens of ['Contrarian', 'First principles', 'Expansionist', 'Outsider', 'Executor']) {
    assert.ok(agent.includes(lens), `agent lens ${lens}`);
    assert.ok(skill.includes(lens), `skill lens ${lens}`);
  }
  assert.match(skill, /axon-council --slug/, 'the skill delegates the parallel rounds to axon-council');
  assert.doesNotMatch(skill, /\.html/, 'no model-written HTML report (cost)');
  // Measured chairman costs (P4 run 3): context carried from reads, long framing, probing turns.
  assert.match(skill, /under 1,500 characters/);
  assert.match(skill, /never quote them/);
  assert.match(skill, /no `command -v`/);
  assert.match(skill, /axon-council --verdict/);
});

test('exactly one axon output style: lean (cheapest measured, ISS-0031 rerun), never keeping the built-in coding prompt', () => {
  const dir = path.join(ROOT, 'plugins', 'axon-learn', 'output-styles');
  assert.deepEqual(readdirSync(dir), ['lean.md']);
  assert.match(readFileSync(path.join(dir, 'lean.md'), 'utf8'), /^keep-coding-instructions: false$/m);
});

test('ui-acceptance: run axon-qa first, no pre-checks (ISS-0034)', () => {
  const skill = readFileSync(path.join(ROOT, 'plugins', 'axon-qa', 'skills', 'ui-acceptance', 'SKILL.md'), 'utf8');
  assert.match(skill, /Run `axon-qa run` first/);
  assert.match(skill, /no `curl`/);
  // Live run: auto-opening screenshots and auto-logging every FAIL cost 29 turns ($0.65); after a run the session reports and offers.
  assert.match(skill, /Then stop and offer/);
  assert.doesNotMatch(skill, /open the failing step's screenshot/);
});

// Skill and agent descriptions ride along on every turn (measured P9 review: about 2.3K tokens for all plugins), so
// each stays short and keeps its trigger phrases. The council costs about $0.64 a run: only the user starts it.
test('descriptions stay within the token budget and keep their triggers; the council is user-invoked only', () => {
  const desc = f => /^description:\s*(.*)$/m.exec(readFileSync(f, 'utf8').split('\n---')[0])?.[1] ?? '';
  const files = PLUGINS.flatMap(p => {
    const dir = path.join(ROOT, 'plugins', p);
    const skills = existsSync(path.join(dir, 'skills')) ? readdirSync(path.join(dir, 'skills')).map(s => path.join(dir, 'skills', s, 'SKILL.md')) : [];
    const agents = existsSync(path.join(dir, 'agents')) ? readdirSync(path.join(dir, 'agents')).map(a => path.join(dir, 'agents', a)) : [];
    return [...skills, ...agents];
  });
  const total = files.reduce((n, f) => n + desc(f).length, 0);
  assert.ok(total <= 5200, `all descriptions: ${total} chars (budget 5200)`);
  for (const f of files) assert.ok(desc(f).length <= 260, `${path.relative(ROOT, f)}: ${desc(f).length} chars`);
  const triggers = { mindmaps: /mind map/, 'ui-acceptance': /test the UI/, 'git-push': /commit/, understand: /bug/, 'codebase-to-course': /course/, 'go-until-done': /keep going/ };
  for (const [s, re] of Object.entries(triggers)) assert.match(desc(files.find(f => f.includes(`/skills/${s}/`))), re, s);
  assert.match(readFileSync(path.join(ROOT, 'plugins', 'axon-core', 'skills', 'agent-council', 'SKILL.md'), 'utf8').split('\n---')[0], /^disable-model-invocation: true$/m);
});

// Found in the P9 rehearsal: Claude Code asks before every edit under ~/.claude ("a sensitive file"), even with an
// allow rule, so documents axon writes (plans, issues, reports) live in ~/.axon/docs.
test('no shipped file sends generated documents into ~/.claude', () => {
  // The migration (installer/legacy.mjs and its messages in bin/axon) and the tests name the old location.
  const migration = [path.join('installer', 'legacy.mjs'), path.join('bin', 'axon')];
  const bad = shippedFiles().filter(f => !migration.some(m => f.endsWith(m)) && !f.includes(`${path.sep}tests${path.sep}`) && /\.claude\/docs|'\.claude', 'docs'/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad.map(f => path.relative(ROOT, f)), []);
});
