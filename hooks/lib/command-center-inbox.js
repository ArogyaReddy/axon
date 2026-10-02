/**
 * command-center-inbox.js — pure logic for the Command Center "Inbox".
 *
 * Lets the user drop a raw task/priority idea in either of two ways
 * (hand-editing docs/command-center-inbox.md directly, or the "+ Add to
 * Inbox" form on /command-center) -- both converge on this same file and
 * format. AROG reads this each session, researches each item for real,
 * and promotes it into command-center.json with full what/why/where.
 *
 * No fs/HTTP I/O here -- rollup-server.js does the actual read/write;
 * this module is pure string handling so the security-sensitive parts
 * (sanitization, injection prevention) are directly unit-testable.
 */

const VALID_KINDS = new Set(["task", "priority"]);
const MAX_TEXT_LENGTH = 300;
const MAX_AREA_LENGTH = 30;

// Matches: "- [ ] (task) text — added 2026-08-02" or
//          "- [x] (priority, area: security) text — added 2026-08-02"
const INBOX_ITEM_RE = /^- \[( |x)\] \(([a-z]+)(?:, area: ([a-z0-9_-]+))?\) (.+?) — added (\d{4}-\d{2}-\d{2})$/i;

/**
 * Strips newlines/control characters (prevents injecting a fake extra
 * list item into the markdown file) and caps length.
 * @param {*} raw
 * @returns {string}
 */
function sanitizeInboxText(raw) {
  return String(raw ?? "")
    .replace(/[\r\n]+/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

/**
 * @param {{text:string, kind:string, area:string, date:string}} entry
 * @returns {string} a single, safe markdown inbox line
 */
function formatInboxEntry({ text, kind, area, date }) {
  const safeKind = VALID_KINDS.has(String(kind || "").toLowerCase()) ? String(kind).toLowerCase() : "task";
  const safeText = sanitizeInboxText(text);
  const safeArea = area ? sanitizeInboxText(area).replace(/[^a-z0-9_-]/gi, "").slice(0, MAX_AREA_LENGTH) : "";
  const areaPart = safeArea ? `, area: ${safeArea}` : "";
  return `- [ ] (${safeKind}${areaPart}) ${safeText} — added ${date}`;
}

/**
 * @param {string} markdown - raw content of docs/command-center-inbox.md
 * @returns {Array<{done:boolean, kind:string, area:string|null, text:string, date:string}>}
 */
function parseInboxItems(markdown) {
  return String(markdown || "")
    .split("\n")
    .map((line) => line.match(INBOX_ITEM_RE))
    .filter(Boolean)
    .map((m) => ({
      done: m[1].toLowerCase() === "x",
      kind: m[2].toLowerCase(),
      area: m[3] || null,
      text: m[4],
      date: m[5],
    }));
}

module.exports = { sanitizeInboxText, formatInboxEntry, parseInboxItems, INBOX_ITEM_RE };
