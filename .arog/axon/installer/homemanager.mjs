// Detect files owned by home-manager. axon never writes those.
// home-manager links ~/.claude/settings.json into the nix store, and the store entry may itself link back out to a dotfiles
// repo ("out-of-store" symlink). So every hop of the symlink chain is checked, not only the final target.
import { realpathSync, existsSync, lstatSync, readlinkSync } from 'node:fs';
import path from 'node:path';

export const NIX_STORE = '/nix/store';

export function symlinkChain(file, maxHops = 40) {
  const chain = [file];
  let current = file;
  for (let i = 0; i < maxHops; i++) {
    let st;
    try { st = lstatSync(current); } catch { break; }
    if (!st.isSymbolicLink()) break;
    current = path.resolve(path.dirname(current), readlinkSync(current));
    chain.push(current);
  }
  return chain;
}

export function detectNixManaged(file, storePrefix = NIX_STORE) {
  if (!existsSync(file)) return { managed: false, realpath: null, chain: [file] };
  const stores = new Set([storePrefix]);
  try { stores.add(realpathSync(storePrefix)); } catch { /* prefix may not exist on this machine */ }
  const chain = symlinkChain(file);
  const inStore = p => [...stores].some(s => p === s || p.startsWith(s + '/'));
  const real = realpathSync(file);
  return { managed: chain.some(inStore) || inStore(real), realpath: real, chain };
}
