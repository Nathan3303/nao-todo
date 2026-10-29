# T574 架构评审报告 —— 番茄托盘 tooltip 的跨进程窄通道

> 输入：PRD `docs/prds/2026-10-29-pomodoro-notify-title-round.md`（§五 #2 · §六 · AC7/AC8）· 现状 `apps/desktop/src/main/tray.ts`(:78) / `main/ipc.ts` / `main/index.ts` / `preload/index.ts` · 既有口径 `docs/adr/2026-10-25-desktop-tray-autostart.md`。
> 交付物：`docs/adr/2026-10-29-tray-tooltip-channel.md`（决策）· 本文件（通道规格 / 接线清单 / 测试建议 / 风险）。
> 口径：影响面用 `codegraph_explore` + grep 穷尽 + 行段读码；**本次零源码改动**，未跑全仓门禁。

## 一、可行性结论

**可行**（无条件阻塞项）。AC7 与 AC8 都能在当前架构内达成，无需 PM 拍板即可实现；仅 §六 有 3 个文案级确认点。

## 二、通道规格（逐条落实，偏离须回评审）

- **方向**：`ipcRenderer.send` → `ipcMain.on`（**不用 `invoke`**）：无返回值需求；且 handler 缺失时 `send` 静默、`invoke` 会 reject ⇒ 直接违反 AC8。
- **名称**：`setTrayTooltip`（与 4 个 invoke 通道同风格；`nao:` 前缀现用于主→渲染推送 `nao:power-resume`，不混用）。
- **常量落点**：`apps/desktop/src/main/ipc.ts`，**独立常量**（如 `DESKTOP_ONEWAY_CHANNELS = { setTrayTooltip: 'setTrayTooltip' }`）。⛔ 不并入 `DESKTOP_IPC_CHANNELS` —— 既有 `ipc.test.ts` 断言「只注册 4 个 invoke 通道」，并入即红，且 `on` 无拒绝面、语义不同。
- **载荷**：**单个字符串**（不带 phase）：运行时校验 `typeof === 'string'` 且长度 1..64；**空串 / 超长 / 非字符串 ⇒ 回基线**。理由：主进程拼装需第二套文案 + i18n 运行时（`MM:SS · 专注` 与 `专注 24:59` 两种模板还会各写一遍）；phase 可由文案自身表达。
- **基线注意**：Electron `setToolTip('')` = **移除 tooltip** ⇒ 复位必须显式传非空基线（`NaoTodo`）。
- **来源校验**：沿用 `isTrustedUrl(senderFrame.url)`，不受信 ⇒ **静默忽略（不抛）**（与 4 个 invoke 通道的「抛错拒绝」刻意不同）。
- **接线时机**：`app.whenReady()` 内 `createTray` 之后注册；handler **惰性读** `trayHandle`（不捕获实例），`before-quit` 置 null 后自然 no-op。
- **tray 侧封装**：`TrayHandle` 增 `setTooltip(text)`，内部 try/catch；`unsupported`（`tray === null`）/ `setToolTip` 缺失 ⇒ no-op；基线常量从 `deps.tooltip ?? 'NaoTodo'` 提为导出常量（避免第二处硬编码）。

## 三、节流与背压

- **上限来源 = 按值去重 + 文案秒粒度**：引擎 250ms tick 只改 `remainingSeconds`（单调递减），同一秒内 4 次 tick 得到同一串 ⇒ 1 次/秒；暂停后值冻结、不再发。
- **不新增定时器、不引入时间闸**：AC7「5s ≤5 次」由上两条自动满足；测量窗口若跨阶段切换可能见到 +1（AC7 用例口径见 §五 测试建议）。
- **窗口收进托盘照发**：`webPreferences.backgroundThrottling: false`（v1.13.0 已落地，`window-web-preferences.test.ts` 有防回退守卫）⇒ 隐藏不节流定时器；⛔ **禁止**用 `document.visibilityState` 作门（会直接破 AC7）。
- **背压 = 不需要**：单向、幂等 last-value-wins；无队列 / 无 ack / 无重试，丢一条由下一 tick 自愈。

## 四、失败降级（全部静默，且**不 console 输出** —— AC8 要求「无控制台错误」）

- Web / 无 `desktopAPI`：`getDesktopBridge()` 走 `globalThis` 取 `null` ⇒ hook 立即返回，不触碰 `window.desktopAPI`。
- 桥存在但缺方法（旧桥 / 测试桩）：`typeof … === 'function'` + `?.` ⇒ no-op。
- 主进程侧：通道未注册（`send` 无监听 = 静默）、托盘 `unsupported`、`setToolTip` 缺失、tray 已销毁 ⇒ 全部 no-op；handler 整体 try/catch（`on` 抛错只会落到主进程事件循环）。
- 回 idle / 结束专注 / 卸载：发一次基线（空串语义），保证不残留旧倒计时。

## 五、需 rd-fe 落实的清单

1. `apps/desktop/src/main/ipc.ts`：常量 + `registerDesktopTrayTooltipHandler({ ipcMain: { on }, isTrustedUrl, setTrayTooltip })`（校验全不抛）。
2. `apps/desktop/src/main/tray.ts`：基线常量导出 + `TrayHandle.setTooltip`（含 try/catch；`unsupported` 返回分支同样要实现为 no-op，否则类型不闭合）。
3. `apps/desktop/src/main/index.ts`：`createTray` 后注册，闭包惰性读 `trayHandle`。
4. `apps/desktop/src/preload/index.ts`：`setTrayTooltip: (text) => ipcRenderer.send(CH, text)`（仍不暴露 `ipcRenderer`）。
5. `apps/desktop/src/renderer/src/desktop-bridge.ts`：`setTrayTooltip?(text: string): void`（**可选**，容旧桥与测试桩）。
6. 新增 `apps/desktop/src/renderer/src/hooks/use-tray-tooltip.ts`：watch `(phase, status, remainingSeconds)` → 拼串 → 值去重 → 发送；在 `AppRoot.vue` 调用（桌面专属，不进 Web 产物）。
7. 文案单源：拼串逻辑落 `packages/presentation/pomodoro/utils/`（纯函数 + `t()`），标题与 tooltip 各自只做一次模板拼接，禁止两处各写一遍。
8. 测试：handler 四态（受信 / 不受信 / 非字符串 / 超长）+ tray `unsupported` no-op + hook 去重（4 tick → 1 send）+ 无桥 no-op；**不得改动** `ipc.test.ts` 的 4 通道断言。
9. ⛔ 不做：新增任意通道 / 暴露 `ipcRenderer` / 传 token 或路径 / 改 v1.13.0 托盘常驻与自启语义 / 碰 `presentation-react`、`apps/mobile`。

## 六、待 PM 确认（文案级，不阻塞开工）

- **C1**：tooltip 与页签标题是否用**同一字符串**（PRD §五标题为 `24:59 · 专注`，§四场景C 为 `专注 24:59`）。建议统一，省一套模板也更易对照验收。
- **C2**：暂停态 tooltip 是否带 `⏸` 前缀（PRD 只对标题规定）。建议不带（值已冻结）。
- **C3**：idle 时 tooltip 回基线 `NaoTodo`（与 v1.13.0 一致）。若想在空闲态显示别的文案，需扩展通道语义 ⇒ 另评审。
- **C4（口径同步 qa）**：AC7「≤5 次/5s」在稳态成立；测量窗口若跨阶段切换会见到 6 次，用例需注明取值口径。

## 七、风险与应对

- **R1 渲染层崩溃/被杀 ⇒ tooltip 冻结在上一个值**：影响=用户看到过期倒计时；应对=已知边界（不加主进程看门狗，重启渲染层后下一 tick 自愈）；写进 ADR「限制与已知边界」。
- **R2 `backgroundThrottling` 被回退**：影响=隐藏后 250ms tick 变慢、AC7 静默失败；应对=既有 `window-web-preferences.test.ts` 守卫，本批不新增依赖。
- **R3 有人把工具通道并入 `handle` 通道集合**：影响=`ipc.test.ts` 红 + 单向语义被破坏；应对=独立常量 + 注释说明差异。
- **R4 文案两处各写一遍导致标题与 tooltip 漂移**：影响=用户看到两套措辞；应对=§五 第 7 条（纯函数单源）。