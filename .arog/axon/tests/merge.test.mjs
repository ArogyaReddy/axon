import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSettings, reverseChanges, isManagedPath } from '../installer/merge.mjs';

test('adds keys the user does not have and records them', () => {
  const { result, changes } = mergeSettings({}, { effortLevel: 'high', env: { A: '1' } });
  assert.deepEqual(result, { effortLevel: 'high', env: { A: '1' } });
  assert.deepEqual(changes.map(c => c.path), [['effortLevel'], ['env', 'A']]);
  assert.ok(changes.every(c => c.before === undefined));
});

test('existing user scalar wins over axon default', () => {
  const { result, changes } = mergeSettings({ effortLevel: 'medium' }, { effortLevel: 'high' });
  assert.equal(result.effortLevel, 'medium');
  assert.equal(changes.length, 0);
});

test('managed keys are owned by axon and overwrite the user value', () => {
  const user = { statusLine: { type: 'command', command: 'old' } };
  const { result, changes } = mergeSettings(user, { statusLine: { type: 'command', command: 'new' } });
  assert.equal(result.statusLine.command, 'new');
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].before, { type: 'command', command: 'old' });
});

test('managed path rules', () => {
  assert.ok(isManagedPath(['statusLine']));
  assert.ok(isManagedPath(['attribution']));
  assert.ok(isManagedPath(['extraKnownMarketplaces', 'axon']));
  assert.ok(isManagedPath(['enabledPlugins', 'axon-core@axon']));
  assert.ok(!isManagedPath(['enabledPlugins', 'other@market']));
  assert.ok(!isManagedPath(['effortLevel']));
});

test('lists are unioned, order kept, duplicates removed, added items recorded', () => {
  const user = { permissions: { allow: ['Bash(ls *)', 'Bash(git status)'] } };
  const { result, changes } = mergeSettings(user, { permissions: { allow: ['Bash(git status)', 'Bash(rg *)'] } });
  assert.deepEqual(result.permissions.allow, ['Bash(ls *)', 'Bash(git status)', 'Bash(rg *)']);
  assert.deepEqual(changes, [{ path: ['permissions', 'allow'], kind: 'list-add', added: ['Bash(rg *)'] }]);
});

test('user objects not mentioned by axon are untouched', () => {
  const user = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'x' }] }] } };
  const { result } = mergeSettings(user, { effortLevel: 'high' });
  assert.deepEqual(result.hooks, user.hooks);
});

test('merge is idempotent: second run reports no changes', () => {
  const overlay = { effortLevel: 'high', permissions: { allow: ['a', 'b'] }, statusLine: { command: 's' } };
  const first = mergeSettings({ permissions: { allow: ['z'] } }, overlay);
  const second = mergeSettings(first.result, overlay);
  assert.deepEqual(second.result, first.result);
  assert.equal(second.changes.length, 0);
});

test('reverseChanges restores the original semantically, keeping later user edits', () => {
  const original = { effortLevel: 'medium', permissions: { allow: ['z'] }, statusLine: { command: 'old' } };
  const overlay = { outputStyle: 'brief', permissions: { allow: ['a'] }, statusLine: { command: 'new' } };
  const { result, changes } = mergeSettings(original, overlay);
  result.userAddedLater = true; // the user edits settings after install
  const restored = reverseChanges(result, changes);
  assert.deepEqual(restored, { ...original, userAddedLater: true });
});

test('input objects are never mutated', () => {
  const user = { env: { A: '1' } };
  const overlay = { env: { B: '2' } };
  const u = structuredClone(user), o = structuredClone(overlay);
  mergeSettings(user, overlay);
  assert.deepEqual(user, u);
  assert.deepEqual(overlay, o);
});
