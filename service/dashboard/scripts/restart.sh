#!/bin/bash
set -euo pipefail

LABEL="com.qingpu.codex-quota-dashboard"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_VALUE="$(id -u)"

if ! launchctl print "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1; then
  launchctl bootstrap "gui/$UID_VALUE" "$PLIST"
fi
launchctl kickstart -k "gui/$UID_VALUE/$LABEL"
echo "Restarted $LABEL"
