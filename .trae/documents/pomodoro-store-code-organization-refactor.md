# Pomodoro Store 代码组织优化方案

## Summary

对 `apps/web/src/stores` 下的两个番茄钟 store —— [pomodoro-timer-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts)（倒计时）与 [pomodoro-focus-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts)（正计时）做**代码组织优化**，不改变任何用户可见行为、不改变对外 API：

1. **抽离共享驱动层**：把两 store 完全重复的 `interval` 引擎、`visibilitychange` 监听、`destroy` 清理提取为一个共享 composable（计时驱动层），供两 store 复用。
2. **抽离记录构建/创建逻辑**：把两 store 中仅以 `type`/session 来源区分的 `buildRecord` + `addRecord`（含通知）重复代码提取为共享辅助。
3. 各 store 保留各自**独有的时间数学**（倒计时反算 / 正计时累计）与**控制逻辑**（阶段机 / 扁平状态），组织更清晰。

约束：**严格遵循项目现有代码风格**（`useXxx` 命名 + `export default`、`// @xxx` 注释标记与分区大注释块、中文注释、`GoAsync` 错误处理、plain 变量存放非响应式引擎状态）。

## Current State Analysis

### 消费方（对外 API 契约，重构后必须保持不变）

- [use-pomodoro-page.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/use-pomodoro-page.ts)：使用 timer 的 `phase / totalSeconds / start / pause / resume / reset / skip / adjustTime / updateConfig`；focus 的 `status / start / pause / resume / end / reset`。
- [use-indicator.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/indicator/use-indicator.ts)：使用 timer 的 `totalSeconds / remainingSeconds / phase`；focus 的 `status / elapsedSeconds`。
- [layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue)：模板绑定 `timerStore.pause/resume/skip`。
- [stores/index.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/index.ts)：导出 `usePomodoroTimerStore`、`usePomodoroFocusStore`。

**必须保持的公开返回键**：

- Timer：`phase, status, remainingSeconds, totalSeconds, isIdle, isRunning, start, pause, resume, reset, skip, adjustTime, updateConfig, destroy`
- Focus：`status, elapsedSeconds, start, pause, resume, end, reset, destroy`

### 重复代码（两 store 逐字节几乎一致）

1. **常量**：`TICK_INTERVAL_MS = 250`（两处各定义一次）。
2. **interval 引擎**：`intervalId` + `startInterval()` + `stopInterval()`。
3. **visibility 监听**：`visibilityHandler` + `setupVisibilityListener()` + `teardownVisibilityListener()`（逻辑完全相同：可见且 running 时 rAF 补一次 tick）。
4. **destroy**：`stopInterval()` + `teardownVisibilityListener()`。
5. **记录构建/创建**：`buildRecord()` 结构一致，仅 `type`（timer=1 / focus=2）与 sessionId 来源不同；`addRecord(...).then(err => console.error(...))` 亦重复。

### 独有逻辑（**不动**，仅平移）

- Timer：`targetEndTime / pausedRemainingMs` 反算，`calcRemaining/calcElapsed`，阶段机（`resetToIdle / enterBreakPhase / enterFocusPhase / transitionToNextFocusOrIdle / handlePhaseComplete`），break warning，`adjustTime/updateConfig`，长休息判定。
- Focus：`startTimestamp / accumulatedMs` 累计，`calcTotalMs/calcElapsedSeconds`，`end`（创建记录）/`reset`（不创建）。

### 关键约束

- `destroy()` 目前**无任何调用点**（grep 确认），但作为已导出 API 予以保留。
- 两 store 通过 `usePomodoroStore` 读取配置/写入记录，本次**不触碰** [pomodoro-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-store.ts)。
- store 内部引擎状态用 plain 变量（非响应式）——这是现有刻意设计，须延续。

## Proposed Changes

> 原则：行为逐行等价，仅调整组织。新增文件遵循 `use-*.ts` + `export default` 风格，保留分区大注释块与中文注释。

### 1. 新增共享计时驱动 composable

**What**：新建 `apps/web/src/infrastructure/hooks/use-timer-driver.ts`，导出 `useTimerDriver(tick, isRunning)`。
**Why**：消除两 store 完全重复的 interval + visibility + destroy 基础设施。
**How**：

- 入参：`tick: () => void`（各 store 的 tick 回调）、`isRunning: () => boolean`（判定是否 running 的读取函数，适配 timer 的 `status.value==='running'` 与 focus 的 `status.value==='running'`）。
- 内部维护 `intervalId`、`TICK_INTERVAL_MS`、`visibilityHandler`。
- 导出：`start()`（= startInterval：先 stop 再 `setInterval(tick, 250)`）、`stop()`（= stopInterval）、`destroy()`（stop + 移除监听）。
- 构造时即 `setupVisibilityListener()`（可见且 `isRunning()` 时 `requestAnimationFrame` 补 `tick()`），与现状一致。
- 类型/风格参照现有 [use-task-loader.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/hooks/use-task-loader.ts) 等 hooks。

### 2. 新增共享记录构建辅助

**What**：在 `apps/web/src/infrastructure/utils/pomodoro.ts`（已存在，含 `sendNotification/formatMinutes`）中新增 `buildPomodoroRecord(params)` 与 `persistPomodoroRecord(pomodoroStore, record, errorTag)`。
**Why**：合并两 store 重复的记录组装与异步持久化（含 error console）。
**How**：

- `buildPomodoroRecord`：入参 `{ sessionId, pomodoroId, type, taskId, taskName, startAt, duration, note }`，返回 `CreatePomodoroRecordViewObject`（原两处字段结构一致，`description: null`、`taskName || '未关联任务'`、`endAt: new Date().toISOString()` 逻辑内聚于此）。
- `persistPomodoroRecord`：封装 `pomodoroStore.addRecord(record).then(([, err]) => err && console.error(errorTag, err))`，`errorTag` 区分 `[Pomodoro]` / `[PomodoroFocus]`。
- 放在既有 utils 而非新建文件，符合"就近复用现有工具模块"的仓库惯例。

### 3. 重构 pomodoro-timer-store.ts

**What**：接入 `useTimerDriver` 与记录辅助，移除内联的 interval/visibility/destroy/buildRecord 重复段。
**Why**：store 聚焦倒计时数学 + 阶段控制。
**How**：

- 删除本地 `TICK_INTERVAL_MS`、`intervalId`、`startInterval/stopInterval`、`visibilityHandler`、`setupVisibilityListener/teardownVisibilityListener`、内联 `destroy`。
- `const driver = useTimerDriver(tick, () => status.value === 'running')`；原 `startInterval()` → `driver.start()`，`stopInterval()` → `driver.stop()`，`destroy` → 返回 `driver.destroy`。
- `buildRecord(total)` → 调用 `buildPomodoroRecord({ ..., type: 1 })`；`addRecord(...).then(...)` → `persistPomodoroRecord(pomodoroStore, record, '[Pomodoro] Failed to create record:')`。
- **保留** `tick`（含 break warning）、阶段机全部函数、`start/pause/resume/reset/skip/adjustTime/updateConfig/initialize`。
- 构造末尾仍 `initialize()`（driver 构造时已 setup visibility）。
- **公开返回键完全不变**。

### 4. 重构 pomodoro-focus-store.ts

**What**：同样接入 `useTimerDriver` 与记录辅助。
**Why**：store 聚焦正计时数学 + 扁平控制。
**How**：

- 删除本地 interval/visibility/destroy/`TICK_INTERVAL_MS` 重复段。
- `const driver = useTimerDriver(tick, () => status.value === 'running')`；`startInterval/stopInterval` → `driver.start/stop`；`destroy` → `driver.destroy`。
- `buildRecord(elapsed)` → `buildPomodoroRecord({ ..., type: 2 })`；`end()` 中 `addRecord(...).then(...)` → `persistPomodoroRecord(pomodoroStore, record, '[PomodoroFocus] Failed to create record:')`。
- **保留** `calcTotalMs/calcElapsedSeconds/resetToIdle`、`start/pause/resume/end/reset`、`tick`。
- **公开返回键完全不变**。

### 5. 兼容性核对（不改动，仅验证）

- `stores/index.ts` 导出不变。
- 两 store 的 `defineStore` id 不变（`PomodoroTimerStore` / `PomodoroFocusStore`）。

## Assumptions & Decisions

- **行为等价**：tick 频率、visibility 补偿、阶段流转、记录字段、通知文案均保持不变。
- **共享层落点**：驱动 composable 放 `infrastructure/hooks/`（与现有 `use-*.ts` hooks 并列）；记录辅助复用现有 `infrastructure/utils/pomodoro.ts`，不新建目录。
- **`isRunning` 以函数注入**：避免把 store 的 ref 泄漏进驱动层，保持驱动层与具体 store 解耦（focus 的 `status` 与 timer 的 `status` 取值域不同，但都用 `=== 'running'` 判定）。
- **不拆分为"计时引擎 + 控制层"两独立文件**：按用户选择的"共享驱动层"方案，各 store 仍是单文件，仅抽走公共基础设施；独有的时间数学与控制逻辑留在各自 store 内（倒计时与正计时数学差异大，强行合并反而增加复杂度）。
- **不触碰** `pomodoro-store.ts`、`use-pomodoro-page.ts`、`use-indicator.ts`、`layouts/pomodoro/index.vue`。
- **`destroy` 保留**：虽无调用点，仍作为既有导出 API 保留。

## Verification

1. **类型检查**：`GetDiagnostics` 确认 `use-timer-driver.ts`、两 store、`utils/pomodoro.ts` 无 TS 报错（尤其 `CreatePomodoroRecordViewObject` 字段、`PomodoroType`）。
2. **静态自检**：
    - grep 确认两 store 内已无 `setInterval` / `visibilitychange` / `TICK_INTERVAL_MS` 残留定义（均改为经驱动层）。
    - grep 确认两 store 公开返回键集合与重构前一致（逐项比对本文档"必须保持的公开返回键"）。
    - grep 确认 `buildRecord` 内联实现已被 `buildPomodoroRecord` 取代。
3. **手动冒烟**（开发服务器，`/pomodoro/timer` 与 `/pomodoro/focus`）：
    - Timer：开始→倒计时递减→暂停/恢复→调整时间(±5min)→跳过→重置；专注完成后自动进入休息（autoRest 开）；长休息轮次流转；break warning 通知。
    - Focus：开始→正计时递增→暂停/恢复→结束（生成记录+通知）→取消（不生成记录）。
    - 互斥：Timer 运行时开始 Focus（反之亦然）触发确认并结束对方。
    - 切换路由后计时持续运行（全局单例特性不受影响）。
    - 顶部 indicator 的进度/时间/阶段标签显示正确。
4. **行为对照**：记录条目的 `type`、`duration`、`taskName`、通知文案与重构前一致。