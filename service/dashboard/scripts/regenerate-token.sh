#!/bin/bash
set -euo pipefail

LABEL="com.qingpu.codex-quota-dashboard"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NODE_BIN="$(command -v node)"
UID_VALUE="$(id -u)"

"$NODE_BIN" "$PROJECT_DIR/dist/src/cli.js" regenerate-token
launchctl kickstart -k "gui/$UID_VALUE/$LABEL"
echo "Restarted $LABEL with the new token. Update the SenseCraft URL after this change."
