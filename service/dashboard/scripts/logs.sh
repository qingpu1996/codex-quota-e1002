#!/bin/bash
set -euo pipefail

LOG_DIR="$HOME/Library/Logs/CodexQuotaDashboard"
MODE="${1:-tail}"

mkdir -p "$LOG_DIR"
if [ "$MODE" = "follow" ] || [ "$MODE" = "-f" ]; then
  tail -n 200 -f "$LOG_DIR/stdout.log" "$LOG_DIR/stderr.log"
else
  tail -n 200 "$LOG_DIR/stdout.log" "$LOG_DIR/stderr.log"
fi
