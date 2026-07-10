# 子任务功能 Spec

## Why
当前任务模型已存在 `parentTaskId` 字段（VO、实体、后端模型均已支持），但前端任务详情面板没有任何子任务的展示与管理能力。用户无法在详情面板中查看某个任务的子任务、无法进入子任务详情、也无法把一个任务挂到另一个任务下作为子任务。本次改动补齐这一整套「父/子任务」的详情面板交互闭环。

## What Changes
- 在任务详情面板主体（`main`）中，标签栏下方新增「子任务」列表区域，带顶部分割线，视觉与交互对齐现有「评论」区域（`comments.vue`）。
- 点击子任务列表项调用现有的详情切换方法，展示该子任务详情。
- 任务详情面板打开（或切换任务）时按 `parentTaskId` 加载子任务数据；新增 composable，复用 `useTasksLoader` Hook；在 `TaskDetailsStore` 中新增一份 `TasksStoreBase` 存储子任务数据（与主任务列表 store 隔离）。
- 底部 `Footer` 的「更多操作」下拉列表中新增「移动至子任务...」选项，点击后打开新增的 `ParentTaskSelector` 对话框选择父任务；确认后把当前任务的 `parentTaskId` 更新为所选任务。
- 头部 `Header` 中，若当前任务存在 `parentTaskId`，在 `task-check-button` 左侧显示「返回父任务」按钮，点击后切换详情到父任务。
- 数据层：为 `GetTasksOptions` 增加可选 `parentTaskId` 过滤字段（类型层面），使子任务查询可通过查询串传递给后端。

## Impact
- Affected specs: 任务详情面板（task-details）展示与交互、任务查询选项。
- Affected code:
  - `packages/usecases/task/viewobjects.ts`（`GetTasksOptions` 增加 `parentTaskId`）
  - `apps/web/src/stores/tasks/task-details-store.ts`（新增子任务 `TasksStoreBase` 与其 loading/error）
  - `apps/web/src/layouts/app/task-details/`：`task-details.ts`、`context.ts`、新增 `use-subtasks.ts`、`main/subtasks.vue`、`main/index.vue`、`header/index.vue`、`footer/index.vue`
  - `apps/web/src/layouts/app/dialogs/`：新增 `parent-task-selector/`、`dialog-adapter.vue`、`index.ts`
  - `apps/web/src/infrastructure/constants/dialog-keys.ts`（新增对话框 key）
  - `packages/infrastructure/locales/`：`zh-CN.ts`、`en-US.ts`、`types.ts`（新增文案）

## 设计基调（frontend-design）
本功能嵌入既有产品，遵循「克制、精炼、与现有面板一致」的方向，而非引入新的视觉主题：
- 子任务区域完全复用 `comments.vue` 的容器规范：顶部 `1px` 分割线（`--nue-divider-color`）、`0.5rem` 内边距、标题 + 数量计数、垂直堆叠列表。
- 列表项使用轻量行样式：任务名（超出省略）+ 完成态视觉（勾选/删除线弱化）+ hover 高亮，点击整行进入详情；空态跟随「评论」逻辑——无子任务时不渲染该区域。
- 头部「返回父任务」按钮采用小尺寸 icon 按钮（`icon="arrow-left"` 或既有回退图标），与 `task-check-button` 同行左侧，间距 `--nue-gap`，不破坏原有布局。
- `ParentTaskSelector` 对话框沿用 `nue-dialog` + `useDialogWrapper` 规范（参考 `task-creator`）：顶部搜索输入 + 可点击任务列表 + 底部取消/确认按钮，宽度 `24rem` 级别，保持与其他对话框一致的观感。

## ADDED Requirements

### Requirement: 子任务列表展示
任务详情面板 SHALL 在主体标签栏下方展示当前任务的子任务列表区域，并带顶部分割线，样式与交互对齐评论区域。

#### Scenario: 存在子任务
- **WHEN** 当前任务存在一个或多个子任务
- **THEN** 在标签栏下方渲染「子任务」区域，显示子任务数量与列表项

#### Scenario: 无子任务
- **WHEN** 当前任务没有子任务且非加载/错误状态
- **THEN** 不渲染子任务区域（与评论区域一致的隐藏逻辑）

#### Scenario: 点击子任务项
- **WHEN** 用户点击某个子任务列表项
- **THEN** 调用详情切换方法（`switchTaskDetails`），面板切换为该子任务的详情

### Requirement: 子任务数据加载
任务详情面板打开或切换任务时 SHALL 加载该任务的子任务数据；加载复用 `useTasksLoader`，数据存储于 `TaskDetailsStore` 中独立的子任务 `TasksStoreBase`。

#### Scenario: 打开/切换任务
- **WHEN** `taskId` 变化（含首次打开）
- **THEN** 以 `{ parentTaskId: 当前taskId }` 为查询条件加载子任务，并写入 TaskDetailsStore 的子任务 store

#### Scenario: 加载中与错误
- **WHEN** 子任务正在加载或加载失败
- **THEN** 子任务区域分别展示加载占位与错误重试（对齐评论区域交互）

### Requirement: 移动至子任务（选择父任务）
底部「更多操作」下拉 SHALL 增加「移动至子任务...」选项，点击打开 `ParentTaskSelector` 对话框；选择并确认后，将当前任务的 `parentTaskId` 设为所选任务。

#### Scenario: 打开选择器
- **WHEN** 用户在更多操作中点击「移动至子任务...」
- **THEN** 打开 `ParentTaskSelector` 对话框，展示可选父任务列表（排除当前任务自身）

#### Scenario: 确认选择
- **WHEN** 用户在对话框中选择一个任务并确认
- **THEN** 调用 `taskHandler.update(当前taskId, { parentTaskId: 所选taskId })`，关闭对话框

### Requirement: 返回父任务按钮
若当前详情任务存在 `parentTaskId`，头部 SHALL 在 `task-check-button` 左侧显示返回按钮，点击切换到父任务详情。

#### Scenario: 存在父任务
- **WHEN** 当前任务 `parentTaskId` 非空
- **THEN** 在头部 `task-check-button` 左侧显示返回按钮

#### Scenario: 点击返回
- **WHEN** 用户点击返回按钮
- **THEN** 调用 `switchTaskDetails(parentTaskId)` 切换到父任务详情

#### Scenario: 无父任务
- **WHEN** 当前任务 `parentTaskId` 为空
- **THEN** 不显示返回按钮，头部布局与现状一致

## MODIFIED Requirements

### Requirement: 任务查询选项
`GetTasksOptions` SHALL 增加可选字段 `parentTaskId`，用于按父任务过滤任务列表；该字段通过既有查询串序列化机制透传给后端。

#### Scenario: 按父任务过滤
- **WHEN** 传入 `{ parentTaskId }` 调用任务列表用例
- **THEN** 查询串包含 `parentTaskId`，返回该父任务下的子任务

## 假设与风险
- **假设**：后端 `GET /task` 已支持按 `parentTaskId` 过滤（`QueryOptionsValueObject` 会将任意键透传为查询参数）。若后端暂不支持，子任务列表将返回空或全量，需要后端配合；本 spec 仅覆盖前端与共享类型层，不改动服务端。
- **假设**：`ParentTaskSelector` 的可选任务来源为通过 `TaskUseCase.list` 拉取的常规任务（排除当前任务自身）；不在本次范围内做「循环父子关系」的深度校验（仅做「不能选自己」的基础限制）。
