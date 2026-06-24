#include "meal_image_client.h"

#include <ArduinoJson.h>
#include <stdio.h>
#include <string.h>

static bool copyString(char* dest, size_t destSize, const char* value, bool* truncated) {
  if (!dest || destSize == 0 || !value || value[0] == '\0') {
    return false;
  }
  const size_t len = strlen(value);
  const size_t copyLen = len < destSize - 1 ? len : destSize - 1;
  memcpy(dest, value, copyLen);
  dest[copyLen] = '\0';
  if (len >= destSize && truncated) {
    *truncated = true;
  }
  return true;
}

static uint32_t fnv1a(uint32_t hash, const void* data, size_t len) {
  const uint8_t* bytes = static_cast<const uint8_t*>(data);
  for (size_t i = 0; i < len; ++i) {
    hash ^= bytes[i];
    hash *= 16777619UL;
  }
  return hash;
}

static uint32_t hashCString(uint32_t hash, const char* value) {
  return fnv1a(hash, value, strlen(value) + 1);
}

MealMetaParseResult parseMealMetaJson(const char* json, size_t length, MealImageMeta* out) {
  if (!json || !out) {
    return {false, MealImageError::MissingField};
  }
  if (length > kMaxMealMetaResponseBytes) {
    return {false, MealImageError::ResponseTooLarge};
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, json, length);
  if (error) {
    return {false, MealImageError::JsonParse};
  }

  memset(out, 0, sizeof(*out));
  out->schemaVersion = doc["schemaVersion"] | -1;
  if (out->schemaVersion != 1) {
    return {false, MealImageError::Schema};
  }

  bool formatIssue = false;
  if (!copyString(out->status, sizeof(out->status), doc["status"].as<const char*>(), &formatIssue) ||
      !copyString(out->date, sizeof(out->date), doc["date"].as<const char*>(), &formatIssue) ||
      !copyString(out->weekday, sizeof(out->weekday), doc["weekday"].as<const char*>(), &formatIssue) ||
      !copyString(out->mealTitle, sizeof(out->mealTitle), doc["mealTitle"].as<const char*>(), &formatIssue)) {
    return {false, MealImageError::MissingField};
  }
  const int slot = doc["slot"] | 0;
  const int slotCount = doc["slotCount"] | 0;
  if (slot < 1 || slot > 12 || slotCount < 1 || slotCount > 12) {
    return {false, MealImageError::MissingField};
  }
  out->slot = static_cast<uint8_t>(slot);
  out->slotCount = static_cast<uint8_t>(slotCount);

  JsonObject image = doc["image"].as<JsonObject>();
  if (image.isNull()) {
    return {false, MealImageError::MissingField};
  }
  const char* format = image["format"].as<const char*>();
  if (!format || strcmp(format, "e1002-4bpp") != 0 ||
      (image["width"] | 0) != kMealImageWidth ||
      (image["height"] | 0) != kMealImageHeight) {
    return {false, MealImageError::ImageShape};
  }
  if (!image["rawBytes"].is<size_t>() || image["rawBytes"].as<size_t>() != kMealImageBytes) {
    return {false, MealImageError::RawSize};
  }
  if (!copyString(out->imageHash, sizeof(out->imageHash), image["hash"].as<const char*>(), &formatIssue)) {
    return {false, MealImageError::MissingField};
  }
  if (strlen(out->imageHash) != 64) {
    formatIssue = true;
  }
  out->rawBytes = kMealImageBytes;
  out->hadFormatIssue = formatIssue;
  return {true, MealImageError::None};
}

uint32_t mealImageMetaHash(const MealImageMeta& meta) {
  uint32_t hash = 2166136261UL;
  hash = hashCString(hash, meta.status);
  hash = hashCString(hash, meta.date);
  hash = hashCString(hash, meta.weekday);
  hash = hashCString(hash, meta.mealTitle);
  hash = fnv1a(hash, &meta.slot, sizeof(meta.slot));
  hash = fnv1a(hash, &meta.slotCount, sizeof(meta.slotCount));
  hash = hashCString(hash, meta.imageHash);
  return hash;
}

static bool buildMealEndpointUrlForSlot(const char* quotaApiUrl, const char* endpoint, uint8_t slot, char* out, size_t outSize) {
  char suffix[40];
  snprintf(suffix, sizeof(suffix), "%s?slot=%u", endpoint, static_cast<unsigned>(slot < 1 ? 1 : slot));
  return buildMealEndpointUrl(quotaApiUrl, suffix, out, outSize);
}

bool buildMealEndpointUrl(const char* quotaApiUrl, const char* suffix, char* out, size_t outSize) {
  if (!quotaApiUrl || !suffix || !out || outSize == 0) {
    return false;
  }
  out[0] = '\0';
  const char* devicePath = strstr(quotaApiUrl, "/api/device/");
  if (!devicePath) {
    return false;
  }
  const size_t baseLen = strlen(quotaApiUrl);
  const size_t suffixLen = strlen(suffix);
  if (baseLen + 1 + suffixLen >= outSize) {
    return false;
  }
  snprintf(out, outSize, "%s/%s", quotaApiUrl, suffix);
  return true;
}

const char* mealImageErrorName(MealImageError error) {
  switch (error) {
    case MealImageError::None: return "none";
    case MealImageError::Url: return "url";
    case MealImageError::Http: return "http";
    case MealImageError::ContentType: return "content-type";
    case MealImageError::ResponseTooLarge: return "response-too-large";
    case MealImageError::JsonParse: return "json-parse";
    case MealImageError::Schema: return "schema";
    case MealImageError::MissingField: return "missing-field";
    case MealImageError::ImageShape: return "image-shape";
    case MealImageError::RawSize: return "raw-size";
    case MealImageError::Stream: return "stream";
  }
  return "unknown";
}

#ifndef QUOTA_HOST_TEST
#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>

static constexpr uint32_t kHttpTimeoutMs = 8000;

static void copyArduinoString(char* dest, size_t destSize, const String& value) {
  if (destSize == 0) {
    return;
  }
  const size_t copyLen = value.length() < destSize - 1 ? value.length() : destSize - 1;
  memcpy(dest, value.c_str(), copyLen);
  dest[copyLen] = '\0';
}

static bool contentTypeContains(const char* contentType, const char* expected) {
  return contentType && expected && strstr(contentType, expected) != nullptr;
}

FetchMealMetaResult fetchMealImageMeta(const char* quotaApiUrl, uint8_t slot) {
  FetchMealMetaResult result{};
  result.error = MealImageError::None;
  char url[kMealEndpointUrlMaxLen];
  if (!buildMealEndpointUrlForSlot(quotaApiUrl, "meal/today", slot, url, sizeof(url))) {
    result.error = MealImageError::Url;
    return result;
  }

  HTTPClient http;
  const char* headers[] = {"Content-Type"};
  http.setTimeout(kHttpTimeoutMs);
  http.setReuse(false);
  http.collectHeaders(headers, 1);
  if (!http.begin(url)) {
    result.error = MealImageError::Url;
    http.end();
    return result;
  }

  const int code = http.GET();
  result.httpStatus = code;
  copyArduinoString(result.contentType, sizeof(result.contentType), http.header("Content-Type"));
  Serial1.printf("[meal] meta status=%d content-type=%s\n", code, result.contentType);
  if (code != HTTP_CODE_OK) {
    result.error = MealImageError::Http;
    http.end();
    return result;
  }
  if (!contentTypeContains(result.contentType, "application/json")) {
    result.error = MealImageError::ContentType;
    http.end();
    return result;
  }
  if (http.getSize() > static_cast<int>(kMaxMealMetaResponseBytes)) {
    result.error = MealImageError::ResponseTooLarge;
    http.end();
    return result;
  }

  const String body = http.getString();
  http.end();
  if (body.length() > kMaxMealMetaResponseBytes) {
    result.error = MealImageError::ResponseTooLarge;
    return result;
  }
  const MealMetaParseResult parsed = parseMealMetaJson(body.c_str(), body.length(), &result.meta);
  result.ok = parsed.ok;
  result.error = parsed.error;
  return result;
}

FetchMealRawResult fetchMealImageRaw4bpp(const char* quotaApiUrl, uint8_t slot, uint8_t* dest, size_t destSize) {
  FetchMealRawResult result{};
  result.error = MealImageError::None;
  if (!dest || destSize != kMealImageBytes) {
    result.error = MealImageError::RawSize;
    return result;
  }

  char url[kMealEndpointUrlMaxLen];
  if (!buildMealEndpointUrlForSlot(quotaApiUrl, "meal/today.raw", slot, url, sizeof(url))) {
    result.error = MealImageError::Url;
    return result;
  }

  HTTPClient http;
  const char* headers[] = {"Content-Type"};
  http.setTimeout(kHttpTimeoutMs);
  http.setReuse(false);
  http.collectHeaders(headers, 1);
  if (!http.begin(url)) {
    result.error = MealImageError::Url;
    http.end();
    return result;
  }

  const int code = http.GET();
  result.httpStatus = code;
  copyArduinoString(result.contentType, sizeof(result.contentType), http.header("Content-Type"));
  Serial1.printf("[meal] raw status=%d content-type=%s size=%d\n", code, result.contentType, http.getSize());
  if (code != HTTP_CODE_OK) {
    result.error = MealImageError::Http;
    http.end();
    return result;
  }
  if (!contentTypeContains(result.contentType, "application/vnd.codex.e1002-4bpp")) {
    result.error = MealImageError::ContentType;
    http.end();
    return result;
  }
  if (http.getSize() != static_cast<int>(kMealImageBytes)) {
    result.error = MealImageError::RawSize;
    http.end();
    return result;
  }

  WiFiClient* stream = http.getStreamPtr();
  uint32_t lastProgress = millis();
  size_t total = 0;
  while (total < destSize && millis() - lastProgress < kHttpTimeoutMs) {
    const int available = stream->available();
    if (available <= 0) {
      delay(10);
      continue;
    }
    const size_t wanted = destSize - total;
    const size_t chunk = available < static_cast<int>(wanted) ? static_cast<size_t>(available) : wanted;
    const int read = stream->readBytes(dest + total, chunk);
    if (read > 0) {
      total += static_cast<size_t>(read);
      lastProgress = millis();
    }
  }
  http.end();

  result.bytesRead = total;
  result.ok = total == destSize;
  result.error = result.ok ? MealImageError::None : MealImageError::Stream;
  return result;
}
#endif
