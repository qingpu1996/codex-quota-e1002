#include "power.h"

#include <Arduino.h>
#include "esp_sleep.h"

#include "input_manager.h"

const char* wakeReasonName() {
  switch (esp_sleep_get_wakeup_cause()) {
    case ESP_SLEEP_WAKEUP_EXT1: return "EXT1";
    case ESP_SLEEP_WAKEUP_TIMER: return "TIMER";
    case ESP_SLEEP_WAKEUP_UNDEFINED: return "POWER_ON_RESET";
    default: return "OTHER";
  }
}

bool wasManualWake() {
  return esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT1 &&
         (ext1WakeStatus() & (1ULL << PIN_KEY0_GREEN)) != 0;
}

uint64_t ext1WakeStatus() {
  return esp_sleep_get_ext1_wakeup_status();
}

void enterDeepSleep() {
  initButtons();
  const bool released = waitForAllButtonsReleased(BUTTON_RELEASE_TIMEOUT_MS);
  if (!released) {
    Serial1.println("[SLEEP] warning: button held LOW; using timer-only sleep this cycle");
  }

  esp_sleep_enable_timer_wakeup(kSleepIntervalUs);
  if (released) {
    configureButtonRtcPullups();
    const esp_err_t err = esp_sleep_enable_ext1_wakeup_io(allButtonWakeMask(), ESP_EXT1_WAKEUP_ANY_LOW);
    Serial1.printf("[SLEEP] wake keys=GPIO3,GPIO4,GPIO5 timer=300s ext1=%s err=%d mask=0x%llx\n",
                   err == ESP_OK ? "enabled" : "failed",
                   static_cast<int>(err),
                   static_cast<unsigned long long>(allButtonWakeMask()));
  } else {
    Serial1.println("[SLEEP] wake keys disabled for this cycle");
  }
  Serial1.printf("[SLEEP] next timer wake=%llu us\n", static_cast<unsigned long long>(kSleepIntervalUs));
  Serial1.println("[SLEEP] entering deep sleep");
  Serial1.flush();
  esp_deep_sleep_start();
}
