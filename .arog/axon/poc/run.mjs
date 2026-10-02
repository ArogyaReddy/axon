// POC harness: same task, three execution approaches, measured.
// Usage: node run.mjs <inline|cater|pipeline> <runNumber>
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, rmSync, readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE = path.dirname(new URL(import.meta.url).pathname);
const [approach, runNo] = process.argv.slice(2);
const DIR = path.join(BASE, 'runs', `${approach}-${runNo}`);
rmSync(DIR, { recursive: true, force: true });
cpSync(path.join(BASE, 'fixture'), DIR, { recursive: true });

const PROBLEM = `Bug report from QA: invoices that use a discount code are overcharged on tax, and some tax amounts are one cent too low.
Expected: tax is charged on the subtotal AFTER the discount, and every computed cent amount (tax and percentage discounts) rounds half up to the nearest cent.
Feature request: add percentage discount codes SAVE10 (10% off) and SAVE25 (25% off). Discount codes must be case-insensitive.
Existing behaviour (fixed codes, unknown code throws "Unknown discount code") must stay.`;

const TASK = `${PROBLEM}
Work test-first: add failing tests for the bug and the feature, then fix the code, then run the full test suite with \`node --test\` until everything passes.`;

const COMMON = ['--model', 'sonnet', '--output-format', 'json', '--setting-sources', 'project', '--strict-mcp-config',
  '--no-session-persistence', '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(node:*)'];

const calls = [];
function claude(label, prompt, extra) {
  const t0 = Date.now();
  const r = spawnSync('claude', ['-p', prompt, ...COMMON, ...extra], { cwd: DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let d = {};
  try { d = JSON.parse(r.stdout); } catch { d = { is_error: true, result: (r.stdout || '') + (r.stderr || '') }; }
  const mu = d.modelUsage || {};
  let inTok = 0, outTok = 0, cw = 0, cr = 0;
  for (const m of Object.values(mu)) { inTok += m.inputTokens || 0; outTok += m.outputTokens || 0; cw += m.cacheCreationInputTokens || 0; cr += m.cacheReadInputTokens || 0; }
  const rec = { label, cost: d.total_cost_usd || 0, wall_ms: Date.now() - t0, turns: d.num_turns || 0, input: inTok, output: outTok,
    cache_write: cw, cache_read: cr, error: !!d.is_error, models: Object.keys(mu) };
  calls.push(rec);
  return d;
}

function nodeTest(target) {
  const r = spawnSync('node', ['--test'], { cwd: target, encoding: 'utf8' });
  const pass = Number((r.stdout.match(/ℹ pass (\d+)/) || [])[1] || 0);
  const fail = Number((r.stdout.match(/ℹ fail (\d+)/) || [])[1] || 0);
  return { pass, fail, out: r.stdout.slice(-3000) };
}

function hidden() {
  const r = spawnSync('node', ['--test', path.join(BASE, 'hidden', 'hidden.test.cjs')], { encoding: 'utf8', env: { ...process.env, TARGET: DIR } });
  const pass = Number((r.stdout.match(/ℹ pass (\d+)/) || [])[1] || 0);
  return pass;
}

function hashTests() {
  const dir = path.join(DIR, 'test');
  return readdirSync(dir).sort().map(f => f + ':' + createHash('sha1').update(readFileSync(path.join(dir, f))).digest('hex')).join('|');
}

const tStart = Date.now();
const notes = [];

if (approach === 'inline') {
  claude('inline', TASK, ['--tools', 'Read,Edit,Write,Bash,Glob,Grep']);
}

if (approach === 'cater') {
  const agents = {
    analyst: { description: 'Read-only analyst: finds root cause and writes PLAN.md', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Write'],
      prompt: 'You analyse the codebase read-only and write an implementation plan to PLAN.md: root cause, files to change, and concrete test cases with inputs and expected cent values. Do not change source or test files. Return a 3-line summary and the path.' },
    'test-writer': { description: 'Writes failing tests from PLAN.md', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
      prompt: 'You write failing tests (node:test + assert) in test/acceptance.test.js from the test cases in PLAN.md. Do not change src/. Run node --test to confirm the new tests fail. Return a 2-line summary.' },
    builder: { description: 'Implements code until all tests pass', model: 'sonnet', tools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      prompt: 'You implement the plan in PLAN.md so that every test passes (node --test). Never modify files under test/. Keep going until the suite is green. Return a 2-line summary.' },
    verifier: { description: 'Independent read-only verification', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'],
      prompt: 'You verify independently that the bug and feature in PLAN.md are implemented: run node --test and check edge cases. Never edit files. Return PASS or FAIL per criterion.' },
  };
  const prompt = `${PROBLEM}

You are the orchestrator of a CATER workflow. Do not read or edit code yourself. Delegate in order:
1. analyst agent: root cause and plan in PLAN.md
2. test-writer agent: failing tests from the plan
3. builder agent: make all tests pass without editing tests
4. verifier agent: independent check
If the verifier reports FAIL, send the builder back with the failure. Finish with a short summary.`;
  claude('cater', prompt, ['--tools', 'Read,Edit,Write,Bash,Glob,Grep,Agent', '--agents', JSON.stringify(agents)]);
}

if (approach === 'pipeline') {
  // Phase 1: plan (read-only, structured output)
  const planSchema = { type: 'object', required: ['root_cause', 'changes', 'test_cases'], properties: {
    root_cause: { type: 'string' },
    changes: { type: 'array', items: { type: 'object', required: ['file', 'change'], properties: { file: { type: 'string' }, change: { type: 'string' } } } },
    test_cases: { type: 'array', items: { type: 'object', required: ['name', 'call', 'expected'], properties: {
      name: { type: 'string' }, call: { type: 'string' }, expected: { type: 'string' } } } } } };
  const p1 = claude('plan', `${PROBLEM}\n\nRead the codebase and produce an implementation plan: the root cause, the change per file, and concrete test cases. For each test case give the exact buildInvoice(...) call and the exact expected values in cents.`,
    ['--tools', 'Read,Grep,Glob', '--json-schema', JSON.stringify(planSchema)]);
  const plan = p1.structured_output;
  if (!plan) { notes.push('plan phase returned no structured output'); }
  writeFileSync(path.join(DIR, 'PLAN.json'), JSON.stringify(plan, null, 2));

  // Phase 2: failing tests (no source edits)
  const srcBefore = createHash('sha1').update(readdirSync(path.join(DIR, 'src')).map(f => readFileSync(path.join(DIR, 'src', f))).join('')).digest('hex');
  claude('tests', `Write failing tests in test/acceptance.test.js (node:test + node:assert, require('../src/invoice')) for exactly these cases:\n${JSON.stringify(plan?.test_cases, null, 2)}\nOnly create that one file. Do not touch src/.`,
    ['--tools', 'Read,Write,Glob']);
  const srcAfter = createHash('sha1').update(readdirSync(path.join(DIR, 'src')).map(f => readFileSync(path.join(DIR, 'src', f))).join('')).digest('hex');
  if (srcBefore !== srcAfter) notes.push('GATE: test phase modified src');
  const red = nodeTest(DIR);
  notes.push(`RED gate: ${red.fail > 0 ? 'ok' : 'FAILED (no failing tests)'} (pass ${red.pass}, fail ${red.fail})`);
  const testHash = hashTests();

  // Phase 3: build, code-controlled retry loop (max 3 attempts)
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    claude(`build-${attempt}`, `Implement this plan so that every test passes:\n${JSON.stringify(plan, null, 2)}\nRun node --test to check. Never modify anything under test/.${feedback}`,
      ['--tools', 'Read,Edit,Write,Bash,Glob,Grep']);
    if (hashTests() !== testHash) notes.push(`GATE: build-${attempt} modified tests`);
    const g = nodeTest(DIR);
    notes.push(`GREEN check after build-${attempt}: pass ${g.pass}, fail ${g.fail}`);
    if (g.fail === 0) break;
    feedback = `\n\nThe previous attempt left failing tests. Output:\n${g.out}`;
  }
}

const vis = nodeTest(DIR);
const hid = hidden();
const sum = k => calls.reduce((s, c) => s + c[k], 0);
const result = { approach, run: Number(runNo), hidden_pass: hid, hidden_total: 7, visible_pass: vis.pass, visible_fail: vis.fail,
  cost_usd: +sum('cost').toFixed(4), wall_s: Math.round((Date.now() - tStart) / 1000), calls: calls.length, turns: sum('turns'),
  input: sum('input'), output: sum('output'), cache_write: sum('cache_write'), cache_read: sum('cache_read'),
  errors: calls.filter(c => c.error).length, notes, per_call: calls };
appendFileSync(path.join(BASE, 'results.jsonl'), JSON.stringify(result) + '\n');
console.log(JSON.stringify({ ...result, per_call: undefined }));
