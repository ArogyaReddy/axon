// Per-hook on/off switches. Any "off" wins: the AXON_DISABLE env list (this shell), ~/.axon/local.json (this machine),
// <repo>/.axon/config.json (this project). Values: "off" or false.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { axonHome, projectConfig } from './state.mjs';

const isOff = v => v === false || v === 'off';

export function localConfig() {
  const f = path.join(axonHome(), 'local.json');
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return {}; }
}

export function enabled(name, root) {
  if ((process.env.AXON_DISABLE ?? '').split(',').map(s => s.trim()).includes(name)) return false;
  if (isOff(localConfig().hooks?.[name])) return false;
  if (root && isOff(projectConfig(root).hooks?.[name])) return false;
  return true;
}
