#pragma once

#include <stdint.h>

static constexpr uint64_t kSleepIntervalUs = 5ULL * 60ULL * 1000000ULL;

const char* wakeReasonName();
bool wasManualWake();
uint64_t ext1WakeStatus();
void enterDeepSleep();
