#!/usr/bin/env node
/**
 * find-first-user-message.js — shared lib for ar-req-capture.js
 *
 * Reads the first real user message from a VS Code Copilot debug-logs main.jsonl,
 * given a session ID. Same source capture-sessions reads.
 *
 * `appSupportRoot` defaults to the real "~/Library/Application Support" dir but
 * can be overridden — used by tests to inject a fake root without touching
 * real VS Code data.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// FIXED 2026-07-22: was "Code - Insiders" only, silently missed every
// session under plain "Code" (the actual daily-use surface — confirmed via
// real session-env data: 0 req files captured 07-20/21/22 despite 36 sessions).
// See tests/find-first-user-message.test.js for the RED->GREEN proof.
const VS_CODE_VARIANTS = ["Code", "Code - Insiders"];

// FIXED 2026-08-02: was a single fixed 32KB readSync in both the VS Code and
// CLI paths below — silently missed the first user_message/user line whenever
// session-start telemetry (Agent/Instructions/Skill/Hook Discovery + Resolve
// Customizations events, logged per turn) pushed it further into the file.
// Confirmed on 2 real alerted sessions (req-capture-alerts.log): user_message
// at byte 62256 (ae790b7e-...) and byte 3,857,239 (e4678c2e-...) — both past
// the old 32768-byte cutoff. Now scans incrementally in chunks, stopping as
// soon as a match is found, up to MAX_SCAN_BYTES (~5x the worst real preamble
// seen) instead of trusting one fixed-size read. See
// tests/find-first-user-message-large-preamble.test.js for the RED->GREEN proof.
const MAX_SCAN_BYTES = 20 * 1024 * 1024;
const SCAN_CHUNK_SIZE = 262144;

/**
 * Scans a JSONL file sequentially in bounded chunks, parsing each complete
 * line and calling `extract(parsedLine)`. Returns the first truthy value
 * `extract` produces, or null if the file ends (or MAX_SCAN_BYTES is reached)
 * with no match. Malformed JSON lines are skipped, not fatal.
 */
function scanJsonlForFirstMatch(filePath, extract) {
  const fd = fs.openSync(filePath, "r");
  try {
    const chunkBuf = Buffer.alloc(SCAN_CHUNK_SIZE);
    let leftover = "";
    let position = 0;

    while (position < MAX_SCAN_BYTES) {
      const bytesRead = fs.readSync(fd, chunkBuf, 0, SCAN_CHUNK_SIZE, position);
      if (bytesRead === 0) break; // EOF
      position += bytesRead;

      const text = leftover + chunkBuf.toString("utf8", 0, bytesRead);
      const lines = text.split("\n");
      leftover = lines.pop() ?? ""; // last (possibly partial) line carries to next chunk

      for (const line of lines) {
        if (!line) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // malformed JSON line — skip
        }
        const result = extract(parsed);
        if (result) return result;
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  return null;
}

function findFirstUserMessage(
  sessionId,
  appSupportRoot = path.join(os.homedir(), "Library", "Application Support"),
  claudeProjectsRoot = path.join(os.homedir(), ".claude", "projects"),
) {
  try {
    for (const variant of VS_CODE_VARIANTS) {
      const appSupport = path.join(appSupportRoot, variant, "User", "workspaceStorage");
      if (!fs.existsSync(appSupport)) continue;

      for (const wsDir of fs.readdirSync(appSupport)) {
        const logDir = path.join(
          appSupport,
          wsDir,
          "GitHub.copilot-chat",
          "debug-logs",
          sessionId,
        );
        if (!fs.existsSync(logDir)) continue;

        const mainJsonl = path.join(logDir, "main.jsonl");
        if (!fs.existsSync(mainJsonl)) continue;

        // Scan incrementally (bounded by MAX_SCAN_BYTES) instead of trusting
        // one fixed-size read — see FIXED 2026-08-02 note above.
        const result = scanJsonlForFirstMatch(mainJsonl, (e) => {
          // Exact same pattern capture-sessions uses: type=user_message, attrs.content
          if (e.type !== "user_message") return null;
          const content = (e.attrs?.content || "").trim();
          // Skip terminal notification events
          if (
            content.length > 10 &&
            !(
              content.startsWith("[Terminal ") &&
              content.includes("notification:")
            )
          ) {
            return content.slice(0, 2000);
          }
          return null;
        });
        if (result) return result;
      }
    }
  } catch (_vsErr) { /* VS Code tree scan failed — fall through to CLI fallback */ }

  // FALLBACK 2026-07-22: Claude Code CLI sessions have no VS Code debug log
  // at all (confirmed: real CLI session had no match under either variant
  // above). CLI sessions DO write their own transcript at
  // ~/.claude/projects/<slug>/<sessionId>.jsonl. The <slug> encoding is NOT
  // a simple "/" -> "-" swap (e.g. "/Users/x/.claude" -> "-Users-x--claude" —
  // "." is also replaced), so rather than reconstruct that encoding, search
  // recursively for a file named exactly "<sessionId>.jsonl" — session IDs
  // are unique UUIDs, so this is safe regardless of the parent folder name.
  try {
    if (fs.existsSync(claudeProjectsRoot)) {
      const targetFile = `${sessionId}.jsonl`;
      for (const projectDir of fs.readdirSync(claudeProjectsRoot)) {
        const transcriptPath = path.join(claudeProjectsRoot, projectDir, targetFile);
        if (!fs.existsSync(transcriptPath)) continue;

        // Scan incrementally (bounded by MAX_SCAN_BYTES) instead of trusting
        // one fixed-size read — see FIXED 2026-08-02 note above.
        const result = scanJsonlForFirstMatch(transcriptPath, (e) => {
          if (e.type !== "user") return null;
          const raw = e.message?.content;
          let text = null;
          if (typeof raw === "string") {
            // Original CLI format: content is a plain string
            text = raw.trim();
          } else if (Array.isArray(raw)) {
            // FIXED 2026-07-25 (BUG-GAP1-A): VSCode extension format writes
            // content as an array — [{type:"image",...},{type:"text",text:"..."}].
            // typeof check returned false for every VSCode extension session.
            // Real evidence: ee5369d1-...jsonl first user message had
            // content:[{type:"image",...},{type:"text",text:"Please refer..."}].
            const textItem = raw.find((item) => item.type === "text" && typeof item.text === "string");
            if (textItem) text = textItem.text.trim();
          }
          if (text && text.length > 10) return text.slice(0, 2000);
          return null;
        });
        if (result) return result;
        break; // found the file (even if no usable line inside) — stop searching
      }
    }
  } catch { /* CLI transcript scan failed — falls through to return null below */ }

  return null;
}

module.exports = { findFirstUserMessage, VS_CODE_VARIANTS };
