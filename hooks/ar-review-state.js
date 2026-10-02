#!/usr/bin/env node
/**
 * ar-review-state.js — tracks files written this session pending ar-review
 * Used by: ar-review-post-write.js (addFile), ar-review.agent.md (clear)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const QUEUE_DIR = path.join(os.homedir(), ".claude", "ar-review-queue");
const SESSION_ID =
  process.env.CLAUDE_SESSION_ID || new Date().toISOString().slice(0, 10);

function ensureDir() {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

function addFile(filePath, sessionId) {
  ensureDir();
  const id = sessionId || SESSION_ID;
  const markerPath = path.join(QUEUE_DIR, `pending-${id}.json`);
  let data = {
    sessionId: id,
    timestamp: new Date().toISOString(),
    changedFiles: [],
  };
  try {
    data = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch {}
  if (!data.changedFiles.includes(filePath)) data.changedFiles.push(filePath);
  fs.writeFileSync(markerPath, JSON.stringify(data, null, 2));
}

function markReviewed(sessionId) {
  ensureDir();
  // Delete ALL pending files — the per-file ID lookup is unreliable because
  // ar-review-on-stop.js uses Date.now() timestamps while this module uses
  // a date-string fallback. Deleting all is safe: session-start already showed
  // the reminders before calling this.
  try {
    const files = fs
      .readdirSync(QUEUE_DIR)
      .filter((f) => f.startsWith("pending-") && f.endsWith(".json"));
    files.forEach((f) => {
      try {
        fs.unlinkSync(path.join(QUEUE_DIR, f));
      } catch (err) {
        process.stderr.write(
          `[ar-review-state] failed to delete ${f}: ${String(err)}\n`,
        );
      }
    });
  } catch (err) {
    process.stderr.write(
      `[ar-review-state] failed to read queue dir: ${String(err)}\n`,
    );
  }
}

// CLI: node ar-review-state.js clear
if (require.main === module && process.argv[2] === "clear") {
  markReviewed(process.argv[3] || SESSION_ID);
  process.exit(0);
}

module.exports = { addFile, markReviewed };
