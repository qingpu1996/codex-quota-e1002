# codex-quota-e1002-firmware

这是 Seeed Studio reTerminal E1002 的自定义 Arduino/PlatformIO 固件。设备从 Mac 局域网服务获取 Codex 额度 JSON 和今日食谱 raw 图片，用 Seeed_GFX 直接绘制到 800 x 480 六色电子纸，然后进入 deep sleep。

固件不运行 HTML、CSS、JavaScript、iframe 或浏览器。唯一的 HTML 是设备本地 SoftAP 配网页面，用于输入 Wi-Fi 和 Mac API URL。

## 硬件和平台

- 设备：Seeed Studio reTerminal E1002。
- MCU：XIAO ESP32-S3 Sense 配置。
- Framework：Arduino。
- PlatformIO 平台：Seeed 官方 `platform-seeedboards`。
- 屏幕驱动：Seeed_GFX。
- 屏幕配置：`BOARD_SCREEN_COMBO 521`。
- PSRAM：OPI PSRAM。
- 上传速度：`115200`。
- 串口日志：`Serial1.begin(115200, SERIAL_8N1, 44, 43)`。

`platformio.ini` 已固定关键依赖：

```ini
platform = https://github.com/Seeed-Studio/platform-seeedboards.git#9e97e019ace102952d03f299a94ee8353f5a8043
lib_deps =
    https://github.com/Seeed-Studio/Seeed_GFX#a2de1abca0597c202193f22d01e9fa35d1ff613b
    bblanchon/ArduinoJson@7.4.3
```

不要手写或猜测屏幕底层引脚、刷新协议或 ePaper 初始化流程。

## 构建目标

PlatformIO 只保留一个正式 env：

| Env | 功能 |
| --- | --- |
| `reterminal_e1002` | 根据本地 feature 配置生成当前选择的固件 |

模块选择由 ignored 的 `.local/features.env` 或同名环境变量决定。当前可选模块：

| Feature | `0` | `1` |
| --- | --- | --- |
| `FEATURE_MEAL` | 只包含 Codex 额度页 | Codex 额度页 + 今日食谱页 |

默认 `FEATURE_MEAL=1`。

## 交互式选择

```bash
cd firmware/e1002
scripts/install.sh
```

脚本会显示模块列表：

```text
[x] Codex quota dashboard
[x] Wi-Fi setup portal
[x] Deep sleep and three-button navigation
[ ] Daily meal page
```

用空格切换 `Daily meal page`，Enter 确认。脚本最后可以选择：

- 只保存选择。
- 构建固件。
- 构建并烧录固件。

选择会写入本地 ignored 文件：

```text
.local/features.env
```

`scripts/build.sh` 和 `scripts/flash.sh` 会自动读取这个文件。

## 构建和测试

```bash
test/run_host_tests.sh
scripts/build.sh
```

`test/run_host_tests.sh` 运行不依赖硬件的 C++ host tests。

也可以直接临时覆盖 feature：

```bash
FEATURE_MEAL=0 scripts/build.sh
FEATURE_MEAL=1 scripts/build.sh
```

## 烧录和串口

```bash
scripts/flash.sh
scripts/monitor.sh
```

脚本会自动探测唯一的 USB 串口。如果没有串口或存在多个候选串口，脚本会停止，不会猜测。

调试时建议：

- 使用 USB-C 数据线。
- E1002 电源开关保持 ON。
- 先拔掉 MicroSD 卡。
- 上传失败时先确认 115200 baud，并按 RESET 或绿色键唤醒设备。
- 不改开发板型号、不改屏幕引脚、不随便 erase flash。

## 页面

当前页面注册表由 `FEATURE_MEAL` 决定，但 PlatformIO env 始终是 `reterminal_e1002`：

| Slot | PageId | RefreshPolicy | 内容 |
| --- | --- | --- | --- |
| 1 | `CodexQuota` | `PeriodicData` | Codex 额度、套餐、token 用量和电量 |
| 2 | `TodayMeal` | `PeriodicData` | 今日食谱 raw 图片，仅在 `FEATURE_MEAL=1` 时注册 |

所有页面右下角显示 `P1/2`、`P2/2` 或 `P1/1` 形式的页码。页码由 `PageManager` 根据页面注册表生成，不在页面里硬编码。

Page 1 显示：

- 套餐类型。
- 5 小时额度。
- 周额度。
- `TOTAL` 总 token 用量。
- `TODAY` 今日 token 用量。
- 电池电量。

启用每日食谱时，Page 2 显示：

- Mac 服务生成的 800 x 480 食谱图片。
- 当前内部食谱页，例如 `M1/4`。
- 电池电量和页码。

关闭每日食谱时：

- 页面注册表只有 Page 1。
- 页码显示 `P1/1`。
- 左键连按 2 次会判定为无效页码。
- 中键短按或长按都不会切到食谱页。
- 固件不会请求 `/meal/today` 或 `/meal/today.raw`。

## 按键

三颗内置按键均为 active LOW，并作为 EXT1 deep-sleep wake source。

| 物理按键 | Seeed 名称 | GPIO | 行为 |
| --- | --- | --- | --- |
| 右侧绿色键 | KEY0 | GPIO3 | 刷新当前页 |
| 中键 | KEY1 | GPIO4 | 短按切换下一大页；启用食谱时长按切换当前食谱内部页 |
| 左键 | KEY2 | GPIO5 | 连按 N 次直达第 N 页；长按约 1.2 秒进入配网 |

参数：

- 消抖：`40 ms`。
- 中键长按：`900 ms`，到时间即触发，不需要等松手；关闭食谱模块时退化为普通下一页动作。
- 左键多击间隔：`1400 ms`。
- 左键多击总超时：`6000 ms`。
- 进入配网长按：约 `1200 ms`。

左键示例：

```text
FEATURE_MEAL=0:
  左键 1 次 -> Page 1
  左键 2 次 -> 无效，保持原页

FEATURE_MEAL=1:
  左键 1 次 -> Page 1
  左键 2 次 -> Page 2
  左键 3 次 -> 当前只有两页，判定无效并保持原页
```

## 配网

推荐使用设备本地配网页面，而不是把 Wi-Fi 和 API URL 固定写进固件。

从 deep sleep 进入配网：

1. 长按左键 `KEY2 / GPIO5` 约 1.2 秒。
2. 屏幕出现 `WIFI SETUP` 后松手。
3. 连接 Wi-Fi：

```text
SSID: Codex-E1002-Setup
Password: codex-e1002
```

4. 打开：

```text
http://192.168.4.1
```

5. 输入 2.4GHz Wi-Fi、Wi-Fi 密码和 Mac 设备 API URL。

如果设备没有睡眠，可以按住左键再按 RESET，继续按住左键直到 `WIFI SETUP` 出现。

配网页面不会预填完整受保护 URL。如果已经存过 API URL，页面只显示当前 host 和 port；API URL 输入框留空表示保留旧值。

## 可选 secrets.h

`include/secrets.h` 是可选 bootstrap 文件，适合开发或首次烧录时使用。正式使用推荐走配网页面。

示例：

```cpp
#pragma once

#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define QUOTA_API_URL ""
```

`include/secrets.h` 已被 `.gitignore` 忽略，不能提交。固件日志不会打印 Wi-Fi 密码、device token 或完整受保护 URL。

## Mac API

额度页请求：

```text
GET http://<Mac-IP>:19527/api/device/<deviceToken>
```

食谱页请求：

```text
GET http://<Mac-IP>:19527/api/device/<deviceToken>/meal/today?slot=N
GET http://<Mac-IP>:19527/api/device/<deviceToken>/meal/today.raw?slot=N
```

这些请求只会在 `FEATURE_MEAL=1` 且当前页面是 `TodayMeal` 时发生。

`meal/today.raw` 必须返回：

- `Content-Type: application/vnd.codex.e1002-4bpp`
- 800 x 480
- 4bpp
- 192000 bytes

固件只把 API host 和 port 写入日志，不打印完整 URL。

## 刷新策略

每次唤醒的主流程都在 `setup()` 中完成，`loop()` 为空。

会触发联网的情况：

- 冷启动。
- 5 分钟 timer wake，当前页需要数据。
- 页面切换到需要数据的页。
- 绿色键手动刷新。
- 中键长按切换食谱内部页，仅限 `FEATURE_MEAL=1`。

会触发完整刷新的情况：

- 冷启动。
- 页面切换。
- 绿色键手动刷新。
- 食谱内部页切换。
- 页面显示 hash 变化。
- 连续约 12 个周期后的一小时强制刷新。

页面 hash 包含 PageId、页码、显示内容、电池显示值和食谱图片 hash；不把 `generatedAt` 作为额度页强制刷新依据。

## Deep Sleep

每个工作周期结束前，固件会：

1. 关闭 HTTP 和 Wi-Fi。
2. 等待三颗按键释放。
3. 配置 5 分钟 timer wake。
4. 配置 GPIO3、GPIO4、GPIO5 的 EXT1 `ANY_LOW` 唤醒。
5. 配置 RTC pull-up 并禁用 pulldown。
6. 进入 deep sleep。

如果某个按键持续 LOW，固件会记录警告，本周期退化为 timer-only sleep，避免立即反复唤醒。

电子纸断电后保留画面。网络或 API 失败时：

- 已显示过有效当前页：保留旧画面并睡眠。
- 没有任何有效画面：显示 `SETUP ERROR` 或进入本地配网。
- 食谱图片失败：显示简洁错误页或保留已有食谱画面。

## 电池显示

页脚显示：

```text
BAT xx%
```

固件通过 `GPIO21` 启用测量电路，通过 `GPIO1` 读取 ADC，按 reTerminal E Series 的电压曲线映射百分比。读数异常时显示：

```text
BAT --%
```

## 新增页面

新增第 3 页的最小步骤：

1. 在 `PageId` 中加入新枚举。
2. 在 `src/page_manager.cpp` 的 `kPages` 注册表中加入一项。
3. 实现该页 payload hash 和渲染逻辑。
4. 在 `PageManager::renderCurrentPage()` 中分发渲染。

不需要修改 `InputManager`。左键 N 连击和中键下一页会自动使用页面注册表数量。

页面模块不应直接：

- 读取按键。
- 连接 Wi-Fi。
- 修改当前页面。
- 进入 deep sleep。

## 局域网检查

Mac IP 建议在路由器中设置 DHCP Reservation。若 Mac IP 改变，需要通过配网页面更新设备 API URL。

从手机验证：

```text
http://<Mac-IP>:19527/api/device/<deviceToken>
```

手机、E1002 和 Mac 需要在互相可达的局域网内。Guest Wi-Fi、AP Isolation、VLAN 防火墙和 macOS 防火墙都可能阻止访问。

## 恢复官方 SenseCraft HMI

若要恢复官方 SenseCraft HMI：

1. 下载 Seeed 官方 reTerminal E1002 / SenseCraft HMI 固件包。
2. 按 Seeed 文档进入官方刷机模式。
3. 使用官方恢复工具或文档中的 `esptool` 命令刷回官方固件。
4. 重启 E1002。
5. 重新部署 SenseCraft HMI 页面。

恢复官方固件不需要删除 Mac 服务；只是这套自定义固件只依赖 JSON 和图片 API。
