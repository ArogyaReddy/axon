// Shared by the ADP checkers: which files changed, and which business domains they touch.
// "Changed" = everything that differs from the merge base with the base branch (commits on this branch plus
// uncommitted and untracked files). Base: --base <ref>, else .axon/config.json "adp.base" (e.g. the PILOT branch),
// else HEAD (uncommitted work only). --all checks every tracked file instead.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim();
}

export function repoRoot(cwd = process.cwd()) {
  try { return git(cwd, 'rev-parse', '--show-toplevel'); } catch { throw new Error(`not inside a git repository: ${cwd}`); }
}

export function config(root) {
  const f = path.join(root, '.axon', 'config.json');
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; } catch { return {}; }
}

export function changedFiles(root, { base, all = false } = {}) {
  const lines = s => s.split('\n').filter(Boolean);
  if (all) return lines(git(root, 'ls-files'));
  const ref = base ?? config(root).adp?.base ?? 'HEAD';
  let from = 'HEAD';
  if (ref !== 'HEAD') {
    try { from = git(root, 'merge-base', 'HEAD', ref); } catch { throw new Error(`base "${ref}" not found; fetch it or pass --base <ref>`); }
  }
  const files = new Set([...lines(git(root, 'diff', '--name-only', from)), ...lines(git(root, 'ls-files', '--others', '--exclude-standard'))]);
  return [...files].filter(f => existsSync(path.join(root, f)));
}

// src/<domain>/... and tests/<domain>/...; shared is not a business domain.
export function domainsOf(files) {
  const d = new Set();
  for (const f of files) {
    const m = /^(?:src|tests)\/([^/]+)\//.exec(f);
    if (m && m[1] !== 'shared') d.add(m[1]);
  }
  return [...d].sort();
}

// Common CLI handling for the checkers: parse --base/--all, print findings as file:line rule message, exit 1 on any.
export function runChecker(name, check) {
  const argv = process.argv.slice(2);
  const opt = k => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  try {
    const root = repoRoot();
    const files = changedFiles(root, { base: opt('base'), all: argv.includes('--all') });
    const findings = check(root, files);
    for (const f of findings) console.log(`${f.file}:${f.line ?? 1} ${name} ${f.message}`);
    console.log(findings.length ? `${name}: ${findings.length} finding(s)` : `${name}: OK (${files.length} changed file(s) checked)`);
    process.exitCode = findings.length ? 1 : 0;
  } catch (e) {
    console.error(`${name}: ${e.message}`);
    process.exitCode = 2;
  }
}

export const lineOf = (text, index) => text.slice(0, index).split('\n').length;
