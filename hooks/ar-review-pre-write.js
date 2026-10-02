#!/usr/bin/env node
/**
 * ar-review-pre-write.js — PreToolUse hook (Gap 3 hard-block, 2026-07-23)
 *
 * Runs BEFORE a Write/Edit/create_file/replace_string_in_file/... executes.
 * Scans the PROPOSED content (from tool_input, not disk — the file may not
 * have this change yet) using the shared static-scan-rules lib. If any
 * CRITICAL or HIGH finding matches, the write is hard-blocked:
 *   - stderr: human-readable findings
 *   - process.exit(2) — Claude Code's documented PreToolUse block signal
 *
 * MEDIUM/WARNING findings do NOT block here — they remain informational,
 * reported (for ALL severities, unchanged) by ar-review-post-write.js after
 * the write completes. This hook only narrows CRITICAL/HIGH to "before the
 * write happens" instead of "after, as a warning Claude can ignore" — see
 * docs/plans/gap3-background-monitor-hard-gates.plan.md.
 *
 * Zero AI. Pure static regex scan, <200ms.
 */

const fs = require("fs");
const { scanFindings } = require("./lib/static-scan-rules.js");

/**
 * Extract the proposed new file content from a tool_input payload, based on
 * which tool is being called. Different tools (Claude Code vs. Copilot-chat
 * surfaces) use different field names for the same concept.
 */
function getProposedContent(toolName, toolInput) {
  switch (toolName) {
    case "Write":
    case "create_file":
      return toolInput.content ?? null;
    case "Edit":
      return toolInput.new_string ?? null;
    case "str_replace_based_edit":
      return toolInput.new_str ?? toolInput.new_string ?? null;
    case "replace_string_in_file":
      return toolInput.newString ?? null;
    case "multi_replace_string_in_file": {
      const replacements = toolInput.replacements || [];
      return replacements.map((r) => r.newString || "").join("\n");
    }
    default:
      return null;
  }
}

/**
 * Pure decision function: given the hook payload, returns the process exit
 * code (0 = allow, 2 = block) and the stderr text to print (empty if none).
 */
function evaluate(hookData) {
  const toolName = hookData.tool_name || "";
  const toolInput = hookData.tool_input || {};
  const filePath = toolInput.file_path || toolInput.filePath || "";

  if (!filePath || !/\.(ts|tsx|js|mjs)$/.test(filePath)) {
    return { exitCode: 0, stderr: "" };
  }

  const content = getProposedContent(toolName, toolInput);
  if (!content) {
    return { exitCode: 0, stderr: "" };
  }

  const findings = scanFindings(content, filePath);
  const blocking = findings.filter(
    (f) => f.severity === "CRITICAL" || f.severity === "HIGH",
  );

  if (blocking.length === 0) {
    return { exitCode: 0, stderr: "" };
  }

  const rel = filePath.replace(process.env.HOME || "", "~");
  const out = [
    `⛔ HARD BLOCK [AR-REVIEW-PRE-WRITE]: ${blocking.length} CRITICAL/HIGH finding(s) in ${rel}`,
    "",
  ];
  blocking.forEach((f) => {
    out.push(`  [${f.severity}] Line ${f.line}: ${f.issue}`);
    out.push(`    Fix: ${f.fix}`);
  });
  out.push("");
  out.push("Fix the issue(s) above before this write can proceed.");

  return { exitCode: 2, stderr: out.join("\n") + "\n" };
}

if (require.main === module) {
  let hookData = {};
  try {
    const raw = fs.readFileSync("/dev/stdin", "utf8");
    hookData = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const { exitCode, stderr } = evaluate(hookData);
  if (stderr) process.stderr.write(stderr);
  process.exit(exitCode);
}

module.exports = { evaluate, getProposedContent };
