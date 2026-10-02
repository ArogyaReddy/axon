// Global rules install: one symlink ~/.claude/rules/axon -> <axon>/global/rules. Never edits CLAUDE.md, never clobbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readlinkSync, lstatSync, existsSync, symlinkSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { linkRules, unlinkRules } from '../installer/rules.mjs';

function env() {
  const home = mkdtempSync(path.join(tmpdir(), 'axon-rh-'));
  const axonRoot = mkdtempSync(path.join(tmpdir(), 'axon-root-'));
  mkdirSync(path.join(axonRoot, 'global', 'rules'), { recursive: true });
  writeFileSync(path.join(axonRoot, 'global', 'rules', 'axon.md'), '# rules\n');
  mkdirSync(path.join(home, '.claude'));
  return { home, axonRoot, link: path.join(home, '.claude', 'rules', 'axon') };
}

test('creates ~/.claude/rules and the link; uninstall removes both', () => {
  const e = env();
  assert.equal(linkRules(e).mode, 'linked');
  assert.equal(readlinkSync(e.link), path.join(e.axonRoot, 'global', 'rules'));
  assert.equal(linkRules(e).mode, 'present', 'idempotent');
  assert.equal(unlinkRules(e).mode, 'unlinked');
  assert.equal(existsSync(path.join(e.home, '.claude', 'rules')), false, 'the rules folder axon created is removed');
});

test('an existing rules folder with the user files is kept on uninstall', () => {
  const e = env();
  mkdirSync(path.join(e.home, '.claude', 'rules'));
  writeFileSync(path.join(e.home, '.claude', 'rules', 'mine.md'), 'x');
  linkRules(e);
  unlinkRules(e);
  assert.deepEqual(readdirSync(path.join(e.home, '.claude', 'rules')), ['mine.md']);
});

test('dry run writes nothing', () => {
  const e = env();
  assert.equal(linkRules({ ...e, dryRun: true }).mode, 'dry-run');
  assert.equal(existsSync(path.join(e.home, '.claude', 'rules')), false);
});

test('never clobbers something else at the link path', () => {
  const e = env();
  mkdirSync(e.link, { recursive: true });
  assert.throws(() => linkRules(e), /already exists/);
  const e2 = env();
  mkdirSync(path.join(e2.home, '.claude', 'rules'));
  symlinkSync('/elsewhere', e2.link);
  assert.throws(() => linkRules(e2), /already exists/);
});

test('uninstall leaves a link the user repointed', () => {
  const e = env();
  linkRules(e);
  rmSync(e.link);
  symlinkSync('/elsewhere', e.link);
  assert.equal(unlinkRules(e).mode, 'left-user-link');
  assert.ok(lstatSync(e.link).isSymbolicLink());
});

test('a nix-managed rules folder is never written; the instruction is returned instead', () => {
  const e = env();
  const store = mkdtempSync(path.join(tmpdir(), 'nix-store-'));
  mkdirSync(path.join(store, 'rules'));
  symlinkSync(path.join(store, 'rules'), path.join(e.home, '.claude', 'rules'));
  const r = linkRules({ ...e, nixStorePrefix: store });
  assert.equal(r.mode, 'home-manager');
  assert.match(r.note, /global\/rules/);
  assert.equal(existsSync(e.link), false);
});

test('without install state, uninstall does nothing', () => {
  assert.equal(unlinkRules(env()).mode, 'not-installed');
});
