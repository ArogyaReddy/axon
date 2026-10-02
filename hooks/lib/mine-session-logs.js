/**
 * mine-session-logs.js — Gap 4: mine the older docs/sessions/*.md archive
 *
 * session-env/'s structured stop-*.json artifacts only go back ~5-6 days
 * (since the hooks that write them were built this week). The older
 * docs/sessions/*.md archive goes back much further (verified: to
 * 2026-04-01) but is unstructured prose, not JSON. This module extracts
 * just what's reliably parseable from that markdown format (written by
 * bin/capture-sessions' render_claude_md()/render_copilot_md()): the
 * session_id, date, and changed files list.
 *
 * Deliberately honest about what's NOT recoverable from old logs: no
 * structured test/status data exists for them, so every mined artifact
 * gets status:"open", test_state:null, branch:null — NEVER guessed. Real
 * stop-*.json artifacts (which DO have real status/branch) always take
 * precedence when both exist for the same session (see bin/ar-rollup's
 * mergeArtifacts()).
 *
 * mineSessionLogs(sessionsDir) -> array of pseudo stop-artifacts, one per
 * parseable .md file. Files with no parseable Session ID are silently
 * skipped (not every .md in that folder is a session log format).
 */

const fs = require("fs");
const path = require("path");

const SESSION_ID_RE = /\|\s*\*\*Session ID\*\*\s*\|\s*`([^`]+)`\s*\|/;
const DATE_RE = /\|\s*\*\*Date\*\*\s*\|\s*(\d{4}-\d{2}-\d{2})/;
const FILES_SECTION_RE =
  /## Files Written \/ Edited\s*\n\n([\s\S]*?)(?:\n\n|\n## |\n---|\s*$)/;
const FILE_LINE_RE = /^-\s*`([^`]+)`\s*$/;

function parseSessionMd(content) {
  const idMatch = content.match(SESSION_ID_RE);
  if (!idMatch) return null;

  const dateMatch = content.match(DATE_RE);
  const changedFiles = [];
  const filesMatch = content.match(FILES_SECTION_RE);
  if (filesMatch) {
    for (const line of filesMatch[1].split("\n")) {
      const m = line.match(FILE_LINE_RE);
      if (m) changedFiles.push(m[1]);
    }
  }

  return {
    session_id: idMatch[1],
    date: dateMatch ? dateMatch[1] : null,
    changed_files: changedFiles,
    status: "open",
    test_state: null,
    branch: null,
    source: "legacy-md",
  };
}

function mineSessionLogs(sessionsDir) {
  const results = [];
  if (!fs.existsSync(sessionsDir)) return results;
  let files = [];
  try {
    files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
  } catch {
    return results;
  }
  for (const f of files) {
    let content;
    try {
      content = fs.readFileSync(path.join(sessionsDir, f), "utf8");
    } catch {
      continue;
    }
    const parsed = parseSessionMd(content);
    if (parsed && parsed.date) results.push(parsed);
  }
  return results;
}

// Sessions tab drawer: locate the real docs/sessions/*.md file for a given
// session -- filenames always end in `-{session_id[:8]}.md` (see
// bin/capture-sessions' render_claude_md/parse_copilot_session filename
// construction). Returns just the filename (not the full path), or null
// when there's no directory/no match -- never guessed, never throws.
function findSessionLogFile(sessionsDir, shortId) {
  if (!shortId || !fs.existsSync(sessionsDir)) return null;
  let files = [];
  try {
    files = fs.readdirSync(sessionsDir);
  } catch {
    return null;
  }
  return files.find((f) => f.endsWith(`-${shortId}.md`)) || null;
}

module.exports = { mineSessionLogs, findSessionLogFile };
