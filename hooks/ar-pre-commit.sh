#!/usr/bin/env bash
# arog-pre-commit.sh — AROG Layer 1 enforcement (global, not in repo)

HAS_LOGIC=false
HAS_TEST=false

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  if [[ "$FILE" =~ \.ts$|\.js$ ]] && [[ ! "$FILE" =~ \.test\.|\.spec\. ]]; then
    HAS_LOGIC=true
  fi
  if [[ "$FILE" =~ \.test\.|\.spec\. ]]; then
    HAS_TEST=true
  fi
done < <(git diff --cached --name-only --diff-filter=A)

if [ "$HAS_LOGIC" = true ] && [ "$HAS_TEST" = false ]; then
  echo "[AROG] BLOCKED: new source file staged with no test file" >&2
  echo "[AROG] Write a failing test first. Stage it. Then commit." >&2
  exit 1
fi

command -v ar-compile-guard      &>/dev/null && ar-compile-guard      || true
command -v ar-i18n-guard         &>/dev/null && ar-i18n-guard         || true
command -v ar-meta-guard         &>/dev/null && ar-meta-guard         || true
command -v ar-db-migration-guard &>/dev/null && ar-db-migration-guard || true
command -v ar-env-guard          &>/dev/null && ar-env-guard          || true
command -v ar-controller-guard   &>/dev/null && ar-controller-guard   || true

exit 0
