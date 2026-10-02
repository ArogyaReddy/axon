#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(/usr/bin/dirname "$0")/.." && pwd)
CLI="$ROOT/vscode-settings-templates/switch.sh"

/usr/bin/python3 "$ROOT/vscode-settings-templates/test_cli.py"

for template_number in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  "$CLI" --template "$template_number" --dry-run >/dev/null
done

template_count=$(/usr/bin/find "$ROOT/vscode-settings-templates/templates" -maxdepth 1 -type f -name 'template-*.jsonc' | /usr/bin/wc -l | /usr/bin/tr -d ' ')
if [ "$template_count" != "20" ]; then
  echo "Expected 20 templates, found $template_count" >&2
  exit 1
fi

echo "Verified 20 VS Code appearance templates"