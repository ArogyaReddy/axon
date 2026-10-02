#!/usr/bin/env node
/**
 * ar-activity-logger.js — PostToolUse hook (Write | Edit | Bash | run_in_terminal)
 *
 * Every file edit and every test run gets recorded to:
 *   ~/.claude/session-env/YYYYMMDD/active-{sessionId}.jsonl
 *
 * This is the raw event stream. Other tools (ar-done-check, ar-tracker-on-stop)
 * read this file instead of guessing what happened.
 *
 * Each line is one JSON event:
 *   { ts, type: "edit"|"test", file?, cmd?, passed?, failed?, exit_code? }
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

let hookData = {};
try {
  const raw = fs.readFileSync("/dev/stdin", "utf8");
  hookData = JSON.parse(raw);
} catch {
  process.exit(0);
}

const sessionId = hookData.session_id || "";
if (!sessionId) process.exit(0);

const toolName = hookData.tool_name || "";
const toolInput = hookData.tool_input || {};
const toolResult = hookData.tool_result || {};

// ── Routing ──────────────────────────────────────────────────────────────────
const isEdit = [
  "Write",
  "Edit",
  "create_file",
  "replace_string_in_file",
  "multi_replace_string_in_file",
].includes(toolName);
const isTest = ["Bash", "run_in_terminal"].includes(toolName);

if (!isEdit && !isTest) process.exit(0);

// ── Output path ──────────────────────────────────────────────────────────────
const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
const stateDir = path.join(os.homedir(), ".claude", "session-env", dateStr);
const logFile = path.join(stateDir, `active-${sessionId}.jsonl`);

try {
  fs.mkdirSync(stateDir, { recursive: true });
} catch {
  process.exit(0);
}

// ── Build event ───────────────────────────────────────────────────────────────
let event = { ts: now.toISOString(), session_id: sessionId };

if (isEdit) {
  const filePath = toolInput.file_path || toolInput.filePath || "";
  if (!filePath) process.exit(0);
  // Skip binary/generated files
  if (/\/(node_modules|dist|build|\.git|out)\//.test(filePath)) process.exit(0);
  event.type = "edit";
  event.file = filePath.replace(os.homedir(), "~");

  // ── Test event ────────────────────────────────────────────────────────────────
} else {
  const cmd = (toolInput.command || toolInput.cmd || "").trim();
  if (!cmd) process.exit(0);

  const TEST_PATTERN =
    /\b(?:npx\s+jest|npm\s+(?:run\s+)?test|jest[\s/]|yarn\s+test)\b/;
  if (!TEST_PATTERN.test(cmd)) process.exit(0);

  const output = (
    toolResult.output ||
    toolResult.content ||
    toolResult.stdout ||
    ""
  ).toString();

  let passed = null,
    failed = null;

  // Jest output: "Tests: 2 failed, 5 passed"
  const jestMatch = output.match(
    /Tests:\s+(?:(\d+)\s+failed[,\s]+)?(\d+)\s+passed/i,
  );
  if (jestMatch) {
    failed = jestMatch[1] ? parseInt(jestMatch[1], 10) : 0;
    passed = parseInt(jestMatch[2], 10);
  }
  // Mocha: "5 passing / 2 failing"
  if (passed === null) {
    const pm = output.match(/(\d+)\s+passing/i);
    const fm = output.match(/(\d+)\s+failing/i);
    if (pm) passed = parseInt(pm[1], 10);
    if (fm) failed = parseInt(fm[1], 10);
  }

  const exitCode =
    toolResult.exit_code ??
    (/PASS\b/.test(output) ? 0 : /FAIL\b/.test(output) ? 1 : null);

  event.type = "test";
  event.cmd = cmd.slice(0, 120);
  event.passed = passed;
  event.failed = failed ?? (exitCode === 0 ? 0 : exitCode === 1 ? 1 : null);
  event.exit_code = exitCode;
  event.success = event.failed === 0 || exitCode === 0;
}

// ── Append ────────────────────────────────────────────────────────────────────
try {
  fs.appendFileSync(logFile, JSON.stringify(event) + "\n");
} catch {
  /* never block Claude */
}

process.exit(0);
