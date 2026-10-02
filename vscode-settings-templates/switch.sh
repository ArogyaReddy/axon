#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(/usr/bin/dirname "$0")" && pwd)
exec /usr/bin/python3 "$SCRIPT_DIR/vscode-settings-templates" "$@"