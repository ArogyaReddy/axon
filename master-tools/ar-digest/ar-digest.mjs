#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * TOOL:    ar-digest
 * LAYER:   daily-ops
 * VERSION: 1.0.0
 * ═══════════════════════════════════════════════════════════════════
 *
 * WHAT:
 *   Combines sessions.jsonl (capture-sessions/ar-session-log), Command
 *   Center's decisions log, and My Work's already-fetched JIRA/PR data
 *   into one "what did I do" digest, filtered by a time window.
 *
 * WHY:
 *   Closes gap G2 from docs/plans/arog-vision-gaps-2026-08-02.plan.md —
 *   there was no capability spanning sessions + tickets + PRs + decisions
 *   together (chronicle covers VS Code chat sessions alone, on request
 *   only). Zero AI, zero new API calls -- every input is a file some
 *   other zero-AI tool already wrote. AI only enters when a skill/agent
 *   narrates this tool's plain output in chat -- never spontaneously.
 *
 * USAGE:
 *   node ar-digest.mjs [--since today|yesterday|week|month] [--json]
 *
 * EXPECTED OUTCOME:
 *   A plain-text (or --json) summary: session/file counts, PRs merged in
 *   the window, currently-open PRs, tickets still without a linked PR,
 *   and decisions logged in the window.
 * ═══════════════════════════════════════════════════════════════════
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { resolveWindow, buildDigest, formatDigestText } from "./lib/digest.mjs";

const CLAUDE_DIR = join(homedir(), ".claude");
const SESSIONS_JSONL_PATH = join(CLAUDE_DIR, "docs", "sessions", "sessions.jsonl");
const COMMAND_CENTER_PATH = join(CLAUDE_DIR, "docs", "command-center.json");
const SNAPSHOT_PATH = join(CLAUDE_DIR, "STATE-SNAPSHOT.json");

function loadSessions() {
  if (!existsSync(SESSIONS_JSONL_PATH)) return [];
  return readFileSync(SESSIONS_JSONL_PATH, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null; // one malformed line must never crash the whole digest
      }
    })
    .filter(Boolean);
}

function loadDecisions() {
  if (!existsSync(COMMAND_CENTER_PATH)) return [];
  try {
    return JSON.parse(readFileSync(COMMAND_CENTER_PATH, "utf8")).decisions ?? [];
  } catch {
    return [];
  }
}

function loadMyWorkData() {
  if (!existsSync(SNAPSHOT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return {};
  }
}

function main() {
  const args = process.argv.slice(2);
  const sinceIdx = args.indexOf("--since");
  const windowArg = sinceIdx !== -1 ? args[sinceIdx + 1] : "week";
  const asJson = args.includes("--json");

  const { cutoff, label } = resolveWindow(windowArg);
  const digest = buildDigest(
    { sessions: loadSessions(), decisions: loadDecisions(), myWorkData: loadMyWorkData() },
    cutoff,
    label,
  );

  console.log(asJson ? JSON.stringify(digest, null, 2) : formatDigestText(digest));
}

main();
