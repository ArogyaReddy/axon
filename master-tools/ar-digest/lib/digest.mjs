/**
 * digest.mjs — pure aggregation logic for ar-digest.
 *
 * Combines 3 already-written data sources into one work digest, filtered by
 * a time window (today/yesterday/week/month). Zero AI, zero new API calls --
 * every input here is a file some other zero-AI tool already wrote:
 *   - docs/sessions/sessions.jsonl   (written by capture-sessions / ar-session-log)
 *   - docs/command-center.json       (hand-written decisions log)
 *   - STATE-SNAPSHOT.json            (written by ar-morning-brief)
 *
 * Gap this closes: docs/plans/arog-vision-gaps-2026-08-02.plan.md, Option 2 (G2).
 */

const WINDOW_DAYS = { today: 0, yesterday: 1, week: 7, month: 30 };

/**
 * @param {string} [windowArg] - "today" | "yesterday" | "week" | "month"
 * @param {number} [now] - override for tests; defaults to the real current time
 * @returns {{cutoff: string, label: string}} cutoff = YYYY-MM-DD, inclusive floor
 */
function resolveWindow(windowArg, now = Date.now()) {
  const label = Object.prototype.hasOwnProperty.call(WINDOW_DAYS, windowArg) ? windowArg : "week";
  const cutoffDate = new Date(now - WINDOW_DAYS[label] * 86400000);
  return { cutoff: cutoffDate.toISOString().slice(0, 10), label };
}

/** @returns {boolean} whether dateStr (any ISO-ish string) falls on/after cutoff (YYYY-MM-DD) */
function isOnOrAfter(dateStr, cutoff) {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) >= cutoff;
}

// Documented, verified non-bug exception (Chapter 11, S5; mirrored from
// hooks/lib/suggestions-panel.js so the two tools never disagree on the
// same fact): "Code Review: ..." tracking tickets are genuinely not tied
// to one PR.
function isTrackingTicket(title) {
  return /^code review:/i.test((title || "").trim());
}

/**
 * @param {object[]} sessions - parsed sessions.jsonl rows
 * @param {string} cutoff - YYYY-MM-DD
 * @returns {object[]}
 */
function filterSessionsSince(sessions, cutoff) {
  return (sessions || []).filter((s) => isOnOrAfter(s.date, cutoff));
}

/**
 * @param {object[]} decisions - docs/command-center.json's decisions array
 * @param {string} cutoff - YYYY-MM-DD
 * @returns {object[]}
 */
function filterDecisionsSince(decisions, cutoff) {
  return (decisions || []).filter((d) => isOnOrAfter(d.date, cutoff));
}

/**
 * @param {object} data
 * @param {object[]} [data.sessions] - parsed sessions.jsonl rows
 * @param {object[]} [data.decisions] - docs/command-center.json's decisions array
 * @param {object} [data.myWorkData] - loadMyWorkData() shape (tickets/prs/mergedPrs)
 * @param {string} cutoff - YYYY-MM-DD
 * @param {string} windowLabel - "today" | "yesterday" | "week" | "month"
 * @returns {object} digest summary
 */
function buildDigest(data, cutoff, windowLabel) {
  const d = data || {};
  const mw = d.myWorkData || {};
  const recentSessions = filterSessionsSince(d.sessions, cutoff);
  const recentDecisions = filterDecisionsSince(d.decisions, cutoff);
  const mergedPrs = mw.mergedPrs || [];
  const recentMergedPrs = mergedPrs.filter((pr) => isOnOrAfter(pr.createdOn, cutoff));
  const filesTouched = recentSessions.reduce((sum, s) => sum + (s.files_written ?? s.files_changed ?? 0), 0);

  return {
    windowLabel,
    cutoff,
    sessionCount: recentSessions.length,
    filesTouched,
    decisions: recentDecisions,
    recentMergedPrCount: recentMergedPrs.length,
    ticketsInFlight: (mw.tickets || []).filter((t) => !t.prStatus?.state && !isTrackingTicket(t.title)).length,
    openPrCount: (mw.prs || []).length,
  };
}

/**
 * @param {ReturnType<typeof buildDigest>} digest
 * @returns {string} plain-text digest, safe to print to a terminal or paste into chat
 */
function formatDigestText(digest) {
  const d = digest;
  const lines = [];
  lines.push(`Digest — ${d.windowLabel} (since ${d.cutoff})`);
  lines.push(`Sessions: ${d.sessionCount}, files touched: ${d.filesTouched}`);
  lines.push(`PRs merged in window: ${d.recentMergedPrCount}, currently open PRs: ${d.openPrCount}`);
  lines.push(`Tickets still without a linked PR: ${d.ticketsInFlight}`);
  if (d.decisions.length) {
    lines.push(`Decisions logged:`);
    for (const dec of d.decisions) lines.push(`  - [${dec.date}] ${dec.title}`);
  } else {
    lines.push(`Decisions logged: none in this window`);
  }
  return lines.join("\n");
}

export { resolveWindow, isOnOrAfter, filterSessionsSince, filterDecisionsSince, buildDigest, formatDigestText, WINDOW_DAYS };
