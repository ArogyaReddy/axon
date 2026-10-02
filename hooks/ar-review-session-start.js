#!/usr/bin/env node
/**
 * ar-review-session-start.js — SessionStart hook
 *
 * At the start of each session, checks if there are pending review markers
 * from the previous session (files written but not reviewed).
 * If found: emits a reminder so Claude knows to suggest /ar-review.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const markerDir = path.join(os.homedir(), ".claude", "ar-review-queue");

let pending = [];
try {
  if (fs.existsSync(markerDir)) {
    pending = fs
      .readdirSync(markerDir)
      .filter((f) => f.startsWith("pending-") && f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(markerDir, f), "utf8"));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
} catch {
  /* silent */
}

if (pending.length === 0) process.exit(0);

const latest = pending[0];
const age = Math.round(
  (Date.now() - new Date(latest.timestamp).getTime()) / 60000,
);
const fileCount = latest.changedFiles?.length || 0;

process.stdout.write(
  `[AR-REVIEW] ${pending.length} review(s) pending from last session ` +
    `(${fileCount} files changed, ${age}min ago). ` +
    `Run /ar-review to audit before proceeding.\n`,
);

// Delete all pending markers — reminder has been shown, files serve no further purpose.
// ar-review agent uses git diff directly and never reads these queue files.
try {
  const files = fs
    .readdirSync(markerDir)
    .filter((f) => f.startsWith("pending-") && f.endsWith(".json"));
  files.forEach((f) => {
    try {
      fs.unlinkSync(path.join(markerDir, f));
    } catch {}
  });
} catch {}

process.exit(0);
