/**
 * compute-session-status.js — Gap 5: first-class session result verdict
 *
 * Closes the last two acceptance criteria on Gap 5:
 *   "Every session end: result artifact written — status open/verified/failed"
 *   "Chain complete: req -> session -> files changed -> tests run -> commit"
 *
 * computeSessionStatus({ changedFiles, testState }) -> "open"|"verified"|"failed"
 *   - no changed files                          -> "open" (nothing to verify)
 *   - changed files, no test data                -> "open"
 *   - tests ran, any failures                    -> "failed"
 *   - tests ran, zero failures, at least 1 pass   -> "verified"
 *   - tests ran, zero pass AND zero fail (ambiguous data) -> "open"
 *
 * detectBranchAndPushStatus(cwd) -> { branch, pushed }
 *   - branch: current branch name, or null if not a git repo
 *   - pushed: true (HEAD has no unpushed commits vs upstream),
 *             false (local commits ahead of upstream),
 *             null (no upstream configured / not a git repo — unknown)
 *
 * Zero AI. Fails silent/open on every git call — never blocks the session.
 */

const { execFileSync } = require("child_process");

function computeSessionStatus({ changedFiles = [], testState = null } = {}) {
  if (!changedFiles || changedFiles.length === 0) return "open";
  if (!testState || !testState.tests_ran) return "open";
  if ((testState.fail_count || 0) > 0) return "failed";
  if ((testState.pass_count || 0) > 0) return "verified";
  return "open";
}

function detectBranchAndPushStatus(cwd) {
  let branch = null;
  try {
    branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
      timeout: 3000,
    }).trim();
  } catch {
    return { branch: null, pushed: null };
  }

  let pushed = null;
  try {
    const ahead = execFileSync(
      "git",
      ["rev-list", "--count", "@{u}..HEAD"],
      { cwd, encoding: "utf8", timeout: 3000 },
    ).trim();
    pushed = parseInt(ahead, 10) === 0;
  } catch {
    // No upstream configured (or other git error) — unknown, not false.
    pushed = null;
  }

  return { branch, pushed };
}

module.exports = { computeSessionStatus, detectBranchAndPushStatus };
