#include "battery.h"

#include <stdio.h>
#include <string.h>

struct BatteryCurvePoint {
  uint16_t millivolts;
  uint8_t percent;
};

static constexpr BatteryCurvePoint kBatteryCurve[] = {
  {4150, 100},
  {3960, 90},
  {3910, 80},
  {3850, 70},
  {3800, 60},
  {3750, 50},
  {3680, 40},
  {3580, 30},
  {3490, 20},
  {3410, 10},
  {3300, 5},
  {3270, 0},
};

static uint32_t fnv1a(uint32_t hash, const void* data, size_t len) {
  const uint8_t* bytes = static_cast<const uint8_t*>(data);
  for (size_t i = 0; i < len; ++i) {
    hash ^= bytes[i];
    hash *= 16777619UL;
  }
  return hash;
}

uint8_t batteryPercentFromMillivolts(uint16_t millivolts) {
  if (millivolts >= kBatteryCurve[0].millivolts) {
    return kBatteryCurve[0].percent;
  }
  const size_t last = (sizeof(kBatteryCurve) / sizeof(kBatteryCurve[0])) - 1;
  if (millivolts <= kBatteryCurve[last].millivolts) {
    return kBatteryCurve[last].percent;
  }

  for (size_t i = 0; i < last; ++i) {
    const BatteryCurvePoint& high = kBatteryCurve[i];
    const BatteryCurvePoint& low = kBatteryCurve[i + 1];
    if (millivolts <= high.millivolts && millivolts >= low.millivolts) {
      const int32_t spanMv = static_cast<int32_t>(high.millivolts) - static_cast<int32_t>(low.millivolts);
      const int32_t spanPct = static_cast<int32_t>(high.percent) - static_cast<int32_t>(low.percent);
      const int32_t offsetMv = static_cast<int32_t>(millivolts) - static_cast<int32_t>(low.millivolts);
      const int32_t pct = static_cast<int32_t>(low.percent) + ((offsetMv * spanPct) + (spanMv / 2)) / spanMv;
      if (pct < 0) {
        return 0;
      }
      if (pct > 100) {
        return 100;
      }
      return static_cast<uint8_t>(pct);
    }
  }

  return 0;
}

void formatBatteryLabel(const BatteryStatus& status, char* out, size_t outSize) {
  if (!out || outSize == 0) {
    return;
  }
  if (!status.valid) {
    snprintf(out, outSize, "BAT --%%");
    return;
  }
  snprintf(out, outSize, "BAT %u%%", static_cast<unsigned>(status.percent));
}

uint32_t batteryRenderHash(const BatteryStatus& status) {
  char label[16];
  formatBatteryLabel(status, label, sizeof(label));
  uint32_t hash = 2166136261UL;
  return fnv1a(hash, label, strlen(label) + 1);
}

#ifndef QUOTA_HOST_TEST
#include <Arduino.h>

static constexpr uint8_t kBatterySampleCount = 5;
static constexpr uint16_t kMinPlausibleBatteryMv = 2500;
static constexpr uint16_t kMaxPlausibleBatteryMv = 5000;

void disableBatteryMonitor() {
  pinMode(PIN_BATTERY_ENABLE, OUTPUT);
  digitalWrite(PIN_BATTERY_ENABLE, LOW);
}

BatteryStatus readBatteryStatus() {
  pinMode(PIN_BATTERY_ENABLE, OUTPUT);
  digitalWrite(PIN_BATTERY_ENABLE, HIGH);
  delay(20);

  analogSetPinAttenuation(PIN_BATTERY_ADC, ADC_11db);

  uint32_t sampleSum = 0;
  for (uint8_t i = 0; i < kBatterySampleCount; ++i) {
    sampleSum += analogReadMilliVolts(PIN_BATTERY_ADC);
    delay(5);
  }

  disableBatteryMonitor();

  const uint16_t millivolts = static_cast<uint16_t>((sampleSum * 2U + (kBatterySampleCount / 2U)) / kBatterySampleCount);
  if (millivolts < kMinPlausibleBatteryMv || millivolts > kMaxPlausibleBatteryMv) {
    return {false, millivolts, 0};
  }
  return {true, millivolts, batteryPercentFromMillivolts(millivolts)};
}
#endif
