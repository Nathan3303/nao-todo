# 计划：将 pomodoroUseCase 从 pomodoro-records-store 中分离

## Summary

将 `PomodoroRecordUseCase` 的依赖从 `pomodoro-records-store.ts` 中彻底移除，使 Store 仅承担状态管理职责（实现 `PomodoroRecordStore` 接口）。Usecase 在应用层（`use-pomodoro-record-usecase.ts`）实例化，由 `use-pomodoro-page.ts` 注入到 timer/focus stores 中用于创建记录。修复当前 Store 中 `pomodoroRecordUseCase` 未定义的运行时错误。

## Current State Analysis

### 现有问题

1. **运行时错误**：[pomodoro-records-store.ts:230](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/stores/pomodoro-records-store.ts#L230) 调用 `pomodoroRecordUseCase.createRecord(...)`，但该变量只在已注释的代码块（L52-L63）内声明，运行时为 `undefined`。

2. **错误的 import**：[pomodoro-records-store.ts:5](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/stores/pomodoro-records-store.ts#L5) 导入 `PomodoroUseCase`（应为 `PomodoroRecordUseCase`），且未被使用。

3. **方法名冲突**：Store 的 `addRecord(createViewObject: CreatePomodoroRecordViewObject): GoAsync<...>`（L227）与 `PomodoroRecordStore` 接口要求的 `addRecord(record: PomodoroRecordViewObject): void`（[types/store.ts:37](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/types/store.ts#L37)）签名冲突。

4. **调用方依赖**：[pomodoro-timer-store.ts:287,443](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/stores/pomodoro-timer-store.ts#L287) 和 [pomodoro-focus-store.ts:219](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/stores/pomodoro-focus-store.ts#L219) 通过 `persistPomodoroRecord(pomodoroStore.addRecord, ...)` 调用上述 broken action。

### Usecase 已在外部实例化

[use-pomodoro-record-usecase.ts](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/hooks/usecases/use-pomodoro-record-usecase.ts) 已实现工厂函数 `newPomodoroRecordUseCase(store: PomodoroRecordStore)`，由 [use-pomodoro-page.ts:60-67](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/components/pomodoro/use-pomodoro-page.ts#L60-L67) 调用。

### 决策（用户确认）

* **调用方策略**：在 timer/focus stores 中通过 setter 注入 `createRecord` 函数

* **副作用处理**：`onRecordCreated` 保留在 Store 中（由新接口方法 `addRecord(record)` 触发）；`noteText` 重置移出（timer/focus stores 在 session start 时已调用 `setNoteText('')`，原 `addRecord` 中的重置冗余）

* **代码风格**：严格遵循现有项目代码风格（`// @state`/`// @action` 注释、arrow function、import 排序）

***

## Proposed Changes

### 1. `packages/domain/pomodoro/stores/pomodoro-records-store.ts`

**目标**：移除 usecase 依赖，新增接口方法 `addRecord(record)`，删除 broken action。

#### 1.1 清理 imports（L1-L5）

删除未使用的 `GoAsync`、`CreatePomodoroRecordViewObject`、`PomodoroUseCase` imports。

```typescript
// Before:
import type { GoAsync } from '@nao-todo/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CreatePomodoroRecordViewObject, PomodoroRecordViewObject } from '../types'
import { PomodoroUseCase } from '../usecases'

// After:
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PomodoroRecordViewObject } from '../types'
```

#### 1.2 删除注释掉的 usecase 实例化（L51-L63）

整段删除（`// @usecase Pomodoro 记录用例` 至 `// })`）。

#### 1.3 新增接口方法 `addRecord(record)`，删除 broken action `addRecord(createViewObject)`

将 L226-L235 的 broken action：

```typescript
// @action 添加专注记录（异步：先调 API 持久化，成功后再推入本地列表）
const addRecord = async (
    createViewObject: CreatePomodoroRecordViewObject
): GoAsync<PomodoroRecordViewObject[]> => {
    const [record, err] = await pomodoroRecordUseCase.createRecord(createViewObject)
    if (err !== null) return [null, err]
    onRecordCreated?.(record)
    noteText.value = ''
    return [[record], null]
}
```

替换为 `PomodoroRecordStore` 接口实现：

```typescript
// @action 添加专注记录（实现 PomodoroRecordStore 接口，由 usecase 调用）
const addRecord = (record: PomodoroRecordViewObject) => {
    if (recordsMap.value.has(record.id)) return
    records.value.push(record)
    onRecordCreated?.(record)
}
```

**说明**：

* 去重检查（`recordsMap.value.has`）保持与 `addRecords` 一致的语义

* `onRecordCreated?.(record)` 仅在新增成功时触发（保持 loader subscriber 通知链路）

* 移除 `noteText.value = ''`（用户决策：冗余）

* 移除 usecase 调用（Store 不再持有 usecase）

#### 1.4 return 语句无需改动

`addRecord` 名称不变，return 中 `addRecord` 引用仍然有效（指向新方法）。L287-L320 保持原样。

***

### 2. `packages/domain/pomodoro/utils/pomodoro.ts`

**目标**：`persistPomodoroRecord` 的第一个参数类型从 Store 的旧 `addRecord` 签名改为 usecase 的 `createRecord` 签名。

#### 2.1 修改 `persistPomodoroRecord`（L80-L95）

```typescript
// Before:
export const persistPomodoroRecord = (
    addRecord: (record: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject[]>,
    record: CreatePomodoroRecordViewObject,
    errorTag: string
) => {
    addRecord(record).then(([, err]) => {
        if (err !== null) console.error(errorTag, err)
    })
}

// After:
export const persistPomodoroRecord = (
    createRecord: (record: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject>,
    record: CreatePomodoroRecordViewObject,
    errorTag: string
) => {
    createRecord(record).then(([, err]) => {
        if (err !== null) console.error(errorTag, err)
    })
}
```

**说明**：

* 参数名 `addRecord` → `createRecord`（语义对齐 usecase 方法名）

* 返回类型从 `GoAsync<PomodoroRecordViewObject[]>` 改为 `GoAsync<PomodoroRecordViewObject>`（匹配 [PomodoroRecordUseCase.createRecord](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/usecases/pomodoro-record.ts#L37-L51) 的签名）

* `.then(([, err]) => ...)` 解构不变（`GoAsync<T> = [T, Error | null]`，无论 T 是单个值还是数组，解构都成立）

***

### 3. `packages/domain/pomodoro/stores/pomodoro-timer-store.ts`

**目标**：注入 `createRecord` 函数，替换对 `pomodoroStore.addRecord` 的调用。

#### 3.1 新增 import 和注入状态

在 imports 区域新增：

```typescript
import type { GoAsync } from '@nao-todo/shared'
import type {
    CreatePomodoroRecordViewObject,
    PomodoroRecordViewObject
} from '../types'
```

（若 `pomodoro-timer-store.ts` 已有 `@nao-todo/shared` 的 import，则合并到该 import 中。）

在 `Dependencies` 区块（L36-L37 附近）下方新增：

```typescript
// ========================================================================
// Injected Dependencies
// ========================================================================

// @injected 记录创建函数（由 use-pomodoro-page 注入，避免 Store 依赖 usecase）
let createRecordFn:
    | ((createViewObject: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject>)
    | null = null

const setCreateRecordFn = (
    fn: ((createViewObject: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject>) | null
) => {
    createRecordFn = fn
}
```

#### 3.2 修改 `handlePhaseComplete` 中的调用（L286-L290）

```typescript
// Before:
persistPomodoroRecord(
    pomodoroStore.addRecord,
    record,
    '[Pomodoro] Failed to create record:'
)

// After:
if (createRecordFn) {
    persistPomodoroRecord(
        createRecordFn,
        record,
        '[Pomodoro] Failed to create record:'
    )
}
```

#### 3.3 修改 `skip` 中的调用（L442-L446）

```typescript
// Before:
persistPomodoroRecord(
    pomodoroStore.addRecord,
    record,
    '[Pomodoro] Failed to create record on skip:'
)

// After:
if (createRecordFn) {
    persistPomodoroRecord(
        createRecordFn,
        record,
        '[Pomodoro] Failed to create record on skip:'
    )
}
```

#### 3.4 在 return 中导出 setter

在 return 对象的 `// Actions` 区块新增 `setCreateRecordFn`：

```typescript
return {
    // State
    phase,
    status,
    remainingSeconds,
    totalSeconds,
    isIdle,
    isRunning,

    // Actions
    start,
    pause,
    resume,
    reset,
    skip,
    adjustTime,
    updateConfig,
    destroy,
    setCreateRecordFn
}
```

**说明**：`if (createRecordFn)` 守卫处理 restore-from-storage 时（`usePomodoroTimerStore()` setup 阶段调用 `restoreFromStorage` → `handlePhaseComplete`）`createRecordFn` 尚未注入的场景。此为**预存在**的 broken 行为（原代码 `pomodoroStore.addRecord` 调用 undefined 的 `pomodoroRecordUseCase` 也会抛错），本次不修复，仅避免抛错。

***

### 4. `packages/domain/pomodoro/stores/pomodoro-focus-store.ts`

**目标**：同 timer store，注入 `createRecord` 函数。

#### 4.1 新增 import 和注入状态

在 imports 区域新增：

```typescript
import type { GoAsync } from '@nao-todo/shared'
import type {
    CreatePomodoroRecordViewObject,
    PomodoroRecordViewObject
} from '../types'
```

在 `Dependencies` 区块（L31-L34 附近）下方新增：

```typescript
// ========================================================================
// Injected Dependencies
// ========================================================================

// @injected 记录创建函数（由 use-pomodoro-page 注入，避免 Store 依赖 usecase）
let createRecordFn:
    | ((createViewObject: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject>)
    | null = null

const setCreateRecordFn = (
    fn: ((createViewObject: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject>) | null
) => {
    createRecordFn = fn
}
```

#### 4.2 修改 `end` 中的调用（L218-L222）

```typescript
// Before:
persistPomodoroRecord(
    pomodoroStore.addRecord,
    record,
    '[PomodoroFocus] Failed to create record:'
)

// After:
if (createRecordFn) {
    persistPomodoroRecord(
        createRecordFn,
        record,
        '[PomodoroFocus] Failed to create record:'
    )
}
```

#### 4.3 在 return 中导出 setter

在 return 对象的 `// Actions` 区块新增 `setCreateRecordFn`：

```typescript
return {
    // State
    status,
    elapsedSeconds,

    // Actions
    start,
    pause,
    resume,
    end,
    reset,
    destroy,
    setCreateRecordFn
}
```

***

### 5. `apps/web/src/components/pomodoro/use-pomodoro-page.ts`

**目标**：创建 usecase 后注入到 timer/focus stores；简化 usecase 构造（直接传 `pomodoroStore`）。

#### 5.1 简化 usecase 构造（L60-L67）

由于 `pomodoroStore` 重构后实现了 `PomodoroRecordStore` 接口（`addRecord`/`addRecords` 签名匹配），可直接传入：

```typescript
// Before:
const pomodoroRecordUseCase = newPomodoroRecordUseCase({
    addRecord: (record) => {
        pomodoroStore.addRecord(record)
    },
    addRecords: (records) => {
        pomodoroStore.addRecords(records)
    }
})

// After:
const pomodoroRecordUseCase = newPomodoroRecordUseCase(pomodoroStore)
```

**说明**：原 inline adapter 是为绕过方法名冲突（旧 `addRecord` 签名不匹配接口）。重构后冲突消除，adapter 不再必要。

#### 5.2 注入 `createRecord` 到 timer/focus stores

在 usecase 创建后（L60 之后）新增：

```typescript
// 注入 createRecord 到 timer/focus stores（避免 stores 依赖 usecase）
const boundCreateRecord = pomodoroRecordUseCase.createRecord.bind(pomodoroRecordUseCase)
timerStore.setCreateRecordFn(boundCreateRecord)
focusStore.setCreateRecordFn(boundCreateRecord)
```

**说明**：`.bind(usecase)` 确保 `this` 上下文正确（usecase 方法内访问 `this.store`、`this.repo`、`this.domain`）。

***

## Assumptions & Decisions

1. **`onRecordCreated`** **触发时机**：仅在 `addRecord(record)` 实际新增记录时触发（去重跳过时不触发）。保持 loader subscriber 通知语义。

2. **`noteText`** **重置移除**：timer/focus stores 在 session start 时已调用 `setNoteText('')`（[pomodoro-timer-store.ts:139](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/stores/pomodoro-timer-store.ts#L139)、[pomodoro-focus-store.ts:171](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/stores/pomodoro-focus-store.ts#L171)），原 `addRecord` 中的重置冗余，直接移除。

3. **restore-from-storage 的预存在 bug**：store setup 阶段 `restoreFromStorage` 可能触发 `handlePhaseComplete`，此时 `createRecordFn` 尚未注入。用 `if (createRecordFn)` 守卫避免抛错，但不修复底层问题（原代码同样 broken）。如需修复，需另行重构 `restoreFromStorage` 的调用时机。

4. **不修改** **`PomodoroRecordUseCase`** **类本身**：usecase 的 `createRecord` 方法内部已调用 `this.store.addRecord(viewObject)`（[pomodoro-record.ts:48](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain/pomodoro/usecases/pomodoro-record.ts#L48)），重构后 Store 的 `addRecord(record)` 正好匹配接口，无需改动 usecase。

5. **不修改** **`use-pomodoro-record-loader.ts`**：loader 通过 `pomodoroStore.setOnRecordCreated` 订阅，重构后 `onRecordCreated` 触发链路保持不变。

6. **代码风格**：所有新增代码遵循现有 `// @state`/`// @action`/`// @injected` 注释风格、arrow function 定义、section 分隔注释（`// ===...`）。

***

## Verification Steps

1. **类型检查**：在仓库根目录运行 `pnpm typecheck`（或对应的 workspace 命令），确认无类型错误。重点检查：

   * `pomodoro-records-store.ts` 无未使用 import、无 `pomodoroRecordUseCase` 引用

   * `pomodoro-timer-store.ts` 和 `pomodoro-focus-store.ts` 的 `setCreateRecordFn` 类型正确

   * `use-pomodoro-page.ts` 的 `newPomodoroRecordUseCase(pomodoroStore)` 类型匹配（`pomodoroStore` 结构满足 `PomodoroRecordStore` 接口）

2. **运行时验证**：

   * 启动 dev server，进入番茄钟页面

   * **倒计时模式**：开始专注 → 等待完成 → 确认记录列表新增一条记录（验证 `createRecordFn` 注入 + usecase.createRecord → store.addRecord → onRecordCreated → loader prepend）

   * **正计时模式**：开始正计时 → 点击结束 → 确认记录列表新增一条记录

   * **跳过专注**：开始专注 → 点击跳过 → 确认部分时长记录被创建

   * **分页加载**：滚动加载更多记录 → 确认 `addRecords` 去重正常

3. **回归验证**：

   * 刷新页面后计时器状态恢复（`restoreFromStorage`）不抛错（即使 `createRecordFn` 未注入，`if` 守卫保护）

   * 笔记输入在专注完成后清空（下次 start 时重置）

4. **代码审查**：

   * `pomodoro-records-store.ts` 中 grep `pomodoroRecordUseCase` 应无结果

   * `pomodoro-records-store.ts` 中 grep `PomodoroUseCase` 应无结果

   * timer/focus stores 中 grep `pomodoroStore.addRecord` 应无结果（替换为 `createRecordFn`）

