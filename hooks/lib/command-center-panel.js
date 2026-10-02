/**
 * command-center-panel.js — AROG Dashboard "Command Center" tab.
 *
 * The seed of the "clone of me" tracking board: ranked priorities, a
 * 3-column task board (done / in-progress / pending), and a decisions
 * timeline. Live-read from docs/command-center.json on every request --
 * same "always re-read disk" convention as every other tab. No dashboard
 * (old or new) tracked this before; it's the answer to "what have I done,
 * what's next, why did I decide that."
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { escHtml } = require("./rollup-html.js");
const { parseInboxItems } = require("./command-center-inbox.js");

const DEFAULT_DATA_PATH = path.join(os.homedir(), ".claude", "docs", "command-center.json");
const DEFAULT_INBOX_PATH = path.join(os.homedir(), ".claude", "docs", "command-center-inbox.md");

const EMPTY_SHAPE = { generatedAt: null, priorities: [], tasks: [], decisions: [], inboxItems: [] };

/**
 * @param {string} [dataPath] - override for tests; defaults to the real file
 * @param {string} [inboxPath] - override for tests; defaults to the real inbox file
 * @returns {object} safe shape, never throws (missing/corrupt file -> empty shape)
 */
function loadCommandCenterData(dataPath = DEFAULT_DATA_PATH, inboxPath = DEFAULT_INBOX_PATH) {
  let inboxItems = [];
  try {
    inboxItems = parseInboxItems(fs.readFileSync(inboxPath, "utf8"));
  } catch {
    inboxItems = [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return {
      generatedAt: parsed.generatedAt ?? null,
      priorities: parsed.priorities ?? [],
      tasks: parsed.tasks ?? [],
      decisions: parsed.decisions ?? [],
      inboxItems,
    };
  } catch {
    return { ...EMPTY_SHAPE, inboxItems };
  }
}

const STATUS_LABEL = { done: "Done", "in-progress": "In Progress", pending: "Pending" };

function renderItemDetail(detail) {
  if (!detail) return "";
  const rows = [];
  if (detail.what) rows.push(`<div class="cc-detail-row"><strong>What:</strong> ${escHtml(detail.what)}</div>`);
  if (detail.why) rows.push(`<div class="cc-detail-row"><strong>Why:</strong> ${escHtml(detail.why)}</div>`);
  if (detail.where) rows.push(`<div class="cc-detail-row"><strong>Where:</strong> ${escHtml(detail.where)}</div>`);
  if (detail.whoDoesThis) rows.push(`<div class="cc-detail-row"><strong>Who does this:</strong> ${escHtml(detail.whoDoesThis)}</div>`);
  if (detail.howToClose) rows.push(`<div class="cc-detail-row"><strong>How to close it:</strong> ${escHtml(detail.howToClose)}</div>`);
  if (detail.resolvedNote) rows.push(`<div class="cc-detail-row cc-detail-resolved"><strong>Resolved:</strong> ${escHtml(detail.resolvedNote)}</div>`);
  return rows.length ? `<div class="cc-priority-detail">${rows.join("")}</div>` : "";
}

function renderPriorityRow(p) {
  const statusChip = p.status === "done" ? `<span class="cc-chip cc-chip-done">✅ Done</span>` : "";
  const summary = `<span class="cc-priority-rank">${escHtml(String(p.rank ?? ""))}</span><span class="cc-priority-title">${escHtml(p.title || "")}</span>${p.area ? `<span class="cc-chip">${escHtml(p.area)}</span>` : ""}${statusChip}`;
  const detailHtml = renderItemDetail(p.detail);
  if (!detailHtml) {
    return `<li class="cc-priority-item">${summary}</li>`;
  }
  return `<li class="cc-priority-item"><details><summary>${summary}</summary>${detailHtml}</details></li>`;
}

function renderTaskCard(t) {
  const noteHtml = t.note ? `<div class="cc-task-note">${escHtml(t.note)}</div>` : "";
  const detailHtml = renderItemDetail(t.detail);
  const detailsBlock = detailHtml ? `<details class="cc-task-details"><summary>Details</summary>${detailHtml}</details>` : "";
  return `<div class="cc-task-card">
    <div class="cc-task-title">${escHtml(t.title || "")}</div>
    <div class="cc-task-meta">${t.area ? `<span class="cc-chip">${escHtml(t.area)}</span>` : ""}${t.date ? `<span class="cc-task-date">${escHtml(t.date)}</span>` : ""}</div>
    ${noteHtml}
    ${detailsBlock}
  </div>`;
}

function renderTaskColumn(status, tasks) {
  const filtered = tasks.filter((t) => (t.status || "").toLowerCase() === status);
  const body = filtered.length
    ? filtered.map(renderTaskCard).join("")
    : `<div class="empty-state">No ${STATUS_LABEL[status].toLowerCase()} tasks</div>`;
  return `<div class="cc-column">
    <div class="cc-column-head cc-column-${status}">${STATUS_LABEL[status]} <span class="cc-column-count">${filtered.length}</span></div>
    <div class="cc-column-body">${body}</div>
  </div>`;
}

function renderDecisionRow(d) {
  return `<div class="cc-decision-row">
    <div class="cc-decision-date">${escHtml(d.date || "")}</div>
    <div class="cc-decision-body">
      <div class="cc-decision-title">${escHtml(d.title || "")}</div>
      <div class="cc-decision-rationale">${escHtml(d.rationale || "")}</div>
    </div>
  </div>`;
}

function renderInboxItem(item) {
  const kindChip = `<span class="cc-chip">${escHtml(item.kind || "")}</span>`;
  const areaChip = item.area ? `<span class="cc-chip">${escHtml(item.area)}</span>` : "";
  return `<li class="cc-inbox-item">${kindChip}${areaChip} ${escHtml(item.text || "")} <span class="cc-task-date">${escHtml(item.date || "")}</span></li>`;
}

function renderInboxForm(csrfToken) {
  return `<form method="POST" action="/command-center/inbox" class="cc-inbox-form">
    <input type="hidden" name="_csrf" value="${escHtml(csrfToken || "")}">
    <select name="kind">
      <option value="task">Task</option>
      <option value="priority">Priority</option>
    </select>
    <input type="text" name="area" placeholder="area (optional)" maxlength="30">
    <input type="text" name="text" placeholder="What do you want to track? (one line)" maxlength="300" required>
    <button type="submit">+ Add to Inbox</button>
  </form>`;
}

/**
 * @param {object} data - shape from loadCommandCenterData(), plus a runtime
 *   csrfToken merged in by rollup-server.js (not part of the loaded file data)
 * @returns {string} inner panel HTML
 */
function renderCommandCenterPanel(data) {
  const d = data || {};
  const priorities = (d.priorities || []).slice().sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const openPriorities = priorities.filter((p) => p.status !== "done");
  const donePriorities = priorities.filter((p) => p.status === "done");
  const tasks = d.tasks || [];
  const decisions = d.decisions || [];
  const pendingInboxItems = (d.inboxItems || []).filter((i) => !i.done);
  const nothingTracked = priorities.length === 0 && tasks.length === 0 && decisions.length === 0;

  const inboxItemsHtml = pendingInboxItems.length
    ? `<ul class="cc-priority-list">${pendingInboxItems.map(renderInboxItem).join("")}</ul>`
    : `<div class="empty-state">Nothing waiting in the inbox</div>`;

  const inboxSection = `<div class="section">
      <div class="section-title">📥 Inbox</div>
      <div class="note">Drop a one-line idea below, or hand-edit <code>command-center-inbox.md</code> directly — I'll research each one and promote it into the tracked lists above with full detail.</div>
      ${inboxItemsHtml}
      ${renderInboxForm(d.csrfToken)}
    </div>`;

  if (nothingTracked) {
    return `<div class="panel-command-center">
      <div class="empty-state">Nothing tracked yet — add priorities/tasks/decisions to <code>docs/command-center.json</code>.</div>
      ${inboxSection}
    </div>`;
  }

  const prioritiesHtml = openPriorities.length
    ? `<ul class="cc-priority-list">${openPriorities.map(renderPriorityRow).join("")}</ul>`
    : `<div class="empty-state">No priorities tracked</div>`;

  const resolvedPrioritiesHtml = donePriorities.length
    ? `<details class="cc-resolved-priorities"><summary>✅ Resolved Priorities (${donePriorities.length})</summary><ul class="cc-priority-list">${donePriorities.map(renderPriorityRow).join("")}</ul></details>`
    : "";

  const board = `<div class="cc-board">${["done", "in-progress", "pending"].map((s) => renderTaskColumn(s, tasks)).join("")}</div>`;

  const decisionsHtml = decisions.length
    ? `<div class="cc-decisions">${decisions.slice().reverse().map(renderDecisionRow).join("")}</div>`
    : `<div class="empty-state">No decisions logged</div>`;

  return `<div class="panel-command-center">
    <div class="note">Your priorities, task board, and decision log — live from <code>command-center.json</code>, re-read on every request.</div>
    <div class="section">
      <div class="section-title">Priorities</div>
      ${prioritiesHtml}
      ${resolvedPrioritiesHtml}
    </div>
    ${inboxSection}
    <div class="section">
      <div class="section-title">Task Board</div>
      ${board}
    </div>
    <div class="section">
      <div class="section-title">Decisions</div>
      ${decisionsHtml}
    </div>
  </div>`;
}

module.exports = { loadCommandCenterData, renderCommandCenterPanel, DEFAULT_DATA_PATH, DEFAULT_INBOX_PATH };
