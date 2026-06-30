# Waveshare Deck 3.49 Flash Optimization Report

## Baseline

- Baseline commit: `dd7ecbb`
- Baseline command: `scripts/build.sh waveshare_deck_349`, then `pio run -e waveshare_deck_349 -t size -v`
- Baseline env: `waveshare_deck_349`
- Baseline partition table: PlatformIO `huge_app.csv`
- Baseline app partition: `3145728 bytes`
- Baseline RAM: `126472 / 327680 bytes`, `38.6%`
- Baseline Flash: `2220591 / 3145728 bytes`, `70.6%`
- Baseline `firmware.bin`: `2220992 bytes`

## Size Progress

| Step | Env | firmware.bin bytes | Flash used | Delta vs baseline | Notes |
| ---- | --- | ------------------ | ---------- | ----------------- | ----- |
| baseline | waveshare_deck_349 | 2220992 | 2220591 / 3145728 | 0 | `origin/main` before changes |
| size tooling + 8MB app partition | waveshare_deck_349 | 2220992 | 2220591 / 8388608 | 0 | Adds reproducible report script and private no-OTA 16MB partition table |
| release env only | waveshare_deck_349_release | 2209152 | 2208755 / 8388608 | -11840 | Lower core log level and release build flags |
| lvgl trim | waveshare_deck_349_release | 2048768 | 2048359 / 8388608 | -172224 | Widgets, themes, draw formats, Montserrat 12/16, radius/complex renderer trimmed |
| audio input-only | waveshare_deck_349_release | 2033120 | 2032711 / 8388608 | -187872 | ES8311 output/playback path and unused SDCard helpers gated |
| cjk subset + debug text client off | waveshare_deck_349_release | 1394192 | 1393783 / 8388608 | -826800 | Checked-in font now uses the `deck` subset profile; `/debug/text` client path defaults off |

Final release app image uses `16.6%` of the new 8MB app partition. The net `firmware.bin` reduction is `826800 bytes`.

## Final Debug Build

- Env: `waveshare_deck_349`
- RAM: `126016 / 327680 bytes`, `38.5%`
- Flash: `1406127 / 8388608 bytes`, `16.8%`
- `firmware.bin`: `1406528 bytes`

## Baseline Largest Sections

| Section | Size bytes | Notes |
| ------- | ---------- | ----- |
| `.ext_ram.dummy` | 2162656 | PSRAM reservation/dummy region |
| `.flash_rodata_dummy` | 1114112 | Flash rodata reservation/dummy region |
| `.flash.text` | 1112664 | Executable code in flash |
| `.flash.rodata` | 1005204 | Read-only data; CJK font dominates |
| `.dram0.bss` | 102584 | Internal DRAM BSS |
| `.iram0.text` | 77807 | IRAM code |
| `.dram0.data` | 23888 | Internal DRAM data |
| `.flash.rodata_noload` | 23206 | Flash rodata no-load |

## Final Release Largest Sections

| Section | Size bytes | Notes |
| ------- | ---------- | ----- |
| `.ext_ram.dummy` | 1376224 | Lower PSRAM dummy total after smaller app data |
| `.flash_rodata_dummy` | 983040 | Flash rodata reservation/dummy region |
| `.flash.text` | 955604 | Executable code in flash |
| `.flash.rodata` | 335776 | Read-only data after CJK subset |
| `.dram0.bss` | 102448 | Internal DRAM BSS |
| `.iram0.text` | 77807 | IRAM code |
| `.dram0.data` | 23568 | Internal DRAM data |
| `.flash.rodata_noload` | 23206 | Flash rodata no-load |

## Baseline Largest Symbols

| Size hex | Symbol | Notes |
| -------- | ------ | ----- |
| `000887dd` | `glyph_bitmap` | Full `codex_deck_cjk_16` bitmap data |
| `00029d48` | `glyph_dsc` | Full `codex_deck_cjk_16` descriptors |
| `00010000` | `work_mem_int$0` | LVGL built-in allocator pool |
| `00002c95` | `_vfprintf_r` | newlib formatting |
| `00002bd6` | `_svfprintf_r` | newlib formatting |
| `00002b52` | `glyph_bitmap` | Built-in font bitmap |
| `00002280` | `glyph_bitmap` | Built-in font bitmap |
| `00001d69` | `__ssvfiscanf_r` | newlib scanning |
| `000019c3` | `lv_theme_default_init` | LVGL default theme |
| `00001991` | `lv_draw_sw_blend_image_to_rgb565_swapped` | Draw path candidate |
| `000016a1` | `mbedtls_ssl_handshake_server_step` | Framework TLS |
| `00001615` | `lv_draw_sw_blend_image_to_rgb565` | LVGL draw path |
| `00001360` | `lv_draw_sw_blend_image_to_argb8888` | Unused draw format path candidate |
| `00001149` | `g_stt_job` | Deck job state |
| `00001149` | `g_job` | Deck job state |
| `00001060` | `port_IntStack` | FreeRTOS stack |
| `00000fd6` | `mbedtls_ssl_handshake_client_step` | HTTPClient/TLS path |
| `00000fa6` | `hostap_recv_mgmt` | Wi-Fi/AP path |
| `00000f08` | `nd6_input` | Network stack |
| `00000e8b` | `lv_draw_sw_transform` | LVGL draw path |

## Final Release Largest Symbols

| Size hex | Symbol | Notes |
| -------- | ------ | ----- |
| `00010221` | `glyph_bitmap` | Deck subset CJK bitmap data |
| `00010000` | `work_mem_int$0` | LVGL built-in allocator pool |
| `000058b8` | `glyph_dsc` | Deck subset CJK descriptors |
| `00002c95` | `_vfprintf_r` | newlib formatting |
| `00002bd6` | `_svfprintf_r` | newlib formatting |
| `00002280` | `glyph_bitmap` | Built-in font bitmap |
| `00001d69` | `__ssvfiscanf_r` | newlib scanning |
| `000016a1` | `mbedtls_ssl_handshake_server_step` | Framework TLS |
| `00001228` | `unicode_list_4` | CJK subset cmap list |
| `00001149` | `g_stt_job` | Deck job state |
| `00001149` | `g_job` | Deck job state |
| `00001060` | `port_IntStack` | FreeRTOS stack |
| `00000fd6` | `mbedtls_ssl_handshake_client_step` | HTTPClient/TLS path |
| `00000fa6` | `hostap_recv_mgmt` | Wi-Fi/AP path |
| `00000f28` | `g_cnxMgr` | Network connection manager |
| `00000f08` | `nd6_input` | Network stack |
| `00000e2a` | `tcp_input` | Network stack |
| `00000cde` | `_strtod_l` | libc number parsing |
| `00000cda` | `tcp_receive` | Network stack |
| `00000c97` | `_dtoa_r` | libc number formatting |

## Optimization Notes

- The new partition table keeps one factory app partition at `0x800000` bytes and a `0x7F0000` LittleFS partition. This does not reduce `firmware.bin`, but it raises the app ceiling from roughly 3MB to 8MB on 16MB flash parts.
- Release env keeps the same hardware macros and include paths as debug, but uses `CORE_DEBUG_LEVEL=1`, `LOG_LOCAL_LEVEL=ESP_LOG_WARN`, and `DECK_VERBOSE_LOGS=0`.
- High-frequency app INFO logs are behind `DECK_LOGI`. Error and warning logging remains available in release.
- LVGL trimming keeps `lv_obj`, `lv_label`, `lv_button`, scrolling labels, basic styles, RGB565/RGB565 swapped, and A8. It disables unused widgets, themes, flex/grid, default widget values, label selection, Montserrat 12/16, complex renderer, and rounded corners.
- Audio init now honors `CODEC_I2S_MODE_NONE`. Stage F sets output mode to `CODEC_I2S_MODE_NONE`, disables the ES8311 playback path by default, and keeps the ES7210 record handle path active.
- `DECK_ENABLE_SDCARD=0` gates unused SDCard helper declarations and implementation. `DECK_AUDIO_ENABLE_OUTPUT=0` is the default because Stage F forbids TTS and speaker playback.
- `DECK_ENABLE_DEBUG_TEXT_CLIENT=0` gates the device-side `/debug/text` client. The service API is unchanged.
- `ArduinoJson` does not appear in the largest-symbol list. `HTTPClient` appears below the top 20 through methods such as `HTTPClient::setCookie` and `HTTPClient::handleHeaderResponse`, but it is not the dominant contributor. This round keeps the HTTP/JSON protocol unchanged to avoid Stage F compatibility risk.

## CJK Font Profiles

- `scripts/generate-cjk-font.sh deck` is the default and reads `src/fonts/codex_deck_cjk_chars.txt`.
- `scripts/generate-cjk-font.sh full` preserves the previous full CJK basic range fallback.
- Full profile source size generated in this branch: `6157223 bytes`.
- Deck subset source size: `784525 bytes`.
- The checked-in font uses 16px, 1bpp, uncompressed LVGL font data and includes ASCII, Latin-1, general punctuation, CJK punctuation, full-width punctuation, common Simplified Chinese, Stage F UI/protocol/status characters, and common Codex reply vocabulary.

## Attempts Rolled Back

| Attempt | Result | Decision |
| ------- | ------ | -------- |
| 4bpp RLE compressed deck subset with `LV_USE_FONT_COMPRESSED=1` | Build passed, `.bitmap_format = 1`, `firmware.bin = 1561776 bytes` | Reverted because it was `167728 bytes` larger than the selected 1bpp uncompressed subset |

## Remaining Risks

- Font subset quality needs real transcript/reply sampling. Unknown or uncommon Chinese characters will render as missing glyphs until added to `codex_deck_cjk_chars.txt` or the `full` profile is regenerated.
- Audio input-only has build-time validation only in this pass. Hardware validation should confirm ES7210 record clocking and `get_record_handle()` behavior on the real Waveshare Deck.
- Future OTA support requires a different dual-app partition table. This branch intentionally keeps the current no-OTA Stage F firmware model.

## Follow-Up Candidates

- Add a small font coverage check that scans captured transcript/reply samples and reports missing characters against `codex_deck_cjk_chars.txt`.
- Investigate a fixed board config path for `codec_board` if future size work needs to remove more demo parser code.
- Revisit protocol weight only if a later size report shows HTTP/JSON becoming a top contributor.
