#!/usr/bin/env bash
# session-stop.sh — AROG Stop hook
# Appends 1 line to RUNNING-LOG.md. Keeps max 15 lines. Zero AI. Zero cost.

RUNNING_LOG="$HOME/.claude/memory/RUNNING-LOG.md"
mkdir -p "$(dirname "$RUNNING_LOG")"

# Read cwd from Claude Code's Stop event payload (stdin JSON)
HOOK_JSON=$(cat /dev/stdin 2>/dev/null || echo "{}")
SESSION_CWD=$(echo "$HOOK_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('cwd', d.get('session_cwd', '')))
" 2>/dev/null || echo "")

GIT_DIR="${SESSION_CWD:-$PWD}"
DATE=$(date '+%Y-%m-%d')
BRANCH=$(git -C "$GIT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BRANCH_TAIL=$(echo "$BRANCH" | awk -F'/' '{print $NF}')
CANONICAL=$(echo "$BRANCH_TAIL" | grep -oE '[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*' | head -1 || echo "")
FILES_CHANGED=$(git -C "$GIT_DIR" diff --stat HEAD~1 HEAD 2>/dev/null | tail -1 | grep -oE '[0-9]+ file' | grep -oE '[0-9]+' || echo "?")

if [ -n "$CANONICAL" ]; then
  LOG_LINE="${DATE} | ${CANONICAL} | ${BRANCH} | files: ${FILES_CHANGED}"
else
  LOG_LINE="${DATE} | ${BRANCH} | files: ${FILES_CHANGED}"
fi

echo "$LOG_LINE" >> "$RUNNING_LOG"

HEADER=$(head -1 "$RUNNING_LOG")
ENTRIES=$(tail -n +2 "$RUNNING_LOG" | grep -v '^$' | tail -15)
printf '%s\n%s\n' "$HEADER" "$ENTRIES" > "$RUNNING_LOG"

# ── Prune file-history older than 7 days ──────────────────────────────────────
FILE_HIST="$HOME/.claude/file-history"
if [ -d "$FILE_HIST" ]; then
  find "$FILE_HIST" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
fi

# ── Clean up dead IDE lock files ──────────────────────────────────────────────
IDE_DIR="$HOME/.claude/ide"
if [ -d "$IDE_DIR" ]; then
  for lock in "$IDE_DIR"/*.lock; do
    [ -f "$lock" ] || continue
    pid=$(python3 -c "import json; d=json.load(open('$lock')); print(d.get('pid',''))" 2>/dev/null || echo "")
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$lock"
    fi
  done
fi

exit 0
