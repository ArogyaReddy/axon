/**
 * framework-panel.js — AROG Dashboard "Framework" tab.
 *
 * Same value as the reference dashboard's skills/agents/hooks catalog, but
 * live-scanned from disk on every request instead of a frozen snapshot
 * generated once and never revisited.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { escHtml } = require("./rollup-html.js");

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: null, description: null };
  const lines = match[1].split(/\r?\n/);
  let name = null;
  let description = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch && !name) name = nameMatch[1].trim();

    const descMatch = line.match(/^description:\s*(.*)$/);
    if (descMatch) {
      const rest = descMatch[1].trim();
      if (rest === ">" || rest === "|" || rest === ">-" || rest === "|-") {
        // YAML folded/literal block scalar -- description text is on
        // subsequent indented lines, not the same line (e.g. ar-app-tests).
        const parts = [];
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s+\S/.test(lines[j])) {
            parts.push(lines[j].trim());
          } else {
            break;
          }
        }
        description = parts.join(" ").trim();
      } else {
        description = rest.replace(/^"(.*)"$/, "$1").trim();
      }
    }
  }
  return { name, description };
}

/**
 * Live directory scan -- real data, re-read on every request. Never cached.
 */
function loadFrameworkData() {
  const base = path.join(os.homedir(), ".claude");
  const skills = [];
  const skillsDir = path.join(base, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const dir of fs.readdirSync(skillsDir)) {
      const skillFile = path.join(skillsDir, dir, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      try {
        const content = fs.readFileSync(skillFile, "utf8");
        const { name, description } = parseFrontmatter(content);
        skills.push({ name: name || dir, description: description || "" });
      } catch {
        /* skip unreadable */
      }
    }
  }

  const agents = [];
  const agentsDir = path.join(base, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const file of fs.readdirSync(agentsDir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
        const { name, description } = parseFrontmatter(content);
        agents.push({ name: name || file.replace(/\.(agent\.)?md$/, ""), description: description || "" });
      } catch {
        /* skip unreadable */
      }
    }
  }

  const hooks = [];
  const settingsFile = path.join(base, "settings.json");
  if (fs.existsSync(settingsFile)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      for (const [eventType, matchers] of Object.entries(settings.hooks || {})) {
        for (const m of matchers) {
          for (const h of m.hooks || []) {
            hooks.push({ event: eventType, matcher: m.matcher || "*", command: h.command || "" });
          }
        }
      }
    } catch {
      /* skip unreadable/invalid settings.json */
    }
  }

  return { skills, agents, hooks };
}

function renderSkillCard(s) {
  return `<div class="fw-card" data-searchable>
    <div class="fw-name">${escHtml(s.name)}</div>
    <div class="fw-desc">${escHtml(s.description)}</div>
  </div>`;
}

function renderAgentCard(a) {
  return `<div class="fw-card" data-searchable>
    <div class="fw-name">${escHtml(a.name)}</div>
    <div class="fw-desc">${escHtml(a.description)}</div>
  </div>`;
}

function renderHookRow(h) {
  return `<tr data-searchable><td>${escHtml(h.event)}</td><td><code>${escHtml(h.matcher)}</code></td><td><code>${escHtml(h.command)}</code></td></tr>`;
}

/**
 * @param {object} data - { skills: [{name,description}], agents: [...], hooks: [{event,matcher,command}] }
 * @returns {string} inner panel HTML
 */
function renderFrameworkPanel(data) {
  const skills = data.skills || [];
  const agents = data.agents || [];
  const hooks = data.hooks || [];

  return `<div class="panel-framework">
    <div class="note">Live-scanned from <code>~/.claude/skills/</code>, <code>~/.claude/agents/</code>, and <code>settings.json</code> on every request.</div>
    <div class="section">
      <div class="section-title">Skills (${skills.length})</div>
      <div class="fw-grid">${skills.map(renderSkillCard).join("\n") || '<div class="empty-state">No skills found</div>'}</div>
    </div>
    <div class="section">
      <div class="section-title">Agents (${agents.length})</div>
      <div class="fw-grid">${agents.map(renderAgentCard).join("\n") || '<div class="empty-state">No agents found</div>'}</div>
    </div>
    <div class="section">
      <div class="section-title">Hooks (${hooks.length})</div>
      <table>
        <tr><th>Event</th><th>Matcher</th><th>Command</th></tr>
        ${hooks.map(renderHookRow).join("\n") || '<tr><td colspan="3" class="empty">No hooks registered</td></tr>'}
      </table>
    </div>
  </div>`;
}

module.exports = { renderFrameworkPanel, loadFrameworkData, parseFrontmatter };
