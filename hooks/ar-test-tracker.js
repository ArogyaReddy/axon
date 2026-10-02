#!/usr/bin/env node
/**
 * ar-test-tracker.js — PostToolUse hook (Bash | run_in_terminal)
 *
 * Fires after every terminal command.
 * When a jest/npm test command is detected, records the result to:
 *   ~/.claude/session-env/test-state-{sessionId}.json
 *
 * Consumed by:
 *   ar-review-post-write.js — warns when source file written with no tests run yet
 *   ar-review-on-stop.js    — blocks (alarm) if .ts changed + no tests run at Stop
 *
 * Tracks RED→GREEN TDD cycle:
 *   seenRed   = true when tests FAIL during this session
 *   seenGreen = true when tests PASS during this session
 *   redGreenTransition = true when RED was seen first, then GREEN — real TDD
 *
 * Zero AI. Zero cost. Pure file I/O.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ── Read hook payload ────────────────────────────────────────────────────────

let hookData = {};
try {
  const raw = fs.readFileSync("/dev/stdin", "utf8");
  hookData = JSON.parse(raw);
} catch {
  process.exit(0);
}

const toolName = hookData.tool_name || "";
if (!["Bash", "run_in_terminal"].includes(toolName)) process.exit(0);

const toolInput = hookData.tool_input || {};
const toolResult = hookData.tool_result || {};
const cmd = (toolInput.command || toolInput.cmd || "").trim();
if (!cmd) process.exit(0);

// ── Detect test commands ─────────────────────────────────────────────────────

// FIXED 2026-07-25 (BUG-GAP3-A): the original pattern matched "jest" anywhere
// in the command string, including inside grep arguments and shell comments.
// Real evidence: test-state-ee5369d1.json showed testsRan:true for
//   lastCmd: "grep -r \"test.*run|jest|npm test\" ~/.claude/hooks/*.js"
// This neutralised the Gap 3 hard-block (which only fires when testsRan:false).
//
// Fix: strip shell comments and quoted strings, then split on pipeline/chain
// operators (|, &&, ;) and match jest/npm/yarn ONLY as the command verb at
// the START of each segment — not as an argument to grep/echo/cat/etc.
const cleanCmd = cmd
  .replace(/#.*/g, "")         // strip shell comments
  .replace(/'[^']*'/g, "''")   // strip single-quoted strings
  .replace(/"[^"]*"/g, '""'); // strip double-quoted strings

// Matches a test runner as the first executable in a pipeline segment,
// optionally preceded by env-var assignments (e.g. TEST_BUSINESS_DOMAIN=hr).
// 2026-07-25: added node --test (Node.js built-in test runner used by
// ar-code-reviewer master-tools suite — was not recognised, causing the
// Stop hook to block every session that ran node --test instead of npx jest).
const TEST_SEGMENT_PATTERN =
  /^(?:[A-Z_][A-Z0-9_]*=[^\s]*\s+)*(?:npx\s+jest|npm\s+(?:run\s+)?test|jest(?:\s|$)|yarn\s+test|node\s+--test)/;

const isTestCmd = cleanCmd
  .split(/\s*[|;&]+\s*/)
  .some((seg) => TEST_SEGMENT_PATTERN.test(seg.trim()));

if (!isTestCmd) process.exit(0);

// ── Extract pass/fail counts from output (if available) ─────────────────────

const output = (
  toolResult.output ||
  toolResult.content ||
  toolResult.stdout ||
  ""
).toString();

let passed = null;
let failed = null;
let total = null;

// Jest: "Tests: 2 failed, 5 passed, 7 total" or "Tests: 5 passed, 5 total"
const jestMatch = output.match(
  /Tests:\s+(?:(\d+)\s+failed[,\s]+)?(\d+)\s+passed(?:[,\s]+(\d+)\s+total)?/i,
);
if (jestMatch) {
  failed = jestMatch[1] ? parseInt(jestMatch[1], 10) : 0;
  passed = jestMatch[2] ? parseInt(jestMatch[2], 10) : 0;
  total = jestMatch[3] ? parseInt(jestMatch[3], 10) : passed + failed;
}

// Mocha / tap: "5 passing" / "2 failing"
if (passed === null) {
  const pm = output.match(/(\d+)\s+passing/i);
  const fm = output.match(/(\d+)\s+failing/i);
  if (pm) passed = parseInt(pm[1], 10);
  if (fm) failed = parseInt(fm[1], 10);
  if (passed !== null || failed !== null) total = (passed || 0) + (failed || 0);
}

// Node built-in test runner (node --test) TAP output:
//   "# pass 148"  "# fail 0"  "# tests 148"
if (passed === null) {
  const npm = output.match(/^#\s+pass\s+(\d+)/m);
  const nfm = output.match(/^#\s+fail\s+(\d+)/m);
  const ntm = output.match(/^#\s+tests\s+(\d+)/m);
  if (npm) passed = parseInt(npm[1], 10);
  if (nfm) failed = parseInt(nfm[1], 10);
  if (ntm) total  = parseInt(ntm[1], 10);
  else if (passed !== null || failed !== null) total = (passed || 0) + (failed || 0);
}

// If output is empty (tool_result not populated), fall back to cmd exit code
const exitCode = toolResult.exit_code ?? toolResult.exitCode ?? null;
if (passed === null && failed === null && exitCode !== null) {
  if (exitCode === 0) {
    passed = -1;
    failed = 0;
  } // passed (unknown count)
  else {
    passed = 0;
    failed = -1;
  } // failed (unknown count)
}

const seenRed = failed !== null && failed !== 0;
const seenGreen = failed === 0 && passed !== null && passed !== 0;

// ── Write test state ─────────────────────────────────────────────────────────

const sessionId = hookData.session_id || "unknown";
const stateDir = path.join(os.homedir(), ".claude", "session-env");

try {
  fs.mkdirSync(stateDir, { recursive: true });

  const stateFile = path.join(stateDir, `test-state-${sessionId}.json`);

  let existing = {
    seenRed: false,
    seenGreen: false,
    redGreenTransition: false,
  };
  try {
    existing = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {}

  const state = {
    sessionId,
    testsRan: true,
    lastCmd: cmd.slice(0, 120),
    lastRan: new Date().toISOString(),
    passed,
    failed,
    total,
    // Track RED and GREEN states independently across all runs in this session
    seenRed: existing.seenRed || seenRed,
    seenGreen: existing.seenGreen || seenGreen,
    // redGreenTransition: RED was seen at some point, then GREEN after — real TDD
    redGreenTransition:
      existing.redGreenTransition || (existing.seenRed && seenGreen),
  };

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
} catch {
  // silent — tracker failure must never disrupt the session
}

process.exit(0);
