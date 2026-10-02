/**
 * skills-panel.js — AROG Dashboard "Skills" tab.
 *
 * Live directory scan of skills/<name>/SKILL.md -- name/description/usage from
 * frontmatter, plus a short honest body excerpt (not a fabricated "examples"
 * parser -- SKILL.md structure varies too widely across this repo's ~66
 * skills to reliably guess at a consistent Usage/Example block; the
 * frontmatter `description` field's own "Usage: ..." convention, when
 * present, is the one reliably-extractable signal). Rendered as a
 * searchable card grid with a click-through detail drawer, matching the
 * legacy dashboard's Skills-tab interaction model (card + drawer), applied
 * to live-scanned data instead of a frozen build-time snapshot.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { escHtml } = require("./rollup-html.js");

const DEFAULT_SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");

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

function extractUsage(description) {
  if (!description) return null;
  const match = description.match(/Usage:\s*(.+)$/);
  return match ? match[1].trim() : null;
}

function extractBodyExcerpt(content) {
  const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
  const firstParagraph = withoutFrontmatter.split(/\r?\n\s*\r?\n/)[0] || "";
  const flat = firstParagraph.replace(/\r?\n/g, " ").trim();
  return flat.slice(0, 300);
}

/**
 * @param {string} [skillsDir] - override for tests; defaults to the real skills/ dir
 * @returns {Array<object>} [{name, description, usage, bodyExcerpt, filePath}], never throws
 */
function loadSkillsData(skillsDir = DEFAULT_SKILLS_DIR) {
  if (!fs.existsSync(skillsDir)) return [];
  const skills = [];
  for (const dir of fs.readdirSync(skillsDir)) {
    const skillFile = path.join(skillsDir, dir, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    try {
      const content = fs.readFileSync(skillFile, "utf8");
      const { name, description } = parseFrontmatter(content);
      skills.push({
        name: name || dir,
        description: description || "",
        usage: extractUsage(description),
        bodyExcerpt: extractBodyExcerpt(content),
        filePath: `skills/${dir}/SKILL.md`,
      });
    } catch {
      /* skip unreadable */
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function findSkillByName(skills, name) {
  return (skills || []).find((s) => s.name === name) || null;
}

function renderSkillCard(s) {
  const desc = (s.description || "").length > 100 ? s.description.slice(0, 100) + "…" : s.description || "";
  return `<div class="tile-card" data-searchable onclick="openSkillDrawer('${escHtml(s.name)}')">
    <div class="tile-name">/${escHtml(s.name)}</div>
    <div class="tile-desc">${escHtml(desc)}</div>
    <div class="tile-footer">
      ${s.usage ? `<span class="tile-chip">has usage</span>` : ""}
      <button class="copy-btn" onclick="event.stopPropagation();copyToClipboard(this,'/${escHtml(s.name)}')">copy</button>
    </div>
  </div>`;
}

/**
 * @param {Array<object>} skills - shape from loadSkillsData()
 * @returns {string} inner panel HTML
 */
function renderSkillsPanel(skills) {
  const list = skills || [];
  if (!list.length) {
    return `<div class="panel-skills"><div class="empty-state">No skills found in skills/.</div></div>`;
  }
  return `<div class="panel-skills">
    <div class="note">${list.length} skills, live-scanned from <code>skills/*/SKILL.md</code> on every request. Click a card for full detail.</div>
    <div class="tile-grid">${list.map(renderSkillCard).join("")}</div>
  </div>`;
}

/**
 * @param {object|null} skill - a single skill record, or null if not found
 * @returns {string} drawer body HTML fragment (no drawer chrome)
 */
function renderSkillDrawer(skill) {
  if (!skill) {
    return `<div class="drawer-section"><div class="empty-state">Skill not found.</div></div>`;
  }
  return `<div class="drawer-section">
    <div class="drawer-label">Skill</div>
    <div class="drawer-value" style="font-size:15px;font-weight:700">/${escHtml(skill.name)}</div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">Description</div>
    <div class="drawer-value">${escHtml(skill.description || "")}</div>
  </div>
  ${
    skill.usage
      ? `<div class="drawer-section"><div class="drawer-label">Usage</div><div class="drawer-value example-box">${escHtml(skill.usage)}</div></div>`
      : ""
  }
  <div class="drawer-section">
    <div class="drawer-label">Preview</div>
    <div class="drawer-value">${escHtml(skill.bodyExcerpt || "")}</div>
  </div>
  <div class="drawer-section">
    <div class="drawer-label">File</div>
    <div class="drawer-value"><code>${escHtml(skill.filePath || "")}</code></div>
  </div>
  <div style="margin-top:8px">
    <button class="copy-btn" onclick="copyToClipboard(this,'/${escHtml(skill.name)}')">Copy command</button>
  </div>`;
}

module.exports = { loadSkillsData, renderSkillsPanel, findSkillByName, renderSkillDrawer };
