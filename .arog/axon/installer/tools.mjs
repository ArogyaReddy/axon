// Pinned external tools from config/tools.json, installed per tool into ~/.axon/tools/<name> (never global npm).
// installTools only installs what is missing or drifted, so `axon install` runs it every time at no cost.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const pins = axonRoot => Object.entries(JSON.parse(readFileSync(path.join(axonRoot, 'config', 'tools.json'), 'utf8')))
  .filter(([k]) => k !== 'note');
const dirOf = (home, name) => path.join(home, '.axon', 'tools', name);

export function toolStatus({ home, axonRoot }) {
  return pins(axonRoot).map(([name, { package: pkg, version }]) => {
    let have = null;
    try { have = JSON.parse(readFileSync(path.join(dirOf(home, name), 'node_modules', ...pkg.split('/'), 'package.json'), 'utf8')).version; } catch { /* not installed */ }
    return { name, pkg, want: version, have };
  });
}

const npm = args => spawnSync('npm', args, { stdio: 'inherit' });

export function installTools({ home, axonRoot, run = npm }) {
  const installed = [];
  for (const t of toolStatus({ home, axonRoot }).filter(x => x.have !== x.want)) {
    mkdirSync(dirOf(home, t.name), { recursive: true });
    const r = run(['install', '--no-audit', '--no-fund', '--prefix', dirOf(home, t.name), `${t.pkg}@${t.want}`]);
    if (r.status !== 0) throw new Error(`installing ${t.pkg}@${t.want} failed`);
    installed.push(t.name);
  }
  return { installed };
}
