# 优化 pomodoro-store：重命名 + 清理历史遗留

## Summary

对 `apps/web/src/stores/pomodoro-store.ts` 做两件事：

1. **重命名**：文件 `pomodoro-store.ts` → `pomodoro-records-store.ts`，同步重命名默认导出 `usePomodoroStore` → `usePomodoroRecordsStore`、`defineStore` id `'PomodoroStore'` → `'PomodoroRecordsStore'`，并更新所有引用点。
2. **删死代码（保守）**：删除全局无调用者的 `setRecords`、`updateNote` 两个 action 及其导出。

**明确不合并** `pomodoros-store.ts`：二者是不同领域实体（专注记录 `PomodoroRecordViewObject` vs 常用专注预设 `PomodoroViewObject`），且体系不同（前者手写状态，后者基于 `useMapperStoreBase` + usecase）。

## Current State Analysis

- `pomodoro-store.ts`（`PomodoroStore`）实际职责有三块：专注记录列表（`records`）、当前会话/任务状态、番茄钟设置（localStorage 持久化）。虽名为 records 但含设置状态；用户明确要求更名为 `pomodoro-records-store`，按指示执行。
- `pomodoros-store.ts`（`PomodorosStore`）管理常用专注预设模板，仅是 `usePomodorosStoreBase` 的薄封装。**本次不改动。**

### 确认的死代码（已全局搜索验证无调用者）

- `setRecords`（[pomodoro-store.ts#L45-L48](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-store.ts#L45-L48)）+ 导出（第335行）：无任何调用者。
- `updateNote`（[pomodoro-store.ts#L245-L251](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-store.ts#L245-L251)）+ 导出（第322行）：无任何调用者，且实现有 bug（参数名 `recordId` 却按 `sessionId` 匹配）。

### 保留项（本次保守方案不动）

- `addRecords` action 与内部 usecase 回调的去重逻辑重复 —— 保留（属"去重复逻辑"，超出保守删死代码范围）。
- `records` 导出 —— 保留（虽外部未直接 `.records` 访问，但属公共 state，保守不删）。
- `getRecord`、`addRecords`、`setOnRecordCreated` 等 —— 均有调用者，保留。

### 引用点清单（重命名需更新）

直接 import `@/stores/pomodoro-store`：

- [stores/index.ts#L7](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/index.ts#L7)、[#L18](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/index.ts#L18)
- [stores/pomodoro-timer-store.ts#L5](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts#L5)、`#L34`
- [stores/pomodoro-focus-store.ts#L4](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts#L4)、`#L28`
- [layouts/pomodoro/use-pomodoro-page.ts#L5](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/use-pomodoro-page.ts#L5)、`#L33`
- [layouts/pomodoro/dialogs/timer-setting/use-timer-setting.ts#L4](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/timer-setting/use-timer-setting.ts#L4)、`#L19`
- [infrastructure/hooks/use-pomodoro-record-loader.ts#L10](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/hooks/use-pomodoro-record-loader.ts#L10)、`#L34`

通过 `@/stores` 命名导入 `usePomodoroStore`：

- [components/pomodoro/indicator/use-indicator.ts#L1](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/indicator/use-indicator.ts#L1)、`#L15`
- [layouts/app/task-details/main/pomodoro-info.vue#L2](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/pomodoro-info.vue#L2)、`#L14`

## Proposed Changes

### 1. 新建 `apps/web/src/stores/pomodoro-records-store.ts`

- 内容复制自现 `pomodoro-store.ts`，并：
  - `defineStore('PomodoroStore', ...)` → `defineStore('PomodoroRecordsStore', ...)`
  - `const usePomodoroStore = ...` → `const usePomodoroRecordsStore = ...`
  - `export default usePomodoroStore` → `export default usePomodoroRecordsStore`
  - 删除 `setRecords`（含定义与 return 中的导出）
  - 删除 `updateNote`（含定义与 return 中的导出）
- **why**：文件+符号名一致，避免与复数的 `usePomodorosStore` 混淆；同时清理死代码。
- 随后删除旧文件 `pomodoro-store.ts`。

### 2. `stores/index.ts`

- import 路径 `./pomodoro-store` → `./pomodoro-records-store`，导入名 `usePomodoroStore` → `usePomodoroRecordsStore`，export 列表同步。

### 3. `stores/pomodoro-timer-store.ts` / `stores/pomodoro-focus-store.ts`

- import 路径改为 `@/stores/pomodoro-records-store`，符号 `usePomodoroStore` → `usePomodoroRecordsStore`。
- 调用处 `const pomodoroStore = usePomodoroStore()` → `usePomodoroRecordsStore()`。**局部变量名 `pomodoroStore` 保持不变**（最小化改动，遵循现有风格）。

### 4. `layouts/pomodoro/use-pomodoro-page.ts` / `layouts/pomodoro/dialogs/timer-setting/use-timer-setting.ts` / `infrastructure/hooks/use-pomodoro-record-loader.ts`

- 同上：import 路径与符号改名；`usePomodoroStore()` 调用改为 `usePomodoroRecordsStore()`；局部变量名保持不变。

### 5. `components/pomodoro/indicator/use-indicator.ts` / `layouts/app/task-details/main/pomodoro-info.vue`

- 从 `@/stores` 解构的 `usePomodoroStore` → `usePomodoroRecordsStore`；调用处同步。局部变量名保持不变。

## Assumptions & Decisions

- **不合并两个 store**（用户确认）。
- **重命名连带符号与 store id**：文件名与导出保持一致，避免半重命名的不一致感（用户要求"遵循现有代码风格"，参照 sibling 命名约定）。
- **仅删死代码**：只删 `setRecords`、`updateNote`；不动 `addRecords` 去重复逻辑、不动 `records` 导出。
- **不改局部变量名** `pomodoroStore`：保持 surgical，减少无关 diff。
- `defineStore` id 改名安全：项目未使用 pinia 持久化插件依赖该 id（设置走手写 localStorage key `POMODORO_SETTINGS`，与 store id 无关）。

## Verification

1. 全局搜索确认无残留：`grep -rn "pomodoro-store"`、`grep -rn "usePomodoroStore\b"`、`grep -rn "'PomodoroStore'"` 均应无结果（注意区分复数 `usePomodorosStore` / `'PomodorosStore'` 不受影响）。
2. 确认死代码已移除：`setRecords`、`updateNote` 全局无引用。
3. TypeScript 类型检查 / IDE 诊断无报错（`GetDiagnostics`）。
4. 运行 web 应用构建（如 `pnpm --filter web build` 或项目既定 lint/type-check 命令）通过。
