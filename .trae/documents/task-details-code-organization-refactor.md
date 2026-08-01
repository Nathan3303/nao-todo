# TaskDetails 代码组织优化方案

## Summary

对 `apps/web/src/layouts/app/task-details/` 下的 TaskDetails 组件做**代码组织重构 + 死代码清理**，不改变任何用户可见行为。核心目标：

1. 将 283 行的“上帝 composable” [task-details.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/task-details.ts) 拆分为职责单一的 composable，与已有的 [use-subtasks.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/use-subtasks.ts) 对齐，使 `task-details.ts` 收敛为纯编排器（orchestrator）。
2. 移除未被任何父组件消费的 `emit` / `TaskDetailsEmits` 死代码链路。
3. 统一重复的进度计算逻辑（`checkItemProgress` 与 `subTaskProgress`）。

约束：**严格遵从现有代码风格**（`useXxx` 默认导出、`@xxx` 注释标记、中文注释、`GoAsync` 错误处理等）。

## Current State Analysis

### 架构现状

- 组件树：`index.vue`(adapter) → `details.vue` / `float-details.vue` → `header/` + `main/` + `footer/`。

- 逻辑中枢：[task-details.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/task-details.ts) 的 `useTaskDetails(props, emit)`，一次性 `provide(TASK_DETAILS_CONTEXT_KEY, {...})`，子组件全部通过 `inject` 消费。

- 数据分层清晰：`usecase` → `handler` → `store`，本次重构**不触碰**这三层。

### 具体问题

1. **职责混杂**：`task-details.ts` 同时承担：

    - 任务详情拉取与 ViewObject 组装（`getTaskDetails`，L84–125）

    - 检查事项加载/重试（`loadCheckItems`/`retryCheckItems`，L143–155）

    - 评论加载/重试（`loadComments`/`retryComments`，L161–173）

    - 进度计算（`checkItemProgress`，L130–137）

    - 导航（`closeDetails`/`switchTaskDetails`，L197–207）

    - 检查事项转任务（`makeCheckItemToTask`，L213–220）

    - 检查事项排序（`resortCheckItems`，L230–236）

    - 初始化编排（`initialize` + `watch`，L179–227）

    - 组装并 `provide` context（L239–276）

    而子任务逻辑**已经**抽到了 [use-subtasks.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/use-subtasks.ts)（`useSubTasks`）——形成**不一致**：同类并列关注点（checkItems / comments / subTasks），只有 subTasks 被独立封装。

2. **死代码** **`emit`** **链路**：

    - [types.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/types.ts#L27-L49) 定义了 49 行的 `TaskDetailsEmits`（14 个事件）。

    - [details.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/details.vue#L11-L13) `defineEmits` 后透传给 `useTaskDetails(props, emit)`。

    - `task-details.ts` 把 `emit` 原样 `provide` 进 context（L242）。

    - **验证结论**：`TaskDetailsAdapter` 在 [tasks/entry.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/tasks/entry.vue#L48) 与 [pomodoro/entry.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/entry.vue#L37) 使用时**未绑定任何事件监听**；且全仓库 grep `emit(` 在 task-details 目录内**无任何调用点**。→ 整条 `emit` 链路为死代码。

3. **进度计算重复**：`checkItemProgress`（task-details.ts L130–137）与 `subTaskProgress`（[main/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/index.vue#L42-L48)）逻辑几乎一致，均硬编码中文串 `已完成 x/y, z%`。仓库已存在 i18n key `task.eventProgressText`（zh-CN.ts:229 / en-US.ts:232 / types.ts:225），但**未被使用**。

## Proposed Changes

> 原则：纯代码组织调整，逐文件行为等价。新增 composable 一律遵循现有 `useXxx` + `export default` 风格，保留 `@xxx` 注释标记与中文注释。

### 1. 新增 `use-check-items.ts`（提取检查事项关注点）

**What**：新建 `apps/web/src/layouts/app/task-details/use-check-items.ts`，导出 `useCheckItems(taskDetailsStore, subscriber)`。
**Why**：与 `use-subtasks.ts` 对齐，把检查事项的 usecase/handler/加载/重试/进度/转任务/排序集中管理。
**How**：迁移以下逻辑（保持实现不变）：

- `newTaskCheckItemUseCase` + `TaskCheckItemHandler` 实例化

- `checkItems`（`storeToRefs`）、`checkItemsLoading`、`checkItemsError`

- `loadCheckItems` / `retryCheckItems`（`retry` 依赖 `currentTaskId`，内部维护 `currentTaskId` 变量，与 use-subtasks 的 `currentParentTaskId` 同构）

- `checkItemProgress`（进度计算，见变更 5 统一）

- `resortCheckItems`、`makeCheckItemToTask`（`makeCheckItemToTask` 依赖 `dialogManager`，作为参数传入）

- 返回上述状态与方法。

### 2. 新增 `use-comments.ts`（提取评论关注点）

**What**：新建 `apps/web/src/layouts/app/task-details/use-comments.ts`，导出 `useComments(taskDetailsStore, subscriber)`。
**Why**：同上，评论加载/重试逻辑独立。
**How**：迁移 `newTaskCommentUseCase` + `TaskCommentHandler`、`comments`、`commentsLoading`、`commentsError`、`loadComments`、`retryComments`、`isCommenting`（`ref`）。返回状态与方法。

### 3. 新增 `use-task-view-object.ts`（提取主任务详情拉取）

**What**：新建 `apps/web/src/layouts/app/task-details/use-task-view-object.ts`，导出 `useTaskViewObject(taskUseCase, tagStore, getProjectName)`。
**Why**：`getTaskDetails` 的 42 行 ViewObject 组装是独立关注点，隔离后 orchestrator 更清爽。
**How**：迁移 `task`(ref)、`loading`、`error`、`getTaskDetails`（实现原样保留，包括逐字段赋值与 `tagList`/`projectName` 组装）。返回 `{ task, loading, error, getTaskDetails }`。

### 4. 重写 `task-details.ts` 为纯编排器

**What**：`useTaskDetails(props)` 仅负责：注入 pre-context → 实例化上述 composable → 组织 `initialize` + `watch` → `provide` context → 返回 `{ loading, error, task, closeDetails }`。
**Why**：单一职责，从 283 行降到约 80–100 行，可读性显著提升。
**How**：

- 移除 `emit` 参数（见变更 6）。

- 导航函数 `closeDetails` / `switchTaskDetails` 保留在此文件（属于编排级职责，且被多个 composable 复用为参数）。

- `initialize` 保留：并行 `Promise.all([getTaskDetails, loadCheckItems, loadComments, loadSubTasks])`，逻辑不变。

- `provide` 内容与现状**完全一致的键集合**（除移除 `emit`），保证所有 `inject` 子组件无需改动（header/footer/main/\*）。

### 5. 统一进度计算

**What**：在 `use-check-items.ts` 与 `use-subtasks.ts` 各自提供 `checkItemProgress` / `subTaskProgress`，抽取一个共享纯函数计算进度。
**Why**：消除重复，去掉散落的硬编码中文串。
**How**（二选一，默认 5a）：

- **5a（推荐，最小侵入）**：在 task-details 目录内新增轻量纯函数（可置于 `use-subtasks.ts` 同级的小工具，或直接各 composable 内联保留现有实现）。鉴于“严格遵从现有风格”且现状为内联，**保守做法**：`subTaskProgress` 从 [main/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/index.vue#L42-L48) 移入 `use-subtasks.ts` 并经 context 暴露（与 `checkItemProgress` 对称），`main/index.vue` 改为消费 `subTaskProgress`。两处进度串仍分别保留，但位置对称、来源统一。

- **5b（可选增强）**：改用 i18n key `task.eventProgressText` 渲染进度文本，消除硬编码。**默认不做**（避免超出“代码组织”范畴、改变文案来源），仅在 Assumptions 中记录。

采用 **5a**：

- `use-subtasks.ts` 增加 `subTaskProgress` computed（逻辑同 main/index.vue 现有实现），并入返回值。

- `context.ts` 的 `TaskDetailsContext` 增加 `subTaskProgress: ComputedRef<{ percentage: number; text: string }>`。

- `task-details.ts` provide 增加 `subTaskProgress`。

- `main/index.vue` 删除本地 `subTaskProgress` computed 与 `subTasks` 注入（改注入 `subTaskProgress`），`computed` import 若无其他用途一并移除。

### 6. 移除 `emit` / `TaskDetailsEmits` 死代码

**What**：删除未被消费的事件链路。
**Why**：无任何父组件监听，纯负担。
**How**：

- [types.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/types.ts)：删除 `TaskDetailsEmits` 类型及其相关的仅服务于它的 usecase 类型 import（保留 `TaskDetailsViewObject`、`TaskDetailsProps` 及其真实依赖）。

- [details.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/details.vue)：移除 `defineEmits`、`TaskDetailsEmits` import，`useTaskDetails(props, emit)` → `useTaskDetails(props)`。

- [context.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/context.ts)：从 `TaskDetailsContext` 删除 `emit` 字段及其 import。

- `task-details.ts`：不再接收/`provide` `emit`。

- **校验**：确认 `main/*`、`header`、`footer` 中无 `inject().emit` 使用（grep 已确认无）。

## Assumptions & Decisions

- **行为等价**：本次重构不改变任何交互、请求、渲染结果，仅调整文件与函数组织。

- **不触碰数据层**：`packages/usecases`、`handlers`、`stores` 保持不变。

- **context 键集合稳定**：除“移除 `emit`、新增 `subTaskProgress`”外，`TASK_DETAILS_CONTEXT_KEY` 暴露的键保持不变，确保 `inject` 侧零改动（除 main/index.vue 因变更 5a 主动调整）。

- **composable 风格**：`useXxx` 命名 + `export default`（与 `use-subtasks.ts` 一致），保留 `@store`/`@usecase`/`@hook` 等注释标记与中文注释。

- **i18n 硬编码（5b）不在本次范围**：进度文案沿用现有中文串，仅统一位置，避免超范围。

- `use-event-dragger.ts` 已是独立 composable，保持不变。

## Verification

1. **类型检查**：改动后运行 `GetDiagnostics`（或 `pnpm -F web type-check` 等价命令）确认无 TS 报错，尤其是 context 类型、composable 返回类型、`GoAsync` 签名。
2. **静态自检**：

    - grep 确认 `TaskDetailsEmits`、`defineEmits`、`emit` 在 task-details 目录内已无残留引用。

    - grep 确认所有 `inject(TASK_DETAILS_CONTEXT_KEY)` 消费的键在新 `provide` 中均存在。

3. **手动冒烟**（开发服务器）：

    - 打开任务详情面板：标题/状态/优先级/日期/描述正常渲染。

    - 检查事项：加载、创建、勾选、编辑、排序、转任务、重试均正常。

    - 评论：加载、创建、编辑、删除、重试正常。

    - 子任务：加载、创建、勾选、编辑、进度显示、跳转正常。

    - 页脚下拉：复制、移动为子任务、删除/放弃/恢复正常。

    - 关闭面板、父子任务间跳转正常。

4. **行为对照**：确认进度文本（检查事项进度 / 子任务进度）与重构前一致。