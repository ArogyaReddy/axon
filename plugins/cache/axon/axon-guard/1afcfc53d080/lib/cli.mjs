// Shared helpers for the axon-guard command-line tools.
import { repoRoot } from './state.mjs';

export function option(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function rootOrExit(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  if (!root) throw new Error(`Not inside a git repository: ${cwd}`);
  return root;
}

export function main(fn) {
  try { process.exitCode = fn() ?? 0; }
  catch (e) { process.stderr.write(`${e.message}\n`); process.exitCode = 1; }
}
