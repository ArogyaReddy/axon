// event-log (async): append one redacted line per Claude Code event to ~/.axon/events. Runs async, so it never delays
// a tool call; it prints nothing and never fails the event.
import { append, record } from '../lib/events.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try { append(record(JSON.parse(raw))); } catch { /* observability must never break a session */ }
