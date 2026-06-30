#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FONT_PATH=".pio/libdeps/waveshare_deck_349/lvgl/scripts/built_in_font/SourceHanSansSC-Normal.otf"
OUT_PATH="src/fonts/codex_deck_cjk_16.c"
SYMBOLS_PATH="src/fonts/codex_deck_cjk_chars.txt"
PROFILE="${1:-${CJK_FONT_PROFILE:-deck}}"
BPP="${CJK_FONT_BPP:-1}"
COMPRESSED="${CJK_FONT_COMPRESSED:-0}"

cd "${ROOT_DIR}"

if [[ ! -f "${FONT_PATH}" ]]; then
  echo "SourceHanSansSC-Normal.otf not found. Run scripts/build.sh once to install PlatformIO libs." >&2
  exit 1
fi

mkdir -p "$(dirname "${OUT_PATH}")"

case "${PROFILE}" in
  full)
    RANGE="0x20-0x7E,0x00A0-0x00FF,0x2000-0x206F,0x3000-0x303F,0xFF00-0xFFEF,0x4E00-0x9FA5"
    SYMBOL_ARGS=()
    ;;
  deck)
    if [[ ! -f "${SYMBOLS_PATH}" ]]; then
      echo "Missing deck CJK symbols file: ${SYMBOLS_PATH}" >&2
      exit 1
    fi
    RANGE="0x20-0x7E,0x00A0-0x00FF,0x2000-0x206F,0x3000-0x303F,0xFF00-0xFFEF"
    SYMBOLS="$(
      perl -CSD -Mutf8 -0777 -ne '
        s/\s+//g;
        my %seen;
        print grep { !$seen{$_}++ } split //;
      ' "${SYMBOLS_PATH}"
    )"
    if [[ -z "${SYMBOLS}" ]]; then
      echo "No deck CJK symbols found in ${SYMBOLS_PATH}" >&2
      exit 1
    fi
    ;;
  *)
    echo "Usage: $(basename "$0") [full|deck]" >&2
    echo "Optional: CJK_FONT_BPP=1|2|3|4|8 CJK_FONT_COMPRESSED=0|1" >&2
    exit 1
    ;;
esac

CONVERT_CMD=(
  npx --yes lv_font_conv@1.5.3
  --bpp "${BPP}"
  --size 16
  --font "${FONT_PATH}"
  -r "${RANGE}"
)

if [[ "${PROFILE}" == "deck" ]]; then
  CONVERT_CMD+=(--symbols "${SYMBOLS}")
fi

CONVERT_CMD+=(
  --format lvgl
  --lv-include lvgl.h
  --lv-font-name codex_deck_cjk_16
  --force-fast-kern-format
  --no-kerning
)

if [[ "${COMPRESSED}" != "1" ]]; then
  CONVERT_CMD+=(--no-compress)
fi

CONVERT_CMD+=(-o "${OUT_PATH}")

"${CONVERT_CMD[@]}"

perl -0pi -e 's/\n+\z/\n/' "${OUT_PATH}"

echo "Generated ${ROOT_DIR}/${OUT_PATH}"
echo "Profile: ${PROFILE}, bpp: ${BPP}, compressed-requested: ${COMPRESSED}"
grep -m 1 "bitmap_format" "${OUT_PATH}" || true
stat -f "%z bytes" "${OUT_PATH}" 2>/dev/null || stat -c "%s bytes" "${OUT_PATH}"
