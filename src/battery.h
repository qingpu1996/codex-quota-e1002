#pragma once

#include <stddef.h>
#include <stdint.h>

static constexpr uint8_t PIN_BATTERY_ADC = 1;
static constexpr uint8_t PIN_BATTERY_ENABLE = 21;

struct BatteryStatus {
  bool valid;
  uint16_t millivolts;
  uint8_t percent;
};

uint8_t batteryPercentFromMillivolts(uint16_t millivolts);
void formatBatteryLabel(const BatteryStatus& status, char* out, size_t outSize);
uint32_t batteryRenderHash(const BatteryStatus& status);

#ifndef QUOTA_HOST_TEST
BatteryStatus readBatteryStatus();
void disableBatteryMonitor();
#endif
