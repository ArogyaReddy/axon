#!/usr/bin/env bash
# arog-pre-push.sh — AROG Layer 1: run affected domain tests before push
#
# WHY: A "pilot wins" merge can silently revert feature-branch code.
#      The only way to catch this before Jenkins is to run the domain tests locally.
#      This hook detects which domains changed in the last merge commit and
#      runs their test suite. Exits 1 if any test fails — push is blocked.
#
# SKIPS:
#   - Non-adp-e-product repos (no src/<domain>/tests structure)
#   - Pushes with no changed .ts files (docs-only, config-only)
#   - If AROG_SKIP_TESTS=1 is set (emergency escape hatch — use sparingly)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
[ -z "$REPO_ROOT" ] && exit 0

# Only enforce in adp-e-product
[[ "$REPO_ROOT" != *"adp-e-product"* ]] && exit 0

# Emergency escape hatch
if [ "${AROG_SKIP_TESTS:-}" = "1" ]; then
  echo "[AROG] WARNING: AROG_SKIP_TESTS=1 — skipping domain tests. Use only in emergencies." >&2
  exit 0
fi

cd "$REPO_ROOT"

# Detect changed domains from the last N commits on this branch vs origin
# Uses the merge base so we only check what diverges from remote
REMOTE_REF=""
while IFS= read -r line; do
  REMOTE_REF=$(echo "$line" | awk '{print $2}')
done

# If nothing is being pushed (delete push), skip
[ -z "$REMOTE_REF" ] && exit 0
[ "$REMOTE_REF" = "(delete)" ] && exit 0

# Find the common ancestor between what we're pushing and the remote
LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
[ -z "$LOCAL_SHA" ] && exit 0

# Get changed .ts files since the merge base (or all staged if no remote tracking)
MERGE_BASE=$(git merge-base HEAD origin/$(git rev-parse --abbrev-ref HEAD) 2>/dev/null || echo "")

if [ -z "$MERGE_BASE" ]; then
  # No remote tracking yet — compare against HEAD~1
  CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
else
  CHANGED_FILES=$(git diff --name-only "$MERGE_BASE" HEAD 2>/dev/null || echo "")
fi

# No TS changes — nothing to test
if ! echo "$CHANGED_FILES" | grep -q '\.ts'; then
  exit 0
fi

# Detect which src/<domain>/ directories changed
CHANGED_DOMAINS=$(echo "$CHANGED_FILES" | grep '^src/' | awk -F'/' '{print $2}' | sort -u | tr '\n' ' ')

if [ -z "$CHANGED_DOMAINS" ]; then
  exit 0
fi

echo "[AROG] Pre-push: changed domains detected: $CHANGED_DOMAINS" >&2
echo "[AROG] Running domain tests before push..." >&2
echo "" >&2

FAILED_DOMAINS=""

for DOMAIN in $CHANGED_DOMAINS; do
  # Skip domains that don't have a test directory
  if [ ! -d "$REPO_ROOT/tests/$DOMAIN" ] && [ ! -d "$REPO_ROOT/src/$DOMAIN/tests" ]; then
    continue
  fi

  # Skip non-source domains (meta, i18n don't have jest suites at root)
  if [[ "$DOMAIN" == "meta" ]] || [[ "$DOMAIN" == "i18n" ]]; then
    continue
  fi

  echo "[AROG] Running: TEST_BUSINESS_DOMAIN=$DOMAIN npx jest" >&2

  if ! TEST_BUSINESS_DOMAIN="$DOMAIN" npx jest --passWithNoTests 2>&1; then
    FAILED_DOMAINS="$FAILED_DOMAINS $DOMAIN"
    echo "" >&2
    echo "[AROG] FAILED: $DOMAIN tests failed — push blocked." >&2
  else
    echo "[AROG] PASSED: $DOMAIN tests green." >&2
  fi
  echo "" >&2
done

if [ -n "$FAILED_DOMAINS" ]; then
  echo "[AROG] ─────────────────────────────────────────────────" >&2
  echo "[AROG] PUSH BLOCKED: failing domains:$FAILED_DOMAINS" >&2
  echo "[AROG] Fix the tests above, then push again." >&2
  echo "[AROG] Emergency bypass (use sparingly): AROG_SKIP_TESTS=1 git push" >&2
  echo "[AROG] ─────────────────────────────────────────────────" >&2
  exit 1
fi

echo "[AROG] All domain tests passed. Push proceeding." >&2
exit 0
