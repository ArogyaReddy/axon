/**
 * my-work-panel.js — AROG Dashboard "My Work" tab.
 *
 * Sprint, tickets, PRs, and TODOs -- live-read from STATE-SNAPSHOT.json
 * (written by ar-morning-brief) on every request, same "always re-read
 * disk" convention as every other tab (gaps-panel.js, framework-panel.js).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { escHtml } = require("./rollup-html.js");

const DEFAULT_SNAPSHOT_PATH = path.join(os.homedir(), ".claude", "STATE-SNAPSHOT.json");

const EMPTY_SHAPE = {
  generatedAt: null,
  project: null,
  sprintName: null,
  sprintStats: null,
  tickets: [],
  prs: [],
  reviewingPrs: [],
  mergedPrs: [],
  declinedPrs: [],
  todos: { open: [], done: 0, total: 0 },
  tip: null,
  jiraBaseUrl: null,
  previousSprints: [],
};

/**
 * @param {string} [snapshotPath] - override for tests; defaults to the real file
 * @returns {object} safe shape, never throws (missing/corrupt file -> empty shape)
 */
function loadMyWorkData(snapshotPath = DEFAULT_SNAPSHOT_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    return {
      generatedAt: parsed.generatedAt ?? null,
      project: parsed.project ?? null,
      sprintName: parsed.sprintName ?? null,
      sprintStats: parsed.sprintStats ?? null,
      tickets: parsed.tickets ?? [],
      prs: parsed.prs ?? [],
      reviewingPrs: parsed.reviewingPrs ?? [],
      mergedPrs: parsed.mergedPrs ?? [],
      declinedPrs: parsed.declinedPrs ?? [],
      todos: parsed.todos ?? { open: [], done: 0, total: 0 },
      tip: parsed.tip ?? null,
      jiraBaseUrl: parsed.jiraBaseUrl ?? null,
      previousSprints: parsed.previousSprints ?? [],
    };
  } catch {
    return { ...EMPTY_SHAPE, todos: { ...EMPTY_SHAPE.todos } };
  }
}

const PR_STATUS_LABEL = { merged: "merged", open: "in review", declined: "declined" };

function renderPrStatusChip(prStatus) {
  if (!prStatus || !prStatus.state) return "";
  const label = PR_STATUS_LABEL[prStatus.state] || prStatus.state;
  const chip = `<span class="pr-status-chip ${escHtml(prStatus.state)}">${escHtml(label)}</span>`;
  return prStatus.url
    ? ` <a href="${escHtml(prStatus.url)}" target="_blank" rel="noopener noreferrer">${chip}</a>`
    : ` ${chip}`;
}

function renderTicketRow(t, jiraBaseUrl) {
  const key = t.key || "";
  const keyHtml = jiraBaseUrl
    ? `<a href="${escHtml(jiraBaseUrl)}/browse/${escHtml(key)}" target="_blank" rel="noopener noreferrer"><code>${escHtml(key)}</code></a>`
    : `<code>${escHtml(key)}</code>`;
  return `<li class="gap-list-item">${keyHtml} [${escHtml(t.status || "Unknown")}]${renderPrStatusChip(t.prStatus)} — ${escHtml(t.title || "")}</li>`;
}

function renderPrRow(pr) {
  const age = formatDateAndDaysAgo(pr.createdOn);
  const idText = `#${escHtml(String(pr.id ?? ""))}`;
  const idHtml = pr.url
    ? `<a href="${escHtml(pr.url)}" target="_blank" rel="noopener noreferrer">${idText}</a>`
    : idText;
  return `<li class="gap-list-item">${idHtml}${escHtml(age)} — ${escHtml(pr.title || "")}</li>`;
}

/**
 * @param {string|undefined} isoDate - PR creation date, ISO string
 * @param {number} [now] - override for tests; defaults to the real current time
 * @returns {string} " On YYYY-MM-DD [N days ago]" (or "[today]"/"[1 day ago]"),
 *   or "" when isoDate is missing/invalid -- never "Invalid Date" garbage
 */
function formatDateAndDaysAgo(isoDate, now = Date.now()) {
  if (!isoDate) return "";
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.max(0, Math.floor((now - then) / 86400000));
  const dateStr = new Date(isoDate).toISOString().slice(0, 10);
  const daysLabel = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  return ` On ${dateStr} [${daysLabel}]`;
}

function renderTodoRow(t) {
  return `<li>${escHtml(t)}</li>`;
}

function renderPreviousSprintSummary(totals) {
  const t = totals || { stories: 0, merged: 0, open: 0, declined: 0, noPr: 0 };
  const parts = [`${t.stories} ${t.stories === 1 ? "story" : "stories"}`];
  if (t.merged) parts.push(`${t.merged} merged`);
  if (t.open) parts.push(`${t.open} in review`);
  if (t.declined) parts.push(`${t.declined} declined`);
  return parts.join(", ");
}

function renderPreviousSprintBlock(sprint, jiraBaseUrl) {
  const tickets = sprint.tickets || [];
  const ticketsHtml = tickets.length
    ? `<ul class="gap-list working">${tickets.map((t) => renderTicketRow(t, jiraBaseUrl)).join("")}</ul>`
    : `<div class="empty-state">No stories in this sprint</div>`;
  return `<details class="prev-sprint"><summary>${escHtml(sprint.sprintName || "Unknown sprint")} — ${escHtml(renderPreviousSprintSummary(sprint.totals))}</summary>${ticketsHtml}</details>`;
}

/**
 * @param {object} data - shape from loadMyWorkData()
 * @returns {string} inner panel HTML (no <html>/<head> wrapper -- the shell provides that)
 */
function renderMyWorkPanel(data) {
  const d = data || {};
  const tickets = d.tickets || [];
  const prs = d.prs || [];
  const reviewingPrs = d.reviewingPrs || [];
  const mergedPrs = d.mergedPrs || [];
  const declinedPrs = d.declinedPrs || [];
  const todos = d.todos || { open: [], done: 0, total: 0 };
  const previousSprints = d.previousSprints || [];
  const jiraBaseUrl = d.jiraBaseUrl || null;

  const ticketsHtml = tickets.length
    ? `<ul class="gap-list working">${tickets.map((t) => renderTicketRow(t, jiraBaseUrl)).join("")}</ul>`
    : `<div class="empty-state">No tickets assigned</div>`;

  const prsHtml = prs.length
    ? `<ul class="gap-list working">${prs.map(renderPrRow).join("")}</ul>`
    : `<div class="empty-state">No open PRs</div>`;

  const reviewingPrsHtml = reviewingPrs.length
    ? `<ul class="gap-list working">${reviewingPrs.map(renderPrRow).join("")}</ul>`
    : `<div class="empty-state">Nothing awaiting your review</div>`;

  const mergedPrsHtml = mergedPrs.length
    ? `<ul class="gap-list working">${mergedPrs.map(renderPrRow).join("")}</ul>`
    : `<div class="empty-state">No recently merged PRs</div>`;

  const declinedPrsHtml = declinedPrs.length
    ? `<ul class="gap-list working">${declinedPrs.map(renderPrRow).join("")}</ul>`
    : `<div class="empty-state">No declined PRs</div>`;

  const todosHtml = (todos.open || []).length
    ? `<ul class="gap-list working">${todos.open.map(renderTodoRow).join("")}</ul>`
    : `<div class="empty-state">Nothing pending</div>`;

  const previousSprintsHtml = previousSprints.length
    ? previousSprints.map((s) => renderPreviousSprintBlock(s, jiraBaseUrl)).join("")
    : `<div class="empty-state">No previous sprint history yet</div>`;

  return `<div class="panel-my-work">
    <div class="note">Sprint: <strong>${escHtml(d.sprintName || "No active sprint")}</strong> — live from <code>STATE-SNAPSHOT.json</code>, re-read on every request.</div>
    <div class="section">
      <div class="section-title">Your Tickets</div>
      ${ticketsHtml}
    </div>
    <div class="section">
      <div class="section-title">Previous Sprints</div>
      ${previousSprintsHtml}
    </div>
    <div class="section">
      <div class="section-title">Open Pull Requests</div>
      ${prsHtml}
    </div>
    <div class="section">
      <div class="section-title">Pull Requests Awaiting Your Review</div>
      ${reviewingPrsHtml}
    </div>
    <div class="section">
      <div class="section-title">Recently Merged</div>
      ${mergedPrsHtml}
    </div>
    <div class="section">
      <div class="section-title">Recently Declined</div>
      ${declinedPrsHtml}
    </div>
    <div class="section">
      <div class="section-title">Open TODOs (${todos.done ?? 0} done)</div>
      ${todosHtml}
    </div>
  </div>`;
}

module.exports = { loadMyWorkData, renderMyWorkPanel, DEFAULT_SNAPSHOT_PATH };
