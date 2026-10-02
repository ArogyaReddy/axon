/**
 * format-dated-filename.js — shared helper for req-*.json / stop-*.json filenames
 *
 * BUG FIXED 2026-07-23: stop-{sessionId}.json had ZERO time/date component in
 * the filename -- verified on real production data (session-env/20260723/):
 * alphabetical filename order had NO correlation with real creation order.
 * The day's oldest file (07:43:42) sorted LAST alphabetically; the newest
 * (22:01:13) sorted second-to-last. req-{HHMM}-{sessionId}.json had a time
 * prefix but no date, relying entirely on the parent folder name for the day.
 *
 * Fix: every generated filename now embeds a full sortable YYYYMMDD-HHMMSS
 * timestamp, so alphabetical/`find`/`ls` order always matches real
 * chronological order, even outside the dated parent folder.
 *
 * See tests/format-dated-filename.test.js.
 */

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

function formatDateDir(date = new Date()) {
  return (
    String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate())
  );
}

function formatTimeStr(date = new Date()) {
  return (
    pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds())
  );
}

/**
 * @param {string} prefix - e.g. "req" or "stop"
 * @param {string} sessionId - full session id
 * @param {Date} [date]
 * @returns {{dateDir: string, filename: string}}
 */
function buildDatedFilename(prefix, sessionId, date = new Date()) {
  const dateDir = formatDateDir(date);
  const timeStr = formatTimeStr(date);
  return {
    dateDir,
    filename: `${prefix}-${dateDir}-${timeStr}-${sessionId}.json`,
  };
}

module.exports = { formatDateDir, formatTimeStr, buildDatedFilename };
