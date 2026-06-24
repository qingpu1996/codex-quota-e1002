#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ARDUINOJSON_DIR="${ARDUINOJSON_DIR:-.pio/libdeps/reterminal_e1002/ArduinoJson/src}"
if [[ ! -d "$ARDUINOJSON_DIR" ]]; then
  echo "ArduinoJson headers not found at $ARDUINOJSON_DIR. Run scripts/build.sh first." >&2
  exit 1
fi

compiler="${CXX:-c++}"

bash -n scripts/build.sh scripts/flash.sh scripts/install.sh scripts/monitor.sh scripts/check-secrets.sh
python3 -m py_compile scripts/apply_features.py scripts/feature_config.py

run_tests() {
  local feature_meal="$1"
  local output="/tmp/codex-quota-e1002-firmware-tests-meal-${feature_meal}"
  local sources=(
    src/battery.cpp
    src/input_manager.cpp
    src/page_manager.cpp
    src/provisioning.cpp
    src/quota_client.cpp
  )
  if [[ "$feature_meal" == "1" ]]; then
    sources+=(src/meal_image_client.cpp)
  fi

  "$compiler" -std=c++17 \
    -DQUOTA_HOST_TEST \
    -DFEATURE_MEAL="$feature_meal" \
    -I src \
    -I include \
    -I "$ARDUINOJSON_DIR" \
    "${sources[@]}" \
    test/firmware_logic_tests.cpp \
    -o "$output"

  "$output"
}

run_tests 1
run_tests 0

echo "firmware logic tests passed for FEATURE_MEAL=1 and FEATURE_MEAL=0"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch include/secrets.h >/dev/null 2>&1; then
    echo "include/secrets.h is tracked by Git" >&2
    exit 1
  fi
else
  echo "secrets git tracking check skipped: not a git repo"
fi
