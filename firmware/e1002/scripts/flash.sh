#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

scripts/check-secrets.sh >/dev/null
env_name="reterminal_e1002"

if [[ "${1:-}" != "" && "${1:-}" != "--clean" ]]; then
  echo "Usage: scripts/flash.sh [--clean]" >&2
  echo "Use FEATURE_MEAL=0 or .local/features.env to choose optional modules." >&2
  exit 1
fi

if [[ "${1:-}" == "--clean" ]]; then
  scripts/build.sh --clean
else
  scripts/build.sh
fi

ports=()
while IFS= read -r port; do
  ports+=("$port")
done < <(
  {
    ls /dev/cu.usbserial-* 2>/dev/null || true
    ls /dev/cu.wchusbserial* 2>/dev/null || true
    ls /dev/cu.SLAB_USBtoUART* 2>/dev/null || true
    ls /dev/cu.usbmodem* 2>/dev/null || true
  } | sort -u
)

if [[ "${#ports[@]}" -eq 0 ]]; then
  echo "No USB serial port detected." >&2
  echo "Reconnect USB-C, press RESET or the green button, and avoid charge-only hubs/cables." >&2
  exit 1
fi

if [[ "${#ports[@]}" -gt 1 ]]; then
  echo "Multiple USB serial ports detected; refusing to guess:" >&2
  printf '  %s\n' "${ports[@]}" >&2
  exit 1
fi

echo "Flashing PlatformIO env: $env_name"
pio run -e "$env_name" -t upload --upload-port "${ports[0]}"
