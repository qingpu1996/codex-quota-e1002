# codex-quota-dashboard

局域网内运行的 Codex 套餐额度仪表盘，保留 Seeed Studio reTerminal E1002 的 SenseCraft HMI HTML Widget 实时 iframe 页面，同时提供给自定义 Arduino 固件使用的设备 JSON API。

## 架构

链路：

```text
Codex CLI 登录状态
  -> codex app-server
  -> Mac mini 局域网 HTTP 服务
  -> SenseCraft HTML Widget iframe / E1002 JSON 固件
  -> reTerminal E1002
```

服务由当前 macOS 用户的 LaunchAgent 运行。Node 进程长期启动 `codex app-server --stdio`，通过 JSONL JSON-RPC 调用：

- `initialize`
- `initialized`
- `account/read`，使用 `refreshToken=false`
- `account/rateLimits/read`
- `account/usage/read`

页面请求只读取内存缓存，不会在每次 HTTP 访问时重新启动 App Server。最后一次成功的脱敏数据会写入：

```text
~/Library/Application Support/CodexQuotaDashboard/cache.json
```

## 数据来源和隐私边界

数据来自当前 Mac 用户已经登录的 Codex CLI 会话，所以不需要 OpenAI API Key。

项目不会读取、复制或输出 `~/.codex/auth.json`。认证细节只由 `codex app-server` 自己处理，本服务只接收 `account/read`、`account/rateLimits/read` 和 `account/usage/read` 返回后归一化出的脱敏字段。

页面和 API 不显示邮箱、账户 ID、OAuth Token、Cookie 或原始 RPC 响应。错误 token 和未知路径统一返回 404。

## SenseCraft iframe 原理

当前 SenseCraft HMI HTML Widget 会由设备侧 iframe 实时加载 URL。只要 E1002 与 Mac mini 在同一个局域网，E1002 就能直接访问：

```text
http://<Mac局域网IPv4>:19527/e1002/<随机Token>
```

这个项目不需要 Cloudflare Tunnel、公网入口、端口转发、域名或 HTTPS。它只监听配置中的局域网 IPv4。

## E1002 自定义固件 JSON API

自定义 Arduino 固件不要加载 HTML、CSS、JavaScript、iframe 或浏览器。设备只请求独立 token 保护的 JSON：

```text
http://<Mac局域网IP>:19527/api/device/<deviceToken>
```

`deviceToken` 与浏览器页面 token 独立，长度至少 32 字节随机值。接口只返回屏幕绘制所需字段：

```json
{
  "schemaVersion": 1,
  "generatedAt": 1780000000,
  "plan": "PRO",
  "status": "fresh",
  "usage": {
    "totalTokensText": "1.4B",
    "todayTokensText": "3.62M"
  },
  "windows": [
    {
      "key": "five_hour",
      "title": "5 HOUR",
      "remainingPercent": 73,
      "resetsAt": 1780003600,
      "resetText": "Jun 23 21:40"
    }
  ]
}
```

接口带 `Cache-Control: no-store`，错误 token 返回 404，不返回邮箱、账户 ID、OAuth Token、Cookie 或原始 RPC。

## 食谱 Excel

食谱页是可选功能。默认读取：

```text
~/Documents/codex-quota-dashboard/meal-plan.xlsx
```

也可以通过环境变量覆盖：

```bash
CODEX_MEAL_EXCEL_PATH=/path/to/meal-plan.xlsx scripts/restart.sh
```

Excel 路径不应提交到 Git；仓库只包含解析和渲染逻辑。

## 安装

```bash
cd /path/to/codex-quota-dashboard
scripts/install-launchd.sh
```

安装脚本会：

- 探测 `codex`、`node`、默认网络接口、局域网 IPv4 和 MAC 地址。
- 安装 npm 依赖。
- 构建 TypeScript。
- 创建 `~/Library/Application Support/CodexQuotaDashboard/config.json`。
- 生成至少 32 字节随机 token。
- 安装并启动当前用户级 LaunchAgent：

```text
~/Library/LaunchAgents/com.qingpu.codex-quota-dashboard.plist
```

## 启动、停止、重启

```bash
scripts/restart.sh
scripts/uninstall-launchd.sh
```

`uninstall-launchd.sh` 只卸载 LaunchAgent，保留配置和缓存。

## 状态和日志

```bash
scripts/status.sh
scripts/logs.sh
scripts/logs.sh follow
```

日志路径：

```text
~/Library/Logs/CodexQuotaDashboard/stdout.log
~/Library/Logs/CodexQuotaDashboard/stderr.log
```

## 更新局域网 IP

如果 Mac mini 的 DHCP 地址变化，服务不会静默改 URL。状态脚本会显示 configured IP 和 current IP 的差异。

显式更新：

```bash
scripts/update-lan-ip.sh
```

更新后需要把新的 URL 填回 SenseCraft。

## 重新生成访问 Token

```bash
scripts/regenerate-token.sh
```

这会改变最终页面 URL。重新生成后需要更新 SenseCraft HTML Widget。

## Codex 重新登录后的处理

如果 Codex CLI 登录状态过期，先在终端里重新登录 Codex CLI，然后重启服务：

```bash
scripts/restart.sh
```

服务失败期间会显示最后一次成功缓存，并标记“数据可能已过期”。

## macOS 防火墙

如果 macOS 防火墙弹窗询问是否允许 Node 接收入站连接，需要点击“允许”，否则 E1002 可能无法从局域网访问 Mac mini。

不要用 `sudo` 修改系统防火墙；本项目只安装当前用户 LaunchAgent。

## E1002 与 Mac 不同网时

如果 E1002 和 Mac mini 不在同一个二层/三层可达网络，iframe 会空白或加载失败。常见原因：

- E1002 在 Guest Wi-Fi。
- 路由器开启 AP Isolation。
- VLAN 防火墙阻止设备访问 Mac。
- Mac IP 已改变。
- SenseCraft 中 token 仍是旧 token。
- macOS 防火墙拒绝 Node 入站连接。

## 为什么建议 DHCP 地址保留

SenseCraft 中填写的是固定 IPv4 URL。若 Mac mini 的 IPv4 改变，E1002 仍会请求旧地址。建议在路由器中为 Mac 默认接口的 MAC 地址设置 DHCP 地址保留。

优先使用 IPv4 而不是 `mac-mini.local`，是因为嵌入式设备和隔离 Wi-Fi 对 mDNS 的支持不稳定，而 IPv4 地址在同网段内更可预测。

## SenseCraft 配置步骤

1. 确认 E1002 与 Mac mini 连接到同一个局域网。
2. 打开 SenseCraft HMI。
3. 创建或选择 reTerminal E1002 的 800×480 页面。
4. 添加 HTML Widget。
5. 选择当前支持的实时 Web URL / iframe 加载模式。
6. 填写：

```text
http://<Mac局域网IP>:19527/e1002/<随机Token>
```

7. 将 Widget 调整为铺满整个画布。
8. Preview。
9. Apply 或 Deploy 到 E1002。
10. 刷新间隔设为 5 分钟。
11. 若显示空白，依次检查：
    - Mac 服务状态
    - URL 是否正确
    - E1002 是否与 Mac 同网
    - Mac 防火墙
    - 路由器是否开启 AP Isolation
    - E1002 是否位于 Guest Wi-Fi
    - Token 是否发生变化
    - Mac IP 是否改变

## 开发验证

```bash
npm test
```

测试覆盖 JSONL 分段输入、JSON-RPC 关联和超时、当前和旧版额度字段、primary/secondary、套餐解析、clamp、去重、窗口识别、缓存回退、token 路由、脱敏、iframe 头、CSP、固定 800×480 页面和无外部资源约束。
