# 番茄专注 / 正计时 计时数据持久化（防刷新丢失）

## 摘要

当用户在「番茄专注」（倒计时）或「正计时」运行/暂停时，若不小心刷新页面，当前计时会被还原到 `idle` 状态，数据丢失。

本方案在计时激活期间将计时快照写入 `localStorage`（每 5s 一次 + 关键动作即时保存），页面加载时读取快照并**通过绝对时间戳的时间差**恢复计时状态，使刷新后能继续计时而非重置。

## 当前状态分析

关键文件：

* 倒计时引擎：[pomodoro-timer-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts)

* 正计时引擎：[pomodoro-focus-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts)

* 计时驱动（setInterval + visibility）：[use-timer-driver.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/hooks/use-timer-driver.ts)

* 会话 / 设置 / localStorage 现有模式：[pomodoro-records-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-view/pomodoro-records-store.ts)

关键事实（Phase 1 探索确认）：

1. **两个引擎都已使用绝对时间戳反算**，天然适合按时间差恢复：

   * 倒计时用 `targetEndTime`（绝对结束时刻），`remaining = ceil((targetEndTime - Date.now())/1000)`（[pomodoro-timer-store.ts#L63-L67](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts#L63-L67)）。暂停时保存 `pausedRemainingMs`。

   * 正计时用 `accumulatedMs + (Date.now() - startTimestamp)`（[pomodoro-focus-store.ts#L50-L55](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts#L50-L55)）。
2. 引擎内部变量（`targetEndTime`、`pausedRemainingMs`、`completedRoundCount`、`autoStartCount`、`breakWarningSent`、`startTimestamp`、`accumulatedMs`、`sessionId`、`recordStartedAt`）为**非响应式普通变量**，刷新后全部丢失。
3. **会话信息**（`currentRecordId`、`currentRecordStartAt`、`currentTaskId/Name`、`currentPomodoroId/Name`、`noteText`）位于 records store，刷新后同样丢失。这些是阶段完成时 `buildRecord` 生成记录所必需的（[pomodoro-timer-store.ts#L95-L105](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts#L95-L105)、[pomodoro-focus-store.ts#L61-L71](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts#L61-L71)），因此快照必须一并持久化会话信息。
4. records store 已有成熟的 localStorage 读写模式（`POMODORO_SETTINGS_KEY` + try/catch + 校验，[pomodoro-records-store.ts#L100-L186](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-view/pomodoro-records-store.ts#L100-L186)），本方案沿用同样风格。
5. 两个 store 在 App 侧边栏指示器 [use-indicator.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/indicator/use-indicator.ts) 中被实例化，故应用加载时 store 的 setup 函数即会执行——这是执行「恢复」的合适时机。
6. 两个 store 已有 `destroy()` 用于清理 driver，可在此额外清理持久化定时器。

## 提议的变更

### 1. 新增持久化工具模块

**文件（新建）**：`apps/web/src/infrastructure/utils/pomodoro-persistence.ts`

**做什么**：提供两组 `save / load / clear` 函数，分别对应倒计时与正计时快照，沿用 records store 的 try/catch 风格。

**为什么单独建文件**：这是与现有 `utils/pomodoro.ts`（记录构建/通知/格式化）不同的关注点（本地持久化），单独成文件更清晰。

**内容**：

* 常量键：`POMODORO_TIMER_SNAPSHOT`、`POMODORO_FOCUS_SNAPSHOT`。

* 类型定义：

```ts
export interface PomodoroSession {
    taskId: string | null
    taskName: string
    pomodoroId: string | null
    pomodoroName: string
    noteText: string
}

export interface TimerSnapshot {
    phase: 'focus' | 'break' | 'longBreak' // 不持久化 idle
    status: 'running' | 'paused'
    totalSeconds: number
    targetEndTime: number // 绝对 ms，running 有效
    pausedRemainingMs: number // paused 有效
    breakWarningSent: boolean
    completedRoundCount: number
    autoStartCount: number
    recordId: string | null
    recordStartAt: string | null
    session: PomodoroSession
    savedAt: number
}

export interface FocusSnapshot {
    status: 'running' | 'paused'
    accumulatedMs: number
    startTimestamp: number // 绝对 ms，running 有效
    sessionId: string | null
    recordStartedAt: string | null
    session: PomodoroSession
    savedAt: number
}
```

* 导出：`saveTimerSnapshot / loadTimerSnapshot / clearTimerSnapshot`、`saveFocusSnapshot / loadFocusSnapshot / clearFocusSnapshot`。`load*` 出错或无数据时返回 `null`；所有操作包 try/catch 并 `console.error`。

### 2. 改造倒计时 store

**文件**：[pomodoro-timer-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts)

**做什么**：

1. import 持久化工具。
2. 新增 `persist()`：当 `phase !== 'idle'` 时，读取当前引擎变量 + records store 会话，组装 `TimerSnapshot` 并 `saveTimerSnapshot`。
3. 新增 `restoreFromStorage()`：

   * `loadTimerSnapshot()`；无数据则返回 `false`。

   * 通过 `pomodoroStore.setCurrentSession(...)`、`selectPomodoro(...)`、`setNoteText(...)` 恢复会话。

   * 恢复引擎变量：`totalSeconds`、`breakWarningSent`、`completedRoundCount`、`autoStartCount`；`phase = snapshot.phase`。

   * 若 `status === 'running'`：`targetEndTime = snapshot.targetEndTime`，`remaining = ceil((targetEndTime - Date.now())/1000)`；

     * `remaining > 0`：`status='running'`、`remainingSeconds=remaining`、`driver.start()`、启动持久化定时器。

     * `remaining <= 0`（关闭期间阶段已结束）：`status='running'` 后调用 `handlePhaseComplete()`，创建记录并按 `autoRest`/自动开始规则流转（新阶段会重设 `targetEndTime`，故只会补偿一个阶段——见下方决策）。

   * 若 `status === 'paused'`：`pausedRemainingMs = snapshot.pausedRemainingMs`，`status='paused'`，`remainingSeconds` 由 `calcRemaining()` 得出，启动持久化定时器（不启动 driver）。

   * 返回 `true`。
4. 新增每 5s 的持久化定时器 `startPersistTimer()/stopPersistTimer()`（独立 `setInterval(5000)`，因 `useTimerDriver` 固定 250ms 不适用）；tick 内调用 `persist()`。
5. 在这些动作末尾调用 `persist()`：`start`、`resume`、`pause`、`adjustTime`、`enterBreakPhase`、`enterFocusPhase`；并在进入激活态时 `startPersistTimer()`。
6. 在 `resetToIdle()` 中调用 `clearTimerSnapshot()` 与 `stopPersistTimer()`（覆盖 `reset`、`skip`、`handlePhaseComplete` 的重置路径）。
7. setup 末尾：先 `if (!restoreFromStorage()) initialize()`（恢复成功则跳过默认 idle 初始化）。
8. `destroy()` 中追加 `stopPersistTimer()`。

**为什么**：绝对时间戳持久化使刷新后可精确按时间差恢复；会话一并持久化以保证恢复后阶段完成能正确生成记录。

### 3. 改造正计时 store

**文件**：[pomodoro-focus-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts)

**做什么**（与倒计时对称）：

1. import 持久化工具。
2. `persist()`：`status !== 'idle'` 时组装 `FocusSnapshot`（`status`、`accumulatedMs`、`startTimestamp`、`sessionId`、`recordStartedAt` + 会话）并保存。
3. `restoreFromStorage()`：

   * `loadFocusSnapshot()`；无数据返回。

   * 恢复本地变量 `sessionId`、`recordStartedAt`、`accumulatedMs`，并 `pomodoroStore.setCurrentSession(...)` / `selectPomodoro` / `setNoteText` 恢复会话。

   * `status === 'running'`：`startTimestamp = snapshot.startTimestamp`，`status='running'`，`elapsedSeconds = calcElapsedSeconds()`，`driver.start()`，启动持久化定时器。

   * `status === 'paused'`：`status='paused'`，`startTimestamp=0`，`elapsedSeconds = calcElapsedSeconds()`，启动持久化定时器。

   * 正计时无「完成」概念，不需处理越界。
4. 5s 持久化定时器同倒计时。
5. 在 `start`、`resume`、`pause` 末尾 `persist()`，进入激活态时 `startPersistTimer()`。
6. 在 `resetToIdle()` 中 `clearFocusSnapshot()` + `stopPersistTimer()`（覆盖 `end`、`reset`）。
7. setup 末尾调用 `restoreFromStorage()`。
8. `destroy()` 追加 `stopPersistTimer()`。

## 假设与决策

* **每 5s 保存**：按用户明确要求实现。由于持久化的是**绝对时间戳**，仅靠动作时的即时保存已能保证时间精度；5s 定时器作为兜底（避免遗漏路径），并满足需求描述。

* **恢复时的越界补偿（倒计时）**：若关闭时间较长导致多个阶段本应结束，只补偿完成**一个**阶段（新阶段会重设 `targetEndTime`）。刷新场景耗时通常仅数秒，此简化可接受，不做多阶段级联补偿。

* **正计时按时间差继续累加**：即使页面关闭很久，恢复后 `elapsed` 会包含关闭期间的时间（符合「正计时」语义与用户「通过时间差计算时间」的描述）。

* **不改动** **`useTimerDriver`**：5s 持久化定时器在各 store 内用独立 `setInterval` 实现，避免改动共享驱动的固定 250ms 语义。

* **互斥关系**：两种模式互斥（同一时刻只会有一个非 idle）；理论上最多只有一个快照有效。恢复各自读取自身快照即可，无需额外互斥处理。

* **登录态**：沿用现有 `loadSavedSettings` 的无条件加载策略，不额外判断登录态。

## 验证步骤

1. `pnpm --filter @nao-todo/web dev`（或项目对应启动命令）运行 web 应用。
2. 番茄专注：开始倒计时 → 等待数秒 → 刷新页面 → 确认计时从正确剩余时间继续运行（而非回到 idle），关联任务/笔记保留。
3. 暂停态刷新：暂停后刷新 → 确认恢复为暂停态且剩余时间正确。
4. 正计时：开始 → 刷新 → 确认已走时间按时间差继续累加；暂停后刷新同样正确。
5. 结束/重置/取消后刷新：确认 `localStorage` 中对应快照已清除，页面为 idle。
6. 越界场景（倒计时剩余不足时关闭较久再打开）：确认会补偿完成当前阶段并按设置流转（生成记录 / 进入休息 / 回到 idle）。
7. `localStorage` 检查：运行中存在 `POMODORO_TIMER_SNAPSHOT` 或 `POMODORO_FOCUS_SNAPSHOT`，idle 时不存在。
8. 运行 lint / 类型检查（如 `pnpm --filter @nao-todo/web lint` / `tsc`）确认无报错。

