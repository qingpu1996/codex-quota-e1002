#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
pio run -e reterminal_e1002
