// Drives one browser session with playwright-cli and replays recorded steps with no model involved.
// A step is { step, cmd: [...] } (an action with a stable locator), { step, expect: "text" } (text on the page), or
// { step, expect_element: "<selector>" } (element present). After each step a screenshot; on the first failure the
// console is captured, the rest is SKIPPED, and the session is always closed by the caller.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { slug } from './stories.mjs';

export function pwRunner(bin, session, cwd) {
  return (args, { json = false } = {}) => new Promise(resolve => {
    const child = spawn(bin, [`-s=${session}`, ...(json ? ['--json'] : []), ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 60000);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', e => { clearTimeout(timer); resolve({ status: 127, stdout, stderr: e.message }); });
    child.on('close', status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
}

const errText = r => `${r.stdout}${r.stderr}`.replace(/^### Error\s*/m, '').trim().slice(0, 500);

async function runStep(pw, s) {
  if (s.cmd) {
    const r = await pw(s.cmd);
    return r.status === 0 ? null : errText(r);
  }
  if (s.expect) {
    const r = await pw(['find', s.expect], { json: true });
    let result = '';
    try { result = JSON.parse(r.stdout).result ?? ''; } catch { result = r.stdout; }
    return r.status === 0 && /^Found /.test(result) ? null : `expected text not on the page: "${s.expect}"`;
  }
  if (s.expect_element) {
    const r = await pw(['snapshot', s.expect_element]);
    return r.status === 0 ? null : `expected element not on the page: ${s.expect_element}`;
  }
  return `unknown step type: ${JSON.stringify(s)}`;
}

export async function replay(pw, steps, dir) {
  const results = [];
  let failed = false;
  for (const [i, s] of steps.entries()) {
    if (failed) { results.push({ step: s.step, status: 'SKIPPED' }); continue; }
    const error = await runStep(pw, s);
    const shot = `${String(i + 1).padStart(2, '0')}_${slug(s.step)}.png`;
    await pw(['screenshot', '--filename', path.join(dir, shot)]);
    results.push({ step: s.step, status: error ? 'FAIL' : 'PASS', screenshot: shot, ...(error ? { error } : {}) });
    if (error) {
      failed = true;
      const c = await pw(['console']);
      writeFileSync(path.join(dir, 'console.txt'), c.stdout || c.stderr || '');
    }
  }
  return { status: failed ? 'FAIL' : 'PASS', steps: results };
}

// Opens the session at the story URL (loading a saved login first when the story names one), runs fn, always closes.
export async function withSession(pw, story, { browser, headed, authFile }, fn) {
  try {
    const open = await pw(['open', story.url, `--browser=${browser}`, ...(headed ? ['--headed'] : [])]);
    if (open.status !== 0) return { status: 'FAIL', steps: [], error: `could not open ${story.url}: ${errText(open)}` };
    if (authFile) {
      const load = await pw(['state-load', authFile]);
      if (load.status !== 0) return { status: 'FAIL', steps: [], error: `could not load login state ${authFile}: ${errText(load)}` };
      await pw(['goto', story.url]);
    }
    return await fn();
  } finally {
    await pw(['close']);
  }
}
