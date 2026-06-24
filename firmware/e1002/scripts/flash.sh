#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

scripts/check-secrets.sh >/dev/null

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

pio run -e reterminal_e1002 -t upload --upload-port "${ports[0]}"
