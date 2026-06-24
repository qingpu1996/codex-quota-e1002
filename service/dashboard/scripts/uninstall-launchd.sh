#!/bin/bash
set -euo pipefail

LABEL="com.qingpu.codex-quota-dashboard"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_VALUE="$(id -u)"

launchctl bootout "gui/$UID_VALUE" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
echo "Uninstalled $LABEL"
echo "Config and cache are kept under $HOME/Library/Application Support/CodexQuotaDashboard"
