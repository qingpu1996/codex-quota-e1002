#pragma once

#include <stddef.h>
#include <stdint.h>

static constexpr int kMealImageWidth = 800;
static constexpr int kMealImageHeight = 480;
static constexpr size_t kMealImageBytes = (kMealImageWidth * kMealImageHeight) / 2;
static constexpr size_t kMealImageHashLen = 65;
static constexpr size_t kMealEndpointUrlMaxLen = 288;
static constexpr size_t kMaxMealMetaResponseBytes = 2048;

struct MealImageMeta {
  int schemaVersion;
  char status[12];
  char date[12];
  char weekday[16];
  char mealTitle[48];
  char imageHash[kMealImageHashLen];
  uint8_t slot;
  uint8_t slotCount;
  size_t rawBytes;
  bool hadFormatIssue;
};

enum class MealImageError : uint8_t {
  None,
  Url,
  Http,
  ContentType,
  ResponseTooLarge,
  JsonParse,
  Schema,
  MissingField,
  ImageShape,
  RawSize,
  Stream,
};

struct MealMetaParseResult {
  bool ok;
  MealImageError error;
};

MealMetaParseResult parseMealMetaJson(const char* json, size_t length, MealImageMeta* out);
uint32_t mealImageMetaHash(const MealImageMeta& meta);
bool buildMealEndpointUrl(const char* quotaApiUrl, const char* suffix, char* out, size_t outSize);
const char* mealImageErrorName(MealImageError error);

#ifndef QUOTA_HOST_TEST
struct FetchMealMetaResult {
  bool ok;
  MealImageError error;
  int httpStatus;
  char contentType[48];
  MealImageMeta meta;
};

struct FetchMealRawResult {
  bool ok;
  MealImageError error;
  int httpStatus;
  size_t bytesRead;
  char contentType[48];
};

FetchMealMetaResult fetchMealImageMeta(const char* quotaApiUrl, uint8_t slot);
FetchMealRawResult fetchMealImageRaw4bpp(const char* quotaApiUrl, uint8_t slot, uint8_t* dest, size_t destSize);
#endif
