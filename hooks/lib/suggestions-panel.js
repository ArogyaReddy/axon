/**
 * suggestions-panel.js — AROG Dashboard "Suggestions" tab.
 *
 * Zero-AI, rule-based flags computed from data My Work already loads
 * (STATE-SNAPSHOT.json) -- no new API calls, no AI cost, same "always
 * re-read disk" convention as every other tab (Chapter 15, S1). Answers
 * "what should I look at" with plain, explainable rules, not a black box.
 *
 * Gap this closes: docs/plans/arog-vision-gaps-2026-08-02.plan.md, Option 1.
 */

const { escHtml } = require("./rollup-html.js");
const { loadMyWorkData } = require("./my-work-panel.js");

const STALE_PR_DAYS = 3; // PR open/awaiting-review this long or more gets flagged
const STALE_CC_DAYS = 14; // open Command Center priority/task not re-verified this long or more gets flagged

/**
 * @param {string|undefined} isoDate
 * @param {number} [now] - override for tests; defaults to the real current time
 * @returns {number|null} whole days elapsed, or null when isoDate is missing/invalid
 */
function daysSince(isoDate, now = Date.now()) {
  if (!isoDate) return null;
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now - then) / 86400000));
}

// Documented, verified non-bug exception (Chapter 11, S5): "Code Review: ..."
// tracking tickets are genuinely not tied to one PR.
function isTrackingTicket(title) {
  return /^code review:/i.test((title || "").trim());
}

function ticketsWithoutPr(tickets) {
  return tickets.filter((t) => !t.prStatus?.state && !isTrackingTicket(t.title));
}

function stalePrs(prs, now, days = STALE_PR_DAYS) {
  return prs
    .map((pr) => ({ ...pr, daysOpen: daysSince(pr.createdOn, now) }))
    .filter((pr) => pr.daysOpen !== null && pr.daysOpen >= days);
}

// Gap G4 (docs/plans/arog-vision-gaps-2026-08-02.plan.md): Command Center is
// 100% hand-written and has drifted stale twice already (Chapter 10, S4) with
// nothing prompting a re-check. This doesn't try to guess whether an item is
// ACTUALLY done (that needs judgment) -- it just makes the ABSENCE of a
// recent re-verification visible, same pattern as the PR-staleness rules above.
function isCommandCenterItemDue(item, now, days = STALE_CC_DAYS) {
  const elapsed = daysSince(item.lastVerified, now);
  return elapsed === null || elapsed >= days;
}

function staleCommandCenterItems(ccData, now) {
  const cc = ccData || {};
  const priorities = (cc.priorities || [])
    .filter((p) => p.status === "open" && isCommandCenterItemDue(p, now))
    .map((p) => ({ ...p, kind: "priority" }));
  const tasks = (cc.tasks || [])
    .filter((t) => t.status !== "done" && isCommandCenterItemDue(t, now))
    .map((t) => ({ ...t, kind: "task" }));
  return [...priorities, ...tasks];
}

/**
 * @param {object} myWorkData - shape from loadMyWorkData()
 * @param {number} [now] - override for tests; defaults to the real current time
 * @param {object} [ccData] - shape from loadCommandCenterData(); optional, defaults to none (backward compatible)
 * @returns {{noPrTickets: object[], staleOwnPrs: object[], staleReviewPrs: object[], staleCommandCenterItems: object[]}}
 */
function computeSuggestions(myWorkData, now = Date.now(), ccData) {
  const d = myWorkData || {};
  return {
    noPrTickets: ticketsWithoutPr(d.tickets || []),
    staleOwnPrs: stalePrs(d.prs || [], now),
    staleReviewPrs: stalePrs(d.reviewingPrs || [], now),
    staleCommandCenterItems: staleCommandCenterItems(ccData, now),
  };
}

/**
 * @param {string} [snapshotPath] - override for tests; defaults to the real file
 * @returns {object} same safe shape as loadMyWorkData() -- reused, not duplicated
 */
function loadSuggestionsData(snapshotPath) {
  return loadMyWorkData(snapshotPath);
}

function renderTicketFlag(t) {
  return `<li class="gap-list-item"><code>${escHtml(t.key || "")}</code> [${escHtml(t.status || "Unknown")}] — ${escHtml(t.title || "")} <span class="pr-status-chip open">no PR yet</span></li>`;
}

function renderPrFlag(pr, label) {
  const idText = `#${escHtml(String(pr.id ?? ""))}`;
  const idHtml = pr.url
    ? `<a href="${escHtml(pr.url)}" target="_blank" rel="noopener noreferrer">${idText}</a>`
    : idText;
  const daysLabel = `${pr.daysOpen} ${pr.daysOpen === 1 ? "day" : "days"} ${label}`;
  return `<li class="gap-list-item">${idHtml} — ${escHtml(pr.title || "")} <span class="pr-status-chip open">${escHtml(daysLabel)}</span></li>`;
}

function renderCcItemFlag(item) {
  const elapsed = daysSince(item.lastVerified, Date.now());
  const ageLabel = elapsed === null ? "never verified" : `last verified ${elapsed} ${elapsed === 1 ? "day" : "days"} ago`;
  const kindLabel = item.kind === "task" ? "Task" : "Priority";
  return `<li class="gap-list-item">[${escHtml(kindLabel)}] ${escHtml(item.title || "")} <span class="pr-status-chip open">${escHtml(ageLabel)}</span></li>`;
}

/**
 * @param {ReturnType<typeof computeSuggestions>} suggestions
 * @returns {string} inner panel HTML (no <html>/<head> wrapper -- the shell provides that)
 */
function renderSuggestionsPanel(suggestions) {
  const s = suggestions || {};
  const noPrTickets = s.noPrTickets || [];
  const staleOwnPrs = s.staleOwnPrs || [];
  const staleReviewPrs = s.staleReviewPrs || [];
  const staleCcItems = s.staleCommandCenterItems || [];
  const totalFlags = noPrTickets.length + staleOwnPrs.length + staleReviewPrs.length + staleCcItems.length;

  const noPrHtml = noPrTickets.length
    ? `<ul class="gap-list working">${noPrTickets.map(renderTicketFlag).join("")}</ul>`
    : `<div class="empty-state">Every ticket has a linked PR</div>`;

  const staleOwnHtml = staleOwnPrs.length
    ? `<ul class="gap-list working">${staleOwnPrs.map((pr) => renderPrFlag(pr, "open")).join("")}</ul>`
    : `<div class="empty-state">No stale open PRs</div>`;

  const staleReviewHtml = staleReviewPrs.length
    ? `<ul class="gap-list working">${staleReviewPrs.map((pr) => renderPrFlag(pr, "awaiting your review")).join("")}</ul>`
    : `<div class="empty-state">Nothing stale awaiting your review</div>`;

  const staleCcHtml = staleCcItems.length
    ? `<ul class="gap-list working">${staleCcItems.map(renderCcItemFlag).join("")}</ul>`
    : `<div class="empty-state">Nothing due for re-verification</div>`;

  return `<div class="panel-suggestions">
    <div class="note">Zero-AI, rule-based flags computed live from <code>STATE-SNAPSHOT.json</code> + <code>command-center.json</code> — no new API calls, no AI cost. ${totalFlags} flag${totalFlags === 1 ? "" : "s"} right now.</div>
    <div class="gap-col">
      <div class="gap-col-label">Tickets with no linked PR yet</div>
      ${noPrHtml}
    </div>
    <div class="gap-col">
      <div class="gap-col-label">Your open PRs, stale ${STALE_PR_DAYS}+ days</div>
      ${staleOwnHtml}
    </div>
    <div class="gap-col">
      <div class="gap-col-label">Awaiting your review, stale ${STALE_PR_DAYS}+ days</div>
      ${staleReviewHtml}
    </div>
    <div class="gap-col">
      <div class="gap-col-label">Command Center items due for re-verification (${STALE_CC_DAYS}+ days, or never)</div>
      ${staleCcHtml}
    </div>
  </div>`;
}

module.exports = {
  computeSuggestions,
  loadSuggestionsData,
  renderSuggestionsPanel,
  daysSince,
  staleCommandCenterItems,
  STALE_PR_DAYS,
  STALE_CC_DAYS,
};
