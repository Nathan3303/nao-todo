# Pomodoro Timer 全局化重构方案

## 概述

将计时器运行时状态从组件级 composable 迁移到 Pinia store，使 `setInterval` 生命周期与 Pinia store 绑定而非组件，从而实现路由切换后计时器持续运行。

---

## 一、架构变化

### 当前架构

```
组件挂载 → useTimerPage() → useTimer() → usePomodoroStateMachine()
                                              ├── ref(phase, remainingSeconds, ...)
                                              ├── setInterval() ← 250ms tick
                                              ├── visibilitychange listener
                                              └── onBeforeUnmount → clearInterval ❌
```

### 目标架构

```
Pinia Store 全局单例 (PomodoroTimerStore)
  ├── state: phase, remainingSeconds, totalSeconds, status
  ├── actions: start(), pause(), resume(), reset(), skip(), adjustTime()
  ├── setInterval() ← 随 store 存活，不随组件销毁
  ├── visibilitychange listener ← setup 中注册一次
  └── destroy() ← 仅应用关闭时调用

组件挂载 → 从 store 读取状态 (storeToRefs)
组件卸载 → store 依然存活，interval 继续运行
组件重新挂载 → 读取最新状态，UI 立即恢复
```

---

## 二、新增文件

### `apps/web/src/stores/pomodoro-timer-store.ts`

全新 Pinia store，从 `usePomodoroStateMachine.ts` (723行) 中提取核心引擎逻辑。

#### State（响应式）

```typescript
phase: Ref<TimerPhase>          // 'idle' | 'focus' | 'break' | 'longBreak'
status: Ref<TimerStatus>        // 'running' | 'paused'
remainingSeconds: Ref<number>   // 当前剩余秒数（UI 直接绑定）
totalSeconds: Ref<number>       // 当前阶段总秒数（用于计算进度条）
```

#### Internal Engine State（非响应式，plain variables）

```typescript
targetEndTime: number           // 目标结束时间戳（Date.now() 差值反算）
pausedRemainingMs: number       // 暂停时保存的剩余毫秒数
intervalId: number | null       // setInterval 句柄
breakWarningSent: boolean       // 防止重复发送休息提醒
completedRoundCount: number     // 已完成（专注+短休息）轮数
autoStartCount: number          // 连续自动开始计数
```

#### Computed

```typescript
isIdle: ComputedRef<boolean>    // phase === 'idle'
isRunning: ComputedRef<boolean> // status === 'running'
```

#### Actions

| Action | 触发场景 | 行为 |
|--------|---------|------|
| `start()` | 用户点击"开始专注" | state: idle→focus:running，生成 recordId，启动 interval |
| `pause()` | 用户点击"暂停" | state: focus:running→focus:paused，保存暂停时间，停止 interval |
| `resume()` | 用户点击"继续" | state: focus:paused→focus:running，恢复 interval |
| `reset()` | 用户点击"重置" | 仅 paused 状态可用 → idle，清理 session，重置计数器 |
| `skip()` | 用户点击"跳过" | 记录已用时间→创建 partial record→进入下一阶段 |
| `adjustTime(delta)` | 用户点击 +/- 5min | 调整剩余/总时间，idle 时同步更新 pomodoroStore 默认值 |
| `updateConfig()` | 设置弹窗关闭后 | 从 pomodoroStore 读取最新设置，同步 timer 配置 |
| `destroy()` | 应用关闭 / logout | 清理 interval + visibilitychange |

#### 内部方法（引擎核心）

```typescript
tick()                          // 250ms 间隔：更新 remainingSeconds，检测 break warning，检测 phase complete
handlePhaseComplete()           // 阶段完成：创建 record + notify + 自动进入下阶段
startInterval()                 // 启动 setInterval，先 stop 再 start
stopInterval()                  // 停止 setInterval
handleVisibilityChange()        // visibilitychange 回调：页面恢复可见时立即 tick()
resetToIdle()                   // 重置所有状态到空闲
enterBreakPhase()               // 进入休息（判断是 break 还是 longBreak）
enterFocusPhase()               // 进入专注阶段（auto-start 时使用）
transitionToNextFocusOrIdle()   // 判断 auto-start 逻辑
```

#### 关键设计决策

**1. 配置来源**

Timer Store 不从自身保存配置，而是**直接读取 `usePomodoroStore` 的 reactive refs**：

```typescript
const pomodoroStore = usePomodoroStore()

// 在 enterBreakPhase 中：
const nextDuration = isLongBreakDue()
  ? pomodoroStore.longBreakDuration
  : pomodoroStore.breakDuration
```

这样可以确保设置弹窗修改值后，timer 立即使用新值。无需手动 `updateConfig`。

但有一个例外：**idle 状态下的 ADJUST_TIME** 会改变 `focusDuration` 的默认值：

```typescript
adjustTime(delta) {
  if (phase.value === 'idle') {
    const newRemaining = remainingSeconds.value + delta
    if (newRemaining < MIN_FOCUS_SECONDS) return
    pomodoroStore.setFocusDuration(newRemaining)  // 同步回 settings store
    totalSeconds.value = newRemaining
    remainingSeconds.value = newRemaining
  }
  // ...
}
```

**2. 回调处理 → 内联到 Store**

当前回调在 `use-timer-page.ts` 中处理。重构后这些副作用直接进 store action：

```
onFocusComplete(elapsed, total)
  → pomodoroStore.addRecord(buildRecord(...))
  → sendNotification('专注完成', ...)
  → enterBreakPhase() or resetToIdle()

onFocusSkip(elapsed, total)
  → pomodoroStore.addRecord(buildRecord(elapsed))  // 部分记录
  → enterBreakPhase()

onBreakComplete(phase, elapsed, total)
  → startNewFocusSession() // 生成新的 recordId
  → sendNotification('休息结束', ...)
  → completedRoundCount++
  → transitionToNextFocusOrIdle()

onBreakWarning(remaining)
  → sendNotification('休息即将结束', ...)

onReset()
  → pomodoroStore.clearCurrentSession()

onAutoRestDisabled()
  → sendNotification('专注完成，自动休息已关闭', ...)

onAutoStartLimitReached()
  → sendNotification('已达到连续自动开始上限', ...)
```

**3. 生命周期管理**

- `visibilitychange` 监听器在 store `setup()` 中注册一次（Pinia store 首次 use 时执行），存续整个应用生命周期
- `setInterval` 由 actions 管理：start/resume 时创建，pause/reset/skip/phaseComplete 时清除
- `destroy()` action 可在 app 级别调用，但一般情况下不需要——store 是全局单例，随应用存在

**4. breakWarning 通知**

`tick()` 中检测 break warning 条件时，直接调用 `sendNotification()`，不再通过回调传递。

---

## 三、修改文件

### 1. `apps/web/src/layouts/pomodoro/timer/index.vue` — 中等改动

**当前代码：**
```vue
const {
    timer,
    taskName, handleSelectTask, todayRecords,
    noteText, setNoteText,
    handleStart, handleAdjustTime, handleReset,
    handleOpenSettings, handleSaveNote
} = useTimerPage(dialogManager)
```

**改为：**
```vue
import { usePomodoroTimerStore } from '@/stores/pomodoro-timer-store'
import { storeToRefs } from 'pinia'

const timerStore = usePomodoroTimerStore()
const { phase, remainingSeconds, totalSeconds, isRunning } = storeToRefs(timerStore)

// useTimerPage 只保留非 timer 的逻辑
const {
    taskName, handleSelectTask, todayRecords,
    noteText, setNoteText,
    handleStart, handleAdjustTime, handleReset,
    handleOpenSettings, handleSaveNote
} = useTimerPage(dialogManager)
```

**模板区：**
```vue
<pomodoro-timer-comp
    :phase="phase"
    :is-running="isRunning"
    :remaining-seconds="remainingSeconds"
    :total-seconds="totalSeconds"
    :task-name="taskName"
    @start="handleStart"
    @pause="timerStore.pause()"
    @resume="timerStore.resume()"
    @reset="handleReset"
    @skip="timerStore.skip()"
    @adjust-time="handleAdjustTime($event)"
>
```

### 2. `apps/web/src/layouts/pomodoro/timer/use-timer-page.ts` — 较大改动

**职责变化：**

| 当前职责 | 新职责 |
|---------|--------|
| 创建 `useTimer()` | ❌ 移除（timer 状态由 store 管理） |
| 处理 `onPhaseComplete` 回调 | ❌ 移除（store 内部处理） |
| 处理 `onSkip` 回调 | ❌ 移除（store 内部处理） |
| 处理 `onBreakWarning` 回调 | ❌ 移除（store 内部处理） |
| `handleStart` 中的 NueConfirm | ✅ 保留（UI 弹窗） |
| `handleAdjustTime` | ✅ 保留（调用 `timerStore.adjustTime()`） |
| `handleReset` | ✅ 保留（调用 `timerStore.reset()` + `clearCurrentSession()`） |
| `handleOpenSettings` | ✅ 保留（对话框管理 + `timerStore.updateConfig()`） |
| `handleSaveNote` / `handleSelectTask` / `startNewFocusSession` | ✅ 保留 |

**精简后的 use-timer-page.ts（约80行，原215行）：**

```typescript
import { computed } from 'vue'
import dayjs from 'dayjs'
import { NueMessage, NueConfirm } from 'nue-ui'
import { usePomodoroTimerStore } from '@/stores/pomodoro-timer-store'
import usePomodoroStore from '@/stores/pomodoro-store'
import { POMODORO_TIMER_SETTING_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import type DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import type { TaskViewObject } from '@nao-todo/types'
import { MIN_FOCUS_SECONDS, MAX_FOCUS_SECONDS } from './constants'

export const useTimerPage = (dialogManager: DialogManager) => {
    const pomodoroStore = usePomodoroStore()
    const timerStore = usePomodoroTimerStore()

    const taskName = computed(() => pomodoroStore.currentTaskName)

    const handleSelectTask = (task: TaskViewObject) => {
        pomodoroStore.selectTask(task.id, task.name)
    }

    const handleStart = () => {
        const seconds = timerStore.totalSeconds
        if (seconds < MIN_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能小于 5 分钟')
            return
        }
        if (seconds > MAX_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能大于 180 分钟')
            return
        }

        const doStart = () => {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission()
            }
            timerStore.start()
        }

        if (!pomodoroStore.currentTaskId) {
            NueConfirm({
                title: '确认开始专注',
                content: '还没有选择待办任务，是否要继续开始专注？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
        } else {
            doStart()
        }
    }

    const handleAdjustTime = (delta: number) => {
        timerStore.adjustTime(delta)
    }

    const handleReset = () => {
        timerStore.reset()
        // reset 内部已调用 pomodoroStore.clearCurrentSession()
    }

    const handleOpenSettings = () => {
        dialogManager.open(POMODORO_TIMER_SETTING_DIALOG_KEY, null, () => {
            timerStore.updateConfig()
        })
    }

    const handleSaveNote = () => {
        if (pomodoroStore.currentRecordId) {
            pomodoroStore.updateNote(pomodoroStore.currentRecordId, pomodoroStore.noteText)
        }
    }

    const todayRecords = computed(() =>
        pomodoroStore.records.filter((r) => dayjs(r.startAt).isSame(dayjs(), 'day'))
    )

    return {
        taskName,
        handleSelectTask,
        todayRecords,
        noteText: computed(() => pomodoroStore.noteText),
        setNoteText: (text: string) => pomodoroStore.setNoteText(text),
        handleStart,
        handleAdjustTime,
        handleReset,
        handleOpenSettings,
        handleSaveNote
    }
}
```

### 3. `apps/web/src/stores/pomodoro-store.ts` — 微小改动

检查 `startNewFocusSession` 逻辑是否需要调整。

当前 `startNewFocusSession` 在 `use-timer-page.ts` 中，有 guard `if (!pomodoroStore.currentRecordId)`。在 store 内部，当 `handlePhaseComplete` 触发后需要为新轮次生成新 recordId 时，需要显式调用 `setCurrentSession`。

**可能需要添加一个 action 到 pomodoro-store：**

```typescript
// 在新轮次开始时生成新的 recordId
const generateNewSessionId = () => {
    const recordId = nanoid()
    const startAt = new Date().toISOString()
    currentRecordId.value = recordId
    currentRecordStartAt.value = startAt
    noteText.value = ''
    // 注意：不清除 currentTaskId / currentTaskName
}
```

### 4. `apps/web/src/components/pomodoro/timer/use-timer.ts` — 标记废弃（可选）

这个 thin wrapper 不再需要被 `use-timer-page.ts` 引用。可以保留供其他潜在使用者，或在后续清理中移除。

### 5. `apps/web/src/components/pomodoro/timer/use-pomodoro-state-machine.ts` — 标记废弃（可选）

核心逻辑已迁移至 store。此文件保留为参考，后续可移除。

### 6. `apps/web/src/stores/index.ts` — 新增导出

```typescript
export { usePomodoroTimerStore } from './pomodoro-timer-store'
```

---

## 四、数据流变化对比

### 当前（每次组件挂载创建）

```
timer.vue (emit)
  → use-timer-page.ts (handleStart/handleAdjustTime/etc.)
    → useTimer() → usePomodoroStateMachine() (ref 在 composable 闭包中)
  → pomodoroStore (settings/records via callbacks)
```

### 目标（store 全局单例）

```
timer.vue (emit)
  → use-timer-page.ts (handleStart 等 UI 交互)
    → PomodoroTimerStore (start/pause/resume/skip/adjustTime)
      ├── 内部管理 interval + 状态
      └── PomodoroStore.addRecord() / sendNotification()
```

---

## 五、实施步骤

### Step 1：创建 `pomodoro-timer-store.ts`

- 从 `usePomodoroStateMachine.ts` 复制核心逻辑
- 将 ref 转为 Pinia state
- 将 dispatch/transition table 转为 plain action 函数（状态机表可保留或直接内联为 if/else）
- 将回调内联为对 pomodoroStore 和 Notification API 的直接调用
- 移除 `onBeforeUnmount`，改用 actions 管理 interval 生命周期
- 将 `visibilitychange` 注册移到 setup 顶层

### Step 2：确认 `pomodoro-store.ts` 是否需要新增 `generateNewSessionId`

检查 store 内部的 session 生命周期逻辑。

### Step 3：重构 `use-timer-page.ts`

- 移除 `useTimer()` 调用
- `handleStart` 改为调用 `timerStore.start()`
- `handleAdjustTime` 改为调用 `timerStore.adjustTime()`
- `handleReset` 改为调用 `timerStore.reset()`
- 移除所有回调（onPhaseComplete, onSkip, onBreakWarning）
- 移除 `startNewFocusSession()`（移到 store 内部）

### Step 4：修改 `layouts/pomodoro/timer/index.vue`

- 引入 `usePomodoroTimerStore` + `storeToRefs`
- 模板中 props 改为从 store 读取
- `@pause` / `@resume` / `@skip` 直接调 store actions

### Step 5：验证

- 在 `/pomodoro/timer` 开始计时
- 导航到 `/tasks` → timer 应继续
- 导航回 `/pomodoro/timer` → UI 恢复正确时间
- 测试 pause/resume/skip/reset/adjustTime 全部正常
- 测试 focus→break→focus 完整周期
- 测试长休息触发
- 测试自动开始/自动休息

---

## 六、风险与注意事项

### 1. `visibilitychange` 监听器重复注册

Pinia store 的 `setup()` 函数只执行一次（store 首次 use 时）。`document.addEventListener('visibilitychange', ...)` 在 setup 中注册是安全的，不会被重复注册。

但如果 `destroy()` 被调用后再次调用 `initialize()`，需要重新注册。解决方案：用 flag 跟踪是否已注册，或只在 destroy 中移除。

```typescript
let visibilityHandler: (() => void) | null = null

const setupVisibilityListener = () => {
    if (visibilityHandler) return
    visibilityHandler = () => { ... }
    document.addEventListener('visibilitychange', visibilityHandler)
}

const destroy = () => {
    stopInterval()
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
        visibilityHandler = null
    }
}
```

### 2. 空闲调整时间与默认值同步

当前行为：用户在 idle 状态点 +/- 调整时间，会同时更新 `pomodoroStore.focusDuration` 作为新的默认值。Store 的 `adjustTime` action 需要在 idle 时调用 `pomodoroStore.setFocusDuration(newValue)`。

### 3. 多个组件同时存在

如果未来有 mini 浮窗 + 页面同时显示，store 的响应式状态会被两个组件共享，这是 Pinia 的天然优势，无需特殊处理。

### 4. `currentRecordId` 生命周期

当前 `currentRecordId` 只在 reset 时清除。在全局计时场景下，当完整周期（focus→break→focus）时，记录 ID 的行为需要一致。建议保持现有逻辑不变。
