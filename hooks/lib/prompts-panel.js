/**
 * prompts-panel.js — AROG Dashboard "Prompts" tab.
 *
 * Category-grouped prompt/template library, live-read from
 * docs/prompts.json on every request. Content ported from the legacy
 * FRAMEWORK-DASHBOARD.html's PROMPTS_DATA (67 prompts across 9 categories,
 * 2026-06-22 snapshot) -- same category-grouped, copy-button UX as the
 * legacy tab, applied to this repo's live-read convention (edit the JSON,
 * refresh the page, no rebuild step).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { escHtml } = require("./rollup-html.js");

const DEFAULT_DATA_PATH = path.join(os.homedir(), ".claude", "docs", "prompts.json");

/**
 * @param {string} [dataPath] - override for tests; defaults to the real file
 * @returns {Array<object>} [{id,label,color,prompts:[...]}], never throws
 */
function loadPromptsData(dataPath = DEFAULT_DATA_PATH) {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function highlightPlaceholders(escapedTemplate) {
  return escapedTemplate.replace(/\[([^\]]+)\]/g, '<span class="tpl-placeholder">[$1]</span>');
}

function renderPromptCard(p, categoryColor) {
  const isCmd = p.type === "command";
  const tpl = highlightPlaceholders(escHtml(p.template || ""));
  const tagsHtml = (p.tags || []).slice(0, 3).map((t) => `<span class="tile-chip">${escHtml(t)}</span>`).join("");
  return `<div class="prompt-card" data-searchable>
    <div class="prompt-card-head">
      <span class="prompt-title">${escHtml(p.title || "")}</span>
      <span class="prompt-type ${isCmd ? "cmd" : "tmpl"}">${isCmd ? "command" : "template"}</span>
    </div>
    <div class="prompt-desc">${escHtml(p.description || "")}</div>
    <div class="prompt-template">${tpl}</div>
    <div class="tile-footer">
      <span class="cc-chip" style="color:${escHtml(categoryColor || "")};border-color:${escHtml(categoryColor || "")}">${escHtml(p.catLabel || "")}</span>
      ${tagsHtml}
      <button class="copy-btn" onclick="copyToClipboard(this,'${encodeURIComponent(p.template || "")}',true)">copy</button>
    </div>
  </div>`;
}

/**
 * @param {Array<object>} categories - shape from loadPromptsData()
 * @returns {string} inner panel HTML
 */
function renderPromptsPanel(categories) {
  const list = categories || [];
  const totalPrompts = list.reduce((n, c) => n + (c.prompts || []).length, 0);
  if (!list.length || totalPrompts === 0) {
    return `<div class="panel-prompts"><div class="empty-state">No prompts found in docs/prompts.json.</div></div>`;
  }
  const sections = list
    .map((cat) => {
      const cards = (cat.prompts || [])
        .map((p) => renderPromptCard({ ...p, catLabel: cat.label }, cat.color))
        .join("");
      return `<div class="section">
        <div class="section-title" style="border-color:${escHtml(cat.color || "")}">${escHtml(cat.label || cat.id || "")}</div>
        <div class="prompt-grid">${cards}</div>
      </div>`;
    })
    .join("");
  return `<div class="panel-prompts">
    <div class="note">${totalPrompts} prompts across ${list.length} categories, live from <code>docs/prompts.json</code>.</div>
    ${sections}
  </div>`;
}

module.exports = { loadPromptsData, renderPromptsPanel };
