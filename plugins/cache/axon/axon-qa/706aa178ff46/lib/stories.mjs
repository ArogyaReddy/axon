// User story files (bowser format): a strict YAML subset, parsed without dependencies (ADR-0001).
//   stories:
//     - name: "Story name"
//       url: http://...
//       auth: <saved login state name, optional>
//       workflow: |
//         step
//         step
// Anything outside this subset is rejected with file:line, never guessed.
import { createHash } from 'node:crypto';

const REQUIRED = ['name', 'url', 'workflow'];

function scalar(raw, where) {
  const v = raw.trim();
  if (v.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)"\s*(#.*)?$/.exec(v);
    if (!m) throw new Error(`${where}: unterminated double-quoted value`);
    return m[1].replace(/\\(.)/g, '$1');
  }
  if (v.startsWith("'")) {
    const m = /^'((?:[^']|'')*)'\s*(#.*)?$/.exec(v);
    if (!m) throw new Error(`${where}: unterminated single-quoted value`);
    return m[1].replace(/''/g, "'");
  }
  if (/^[[{&*!>%@`]/.test(v)) throw new Error(`${where}: unsupported YAML value "${v}" (use a plain or quoted string)`);
  return v.replace(/\s+#.*$/, '');
}

export function parseStories(text, file = 'stories.yaml') {
  const lines = text.split('\n');
  const stories = [];
  let i = 0;
  const skip = () => { while (i < lines.length && (!lines[i].trim() || lines[i].trim().startsWith('#'))) i++; };
  skip();
  if (i >= lines.length || lines[i].trim() !== 'stories:') throw new Error(`${file}:${i + 1}: expected "stories:" as the first key`);
  i++;
  let story = null;
  let itemIndent = -1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const where = `${file}:${i + 1}`;
    const item = /^(\s*)- (\w+):(.*)$/.exec(line);
    const key = /^(\s*)(\w+):(.*)$/.exec(line);
    let k, v, indent;
    if (item) {
      story = { _line: i + 1 };
      stories.push(story);
      itemIndent = item[1].length;
      [k, v, indent] = [item[2], item[3], itemIndent + 2];
    } else if (key && story && key[1].length === itemIndent + 2) {
      [k, v, indent] = [key[2], key[3], key[1].length];
    } else {
      throw new Error(`${where}: unexpected line "${line.trim()}"`);
    }
    if (v.trim() === '|') {
      const block = [];
      let blockIndent = -1;
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const ind = next.length - next.trimStart().length;
        if (next.trim() && ind <= indent) break;
        i++;
        if (!next.trim()) { block.push(''); continue; }
        if (blockIndent < 0) blockIndent = ind;
        block.push(next.slice(Math.min(blockIndent, ind)));
      }
      story[k] = block.join('\n').replace(/\s+$/, '');
    } else {
      story[k] = scalar(v, where);
    }
  }
  return stories.map(s => {
    for (const r of REQUIRED) if (!s[r]) throw new Error(`${file}:${s._line}: story has no ${r}`);
    const { _line, ...rest } = s;
    return rest;
  });
}

export function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'story';
}

// What the replay depends on: if any of these change, the story is learned again.
export function storyHash(s) {
  return createHash('sha1').update(JSON.stringify([s.name, s.url, s.auth ?? null, s.workflow])).digest('hex').slice(0, 16);
}
