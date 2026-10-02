#!/usr/bin/env node
/**
 * ar-review-on-stop.js — Stop hook
 *
 * Triggers after every Claude session Stop.
 * Checks if any source files were written/edited this session.
 * If yes: prints a system-reminder block that tells Claude to run /ar-review.
 *
 * This hook outputs to stdout → Claude Code shows it as a system message.
 * It does NOT spawn an agent directly (hooks can't do that) — instead it
 * injects a reminder that Claude reads at Stop time, prompting ar-review.
 *
 * The actual review happens in the next session's SessionStart OR when
 * user invokes /ar-review manually.
 *
 * For real-time review during a session: the PostToolUse hook below
 * tracks what was changed and flags when review is warranted.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Read hook JSON from stdin
let hookData = {};
try {
  const raw = fs.readFileSync("/dev/stdin", "utf8");
  hookData = JSON.parse(raw);
} catch {
  // no stdin data — proceed anyway
}

const cwd = hookData.cwd || process.cwd();
const sessionId = hookData.session_id || "unknown";

// ── Detect what changed this session ──────────────────────────────────────

let changedFiles = [];
try {
  // Only check the CURRENT SESSION's uncommitted changes — not historical commits.
  // Using HEAD~1..HEAD causes a false-positive on every Stop after any commit.
  const unstaged = execSync("git diff --name-only 2>/dev/null", { cwd })
    .toString()
    .trim();
  const staged = execSync("git diff --name-only --cached 2>/dev/null", { cwd })
    .toString()
    .trim();

  changedFiles = [unstaged, staged]
    .filter(Boolean)
    .flatMap((s) => s.split("\n"))
    .filter(
      (f) =>
        f.trim() &&
        (f.endsWith(".ts") ||
          f.endsWith(".tsx") ||
          f.endsWith(".js") ||
          f.endsWith(".mjs")),
    )
    .filter((f) => !f.includes("/out/") && !f.includes("node_modules")) // exclude build artifacts
    .filter((f, i, arr) => arr.indexOf(f) === i) // dedupe
    .slice(0, 50); // cap at 50 to avoid giant outputs
} catch {
  // git not available or no changes
}

// ── Write a marker file so next session knows review is pending ─────────────

const markerDir = path.join(os.homedir(), ".claude", "ar-review-queue");
fs.mkdirSync(markerDir, { recursive: true });

if (changedFiles.length > 0) {
  const marker = {
    sessionId,
    timestamp: new Date().toISOString(),
    cwd,
    changedFiles,
    reviewPending: true,
  };
  fs.writeFileSync(
    path.join(markerDir, `pending-${Date.now()}.json`),
    JSON.stringify(marker, null, 2),
  );
}

// ── Check test state for this session ──────────────────────────────────────

const stateFile = path.join(
  os.homedir(),
  ".claude",
  "session-env",
  `test-state-${sessionId}.json`,
);
let testState = null;
try {
  testState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
} catch {}

const tsChanged = changedFiles.filter(
  (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
);
const noTestsRan = !testState || !testState.testsRan;
const noRedGreen =
  testState && testState.testsRan && !testState.redGreenTransition;

// Clean up test-state marker — per-session, no longer needed after Stop
try {
  fs.unlinkSync(stateFile);
} catch {}

// ── Emit system message ────────────────────────────────────────────

if (changedFiles.length > 0) {
  const contentLines = [];

  // CRITICAL: .ts files changed but ZERO tests run all session
  if (tsChanged.length > 0 && noTestsRan) {
    contentLines.push(
      `⛔ NO TESTS RUN — ${tsChanged.length} TypeScript file(s) changed with zero test execution.`,
    );
    contentLines.push(
      `This does not meet DONE_VERIFIED. Before claiming done, run:`,
    );
    contentLines.push(
      `  TEST_BUSINESS_DOMAIN=<domain> npx jest <path/to/spec.ts> --no-coverage`,
    );
    contentLines.push(``);
  }

  // Warning: tests ran but no RED→GREEN transition seen this session
  if (tsChanged.length > 0 && !noTestsRan && noRedGreen) {
    contentLines.push(
      `⚠️  TESTS RAN — but no RED→GREEN cycle detected this session.`,
    );
    contentLines.push(
      `Tests written after code prove nothing about TDD. Run tests BEFORE the fix (RED), then after (GREEN).`,
    );
    contentLines.push(``);
  }

  // This stdout is read by Claude Code's Stop hook system
  contentLines.push(
    `[AR-REVIEW] ${changedFiles.length} file(s) changed this session.`,
  );
  contentLines.push(
    `Changed: ${changedFiles.slice(0, 5).join(", ")}${changedFiles.length > 5 ? ` +${changedFiles.length - 5} more` : ""}`,
  );
  contentLines.push(`Run /ar-review to audit the work before shipping.`);
  contentLines.push(
    `Report will be written to ~/.claude/docs/reviews/ar-review-*.md`,
  );

  // ── Requirement criteria coverage ────────────────────────────────────────
  const reqFile = path.join(
    os.homedir(),
    ".claude",
    "session-env",
    `req-${sessionId}.json`,
  );
  try {
    const req = JSON.parse(fs.readFileSync(reqFile, "utf8"));
    if (req.criteria && req.criteria.length > 0) {
      // Check how many criteria appear (by keyword) in changed spec files
      const specFiles = changedFiles.filter(
        (f) => f.includes(".spec.") || f.includes(".test."),
      );
      let specContent = "";
      for (const sf of specFiles) {
        try {
          specContent += fs.readFileSync(path.join(cwd, sf), "utf8");
        } catch {}
      }

      const covered = req.criteria.filter((c) => {
        // check if key words from each criterion appear in spec content
        const keywords = c
          .toLowerCase()
          .replace(/[()→]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3);
        return keywords.some((kw) => specContent.toLowerCase().includes(kw));
      });

      const pct = Math.round((covered.length / req.criteria.length) * 100);
      contentLines.push(``);
      contentLines.push(
        `📋 REQUIREMENT: "${req.raw.slice(0, 80)}${req.raw.length > 80 ? "…" : ""}"`,
      );
      contentLines.push(
        `   Criteria coverage: ${covered.length}/${req.criteria.length} (${pct}%) ${pct === 100 ? "✅" : pct >= 50 ? "⚠️" : "❌"}`,
      );
      req.criteria.forEach((c, i) => {
        const tick = covered.includes(c) ? "✅" : "❌";
        contentLines.push(`   ${tick} ${c}`);
      });
      if (pct < 100) {
        contentLines.push(
          `   → Add tests for uncovered criteria before DONE_VERIFIED.`,
        );
      }
    }
  } catch {
    // no req file — session predates requirement capture, or first write hasn't fired
  }

  // ── Hole A: Test-first ORDER check ──────────────────────────────────────
  // For each .ts source file changed, verify the paired .spec.ts existed first.
  // Uses git timestamps for committed files, filesystem mtime as fallback.
  const sourceFiles = tsChanged.filter(
    (f) => !f.includes(".spec.") && !f.includes(".test."),
  );

  function getFileFirstMs(relPath) {
    try {
      const ts = execSync(
        `git log --format="%at" --diff-filter=A -- "${relPath}" 2>/dev/null`,
        { cwd, encoding: "utf8" },
      )
        .trim()
        .split("\n")[0];
      if (ts && !isNaN(Number(ts))) return Number(ts) * 1000;
    } catch {}
    try {
      return fs.statSync(path.join(cwd, relPath)).mtimeMs;
    } catch {}
    return null;
  }

  const orderViolations = [];
  for (const srcFile of sourceFiles) {
    const base = path.basename(srcFile, ".ts");
    const dir = path.dirname(srcFile);
    const candidates = [
      path.join(dir, `${base}.spec.ts`),
      path.join(dir, `${base}.test.ts`),
      path.join(dir, "__tests__", `${base}.spec.ts`),
      // adp-e-product pattern: src/domain/events/noun.verb/handler.ts → tests/.../handler.spec.ts
      srcFile.replace("/src/", "/tests/").replace(".ts", ".spec.ts"),
    ];
    const specFile = candidates.find((c) => {
      try {
        fs.accessSync(path.join(cwd, c));
        return true;
      } catch {
        return false;
      }
    });

    if (!specFile) {
      orderViolations.push({ srcFile, reason: "no paired .spec.ts found" });
      continue;
    }
    const srcMs = getFileFirstMs(srcFile);
    const specMs = getFileFirstMs(specFile);
    if (srcMs && specMs && srcMs < specMs) {
      orderViolations.push({
        srcFile,
        reason: `source written before spec (${path.basename(specFile)}) — code-first ≠ TDD`,
      });
    }
  }

  if (orderViolations.length > 0) {
    contentLines.push(``);
    contentLines.push(
      `⚠️  TEST-FIRST VIOLATIONS — ${orderViolations.length} file(s) written before their spec:`,
    );
    orderViolations.forEach((v) =>
      contentLines.push(`   ❌ ${v.srcFile}: ${v.reason}`),
    );
    contentLines.push(
      `   → Spec must exist BEFORE source. Write the failing test first (RED).`,
    );
  }

  // ── Parking lot — show today's deferred items ──────────────────────────
  const parkingLotFile = path.join(
    os.homedir(),
    ".claude",
    "docs",
    "my-notes",
    "parking-lot.md",
  );
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const parkContent = fs.readFileSync(parkingLotFile, "utf8");
    const todaySection = parkContent.match(
      new RegExp(`## ${today}\\n([\\s\\S]*?)(?=\\n## |$)`),
    );
    if (todaySection) {
      const items = todaySection[1]
        .split("\n")
        .filter((l) => l.startsWith("- "));
      if (items.length > 0) {
        contentLines.push(``);
        contentLines.push(
          `📌 PARKING LOT — ${items.length} item(s) deferred today:`,
        );
        items.forEach((item) => contentLines.push(`  ${item}`));
        contentLines.push(
          `  → Review: ~/.claude/docs/my-notes/parking-lot.md  (add items: ar-park-log "topic")`,
        );
      }
    }
  } catch {
    // parking lot file missing — silent
  }

  // ── Hard block (Gap 3, 2026-07-23) — single narrowest, highest-confidence
  // condition: .ts/.tsx changed this session AND zero test executions
  // recorded. Every other check above (RED→GREEN, criteria coverage,
  // test-order violations, parking lot) stays informational only — this is
  // the one case directly tied to the original triggering incident (DONE
  // claimed without running tests), chosen deliberately narrow to avoid
  // false lockouts on read-only/doc-only sessions (which never trip
  // tsChanged). See docs/plans/gap3-background-monitor-hard-gates.plan.md.
  const hardBlock = tsChanged.length > 0 && noTestsRan;
  const output = {
    type: "system",
    content: contentLines.join("\n"),
  };
  if (hardBlock) {
    output.decision = "block";
    output.reason = `${tsChanged.length} TypeScript file(s) changed with zero test execution this session. Run tests before ending: TEST_BUSINESS_DOMAIN=<domain> npx jest <path/to/spec.ts> --no-coverage`;
  }

  process.stdout.write(JSON.stringify(output));
}

process.exit(0);

