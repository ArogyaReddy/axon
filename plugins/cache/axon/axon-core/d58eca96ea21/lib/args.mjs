// Tiny argument parser shared by axon command-line tools: positionals, --flags and --option values.
export function parseArgs(argv) {
  const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const flag = name => argv.includes(`--${name}`);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !isFlagOnly(argv[i - 1])));
  const list = name => (option(name) ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return { option, flag, positional, list };
}

// Flags that never take a value, so the word after them is a positional argument.
const FLAG_ONLY = new Set(['--force', '--json', '--dry-run', '--md']);
function isFlagOnly(arg) { return FLAG_ONLY.has(arg); }
