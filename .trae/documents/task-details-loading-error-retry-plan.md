# TaskDetails 加载状态、分开展示和重试功能实现计划

## 目标

在 TaskDetails 中引入加载中状态的展示，Events 和 Comments 板块分开展示，并且在失败时提供重试功能

## 当前状态分析

1. **现有结构**：
   - `task-details-store.ts` 已经有 `useLoadingErrorStoreBase`，提供统一的 `loading` 和 `error` 状态
   - `task-details.ts` 中的 `initialize` 方法按顺序加载 events 和 comments
   - `details.vue` 已经有统一的 loading 展示，但没有细分到 events 和 comments
   - events 和 comments 已经在 `main/index.vue` 中分开展示（分别通过 `details-main-events` 和 `details-main-comments` 组件）
   - `/packages/components/loading/loading.vue` 中已有 Loading 组件可用于显示加载态

2. **需要改进的点**：
   - events 和 comments 应该有独立的加载和错误状态
   - 每个板块失败时需要提供单独的重试按钮
   - 使用 store 中的 loading/error 状态而不是组件内的局部状态
   - 使用已有的 Loading 组件展示加载状态

## 实现步骤

### 1. 扩展 store base，支持分开的 loading 和 error 状态

**文件**：`/home/nathanlee/Development/nao-todo/apps/web/src/stores/base/loading-error-store-base.ts`

- 创建一个新的基础 store `useDualLoadingErrorStoreBase`，支持两组 loading/error 状态
  - 一组用于 events
  - 一组用于 comments

### 2. 更新 TaskDetailsStore

**文件**：`/home/nathanlee/Development/nao-todo/apps/web/src/stores/tasks/task-details-store.ts`

- 引入新的 `useDualLoadingErrorStoreBase`
- 暴露独立的 eventsLoading/eventsError 和 commentsLoading/commentsError 状态
- 保留原有的统一 loading/error 用于向后兼容（可选）

### 3. 更新 useTaskDetails composable

**文件**：`/home/nathanlee/Development/nao-todo/apps/web/src/layouts/tasks/task-details/task-details.ts`

- 更新 `initialize` 方法，分开处理 events 和 comments 的加载
- 为 events 和 comments 分别设置 loading/error 状态
- 提供 `retryEvents` 和 `retryComments` 方法
- 更新 provide 中的上下文，暴露新的状态和方法

### 4. 更新 types.ts

**文件**：`/home/nathanlee/Development/nao-todo/apps/web/src/layouts/tasks/task-details/types.ts`

- 更新 `TaskDetailsMainContext` 接口，添加新的状态和方法：
  - `eventsLoading: ComputedRef<boolean>`
  - `eventsError: ComputedRef<string>`
  - `commentsLoading: ComputedRef<boolean>`
  - `commentsError: ComputedRef<string>`
  - `retryEvents: () => Promise<void>`
  - `retryComments: () => Promise<void>`

### 5. 更新 details.vue 主组件

**文件**：`/home/nathanlee/Development/nao-todo/apps/web/src/layouts/tasks/task-details/details.vue`

- 移除统一的 loading 展示，改为每个板块独立处理

### 6. 更新 events.vue 组件

**文件**：`/home/nathanlee/Development/nao-todo/apps/web/src/layouts/tasks/task-details/main/events.vue`

- 从上下文中获取 eventsLoading、eventsError 和 retryEvents
- 当 `eventsLoading` 为 true 时，使用 `Loading` 组件展示加载态
- 当 `eventsError` 有值时，展示错误信息和重试按钮

### 7. 更新 comments.vue 组件

**文件**：`/home/nathanlee/Development/nao-todo/apps/web/src/layouts/tasks/task-details/main/comments.vue`

- 从上下文中获取 commentsLoading、commentsError 和 retryComments
- 当 `commentsLoading` 为 true 时，使用 `Loading` 组件展示加载态
- 当 `commentsError` 有值时，展示错误信息和重试按钮

## 变更点

- 新增 `useDualLoadingErrorStoreBase` store base
- 更新 `useTaskDetailsStore`，添加分开的 loading/error 状态
- 更新 `useTaskDetails` composable，添加分开的加载逻辑和重试方法
- 更新 `TaskDetailsContext` 类型定义
- 更新 `details.vue`，移除统一的 loading
- 更新 `events.vue`、`comments.vue` 组件，支持新的 UI 状态（使用 Loading 组件）
