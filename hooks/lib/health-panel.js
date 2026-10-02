/**
 * health-panel.js — AROG Dashboard "Health" tab.
 *
 * Live self-check: are the hooks this whole framework depends on actually
 * wired? Are the LaunchAgents actually loaded? Any recent capture failures?
 * The reference dashboard had zero live health checks -- this is new
 * capability, not a port of anything that existed before.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, execFileSync } = require("child_process");
const { escHtml } = require("./rollup-html.js");

const EXPECTED_HOOKS = [
  "pre-tool-use.sh",
  "ar-req-capture.js",
  "ar-review-pre-write.js",
  "ar-review-post-write.js",
  "ar-review-on-stop.js",
  "ar-tracker-on-stop.js",
];

// Only ar-checkgate gets a real out-of-process "responding" check (its own
// Unix socket protocol) -- it's a separate process/event loop, so pinging it
// from here is safe. rollup-server's check runs INSIDE the rollup-server
// process itself: a synchronous self-ping would deadlock (the event loop
// can't accept the incoming self-connection while blocked waiting on that
// same connection's response) -- confirmed by a real hang during testing.
// The fact this code is executing IS the proof rollup-server is responding,
// so it's marked "self" and never actually dials out. capture-sessions and
// pr-notify are scheduled/on-demand jobs with nothing to ping in between runs.
const EXPECTED_LAUNCH_AGENTS = [
  { label: "com.arog.capture-sessions" },
  { label: "com.arog.rollup-server", checkType: "self" },
  {
    label: "com.arog.ar-checkgate",
    checkType: "socket",
    target: path.join(os.homedir(), ".claude", "master-tools", "ar-checkgate", "ar-checkgate.sock"),
  },
  { label: "com.arog.pr-notify" },
];

const SOCKET_PING_SCRIPT = `
const net = require("net");
const sock = net.connect(process.argv[1]);
sock.setTimeout(1500);
sock.on("connect", () => sock.write(JSON.stringify({ cmd: "ping" }) + "\\n"));
sock.on("data", () => { console.log("PONG"); sock.end(); process.exit(0); });
sock.on("timeout", () => process.exit(1));
sock.on("error", () => process.exit(1));
`;

function pingSocket(socketPath) {
  if (!fs.existsSync(socketPath)) return false;
  try {
    const out = execFileSync("node", ["-e", SOCKET_PING_SCRIPT, socketPath], {
      encoding: "utf8",
      timeout: 2500,
    });
    return out.includes("PONG");
  } catch {
    return false;
  }
}

/**
 * Live checks -- real data, re-read on every request.
 */
function loadHealthData() {
  const base = path.join(os.homedir(), ".claude");

  let settingsRaw = "";
  try {
    settingsRaw = fs.readFileSync(path.join(base, "settings.json"), "utf8");
  } catch {
    /* leave empty -- all hooks will report not-wired */
  }
  const hooks = EXPECTED_HOOKS.map((name) => ({
    name,
    wired: settingsRaw.includes(name),
  }));

  let loadedLabels = new Set();
  try {
    const out = execSync("launchctl list 2>/dev/null | grep arog || true", {
      encoding: "utf8",
    });
    loadedLabels = new Set(
      out
        .split("\n")
        .map((l) => l.trim().split(/\s+/).pop())
        .filter(Boolean),
    );
  } catch {
    /* launchctl unavailable -- all agents report not-loaded */
  }
  const launchAgents = EXPECTED_LAUNCH_AGENTS.map((agent) => {
    const loaded = loadedLabels.has(agent.label);
    let responding = null; // null = no live check applicable (scheduled/on-demand job)
    if (loaded && agent.checkType === "self") responding = true;
    else if (loaded && agent.checkType === "socket") responding = pingSocket(agent.target);
    return { label: agent.label, loaded, responding };
  });

  let alertLines = [];
  try {
    const alertsPath = path.join(base, "logs", "req-capture-alerts.log");
    if (fs.existsSync(alertsPath)) {
      alertLines = fs
        .readFileSync(alertsPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .slice(-20);
    }
  } catch {
    /* leave empty */
  }

  let analyzerReport = null;
  try {
    const reportPath = path.join(base, "docs", "framework-health", "analyzer-report.json");
    if (fs.existsSync(reportPath)) {
      analyzerReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    }
  } catch {
    /* malformed/missing report -- treat exactly like "not run yet", never crash the tab */
    analyzerReport = null;
  }

  return { hooks, launchAgents, alertLines, analyzerReport };
}

function renderHookRow(h) {
  const cls = h.wired ? "v" : "bad";
  const label = h.wired ? "WIRED" : "NOT WIRED";
  return `<tr data-searchable><td>${escHtml(h.name)}</td><td class="${cls}">${label}</td></tr>`;
}

function renderLaunchAgentRow(a) {
  if (!a.loaded) {
    return `<tr data-searchable><td>${escHtml(a.label)}</td><td class="o">NOT LOADED</td></tr>`;
  }
  if (a.responding === null || a.responding === undefined) {
    return `<tr data-searchable><td>${escHtml(a.label)}</td><td class="v">LOADED</td></tr>`;
  }
  const cls = a.responding ? "v" : "bad";
  const label = a.responding ? "RESPONDING" : "LOADED, NOT RESPONDING";
  return `<tr data-searchable><td>${escHtml(a.label)}</td><td class="${cls}">${label}</td></tr>`;
}

// Alert lines start with "[<ISO-8601 timestamp>] ALERT ...". ISO-8601 strings
// sort correctly with plain string comparison, so no Date parsing is needed.
// Lines with no parseable timestamp (legacy/malformed) fall back to "" which
// always sorts after any real timestamp in sortAlertsDesc below.
function parseAlertTimestamp(line) {
  const m = /^\[([^\]]+)\]/.exec(line);
  return m ? m[1] : "";
}

// FIXED 2026-08-02: alert lines were rendered in whatever order the caller
// passed them in (the log file's own append order -- oldest first), so the
// most recent alert always rendered at the BOTTOM. Sorting here, inside the
// pure/tested render function, makes newest-first the guaranteed default
// regardless of what order the data layer supplies.
function sortAlertsDesc(lines) {
  return [...lines].sort((a, b) => parseAlertTimestamp(b).localeCompare(parseAlertTimestamp(a)));
}

function renderAlertLine(line) {
  const ts = parseAlertTimestamp(line);
  const date = ts.slice(0, 10);
  const month = ts.slice(0, 7);
  return `<div class="alert-line" data-ts="${escHtml(ts)}" data-date="${escHtml(date)}" data-month="${escHtml(month)}">${escHtml(line)}</div>`;
}

// Builds the "Filter" dropdown's date/month options from the already
// newest-first-sorted lines, so the options themselves list newest first too.
function renderAlertToolbar(sortedLines) {
  const dates = [];
  const months = [];
  for (const line of sortedLines) {
    const ts = parseAlertTimestamp(line);
    if (!ts) continue;
    const date = ts.slice(0, 10);
    const month = ts.slice(0, 7);
    if (!dates.includes(date)) dates.push(date);
    if (!months.includes(month)) months.push(month);
  }
  const dateOptions = dates.map((d) => `<option value="date:${d}">${escHtml(d)}</option>`).join("\n");
  const monthOptions = months.map((m) => `<option value="month:${m}">${escHtml(m)}</option>`).join("\n");

  return `<div class="alert-toolbar">
    <label>Sort
      <select id="alert-sort" onchange="sortAlertLines()">
        <option value="desc" selected>Newest first</option>
        <option value="asc">Oldest first</option>
      </select>
    </label>
    <label>Filter
      <select id="alert-filter" onchange="filterAlertLines()">
        <option value="all" selected>All</option>
        <optgroup label="By date">
          ${dateOptions}
        </optgroup>
        <optgroup label="By month">
          ${monthOptions}
        </optgroup>
      </select>
    </label>
  </div>
  <script>
  // Scoped to this panel -- only shipped when the Health tab renders (and
  // only when there are alerts to sort/filter). Reorders/hides existing DOM
  // nodes rather than re-rendering, same idiom as sortSessionCards() in
  // rollup-html.js.
  function sortAlertLines() {
    const list = document.getElementById("alert-list");
    const select = document.getElementById("alert-sort");
    if (!list || !select) return;
    const mode = select.value;
    const lines = Array.from(list.querySelectorAll(".alert-line[data-ts]"));
    lines.sort(function (a, b) {
      if (mode === "asc") return a.dataset.ts.localeCompare(b.dataset.ts);
      return b.dataset.ts.localeCompare(a.dataset.ts); // desc: newest first (default)
    });
    lines.forEach(function (el) { list.appendChild(el); });
  }
  function filterAlertLines() {
    const list = document.getElementById("alert-list");
    const select = document.getElementById("alert-filter");
    if (!list || !select) return;
    const mode = select.value; // "all" | "date:YYYY-MM-DD" | "month:YYYY-MM"
    const lines = Array.from(list.querySelectorAll(".alert-line[data-ts]"));
    lines.forEach(function (el) {
      if (mode === "all") { el.style.display = ""; return; }
      const sep = mode.indexOf(":");
      const kind = mode.slice(0, sep);
      const value = mode.slice(sep + 1);
      const match = kind === "date" ? el.dataset.date === value : el.dataset.month === value;
      el.style.display = match ? "" : "none";
    });
  }
  </script>`;
}

/**
 * @param {object} data - { hooks: [{name,wired}], launchAgents: [{label,loaded}], alertLines: string[] }
 * @returns {string} inner panel HTML
 */
function renderHealthPanel(data) {
  const hooks = data.hooks || [];
  const launchAgents = data.launchAgents || [];
  const alertLines = sortAlertsDesc(data.alertLines || []);

  const alertsHtml = alertLines.length
    ? alertLines.map(renderAlertLine).join("\n")
    : `<div class="alert-line healthy">Healthy — no requirement-capture alerts logged</div>`;
  const alertToolbarHtml = alertLines.length ? renderAlertToolbar(alertLines) : "";
  const analyzerHtml = renderAnalyzerSection(data.analyzerReport);

  return `<div class="panel-health">
    <div class="note">Live self-check — hook wiring re-read from <code>settings.json</code>, LaunchAgent status from <code>launchctl list</code>, on every request.</div>
    <div class="section">
      <div class="section-title">Hook Wiring</div>
      <table>
        <tr><th>Hook</th><th>Status</th></tr>
        ${hooks.map(renderHookRow).join("\n")}
      </table>
    </div>
    <div class="section">
      <div class="section-title">LaunchAgents</div>
      <table>
        <tr><th>Label</th><th>Status</th></tr>
        ${launchAgents.map(renderLaunchAgentRow).join("\n")}
      </table>
    </div>
    <div class="section">
      <div class="section-title">🩺 Framework Health (Golden Factors)</div>
      ${analyzerHtml}
    </div>
    <div class="section">
      <div class="section-title">Requirement-Capture Alerts (last 20)</div>
      ${alertToolbarHtml}
      <div id="alert-list">${alertsHtml}</div>
    </div>
  </div>`;
}

/**
 * @param {object} check - one entry from ar-analyzer's report.checks[]
 * @returns {string} one table row, colored pass=green / high-severity fail=red / low-medium fail=amber
 */
function renderAnalyzerCheckRow(check) {
  const cls = check.status === "pass" ? "v" : check.severity === "high" ? "bad" : "o";
  const label = check.status === "pass" ? "PASS" : check.severity === "high" ? "FAIL" : "WARN";
  return `<tr data-searchable><td>${escHtml(check.id)}</td><td>${escHtml(check.factor)}</td><td class="${cls}">${label}</td><td>${escHtml(check.message)}</td></tr>`;
}

/**
 * @param {object|null} report - ar-analyzer's docs/framework-health/analyzer-report.json contents, or null if it has never run
 * @returns {string} inner HTML for the Framework Health (Golden Factors) section
 */
function renderAnalyzerSection(report) {
  if (!report) {
    return `<div class="note">Not run yet — run <code>ar-analyzer</code> (or <code>node ~/.claude/master-tools/ar-analyzer/ar-analyzer.mjs</code>) to generate a report.</div>`;
  }
  const s = report.summary || { pass: 0, warn: 0, fail: 0 };
  return `<div class="note">${s.pass} pass, ${s.warn} warn, ${s.fail} fail — generated ${escHtml(report.generatedAt || "")}</div>
  <table>
    <tr><th>Check</th><th>Golden Factor</th><th>Status</th><th>Message</th></tr>
    ${(report.checks || []).map(renderAnalyzerCheckRow).join("\n")}
  </table>`;
}

/**
 * @param {object} healthData - shape from loadHealthData()
 * @returns {boolean} true only if every known daemon is loaded and not explicitly failing its live check (no data -> false, never silently "healthy")
 */
function isArogOn(healthData) {
  const agents = (healthData && healthData.launchAgents) || [];
  return agents.length > 0 && agents.every((a) => a.loaded && a.responding !== false);
}

module.exports = { renderHealthPanel, loadHealthData, isArogOn };
