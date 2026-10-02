// Output style A/B: the POC task (bug + feature, hidden tests) with the default style vs the lean style.
// Usage: node style-ab.mjs <default|lean> <runNumber>. Appends one JSON line to style-ab.jsonl.
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = path.dirname(new URL(import.meta.url).pathname);
const PLUGIN = path.resolve(BASE, '..', 'plugins', 'axon-learn');
const [variant, runNo] = process.argv.slice(2);
// Runs live outside ~/.claude: Claude Code treats files under ~/.claude as sensitive and blocks edits there (ISS-0031).
const DIR = path.join(process.env.AXON_AB_DIR || tmpdir(), `axon-style-${variant}-${runNo}`);
if (DIR.includes(`${path.sep}.claude${path.sep}`)) throw new Error(`run folder must be outside ~/.claude: ${DIR}`);
rmSync(DIR, { recursive: true, force: true });
cpSync(path.join(BASE, 'fixture'), DIR, { recursive: true });

const TASK = `Bug report from QA: invoices that use a discount code are overcharged on tax, and some tax amounts are one cent too low.
Expected: tax is charged on the subtotal AFTER the discount, and every computed cent amount (tax and percentage discounts) rounds half up to the nearest cent.
Feature request: add percentage discount codes SAVE10 (10% off) and SAVE25 (25% off). Discount codes must be case-insensitive.
Existing behaviour (fixed codes, unknown code throws "Unknown discount code") must stay.
Work test-first: add failing tests for the bug and the feature, then fix the code, then run the full test suite with \`node --test\` until everything passes.`;

const settings = variant === 'lean' ? '{"outputStyle":"axon-learn:lean"}' : '{}';
const t0 = Date.now();
const r = spawnSync('claude', ['-p', TASK, '--model', 'sonnet', '--output-format', 'json', '--setting-sources', 'project', '--strict-mcp-config',
  '--no-session-persistence', '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(node:*)', '--tools', 'Read,Edit,Write,Bash,Glob,Grep',
  '--settings', settings, '--plugin-dir', PLUGIN], { cwd: DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const d = JSON.parse(r.stdout);
const u = d.modelUsage['claude-sonnet-5'] ?? Object.values(d.modelUsage)[0];
const h = spawnSync('node', ['--test', path.join(BASE, 'hidden', 'hidden.test.cjs')], { encoding: 'utf8', env: { ...process.env, TARGET: DIR } });
const own = spawnSync('node', ['--test'], { cwd: DIR, encoding: 'utf8' });
const srcOf = d => readdirSync(path.join(d, 'src')).map(f => readFileSync(path.join(d, 'src', f), 'utf8')).join('\n');
const changed = srcOf(DIR) !== srcOf(path.join(BASE, 'fixture'));
const rec = {
  valid: changed && !d.is_error, denials: (d.permission_denials ?? []).length,
  variant, run: Number(runNo), cost: d.total_cost_usd, turns: d.num_turns, wall_s: Math.round((Date.now() - t0) / 1000),
  output: u.outputTokens, cache_write: u.cacheCreationInputTokens, cache_read: u.cacheReadInputTokens,
  hidden_pass: Number((h.stdout.match(/ℹ pass (\d+)/) || [])[1] || 0), own_tests: Number((own.stdout.match(/ℹ tests (\d+)/) || [])[1] || 0),
  own_fail: Number((own.stdout.match(/ℹ fail (\d+)/) || [])[1] || 0), reply_chars: d.result.length, em_dash: (d.result.match(/—/g) || []).length,
};
appendFileSync(path.join(BASE, 'style-ab.jsonl'), `${JSON.stringify(rec)}\n`);
console.log(JSON.stringify(rec));
