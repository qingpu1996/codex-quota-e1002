import type { NormalizedQuotaWindow, SanitizedDashboardData } from "./types";
import { escapeHtml, formatPlanType } from "./util";

const COLOR_GREEN = "#008000";
const COLOR_YELLOW = "#FFFF00";
const COLOR_RED = "#FF0000";
const COLOR_BLUE = "#0000FF";
const COLOR_BLACK = "#000000";
const COLOR_WHITE = "#FFFFFF";

export function renderDashboardHtml(data: SanitizedDashboardData): string {
  const cards = data.displayWindows.slice(0, 2);
  while (cards.length < 2) {
    cards.push(null as unknown as NormalizedQuotaWindow);
  }

  const resetCreditBadge =
    data.resetCreditAvailableCount !== null
      ? `<div class="reset-badge">RESET ${escapeHtml(data.resetCreditAvailableCount)}</div>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=800,height=480,initial-scale=1">
<title>Codex Quota</title>
<style>
html,body{width:800px;height:480px;margin:0;overflow:hidden;background:${COLOR_WHITE};color:${COLOR_BLACK};font-family:Arial,Helvetica,sans-serif;}
*{box-sizing:border-box;}
.page{width:800px;height:480px;overflow:hidden;display:grid;grid-template-rows:70px 355px 55px;background:${COLOR_WHITE};}
.top{height:70px;display:grid;grid-template-columns:180px 120px 1fr auto;align-items:center;gap:10px;padding:8px 12px;border-bottom:4px solid ${COLOR_BLACK};overflow:hidden;}
.brand{font-size:38px;line-height:44px;font-weight:900;color:${COLOR_BLACK};}
.plan{font-size:24px;line-height:30px;font-weight:900;text-align:center;border:4px solid ${COLOR_BLACK};padding:4px;background:${COLOR_WHITE};color:${COLOR_BLACK};}
.state{font-size:22px;line-height:28px;font-weight:900;text-align:center;border:4px solid ${COLOR_BLACK};padding:4px;background:${data.appServerConnected ? COLOR_GREEN : COLOR_RED};color:${COLOR_WHITE};white-space:nowrap;overflow:hidden;}
.reset-badge{font-size:20px;line-height:28px;font-weight:900;border:4px solid ${COLOR_BLACK};padding:3px 8px;background:${COLOR_BLUE};color:${COLOR_WHITE};white-space:nowrap;}
.main{height:355px;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;overflow:hidden;}
.card{height:331px;border:4px solid ${COLOR_BLACK};display:grid;grid-template-rows:42px 88px 48px 42px 42px 45px;padding:10px;overflow:hidden;background:${COLOR_WHITE};color:${COLOR_BLACK};}
.card-title{font-size:26px;line-height:32px;font-weight:900;white-space:nowrap;overflow:hidden;color:${COLOR_BLACK};}
.percent{font-size:72px;line-height:82px;font-weight:900;text-align:center;color:${COLOR_BLACK};}
.bar{height:38px;border:4px solid ${COLOR_BLACK};background:${COLOR_WHITE};overflow:hidden;}
.fill{height:30px;background:${COLOR_GREEN};}
.meta{font-size:20px;line-height:26px;font-weight:800;white-space:nowrap;overflow:hidden;color:${COLOR_BLACK};}
.source{font-size:18px;line-height:24px;font-weight:800;white-space:nowrap;overflow:hidden;color:${COLOR_BLACK};}
.empty{display:flex;align-items:center;justify-content:center;text-align:center;font-size:28px;line-height:36px;font-weight:900;padding:20px;}
.bottom{height:55px;display:grid;grid-template-columns:1fr 150px 130px;gap:8px;align-items:center;padding:6px 12px;border-top:4px solid ${COLOR_BLACK};overflow:hidden;}
.foot{font-size:18px;line-height:24px;font-weight:900;white-space:nowrap;overflow:hidden;color:${COLOR_BLACK};}
.cache{font-size:18px;line-height:24px;font-weight:900;text-align:center;border:4px solid ${COLOR_BLACK};padding:3px;background:${data.usingCache || data.stale ? COLOR_YELLOW : COLOR_GREEN};color:${COLOR_BLACK};}
.tz{font-size:18px;line-height:24px;font-weight:900;text-align:center;white-space:nowrap;overflow:hidden;color:${COLOR_BLACK};}
</style>
</head>
<body>
<main class="page">
  <header class="top">
    <div class="brand">CODEX</div>
    <div class="plan">${escapeHtml(formatPlanType(data.planType))}</div>
    <div class="state">${escapeHtml(data.appServerConnected ? "服务正常" : "使用缓存")}</div>
    ${resetCreditBadge}
  </header>
  <section class="main">
    ${cards.map((card) => renderCard(card)).join("\n    ")}
  </section>
  <footer class="bottom">
    <div class="foot">最近同步 ${escapeHtml(formatSyncTime(data.lastSuccessAt))} · ${escapeHtml(data.statusText)}</div>
    <div class="cache">${escapeHtml(data.usingCache || data.stale ? "数据可能已过期" : "实时缓存")}</div>
    <div class="tz">${escapeHtml(data.timezone)}</div>
  </footer>
</main>
</body>
</html>`;
}

function renderCard(window: NormalizedQuotaWindow | null): string {
  if (!window) {
    return `<article class="card empty">未返回第二个<br>额度窗口</article>`;
  }

  const color = colorForRemaining(window.remainingPercent);
  const title = `${window.displayName}`;
  const source = window.limitName ? `${window.limitName}` : window.limitId;

  return `<article class="card">
      <div class="card-title">${escapeHtml(title)}</div>
      <div class="percent">${escapeHtml(window.remainingPercent)}%</div>
      <div class="bar"><div class="fill" style="width:${escapeHtml(window.remainingPercent)}%;background:${color};"></div></div>
      <div class="meta">重置 ${escapeHtml(window.resetAbsoluteText)}</div>
      <div class="meta">${escapeHtml(window.resetRelativeText)} · 已用 ${escapeHtml(window.usedPercent)}%</div>
      <div class="source">${escapeHtml(source)} ${window.reached ? "· 已触达" : ""}</div>
    </article>`;
}

function colorForRemaining(percent: number): string {
  if (percent > 50) {
    return COLOR_GREEN;
  }
  if (percent >= 20) {
    return COLOR_YELLOW;
  }
  return COLOR_RED;
}

function formatSyncTime(value: string | null): string {
  if (!value) {
    return "暂无";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
