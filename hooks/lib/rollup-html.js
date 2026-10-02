/**
 * rollup-html.js — shared HTML renderer for the Gap 4 dashboard.
 *
 * Used by both:
 *  - `bin/ar-rollup build` (static snapshot, liveControls:false)
 *  - `hooks/lib/rollup-server.js` (always-on LaunchAgent-managed server,
 *    liveControls:true — re-renders from real data on every request)
 *
 * Adds real interactivity that the original static-only version lacked:
 *  - Sortable columns (click a <th>, vanilla JS, no dependencies)
 *  - A text filter input per table (client-side substring match)
 *  - (live mode only) a GET form for days/branch that becomes real query
 *    params the server re-aggregates from, instead of a frozen snapshot
 *
 * SECURITY: `branch` and every recurring `file` value are attacker-influenced
 * in live mode (they come from query params) and MUST be HTML-escaped before
 * being embedded in the response -- see escHtml(). Never interpolate raw.
 */

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CLIENT_SCRIPT = `
function sortTable(th) {
  const table = th.closest("table");
  const colIndex = Array.from(th.parentNode.children).indexOf(th);
  const tbody = table.tagName === "TBODY" ? table : table;
  const rows = Array.from(table.querySelectorAll("tr")).slice(1); // skip header row
  const asc = th.dataset.sortDir !== "asc";
  rows.sort((a, b) => {
    const av = a.children[colIndex]?.textContent.trim() || "";
    const bv = b.children[colIndex]?.textContent.trim() || "";
    const an = parseFloat(av.replace(/[^0-9.\\-]/g, ""));
    const bn = parseFloat(bv.replace(/[^0-9.\\-]/g, ""));
    let cmp;
    if (!isNaN(an) && !isNaN(bn) && av.match(/^-?[0-9.]+%?$/)) {
      cmp = an - bn;
    } else {
      cmp = av.localeCompare(bv);
    }
    return asc ? cmp : -cmp;
  });
  for (const tr of table.querySelectorAll("th")) delete tr.dataset.sortDir;
  th.dataset.sortDir = asc ? "asc" : "desc";
  const parent = rows[0]?.parentNode;
  if (parent) rows.forEach((r) => parent.appendChild(r));
}
function filterTable(input) {
  const table = document.getElementById(input.dataset.target);
  if (!table) return;
  const q = input.value.toLowerCase();
  const rows = Array.from(table.querySelectorAll("tr")).slice(1);
  for (const row of rows) {
    row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
  }
}
`;

function renderTable({ id, headers, rows, emptyMessage, colspan }) {
  const thead =
    "<tr>" +
    headers
      .map((h) => `<th onclick="sortTable(this)">${escHtml(h)}</th>`)
      .join("") +
    "</tr>";
  const body = rows.length
    ? rows.join("\n      ")
    : `<tr><td colspan="${colspan}" class="empty">${escHtml(emptyMessage)}</td></tr>`;
  return `<input type="text" class="table-filter" data-target="${id}" placeholder="Filter...">
    <table id="${id}">
      ${thead}
      ${body}
    </table>`;
}

/**
 * @param {object} opts
 * @param {Array} opts.all - all artifacts in the current filtered window (for the "Total Sessions" stat)
 * @param {object} opts.byDay - aggregateByDay() result
 * @param {Array} opts.recurring - detectRecurringFiles() result
 * @param {string|null} [opts.branch] - current branch filter, if any (attacker-influenced in live mode -- escaped)
 * @param {number|null} [opts.days] - current days filter, if any (live mode)
 * @param {boolean} [opts.liveControls] - whether to render the live query-param form + LIVE badge
 * @returns {string} full HTML document
 */
function renderDashboardHtml({ all, byDay, recurring, branch, days, liveControls }) {
  const daysList = Object.keys(byDay).sort().reverse();
  const dateRange = daysList.length
    ? daysList[daysList.length - 1] + " \u2192 " + daysList[0]
    : "(no data)";

  const sessionRows = daysList.map((day) => {
    const d = byDay[day];
    const rate = d.passRate === null ? "n/a" : (d.passRate * 100).toFixed(0) + "%";
    return (
      "<tr><td>" + day + "</td><td>" + d.total + '</td><td class="v">' + d.verified +
      '</td><td class="f">' + d.failed + '</td><td class="o">' + d.open + "</td><td>" + rate + "</td></tr>"
    );
  });

  const recurringRows = recurring
    .slice(0, 30)
    .map((r) => "<tr><td><code>" + escHtml(r.file) + "</code></td><td>" + r.sessionCount + "</td></tr>");

  const legacyCount = all.filter((a) => a.source === "legacy-md").length;
  const stopCount = all.length - legacyCount;
  const subtitle =
    "Gap 4 \u2014 zero-AI aggregation of session-env/ stop artifacts + mined docs/sessions/ archive" +
    (branch ? " \u2014 filtered to branch " + escHtml(branch) : "");

  const liveForm = liveControls
    ? `<form id="live-filter-form" method="get" class="live-form">
    <span class="live-badge">LIVE</span>
    <label>Days <input type="number" name="days" value="${escHtml(days ?? "")}" min="1"></label>
    <label>Branch <input type="text" name="branch" value="${escHtml(branch ?? "")}"></label>
    <button type="submit">Apply</button>
  </form>`
    : "";

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>AROG Historical Rollup Dashboard</title>",
    "<style>",
    "*{box-sizing:border-box;margin:0;padding:0}",
    "body{background:#0e1117;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5}",
    ".header{background:linear-gradient(135deg,#1a1f2e 0%,#0e1117 100%);border-bottom:1px solid #2d3748;padding:24px 32px}",
    ".header-title{font-size:22px;font-weight:700;color:#f8fafc;margin-bottom:6px}",
    ".header-sub{color:#94a3b8;font-size:13px}",
    ".hdr-stats{display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-top:14px}",
    ".stat{display:flex;flex-direction:column}",
    ".stat-num{font-size:24px;font-weight:700;color:#f8fafc}",
    ".stat-lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}",
    ".content{padding:24px 32px;max-width:1000px}",
    ".section{margin-bottom:28px}",
    ".section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:600;margin-bottom:10px;border-bottom:1px solid #1e293b;padding-bottom:6px}",
    "table{width:100%;border-collapse:collapse;margin-top:8px}",
    "th{text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;padding:6px 10px;border-bottom:1px solid #1e293b;cursor:pointer;user-select:none}",
    "th:hover{color:#e2e8f0}",
    "td{padding:6px 10px;border-bottom:1px solid #1a2230;font-size:13px}",
    "td.v{color:#22c55e}",
    "td.f{color:#ef4444}",
    "td.o{color:#f59e0b}",
    "td.empty{color:#374151;font-style:italic}",
    "code{color:#7fd1ff;font-size:12px}",
    ".note{background:#1a1f2e;border:1px solid #2d3748;border-left:3px solid #475569;padding:10px 14px;color:#94a3b8;font-size:12px;border-radius:0 6px 6px 0;margin-bottom:16px}",
    ".footer{text-align:right;font-size:11px;color:#374151;padding:16px 32px}",
    ".table-filter{width:100%;padding:6px 10px;background:#161b26;border:1px solid #2d3748;color:#e2e8f0;border-radius:4px;font-size:12px}",
    ".live-form{display:flex;gap:14px;align-items:center;margin-top:10px;font-size:12px;color:#94a3b8}",
    ".live-form input{background:#161b26;border:1px solid #2d3748;color:#e2e8f0;padding:4px 8px;border-radius:4px;width:100px}",
    ".live-form button{background:#22c55e;border:none;color:#0e1117;padding:5px 12px;border-radius:4px;font-weight:600;cursor:pointer}",
    ".live-badge{background:#22c55e;color:#0e1117;font-weight:700;font-size:10px;padding:2px 8px;border-radius:10px;letter-spacing:.05em}",
    "</style>",
    "</head>",
    "<body>",
    '<div class="header">',
    '  <div class="header-title">AROG Historical Rollup Dashboard</div>',
    '  <div class="header-sub">' + subtitle + "</div>",
    "  " + liveForm,
    '  <div class="hdr-stats">',
    '    <div class="stat"><span class="stat-num">' + all.length + '</span><span class="stat-lbl">Total Sessions</span></div>',
    '    <div class="stat"><span class="stat-num">' + daysList.length + '</span><span class="stat-lbl">Days Covered</span></div>',
    '    <div class="stat"><span class="stat-num">' + recurring.length + '</span><span class="stat-lbl">Recurring Files</span></div>',
    "  </div>",
    "</div>",
    '<div class="content">',
    '  <div class="note">Date range: <strong>' + dateRange + "</strong> \u2014 " + stopCount +
      " sessions from real stop-*.json (structured: status/branch/tests), " + legacyCount +
      ' mined from the older docs/sessions/*.md archive (status/branch unknown for these \u2014 shown as "open", never guessed).</div>',
    '  <div class="section">',
    '    <div class="section-title">Sessions Per Day</div>',
    "    " + renderTable({
      id: "sessions-table",
      headers: ["Date", "Sessions", "Verified", "Failed", "Open", "Pass Rate"],
      rows: sessionRows,
      emptyMessage: "No sessions found",
      colspan: 6,
    }),
    "  </div>",
    '  <div class="section">',
    '    <div class="section-title">Recurring File Churn (3+ distinct sessions)</div>',
    "    " + renderTable({
      id: "recurring-table",
      headers: ["File", "Sessions"],
      rows: recurringRows,
      emptyMessage: "None \u2014 no file touched in 3+ sessions yet",
      colspan: 2,
    }),
    "  </div>",
    "</div>",
    '<div class="footer">Generated ' + new Date().toISOString().slice(0, 16).replace("T", " ") +
      " UTC &nbsp;\u00b7&nbsp; " + (liveControls ? "live \u2014 refresh anytime" : "<strong>ar-rollup build</strong> to refresh") + "</div>",
    "<script>",
    'document.querySelectorAll(".table-filter").forEach(function(el){ el.addEventListener("input", function(){ filterTable(el); }); });',
    CLIENT_SCRIPT,
    "</script>",
    "</body>",
    "</html>",
  ].join("\n");
}

// ── AROG Dashboard panel renderers (added 2026-07-24) ────────────────────────
// Additive to renderDashboardHtml() above (still used unchanged by
// `bin/ar-rollup build`'s static output). These render PANEL FRAGMENTS
// (no <html>/<head>) for the live shell (hooks/lib/dashboard-shell.js)'s
// Sessions / Recurring Files tabs + the session detail drawer.

function statusClass(status) {
  if (status === "verified") return "v";
  if (status === "failed") return "f";
  return "o";
}

function renderSessionCard(s) {
  const req = s.req || {};
  const reqSnippet = (req.raw || "(no requirement captured)").slice(0, 140);
  const testState = s.test_state || {};
  const testsSummary = testState.tests_ran
    ? `${testState.pass_count || 0}P/${testState.fail_count || 0}F`
    : "no tests run";
  const status = s.status || "open";
  const filesCount = (s.changed_files || []).length;
  // data-* attributes carry raw sort/search values for the client-side sort
  // selector + search-to-top behavior (dashboard-shell.js/this panel's own
  // script) -- avoids re-parsing the formatted text nodes below.
  return `<div class="session-card" data-searchable
    data-ts="${escHtml(s.timestamp || s.date || "")}"
    data-status="${escHtml(status)}"
    data-branch="${escHtml(s.branch || "")}"
    data-files="${filesCount}"
    onclick="openSessionDrawer('${escHtml(s.session_id)}')">
    <div class="session-card-head">
      <span class="session-date">${escHtml(s.date || "")}</span>
      <span class="session-status ${statusClass(s.status)}">${escHtml(status.toUpperCase())}</span>
    </div>
    <div class="session-branch">${escHtml(s.branch || "(unknown branch)")}</div>
    <div class="session-req">${escHtml(reqSnippet)}</div>
    <div class="session-meta">${filesCount} files · ${escHtml(testsSummary)}</div>
  </div>`;
}

/**
 * @param {object} opts
 * @param {Array} opts.sessions - artifact array (from loadAllArtifacts()), already filtered/sorted by the caller
 * @returns {string} inner panel HTML for the Sessions tab
 */
function renderSessionsPanel({ sessions }) {
  const list = sessions || [];
  const cards = list.map(renderSessionCard).join("\n");
  return `<div class="panel-sessions">
    <div class="note">${list.length} session(s) — live from <code>session-env/*/stop-*.json</code> + the mined legacy archive. Click a card for full detail.</div>
    <div class="session-toolbar">
      <label class="session-sort-label">Sort
        <select id="session-sort" onchange="sortSessionCards()">
          <option value="date-desc" selected>Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="status">Status</option>
          <option value="branch">Branch</option>
          <option value="files-desc">Most files changed</option>
        </select>
      </label>
    </div>
    <div class="session-grid" id="session-grid">${cards || '<div class="empty-state">No sessions match the current filter</div>'}</div>
  </div>
  <script>
  // Scoped to this panel -- only shipped when the Sessions tab renders, so
  // it can never affect any other tab. Reorders existing DOM nodes (cheap,
  // preserves click handlers) rather than re-rendering. filterGlobal()
  // (dashboard-shell.js, always present) calls back into this after a
  // search-box change so sort + search compose correctly in either order.
  function sortSessionCards() {
    const grid = document.getElementById("session-grid");
    const select = document.getElementById("session-sort");
    if (!grid || !select) return;
    const mode = select.value;
    const statusRank = { failed: 0, open: 1, verified: 2 };
    const cards = Array.from(grid.querySelectorAll(".session-card"));
    cards.sort(function (a, b) {
      if (mode === "date-asc") return a.dataset.ts.localeCompare(b.dataset.ts);
      if (mode === "branch") {
        const c = a.dataset.branch.toLowerCase().localeCompare(b.dataset.branch.toLowerCase());
        return c !== 0 ? c : b.dataset.ts.localeCompare(a.dataset.ts);
      }
      if (mode === "status") {
        const ra = statusRank[a.dataset.status] ?? 1;
        const rb = statusRank[b.dataset.status] ?? 1;
        return ra !== rb ? ra - rb : b.dataset.ts.localeCompare(a.dataset.ts);
      }
      if (mode === "files-desc") {
        const c = Number(b.dataset.files) - Number(a.dataset.files);
        return c !== 0 ? c : b.dataset.ts.localeCompare(a.dataset.ts);
      }
      return b.dataset.ts.localeCompare(a.dataset.ts); // date-desc: newest first (default)
    });
    cards.forEach(function (c) { grid.appendChild(c); });
    const search = document.getElementById("global-search");
    if (search && search.value && typeof filterGlobal === "function") filterGlobal(search);
  }
  </script>`;
}

/**
 * @param {object} opts
 * @param {Array} opts.recurring - detectRecurringFiles() result
 * @returns {string} inner panel HTML for the Recurring Files tab
 */
function renderRecurringPanel({ recurring }) {
  const list = recurring || [];
  const rows = list
    .map((r) => `<tr data-searchable><td><code>${escHtml(r.file)}</code></td><td>${r.sessionCount}</td></tr>`)
    .join("\n");
  return `<div class="panel-recurring">
    <div class="note">Files touched in 3+ distinct sessions — a real recurring-bug/hot-spot signal, not a guess.</div>
    <table>
      <tr><th onclick="sortTable(this)">File</th><th onclick="sortTable(this)">Sessions</th></tr>
      ${rows || '<tr><td colspan="2" class="empty">None yet</td></tr>'}
    </table>
  </div>`;
}

/**
 * @param {object} session - a single artifact (same shape as renderSessionCard's input)
 * @param {string|null} [logFile] - the real docs/sessions/*.md filename for this
 *   session, if one has been generated by capture-sessions (see mine-session-logs.js's
 *   findSessionLogFile) -- null renders an honest "not generated yet" state instead
 *   of a dead link. Links to the same-origin GET /session-log/:id route (which renders
 *   it as HTML) rather than a file:// URL -- browsers block http pages from
 *   navigating to file:// (confirmed live: "Not allowed to load local resource").
 * @returns {string} HTML fragment rendered inside the slide-in drawer
 */
function renderSessionDetailHtml(session, logFile) {
  const req = session.req || {};
  const testState = session.test_state || {};
  const files = session.changed_files || [];
  const filesHtml = files.length
    ? `<ul class="drawer-file-list">${files.map((f) => `<li><code>${escHtml(f)}</code></li>`).join("")}</ul>`
    : `<div class="empty-state">No files recorded</div>`;
  const logHtml = logFile
    ? `<a class="drawer-link" href="/session-log/${escHtml(session.session_id)}" target="_blank" rel="noopener noreferrer">Open ${escHtml(logFile)} \u2197</a>`
    : `<div class="empty-state">Not generated yet \u2014 capture-sessions runs every 30 min</div>`;

  return `<div class="drawer-section">
    <div class="drawer-label">Session</div>
    <div class="drawer-value">${escHtml(session.short_id || session.session_id || "")} — ${escHtml(session.date || "")}</div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Status / Branch</div>
    <div class="drawer-value"><span class="session-status ${statusClass(session.status)}">${escHtml((session.status || "open").toUpperCase())}</span> on <code>${escHtml(session.branch || "unknown")}</code></div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Requirement</div>
    <div class="drawer-value">${escHtml(req.raw || "(no requirement captured for this session)")}</div>
    ${req.ticketId ? `<div class="drawer-value">Ticket: <code>${escHtml(req.ticketId)}</code></div>` : ""}
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Tests</div>
    <div class="drawer-value">${testState.tests_ran ? `${testState.pass_count || 0} passed / ${testState.fail_count || 0} failed` : "No tests run this session"}</div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Changed Files (${files.length})</div>
    ${filesHtml}
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Full Session Log</div>
    <div class="drawer-value">${logHtml}</div>
  </div>`;
}

module.exports = {
  renderDashboardHtml,
  escHtml,
  renderSessionsPanel,
  renderRecurringPanel,
  renderSessionDetailHtml,
};
