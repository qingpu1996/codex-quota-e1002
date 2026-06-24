#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f include/secrets.h ]]; then
  echo "include/secrets.h is missing. Copy include/secrets.example.h and fill local values." >&2
  exit 1
fi

if rg -q 'YOUR_2_4_GHZ_WIFI|YOUR_WIFI_PASSWORD|YOUR_DEVICE_TOKEN|192\\.168\\.x\\.x' include/secrets.h; then
  echo "include/secrets.h still contains placeholder values." >&2
  exit 1
fi

if ! rg -q '^#define WIFI_SSID ".+"' include/secrets.h; then
  echo "WIFI_SSID is missing from include/secrets.h." >&2
  exit 1
fi

if ! rg -q '^#define WIFI_PASSWORD ".+"' include/secrets.h; then
  echo "WIFI_PASSWORD is missing from include/secrets.h." >&2
  exit 1
fi

if ! rg -q '^#define QUOTA_API_URL "http://[^"]+/api/device/[^"]+"' include/secrets.h; then
  echo "QUOTA_API_URL must be a LAN http://.../api/device/... URL." >&2
  exit 1
fi

echo "secrets ok"
