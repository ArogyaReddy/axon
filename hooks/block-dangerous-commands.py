#!/usr/bin/env python3
"""PreToolUse hook (matcher: Bash).

Blocks a short, tight list of catastrophic shell commands. Deliberately
small: a guardrail that beeps wrongly gets bypassed and teaches you to
ignore it. Add patterns only after a real incident; remove ones that
only produce false positives (see guides/06-monthly-tuneup.md).

Deny = exit 0 with a JSON permissionDecision on stdout.
No match = exit 0 with no output (normal permission flow applies).
"""
import json
import re
import sys

PATTERNS = [
    # (regex, human explanation)
    (r"\brm\s+(-\w*[rR]\w*[fF]|-\w*[fF]\w*[rR])\w*\s+(/|~|\$HOME|\*|\.\s*$|\.\.)",
     "recursive force-delete aimed at a critical path (/, ~, ., *)"),
    (r"\bsudo\s+rm\b",
     "deleting files with administrator rights"),
    (r"\bgit\s+push\b.*(\s--force\b|\s-f\b)(?!-with-lease)",
     "force-push rewrites shared history; use --force-with-lease and ask the pilot first"),
    (r"\bgit\s+reset\s+--hard\b",
     "git reset --hard destroys uncommitted work; ask the pilot first"),
    (r"\bgit\s+clean\s+-\w*[fdx]",
     "git clean permanently deletes untracked files; ask the pilot first"),
    (r"\bgit\s+(checkout|restore)\s+(--\s+)?\.\s*$",
     "discarding ALL local changes at once; ask the pilot first"),
    (r"\bchmod\s+(-R\s+)?777\b",
     "chmod 777 makes files writable by everyone; a security hole"),
    (r"(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba)?sh\b",
     "piping a downloaded script straight into a shell; download and inspect first"),
    (r"\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b",
     "destructive database statement; needs the pilot's explicit GO"),
    (r"\bdd\s+[^|;&]*of=/dev/",
     "writing raw data to a device"),
    (r"\bmkfs\b",
     "formatting a filesystem"),
    (r":\(\)\s*\{\s*:\|:",
     "fork bomb"),
]


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)  # unparseable input: stay silent, never break the session

    command = (data.get("tool_input") or {}).get("command") or ""
    for pattern, why in PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        f"Safety hook blocked this command: {why}. "
                        "If this is genuinely needed, explain it to the pilot in plain "
                        "language and ask them to run it themselves or to approve an "
                        "explicit exception."
                    ),
                }
            }))
            sys.exit(0)
    sys.exit(0)


if __name__ == "__main__":
    main()
