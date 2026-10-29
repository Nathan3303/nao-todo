# T575 用例契约（红 → 绿判据）

> 目的：本批（番茄通知接提醒设置 · 页签标题 · 轮次指示 · `DEF-111`）**用例先行**，用例在实现落地前即为红基线。
> 本文件是 **QA 与 RD 之间的接缝契约**：实现只要符合本文件的落点/导出/语义，用例即转绿；若改名字或改语义，
> 须**同步改用例**（改代码不改用例 = 红基线失真）。
> 来源：PRD `docs/prds/2026-10-29-pomodoro-notify-title-round.md` · arch `docs/reports/T574-arch-review.md` ·
> PM 补充口径 D8/D9/D10（2026-10-29）。
> 红基线「缺实现」装载器见各 `__tests__/impl-seam.ts`：模块缺失 / 缺导出 ⇒ 抛出可读
> `UnableToImplementError`（写明期望文件 + 期望导出 + AC），实现落地后自动退化为普通 import 语义。

## §1 通知判定层（AC1–AC4）

**落点**：`packages/presentation/pomodoro/utils/pomodoro-notify.ts`（新增）

```ts
export type PomodoroNotifyChannel = 'system' | 'in-app' | 'none'
export type PomodoroNotifyDecision = { channel: PomodoroNotifyChannel; silent: boolean }

export const resolvePomodoroNotifyDecision: (input: {
    settings: ReminderSettings // @nao-todo/shared/reminder
    nowMs: number
}) => PomodoroNotifyDecision

export type PomodoroNotifyPayload = { title: string; body: string; inAppText: string }

export const createPomodoroNotifier: (deps: {
    readSettings(): ReminderSettings // **允许抛** ⇒ 内部 fail-open
    now?(): number
    send(title: string, body: string, options: { silent: boolean }): unknown
    notifyInApp(text: string): void
}) => (payload: PomodoroNotifyPayload) => PomodoroNotifyDecision // **永不抛**
```

| 判定顺序（PRD §五）                                     | channel  | silent   | 派发                             |
| ------------------------------------------------------- | -------- | -------- | -------------------------------- |
| ① 读设置抛错（fail-open）                               | `system` | `false`  | 只发系统通知                     |
| ② 免打扰命中（`isWithinQuietHours(nowMs, quietHours)`） | `in-app` | `true`   | 只弹应用内提示（传 `inAppText`） |
| ③ `notify === false`                                    | `none`   | `true`   | 都不发                           |
| ④ 其余                                                  | `system` | `!sound` | 只发系统通知                     |

- `send` / `notifyInApp` 抛错 ⇒ 必须被吞（NFR「通知层永不抛」）。
- **⚠️ 待 PM 裁定（用例 N11）**：②与③同时成立（免打扰命中 **且** `notify === false`）时，用例按 PRD §五
  **字面顺序**（② 早于 ③）固化为 `in-app`；而 D6 的措辞（「既不发系统通知也不弹应用内提示」）指向 ③。
  若 PM 裁定改为 `none`，只改 `t575-notify-gating.test.ts` 的 N11 一条。

**引擎接线（AC1–AC4 集成）**：`pomodoro-timer-store.ts` 的 4 个通知点
（专注完成 · 休息即将结束 · 休息结束 · 结束专注）全部改走该层；设置来源 = 身份级单键
`REMINDER_SETTINGS`（`localStorage`，与 `apps/web` 任务提醒同源）。

> 若改为注入式读取，只需改 `t575-notify-integration.test.ts` 顶部的 `applySettings`（单点）。

## §2 页签标题（AC5 / AC6）

**落点**：`packages/presentation/pomodoro/utils/pomodoro-title.ts`（新增）

```ts
export const formatPomodoroTitle: (input: {
    phase: 'idle' | 'focus' | 'break' | 'longBreak' | 'countUp'
    status: 'running' | 'paused'
    remainingSeconds: number
}) => string | null // null = 复位（idle）

export const createPomodoroTitleSync: (deps: {
    getSnapshot(): { phase; status; remainingSeconds }
    writeTitle(title: string): void
}) => { sync(): void; restore(): void }
```

- 文案（**D8 单源**：页签标题与托盘 tooltip 用同一函数输出，不得另写模板/调序）：
  `24:59 · 专注` / `04:30 · 休息` / `14:59 · 长休息` / `12:34 · 正计时`；暂停统一前缀 `⏸ `。
- 节流：**秒数未变不写**（复用既有 250ms tick，⛔ 不新增定时器）。
- **复位值 = `NaoTodo`**（D9，非空串）；idle / 结束 / 取消 / 卸载同值；重复复位幂等。
- 同步器**不接受路由/页面生命周期入参** ⇒ 「离开番茄页但引擎仍在跑」继续更新（路由守卫属装配层：只在番茄分区启动）。

## §3 轮次指示器（AC9 / AC10 / AC11 / AC12）

**落点**：`packages/presentation/pomodoro/utils/pomodoro-rounds.ts`（新增）

```ts
export const resolveRoundIndicator: (input: {
    phase: 'idle' | 'focus' | 'break' | 'longBreak'
    completedRounds: number
    sessionsUntilLongBreak: number
}) => { total: number; filled: number; label: string; longBreakUpcoming: boolean }
```

| phase       | filled                           | label                                                             |
| ----------- | -------------------------------- | ----------------------------------------------------------------- |
| `idle`      | 0                                | `共 M 轮一轮长休`                                                 |
| `focus`     | 已完成数（**M=1 无特例**，见下） | `第 N/M 轮`，`N = 已完成 + 1`；`N === M` 追加 ` · 本轮结束后长休` |
| `break`     | 已完成数                         | `休息中 · 已完成 N/M`                                             |
| `longBreak` | 0                                | `长休息 · 新周期`                                                 |

- `total = M`（圆点总数）；`filled ≤ total`（越界防守）。
- **裁定②（PM 2026-10-29 · D11，已回填 PRD §五/§九）**：**以 AC9 为准 —— 实心数恒等于已完成数，不分阶段、
  M=1 无特例**（原 §五「M=1 显示 1 个实心」作废）。故 `M=1`：`idle`/`focus` ⇒ ○（0 已完成）、`break`（该轮已完成）⇒ ●；
  文字分别为 `共 1 轮一轮长休` / `第 1/1 轮 · 本轮结束后长休` / `休息中 · 已完成 1/1`。

## §4 托盘 tooltip（AC7 / AC8 · 依据 T574 arch 评审）

**通道**（`apps/desktop/src/main/ipc.ts`）

- 常量 **独立**：`DESKTOP_ONEWAY_CHANNELS = { setTrayTooltip: 'setTrayTooltip' }`
  → ⛔ **不并入** `DESKTOP_IPC_CHANNELS`（既有 `ipc.test.ts` 的「4 个 invoke 通道」断言不得改动）。
- 方向：`ipcRenderer.send` → `ipcMain.on`（**单向，非 `invoke`**）。
- 导出：`registerDesktopTrayTooltipHandler({ ipcMain: { on }, isTrustedUrl, setTrayTooltip })`。
- 载荷校验：单字符串，**长度 1..64**；非字符串 / 空串 / 超长 ⇒ **回基线 `NaoTodo`**；
  不受信 / 来源不可判定 ⇒ **静默忽略（不抛）**；handler 整体 try/catch。

**托盘**（`apps/desktop/src/main/tray.ts`）

- `TrayHandle` 增 `setTooltip(text: string): void`：`unsupported`（`tray === null`）/ `setToolTip` 缺失 /
  已销毁（调用抛错）⇒ 全部 no-op，不抛。

**渲染层**（`apps/desktop/src/renderer/src/hooks/use-tray-tooltip.ts` · 导出 `useTrayTooltip`）

- 载荷 = `formatPomodoroTitle(...)` 的**同一字符串**；**按值去重**（不引入时间闸 ⇒ 不新增定时器）。
- **AC7 计数窗口（D10）**：稳态 5s 窗口 **≤5 次**；窗口**含阶段切换**允许 **+1 次**
  （用例里以「idle→专注 首发」「专注→休息 换文案」各计 1 次 +1）。
- 复位（D9）：idle / 结束 / 取消 / 卸载 ⇒ 发 `NaoTodo`。
- 降级（AC8）：无 `desktopAPI` / 旧桥缺 `setTrayTooltip` / 发送抛错 ⇒ **不抛且不 `console.error`**。
- 依赖假设：hook 自取全局 `usePomodoroTimerStore`（用例驱动真实 store + 假定时器）。

## §5 计数语义（`DEF-111` 修复 · AC9 / AC10 / AC11）

计数点迁到「**专注自然完成**」，并暴露 `completedRounds: number` 于 store 公开返回（PRD §一 #3 的缺口）：

- 专注自然完成 ⇒ `+1`；**跳过专注 / 结束专注 / 取消专注 均不计数**；
- break / longBreak 完成**与跳过**均不计数（原实现在「break 完成」处 `+1`，跳过 break 也 `+1`）；
- 专注自然完成后若「已完成数 `>= M`」⇒ **长休** + 周期计数归零。
- 可观测：`M=4` 时第 **4** 次专注结束 ⇒ `phase === 'longBreak'`（原实现为 `break`，即 `DEF-111`）。

## §6 用例清单（AC → 文件 → 例数）

| 文件                                                                              | 覆盖                                                                                 | 例数 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---- |
| `packages/presentation/pomodoro/utils/__tests__/t575-notify-gating.test.ts`       | AC1–AC4（判定层 + 永不抛 + 判定顺序）                                                | 14   |
| `packages/presentation/pomodoro/stores/__tests__/t575-notify-integration.test.ts` | AC1–AC4（真实 store + localStorage 设置 + 4 个通知点 + 跨午夜）                      | 10   |
| `packages/presentation/pomodoro/utils/__tests__/t575-title.test.ts`               | AC5 / AC6（文案格式 · 秒级节流 · 暂停冻结 · 阶段切换 · 复位 NaoTodo · 跨页继续更新） | 18   |
| `packages/presentation/pomodoro/utils/__tests__/t575-rounds-view.test.ts`         | AC9–AC12（视图模型：M=1/4/10 · 文案 · 三态可辨 · 纯函数）                            | 14   |
| `packages/presentation/pomodoro/stores/__tests__/t575-rounds-engine.test.ts`      | AC9 / AC10 / AC11（`DEF-111` · 计数点 · 跳过/结束不计数 · 周期归零）                 | 9    |
| `apps/desktop/src/main/__tests__/t575-tray-tooltip.test.ts`                       | AC7 / AC8（单向通道常量 · 载荷校验 · 不受信忽略 · tray 四态 no-op · 基线 D9）        | 14   |
| `apps/desktop/src/renderer/src/hooks/__tests__/t575-use-tray-tooltip.test.ts`     | AC7 / AC8（按值去重 · ≤5/5s（跨切换 +1）· 暂停冻结 · 复位 · 三支降级静默）           | 10   |

## §7 不在自动化内的项（交用户视觉勾选 / 人工验收）

- 圆点组的**布局与溢出**（M=10 时 1200px / 960px 两档不换行）、`#Pomodoro` 视觉气质、圆点在**去色**后的可辨识度。
- 页签标题在**真实后台标签页**持续走秒、托盘 tooltip 在**真实收进托盘后**持续刷新（本用例只能证明同步源不依赖页面生命周期）。
- 新增文案的中英齐备（i18n 三处）与「说人话」措辞。
- 免打扰期间窗口已收进托盘 ⇒「应用内提示用户看不到」（PRD §六 已知后果，不转缺陷）。

## §8 红基线的读法（不要误判「用例写错」）

- `UnableToImplementError: [缺实现] …` ⇒ **能力缺失**（模块/导出还没有），不是断言错。
- 断言 `expected undefined to be …`（`completedRounds`）⇒ 计数未暴露（同上）。
- 断言 `expected 'break' to be 'longBreak'` ⇒ **`DEF-111` 现状**，修复后转绿。
- `sentOptions(0)` 为 `undefined` ⇒ 当前通知未传 `silent`（AC1 的 `silent === false` 未成立）。
- 本批纯函数模块已用参考实现**验证过可满足性**（`notify` 14 + `title` 18 + `rounds` 14 = 46 例全绿；渲染层 hook 10 例全绿），
  参考实现未入库 —— 仅证明「断言本身可满足」，不构成实现建议。