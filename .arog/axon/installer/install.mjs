// Install / uninstall axon's settings layer. Plugins are installed separately through the marketplace.
// Guarantees: dry run writes nothing; user values win except on axon-managed keys; a backup is taken before any write;
// the write is atomic; home-manager (nix store) files are never written; uninstall restores the original exactly.
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { mergeSettings, reverseChanges } from './merge.mjs';
import { detectNixManaged, NIX_STORE } from './homemanager.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const toText = obj => JSON.stringify(obj, null, 2) + '\n';

export function settingsPath(home) { return path.join(home, '.claude', 'settings.json'); }
function statePath(home) { return path.join(home, '.axon', 'state', 'installed.json'); }

function readJson(file, label) {
  const text = readFileSync(file, 'utf8');
  try { return { text, value: JSON.parse(text) }; }
  catch (e) { throw new Error(`${label} is not valid JSON (${file}): ${e.message}`); }
}

function substitute(value, vars) {
  if (typeof value === 'string') return value.replace(/\$\{(AXON_ROOT)\}/g, (_, k) => vars[k]);
  if (Array.isArray(value)) return value.map(v => substitute(v, vars));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]));
  return value;
}

export function buildOverlay(axonRoot, profile) {
  const dir = path.join(axonRoot, 'global', 'settings');
  const profiles = readdirSync(path.join(dir, 'profiles')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
  if (!profiles.includes(profile)) throw new Error(`Unknown profile "${profile}". Available: ${profiles.join(', ')}`);
  const base = readJson(path.join(dir, 'base.json'), 'base settings').value;
  delete base.$schema;
  const overlay = readJson(path.join(dir, 'profiles', `${profile}.json`), `profile ${profile}`).value;
  return substitute(applyProfile(base, overlay), { AXON_ROOT: axonRoot });
}

// A profile overrides base: objects recurse, lists union, scalars from the profile win.
function applyProfile(base, profile) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(profile)) {
    const b = out[k];
    if (b && v && typeof b === 'object' && typeof v === 'object' && !Array.isArray(b) && !Array.isArray(v)) out[k] = applyProfile(b, v);
    else if (Array.isArray(b) && Array.isArray(v)) out[k] = [...b, ...v.filter(x => !b.some(y => JSON.stringify(y) === JSON.stringify(x)))];
    else out[k] = structuredClone(v);
  }
  return out;
}

function simpleDiff(beforeText, afterText) {
  const a = beforeText.split('\n'), b = afterText.split('\n');
  const inA = new Set(a), inB = new Set(b);
  return [...a.filter(l => !inB.has(l)).map(l => `- ${l}`), ...b.filter(l => !inA.has(l)).map(l => `+ ${l}`)].join('\n');
}

// Writes through symlinks to the real file, so a symlinked settings file keeps its link.
function atomicWrite(file, text) {
  if (existsSync(file)) file = realpathSync(file);
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.axon-tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

// writeThrough: for a home-manager "out-of-store" link (the chain ends in a writable file outside the nix store, an
// edit-in-place dotfiles file), merge into that file; the links stay. Without it, home-manager files are never written.
export function install({ home, axonRoot, profile = 'personal', dryRun = false, writeThrough = false, nixStorePrefix = NIX_STORE, now = new Date() }) {
  const file = settingsPath(home);
  const overlay = buildOverlay(axonRoot, profile);
  const existed = existsSync(file);
  const current = existed ? readJson(file, 'Your settings file') : { text: '', value: {} };
  const { result, changes } = mergeSettings(current.value, overlay);
  const mergedJson = toText(result);

  const nix = detectNixManaged(file, nixStorePrefix);
  const inStore = nix.realpath && [nixStorePrefix, ...(existsSync(nixStorePrefix) ? [realpathSync(nixStorePrefix)] : [])]
    .some(s => nix.realpath === s || nix.realpath.startsWith(`${s}/`));
  if (nix.managed && !(writeThrough && !inStore)) {
    return { mode: 'home-manager', changes: changes.length, mergedJson, realpath: nix.realpath,
      note: writeThrough
        ? 'This settings file lives in the nix store, so --write-through cannot write it. Put mergedJson into your dotfiles source and run home-manager switch.'
        : `This settings file is managed by home-manager. Put mergedJson into ${nix.realpath ?? 'your dotfiles source'} (or rerun with --write-through when that file is an edit-in-place link) and run home-manager switch if needed.` };
  }
  if (dryRun) return { mode: 'dry-run', changes: changes.length, diff: simpleDiff(current.text, mergedJson) };
  if (changes.length === 0) return { mode: 'applied', changes: 0 };

  // Keep the state of the very first install, so uninstall can return to the true original.
  const prior = existsSync(statePath(home)) ? JSON.parse(readFileSync(statePath(home), 'utf8')) : null;
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(home, '.axon', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `settings-${stamp}.json`);
  if (existed) writeFileSync(backupFile, current.text);

  atomicWrite(file, mergedJson);
  const state = {
    version: 1,
    profile,
    installedAt: now.toISOString(),
    settingsFile: file,
    existedBefore: prior ? prior.existedBefore : existed,
    originalBackup: prior ? prior.originalBackup : (existed ? backupFile : null),
    changes: [...(prior?.changes ?? []), ...changes],
    writtenSha256: sha(mergedJson),
  };
  atomicWrite(statePath(home), toText(state));
  return { mode: 'applied', changes: changes.length, backup: existed ? backupFile : null };
}

export function uninstall({ home }) {
  const sp = statePath(home);
  if (!existsSync(sp)) return { mode: 'not-installed' };
  const state = JSON.parse(readFileSync(sp, 'utf8'));
  const file = state.settingsFile ?? settingsPath(home);
  const currentText = existsSync(file) ? readFileSync(file, 'utf8') : null;

  let mode;
  if (currentText !== null && sha(currentText) === state.writtenSha256) {
    // Untouched since install: restore the original bytes exactly.
    if (state.existedBefore) atomicWrite(file, readFileSync(state.originalBackup, 'utf8'));
    else rmSync(realpathSync(file));
    mode = 'restored-backup';
  } else if (currentText !== null) {
    // The user edited settings after install: remove only what axon added, keep their edits.
    const current = JSON.parse(currentText);
    atomicWrite(file, toText(reverseChanges(current, state.changes)));
    mode = 'reversed-changes';
  } else {
    mode = 'settings-missing';
  }
  rmSync(sp);
  return { mode };
}
