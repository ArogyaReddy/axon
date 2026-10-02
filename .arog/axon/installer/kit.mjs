// Project kits: copy project-kits/<kit>/ into a repository. Files that already exist are never overwritten (listed as
// skipped); git-hooks/* go to .git/hooks/ (local, never committed) with the axon path filled in; README.md stays in axon.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function walk(dir, base = dir) {
  return readdirSync(dir).flatMap(n => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p, base) : [path.relative(base, p)];
  });
}

export function installKit({ axonRoot, repo, kit, dryRun = false }) {
  const src = path.join(axonRoot, 'project-kits', kit);
  if (!existsSync(src)) throw new Error(`unknown kit "${kit}"; available: ${readdirSync(path.join(axonRoot, 'project-kits')).join(', ')}`);
  if (!existsSync(path.join(repo, '.git'))) throw new Error(`not a git repository root: ${repo}`);
  const copied = [];
  const skipped = [];
  for (const rel of walk(src).filter(f => f !== 'README.md')) {
    const hook = rel.startsWith(`git-hooks${path.sep}`);
    const dest = hook ? path.join(repo, '.git', 'hooks', path.basename(rel)) : path.join(repo, rel);
    const shown = path.relative(repo, dest);
    if (existsSync(dest)) { skipped.push(shown); continue; }
    copied.push(shown);
    if (dryRun) continue;
    mkdirSync(path.dirname(dest), { recursive: true });
    if (hook) {
      writeFileSync(dest, readFileSync(path.join(src, rel), 'utf8').replaceAll('__AXON_ROOT__', axonRoot));
      chmodSync(dest, 0o755);
    } else copyFileSync(path.join(src, rel), dest);
  }
  return { copied, skipped };
}
