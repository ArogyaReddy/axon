#!/usr/bin/env node
/**
 * ar-review-post-write.js — PostToolUse hook (Write + Edit)
 *
 * Triggers immediately after Claude writes or edits any source file.
 * Performs a fast static scan (<200ms) on the just-written file.
 *
 * Checks (zero AI tokens):
 *   1. Empty catch blocks
 *   2. Unsafe casts (as any, as unknown as)
 *   3. User input in shell commands (potential injection)
 *   4. innerHTML with non-escaped content (potential XSS)
 *   5. Missing null checks on optional chaining that accesses .postMessage or .webview
 *   6. Hardcoded domain fallback 'hr' (should use effectiveDomain)
 *
 * If findings > 0: outputs a warning block that Claude reads inline.
 * If clean: silent (exit 0, no output).
 *
 * This is the FAST guard. /ar-review is the deep pass.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { scanFindings } = require("./lib/static-scan-rules.js");

// Read hook JSON from stdin
let hookData = {};
try {
  const raw = fs.readFileSync("/dev/stdin", "utf8");
  hookData = JSON.parse(raw);
} catch {
  process.exit(0);
}

const toolName = hookData.tool_name || "";
const toolInput = hookData.tool_input || {};

// Only run on Write + Edit
if (!["Write", "Edit"].includes(toolName)) process.exit(0);

const filePath = toolInput.file_path || "";
if (!filePath) process.exit(0);

// Only check TypeScript / JavaScript source files
if (!/\.(ts|tsx|js|mjs)$/.test(filePath)) process.exit(0);

// ── Behavioral scan for test/spec files ──────────────────────────────────
if (
  filePath.includes(".spec.") ||
  filePath.includes(".test.") ||
  filePath.includes("/test/")
) {
  let src = "";
  try {
    src = fs.readFileSync(filePath, "utf8");
  } catch {
    process.exit(0);
  }
  const specLines = src.split("\n");
  const rel = filePath.replace(process.env.HOME || "", "~");
  const testFindings = [];

  // B1: Must have at least one it() or test() block
  if (!/(^|\s)(it|test)\s*\(/.test(src)) {
    testFindings.push({
      severity: "HIGH",
      issue: "No `it()` or `test()` blocks found — this is not a real test",
      fix: "Add behavioral test blocks: it('should X when Y', () => { const result = myFn(input); expect(result).toBe(expected); })",
    });
  }

  // B2: All tests are skipped
  const itCount = (src.match(/(^|\s)(it|test)\s*\(/g) || []).length;
  const skipCount = (src.match(/(^|\s)(it|test)\.skip\s*\(/g) || []).length;
  if (itCount > 0 && skipCount === itCount) {
    testFindings.push({
      severity: "HIGH",
      issue: `All ${itCount} test(s) are .skip'd — no tests actually run`,
      fix: "Remove .skip. A skipped test proves nothing. If the feature is not ready, that is a blocker, not a workaround.",
    });
  }

  // B3: All assertions are structural/trivial (not behavioral)
  const assertCount = (src.match(/expect\s*\(.*\)\.(to|not)\./g) || []).length;
  const trivialCount = (
    src.match(/\.toBeDefined\(\)|\.toBeTruthy\(\)|\.toBe\(true\)/g) || []
  ).length;
  if (assertCount > 0 && trivialCount === assertCount) {
    testFindings.push({
      severity: "MEDIUM",
      issue: `All ${assertCount} assertion(s) are structural (toBeDefined/toBeTruthy/toBe(true)) — not behavioral`,
      fix: "Assert actual computed values: expect(result.employeeId).toBe('E001'), not just expect(result).toBeDefined()",
    });
  }

  // B4: No imports — test cannot be exercising real code
  const importLines = specLines.filter(
    (l) =>
      l.startsWith("import ") &&
      !l.includes("from 'jest'") &&
      !l.includes("from '@jest'"),
  );
  if (importLines.length === 0 && itCount > 0) {
    testFindings.push({
      severity: "MEDIUM",
      issue: "No imports detected — test may not be exercising any real code",
      fix: "Import and call the function/class under test to verify real behavior.",
    });
  }

  if (testFindings.length > 0) {
    const out = [
      "",
      `[AR-TEST-QUALITY] Behavioral scan: ${testFindings.length} issue(s) in ${rel}`,
      "",
    ];
    testFindings.forEach((f) => {
      out.push(`  [${f.severity}] ${f.issue}`);
      out.push(`    Fix: ${f.fix}`);
    });
    out.push("");
    out.push(
      "⚠️  Fake or structural tests let bugs through. Tests must assert real output values.",
    );
    process.stdout.write(out.join("\n"));
  }
  process.exit(0);
}

// Read the file
let src = "";
try {
  src = fs.readFileSync(filePath, "utf8");
} catch {
  process.exit(0);
}

const rel = filePath.replace(process.env.HOME || "", "~");

// ── Checks 1-6: shared static-scan rules (Gap 3, extracted 2026-07-23) ──────
// Same detection logic as ar-review-pre-write.js (PreToolUse hard-block) —
// this hook still reports ALL severities (including CRITICAL/HIGH) here as
// a post-write safety net, in case the pre-write hook's matcher didn't fire
// for this tool/surface.
const findings = scanFindings(src, filePath);

// ── Check 7: No tests run yet this session (test-state monitor) ─────────────
{
  const sessionId = hookData.session_id || "unknown";
  const stateFile = path.join(
    os.homedir(),
    ".claude",
    "session-env",
    `test-state-${sessionId}.json`,
  );
  let testState = null;
  try {
    testState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {}
  if (!testState || !testState.testsRan) {
    findings.push({
      severity: "WARNING",
      line: 0,
      code: rel.split("/").pop(),
      issue: "Source file changed — no tests run yet this session",
      fix: "Run: TEST_BUSINESS_DOMAIN=<domain> npx jest <path/to/spec.ts> --no-coverage",
    });
  }
}

// ── Output ───────────────────────────────────────────────────────────────────

const critical = findings.filter((f) => f.severity === "CRITICAL");
const high = findings.filter((f) => f.severity === "HIGH");
const medium = findings.filter((f) => f.severity === "MEDIUM");
const warning = findings.filter((f) => f.severity === "WARNING");

// Only emit output when findings exist — clean files are silent
if (findings.length === 0) process.exit(0);

const lines_out = [
  ``,
  `[AR-REVIEW] Static scan: ${findings.length} issue(s) in ${rel} — CRITICAL:${critical.length} HIGH:${high.length} MEDIUM:${medium.length} WARNING:${warning.length}`,
  "",
];

findings.forEach((f) => {
  if (f.severity === "WARNING") {
    lines_out.push(`  [${f.severity}] ${f.issue}`);
  } else {
    lines_out.push(`  [${f.severity}] Line ${f.line}: ${f.issue}`);
  }
  lines_out.push(`    Fix: ${f.fix}`);
});

if (critical.length > 0 || high.length > 0) {
  lines_out.push("");
  lines_out.push(
    `⛔ CRITICAL/HIGH found. Fix before continuing. Then run /ar-review.`,
  );
}

if (warning.length > 0 && critical.length === 0 && high.length === 0) {
  lines_out.push("");
  lines_out.push(
    `⚠️  Test monitor: no tests run yet this session. Run tests before claiming DONE_VERIFIED.`,
  );
}

process.stdout.write(lines_out.join("\n"));
process.exit(0);
