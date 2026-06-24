import type { NormalizedQuotaWindow, NormalizedUsageSummary, SanitizedDashboardData } from "./types";
import { clamp } from "./util";

type UnknownRecord = Record<string, unknown>;

export function normalizeQuotaData(
  accountResponse: unknown,
  rateLimitsResponse: unknown,
  options: { now?: Date; usingCache?: boolean; appServerConnected?: boolean; usageResponse?: unknown } = {},
): SanitizedDashboardData {
  const now = options.now ?? new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  const accountPlanType = extractPlanTypeFromAccount(accountResponse);
  const resetCreditAvailableCount = extractResetCreditCount(rateLimitsResponse);
  const windows = dedupeWindows(collectWindows(rateLimitsResponse, accountPlanType, now, timezone));
  const displayWindows = selectDisplayWindows(windows);
  const usage = extractUsageSummary(options.usageResponse, now, timezone);
  const lastSuccessAt = now.toISOString();
  const appServerConnected = options.appServerConnected ?? true;
  const usingCache = options.usingCache ?? false;

  return {
    version: 1,
    planType: accountPlanType ?? firstPlanType(windows),
    windows,
    displayWindows,
    resetCreditAvailableCount,
    usage,
    lastSuccessAt,
    generatedAt: now.toISOString(),
    timezone,
    usingCache,
    stale: usingCache,
    appServerConnected,
    statusText: windows.length > 0 ? "额度数据已同步" : "没有可显示的额度窗口",
  };
}

export function markCachedData(
  cached: SanitizedDashboardData,
  options: { now?: Date; appServerConnected?: boolean; statusText?: string } = {},
): SanitizedDashboardData {
  const now = options.now ?? new Date();
  return {
    ...cached,
    generatedAt: now.toISOString(),
    usingCache: true,
    stale: true,
    appServerConnected: options.appServerConnected ?? false,
    statusText: options.statusText ?? "App Server 暂不可用，显示最后一次成功缓存",
  };
}

function collectWindows(
  response: unknown,
  accountPlanType: string | null,
  now: Date,
  timezone: string,
): NormalizedQuotaWindow[] {
  const root = asRecord(response);
  if (!root) {
    return [];
  }

  const buckets = collectBuckets(root);
  const windows: NormalizedQuotaWindow[] = [];

  for (const { key, bucket } of buckets) {
    for (const source of ["primary", "secondary"] as const) {
      const window = asRecord(bucket[source]);
      if (!window) {
        continue;
      }

      const usedRaw = readNumber(window.usedPercent);
      if (usedRaw === null) {
        continue;
      }

      const duration = readNullableNumber(window.windowDurationMins);
      const resetsAt = readNullableNumber(window.resetsAt);
      const usedPercent = clamp(Math.round(usedRaw), 0, 100);
      const remainingPercent = clamp(Math.round(100 - usedRaw), 0, 100);
      const bucketPlanType = readString(bucket.planType);
      const rateLimitReachedType = readString(bucket.rateLimitReachedType);
      const kind = classifyWindow(duration);
      const limitId = readString(bucket.limitId) ?? key;
      const limitName = readString(bucket.limitName);

      windows.push({
        limitId,
        limitName,
        sourceBucket: `${key}.${source}`,
        usedPercent,
        remainingPercent,
        windowDurationMins: duration,
        resetsAt,
        resetAbsoluteText: formatResetAbsolute(resetsAt, timezone),
        resetRelativeText: formatResetRelative(resetsAt, now),
        planType: accountPlanType ?? bucketPlanType,
        reached: rateLimitReachedType !== null || remainingPercent <= 0,
        displayName: displayNameForWindow(kind, duration),
        windowKind: kind,
      });
    }
  }

  return windows;
}

function collectBuckets(root: UnknownRecord): Array<{ key: string; bucket: UnknownRecord }> {
  const byLimitId = asRecord(root.rateLimitsByLimitId);
  if (byLimitId && Object.keys(byLimitId).length > 0) {
    return Object.entries(byLimitId)
      .filter((entry): entry is [string, UnknownRecord] => Boolean(asRecord(entry[1])))
      .map(([key, value]) => ({ key, bucket: value as UnknownRecord }));
  }

  const legacy = asRecord(root.rateLimits);
  return legacy ? [{ key: readString(legacy.limitId) ?? "legacy", bucket: legacy }] : [];
}

function selectDisplayWindows(windows: NormalizedQuotaWindow[]): NormalizedQuotaWindow[] {
  const selected: NormalizedQuotaWindow[] = [];
  const fiveHour = pickMostConstrained(windows.filter((window) => window.windowKind === "five_hour"));
  const weekly = pickMostConstrained(windows.filter((window) => window.windowKind === "weekly"));

  if (fiveHour) {
    selected.push(fiveHour);
  }
  if (weekly && weekly !== fiveHour) {
    selected.push(weekly);
  }

  if (selected.length === 0) {
    return windows.slice().sort(windowSort).slice(0, 2);
  }

  if (selected.length === 1) {
    const next = windows
      .filter((window) => !sameWindowIdentity(window, selected[0]))
      .sort(windowSort)[0];
    if (next) {
      selected.push(next);
    }
  }

  return selected.slice(0, 2);
}

function pickMostConstrained(windows: NormalizedQuotaWindow[]): NormalizedQuotaWindow | null {
  if (windows.length === 0) {
    return null;
  }
  return windows.slice().sort(windowSort)[0];
}

function windowSort(a: NormalizedQuotaWindow, b: NormalizedQuotaWindow): number {
  if (a.reached !== b.reached) {
    return a.reached ? -1 : 1;
  }
  if (a.remainingPercent !== b.remainingPercent) {
    return a.remainingPercent - b.remainingPercent;
  }
  return (a.windowDurationMins ?? Number.MAX_SAFE_INTEGER) - (b.windowDurationMins ?? Number.MAX_SAFE_INTEGER);
}

function dedupeWindows(windows: NormalizedQuotaWindow[]): NormalizedQuotaWindow[] {
  const seen = new Set<string>();
  const result: NormalizedQuotaWindow[] = [];
  for (const window of windows) {
    const key = JSON.stringify({
      limitId: window.limitId,
      limitName: window.limitName,
      usedPercent: window.usedPercent,
      remainingPercent: window.remainingPercent,
      windowDurationMins: window.windowDurationMins,
      resetsAt: window.resetsAt,
      planType: window.planType,
      reached: window.reached,
    });
    if (!seen.has(key)) {
      seen.add(key);
      result.push(window);
    }
  }
  return result;
}

function sameWindowIdentity(a: NormalizedQuotaWindow, b: NormalizedQuotaWindow): boolean {
  return a.limitId === b.limitId && a.sourceBucket === b.sourceBucket && a.windowDurationMins === b.windowDurationMins;
}

function classifyWindow(durationMins: number | null): "five_hour" | "weekly" | "other" {
  if (durationMins !== null && durationMins >= 240 && durationMins <= 360) {
    return "five_hour";
  }
  if (durationMins !== null && durationMins >= 9000 && durationMins <= 11000) {
    return "weekly";
  }
  return "other";
}

function displayNameForWindow(kind: "five_hour" | "weekly" | "other", durationMins: number | null): string {
  if (kind === "five_hour") {
    return "5 小时额度";
  }
  if (kind === "weekly") {
    return "周额度";
  }
  if (durationMins === null) {
    return "真实额度窗口";
  }
  if (durationMins < 60) {
    return `${durationMins} 分钟额度`;
  }
  if (durationMins % 1440 === 0) {
    return `${durationMins / 1440} 天额度`;
  }
  if (durationMins % 60 === 0) {
    return `${durationMins / 60} 小时额度`;
  }
  return `${durationMins} 分钟额度`;
}

function extractPlanTypeFromAccount(response: unknown): string | null {
  const account = asRecord(asRecord(response)?.account);
  if (!account) {
    return null;
  }
  if (account.type === "chatgpt") {
    return readString(account.planType);
  }
  return null;
}

function extractResetCreditCount(response: unknown): number | null {
  const credits = asRecord(asRecord(response)?.rateLimitResetCredits);
  if (!credits) {
    return null;
  }
  const value = credits.availableCount;
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function extractUsageSummary(response: unknown, now: Date, timezone: string): NormalizedUsageSummary | null {
  const root = asRecord(response);
  if (!root) {
    return null;
  }

  const summary = asRecord(root.summary);
  const totalTokens = readNullableTokenNumber(summary?.lifetimeTokens);
  const peakDailyTokens = readNullableTokenNumber(summary?.peakDailyTokens);
  const todayDate = formatLocalDate(now, timezone);
  const dailyBuckets = Array.isArray(root.dailyUsageBuckets) ? root.dailyUsageBuckets : [];
  const todayBucket = dailyBuckets
    .map((item) => asRecord(item))
    .find((item): item is UnknownRecord => Boolean(item && readString(item.startDate) === todayDate));
  const todayTokens = readNullableTokenNumber(todayBucket?.tokens) ?? 0;

  if (totalTokens === null && peakDailyTokens === null && todayBucket === undefined) {
    return null;
  }

  return {
    totalTokens,
    totalTokensText: formatTokenCount(totalTokens),
    todayTokens,
    todayTokensText: formatTokenCount(todayTokens),
    peakDailyTokens,
    peakDailyTokensText: formatTokenCount(peakDailyTokens),
    todayDate,
  };
}

export function formatTokenCount(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "--";
  }
  const units = ["", "K", "M", "B", "T"];
  let scaled = value;
  let unitIndex = 0;
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex++;
  }
  const decimals = unitIndex === 0 || scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(decimals).replace(/\.0+$|(\.\d)0$/, "$1")}${units[unitIndex]}`;
}

function firstPlanType(windows: NormalizedQuotaWindow[]): string | null {
  return windows.find((window) => window.planType)?.planType ?? null;
}

function formatResetAbsolute(resetsAt: number | null, timezone: string): string {
  if (resetsAt === null) {
    return "重置时间未知";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(resetsAt * 1000));
}

function formatResetRelative(resetsAt: number | null, now: Date): string {
  if (resetsAt === null) {
    return "相对时间未知";
  }
  const diffMins = Math.max(0, Math.round((resetsAt * 1000 - now.getTime()) / 60_000));
  if (diffMins === 0) {
    return "现在重置";
  }
  if (diffMins < 60) {
    return `${diffMins} 分钟后`;
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) {
    return mins === 0 ? `${hours} 小时后` : `${hours} 小时 ${mins} 分后`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} 天后` : `${days} 天 ${restHours} 小时后`;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : readNumber(value);
}

function readNullableTokenNumber(value: unknown): number | null {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function formatLocalDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;
}
