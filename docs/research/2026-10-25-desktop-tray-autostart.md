# 桌面托盘常驻 / 开机自启 / 会话续期 —— 外部做法核对（T543）

> 用途：`T543` 架构评审的模式对照输入（**技术选型归 arch**）。结论只作候选，不构成 PRD 前提。
> 检索日期：2026-10-25。仅取一手来源（官方文档 / 规范 / 平台扩展目录）。

## 待答问题

| #   | 问题                                                                                      | 为何影响决策                                    |
| :-- | :---------------------------------------------------------------------------------------- | :---------------------------------------------- |
| Q1  | Electron `Tray` 三平台支持条件与差异（Linux 是否依赖 StatusNotifierItem / AppIndicator）  | 决定「托盘不可用」能否被程序判定 ⇒ AC9 判定口径 |
| Q2  | 隐藏窗口后定时器是否被节流（`backgroundThrottling`），是否影响 `document.visibilityState` | 决定常驻态提醒时效指标与实现方式                |
| Q3  | `app.setLoginItemSettings/getLoginItemSettings` 平台边界与「是否真生效」判据              | 决定 AC4 / AC10 能否落地                        |
| Q4  | 休眠/唤醒的补扫触发点                                                                     | 决定「休眠不提醒」是否必须写进限制              |
| Q5  | macOS 13+ 登录项批准态、ad-hoc 签名兼容性                                                 | 决定 macOS 自启降级路径                         |

## 来源与结论

- [Tray | Electron](https://www.electronjs.org/docs/latest/api/tray) · 访问 2026-10-25
    - Linux：默认用 StatusNotifierItem，不可用时回落 `GtkStatusIcon`；`click` 语义由桌面环境决定。
    - macOS：图标须为 Template Image（16×16 + `@2x` 144dpi），否则深浅色不自动反色；Windows 建议 ICO。
    - 结论：**Electron 不提供「托盘是否可见」的查询 API**；构造成功 ≠ 用户看得见。
- [BrowserWindow · Page visibility](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility) 与 [WebPreferences.backgroundThrottling](https://www.electronjs.org/docs/latest/api/structures/web-preferences) · 访问 2026-10-25
    - `backgroundThrottling` 默认 `true`（隐藏/最小化后节流动画与定时器）；**关闭后 `visibilityState` 保持 `visible`**（即使最小化/遮挡/隐藏）。
    - macOS 还会因窗口被完全遮挡而 `hidden`；其余平台仅最小化或 `win.hide()` 时 `hidden`。
    - `paintWhenInitiallyHidden` 默认 `true`（`show:false` 首屏初始仍是 visible）。
    - 结论：无需改提醒引擎，只要窗口关掉节流即保持 10s 轮询；代价是隐藏态仍绘制/动画。
- [app.setLoginItemSettings](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows) / [getLoginItemSettings](https://www.electronjs.org/docs/latest/api/app#appgetloginitemsettingsoptions-macos-windows) · 访问 2026-10-25（并以本仓 `electron@43.4.1` 的 `electron.d.ts` 复核：`@platform darwin,win32`）
    - **Linux 无该 API**；Windows 有 `executableWillLaunchAtLogin`（用户在任务管理器禁用 ⇒ `openAtLogin=true` 但该值 `false`）；macOS 有 `status: not-registered/enabled/requires-approval/not-found`。
    - macOS 官方说明：应用需签名 + 公证，否则 `openAtLogin` **可能静默不生效**。
    - 结论：三平台都应以**回读结果**为准，不能以「写入成功」当生效。
- [Desktop Application Autostart Specification](https://specifications.freedesktop.org/autostart-spec/latest/) · 访问 2026-10-25
    - `~/.config/autostart/*.desktop` 在用户登录后启动；`Hidden=true` 忽略该条目；`TryExec` 不存在则不得启动。
    - 结论：Linux 自启可自写该文件并用 `TryExec` 防「文件被移动/卸载后仍尝试启动」。
- [powerMonitor | Electron](https://www.electronjs.org/docs/latest/api/power-monitor) · 访问 2026-10-25
    - 有 `suspend` / `resume`（全平台）、`lock-screen`/`unlock-screen`（macOS/Windows）。
    - 结论：休眠期间定时器不运行，唤醒后靠既有 10s 轮询补扫即可；休眠期不承诺送达。
- [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/) · 访问 2026-10-25
    - GNOME 的托盘图标由**扩展**提供（非内置），当前覆盖 Shell 45–51。
    - 结论：GNOME 无该扩展时托盘「创建成功但不可见」，且无法从程序判定。

## 适配三栏

| 它解决什么         | 适用条件                       | 本项目差异（采纳 / 改造 / 不采纳 + 理由）                                                                                 |
| :----------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| 隐藏窗口仍按时提醒 | 进程常驻、渲染层是提醒引擎宿主 | **采纳**：`backgroundThrottling:false`（零引擎改动）；代价=隐藏态仍绘制，按 T2 抽样验收                                   |
| 系统级开机自启     | 需平台级登记 + 可判定是否生效  | **改造**：Win/mac 用 Electron API + 回读三态；**Linux 自写 XDG 文件**（API 不存在）；均有可复制恢复动作                   |
| 托盘常驻入口       | 桌面环境提供 SNI/AppIndicator  | **采纳但降级可见**：构造失败 ⇒ 旧行为退出；Linux 不可见风险 ⇒ 设置页给可达退出路径（待 PM 裁定 AC9 拆态）                 |
| 常驻会话续期       | 服务端会话有绝对期、JWT 短寿命 | **采纳**：周期 checkin + 退避 + 空闲门；**不采纳**「把 JWT 拉到 7 天」（安全姿态变更）、「旧 token 宽限」（暂留升级路径） |
| 唤醒后补扫         | 系统可休眠                     | **采纳**：不新增机制（轮询自愈）；**明确不承诺**休眠期送达，写入 PRD 限制                                                 |