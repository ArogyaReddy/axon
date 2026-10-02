// Hook and status line latency benchmark: p50/p95 wall time per hook, as Claude Code runs them (a fresh node process per call).
// Budgets from the plan (section 8.4). Run: npm run bench
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = name => path.join(ROOT, 'plugins', 'axon-guard', 'hooks', 'bin', `${name}.mjs`);
const dir = mkdtempSync(path.join(tmpdir(), 'axon-bench-'));
execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
writeFileSync(path.join(dir, 'a.json'), '{"a": 1}\n');
execFileSync('git', ['add', '.'], { cwd: dir });
execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'bench'], { cwd: dir });
const env = { ...process.env, AXON_HOME: mkdtempSync(path.join(tmpdir(), 'axon-bench-home-')), AXON_DISABLE: '' };
const fixture = name => JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', 'payloads', `${name}.json`), 'utf8').replaceAll('${REPO}', dir));

const CASES = [
  ['pre-bash', 80, { ...fixture('pre-bash'), tool_input: { command: 'npm test' } }],
  ['pre-edit', 80, { ...fixture('pre-write'), tool_input: { file_path: path.join(dir, 'src', 'a.js'), content: 'x' } }],
  ['post-tool (edit, JSON check)', 300, { ...fixture('post-write'), tool_input: { file_path: path.join(dir, 'a.json'), content: '' } }, 'post-tool'],
  ['post-tool (test run)', 50, fixture('post-bash-ok'), 'post-tool'],
  ['prompt-submit', 80, fixture('prompt-submit')],
  ['session-start', 400, fixture('session-start')],
  ['stop-gate', 150, fixture('stop')],
  ['session-end', 300, fixture('session-end')],
];

const STATUSLINE = path.join(ROOT, 'global', 'statusline', 'statusline.mjs');
const slPayload = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', 'statusline', 'full.json'), 'utf8').replaceAll('${REPO}', dir));
CASES.push(['statusline', 50, slPayload, STATUSLINE]);

const N = Number(process.env.BENCH_RUNS ?? 40);
let over = 0;
console.log(`hook latency, ${N} runs each (ms)\n`);
for (const [label, budget, body, script = label] of CASES) {
  const t = [];
  for (let i = 0; i < N; i++) {
    const s = process.hrtime.bigint();
    spawnSync(process.execPath, [script.endsWith('.mjs') ? script : HOOK(script)], { input: JSON.stringify(body), env });
    t.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  t.sort((a, b) => a - b);
  const p = q => t[Math.min(t.length - 1, Math.floor(t.length * q))].toFixed(0);
  const ok = Number(p(0.95)) <= budget;
  if (!ok) over++;
  console.log(`${label.padEnd(30)} p50 ${p(0.5).padStart(4)}  p95 ${p(0.95).padStart(4)}  budget ${String(budget).padStart(4)}  ${ok ? 'OK' : 'OVER'}`);
}
process.exitCode = over ? 1 : 0;
