// axon dashboard: a local page over the axon-observe event log and axon-guard decisions. Binds 127.0.0.1 only.
// Usage: node server.mjs [--port N]   (default 47301; 0 picks a free port)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load, sessions } from '../lib/events.mjs';

const argv = process.argv.slice(2);
const port = Number(argv[argv.indexOf('--port') + 1] ?? 47301) || (argv.includes('--port') ? 0 : 47301);
const page = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
  if (url.pathname === '/api/events') {
    const all = load({ days: Math.min(14, Number(url.searchParams.get('days') ?? 2) || 2) });
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ sessions: sessions(all), events: all.slice(-5000) }));
  }
  res.writeHead(404).end('not found');
});
server.listen(port, '127.0.0.1', () => console.log(`axon dashboard: http://127.0.0.1:${server.address().port}`));
