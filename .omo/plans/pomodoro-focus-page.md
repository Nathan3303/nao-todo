# /pomodoro/focus 正计时页面实现方案

## 概述

为已有存根 `/pomodoro/focus` 路由添加正计时功能。用户点击开始后计时器正向计时，
可随时暂停/继续，点击结束按钮后根据累计的计时时长创建一条专注记录。

- 路由/侧边栏/PomodoroViewContext 均已就绪，无需修改
- 与 Timer 模式互斥（启动一方自动停止另一方）
- 正计时状态通过 Pinia store 全局持久化，不受页面切换影响

---

## 一、新增文件

### 1. `apps/web/src/stores/pomodoro-focus-store.ts`

与 `pomodoro-timer-store.ts` 对等的 Pinia 全局单例，正计时引擎。

#### State（响应式）

```typescript
status: Ref<'idle' | 'running' | 'paused'>   // 计时器状态
elapsedSeconds: Ref<number>                    // 当前累计秒数（UI 直接绑定）
startedAt: Ref<string | null>                  // 开始时刻 ISO 字符串（用于记录）
sessionId: Ref<string | null>                  // 当前会话 nanoid（用于记录）
```

#### Internal Engine State（非响应式变量）

```typescript
startTimestamp: number          // 当前轮 resume 时的开始时刻（Date.now()）
accumulatedMs: number           // 暂停时累计的毫秒数
intervalId: number | null       // setInterval handle
visibilityHandler: (() => void) | null  // visibilitychange listener
```

#### Actions

| Action | 触发条件 | 逻辑 |
|---|---|---|
| `start()` | status === 'idle' | 1) 互斥：若 `timerStore.phase !== 'idle'` → `timerStore.reset()` |
| | | 2) 生成 `sessionId = nanoid()`、`startedAt = new Date().toISOString()` |
| | | 3) 设置 `pomodoroStore.setCurrentSession(...)`，清空笔记 |
| | | 4) 请求通知权限 |
| | | 5) `accumulatedMs = 0`, `startTimestamp = Date.now()`，启动 interval |
| `pause()` | status === 'running' | `accumulatedMs += Date.now() - startTimestamp`，停止 interval |
| `resume()` | status === 'paused' | `startTimestamp = Date.now()`，启动 interval |
| `end()` | status !== 'idle' | 1) 停止 interval |
| | | 2) 构建 record（`type: 1`, `sessionId`, `startAt`, `endAt: now`, `duration: elapsedSeconds`） |
| | | 3) `pomodoroStore.addRecord(record)` |
| | | 4) `pomodoroStore.clearCurrentSession()` |
| | | 5) 回到 idle |
| `reset()` | status !== 'idle' | 停止 interval，清除 session，回到 idle（不创建记录） |
| `destroy()` | 应用关闭 | 清理 interval 和 visibilitychange 监听 |

#### Tick 逻辑（每 250ms）

```typescript
const tick = () => {
  if (status.value !== 'running') return
  const totalMs = accumulatedMs + (Date.now() - startTimestamp)
  elapsedSeconds.value = Math.floor(totalMs / 1000)
}
```

#### Visibility Change

同 timer store：`visibilitychange` → `requestAnimationFrame(tick)` 修正切回页面后的显示。

#### 初始化

在 store `setup()` 中注册 `visibilitychange` listener。

---

### 2. `apps/web/src/components/pomodoro/focus/types.ts`

```typescript
export type FocusStatus = 'idle' | 'running' | 'paused'

export interface FocusTimerProps {
  status: FocusStatus
  elapsedSeconds: number
  taskName?: string
}

export interface FocusTimerEmits {
  (e: 'start'): void
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'end'): void
  (e: 'cancel'): void
}
```

### 3. `apps/web/src/components/pomodoro/focus/focus.vue`

正计时 UI 组件，命名为 `PomodoroFocusComp`。

#### 布局

与 `PomodoroTimerComp` 相同的 `nue-div--pomodoro-timer` 容器结构：

```
nue-div--pomodoro-timer
├── nue-div--timer
│   ├── nue-progress（环形，用于视觉装饰，不关联进度）
│   └── nue-div--time-wrapper
│       ├── nue-text--time-duration（显示 "14:30 → 当前" 时间范围）
│       ├── nue-text--time（elapsed 显示 "01:23:45" 或 "23:45"）
│       └── nue-div--below-time-string（slot，复用任务选择器）
└── nue-div--actions（三按钮固定布局）
    ├── 取消 → emit('cancel')
    ├── 开始/暂停 → emit('start' | 'pause' | 'resume')
    └── 结束 → emit('end')
```

#### 按钮状态表

| 按钮 | idle | running | paused |
|------|------|---------|--------|
| **取消** | disabled/grayed | enabled → cancel | enabled → cancel |
| **开始/暂停** | "开始" → start | "暂停" → pause | "继续" → resume |
| **结束** | disabled/grayed | "结束" → end | "结束" → end |

#### displayTime 格式化

- `elapsedSeconds < 3600` → `MM:SS`
- `elapsedSeconds >= 3600` → `HH:MM:SS`

#### 装饰环处理

环形 `nue-progress` 在 focus 模式下没有 progress 语义。
方案：固定 100% 环形作为装饰，配合 `nue-progress type="circle" color` 仅做视觉框架，
running 态可改用动画/脉动效果（后期迭代）。初始版本直接使用静态环。

---

### 4. `apps/web/src/components/pomodoro/focus/index.ts`

```typescript
import Focus from './focus.vue'

export const PomodoroFocusComp = Focus
export type { FocusStatus, FocusTimerProps, FocusTimerEmits } from './types'
```

### 5. `apps/web/src/layouts/pomodoro/focus/use-focus-page.ts`

与 `use-timer-page.ts` 对等的页面 composable。

```typescript
export const useFocusPage = (dialogManager: DialogManager, subscriber?: Subscriber) => {
  const pomodoroStore = usePomodoroStore()
  const focusStore = usePomodoroFocusStore()

  // 记录用例 + 加载器（与 timer 页相同模式）
  const pomodoroRecordUseCase = PomodoroRecordUseCase.create({ ... })
  const recordLoader = usePomodoroRecordLoader(pomodoroRecordUseCase, {
    startTime: dayjs().startOf('day').toISOString(),
    endTime: dayjs().endOf('day').toISOString(),
    type: 1,   // focus 模式
    sort: 'startAt:desc'
  })

  // Subscriber 通知（与 timer 页相同模式）
  // ...

  // Handler: 取消（不保存直接重置）
  const handleCancel = () => { focusStore.reset() }

  // Handler: 开始/暂停/继续（委托给 store）
  const handleStartPauseResume = () => {
    if (focusStore.status === 'idle') focusStore.start()
    else if (focusStore.status === 'running') focusStore.pause()
    else focusStore.resume()
  }

  // Handler: 结束（创建记录）
  const handleEnd = () => { focusStore.end() }

  // onMounted：加载今日记录
  // Returns: status, elapsedSeconds, taskName, handleSelectTask, todayRecords, ...
}
```

#### 关于 record `type`

当前 `usePomodoroRecordLoader` 的 filter 参数包含 `type: number`。检查已有代码确认枚举值：
- `type: 0` = timer（timer store 的 `buildRecord` 中硬编码）
- `type: 1` = focus（待确认，需查看 API/类型定义）

**若 API 使用 0/1 值**：focus 页传 `type: 1` 加载 focus 记录。
**若 API 使用 string**：需查 `PomodoroRecordViewObject.type` 的实际序列化值。

#### 互斥逻辑

在 store 中实现（见上文 `start()`），`use-focus-page.ts` 无额外互斥代码。

---

### 6. `apps/web/src/layouts/pomodoro/focus/index.vue`

替换存根。与 `timer/index.vue` 结构对等：

```vue
<script setup lang="ts">
import { inject } from 'vue'
import { storeToRefs } from 'pinia'
import { PomodoroFocusComp, PomodoroRecordsComp, PomodoroNotesComp } from '@/components/pomodoro'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { usePomodoroFocusStore } from '@/stores/pomodoro-focus-store'
import { useFocusPage } from './use-focus-page'
import { PomodoroTaskSelectDropdown } from '../task-select-dropdown'

defineOptions({ name: 'PomodoroFocus' })

const { isDisplayAside, switchDisplayAside, dialogManager, subscriber } =
  inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

const focusStore = usePomodoroFocusStore()
const { status, elapsedSeconds } = storeToRefs(focusStore)

const {
  taskId, taskName, handleSelectTask,
  todayRecords, noteText, setNoteText,
  handleStartPauseResume, handleCancel, handleEnd,
  recordLoading, recordIsDone, handleNextPage,
  showTaskDetails
} = useFocusPage(dialogManager, subscriber)
</script>
```

Template 与 timer 页大致相同，仅：
- 标题改为 "正计时"
- 描述文案改为正计时的说明
- `<pomodoro-timer-comp>` 替换为 `<pomodoro-focus-comp>`
- props 改为 `:status="status"` `:elapsed-seconds="elapsedSeconds"` `:task-name="taskName"`
- events 改为 `@cancel="handleCancel"` `@start="handleStartPauseResume"` `@pause="handleStartPauseResume"` `@resume="handleStartPauseResume"` `@end="handleEnd"`
- 无 settings 按钮（focus 无相关设置）

---

## 二、修改文件

### 7. `apps/web/src/components/pomodoro/index.ts`

```typescript
// 新增导出
export * from './focus'
```

### 8. `apps/web/src/stores/pomodoro-timer-store.ts`

在 `start()` action 开头添加互斥逻辑：

```typescript
const start = () => {
  if (phase.value !== 'idle') return

  // 互斥：如果 focus 正计时活跃，先停掉
  const focusStore = usePomodoroFocusStore()
  if (focusStore.status !== 'idle') {
    focusStore.reset()
  }

  // ...原有代码...
}
```

注意：`usePomodoroFocusStore()` 是懒调用的，在 action 内部执行而非模块顶层，
避免 Pinia 初始化阶段的循环依赖。

### 9. `apps/web/src/stores/pomodoro-focus-store.ts`（与新增同步）

在 `start()` action 中反向互斥：

```typescript
const start = () => {
  if (status.value !== 'idle') return

  // 互斥：如果 timer 倒计时活跃，先停掉
  const timerStore = usePomodoroTimerStore()
  if (timerStore.phase !== 'idle') {
    timerStore.reset()
  }

  // ...正计时启动逻辑...
}
```

---

## 三、验证标准

| 检查项 | 方法 |
|---|---|
| `vue-tsc --noEmit` 通过 | 无类型错误 |
| `vite build` 通过 | 无构建错误 |
| 正计时 tick 准确 | 手动测试：启动后观察秒数增长 |
| 暂停/继续累计正确 | 暂停 5 秒后继续，duration 不应包含暂停时间 |
| 记录创建 | 点击结束 → 检查 todayRecords 列表是否出现新记录 |
| 记录数据正确 | `startAt` = 点击开始时刻，`endAt` = 点击结束时刻，`duration` = 走秒数 |
| 互斥 | Timer 运行时切到 Focus 页启动 → Timer 停止；反向同理 |
| 跨路由持久化 | Focus 运行中切换到 Timer 页面 → 切回来 → UI 恢复 |
| 页面刷新 | 刷新后状态回到 idle（Pinia store 内存状态，未持久化） |

---

## 四、执行步骤

1. **Step 1** — `stores/pomodoro-focus-store.ts`：正计时 Pinia store（含互斥逻辑）
2. **Step 2** — `components/pomodoro/focus/`：types.ts + focus.vue + index.ts（三按钮组件）
3. **Step 3** — `components/pomodoro/index.ts`：添加 PomodoroFocusComp 导出
4. **Step 4** — `layouts/pomodoro/focus/use-focus-page.ts`：页面 composable
5. **Step 5** — `layouts/pomodoro/focus/index.vue`：替换存根
6. **Step 6** — `stores/pomodoro-timer-store.ts`：在 start() 添加互斥
7. **Step 7** — 验证：`vue-tsc` + `vite build`
