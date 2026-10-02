/**
 * rollup-server.js — AROG Dashboard always-on live HTTP server.
 *
 * Managed by ~/Library/LaunchAgents/com.arog.rollup-server.plist
 * (RunAtLoad + KeepAlive so it survives crashes/restarts/logins).
 *
 * Every request re-reads real data from disk -- this is what makes it
 * "live" rather than a frozen static snapshot (the original problem this
 * whole rebuild exists to solve).
 *
 * SECURITY: binds to 127.0.0.1 ONLY -- never 0.0.0.0/all-interfaces. This
 * is a personal, single-user local tool; loopback-only means nothing
 * outside this machine can ever reach it, so no auth layer is needed. Do
 * NOT change the bind host without re-adding authentication.
 *
 * Routes:
 *   GET /              -- Gaps tab (home)
 *   GET /sessions      -- Sessions tab, supports ?status=verified|failed|open&branch=X
 *                          (sorted newest-first by default; sort/search re-order client-side)
 *   GET /recurring     -- Recurring Files tab
 *   GET /framework     -- Framework tab (skills/agents/hooks, live-scanned)
 *   GET /health        -- Health tab (hook wiring, LaunchAgent status, alerts)
 *   GET /my-work       -- My Work tab (sprint, tickets, PRs, TODOs)
 *   GET /suggestions   -- Suggestions tab (zero-AI rule-based flags from My Work's own data)
 *   GET /command-center -- Command Center tab (priorities, task board, decisions, inbox)
 *   POST /command-center/inbox -- appends a new inbox idea; requires the _csrf
 *                                 field to match this server instance's token
 *   GET /notes         -- Notes tab (renders ~/.claude/my-notes.md)
 *   GET /session/:id   -- session detail fragment (for the drawer, no shell wrapper)
 *   GET /session-log/:id -- raw text/plain content of the session's real docs/sessions/*.md
 *                            file, if one has been generated (404 otherwise)
 *   GET /ping          -- {"status":"ok","pid":...,"uptimeSec":...} liveness check
 *   * anything else    -- 404
 *   non-GET on any other route -- 405
 */

const http = require("http");
const path = require("path");
const os = require("os");
const url = require("url");
const fs = require("fs");
const crypto = require("crypto");

const {
  detectRecurringFiles,
  loadStopArtifacts,
  filterByBranch,
  mergeArtifacts,
  sortSessionsNewestFirst,
} = require("./rollup-aggregate.js");
const { mineSessionLogs, findSessionLogFile } = require("./mine-session-logs.js");
const { markdownToHtml } = require("./notes-panel.js");
const {
  renderSessionsPanel,
  renderRecurringPanel,
  renderSessionDetailHtml,
  escHtml,
} = require("./rollup-html.js");
const { renderShell } = require("./dashboard-shell.js");
const { renderGapsPanel } = require("./gaps-panel.js");
const { renderFrameworkPanel, loadFrameworkData } = require("./framework-panel.js");
const { renderHealthPanel, loadHealthData, isArogOn } = require("./health-panel.js");
const { renderMyWorkPanel, loadMyWorkData } = require("./my-work-panel.js");
const { renderSuggestionsPanel, loadSuggestionsData, computeSuggestions } = require("./suggestions-panel.js");
const { renderCommandCenterPanel, loadCommandCenterData, DEFAULT_INBOX_PATH } = require("./command-center-panel.js");
const { formatInboxEntry } = require("./command-center-inbox.js");
const { renderNotesPanel, loadNotesData } = require("./notes-panel.js");
const { loadSkillsData, renderSkillsPanel, findSkillByName, renderSkillDrawer } = require("./skills-panel.js");
const { loadAgentsData, renderAgentsPanel, findAgentByName, renderAgentDrawer } = require("./agents-panel.js");
const { loadPromptsData, renderPromptsPanel } = require("./prompts-panel.js");
const { loadMonitorData, renderMonitorPanel } = require("./monitor-panel.js");

const SESSIONS_DIR = path.join(os.homedir(), ".claude", "docs", "sessions");
const TRACKER_PATH = path.join(os.homedir(), ".claude", "docs", "real-gaps", "tracker.json");

// Standalone page for GET /session-log/:id -- not wrapped by the dashboard
// shell (this opens in its own tab from the drawer link), so it carries its
// own minimal, self-contained styling rather than importing dashboard-shell.js.
function renderStandaloneMarkdownPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<style>
*{box-sizing:border-box}
body{background:#0a0b0d;color:#eeeae2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;max-width:900px;margin:0 auto;padding:32px 28px 60px}
h1{font-size:22px;font-weight:700;margin:4px 0 18px}
h2{font-size:16px;font-weight:600;margin:24px 0 10px;color:#e8a33d;border-bottom:1px solid #28292f;padding-bottom:6px}
h3{font-size:13.5px;font-weight:700;margin:18px 0 6px;color:#2dd4bf}
p{margin-bottom:10px}
code{background:#141519;border:1px solid #28292f;border-radius:4px;padding:1px 5px;font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:12.5px}
hr{border:none;border-top:1px solid #28292f;margin:18px 0}
table{border-collapse:collapse;width:100%;margin-bottom:16px;font-size:13px}
th,td{border:1px solid #28292f;padding:6px 10px;text-align:left}
th{background:#1b1c21;color:#e8a33d;font-weight:600}
ul,ol{margin:0 0 10px 22px}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function defaultLoadArtifacts() {
  const stopArtifacts = loadStopArtifacts();
  const legacyArtifacts = mineSessionLogs(SESSIONS_DIR);
  return mergeArtifacts(stopArtifacts, legacyArtifacts);
}

function defaultLoadTracker() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_PATH, "utf8"));
  } catch {
    return { meta: {}, requirements: [] };
  }
}

function computeStats(all, trackerData, frameworkData, healthData) {
  const days = new Set(all.map((a) => a.date).filter(Boolean)).size;
  const gaps = (trackerData && trackerData.requirements) || [];
  const gapsAvgPct = gaps.length
    ? Math.round(gaps.reduce((sum, g) => sum + (g.completion_pct || 0), 0) / gaps.length)
    : 0;
  return {
    skills: frameworkData.skills.length,
    agents: frameworkData.agents.length,
    hooks: frameworkData.hooks.length,
    sessions: all.length,
    days,
    gapsAvgPct,
    arogOn: isArogOn(healthData),
  };
}

/**
 * @param {object} [opts]
 * @param {() => Array} [opts.loadArtifacts] - override for tests
 * @param {() => object} [opts.loadTracker] - override for tests
 * @param {() => object} [opts.loadFramework] - override for tests
 * @param {() => object} [opts.loadHealth] - override for tests
 * @param {string} [opts.inboxPath] - override for tests; where the Command Center
 *   inbox form appends to (defaults to the real docs/command-center-inbox.md)
 * @param {string} [opts.sessionsDir] - override for tests; where docs/sessions/*.md
 *   session-log files are read from (defaults to the real SESSIONS_DIR)
 * @returns {import('http').Server}
 */
function createServer({ loadArtifacts, loadTracker, loadFramework, loadHealth, loadMyWork, loadSuggestions, loadCommandCenter, loadNotes, loadSkills, loadAgents, loadPrompts, loadMonitor, inboxPath, sessionsDir } = {}) {
  const loadAll = loadArtifacts || defaultLoadArtifacts;
  const loadTrk = loadTracker || defaultLoadTracker;
  const loadFw = loadFramework || loadFrameworkData;
  const loadHc = loadHealth || loadHealthData;
  const loadMw = loadMyWork || loadMyWorkData;
  const loadSg = loadSuggestions || loadSuggestionsData;
  const inboxFilePath = inboxPath || DEFAULT_INBOX_PATH;
  const sessionsLogDir = sessionsDir || SESSIONS_DIR;
  const loadCc = loadCommandCenter || (() => loadCommandCenterData(undefined, inboxFilePath));
  const loadNt = loadNotes || loadNotesData;
  const loadSk = loadSkills || loadSkillsData;
  const loadAg = loadAgents || loadAgentsData;
  const loadPr = loadPrompts || loadPromptsData;
  const loadMn = loadMonitor || loadMonitorData;
  const startedAt = Date.now();
  // One random token per server (daemon) lifetime -- a lightweight CSRF guard
  // for the first write-capable route this dashboard has ever had. Loopback
  // binding means no external origin can reach this at all; this specifically
  // stops a malicious page open in the SAME browser from silently
  // auto-submitting a form here while the dashboard happens to be running.
  const inboxCsrfToken = crypto.randomBytes(16).toString("hex");

  return http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const isInboxSubmit = pathname === "/command-center/inbox" && req.method === "POST";

    if (req.method !== "GET" && !isInboxSubmit) {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    if (isInboxSubmit) {
      let body = "";
      let tooLarge = false;
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 8192) {
          tooLarge = true;
          req.destroy();
        }
      });
      req.on("end", () => {
        if (tooLarge) return;
        const fields = new url.URLSearchParams(body);
        if ((fields.get("_csrf") || "") !== inboxCsrfToken) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden: invalid or missing CSRF token");
          return;
        }
        const text = fields.get("text") || "";
        if (text.trim()) {
          const entry = formatInboxEntry({
            text,
            kind: fields.get("kind") || "task",
            area: fields.get("area") || "",
            date: new Date().toISOString().slice(0, 10),
          });
          try {
            fs.appendFileSync(inboxFilePath, entry + "\n", "utf8");
          } catch {
            // fall through to the redirect either way -- don't leak fs errors to the client
          }
        }
        res.writeHead(302, { Location: "/command-center" });
        res.end();
      });
      req.on("error", () => {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
      });
      return;
    }


    if (pathname === "/ping") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          pid: process.pid,
          uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        }),
      );
      return;
    }

    const sessionMatch = pathname.match(/^\/session\/([^/]+)$/);
    if (sessionMatch) {
      const id = decodeURIComponent(sessionMatch[1]);
      const all = loadAll();
      const session = all.find((s) => s.session_id === id || s.short_id === id);
      const logFile = session
        ? findSessionLogFile(sessionsLogDir, session.short_id || (session.session_id || "").slice(0, 8))
        : null;
      res.writeHead(session ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(session ? renderSessionDetailHtml(session, logFile) : "<div>Session not found</div>");
      return;
    }

    const sessionLogMatch = pathname.match(/^\/session-log\/([^/]+)$/);
    if (sessionLogMatch) {
      const id = decodeURIComponent(sessionLogMatch[1]);
      const all = loadAll();
      const session = all.find((s) => s.session_id === id || s.short_id === id);
      if (!session) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Session not found");
        return;
      }
      const logFile = findSessionLogFile(sessionsLogDir, session.short_id || (session.session_id || "").slice(0, 8));
      if (!logFile) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("No session log markdown file has been generated for this session yet (capture-sessions runs every 30 min).");
        return;
      }
      let content;
      try {
        content = fs.readFileSync(path.join(sessionsLogDir, logFile), "utf8");
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Session log file could not be read");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderStandaloneMarkdownPage(logFile, markdownToHtml(content)));
      return;
    }

    const all = loadAll();
    const trackerData = loadTrk();
    const frameworkData = loadFw();
    const healthData = loadHc();
    const stats = computeStats(all, trackerData, frameworkData, healthData);

    if (pathname === "/") {
      const panelHtml = renderGapsPanel(trackerData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "gaps", panelHtml, stats }));
      return;
    }

    if (pathname === "/sessions") {
      const statusParam = parsed.query.status || null;
      const branchParam = parsed.query.branch || null;
      let filtered = filterByBranch(all, branchParam);
      if (statusParam) filtered = filtered.filter((s) => s.status === statusParam);
      filtered = sortSessionsNewestFirst(filtered);
      const panelHtml = renderSessionsPanel({ sessions: filtered });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "sessions", panelHtml, stats }));
      return;
    }

    if (pathname === "/recurring") {
      const recurring = detectRecurringFiles(all, 3);
      const panelHtml = renderRecurringPanel({ recurring });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "recurring", panelHtml, stats }));
      return;
    }

    if (pathname === "/framework") {
      const panelHtml = renderFrameworkPanel(frameworkData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "framework", panelHtml, stats }));
      return;
    }

    if (pathname === "/health") {
      const panelHtml = renderHealthPanel(healthData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "health", panelHtml, stats }));
      return;
    }

    if (pathname === "/my-work") {
      const myWorkData = loadMw();
      const panelHtml = renderMyWorkPanel(myWorkData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "my-work", panelHtml, stats }));
      return;
    }

    if (pathname === "/suggestions") {
      const suggestionsData = computeSuggestions(loadSg(), Date.now(), loadCc());
      const panelHtml = renderSuggestionsPanel(suggestionsData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "suggestions", panelHtml, stats }));
      return;
    }

    if (pathname === "/command-center") {
      const ccData = loadCc();
      const panelHtml = renderCommandCenterPanel({ ...ccData, csrfToken: inboxCsrfToken });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "command-center", panelHtml, stats }));
      return;
    }

    if (pathname === "/notes") {
      const notesData = loadNt();
      const panelHtml = renderNotesPanel(notesData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "notes", panelHtml, stats }));
      return;
    }

    if (pathname === "/skills") {
      const skillsData = loadSk();
      const panelHtml = renderSkillsPanel(skillsData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "skills", panelHtml, stats }));
      return;
    }

    if (pathname === "/agents") {
      const agentsData = loadAg();
      const panelHtml = renderAgentsPanel(agentsData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "agents", panelHtml, stats }));
      return;
    }

    if (pathname === "/prompts") {
      const promptsData = loadPr();
      const panelHtml = renderPromptsPanel(promptsData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "prompts", panelHtml, stats }));
      return;
    }

    if (pathname === "/monitor") {
      const monitorData = loadMn();
      const panelHtml = renderMonitorPanel(monitorData);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderShell({ activeTab: "monitor", panelHtml, stats }));
      return;
    }

    const skillMatch = pathname.match(/^\/skill\/([^/]+)$/);
    if (skillMatch) {
      const name = decodeURIComponent(skillMatch[1]);
      const skill = findSkillByName(loadSk(), name);
      res.writeHead(skill ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderSkillDrawer(skill));
      return;
    }

    const agentMatch = pathname.match(/^\/agent\/([^/]+)$/);
    if (agentMatch) {
      const name = decodeURIComponent(agentMatch[1]);
      const agent = findAgentByName(loadAg(), name);
      res.writeHead(agent ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderAgentDrawer(agent));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });
}

module.exports = { createServer };

