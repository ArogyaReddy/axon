#!/usr/bin/env node
/**
 * ar-tracker-on-stop.js — Stop hook (runs BEFORE ar-review-on-stop.js)
 *
 * At every session Stop:
 *  1. Reads req file for this session (from session-env/YYYYMMDD/)
 *  2. Reads test-state (if still present)
 *  3. Gets changed files from git
 *  4. Infers which gap this session worked on (keyword match)
 *  5. Writes session-env/YYYYMMDD/stop-{sessionId}.json
 *
 * This is the "raw result artifact" — the permanent record of what happened.
 * ar-tracker classify gap-X <session-id>  links it to a gap in tracker.json.
 * ar-tracker build  shows all unclassified stops in the HTML dashboard.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const { buildDatedFilename } = require("./lib/format-dated-filename.js");

// ── Read Stop payload ────────────────────────────────────────────────────────
let hookData = {};
try {
  const raw = fs.readFileSync("/dev/stdin", "utf8");
  hookData = JSON.parse(raw);
} catch {
  /* proceed */
}

const sessionId = hookData.session_id || "";
if (!sessionId) process.exit(0); // nothing we can do without it

const cwd = hookData.cwd || process.cwd();
const shortId = sessionId.slice(0, 8);
const now = new Date();
// FIXED 2026-07-23: previously used now.toISOString() (UTC) here while
// ar-req-capture.js / extract-req.mjs use LOCAL date -- confirmed on this
// real machine (EDT, UTC-4) that the two disagree on "today" for ~4 hours
// every evening (e.g. 23:34 local == 03:34 UTC next day), so a stop-*.json
// and its own session's req-*.json could land in DIFFERENT dated folders.
// buildDatedFilename() uses local time, matching extract-req.mjs, so both
// files for the same session now always land in the same dated folder.
const { dateDir: dateStr } = buildDatedFilename("stop", sessionId, now);
const sessionEnvBase = path.join(os.homedir(), ".claude", "session-env");

// ── Guard: only run once per session ────────────────────────────────────────
const todayDir = path.join(sessionEnvBase, dateStr);
// FIXED 2026-07-23: stopFile's name is no longer deterministic from
// sessionId alone (it now embeds a timestamp too, so alphabetical/`find`
// order matches real chronological order -- see format-dated-filename.js).
// The "already ran" guard must therefore pattern-match by session id
// instead of checking one exact expected path.
const existingStopFile = fs.existsSync(todayDir)
  ? fs
      .readdirSync(todayDir)
      .find((f) => f.startsWith("stop-") && f.includes(sessionId))
  : null;
if (existingStopFile) process.exit(0);
const stopFile = path.join(
  todayDir,
  buildDatedFilename("stop", sessionId, now).filename,
);

// ── Find req file for this session ──────────────────────────────────────────
let reqData = null;
let reqFilePath = null;
try {
  // Search today's folder first, then any dated folder
  const searchDirs = [todayDir];
  const allDirs = fs.existsSync(sessionEnvBase)
    ? fs
        .readdirSync(sessionEnvBase)
        .filter((d) => /^\d{8}$/.test(d))
        .map((d) => path.join(sessionEnvBase, d))
        .filter((d) => d !== todayDir)
    : [];
  searchDirs.push(...allDirs);

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const match = fs
      .readdirSync(dir)
      .find(
        (f) =>
          f.startsWith("req-") && f.includes(shortId) && f.endsWith(".json"),
      );
    if (match) {
      reqFilePath = path.join(dir, match);
      reqData = JSON.parse(fs.readFileSync(reqFilePath, "utf8"));
      break;
    }
  }
} catch {
  /* no req file — session may not have had a write */
}

// ── Read activity log for this session (written by ar-activity-logger.js) ────
let testState = null;
let activityChangedFiles = [];
try {
  // Search today and any other dated dir for this session's active log
  const searchDirs = [
    todayDir,
    ...(fs.existsSync(sessionEnvBase)
      ? fs
          .readdirSync(sessionEnvBase)
          .filter((d) => /^\d{8}$/.test(d))
          .map((d) => path.join(sessionEnvBase, d))
          .filter((d) => d !== todayDir)
      : []),
  ];

  let activeLog = null;
  for (const dir of searchDirs) {
    const candidate = path.join(dir, `active-${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) {
      activeLog = candidate;
      break;
    }
  }

  if (activeLog) {
    const events = fs
      .readFileSync(activeLog, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const editEvents = events.filter((e) => e.type === "edit");
    const testEvents = events.filter((e) => e.type === "test");

    activityChangedFiles = [
      ...new Set(editEvents.map((e) => e.file).filter(Boolean)),
    ];

    if (testEvents.length > 0) {
      const lastPass = testEvents.filter((e) => e.success).length;
      const lastFail = testEvents.filter((e) => !e.success).length;
      const totalPassed = testEvents.reduce((s, e) => s + (e.passed || 0), 0);
      const totalFailed = testEvents.reduce((s, e) => s + (e.failed || 0), 0);
      // RED→GREEN: at least one failing test followed by at least one passing test
      const redGreen = testEvents.some(
        (e, i) =>
          !e.success && testEvents.slice(i + 1).some((e2) => e2.success),
      );
      testState = {
        testsRan: true,
        redGreenTransition: redGreen,
        passCount: totalPassed,
        failCount: totalFailed,
        sessionsPassed: lastPass,
        sessionsFailed: lastFail,
        source: "active-log",
      };
    }
  }

  // Fallback: old test-state-*.json (Claude Code CLI)
  if (!testState) {
    const stateFile = path.join(sessionEnvBase, `test-state-${sessionId}.json`);
    if (fs.existsSync(stateFile)) {
      testState = {
        ...JSON.parse(fs.readFileSync(stateFile, "utf8")),
        source: "test-state-file",
      };
    }
  }
} catch {
  /* never block */
}

// ── Get changed files (activity log first, git as fallback) ─────────────────
let changedFiles = activityChangedFiles;
if (!changedFiles.length) {
  try {
    const unstaged = execSync("git diff --name-only 2>/dev/null", { cwd })
      .toString()
      .trim();
    const staged = execSync("git diff --name-only --cached 2>/dev/null", {
      cwd,
    })
      .toString()
      .trim();
    changedFiles = [...unstaged.split("\n"), ...staged.split("\n")]
      .map((f) => f.trim())
      .filter((f) => f && !f.includes("node_modules") && !f.includes("/out/"))
      .filter((f, i, a) => a.indexOf(f) === i)
      .slice(0, 50);
  } catch {
    /* not a git repo */
  }
}

// ── Gap 1 self-check: alert if edits happened but no req file was captured ───
// (fixes "no self-check/alarm when the hook silently fails" — the exact
// blind spot that let the Code-Insiders path bug go unnoticed 07-19→07-22)
try {
  const { runAtStop } = require("./lib/req-capture-healthcheck.js");
  runAtStop({
    sessionId,
    hadEdits: changedFiles.length > 0,
    reqFileFound: Boolean(reqData),
  });
} catch {
  /* never block the session over a healthcheck failure */
}

// ── Infer gap from req keywords ──────────────────────────────────────────────
// Extracted to hooks/lib/infer-gap.js (2026-07-23) — fixed a real bug found
// live: a multi-topic session no longer gets falsely reported as "high"
// confidence for a single gap. See tests/infer-gap.test.js.
const { inferGap } = require("./lib/infer-gap.js");

const reqRaw = reqData?.raw || "";
const { gap: gapHint, confidence: gapHintConfidence } = inferGap(reqRaw);

// ── Gap 5: first-class result verdict + commit status ───────────────────────
// Closes "Every session end: result artifact written — status
// open/verified/failed" and the "...tests run -> commit" link in the chain.
const {
  computeSessionStatus,
  detectBranchAndPushStatus,
} = require("./lib/compute-session-status.js");

const artifactTestState = testState
  ? {
      tests_ran: testState.testsRan || false,
      red_green_transition: testState.redGreenTransition || false,
      pass_count: testState.passCount || 0,
      fail_count: testState.failCount || 0,
    }
  : null;

const status = computeSessionStatus({
  changedFiles,
  testState: artifactTestState,
});
const { branch, pushed } = detectBranchAndPushStatus(cwd);

// ── Write stop artifact ──────────────────────────────────────────────────────
const artifact = {
  session_id: sessionId,
  short_id: shortId,
  date: now.toISOString().slice(0, 10),
  timestamp: now.toISOString(),
  cwd,
  status,
  branch,
  pushed,
  req: reqData
    ? {
        file: reqFilePath,
        raw: reqData.raw || "",
        action: reqData.action || null,
        subject: reqData.subject || null,
        criteria: reqData.criteria || null,
      }
    : null,
  test_state: artifactTestState,
  changed_files: changedFiles,
  gap_hint: gapHint,
  gap_hint_confidence: gapHintConfidence,
  classified: false,
  classified_gap: null,
  classified_at: null,
};

try {
  fs.mkdirSync(todayDir, { recursive: true });
} catch {
  /* never block the session */
}

// ── Gap 5: auto-classify high-confidence sessions (closes the last manual
// step — "ar-tracker classify/close remain manual CLI steps"). Deliberately
// conservative: only fires on gap_hint_confidence === "high"; MEDIUM/LOW
// stay in the manual "unclassified" backlog. Never blocks the session.
try {
  const { autoClassifySession } = require("./lib/auto-classify.js");
  const trackerPath = path.join(
    os.homedir(),
    ".claude",
    "docs",
    "real-gaps",
    "tracker.json",
  );
  if (fs.existsSync(trackerPath)) {
    const trackerData = JSON.parse(fs.readFileSync(trackerPath, "utf8"));
    const result = autoClassifySession(trackerData, artifact);
    if (result.classified) {
      trackerData.meta.last_updated = now.toISOString().slice(0, 10);
      fs.writeFileSync(trackerPath, JSON.stringify(trackerData, null, 2));
      artifact.classified = true;
      artifact.classified_gap = result.gapId;
      artifact.classified_at = now.toISOString();
    }
  }
} catch {
  /* never block the session over auto-classify failure */
}

try {
  fs.writeFileSync(stopFile, JSON.stringify(artifact, null, 2));
} catch {
  /* never block the session */
}

process.exit(0);
