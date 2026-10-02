/**
 * resolve-ticket-id.js — Gap 5: optional Trac/JIRA ticket-ID linkage
 *
 * Resolves a ticket ID for the current session via a priority chain that
 * NEVER blocks and NEVER returns null:
 *
 *   1. AR_TICKET_ID env var         — explicit manual override, always wins
 *   2. feature_flags.ticket_linkage_enabled (ar-config.yaml, default true)
 *      — if explicitly false, skip steps 3-4 entirely
 *   3. Ticket pattern in the current git branch name
 *   4. Ticket pattern mentioned in the requirement's raw text
 *   5. LOCAL-{YYYYMMDD}-{shortSessionId} — deterministic, always available
 *
 * Returns { ticketId, ticketSource } where ticketSource is one of
 * "manual" | "branch" | "text" | "local".
 *
 * Zero AI. Fails silent/open on every I/O step (git not available, config
 * unreadable) — detection is best-effort, the local fallback always works.
 */

const path = require("path");
const { execFileSync } = require("child_process");

// JIRA/Trac-style key: PROJECT-12345 (e.g. SBSRUNCORE-17643)
const KEY_PATTERN = /\b([A-Z][A-Z0-9]{2,15}-\d{2,7})\b/;
// Bare numeric Trac ticket embedded with path-like delimiters: /17643/ or -17643-
const NUMERIC_PATTERN = /[/-](\d{4,7})[/-]/;

function matchTicket(text) {
  if (!text) return null;
  const keyMatch = text.match(KEY_PATTERN);
  if (keyMatch) return keyMatch[1];
  const numMatch = text.match(NUMERIC_PATTERN);
  if (numMatch) return numMatch[1];
  return null;
}

function detectionEnabled(envOverrides) {
  try {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "scripts",
      "get-flag.sh",
    );
    const out = execFileSync(
      "bash",
      [scriptPath, "ticket_linkage_enabled"],
      {
        encoding: "utf8",
        timeout: 3000,
        env: { ...process.env, ...envOverrides },
      },
    );
    // get-flag.sh only exits 0 when the flag was actually found (explicit
    // true or false) — this is the ONLY path where "false" means "disabled".
    return out.trim() !== "false";
  } catch {
    // Non-zero exit = flag not defined / config unreadable / get-flag.sh
    // error (it exits 1 and still prints "false" for the "not found" case
    // too) — fail-open: attempt detection by default rather than silently
    // treating "not configured" the same as "explicitly disabled".
    return true;
  }
}

function branchTicket(cwd) {
  try {
    const branch = execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd, encoding: "utf8", timeout: 3000 },
    ).trim();
    return matchTicket(branch);
  } catch {
    return null; // not a git repo, no commits yet, or git unavailable
  }
}

function localTicketId(sessionId) {
  const now = new Date();
  const dateStr =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const shortId = String(sessionId || "unknown").slice(0, 8);
  return `LOCAL-${dateStr}-${shortId}`;
}

function resolveTicketId({
  rawText = "",
  cwd = process.cwd(),
  sessionId = "unknown",
  env = {},
} = {}) {
  const manual = (env.AR_TICKET_ID || process.env.AR_TICKET_ID || "").trim();
  if (manual) return { ticketId: manual, ticketSource: "manual" };

  if (detectionEnabled(env)) {
    const fromBranch = branchTicket(cwd);
    if (fromBranch) return { ticketId: fromBranch, ticketSource: "branch" };

    const fromText = matchTicket(rawText);
    if (fromText) return { ticketId: fromText, ticketSource: "text" };
  }

  return { ticketId: localTicketId(sessionId), ticketSource: "local" };
}

module.exports = { resolveTicketId };
