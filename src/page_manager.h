#pragma once

#include <stddef.h>
#include <stdint.h>

#include "quota_client.h"

enum class PageId : uint8_t {
  CodexQuota = 1,
  TodayMeal = 2,
};

enum class RefreshReason : uint8_t {
  ColdBoot,
  Timer,
  DirectNavigation,
  NextNavigation,
  ManualRefresh,
};

enum class RefreshPolicy : uint8_t {
  PeriodicData,
  Static,
};

struct PageDescriptor {
  PageId id;
  uint8_t slot;
  const char* name;
  RefreshPolicy refreshPolicy;
};

class PageManager {
 public:
  static constexpr uint8_t kDefaultSlot = 1;

  explicit PageManager(uint8_t slot = kDefaultSlot);

  size_t pageCount() const;
  const PageDescriptor& currentPage() const;
  uint8_t currentSlot() const;
  bool goToSlot(uint8_t slot);
  bool nextPage();
  bool isValidSlot(uint8_t slot) const;
  const PageDescriptor* pageForSlot(uint8_t slot) const;
  void formatPageIndicator(char* out, size_t outSize) const;
  void formatPageIndicatorForSlot(uint8_t slot, char* out, size_t outSize) const;
  uint32_t currentPageContentHash(uint32_t pagePayloadHash, const char* indicator) const;
  uint32_t pageContentHash(uint8_t slot, uint32_t pagePayloadHash, const char* indicator) const;

#ifndef QUOTA_HOST_TEST
  void renderCurrentPage(const QuotaPayload* payload) const;
  void refreshCurrentPage(const QuotaPayload* payload) const;
#endif

  static const PageDescriptor* registry();
  static size_t registryCount();

 private:
  uint8_t currentSlot_;
};

const char* pageIdName(PageId id);
const char* refreshPolicyName(RefreshPolicy policy);
const char* refreshReasonName(RefreshReason reason);
uint32_t mealPlaceholderHash();
uint32_t pageDisplayHash(PageId pageId, uint32_t pagePayloadHash, const char* indicator);
