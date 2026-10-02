/**
 * gaps-panel.js — AROG Dashboard "Gaps" tab (home tab).
 *
 * Renders the 5 AROG observability gaps as cards, straight from the real
 * tracker.json this session's whole conversation was building/verifying.
 * The reference dashboard (FRAMEWORK-DASHBOARD.html) had nothing like this
 * at all -- it's a static skills/agents catalog with zero connection to
 * this framework's own health.
 */

const { escHtml } = require("./rollup-html.js");

function statusColor(pct) {
  if (pct >= 95) return "v"; // green
  if (pct >= 70) return "o"; // amber
  return "f"; // red
}

function renderGapCard(gap) {
  const pct = gap.completion_pct ?? 0;
  const colorClass = statusColor(pct);
  const working = (gap.working || [])
    .slice(0, 6)
    .map((w) => `<li>${escHtml(w)}</li>`)
    .join("");
  const notWorking = (gap.not_working || [])
    .map((w) => `<li>${escHtml(w)}</li>`)
    .join("");
  const sessions = gap.sessions || [];
  const lastSession = sessions.length ? sessions[sessions.length - 1] : null;
  const lastActivity = lastSession
    ? `<div class="gap-last"><span class="gap-last-date">${escHtml(lastSession.date || "")}</span> ${escHtml(lastSession.what_done || "")}</div>`
    : `<div class="gap-last empty">No session activity recorded yet</div>`;

  return `<div class="gap-card" data-gap-id="${escHtml(gap.id || "")}">
    <div class="gap-card-head">
      <span class="gap-title">${escHtml(gap.title || gap.id || "")}</span>
      <span class="gap-pct ${colorClass}">${pct}%</span>
    </div>
    <div class="gap-bar"><div class="gap-bar-fill ${colorClass}" style="width:${pct}%"></div></div>
    <div class="gap-cols">
      <div class="gap-col">
        <div class="gap-col-label">Working</div>
        <ul class="gap-list working">${working || "<li class=\"empty\">(none listed)</li>"}</ul>
      </div>
      <div class="gap-col">
        <div class="gap-col-label">Not working</div>
        <ul class="gap-list not-working">${notWorking || "<li class=\"empty\">Nothing open</li>"}</ul>
      </div>
    </div>
    ${lastActivity}
  </div>`;
}

/**
 * @param {object} trackerData - parsed tracker.json
 * @returns {string} inner panel HTML (no <html>/<head> wrapper -- the shell provides that)
 */
function renderGapsPanel(trackerData) {
  const requirements = (trackerData && trackerData.requirements) || [];
  const cards = requirements.map(renderGapCard).join("\n");
  const overallStatus = (trackerData && trackerData.meta && trackerData.meta.overall_status) || "unknown";

  return `<div class="panel-gaps">
    <div class="note">Overall status: <strong>${escHtml(overallStatus)}</strong> — live from <code>docs/real-gaps/tracker.json</code>, re-read on every request.</div>
    <div class="gap-grid">
      ${cards || '<div class="empty-state">No gap data found</div>'}
    </div>
  </div>`;
}

module.exports = { renderGapsPanel };
