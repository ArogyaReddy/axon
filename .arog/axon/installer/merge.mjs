// Settings merge that never clobbers the user's values.
// Objects merge, lists union (order kept, duplicates removed), and for scalars the existing user value wins,
// except on keys axon owns (managed paths). Every change is recorded so it can be reversed exactly.

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const key = v => JSON.stringify(v);

export function isManagedPath(p) {
  const [a, b] = p;
  if (a === 'statusLine' || a === 'attribution') return true;
  if (a === 'extraKnownMarketplaces' && b === 'axon') return true;
  if (a === 'enabledPlugins' && typeof b === 'string' && /^axon-[a-z-]+@axon$/.test(b)) return true;
  return false;
}

function mergeInto(target, overlay, p, changes) {
  for (const [k, value] of Object.entries(overlay)) {
    const here = [...p, k];
    const has = Object.hasOwn(target, k);
    const current = target[k];

    if (isManagedPath(here)) {
      if (!has || key(current) !== key(value)) {
        changes.push({ path: here, kind: 'set', before: has ? structuredClone(current) : undefined, after: structuredClone(value) });
        target[k] = structuredClone(value);
      }
      continue;
    }
    if (!has) {
      if (isObject(value)) {
        target[k] = {};
        mergeInto(target[k], value, here, changes);
      } else {
        changes.push({ path: here, kind: 'set', before: undefined, after: structuredClone(value) });
        target[k] = structuredClone(value);
      }
      continue;
    }
    if (isObject(current) && isObject(value)) {
      mergeInto(current, value, here, changes);
    } else if (Array.isArray(current) && Array.isArray(value)) {
      const seen = new Set(current.map(key));
      const added = value.filter(v => !seen.has(key(v)) && seen.add(key(v)));
      if (added.length) {
        current.push(...structuredClone(added));
        changes.push({ path: here, kind: 'list-add', added: structuredClone(added) });
      }
    }
    // Different types or a user scalar: the user's value wins.
  }
}

export function mergeSettings(current, overlay) {
  const result = structuredClone(current ?? {});
  const changes = [];
  mergeInto(result, overlay, [], changes);
  return { result, changes };
}

function parentOf(obj, p) {
  let node = obj;
  for (const k of p.slice(0, -1)) {
    if (!isObject(node[k])) return null;
    node = node[k];
  }
  return node;
}

function pruneEmpty(obj, p) {
  for (let i = p.length - 1; i > 0; i--) {
    const parent = parentOf(obj, p.slice(0, i));
    const k = p[i - 1];
    if (parent && isObject(parent[k]) && Object.keys(parent[k]).length === 0) delete parent[k];
    else break;
  }
}

// Undo recorded changes on the current settings, keeping anything else the user changed later.
export function reverseChanges(current, changes) {
  const result = structuredClone(current);
  for (const c of [...changes].reverse()) {
    const parent = parentOf(result, c.path);
    if (!parent) continue;
    const k = c.path.at(-1);
    if (c.kind === 'list-add') {
      if (!Array.isArray(parent[k])) continue;
      const drop = new Set(c.added.map(key));
      parent[k] = parent[k].filter(v => !drop.has(key(v)));
      if (parent[k].length === 0) delete parent[k];
    } else if (c.before === undefined) {
      delete parent[k];
    } else {
      parent[k] = structuredClone(c.before);
    }
    pruneEmpty(result, c.path);
  }
  return result;
}
