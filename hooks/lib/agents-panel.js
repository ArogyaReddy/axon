/**
 * agents-panel.js — AROG Dashboard "Agents" tab.
 *
 * Live directory scan of agents/*.md -- name/description from frontmatter
 * plus a short honest body excerpt (first real paragraph after any heading),
 * rendered as a searchable card grid with a click-through detail drawer.
 * Dedicated tab (not folded into Framework), per explicit user direction.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { escHtml } = require("./rollup-html.js");

const DEFAULT_AGENTS_DIR = path.join(os.homedir(), ".claude", "agents");

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

function extractBodyExcerpt(content) {
  const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
  // Skip a leading heading line (e.g. "# Role") to land on the first real paragraph.
  const withoutHeading = withoutFrontmatter.replace(/^#{1,3}\s+.*\r?\n+/, "");
  const firstParagraph = withoutHeading.split(/\r?\n\s*\r?\n/)[0] || "";
  const flat = firstParagraph.replace(/\r?\n/g, " ").trim();
  return flat.slice(0, 300);
}

/**
 * @param {string} [agentsDir] - override for tests; defaults to the real agents/ dir
 * @returns {Array<object>} [{name, description, bodyExcerpt, filePath}], never throws
 */
function loadAgentsData(agentsDir = DEFAULT_AGENTS_DIR) {
  if (!fs.existsSync(agentsDir)) return [];
  const agents = [];
  for (const file of fs.readdirSync(agentsDir)) {
    if (!file.endsWith(".md")) continue;
    try {
      const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
      const { name, description } = parseFrontmatter(content);
      agents.push({
        name: name || file.replace(/\.(agent\.)?md$/, ""),
        description: description || "",
        bodyExcerpt: extractBodyExcerpt(content),
        filePath: `agents/${file}`,
      });
    } catch {
      /* skip unreadable */
    }
  }
  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

function findAgentByName(agents, name) {
  return (agents || []).find((a) => a.name === name) || null;
}

function renderAgentCard(a) {
  const desc = (a.description || "").length > 100 ? a.description.slice(0, 100) + "…" : a.description || "";
  return `<div class="tile-card" data-searchable onclick="openAgentDrawer('${escHtml(a.name)}')">
    <div class="tile-name">${escHtml(a.name)}</div>
    <div class="tile-desc">${escHtml(desc)}</div>
  </div>`;
}

/**
 * @param {Array<object>} agents - shape from loadAgentsData()
 * @returns {string} inner panel HTML
 */
function renderAgentsPanel(agents) {
  const list = agents || [];
  if (!list.length) {
    return `<div class="panel-agents"><div class="empty-state">No agents found in agents/.</div></div>`;
  }
  return `<div class="panel-agents">
    <div class="note">${list.length} agents, live-scanned from <code>agents/*.md</code> on every request. Click a card for full detail.</div>
    <div class="tile-grid">${list.map(renderAgentCard).join("")}</div>
  </div>`;
}

/**
 * @param {object|null} agent - a single agent record, or null if not found
 * @returns {string} drawer body HTML fragment (no drawer chrome)
 */
function renderAgentDrawer(agent) {
  if (!agent) {
    return `<div class="drawer-section"><div class="empty-state">Agent not found.</div></div>`;
  }
  return `<div class="drawer-section">
    <div class="drawer-label">Agent</div>
    <div class="drawer-value" style="font-size:15px;font-weight:700">${escHtml(agent.name)}</div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Description</div>
    <div class="drawer-value">${escHtml(agent.description || "")}</div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Preview</div>
    <div class="drawer-value">${escHtml(agent.bodyExcerpt || "")}</div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">File</div>
    <div class="drawer-value"><code>${escHtml(agent.filePath || "")}</code></div>
  </div>`;
}

module.exports = { loadAgentsData, renderAgentsPanel, findAgentByName, renderAgentDrawer };
