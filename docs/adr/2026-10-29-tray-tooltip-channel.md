# ADR：番茄计时写入托盘 tooltip 的窄通道

- 状态：提议
- 更新：2026-10-29
- Owner：arch-designer
- 指针：`docs/prds/2026-10-29-pomodoro-notify-title-round.md`（§五 #2 · §六 NFR · AC7/AC8）· `docs/reports/T574-arch-review.md` · `docs/adr/2026-10-25-desktop-tray-autostart.md`

## 背景

- 托盘 tooltip 是固定串（`apps/desktop/src/main/tray.ts:78`），渲染层没有写入面 ⇒ AC7 不可达。
- 计时引擎在渲染层（250ms tick，秒粒度）；tooltip 是主进程 OS 表面 ⇒ 必须跨进程。
- 既有 IPC 面 = 4 个 `invoke` 窄通道 + 发送方来源校验（`main/ipc.ts`），安全姿态不得放宽。

## 决策

1. 新增**一条单向 `send` 通道**（非 `invoke`）：渲染层 → 主进程，载荷 = **已拼好的单个字符串**（1..64 字符），主进程零拼装、零 i18n。
2. 通道名 `setTrayTooltip`，落在 `main/ipc.ts`；用**独立常量**（`DESKTOP_IPC_CHANNELS` 保持 4 项不变），preload 只加 1 个方法。
3. 节流 = **按值去重**（文案含 `MM:SS` ⇒ 天然 ≤1 次/秒）；不新增定时器、不看窗口可见性；空串/非法载荷 ⇒ 回基线 `NaoTodo`。
4. 全链路**零抛出**：handler try/catch + 不受信来源静默忽略；托盘 `unsupported` / 已销毁 / 桥缺失 ⇒ no-op。

## 理由

1. 业务：同时满足「tooltip 走秒」「窗口收进托盘仍更新」「Web 与无托盘环境零变化」，并复用 #2 的标题文案。
2. 成熟度：`ipcRenderer.send` / `ipcMain.on` / `Tray.setToolTip` 均官方稳定；`backgroundThrottling: false` 已落地并有防回退守卫。
3. 团队：落点集中（`ipc.ts` / `tray.ts` / preload / 1 个桌面 hook）；Web 与移动端零改动。
4. 成本：1 方法 + 1 handler，无依赖、无定时器；`send` 无 Promise 面 ⇒ 不会产生 AC8 禁止的未捕获拒绝。

## 对照过的备选模式

1. **维持现状（固定 tooltip）** —— 适用：无走秒诉求；代价：AC7 不可达、用户只能开窗看；**不采纳**（PRD D2 已纳入本批）。
2. **单向 `send` + 来源校验 + 值去重（采纳）** —— 适用：只把一段短文案写到主进程；代价：preload 面 +1（无读能力）；**采纳**。
3. **`invoke` 请求/响应** —— 适用：需回传结果；代价：handler 缺失即 reject、主进程抛错经序列化变拒绝面（须渲染层 catch，与「失败静默」冲突），且无返回值需求 ⇒ 收益 0；**不采纳**。
4. **监听 `page-title-updated` 直接写 tooltip** —— 适用：tooltip 文案恒等于标题；代价：0 新通道，但任何 `document.title` 变化都会改托盘（将来加未读/待办类标题即污染）、须随窗口重建重订阅（漏订 = 静默失效）、且无法让 tooltip 与标题文案不同（PRD §四场景C）；**不采纳**（留作将来「零通道」退路）。
5. **主进程反查 / 引擎搬进主进程** —— 适用：引擎已在主进程；代价：新增反向通道 + 额外定时器（违 NFR）或引擎大迁移（破记录落库分层）；**不采纳**。

## 后果与风险

- 正面：tooltip 与标题同源、1s 走秒；所有降级路径静默，Web 与托盘不可用环境行为零变化。
- 风险：渲染层崩溃/被杀后 tooltip 停在上一个值（无主进程看门狗，本批不做）；GNOME 无 AppIndicator 扩展时 tooltip 不可见（既有 `unconfirmed` 平台事实）。

## 限制与已知边界

- 只接受 ≤64 字符字符串；不收对象 / 路径 / token；不暴露 `ipcRenderer`；不支持任意通道。
- 不改 `v1.13.0` 的托盘常驻 / 关窗隐藏 / 开机自启语义，不动 tray 状态机与 `getShellStatus` 载荷。
- 可靠粒度 = 秒；将来要亚秒或进度可视化须重评审（值去重不再构成上限）。

## 相关指针

- 通道规格 / 接线清单 / 测试建议：`docs/reports/T574-arch-review.md`

## 参考来源

- [Electron · Tray](https://www.electronjs.org/docs/latest/api/tray) · 访问 2026-10-29 · `setToolTip(string)` 为悬停文本，**空串 = 移除 tooltip** ⇒ 复位必须传非空基线。
- [Electron · ipcMain](https://www.electronjs.org/docs/latest/api/ipc-main) · 访问 2026-10-29 · `on` 无回程通道（错误只落在主进程），`handle` 才把错误序列化回渲染层 ⇒ 单向通道必须零抛出。
- [Electron · BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) · 访问 2026-10-29 · `backgroundThrottling: false` 时隐藏/最小化仍 `visible` 且不节流定时器；`page-title-updated` 事件确实存在（备选 4 的依据）。
- [Electron · Security](https://www.electronjs.org/docs/latest/tutorial/security) · 访问 2026-10-29 · 安全清单第 17/20 项：校验所有 IPC 发送方、不向不可信内容暴露 Electron API。