/**
 * infer-gap.js — Gap 5: keyword-based gap inference for auto-classify
 *
 * Extracted from hooks/ar-tracker-on-stop.js (2026-07-23) to make it
 * independently testable, and FIXED at the same time: a real bug found
 * live during an end-to-end framework test — a session that genuinely
 * touched ALL 5 gaps was auto-classified as one single gap with HIGH
 * confidence, because the original logic only looked at the top-scoring
 * gap and never checked whether a close second-place gap also scored
 * meaningfully (i.e., whether the message was actually ambiguous).
 *
 * inferGap(text) -> { gap, confidence } where confidence is
 * "high" | "medium" | "low" | "none". "high" is now ONLY returned when
 * the top gap has both a strong score (>=3 keyword hits) AND a clear
 * lead over the second-place gap — an ambiguous multi-topic message is
 * downgraded to "medium" (or lower) so hooks/lib/auto-classify.js
 * correctly leaves it in the manual backlog instead of confidently
 * mis-classifying it.
 */

const GAP_KEYWORDS = {
  "gap-1": [
    "requirement",
    "req-capture",
    "ar-req",
    "first message",
    "ar-req-capture",
    "hook timeout",
    "start gate",
    "capture goal",
    "session goal",
  ],
  "gap-2": [
    "session log",
    "capture-sessions",
    "sessions.jsonl",
    "outcome log",
    "session outcome",
    "what changed",
    "what happened",
  ],
  "gap-3": [
    "warning",
    "exit 1",
    "gate",
    "block",
    "behavioral",
    "test gate",
    "no tests",
    "ar-done-check",
    "ar-review-on-stop",
    "hard block",
  ],
  "gap-4": [
    "history",
    "dashboard",
    "rollup",
    "monthly report",
    "historical",
    "trend",
    "metrics",
  ],
  "gap-5": [
    "traceab",
    "tracker",
    "connect the dots",
    "gap-5",
    "requirement-to-outcome",
    "ar-tracker",
    "result artifact",
    "what's working",
    "overall status",
  ],
};

function inferGap(text) {
  if (!text) return { gap: null, confidence: "none" };
  const lower = text.toLowerCase();
  const scores = {};
  for (const [gap, keywords] of Object.entries(GAP_KEYWORDS)) {
    scores[gap] = keywords.filter((k) => lower.includes(k)).length;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestGap, bestScore] = sorted[0];
  const secondScore = sorted[1] ? sorted[1][1] : 0;

  if (!bestScore) return { gap: null, confidence: "none" };

  // Ambiguous: a different gap ALSO scored meaningfully close to the top
  // gap — this is a multi-topic message, not a clean single-gap match.
  const ambiguous = secondScore >= 2 && secondScore >= bestScore - 1;

  let confidence;
  if (bestScore >= 3 && !ambiguous) confidence = "high";
  else if (bestScore >= 2) confidence = "medium";
  else confidence = "low";

  return { gap: bestGap, confidence };
}

module.exports = { inferGap, GAP_KEYWORDS };
