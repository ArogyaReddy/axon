#!/bin/bash
# =============================================================================
# PRE-TOOL-USE HOOK
# Runs before Claude executes any tool.
# Purpose: Validate scope, block dangerous operations, log intent.
# Claude Code passes hook data as JSON via stdin — parse that, not env vars.
# =============================================================================

LOG_DIR="${HOME}/.claude/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/tool-use.log"

# Read JSON payload from stdin
HOOK_JSON=$(cat)

# Parse fields from stdin JSON (single-pass jq for sub-5ms speed)
PARSED=$(echo "$HOOK_JSON" | jq -r '[.tool_name // "unknown", ((.tool_input.command // .tool_input.file_path // (.tool_input | tostring)) | .[0:300])] | @tsv' 2>/dev/null)
TOOL_NAME=$(echo "$PARSED" | cut -f1)
TOOL_INPUT=$(echo "$PARSED" | cut -f2-)
[ -z "$TOOL_NAME" ] && TOOL_NAME="unknown"


timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

log() {
  echo "[$(timestamp)] PRE  | $TOOL_NAME | $1" >> "$LOG_FILE"
}

# =============================================================================
# BLOCK: Dangerous bash commands (covers Bash AND run_in_terminal)
# =============================================================================
if [ "$TOOL_NAME" = "Bash" ] || [ "$TOOL_NAME" = "run_in_terminal" ]; then

  # ── Symlink Guard ── block rm on paths that are symlinks ──────────────────
  # Extracts path argument from rm commands and checks if it is a symlink.
  # Prevents "rm -rf symlink/" from destroying the symlink target.
  if echo "$TOOL_INPUT" | grep -qE '^\s*rm\s'; then
    RM_PATH=$(echo "$TOOL_INPUT" | grep -oE 'rm\s+(-[a-zA-Z]+\s+)*[^ ]+' | awk '{print $NF}' | head -1)
    EXPANDED_PATH=$(eval "echo $RM_PATH" 2>/dev/null || echo "")
    if [ -n "$EXPANDED_PATH" ] && [ -L "$EXPANDED_PATH" ]; then
      echo "🚫 HOOK BLOCKED [SYMLINK GUARD]: rm target is a symlink: $EXPANDED_PATH"
      echo "   Deleting a symlink path with rm -rf follows the link and destroys the TARGET."
      echo "   To remove a symlink safely, use: unlink $EXPANDED_PATH"
      echo "   To remove what it points to (if intentional), run manually after confirming."
      log "BLOCKED [SYMLINK GUARD] — rm on symlink: $EXPANDED_PATH"
      exit 1
    fi
  fi

  DANGEROUS_PATTERNS=(
    "rm -rf"
    "rm -f /"
    "DROP TABLE"
    "DROP DATABASE"
    "TRUNCATE"
    "git push --force"
    "git push -f"
    "chmod 777"
    "sudo rm"
    "> /dev/sda"
    "mkfs"
    "dd if="
    "curl.*| bash"
    "wget.*| bash"
    "eval \$("
  )

  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$TOOL_INPUT" | grep -qi "$pattern"; then
      echo "HOOK BLOCKED: Dangerous pattern detected: '$pattern'"
      echo "If this is intentional, run it manually outside Claude Code."
      log "BLOCKED — pattern: $pattern"
      exit 1
    fi
  done

  # Warn on production env operations
  if echo "$TOOL_INPUT" | grep -qi "NODE_ENV=production\|--env=production\|env prod"; then
    echo "HOOK WARNING: Production environment operation detected."
    echo "Confirm this is intentional before proceeding."
    log "WARNED — production env operation"
  fi

  log "ALLOWED — $TOOL_INPUT"
fi

# =============================================================================
# BLOCK: Writing test files without behavioral test approval
# If AI tries to create a .test.ts / .spec.ts / .test.tsx / .spec.tsx file,
# it MUST have posted a TEST APPROVAL REQUEST and the user must have approved.
# Approval is tracked by: ~/.claude/.test-approval-this-session
# =============================================================================
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "create_file" ]; then
  if echo "$TOOL_INPUT" | grep -qE '\.(test|spec)\.(ts|tsx|js|jsx)'; then
    if [ ! -f "${HOME}/.claude/.test-approval-this-session" ]; then
      echo "🚫 HOOK BLOCKED: Cannot write test file without behavioral test approval."
      echo ""
      echo "You must post a TEST APPROVAL REQUEST first:"
      echo "  TEST APPROVAL REQUEST"
      echo "  ─────────────────────────────────────────────"
      echo "  ENTRY-POINT:   [real class/function/lambda — not a formatter/mapper]"
      echo "  MOCK-BOUNDARY: [what I/O will be mocked: shell, HTTP, DB, filesystem]"
      echo "  IS-BEHAVIORAL: [yes — will call real entry point, mock I/O, assert side effect]"
      echo "  ─────────────────────────────────────────────"
      echo ""
      echo "After user says YES, create ~/.claude/.test-approval-this-session then proceed."
      log "BLOCKED — test file write without approval: $TOOL_INPUT"
      exit 1
    else
      # Approval exists — but still scan the content for behavioral quality
      SCANNER="$HOME/.claude/scripts/scan-test-quality.mjs"
      if [ -f "$SCANNER" ]; then
        # Write to a temp file and scan it
        CONTENT=$(echo "$HOOK_JSON" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', d)
    if isinstance(ti, str):
        ti = json.loads(ti)
    print(ti.get('content', ti.get('new_string', '')))
except Exception:
    pass
" 2>/dev/null)
        if [ -n "$CONTENT" ]; then
          TMPFILE="/tmp/pre-tool-scan-$$.test.ts"
          echo "$CONTENT" > "$TMPFILE"
          SCAN_STATUS=0
          SCAN_OUT=$(node "$SCANNER" "$TMPFILE" 2>&1) || SCAN_STATUS=$?
          rm -f "$TMPFILE"
          if [ "$SCAN_STATUS" -ne 0 ]; then
            echo "🚫 HOOK BLOCKED: Test file has no behavioral assertions."
            echo "$SCAN_OUT"
            echo ""
            echo "Rewrite with: mock I/O boundary + call real entry point + assert side effect"
            log "BLOCKED — structural-only test file (scanner exit $SCAN_STATUS): $TOOL_INPUT"
            exit 1
          fi
        fi
      fi
      log "ALLOWED — test file write (approved + scanner passed): $TOOL_INPUT"
    fi
  fi
fi

# =============================================================================
# BLOCK: Writing to .env files
# =============================================================================
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ]; then

  if echo "$TOOL_INPUT" | grep -q '\.env'; then
    echo "HOOK BLOCKED: Modifications to .env files are not permitted via Claude."
    echo "Edit .env files manually."
    log "BLOCKED — .env write attempt"
    exit 1
  fi

  # Warn on writing to config files
  if echo "$TOOL_INPUT" | grep -qE '\.(yml|yaml|json)' && echo "$TOOL_INPUT" | grep -qE 'config|settings'; then
    log "WARNED — config file write: $TOOL_INPUT"
  fi

  log "ALLOWED — write to: $TOOL_INPUT"
fi

# =============================================================================
# EDIT-VS-WRITE: Warn when Write/write_to_file is used on an existing file
# Edit/replace_file_content sends only the diff — up to 15x cheaper for modifications.
# =============================================================================
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "write_to_file" ]; then
  FILE_PATH=$(echo "$HOOK_JSON" | jq -r '.tool_input.file_path // .tool_input.TargetFile // ""' 2>/dev/null)
  if [ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ]; then
    echo "⚠️  EFFICIENCY [EDIT-VS-WRITE]: Writing to existing file: $FILE_PATH"
    echo "   replace_file_content / Edit sends only the diff — use diff edit instead of write_to_file."
    echo "   Write = full file output tokens. Edit = diff only (up to 15x cheaper)."
    log "WARNED [EDIT-VS-WRITE] — Write on existing file: $FILE_PATH"
  fi
fi


# =============================================================================
# TURN COUNTER: Warn after ~35 tool calls (~7 turns) to prompt /clear
# Long sessions compound context costs. /clear resets to 0.
# Counter file: /tmp/.arog-turns-<ppid> (keyed to parent PID = session proxy)
# Read is excluded — hook matcher only fires on Bash|Write|Edit anyway.
# =============================================================================
if [ "$TOOL_NAME" = "Bash" ] || [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ]; then
  # Use parent PID as session proxy — stable for the lifetime of the Claude Code process
  # Fallback to date if PPID unset (unusual env) — date grouping beats per-invocation $$
  SESSION_KEY="${PPID:-$(date '+%Y%m%d')}"
  TURN_FILE="/tmp/.arog-turns-${SESSION_KEY}"
  # Increment counter
  CURRENT_COUNT=0
  [ -f "$TURN_FILE" ] && CURRENT_COUNT=$(cat "$TURN_FILE" 2>/dev/null || echo 0)
  NEW_COUNT=$((CURRENT_COUNT + 1))
  echo "$NEW_COUNT" > "$TURN_FILE"
  # Warn at multiples of 35 (first warning at 35, then 70, etc.)
  if [ "$((NEW_COUNT % 35))" -eq 0 ] && [ "$NEW_COUNT" -gt 0 ]; then
    echo "⚠️  TURN WARNING: ~$((NEW_COUNT / 5)) turns in this session (~$NEW_COUNT tool calls)."
    echo "   Long sessions compound context costs. Consider /clear to start a new session."
    echo "   To reset counter: rm $TURN_FILE"
    log "TURN-WARNING — tool call count: $NEW_COUNT (session: $SESSION_KEY)"
  fi
fi

# =============================================================================
# BUG FIX GATE: Editing source files requires a failing repro test first
# Mandate 2: NO REPRODUCTION = NO FIX
# Applies to: Edit, MultiEdit, str_replace_based_editor
# Escape: touch ~/.claude/.bug-hunt-session-active (unblocks for the session)
# =============================================================================
if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "MultiEdit" ] || [ "$TOOL_NAME" = "str_replace_based_editor" ]; then
  # Check if source file (not a test/spec/config/doc)
  BFG_IS_SOURCE=0
  BFG_IS_TEST=0

  if echo "$TOOL_INPUT" | grep -qE '\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|java|cs|c|cpp)$'; then
    BFG_IS_SOURCE=1
  fi
  if echo "$TOOL_INPUT" | grep -qE '\.(test|spec)\.(ts|tsx|js|jsx|py|mjs)$'; then
    BFG_IS_TEST=1
  fi
  if echo "$TOOL_INPUT" | grep -qE '(__tests__|__mocks__|\.bats|_test\.)'; then
    BFG_IS_TEST=1
  fi

  if [ "$BFG_IS_SOURCE" -eq 1 ] && [ "$BFG_IS_TEST" -eq 0 ]; then
    if [ ! -f "${HOME}/.claude/.bug-hunt-session-active" ]; then
      echo "🚫 HOOK BLOCKED [BUG FIX GATE]: Source edit without repro test."
      echo ""
      echo "  File: $TOOL_INPUT"
      echo ""
      echo "  MANDATE 2: NO REPRODUCTION = NO FIX"
      echo "  Write a FAILING test that reproduces the bug. Show FAIL output. Then fix."
      echo ""
      echo "  After writing and running your failing repro test:"
      echo "    touch ~/.claude/.bug-hunt-session-active"
      log "BLOCKED [BUG FIX GATE] — source edit without repro test: $TOOL_INPUT"
      exit 1
    fi
  fi
fi

# =============================================================================
# BLOCK: Package installation without approval
# =============================================================================
if [ "$TOOL_NAME" = "Bash" ]; then
  if echo "$TOOL_INPUT" | grep -qE 'npm install|yarn add|pnpm add|pip install' && ! echo "$TOOL_INPUT" | grep -q '\-\-help'; then
    echo "HOOK BLOCKED: Package installation requires explicit approval."
    echo "State the package and reason first. Confirm, then run manually."
    log "BLOCKED — package install attempt: $TOOL_INPUT"
    exit 1
  fi
fi


# =============================================================================
# GATE ENFORCEMENT (hard block for key pipeline gates)
# /ar-event-from-spec requires spec.passed
# /ar-git-checkin requires pipeline.passed AND security.passed
# /conversational-feature-builder requires conv-spec.passed
# =============================================================================
if [ "$TOOL_NAME" = "Bash" ]; then
  INVOKED_CMD=$(echo "$TOOL_INPUT" | grep -oE '^/[a-z-]+' | head -1)
  CANONICAL_ARG=$(echo "$TOOL_INPUT" | awk '{print $2}' | grep -E '^[a-zA-Z]+\.' | head -1)

  check_gate() {
    local CANONICAL="$1"
    local GATE="$2"
    if [ -n "$CANONICAL" ]; then
      if ! ~/.claude/scripts/gate-check.sh "$CANONICAL" "$GATE" > /dev/null 2>&1; then
        echo "🚫 GATE BLOCKED: Cannot run $INVOKED_CMD — $GATE.passed not found for $CANONICAL"
        echo "   Required: run the gate-producing skill first."
        case "$GATE" in
          spec)     echo "   → /ar-spec-reviewer docs/.../${CANONICAL}/${CANONICAL}-vN.md --gate" ;;
          conv-spec) echo "   → /event-to-conversation-spec ${CANONICAL}, then /ar-spec-reviewer --gate" ;;
          pipeline) echo "   → npm test && tsc --noEmit && npm run lint && npm run check-event-types" ;;
          conv-pipeline) echo "   → npm test && tsc --noEmit && npm run lint && npm run check-controllers" ;;
          security) echo "   → /ar-e-pr-code-review ${CANONICAL} (security section)" ;;
        esac
        log "GATE-BLOCKED — $INVOKED_CMD requires $GATE for $CANONICAL"
        exit 1
      fi
    fi
  }

  case "$INVOKED_CMD" in
    /ar-event-from-spec)
      check_gate "$CANONICAL_ARG" "spec"
      ;;
    /conversational-feature-builder)
      check_gate "$CANONICAL_ARG" "conv-spec"
      ;;
    /ar-git-checkin)
      check_gate "$CANONICAL_ARG" "pipeline"
      check_gate "$CANONICAL_ARG" "security"
      ;;
  esac
fi

# =============================================================================
# SPRINT SCOPE CHECK (soft warn — does NOT block)
# If .sprint exists in the current working directory, warn when a skill
# invoked via Bash (/ar-* or /arog-*) is not in the sprint list.
# =============================================================================
GIT_ROOT="$(git -C "$(pwd)" rev-parse --show-toplevel 2>/dev/null || pwd)"
SPRINT_FILE="${GIT_ROOT}/.sprint"
if [ -f "$SPRINT_FILE" ] && [ "$TOOL_NAME" = "Bash" ]; then
  if echo "$TOOL_INPUT" | grep -qE '^/ar-|^/arog-'; then
    SKILL_NAME=$(echo "$TOOL_INPUT" | grep -oE '^/[a-z-]+' | tr -d '/')
    # Strip active-sprint skills (lines starting with #) before checking
    if ! grep -v '^#' "$SPRINT_FILE" | grep -q "^${SKILL_NAME}$" 2>/dev/null; then
      echo "⚠️  SPRINT WARNING: '${SKILL_NAME}' is not in your .sprint file."
      echo "   Add it to $(pwd)/.sprint if this skill is intentional for this sprint."
      log "SPRINT-WARNING — ${SKILL_NAME} not in sprint scope"
      # Soft warn only — does NOT block. After 1 week of data, evaluate hard-block.
    fi
  fi
fi


# =============================================================================
# MONEY TYPE GUARD (Hard Block) — ARCH-005
# Block float arithmetic on monetary variable names.
# adp-e-product is payroll. Decimal.js is mandatory for all money calculations.
# =============================================================================
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "str_replace_based_edit_tool" ] || [ "$TOOL_NAME" = "Edit" ]; then
  if echo "$HOOK_JSON" | python3 -c "
import sys, json, re
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
content = str(ti.get('content', ti.get('new_string', ti.get('new_str', ''))))
money_names = re.search(r'(amount|wage|salary|gross|net|tax|deduction|garnish)', content, re.I)
float_ops = re.search(r'(Math[.](round|floor|ceil)|parseFloat|[.]toFixed|Number[(])', content)
sys.exit(0 if (money_names and float_ops) else 1)
" 2>/dev/null; then
    echo "HOOK BLOCKED [ARCH-005]: Float arithmetic on monetary variable." >&2
    echo "   Use Decimal.js for ALL monetary calculations." >&2
    echo "   Fix: import Decimal from 'decimal.js'; new Decimal(amount).toFixed(2)" >&2
    log "BLOCKED [ARCH-005 MONEY GUARD] — float on money variable"
    exit 1
  fi
fi

exit 0
