/**
 * notes-panel.js — AROG Dashboard "Notes" tab.
 *
 * Renders ~/.claude/my-notes.md as lightweight HTML -- a personal scratch
 * file (daily checklist, reminders, gotchas), live-read on every request
 * (edit the file, refresh the page, done -- no rebuild step, matching every
 * other tab's convention).
 *
 * Minimal, dependency-free markdown: #/##/### headers, "- "/"1. " lists,
 * tables, horizontal rules, blank-line paragraph breaks, `code`, **bold**.
 * Intentionally not a full markdown engine -- inputs are this file's own
 * content and (via the exported markdownToHtml, reused by rollup-server.js's
 * /session-log/:id route) capture-sessions' generated session logs, both
 * known, controlled formats -- escaped before any markdown transform.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { escHtml } = require("./rollup-html.js");

const DEFAULT_NOTES_PATH = path.join(os.homedir(), ".claude", "my-notes.md");

/**
 * @param {string} [notesPath] - override for tests; defaults to the real file
 * @returns {{raw: string}} safe shape, never throws (missing file -> empty string)
 */
function loadNotesData(notesPath = DEFAULT_NOTES_PATH) {
  try {
    return { raw: fs.readFileSync(notesPath, "utf8") };
  } catch {
    return { raw: "" };
  }
}

function inline(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function isHorizontalRule(line) {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
}

function isTableRow(line) {
  return line.trim().startsWith("|");
}

// e.g. "|-------|-------|" or "| --- | :---: |" -- alignment row, contributes
// nothing to the rendered table, must be consumed not shown as a data row.
function isTableSeparatorRow(line) {
  return /^[\s|:-]+$/.test(line.trim());
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function markdownToHtml(raw) {
  const lines = raw.split(/\r?\n/);
  const out = [];
  // At most one of these is buffered at a time -- ul/ol/table are the only
  // markdown constructs here that span multiple lines before they can be
  // flushed as one HTML element.
  let block = null; // null | { type: "ul"|"ol", items: string[] } | { type: "table", header: string[], rows: string[][] }

  const flushBlock = () => {
    if (!block) return;
    if (block.type === "ul") {
      out.push(`<ul class="notes-list">${block.items.join("")}</ul>`);
    } else if (block.type === "ol") {
      out.push(`<ol class="notes-list-ol">${block.items.join("")}</ol>`);
    } else if (block.type === "table") {
      const theadCells = block.header.map((c) => `<th>${inline(escHtml(c))}</th>`).join("");
      const bodyRows = block.rows
        .map((row) => `<tr>${row.map((c) => `<td>${inline(escHtml(c))}</td>`).join("")}</tr>`)
        .join("");
      out.push(`<table class="notes-table"><thead><tr>${theadCells}</tr></thead><tbody>${bodyRows}</tbody></table>`);
    }
    block = null;
  };

  for (const line of lines) {
    const escaped = escHtml(line);
    const h3 = line.match(/^### (.*)$/);
    const h2 = line.match(/^## (.*)$/);
    const h1 = line.match(/^# (.*)$/);
    const uli = line.match(/^[-*] (.*)$/);
    const oli = line.match(/^\d+\. (.*)$/);

    if (h3) {
      flushBlock();
      out.push(`<h3>${inline(escHtml(h3[1]))}</h3>`);
    } else if (h2) {
      flushBlock();
      out.push(`<h2>${inline(escHtml(h2[1]))}</h2>`);
    } else if (h1) {
      flushBlock();
      out.push(`<h1>${inline(escHtml(h1[1]))}</h1>`);
    } else if (isHorizontalRule(line)) {
      flushBlock();
      out.push("<hr>");
    } else if (uli) {
      if (!block || block.type !== "ul") {
        flushBlock();
        block = { type: "ul", items: [] };
      }
      block.items.push(`<li>${inline(escHtml(uli[1]))}</li>`);
    } else if (oli) {
      if (!block || block.type !== "ol") {
        flushBlock();
        block = { type: "ol", items: [] };
      }
      block.items.push(`<li>${inline(escHtml(oli[1]))}</li>`);
    } else if (isTableRow(line)) {
      if (isTableSeparatorRow(line)) continue; // alignment row, not a real cell row
      const cells = splitTableRow(line);
      if (!block || block.type !== "table") {
        flushBlock();
        block = { type: "table", header: cells, rows: [] };
      } else {
        block.rows.push(cells);
      }
    } else if (line.trim() === "") {
      flushBlock();
    } else {
      flushBlock();
      out.push(`<p>${inline(escaped)}</p>`);
    }
  }
  flushBlock();
  return out.join("\n");
}

/**
 * @param {object} data - shape from loadNotesData()
 * @returns {string} inner panel HTML
 */
function renderNotesPanel(data) {
  const raw = (data && data.raw) || "";
  if (!raw.trim()) {
    return `<div class="panel-notes">
      <div class="empty-state">No notes yet — create <code>~/.claude/my-notes.md</code> and refresh this page.</div>
    </div>`;
  }
  return `<div class="panel-notes">
    <div class="note">Edit <code>~/.claude/my-notes.md</code>, then refresh this page — live, no rebuild step.</div>
    <div class="notes-body">${markdownToHtml(raw)}</div>
  </div>`;
}

module.exports = { loadNotesData, renderNotesPanel, markdownToHtml, DEFAULT_NOTES_PATH };
