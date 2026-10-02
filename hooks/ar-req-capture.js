#!/usr/bin/env node
/**
 * ar-req-capture.js — PreToolUse hook (Write | Edit | create_file | replace_string_in_file)
 *
 * Fires on the FIRST file write in a session.
 * Reads the first real user message from VS Code Copilot's main.jsonl debug log.
 * Same log that capture-sessions reads — written in real-time, available immediately.
 * Runs extract-req.mjs to convert that message into a structured requirement.
 *
 * Writes:
 *   ~/.claude/session-env/{YYYYMMDD}/req-{YYYYMMDD}-{HHMMSS}-{sessionId}.json
 *
 * Zero AI. Zero cost. Runs once per session. <50ms total.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { findFirstUserMessage } = require("./lib/find-first-user-message.js");
const { hasReqFileForSession } = require("./lib/req-already-captured.js");

// ── Read hook payload ─────────────────────────────────────────────────────────

let hookData = {};
try {
  const raw = fs.readFileSync("/dev/stdin", "utf8");
  hookData = JSON.parse(raw);
} catch {
  process.exit(0);
}

const toolName = hookData.tool_name || "";
if (
  ![
    "Write",
    "Edit",
    "str_replace_based_edit",
    "create_file",
    "replace_string_in_file",
  ].includes(toolName)
) {
  process.exit(0);
}

const sessionId = hookData.session_id || "unknown";

// ── Only run ONCE per session ─────────────────────────────────────────────────

const now = new Date();
const dateDir =
  String(now.getFullYear()) +
  String(now.getMonth() + 1).padStart(2, "0") +
  String(now.getDate()).padStart(2, "0");
const stateDir = path.join(os.homedir(), ".claude", "session-env", dateDir);

// Only run ONCE per session — check specifically for an existing req-*.json.
// FIXED 2026-07-23: previously matched ANY file containing the session id
// (including stop-{sessionId}.json, written by ar-tracker-on-stop.js at every
// Stop event). A mid-conversation Stop event firing before the session's
// first file edit made that stop file exist first, so the old check wrongly
// treated the session as "already captured" and skipped real capture for the
// rest of the session — even though no req file was ever written.
if (hasReqFileForSession(stateDir, sessionId)) process.exit(0);

// ── Read first user message from main.jsonl (real-time, same source as capture-sessions) ──
// Logic lives in lib/find-first-user-message.js (checks both "Code" and
// "Code - Insiders" — see tests/find-first-user-message.test.js for the fix history).

const rawText = findFirstUserMessage(sessionId);

if (!rawText || rawText.length < 5) {
  process.exit(0);
}

// ── Run the extractor ─────────────────────────────────────────────────────────

try {
  fs.mkdirSync(stateDir, { recursive: true });

  const extractScript = path.join(
    os.homedir(),
    ".claude",
    "scripts",
    "extract-req.mjs",
  );

  execFileSync(
    process.execPath,
    [
      extractScript,
      "--session",
      sessionId,
      "--text",
      rawText,
      "--cwd",
      hookData.cwd || process.cwd(),
    ],
    { stdio: "pipe", timeout: 5000 },
  );
} catch {
  // silent — must never block the session
}

process.exit(0);
