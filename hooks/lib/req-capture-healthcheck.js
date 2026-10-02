#!/usr/bin/env node
/**
 * req-capture-healthcheck.js — pure decision logic + Stop-time runner
 *
 * Fixes the Gap 1 "no self-check" problem: ar-req-capture.js fails silently
 * by design (must never block the session). That's correct for the hook
 * itself, but it means a real regression (like the 2026-07-19->22 hardcoded
 * "Code - Insiders" path bug) can go unnoticed for days. This module
 * flags exactly that situation: edits happened this session, but no req
 * file was ever captured for it.
 *
 * evaluateCaptureHealth() is pure and unit-tested in isolation
 * (tests/req-capture-healthcheck.test.js). The runner below wires it to
 * real session data and appends a visible alert line when triggered.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function evaluateCaptureHealth({ hadEdits, reqFileFound }) {
  const alert = Boolean(hadEdits) && !reqFileFound;
  return {
    alert,
    reason: alert
      ? "Session had file edits but no requirement was auto-captured — ar-req-capture.js may have silently failed again."
      : null,
  };
}

function runAtStop({ sessionId, hadEdits, reqFileFound }) {
  const result = evaluateCaptureHealth({ hadEdits, reqFileFound });
  if (!result.alert) return result;

  // Always append to log file (existing behaviour — permanent record)
  try {
    const logDir = path.join(os.homedir(), ".claude", "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, "req-capture-alerts.log");
    const line = `[${new Date().toISOString()}] ALERT session=${sessionId} — ${result.reason}\n`;
    fs.appendFileSync(logFile, line);
  } catch (_logErr) { /* never block the session over a logging failure */ }

  // FIXED 2026-07-25 (BUG-GAP1-B): also surface to Claude via stdout.
  // Previously the alert was ONLY written to req-capture-alerts.log — a file
  // Claude never reads. The alert fired 10 times on 2026-07-24 with zero
  // effect. Fix: emit a system-reminder block on stdout so Claude Code shows
  // it as a system message at Stop time — same pattern ar-review-on-stop.js
  // uses for its inline warnings.
  try {
    const msg =
      `[AR-REQ-CAPTURE ALERT] session=${sessionId.slice(0, 8)} — ` +
      `${result.reason} ` +
      `Check ~/.claude/logs/req-capture-alerts.log for history. ` +
      `If this repeats, run: node ~/.claude/hooks/ar-req-capture.js --debug`;
    process.stdout.write(msg + "\n");
  } catch (_stdoutErr) { /* never block the session */ }

  return result;
}

module.exports = { evaluateCaptureHealth, runAtStop };
