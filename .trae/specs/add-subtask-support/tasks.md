# Tasks

- [x] Task 1: 数据类型与 Store 支撑：为查询选项与 TaskDetailsStore 增加子任务能力
    - [x] SubTask 1.1: 在 `packages/usecases/task/viewobjects.ts` 的 `GetTasksOptions` 增加可选字段 `parentTaskId?: TaskViewObject['parentTaskId']`（已存在）
    - [x] SubTask 1.2: 在 `apps/web/src/stores/tasks/task-details-store.ts` 中通过 `useTasksStoreBase()` 新增独立子任务 store（`subTasks`、`setSubTasks`、`addSubTasks`、`getSubTask` 等），并新增 `subTasksLoading/subTasksError` 及其 setter，追加到 return

- [x] Task 2: 子任务加载 composable：新增 `use-subtasks.ts` 复用 `useTasksLoader`
    - [x] SubTask 2.1: 新增 `apps/web/src/layouts/app/task-details/use-subtasks.ts`，用独立 TaskStore 适配子任务 store，`useTasksLoader` 以 `{ parentTaskId }` 加载并写入子任务 store
    - [x] SubTask 2.2: 暴露 `subTasks`（computed）、`subTasksLoading`、`subTasksError`、`loadSubTasks(taskId)`、`retrySubTasks()`

- [x] Task 3: 详情上下文接入子任务：修改 `task-details.ts` 与 `context.ts`
    - [x] SubTask 3.1: 在 `task-details.ts` 中调用 `use-subtasks`，`initialize` 中随检查事项/评论一起 `Promise.all` 加载子任务
    - [x] SubTask 3.2: 在 `context.ts` 的 `TaskDetailsContext` 增加 `subTasks`、`subTasksLoading`、`subTasksError`、`retrySubTasks` 并 provide

- [x] Task 4: 子任务列表 UI：新增 `main/subtasks.vue` 并挂载到 `main/index.vue`
    - [x] SubTask 4.1: 新增 `main/subtasks.vue`，容器规范对齐 `comments.vue`，列表项点击 `switchTaskDetails(subtask.id)`
    - [x] SubTask 4.2: 在 `main/index.vue` 标签栏下方、评论区域上方引入 `<details-main-sub-tasks />`

- [x] Task 5: 头部返回父任务按钮：修改 `header/index.vue`
    - [x] SubTask 5.1: 存在 `vo.parentTaskId` 时在 `task-check-button` 左侧渲染返回按钮，点击 `switchTaskDetails(vo.parentTaskId)`

- [x] Task 6: 移动至子任务 + ParentTaskSelector 对话框
    - [x] SubTask 6.1: `dialog-keys.ts` 新增 `PARENT_TASK_SELECTOR_DIALOG_KEY`
    - [x] SubTask 6.2: 新增 `dialogs/parent-task-selector/`（vue + use + index），搜索输入 + 任务列表（排除自身）+ 取消/确认，通过 payload.onSelect 回传
    - [x] SubTask 6.3: 在 `dialog-adapter.vue` 注册引入新对话框
    - [x] SubTask 6.4: 在 `footer/index.vue` 更多操作中新增「移动至子任务...」，选中后 `taskHandler.update(vo.id, { parentTaskId })`

- [x] Task 7: 国际化文案
    - [x] SubTask 7.1: 在 `zh-CN.ts`、`en-US.ts`、`types.ts` 增加子任务/移动至子任务/返回父任务/对话框文案

- [x] Task 8: 验证
    - [x] SubTask 8.1: `vite build` 通过；新增/修改文件无新增类型错误（IDE 诊断为空）

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 3
- Task 6 依赖 Task 1（parentTaskId 更新）与对话框基础设施，可与 Task 4/5 并行
- Task 7 可与 Task 4/5/6 并行
- Task 8 依赖所有实现任务完成