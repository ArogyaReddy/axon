/**
 * rollup-aggregate.js — Gap 4: zero-AI historical rollup aggregation
 *
 * Reads the structured stop-*.json artifacts (Gap 5's status/branch/pushed/
 * test_state/changed_files fields, see hooks/ar-tracker-on-stop.js) and
 * aggregates them into daily rollups + recurring-file-churn detection.
 *
 * This is the analysis layer that was verified 100% missing — capture-sessions
 * and ar-session-log only capture/append raw per-session records, neither
 * does any rollup/monthly/trend aggregation (confirmed by grep before this
 * file was written).
 *
 * aggregateByDay(artifacts) -> { "YYYY-MM-DD": { total, verified, failed,
 *   open, passRate } } where passRate = verified / (verified + failed),
 *   or null when there are zero decided (verified+failed) sessions that day
 *   (never 0 or NaN for "no data" — null is the honest "can't compute" value).
 *
 * detectRecurringFiles(artifacts, threshold=3) -> [{file, sessionCount}]
 *   sorted by sessionCount desc, only files touched in >= threshold DISTINCT
 *   sessions (a file appearing twice in the same session's changed_files
 *   list still counts once for that session).
 *
 * loadStopArtifacts() -> real stop-*.json artifacts from disk, newest first.
 *   Corrupt/unreadable files are skipped, never thrown.
 *
 * Zero AI. Read-only against session-env/.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

function aggregateByDay(artifacts) {
  const byDay = {};
  for (const a of artifacts || []) {
    const day = a.date;
    if (!day) continue;
    if (!byDay[day]) {
      byDay[day] = { total: 0, verified: 0, failed: 0, open: 0 };
    }
    byDay[day].total += 1;
    if (a.status === "verified") byDay[day].verified += 1;
    else if (a.status === "failed") byDay[day].failed += 1;
    else byDay[day].open += 1;
  }
  for (const day of Object.keys(byDay)) {
    const d = byDay[day];
    const decided = d.verified + d.failed;
    d.passRate = decided > 0 ? d.verified / decided : null;
  }
  return byDay;
}

function detectRecurringFiles(artifacts, threshold = 3) {
  const fileToSessions = new Map();
  for (const a of artifacts || []) {
    const sessionKey = a.session_id || a.short_id || JSON.stringify(a);
    const files = new Set(a.changed_files || []); // dedupe within one session
    for (const f of files) {
      if (!fileToSessions.has(f)) fileToSessions.set(f, new Set());
      fileToSessions.get(f).add(sessionKey);
    }
  }
  const recurring = [];
  for (const [file, sessions] of fileToSessions.entries()) {
    if (sessions.size >= threshold) {
      recurring.push({ file, sessionCount: sessions.size });
    }
  }
  recurring.sort((a, b) => b.sessionCount - a.sessionCount);
  return recurring;
}

function loadStopArtifacts() {
  const base = path.join(os.homedir(), ".claude", "session-env");
  const artifacts = [];
  if (!fs.existsSync(base)) return artifacts;
  const dirs = fs.readdirSync(base).filter((d) => /^\d{8}$/.test(d));
  for (const dir of dirs) {
    const full = path.join(base, dir);
    let files = [];
    try {
      files = fs.readdirSync(full).filter((f) => f.startsWith("stop-"));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        artifacts.push(JSON.parse(fs.readFileSync(path.join(full, f), "utf8")));
      } catch {
        /* skip corrupt file */
      }
    }
  }
  return artifacts;
}

// Gap 4 #2: "what happened last month on branch X" acceptance criterion.
// Artifacts with a null/unknown branch (e.g. mined legacy .md sessions that
// predate branch tracking) are excluded when a specific branch is requested
// — never guessed as a match. Passing branch=null/undefined returns everything
// unchanged (no filter requested).
function filterByBranch(artifacts, branch) {
  if (!branch) return artifacts || [];
  return (artifacts || []).filter((a) => a.branch === branch);
}

// Gap 4 #4: merges real stop-*.json artifacts with mined legacy .md
// artifacts (see hooks/lib/mine-session-logs.js), deduping by session_id.
// Real stop artifacts always win on conflict — they have genuine
// status/branch/test_state; the legacy version's guessed-nothing "open"
// placeholder would otherwise silently overwrite real data.
function mergeArtifacts(stopArtifacts, legacyArtifacts) {
  const bySessionId = new Map();
  for (const a of legacyArtifacts || []) {
    if (a.session_id) bySessionId.set(a.session_id, a);
  }
  for (const a of stopArtifacts || []) {
    if (a.session_id) bySessionId.set(a.session_id, a); // real data overwrites legacy
  }
  return [...bySessionId.values()];
}

// Sessions tab default order: newest-first. mergeArtifacts() above returns
// plain Map insertion order, not a real chronological sort -- this is that
// sort. Prefers the full-precision `timestamp` (real stop-*.json artifacts)
// over the date-only `date` field (legacy mined .md sessions never have
// `timestamp`, see mine-session-logs.js); ISO 8601 strings compare correctly
// with plain string comparison, so no Date parsing is needed. An artifact
// with neither field sorts to the end rather than crashing or being guessed.
// Never mutates the input array.
function sortSessionsNewestFirst(artifacts) {
  return [...(artifacts || [])].sort((a, b) => {
    const aKey = a.timestamp || a.date || "";
    const bKey = b.timestamp || b.date || "";
    if (aKey === bKey) return 0;
    return aKey > bKey ? -1 : 1;
  });
}

module.exports = {
  aggregateByDay,
  detectRecurringFiles,
  loadStopArtifacts,
  filterByBranch,
  mergeArtifacts,
  sortSessionsNewestFirst,
};
