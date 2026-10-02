/**
 * monitor-panel.js — AROG Dashboard "Monitor" tab.
 *
 * Real usage analytics, mined live from two sources that already exist and
 * are written continuously by other parts of this framework (not a new
 * data source, not a build-time snapshot like the legacy dashboard's
 * Monitor tab):
 *   - docs/sessions/<name>.md   -- session exports (bin/capture-sessions).
 *     Header table gives project + date; "Topics Covered" numbered lists
 *     sometimes contain an explicit "/skill-name ..." line when the user
 *     typed a slash-command as a whole message -- cross-checked against
 *     the REAL current skill list (skills-panel.js) so a file path like
 *     "/Users/gadea/..." can never be miscounted as a command.
 *   - logs/tool-use.log         -- the pre-tool-use hook's own real,
 *     continuously-updated log: one line per gated tool call, with a
 *     timestamp and the tool name.
 * Honesty note: tool-use.log only covers tools the pre-tool-use hook
 * gates (Bash/run_in_terminal/Edit/Write/create_file confirmed in this
 * repo today) -- read-only tools like read_file/grep_search are not
 * logged there, so "Tool Call Frequency" undercounts total tool usage by
 * design, not by bug. Labelled as such in the rendered note.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { escHtml } = require("./rollup-html.js");
const { loadSkillsData } = require("./skills-panel.js");

const DEFAULT_SESSIONS_DIR = path.join(os.homedir(), ".claude", "docs", "sessions");
const DEFAULT_TOOL_LOG_PATH = path.join(os.homedir(), ".claude", "logs", "tool-use.log");

const PROJECT_FIELD_RE = /\|\s*\*\*(?:Project|Workspace)\*\*\s*\|\s*`([^`]+)`\s*\|/;
const DATE_FIELD_RE = /\|\s*\*\*Date\*\*\s*\|\s*(\d{4}-\d{2}-\d{2})/;
const TOPIC_COMMAND_RE = /^\d+\.\s+\/([\w-]+)/;
const LOG_LINE_RE = /^\[(\d{4}-\d{2}-\d{2}) [\d:]+\] PRE\s*\|\s*([a-zA-Z_]+)\s*\|/;

function normalizeProject(raw) {
  if (!raw) return null;
  const base = path.basename(raw.replace(/\/+$/, ""));
  return base || raw;
}

function bump(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function toSortedArray(map, keyName) {
  return Array.from(map.entries())
    .map(([k, count]) => ({ [keyName]: k, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * @param {object} [opts]
 * @param {string} [opts.sessionsDir] - override for tests
 * @param {string} [opts.toolLogPath] - override for tests
 * @param {string[]} [opts.skillNames] - override for tests; defaults to a live skills-panel scan
 * @returns {object} safe shape, never throws
 */
function loadMonitorData(opts = {}) {
  const sessionsDir = opts.sessionsDir || DEFAULT_SESSIONS_DIR;
  const toolLogPath = opts.toolLogPath || DEFAULT_TOOL_LOG_PATH;
  const skillNames = new Set(opts.skillNames || loadSkillsData().map((s) => s.name));

  const commandCounts = new Map();
  const projectCounts = new Map();
  let totalSessions = 0;

  if (fs.existsSync(sessionsDir)) {
    let files = [];
    try {
      files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
    } catch {
      files = [];
    }
    for (const f of files) {
      let content;
      try {
        content = fs.readFileSync(path.join(sessionsDir, f), "utf8");
      } catch {
        continue;
      }
      const projectMatch = content.match(PROJECT_FIELD_RE);
      const dateMatch = content.match(DATE_FIELD_RE);
      if (!dateMatch) continue; // not a parseable session export
      totalSessions++;
      bump(projectCounts, normalizeProject(projectMatch ? projectMatch[1] : null));
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(TOPIC_COMMAND_RE);
        if (m && skillNames.has(m[1])) bump(commandCounts, m[1]);
      }
    }
  }

  const toolCounts = new Map();
  const dailyCounts = new Map();
  let totalLogEntries = 0;

  if (fs.existsSync(toolLogPath)) {
    let content = "";
    try {
      content = fs.readFileSync(toolLogPath, "utf8");
    } catch {
      content = "";
    }
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(LOG_LINE_RE);
      if (!m) continue;
      totalLogEntries++;
      bump(dailyCounts, m[1]);
      bump(toolCounts, m[2]);
    }
  }

  return {
    totalSessions,
    totalLogEntries,
    uniqueCommands: commandCounts.size,
    uniqueProjects: projectCounts.size,
    topCommands: toSortedArray(commandCounts, "name").slice(0, 12),
    sessionsByProject: toSortedArray(projectCounts, "project"),
    toolCallFrequency: toSortedArray(toolCounts, "tool"),
    dailyActivity: Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

function renderKpiCard(value, label) {
  return `<div class="kpi-card"><div class="kpi-num">${escHtml(String(value))}</div><div class="kpi-lbl">${escHtml(label)}</div></div>`;
}

function renderRankedBar(label, count, maxCount) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return `<div class="rank-row">
    <span class="rank-label">${escHtml(label)}</span>
    <span class="rank-count">${escHtml(String(count))}</span>
    <div class="rank-bar"><div class="rank-bar-fill" style="width:${pct}%"></div></div>
  </div>`;
}

function renderDailyChart(daily) {
  if (!daily.length) return `<div class="empty-state">No activity data</div>`;
  const max = Math.max(...daily.map((d) => d.count), 1);
  const bars = daily
    .map((d) => {
      const h = Math.max(Math.round((d.count / max) * 100), 4);
      return `<div class="daily-bar" title="${escHtml(d.date)}: ${escHtml(String(d.count))} calls" style="height:${h}%"></div>`;
    })
    .join("");
  return `<div class="daily-chart">${bars}</div>
  <div class="daily-chart-labels"><span>${escHtml(daily[0].date)}</span><span>${escHtml(daily[daily.length - 1].date)}</span></div>`;
}

/**
 * @param {object} data - shape from loadMonitorData()
 * @returns {string} inner panel HTML
 */
function renderMonitorPanel(data) {
  const d = data || {};
  const noData = !d.totalSessions && !d.totalLogEntries;
  if (noData) {
    return `<div class="panel-monitor"><div class="empty-state">No usage data found yet in docs/sessions/ or logs/tool-use.log.</div></div>`;
  }

  const maxCmd = Math.max(...(d.topCommands || []).map((c) => c.count), 1);
  const maxProj = Math.max(...(d.sessionsByProject || []).map((p) => p.count), 1);
  const maxTool = Math.max(...(d.toolCallFrequency || []).map((t) => t.count), 1);

  const kpis = [
    renderKpiCard(d.totalSessions ?? 0, "Session Exports"),
    renderKpiCard(d.uniqueCommands ?? 0, "Unique Commands Used"),
    renderKpiCard(d.totalLogEntries ?? 0, "Logged Tool Calls"),
    renderKpiCard(d.uniqueProjects ?? 0, "Projects"),
  ].join("");

  const topCommandsHtml = (d.topCommands || []).length
    ? (d.topCommands || []).map((c) => renderRankedBar("/" + c.name, c.count, maxCmd)).join("")
    : `<div class="empty-state">No explicit /command invocations found</div>`;

  const projectsHtml = (d.sessionsByProject || []).length
    ? (d.sessionsByProject || []).map((p) => renderRankedBar(p.project, p.count, maxProj)).join("")
    : `<div class="empty-state">No project data found</div>`;

  const toolsHtml = (d.toolCallFrequency || []).length
    ? (d.toolCallFrequency || []).map((t) => renderRankedBar(t.tool, t.count, maxTool)).join("")
    : `<div class="empty-state">No tool-call log data found</div>`;

  return `<div class="panel-monitor">
    <div class="note">Usage analytics mined live from real session exports (<code>docs/sessions/</code>) and the pre-tool-use hook's own log (<code>logs/tool-use.log</code>) -- re-scanned on every request. Tool Call Frequency only covers gated tools (Bash/Edit/Write/etc.), not every read-only tool call.</div>
    <div class="kpi-grid">${kpis}</div>
    <div class="monitor-grid">
      <div class="section"><div class="section-title">Top Commands Used</div>${topCommandsHtml}</div>
      <div class="section"><div class="section-title">Sessions by Project</div>${projectsHtml}</div>
      <div class="section"><div class="section-title">Tool Call Frequency</div>${toolsHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">Daily Activity</div>
      ${renderDailyChart(d.dailyActivity || [])}
    </div>
  </div>`;
}

module.exports = { loadMonitorData, renderMonitorPanel };
