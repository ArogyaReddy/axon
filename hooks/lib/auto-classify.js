/**
 * auto-classify.js — Gap 5: automatic classification at Stop time
 *
 * Closes the last remaining manual step ("ar-tracker classify/close remain
 * manual CLI steps"): when a session's inferred gap_hint has HIGH confidence
 * (3+ keyword matches, see ar-tracker-on-stop.js's inferGap()), it is
 * automatically added to tracker.json's requirements[].sessions — the same
 * effect as running `ar-tracker classify <gap-id> <session-id>` by hand.
 *
 * Deliberately conservative: MEDIUM/LOW confidence sessions are left alone
 * (stay in the manual "unclassified" backlog for human review) to avoid
 * false-positive mis-classification — same philosophy as every other gap's
 * narrow hard-block scope decisions (Gap 1's deferred start-gate, Gap 3's
 * CRITICAL/HIGH-only block).
 *
 * autoClassifySession(trackerData, artifact) -> { classified, gapId?, reason? }
 *   Mutates trackerData in place (pushes into the matching requirement's
 *   `sessions` array) when classification happens. Never throws — unknown
 *   gap ids, missing fields, or already-classified sessions are all handled
 *   as a clean no-op with `classified: false`.
 */

function autoClassifySession(trackerData, artifact) {
  if (!artifact || !artifact.gap_hint || artifact.gap_hint_confidence !== "high") {
    return { classified: false, reason: "confidence not high" };
  }

  const gapId = artifact.gap_hint;
  const req =
    trackerData &&
    trackerData.requirements &&
    trackerData.requirements.find((r) => r.id === gapId);
  if (!req) {
    return { classified: false, reason: "unknown gap id: " + gapId };
  }

  const sessionId = artifact.session_id;
  const shortId = String(sessionId || "").slice(0, 8);
  const already = (req.sessions || []).some(
    (s) => s.session_id === sessionId || s.session_id.startsWith(shortId),
  );
  if (already) {
    return { classified: false, reason: "already classified" };
  }

  const verified = artifact.status === "verified";
  const evidence = artifact.test_state
    ? artifact.test_state.tests_ran
      ? "Tests: " +
        (artifact.test_state.pass_count || 0) +
        "P/" +
        (artifact.test_state.fail_count || 0) +
        "F"
      : "No tests ran"
    : "No test data";

  req.sessions = req.sessions || [];
  req.sessions.push({
    session_id: sessionId,
    date: artifact.date,
    what_done: artifact.req ? String(artifact.req.raw || "").slice(0, 200) : "(no req captured)",
    verified,
    evidence,
  });

  return { classified: true, gapId };
}

module.exports = { autoClassifySession };
