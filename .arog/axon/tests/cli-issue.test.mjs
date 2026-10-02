// End to end: the real bin/axon binary, as a user or a skill would call it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AXON = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'axon');
const run = (dir, ...args) => spawnSync(process.execPath, [AXON, 'issue', ...args, '--dir', dir], { encoding: 'utf8' });

test('new > list > fix refused > fill > fix > show, through the CLI', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-cli-'));
  const n = run(dir, 'new', 'Login button misaligned', '--severity', 'medium', '--type', 'bug', '--found-in', 'test', '--files', 'src/a.ts,src/b.ts');
  assert.equal(n.status, 0, n.stderr);
  assert.match(n.stdout, /ISS-0001/);

  const l = run(dir, 'list');
  assert.match(l.stdout, /ISS-0001.*open.*medium.*Login button misaligned/);

  const refused = run(dir, 'fix', 'ISS-0001', '--verified-by', 'tests/ui.spec.ts');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Root cause/);

  const file = n.stdout.match(/(\/\S+\.md)/)[1];
  writeFileSync(file, readFileSync(file, 'utf8')
    .replace(/## Root cause\n\n_TODO_/, '## Root cause\n\nFlex gap missing.')
    .replace(/## Fix\n\n_TODO_/, '## Fix\n\nAdded gap in src/a.ts.'));
  const fixed = run(dir, 'fix', 'ISS-0001', '--verified-by', 'tests/ui.spec.ts: aligned', '--commit', 'abc123');
  assert.equal(fixed.status, 0, fixed.stderr);

  const s = run(dir, 'show', 'ISS-0001');
  assert.match(s.stdout, /status: fixed/);
  assert.match(s.stdout, /fix_commit: abc123/);
});

test('bad input exits 1 with a clear message', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axon-cli-'));
  const r = run(dir, 'new', 'X', '--severity', 'urgent', '--type', 'bug', '--found-in', 'test');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Invalid severity/);
});
