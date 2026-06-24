import type { DeviceDashboardPayload, DeviceQuotaWindow, NormalizedQuotaWindow, SanitizedDashboardData } from "./types";
import { clamp, formatPlanType } from "./util";

export const DEVICE_SCHEMA_VERSION = 1;
export const DEVICE_MAX_RESPONSE_BYTES = 4096;

export function buildDevicePayload(data: SanitizedDashboardData, now = new Date()): DeviceDashboardPayload {
  return {
    schemaVersion: DEVICE_SCHEMA_VERSION,
    generatedAt: Math.floor(now.getTime() / 1000),
    plan: formatPlanType(data.planType),
    status: deviceStatus(data),
    ...(data.usage ? {
      usage: {
        totalTokensText: data.usage.totalTokensText,
        todayTokensText: data.usage.todayTokensText,
      },
    } : {}),
    windows: data.displayWindows.slice(0, 2).map(toDeviceWindow),
  };
}

function deviceStatus(data: SanitizedDashboardData): "fresh" | "cached" | "stale" {
  if (data.stale) {
    return "stale";
  }
  if (data.usingCache) {
    return "cached";
  }
  return "fresh";
}

function toDeviceWindow(window: NormalizedQuotaWindow): DeviceQuotaWindow {
  return {
    key: window.windowKind,
    title: windowTitle(window),
    remainingPercent: clamp(Math.round(window.remainingPercent), 0, 100),
    resetsAt: window.resetsAt,
    resetText: formatDeviceResetText(window.resetsAt),
  };
}

function windowTitle(window: NormalizedQuotaWindow): string {
  if (window.windowKind === "five_hour") {
    return "5 HOUR";
  }
  if (window.windowKind === "weekly") {
    return "WEEK";
  }
  const duration = window.windowDurationMins;
  if (duration === null) {
    return "WINDOW";
  }
  if (duration < 60) {
    return `${duration} MIN`;
  }
  if (duration % 1440 === 0) {
    return `${duration / 1440} DAY`;
  }
  if (duration % 60 === 0) {
    return `${duration / 60} HOUR`;
  }
  return `${duration} MIN`;
}

function formatDeviceResetText(resetsAt: number | null): string {
  if (resetsAt === null) {
    return "UNKNOWN";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(resetsAt * 1000));
  const month = part(parts, "month");
  const day = part(parts, "day");
  const hour = part(parts, "hour");
  const minute = part(parts, "minute");
  return `${month} ${day} ${hour}:${minute}`;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}
