#!/usr/bin/env python3
"""Stop hook — the session-continuity safety net.

Fires when Claude finishes responding. If ALL of the following hold:

  1. the project opted in (a SESSION-HANDOFF.md exists at the root),
  2. the git working tree has uncommitted changes,
  3. the handoff file hasn't been touched in over 2 hours,

then it blocks the stop ONCE and asks Claude to update the handoff (or
say why not). The 2-hour quiet period and the stop_hook_active guard
prevent nagging loops. Projects without a SESSION-HANDOFF.md are never
bothered.
"""
import json
import os
import subprocess
import sys
import time

QUIET_SECONDS = 2 * 60 * 60


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    # Never block a stop that resulted from a previous block (loop guard).
    if data.get("stop_hook_active"):
        sys.exit(0)

    cwd = data.get("cwd") or os.getcwd()
    handoff = os.path.join(cwd, "SESSION-HANDOFF.md")
    if not os.path.isfile(handoff):
        sys.exit(0)

    if time.time() - os.path.getmtime(handoff) < QUIET_SECONDS:
        sys.exit(0)

    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=cwd, timeout=8,
        )
    except (OSError, subprocess.TimeoutExpired):
        sys.exit(0)

    if result.returncode != 0 or not result.stdout.strip():
        sys.exit(0)

    print(json.dumps({
        "decision": "block",
        "reason": (
            "There are uncommitted changes and SESSION-HANDOFF.md hasn't been "
            "updated in over 2 hours. Before finishing: give the pilot a one-"
            "paragraph plain-language status (what changed, what's verified, "
            "what's left), and update SESSION-HANDOFF.md so a fresh session can "
            "resume cold. If mid-task and stopping soon is not intended, update "
            "the handoff's 'Still to do' section anyway — it costs one minute."
        ),
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
