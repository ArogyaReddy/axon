#!/usr/bin/env bash
# SessionStart hook (matcher: startup|resume|clear|compact).
#
# Injects the project's session handoff and current git state into
# Claude's context at the start of every session — so resuming cold
# requires zero discipline from the pilot. stdout from a SessionStart
# hook is added to Claude's context.
#
# Also re-injects after /clear and after context compaction, which is
# exactly when this information is most at risk of being lost.

set -u

# Only speak up inside git repositories; stay silent elsewhere.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

echo "=== Session brief (injected automatically) ==="

if [ -f "SESSION-HANDOFF.md" ]; then
  echo ""
  echo "--- SESSION-HANDOFF.md ---"
  head -c 8000 SESSION-HANDOFF.md
  echo ""
fi

echo "--- git: last 5 commits ---"
git log -5 --oneline 2>/dev/null || echo "(no commits yet)"

echo ""
echo "--- git: working tree ---"
STATUS=$(git status --porcelain 2>/dev/null | head -30)
if [ -n "$STATUS" ]; then
  echo "$STATUS"
  echo "(uncommitted changes present — reconcile with the handoff before acting)"
else
  echo "clean"
fi

echo "=== End of session brief ==="
exit 0
