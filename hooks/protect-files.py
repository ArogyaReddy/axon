#!/usr/bin/env python3
"""PreToolUse hook (matcher: Write|Edit|MultiEdit|NotebookEdit).

Blocks edits to files on the project's risk map. Two sources:

1. Built-in defaults: secrets and credential files.
2. The project's `.claude/protected-paths.txt` — one glob per line,
   relative to the project root. Lines starting with # are comments.
   Created by /risk-map or by hand.

A blocked edit is not a dead end: the deny reason tells Claude to ask
the pilot, who can approve by editing the file list or making the
change themselves.
"""
import fnmatch
import json
import os
import sys

DEFAULT_PATTERNS = [
    ".env", ".env.*", "*.pem", "*.key",
    "**/.env", "**/.env.*", "**/*.pem", "**/*.key",
    "**/secrets/**", "**/credentials*",
]


def load_project_patterns(cwd: str) -> list[str]:
    path = os.path.join(cwd, ".claude", "protected-paths.txt")
    patterns: list[str] = []
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    patterns.append(line)
    except OSError:
        pass
    return patterns


def matches(rel_path: str, pattern: str) -> bool:
    rel_path = rel_path.lstrip("./")
    pattern = pattern.lstrip("./")
    if fnmatch.fnmatch(rel_path, pattern):
        return True
    # "dir/**" should also protect the directory's direct children
    if pattern.endswith("/**") and fnmatch.fnmatch(rel_path, pattern[:-3] + "/*"):
        return True
    return fnmatch.fnmatch(os.path.basename(rel_path), pattern)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_input = data.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if not file_path:
        sys.exit(0)

    cwd = data.get("cwd") or os.getcwd()
    rel = os.path.relpath(os.path.abspath(file_path), os.path.abspath(cwd))

    for pattern in DEFAULT_PATTERNS + load_project_patterns(cwd):
        if matches(rel, pattern):
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        f"'{rel}' is protected (pattern '{pattern}' — risk map or "
                        "secrets default). Explain to the pilot in plain language what "
                        "change is needed and why. They can make it themselves, or "
                        "approve an exception by editing .claude/protected-paths.txt."
                    ),
                }
            }))
            sys.exit(0)
    sys.exit(0)


if __name__ == "__main__":
    main()
