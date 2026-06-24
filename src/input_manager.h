#pragma once

#include <stdint.h>

constexpr uint8_t PIN_KEY0_GREEN = 3;
constexpr uint8_t PIN_KEY1_MIDDLE = 4;
constexpr uint8_t PIN_KEY2_LEFT = 5;
constexpr uint32_t BUTTON_DEBOUNCE_MS = 40;
constexpr uint32_t BUTTON_LONG_PRESS_MS = 900;
constexpr uint32_t MULTI_CLICK_GAP_MS = 1400;
constexpr uint32_t MULTI_CLICK_TOTAL_TIMEOUT_MS = 6000;
constexpr uint32_t BUTTON_RELEASE_TIMEOUT_MS = 10000;

enum class PhysicalButton : uint8_t {
  None,
  Key0Green,
  Key1Middle,
  Key2Left,
  Multiple,
};

enum class InputActionType : uint8_t {
  None,
  GoToPage,
  NextPage,
  NextSubPage,
  RefreshCurrentPage,
  Ambiguous,
};

struct InputAction {
  InputActionType type;
  uint8_t targetPageSlot;
  uint8_t clickCount;
};

class DirectPageClickCollector {
 public:
  void beginWithWakePress(uint32_t nowMs);
  void update(uint8_t gpio, bool pressed, uint32_t nowMs);
  bool tick(uint32_t nowMs);
  bool finalized() const;
  uint8_t clickCount() const;
  bool ignoredOtherButton() const;

 private:
  bool active_ = false;
  bool finalized_ = false;
  bool stablePressed_ = false;
  bool ignoredOtherButton_ = false;
  uint8_t clickCount_ = 0;
  uint32_t startMs_ = 0;
  uint32_t lastEdgeMs_ = 0;
  uint32_t lastReleaseMs_ = 0;
};

uint64_t allButtonWakeMask();
PhysicalButton buttonFromWakeMask(uint64_t wakeMask);
InputAction actionFromWakeMask(uint64_t wakeMask);
InputAction middleButtonActionFromHoldDuration(uint32_t holdMs);
InputAction directPageActionFromClickCount(uint8_t clickCount, uint8_t pageCount);
const char* physicalButtonName(PhysicalButton button);
const char* inputActionName(InputActionType action);
const char* gpioButtonName(uint8_t gpio);

#ifndef QUOTA_HOST_TEST
void initButtons();
bool areAllButtonsReleased();
bool waitForAllButtonsReleased(uint32_t timeoutMs);
void configureButtonRtcPullups();
InputAction collectDirectPageClicksFromWake(uint8_t pageCount);
InputAction collectMiddleButtonActionFromWake();
#endif
