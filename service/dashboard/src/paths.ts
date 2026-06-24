import os from "node:os";
import path from "node:path";

export const APP_NAME = "CodexQuotaDashboard";
export const LABEL = "com.qingpu.codex-quota-dashboard";

export function appSupportDir(home = os.homedir()): string {
  return path.join(home, "Library", "Application Support", APP_NAME);
}

export function logsDir(home = os.homedir()): string {
  return path.join(home, "Library", "Logs", APP_NAME);
}

export function configPath(home = os.homedir()): string {
  return path.join(appSupportDir(home), "config.json");
}

export function cachePath(home = os.homedir()): string {
  return path.join(appSupportDir(home), "cache.json");
}

export function launchAgentPath(home = os.homedir()): string {
  return path.join(home, "Library", "LaunchAgents", `${LABEL}.plist`);
}
