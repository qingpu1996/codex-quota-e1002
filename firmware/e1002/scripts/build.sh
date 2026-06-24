#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
env_name="reterminal_e1002"
clean_requested=0

if [[ "${1:-}" == "--clean" ]]; then
  clean_requested=1
elif [[ "${1:-}" != "" ]]; then
  echo "Usage: scripts/build.sh [--clean]" >&2
  echo "Use FEATURE_MEAL=0 or .local/features.env to choose optional modules." >&2
  exit 1
fi

mkdir -p .local
feature_snapshot="$(mktemp)"
trap 'rm -f "$feature_snapshot"' EXIT
python3 scripts/feature_config.py "$PWD" snapshot > "$feature_snapshot"

last_snapshot=".local/last-build-features.env"
if [[ "$clean_requested" -eq 1 ]] || [[ ! -f "$last_snapshot" ]] || ! cmp -s "$feature_snapshot" "$last_snapshot"; then
  echo "Feature selection changed; cleaning PlatformIO env: $env_name"
  pio run -e "$env_name" -t clean
fi

echo "Building PlatformIO env: $env_name"
pio run -e "$env_name"
cp "$feature_snapshot" "$last_snapshot"
