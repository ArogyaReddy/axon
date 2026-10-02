// P8 Copilot export: the hook adapter (Copilot payloads in, Claude-shaped payloads to the same axon hook scripts,
// answers widened so VS Code and the Copilot CLI both read them) and `axon export --copilot` (hooks, skills, agents,
// instructions under ~/.copilot or <repo>/.github, tracked by a manifest). Payload shapes: tests/fixtures/copilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, widen } from '../copilot/map.mjs';
import { planExport, exportCopilot, removeCopilot } from '../copilot/export.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADAPTER = path.join(ROOT, 'copilot', 'hook.mjs');
const GUARD = name => path.join(ROOT, 'plugins', 'axon-guard', 'hooks', 'bin', `${name}.mjs`);
const AXON = path.join(ROOT, 'bin', 'axon');

function setup() {
  const repo = mkdtempSync(path.join(tmpdir(), 'axon-cp-repo-'));
  mkdirSync(path.join(repo, '.git'));
  mkdirSync(path.join(repo, 'src'));
  writeFileSync(path.join(repo, 'src', 'a.js'), 'export const a = 1;\n');
  const home = mkdtempSync(path.join(tmpdir(), 'axon-cp-home-'));
  const env = { ...process.env, AXON_HOME: path.join(home, '.axon'), AXON_STATE_DIR: path.join(home, '.axon', 'state'), AXON_DISABLE: '' };
  return { repo, home, env };
}
const fixture = (name, t) => JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', 'copilot', `${name}.json`), 'utf8').replaceAll('${REPO}', t.repo));

function adapt(t, args, body) {
  const r = spawnSync(process.execPath, [ADAPTER, ...args], { input: typeof body === 'string' ? body : JSON.stringify(body), encoding: 'utf8', env: t.env, cwd: t.repo });
  return { ...r, json: r.stdout ? JSON.parse(r.stdout) : null };
}

// ---------- payload mapping ----------

test('normalize: terminal tools of both harnesses become Bash with the same command', () => {
  const t = setup();
  const [vs] = normalize(fixture('vscode-pre-terminal', t));
  assert.equal(vs.tool_name, 'Bash');
  assert.equal(vs.tool_input.command, 'git reset --hard');
  assert.equal(vs.session_id, 'vscode-session-1');
  assert.equal(vs.cwd, t.repo);
  const [cli] = normalize(fixture('cli-pre-bash', t));
  assert.equal(cli.tool_name, 'Bash');
  assert.equal(cli.tool_input.command, 'git push --force origin main');
});

test('normalize: file tools become Write/Edit/Read with file_path; camelCase CLI payloads and string args are read', () => {
  const t = setup();
  const [create] = normalize(fixture('vscode-pre-create-file', t));
  assert.deepEqual([create.tool_name, create.tool_input.file_path], ['Write', `${t.repo}/.env`]);
  const [edit] = normalize(fixture('cli-pre-edit-camel', t), { event: 'PreToolUse' });
  assert.deepEqual([edit.tool_name, edit.tool_input.file_path, edit.hook_event_name, edit.session_id],
    ['Edit', `${t.repo}/package-lock.json`, 'PreToolUse', 'cli-session-2']);
  const [read] = normalize(fixture('vscode-pre-read-file', t));
  assert.deepEqual([read.tool_name, read.tool_input.file_path], ['Read', `${t.repo}/src/a.js`]);
  const [cliCreate] = normalize(fixture('cli-post-create', t));
  assert.deepEqual([cliCreate.tool_name, cliCreate.tool_input.file_path, cliCreate.tool_response.stdout], ['Write', `${t.repo}/src/b.js`, 'Created file']);
});

test('normalize: multi-file edits become one Edit payload per file (multi-replace and apply_patch)', () => {
  const t = setup();
  const multi = normalize(fixture('vscode-pre-multi-replace', t));
  assert.deepEqual(multi.map(p => [p.tool_name, p.tool_input.file_path]), [['Edit', `${t.repo}/src/a.js`], ['Edit', `${t.repo}/CHANGELOG.md`]]);
  const patch = normalize(fixture('vscode-pre-apply-patch', t));
  assert.deepEqual(patch.map(p => [p.tool_name, p.tool_input.file_path]), [['Edit', `${t.repo}/src/a.js`], ['Write', `${t.repo}/config/prod.pem`]]);
});

test('normalize: the VS Code result text becomes tool_response.stdout; a missing cwd falls back to the process folder', () => {
  const t = setup();
  const [post] = normalize(fixture('vscode-post-terminal', t));
  assert.match(post.tool_response.stdout, /# pass 3/);
  const { cwd, ...noCwd } = fixture('vscode-stop', t);
  assert.equal(normalize(noCwd, { cwd: '/somewhere' })[0].cwd, '/somewhere');
  assert.equal(normalize(fixture('vscode-pre-terminal', t))[0].axon_host, 'copilot');
});

test('normalize: unknown tools keep their name, so no axon hook mistakes them for a known one', () => {
  const [p] = normalize({ hook_event_name: 'PreToolUse', tool_name: 'copilot_fetchWebPage', tool_input: { urls: ['https://x.test'] }, cwd: '/r' });
  assert.equal(p.tool_name, 'copilot_fetchWebPage');
});

test('widen: decisions are written in both the VS Code and the Copilot CLI shape', () => {
  const deny = widen({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'no' } });
  assert.equal(deny.hookSpecificOutput.permissionDecision, 'deny');
  assert.deepEqual([deny.permissionDecision, deny.permissionDecisionReason], ['deny', 'no']);
  const stop = widen({ decision: 'block', reason: 'verify first' }, 'Stop');
  assert.deepEqual([stop.decision, stop.hookSpecificOutput.decision, stop.hookSpecificOutput.reason], ['block', 'block', 'verify first']);
  const ctx = widen({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'facts' } });
  assert.equal(ctx.additionalContext, 'facts');
});

// ---------- the adapter, driving the real axon-guard scripts ----------

test('adapter: a VS Code terminal call to git reset --hard is denied in both shapes, exit 0', () => {
  const t = setup();
  const r = adapt(t, ['--matcher', 'Bash', GUARD('pre-bash')], fixture('vscode-pre-terminal', t));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(r.json.permissionDecision, 'deny');
  assert.match(r.json.permissionDecisionReason, /git-reset-hard/);
});

test('adapter: Copilot CLI force push is denied; a harmless command and a non-matching tool print nothing', () => {
  const t = setup();
  assert.equal(adapt(t, ['--matcher', 'Bash', GUARD('pre-bash')], fixture('cli-pre-bash', t)).json.permissionDecision, 'deny');
  const ls = adapt(t, ['--matcher', 'Bash', GUARD('pre-bash')], { ...fixture('vscode-pre-terminal', t), tool_input: { command: 'ls -la' } });
  assert.deepEqual([ls.status, ls.stdout], [0, '']);
  const read = adapt(t, ['--matcher', 'Bash', GUARD('pre-bash')], fixture('vscode-pre-read-file', t));
  assert.deepEqual([read.status, read.stdout], [0, '']);
});

test('adapter: file guards see every file of a multi-file edit (secret, generated)', () => {
  const t = setup();
  const m = 'Write|Edit|MultiEdit|NotebookEdit';
  assert.match(adapt(t, ['--matcher', m, GUARD('pre-edit')], fixture('vscode-pre-create-file', t)).json.permissionDecisionReason, /secret/);
  assert.match(adapt(t, ['--matcher', m, GUARD('pre-edit')], fixture('vscode-pre-multi-replace', t)).json.permissionDecisionReason, /CHANGELOG\.md.*generated/);
  assert.match(adapt(t, ['--matcher', m, GUARD('pre-edit')], fixture('vscode-pre-apply-patch', t)).json.permissionDecisionReason, /prod\.pem.*secret/);
  const camel = adapt(t, ['--event', 'PreToolUse', '--matcher', m, GUARD('pre-edit')], fixture('cli-pre-edit-camel', t));
  assert.match(camel.json.permissionDecisionReason, /package-lock\.json.*generated/);
});

test('adapter: a Stop block from the script reaches VS Code as hookSpecificOutput.decision', () => {
  const t = setup();
  const script = path.join(t.home, 'stop.mjs');
  writeFileSync(script, "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write(JSON.stringify({ decision: 'block', reason: 'run axon-verify first' })));\n");
  const r = adapt(t, [script], fixture('vscode-stop', t));
  assert.deepEqual([r.json.hookSpecificOutput.decision, r.json.hookSpecificOutput.reason], ['block', 'run axon-verify first']);
});

test('adapter fails open: a crashing script, garbage output, bad input or a missing script never deny (Copilot treats errors as deny)', () => {
  const t = setup();
  const crash = path.join(t.home, 'crash.mjs');
  writeFileSync(crash, 'process.exit(3);\n');
  const garbage = path.join(t.home, 'garbage.mjs');
  writeFileSync(garbage, "process.stdout.write('not json');\n");
  for (const [args, body] of [[[crash], fixture('vscode-pre-terminal', t)], [[garbage], fixture('vscode-pre-terminal', t)],
    [[GUARD('pre-bash')], 'not json'], [[path.join(t.home, 'missing.mjs')], fixture('vscode-pre-terminal', t)]]) {
    const r = adapt(t, args, body);
    assert.deepEqual([r.status, r.stdout], [0, ''], `${args} ${r.stderr}`);
  }
});

test('adapter: the event log records Copilot events with the Claude tool name and source copilot', () => {
  const t = setup();
  const r = adapt(t, [path.join(ROOT, 'plugins', 'axon-observe', 'hooks', 'event-log.mjs')], fixture('vscode-pre-terminal', t));
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(t.home, '.axon', 'events');
  const [e] = readdirSync(dir).flatMap(f => readFileSync(path.join(dir, f), 'utf8').trim().split('\n')).map(l => JSON.parse(l));
  assert.deepEqual([e.tool, e.source, e.target], ['Bash', 'copilot', 'git reset --hard']);
});

// ---------- the export ----------

test('export plan: one Copilot-format hook file for both harnesses, every guard script behind the adapter', () => {
  const t = setup();
  const files = planExport({ axonRoot: ROOT, target: path.join(t.home, '.copilot') });
  const hooks = JSON.parse(files.find(f => f.rel === 'hooks/axon.json').content);
  assert.equal(hooks.version, 1);
  for (const ev of ['PreToolUse', 'PostToolUse', 'Stop', 'SessionStart', 'UserPromptSubmit', 'SessionEnd']) assert.ok(hooks.hooks[ev]?.length, ev);
  for (const h of Object.values(hooks.hooks).flat()) {
    assert.equal(h.type, 'command');
    assert.match(h.bash, /^node '[^']+\/copilot\/hook\.mjs' /);
    assert.ok(h.timeoutSec > 0);
    const script = /'([^']+\.mjs)'$/.exec(h.bash)[1];
    assert.ok(existsSync(script), script);
  }
  assert.ok(hooks.hooks.PreToolUse.some(h => h.bash.includes("--matcher 'Bash'") && h.bash.endsWith("pre-bash.mjs'")));
  assert.ok(!JSON.stringify(hooks).includes('event-log'), 'the event log is opt-in (--observe)');
  const withObserve = planExport({ axonRoot: ROOT, target: path.join(t.home, '.copilot'), observe: true });
  assert.ok(withObserve.find(f => f.rel === 'hooks/axon.json').content.includes('event-log.mjs'));
});

test('export plan: every axon skill, its name matching its folder, axon commands rewritten to full paths that exist', () => {
  const t = setup();
  const files = planExport({ axonRoot: ROOT, target: path.join(t.home, '.copilot') });
  const skills = files.filter(f => /^skills\/[^/]+\/SKILL\.md$/.test(f.rel));
  const pluginSkills = readdirSync(path.join(ROOT, 'plugins')).flatMap(p => existsSync(path.join(ROOT, 'plugins', p, 'skills')) ? readdirSync(path.join(ROOT, 'plugins', p, 'skills')).map(s => `${p}:${s}`) : []);
  assert.equal(skills.length, pluginSkills.length);
  for (const s of skills) {
    const folder = s.rel.split('/')[1];
    assert.match(s.content, new RegExp(`^---\\nname: ${folder}\\n`), s.rel);
    for (const m of s.content.matchAll(/`([^`\n]+)`/g)) {
      assert.doesNotMatch(m[1], /(?:^|[\s(|;&])(?:axon-(?:qa|council|mindmap|issue|task|verify|unlock-test|plan-new|plan-check|book-verify|trace)|playwright-cli|pilot-sync|check-i18n)\b/, `${s.rel}: ${m[1]}`);
    }
    for (const p of s.content.matchAll(/'(\/[^']+\/bin\/[\w-]+)'/g)) assert.ok(existsSync(p[1]), p[1]);
    assert.doesNotMatch(s.content, /on your PATH|Claude's PATH/, `${s.rel} claims a PATH Copilot does not have`);
  }
  const qa = skills.find(s => s.rel === 'skills/axon-qa:ui-acceptance/SKILL.md').content;
  assert.match(qa, /'[^']+\/plugins\/axon-qa\/bin\/axon-qa' run/);
  assert.ok(files.some(f => f.rel === 'skills/axon-learn:mindmaps/references/outline-rules.md'), 'reference files are copied');
});

test('export plan: reviewer and verifier become Copilot agents with Copilot tool sets; instructions fit Copilot', () => {
  const t = setup();
  const files = planExport({ axonRoot: ROOT, target: path.join(t.home, '.copilot') });
  const reviewer = files.find(f => f.rel === 'agents/reviewer.agent.md').content;
  assert.match(reviewer, /^---\nname: reviewer\n/);
  assert.match(reviewer, /\ntools: \['read', 'search', 'execute'\]\n/);
  assert.doesNotMatch(reviewer, /\n(?:disallowedTools|maxTurns|color):/);
  assert.match(reviewer, /\nmodel: \[/);
  assert.ok(files.some(f => f.rel === 'agents/verifier.agent.md'));
  assert.ok(!files.some(f => /council-advisor|qa-agent/.test(f.rel)), 'agents that only axon CLIs run through Claude stay out');
  const ins = files.find(f => f.rel === 'instructions/axon.instructions.md').content;
  assert.match(ins, /^---\napplyTo: '\*\*'\n/);
  assert.doesNotMatch(ins, /## Effort|\/effort|on your PATH/);
  assert.match(ins, /never probe/i);
  for (const f of files) assert.ok(!f.content?.includes('\u2014'), `em dash in ${f.rel}`);
});

test('export writes, is idempotent, never overwrites a file it does not own, and remove takes back only its own files', () => {
  const t = setup();
  const target = path.join(t.home, '.copilot');
  mkdirSync(path.join(target, 'skills', 'axon-learn:mindmaps'), { recursive: true });
  writeFileSync(path.join(target, 'skills', 'axon-learn:mindmaps', 'SKILL.md'), 'mine\n');
  const first = exportCopilot({ axonRoot: ROOT, home: t.home, target });
  assert.ok(first.written.includes('hooks/axon.json'));
  assert.ok(first.skipped.includes('skills/axon-learn:mindmaps/SKILL.md'));
  assert.equal(readFileSync(path.join(target, 'skills', 'axon-learn:mindmaps', 'SKILL.md'), 'utf8'), 'mine\n');
  assert.equal(exportCopilot({ axonRoot: ROOT, home: t.home, target }).written.length, 0, 'second run changes nothing');
  writeFileSync(path.join(target, 'skills', 'axon-core:tdd', 'SKILL.md'), 'edited by the user\n');
  const removed = removeCopilot({ home: t.home, target });
  assert.ok(removed.kept.includes('skills/axon-core:tdd/SKILL.md'));
  assert.ok(!existsSync(path.join(target, 'hooks', 'axon.json')));
  assert.ok(existsSync(path.join(target, 'skills', 'axon-learn:mindmaps', 'SKILL.md')));
  assert.ok(existsSync(path.join(target, 'skills', 'axon-core:tdd', 'SKILL.md')));
  assert.ok(!existsSync(path.join(target, 'skills', 'axon-learn:wh-explainer')), 'emptied folders are removed');
});

test('axon export --copilot: dry run writes nothing; --repo targets .github; --remove; usage lists export', () => {
  const t = setup();
  const run = (...a) => spawnSync(process.execPath, [AXON, ...a, '--home', t.home], { encoding: 'utf8', env: t.env });
  const dry = run('export', '--copilot', '--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Would write \d+ file/);
  assert.ok(!existsSync(path.join(t.home, '.copilot')));
  const repo = run('export', '--copilot', '--repo', t.repo);
  assert.equal(repo.status, 0, repo.stderr);
  assert.ok(existsSync(path.join(t.repo, '.github', 'hooks', 'axon.json')));
  assert.match(repo.stdout, /chat\.useHooks/);
  assert.match(repo.stdout, /full paths on this Mac/);
  assert.equal(run('export', '--copilot', '--repo', t.repo, '--remove').status, 0);
  assert.ok(!existsSync(path.join(t.repo, '.github', 'hooks', 'axon.json')));
  assert.match(spawnSync(process.execPath, [AXON], { encoding: 'utf8' }).stdout, /export\s+--copilot/);
  rmSync(t.repo, { recursive: true, force: true });
});
