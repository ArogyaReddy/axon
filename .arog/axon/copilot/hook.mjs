#!/usr/bin/env node
// Copilot hook adapter: node hook.mjs [--event E] [--matcher RE] <axon hook script>
// Reads a Copilot payload, applies the Claude matcher (Copilot ignores matchers), runs the unchanged axon hook script
// once per Claude-shaped payload, and prints one answer both Copilot harnesses read.
// Always exits 0 and prints only valid JSON: Copilot treats a failing PreToolUse hook as a deny (fail closed), while
// axon fails open (plan D14; permissions and the sandbox are the hard boundary).
import { spawnSync } from 'node:child_process';
import { normalize, merge, widen } from './map.mjs';

const argv = process.argv.slice(2);
const opt = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const event = opt('event');
const matcher = opt('matcher');
const [script, ...scriptArgs] = argv;

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const payloads = normalize(JSON.parse(raw), { event, cwd: process.cwd() })
    .filter(p => !matcher || !p.tool_name || new RegExp(`^(?:${matcher})$`).test(p.tool_name));
  const outputs = payloads.map(p => {
    const r = spawnSync(process.execPath, [script, ...scriptArgs], { input: JSON.stringify(p), encoding: 'utf8', env: { ...process.env, AXON_HOST: 'copilot' } });
    if (r.stderr) process.stderr.write(r.stderr);
    try { return r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { return null; }
  });
  const out = widen(merge(outputs), payloads[0]?.hook_event_name);
  if (out) process.stdout.write(JSON.stringify(out));
} catch (e) {
  process.stderr.write(`[axon] Copilot hook adapter error, allowing the action (fail open): ${e.message}\n`);
}
process.exitCode = 0;
