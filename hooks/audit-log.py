#!/usr/bin/env python3
"""PostToolUse hook (matcher: Bash|Write|Edit|MultiEdit|NotebookEdit).

Appends one line per action to a daily audit log:
~/.claude/audit/YYYY-MM-DD.jsonl

This is the pilot's flight recorder: every command run and every file
edited, timestamped, per project. It never blocks anything. It answers
"what did Claude actually do?" with a record instead of a memory, and it
gives the monthly tune-up real data (which guardrails fired, what got
touched).

Ask Claude things like:
  "From today's audit log, list every file changed outside src/."
  "Summarize yesterday's session from the audit log, in plain language."
"""
import json
import os
import sys
import time


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool = data.get("tool_name") or "?"
    tool_input = data.get("tool_input") or {}

    if tool == "Bash":
        detail = (tool_input.get("command") or "")[:300]
    else:
        detail = tool_input.get("file_path") or tool_input.get("notebook_path") or ""

    entry = {
        "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
        "cwd": data.get("cwd") or "",
        "tool": tool,
        "detail": detail,
    }

    log_dir = os.path.expanduser("~/.claude/audit")
    try:
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, time.strftime("%Y-%m-%d") + ".jsonl")
        with open(log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass  # a broken recorder must never break the flight

    sys.exit(0)


if __name__ == "__main__":
    main()
