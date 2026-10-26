# ADR：桌面端托盘常驻 / 开机自启 / 会话续期

- 状态：**已落地（`v1.13.0`，2026-10-26）** —— PM 2026-10-25 裁定：`P1` = **A 三平台统一关窗隐藏** · `P2` 采纳（AC9 拆两态 + 设置页退出）· `P3` 采纳（送达补「未休眠」前提）· `P4` 采纳（托盘不可用时自启显示窗口）；`RV1–RV11` 已并入 PRD v1.1。
- 更新：2026-10-25
- Owner：arch-designer
- 指针：`docs/prds/2026-10-25-desktop-tray-autostart.md` · `docs/reports/T543-arch-review.md` · `docs/research/2026-10-25-desktop-tray-autostart.md`

## 背景

- 桌面端关窗即退出（macOS 不退出但窗口被销毁 ⇒ 渲染层提醒引擎随之停止）⇒「不漏提醒」在桌面端不成立。
- 客户端 checkin 仅冷启动触发（`DEF-15`），JWT 48h、会话 7 天绝对期（D2 不放开）⇒ 常驻 >48h 被强制回登录页。
- 服务端无过期会话清理（`DEF-14`）；Electron 43 的 `setLoginItemSettings` **仅 macOS/Windows**（Linux 需 XDG）。

## 决策

1. **常驻形态**：单 `BrowserWindow`，关窗改 `hide()`；`webPreferences.backgroundThrottling: false` ⇒ 隐藏态 `visibilityState` 恒 `visible`，既有提醒引擎零改动继续 10s 轮询；自启以 `--autostart` argv 静默启动（窗口创建、跳过 `show()`）。
2. **自启**：Windows/macOS 用 Electron API + **回读**判三态；Linux 自写 `~/.config/autostart/nao-todo.desktop`（AppImage 取 `process.env.APPIMAGE`，带 `TryExec`）。
3. **续期**：客户端每 12h（±10% 抖动）+ 唤醒/联网触发 checkin，退避至 30min 封顶；服务端**不延长 `expired_at`**（7 天绝对期不变）；轮换加空闲门 + 10s「轮换窗」护栏，防在途旧 token 触发 10041 自伤登出。
4. **服务端清理**：每日 03:10 批量硬删 —— `expired_at < now-7d`、`deleted_at < now-1d`；500 行/批、≤20 批；`SESSION_CLEANUP_*` 可停，无 DDL。
5. **降级可见**：托盘构造失败 ⇒ 关窗即退出；自启回读非 `enabled` ⇒ 显示「未生效」+ 重试；状态经主进程 IPC 供设置页「提醒 → 桌面常驻」。

## 理由

1. 业务：唯一同时满足「关窗仍提醒」与「不新增运行时依赖」的路径；隐藏窗口复用既有单写者与提醒账本。
2. 成熟度：`Tray` / `backgroundThrottling` / `powerMonitor` 为官方能力；Linux 自启走 freedesktop 规范。
3. 团队：落点集中在 `apps/desktop/src/main`；渲染层仅加桌面专属 hook（Web 端零行为变化）。
4. 成本：零新依赖、服务端零 DDL；清理任务可开关回滚。

## 对照过的备选模式

1. **维持现状（关窗即退出）** —— 适用：无「关窗提醒」诉求；代价：核心承诺继续缺失；**不采纳**（本批动因）。
2. **独立后台进程 / 第二个隐藏窗口专职提醒** —— 适用：渲染层体积不可控、需隔离；代价：DB 双写者、账本与 Web Locks 跨进程失效、内存翻倍；**不采纳**（违背单写者假设）。
3. **关窗最小化到任务栏** —— 适用：不需要托盘交互；代价：任务栏占位、与 D0① 语义不符；**不采纳**。
4. **Linux 用 Electron `setLoginItemSettings`** —— 不成立（43.4.1 类型定义 `@platform darwin,win32`）；**不采纳**。
5. **JWT 直接放到 7 天、取消周期 checkin** —— 适用：可接受更长 bearer 寿命；代价：凭据被盗窗口 48h→7d，属安全姿态变更；**本批不采纳**（D2 精神，需单独立项）。
6. **服务端为旧 token 留 2 分钟宽限** —— 适用：客户端无法保证空闲窗口；代价：新增两列 + 校验分支；**暂不采纳**（R2 竞态若复现则升级为此）。
7. **过期会话软删（GORM 默认 `Delete`）** —— 适用：需留审计；代价：行仍在表内，膨胀未解；**不采纳**（硬删 + 7 天宽限已够复盘）。

## 后果与风险

- 正面：关窗 / 自启 / 续期均有可判定的用户可见状态；会话表不再无界膨胀。负面：隐藏态不再「可见性即停」⇒ 渲染层持续绘制，CPU/耗电须抽样验收（阈值见评审报告 T2）。
- 风险：`R5` 字面要求与「macOS 关窗仍提醒」互斥（待 PM 裁定）；系统休眠期无法送达；GNOME 无扩展时托盘不可见；macOS ad-hoc 签名下登录项可能登记失败（`DEF-75` B 档残留）。

## 限制与已知边界

- 「常驻」= 进程持续运行；关机/休眠 >48h 后 JWT 已过期，仍需重新登录（会话未到 7 天不构成免密依据）。
- 通知能否弹出仍取决于系统通知权限与免打扰（R2 不变）；Linux 托盘可见性无法程序化判定；清理只管 `user_sessions`，空 `device_id` 仍允许（清理兜底，不设活跃会话上限）。

## 相关指针

- 影响面 / NFR 指标 / 平台矩阵 / 部署步骤：`docs/reports/T543-arch-review.md`
- 外部依据：`docs/research/2026-10-25-desktop-tray-autostart.md`

## 参考来源

- [Tray | Electron](https://www.electronjs.org/docs/latest/api/tray) · 访问 2026-10-25 · Linux 用 StatusNotifierItem，macOS 需 Template 图。
- [BrowserWindow · Page visibility](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility) · 访问 2026-10-25 · 关闭 `backgroundThrottling` 后 `visibilityState` 恒 `visible`。
- [app.setLoginItemSettings](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows) · 访问 2026-10-25 · 平台仅 macOS/Windows；macOS 需签名公证。
- [Desktop Application Autostart Specification](https://specifications.freedesktop.org/autostart-spec/latest/) · 访问 2026-10-25 · `~/.config/autostart`、`Hidden` / `TryExec` 语义。
- [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/) · 访问 2026-10-25 · GNOME 托盘依赖扩展。