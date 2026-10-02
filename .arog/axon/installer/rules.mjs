// Install axon's global rules as user-level rules: one symlink ~/.claude/rules/axon -> <axon>/global/rules.
// User-level rules load in every project without an approval dialog (verified live on 2.1.197 with a canary).
// Your CLAUDE.md is never edited, a nix-managed rules folder is never written, and nothing at the link path is clobbered.
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, rmdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { detectNixManaged, NIX_STORE } from './homemanager.mjs';

const statePath = home => path.join(home, '.axon', 'state', 'rules.json');
const exists = p => { try { lstatSync(p); return true; } catch { return false; } };

export function linkRules({ home, axonRoot, dryRun = false, nixStorePrefix = NIX_STORE }) {
  const dir = path.join(home, '.claude', 'rules');
  const link = path.join(dir, 'axon');
  const target = path.join(axonRoot, 'global', 'rules');
  if (detectNixManaged(dir, nixStorePrefix).managed) {
    return { mode: 'home-manager', link, target,
      note: `~/.claude/rules is managed by home-manager. Add a link "rules/axon" -> ${target} in your dotfiles (for example home.file.".claude/rules/axon".source = config.lib.file.mkOutOfStoreSymlink "${target}";) and run home-manager switch.` };
  }
  if (exists(link)) {
    if (lstatSync(link).isSymbolicLink() && readlinkSync(link) === target) return { mode: 'present', link, target };
    throw new Error(`${link} already exists and is not axon's link to ${target}. Move it away, then install again.`);
  }
  if (dryRun) return { mode: 'dry-run', link, target, createsDir: !exists(dir) };
  const createdDir = !exists(dir);
  mkdirSync(dir, { recursive: true });
  symlinkSync(target, link);
  mkdirSync(path.dirname(statePath(home)), { recursive: true });
  writeFileSync(statePath(home), `${JSON.stringify({ link, target, createdDir }, null, 2)}\n`);
  return { mode: 'linked', link, target };
}

export function unlinkRules({ home }) {
  if (!existsSync(statePath(home))) return { mode: 'not-installed' };
  const { link, target, createdDir } = JSON.parse(readFileSync(statePath(home), 'utf8'));
  let mode = 'already-removed';
  if (exists(link)) {
    if (lstatSync(link).isSymbolicLink() && readlinkSync(link) === target) { rmSync(link); mode = 'unlinked'; }
    else mode = 'left-user-link';
  }
  const dir = path.dirname(link);
  if (createdDir && exists(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
  rmSync(statePath(home));
  return { mode };
}
