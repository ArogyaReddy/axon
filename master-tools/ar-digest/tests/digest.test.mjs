#!/usr/bin/env node
/**
 * digest.test.mjs
 *
 * Unit tests for ar-digest's pure aggregation logic — combines sessions
 * (sessions.jsonl), Command Center decisions, and My Work's already-fetched
 * JIRA/PR data into one work digest, filtered by a time window. Zero AI,
 * zero new API calls (reuses data already written to disk by
 * capture-sessions / ar-morning-brief / Command Center).
 *
 * Entry points under test: resolveWindow, filterSessionsSince,
 * filterDecisionsSince, buildDigest, formatDigestText — all pure functions.
 *
 * Run: node ~/.claude/master-tools/ar-digest/tests/digest.test.mjs
 */

import assert from "assert";
import {
  resolveWindow,
  filterSessionsSince,
  filterDecisionsSince,
  buildDigest,
  formatDigestText,
} from "../lib/digest.mjs";

const NOW = new Date("2026-08-02T12:00:00Z").getTime();

function test_resolveWindow_maps_known_labels_to_a_cutoff_date() {
  assert.strictEqual(resolveWindow("today", NOW).cutoff, "2026-08-02");
  assert.strictEqual(resolveWindow("yesterday", NOW).cutoff, "2026-08-01");
  assert.strictEqual(resolveWindow("week", NOW).cutoff, "2026-07-26");
  assert.strictEqual(resolveWindow("month", NOW).cutoff, "2026-07-03");
  console.log("PASS: resolveWindow maps today/yesterday/week/month to the right cutoff date");
}

function test_resolveWindow_defaults_to_week_for_unknown_label() {
  assert.strictEqual(resolveWindow("bogus", NOW).label, "week");
  assert.strictEqual(resolveWindow(undefined, NOW).label, "week");
  console.log("PASS: resolveWindow defaults to 'week' for an unknown/missing label");
}

function test_filterSessionsSince_keeps_only_sessions_on_or_after_cutoff() {
  const sessions = [
    { date: "2026-08-02", files_written: 3 },
    { date: "2026-07-30", files_written: 2 },
    { date: "2026-07-01", files_written: 1 },
  ];
  const result = filterSessionsSince(sessions, "2026-07-26");
  assert.strictEqual(result.length, 2, "must keep only the 2 sessions on/after the cutoff");
  console.log("PASS: filterSessionsSince keeps only sessions on/after the cutoff date");
}

function test_filterDecisionsSince_keeps_only_decisions_on_or_after_cutoff() {
  const decisions = [
    { id: "DEC-001", date: "2026-07-24", title: "old decision" },
    { id: "DEC-005", date: "2026-08-02", title: "recent decision" },
  ];
  const result = filterDecisionsSince(decisions, "2026-07-26");
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, "DEC-005");
  console.log("PASS: filterDecisionsSince keeps only decisions on/after the cutoff date");
}

function test_buildDigest_combines_sessions_decisions_and_my_work_data() {
  const sessions = [
    { date: "2026-08-02", files_written: 3 },
    { date: "2026-07-01", files_written: 99 }, // outside window -- must not count
  ];
  const decisions = [{ id: "DEC-005", date: "2026-08-02", title: "recent decision" }];
  const myWorkData = {
    tickets: [
      { key: "T-1", prStatus: null },
      { key: "T-2", prStatus: { state: "merged" } },
    ],
    prs: [{ id: 1 }],
    mergedPrs: [
      { id: 2, createdOn: "2026-08-01T00:00:00Z" },
      { id: 3, createdOn: "2026-01-01T00:00:00Z" }, // outside window
    ],
  };
  const digest = buildDigest({ sessions, decisions, myWorkData }, "2026-07-26", "week");
  assert.strictEqual(digest.sessionCount, 1, "only the in-window session counts");
  assert.strictEqual(digest.filesTouched, 3, "must sum files_written only from in-window sessions");
  assert.strictEqual(digest.decisions.length, 1);
  assert.strictEqual(digest.recentMergedPrCount, 1, "only the in-window merged PR counts");
  assert.strictEqual(digest.ticketsInFlight, 1, "only tickets with no prStatus count as in-flight");
  assert.strictEqual(digest.openPrCount, 1);
  console.log("PASS: buildDigest correctly combines and window-filters sessions/decisions/My Work data");
}

function test_buildDigest_handles_missing_data_safely() {
  const digest = buildDigest({}, "2026-07-26", "week");
  assert.strictEqual(digest.sessionCount, 0);
  assert.strictEqual(digest.filesTouched, 0);
  assert.deepStrictEqual(digest.decisions, []);
  assert.strictEqual(digest.ticketsInFlight, 0);
  console.log("PASS: buildDigest handles missing sessions/decisions/myWorkData without throwing");
}

function test_buildDigest_excludes_known_code_review_tracking_tickets() {
  const myWorkData = {
    tickets: [
      { key: "T-1", title: "Real feature work", prStatus: null },
      { key: "T-2", title: "Code Review: organizationPolicy.* (PILOT ack-tasks)", prStatus: null },
    ],
  };
  const digest = buildDigest({ myWorkData }, "2026-07-26", "week");
  assert.strictEqual(digest.ticketsInFlight, 1, "'Code Review: ...' tracking tickets are a documented non-bug exception (Chapter 11, S5) -- must match suggestions-panel.js's same exclusion");
  console.log("PASS: buildDigest excludes known 'Code Review: ...' tracking tickets, consistent with the Suggestions tab");
}

function test_formatDigestText_includes_key_numbers_and_decisions() {
  const digest = buildDigest(
    {
      sessions: [{ date: "2026-08-02", files_written: 3 }],
      decisions: [{ id: "DEC-005", date: "2026-08-02", title: "recent decision" }],
      myWorkData: { tickets: [], prs: [], mergedPrs: [] },
    },
    "2026-07-26",
    "week",
  );
  const text = formatDigestText(digest);
  assert.ok(text.includes("week"), "must mention the window label");
  assert.ok(text.includes("Sessions: 1"), "must include the session count");
  assert.ok(text.includes("recent decision"), "must list the actual decision title");
  console.log("PASS: formatDigestText renders window label, counts, and decision titles");
}

function test_formatDigestText_says_none_when_no_decisions_in_window() {
  const digest = buildDigest({ sessions: [], decisions: [], myWorkData: {} }, "2026-07-26", "week");
  const text = formatDigestText(digest);
  assert.ok(text.toLowerCase().includes("none in this window"), "must say plainly when there are no decisions, not omit the line");
  console.log("PASS: formatDigestText says 'none in this window' rather than omitting the line");
}

const tests = [
  test_resolveWindow_maps_known_labels_to_a_cutoff_date,
  test_resolveWindow_defaults_to_week_for_unknown_label,
  test_filterSessionsSince_keeps_only_sessions_on_or_after_cutoff,
  test_filterDecisionsSince_keeps_only_decisions_on_or_after_cutoff,
  test_buildDigest_combines_sessions_decisions_and_my_work_data,
  test_buildDigest_handles_missing_data_safely,
  test_buildDigest_excludes_known_code_review_tracking_tickets,
  test_formatDigestText_includes_key_numbers_and_decisions,
  test_formatDigestText_says_none_when_no_decisions_in_window,
];

let failed = 0;
for (const t of tests) {
  try {
    t();
  } catch (e) {
    failed++;
    console.error(`FAIL: ${t.name}: ${e.message}`);
  }
}
if (failed) {
  console.error(`\n${failed}/${tests.length} tests FAILED`);
  process.exit(1);
} else {
  console.log(`\nAll ${tests.length} tests PASSED`);
}
