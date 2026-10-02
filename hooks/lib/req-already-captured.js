/**
 * req-already-captured.js — shared lib for ar-req-capture.js
 *
 * Answers: "has this session already had its requirement captured today?"
 *
 * BUG FIXED 2026-07-23: the inline check this replaced matched ANY file in
 * the day's session-env/YYYYMMDD/ folder whose name contained the session's
 * 8-char id prefix -- not specifically a req-*.json file. ar-tracker-on-stop.js
 * writes a stop-{sessionId}.json file at every Stop event (including
 * mid-conversation Stop events that fire before the session ends). If a Stop
 * event fires BEFORE the first Write/Edit/create_file/replace_string_in_file
 * call in a session (a normal, common ordering), the stop-*.json file already
 * exists by the time ar-req-capture.js's PreToolUse hook runs -- and the old
 * check treated that as "already ran", permanently skipping real requirement
 * capture for the rest of that session. Confirmed on real data: session
 * f4625ed8 had a real create_file call (which matches the hook's tool_name
 * matcher) but zero req-*.json was produced -- only a stop-f4625ed8-*.json
 * from an earlier mid-session Stop event existed in session-env/20260723/.
 *
 * Fix: only match filenames that actually start with "req-".
 */

const fs = require("fs");
const path = require("path");

/**
 * @param {string} stateDir - the day's session-env/YYYYMMDD directory
 * @param {string} sessionId - full session id (only the first 8 chars are used)
 * @returns {boolean} true only if a req-*.json file for this session already exists
 */
function hasReqFileForSession(stateDir, sessionId) {
  if (!fs.existsSync(stateDir)) return false;
  const shortId = sessionId.slice(0, 8);
  return fs
    .readdirSync(stateDir)
    .some((f) => f.startsWith("req-") && f.includes(shortId));
}

module.exports = { hasReqFileForSession };
