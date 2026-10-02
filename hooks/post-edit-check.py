#!/usr/bin/env python3
"""PostToolUse hook (matcher: Write|Edit|MultiEdit).

Instant syntax check after every file edit. Catches broken files the
moment they are written, instead of at the next run. On failure, exit
code 2 feeds the error straight back to Claude, which fixes it
immediately.

Fast checks only (aims for well under a second). Full test suites belong in
/ship and CI, not on every keystroke.
"""
import json
import os
import shutil
import subprocess
import sys


def check_python(path: str) -> str | None:
    import py_compile
    try:
        py_compile.compile(path, doraise=True)
    except py_compile.PyCompileError as exc:
        return str(exc)
    return None


def check_node(path: str) -> str | None:
    node = shutil.which("node")
    if not node:
        return None  # no Node on this machine: silently skip
    result = subprocess.run(
        [node, "--check", path], capture_output=True, text=True, timeout=20
    )
    return result.stderr.strip() if result.returncode != 0 else None


def check_json(path: str) -> str | None:
    try:
        with open(path, encoding="utf-8") as fh:
            json.load(fh)
    except (json.JSONDecodeError, ValueError) as exc:
        return str(exc)
    return None


def check_shell(path: str) -> str | None:
    bash = shutil.which("bash")
    if not bash:
        return None
    result = subprocess.run(
        [bash, "-n", path], capture_output=True, text=True, timeout=20
    )
    return result.stderr.strip() if result.returncode != 0 else None


CHECKERS = {
    ".py": check_python,
    ".js": check_node,
    ".mjs": check_node,
    ".cjs": check_node,
    ".json": check_json,
    ".sh": check_shell,
    ".bash": check_shell,
}


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    file_path = (data.get("tool_input") or {}).get("file_path") or ""
    if not file_path or not os.path.isfile(file_path):
        sys.exit(0)

    checker = CHECKERS.get(os.path.splitext(file_path)[1].lower())
    if not checker:
        sys.exit(0)

    try:
        error = checker(file_path)
    except Exception:
        sys.exit(0)  # a broken checker must never block real work

    if error:
        print(
            f"Syntax check failed for {file_path}:\n{error}\n"
            "Fix this file before doing anything else.",
            file=sys.stderr,
        )
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
