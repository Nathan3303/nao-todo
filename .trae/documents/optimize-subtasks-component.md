# 优化 SubTasks 组件

## Summary
优化任务详情面板中的子任务列表组件 [subtasks.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/subtasks.vue)，使其：
1. 子任务项有明确高度与内间距，鼠标移入才显示背景色（初始无背景）。
2. 名称前的勾选按钮改为方形（参考 EventRow 的 `square` / `square-check-fill`），点击切换任务 `state`（`todo` ⇄ `done`）。
3. 移除「子任务 N」标题行，直接渲染列表。
4. 在子任务项末尾新增「查看详情」图标按钮（`icon="right-arrow"`），仅鼠标悬浮该项时显示，点击进入该子任务详情（整行不再点击进入）。

本次仅改动单个文件 `subtasks.vue`，无需改动 context、store 或 i18n。

## Current State Analysis
- [subtasks.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/subtasks.vue) 当前结构：`nue-container` 内含 `nue-header`（标题 + 计数）与 `nue-main > nue-content`（loading / error / 列表）。
- 列表项当前用圆形图标 `circle` / `check-circle-fill`，且已有 hover 背景（`.subtask-row:hover`），但 hover 背景已存在——需保持“初始无背景、hover 才有背景”，当前实现已符合，仅需确保结构调整后仍保留。
- 整行 `@click="switchTaskDetails(subTask.id)"` 进入详情，右侧有一个 hover 才显示的 `arrow-right`。
- 勾选按钮当前无点击事件。
- 参考实现 [event-row/row.vue](file:///home/nathan/Projects/nao-todo/packages/components/event-row/row.vue)：使用 `event.isDone ? 'square-check-fill' : 'square'`，加载中显示 `loading` 且 `spin`，点击调用更新。
- 上下文 [context.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/../context.ts) 提供 `taskHandler`（含 `updateTaskState(id, state)`）、`subTasks`、`subTasksLoading`、`subTasksError`、`retrySubTasks`、`switchTaskDetails`，均可直接注入使用。

## Proposed Changes

### 文件：`apps/web/src/layouts/app/task-details/main/subtasks.vue`

**Script 部分**
- 注入新增 `taskHandler`（其余保持：`subTasks`、`subTasksLoading`、`subTasksError`、`retrySubTasks`、`switchTaskDetails`）。
- 新增 `updatingIds`（`reactive(new Set<string>())` 或 `ref<Set>`）用于记录正在更新状态的子任务 id，实现类似 EventRow 的 `loading` 旋转图标（提升质感，非硬性需求但对齐参考组件）。
- 新增方法 `toggleState(subTask)`：
  - 若该 id 正在更新则忽略；
  - 加入 `updatingIds`，调用 `taskHandler.updateTaskState(subTask.id, subTask.state === 'done' ? 'todo' : 'done')`，`finally` 移除 id。

**Template 部分**
- 删除 `<nue-header>`（标题 `task.details.subTasks` + 计数）整块。
- 保留外层 `nue-container`（其顶部分割线 `border-top` 是详情面板各分区一致的视觉规范，予以保留）与 `nue-main > nue-content`，其中继续保留 loading / error 状态块（属于列表功能状态，不属于“标题信息”）。
- 列表项勾选图标由圆形改为方形，点击切换 `state`：
  - `:name` = 该项更新中 `'loading'`，否则 `subTask.state === 'done' ? 'square-check-fill' : 'square'`；
  - `:spin` = 是否更新中；
  - `@click="toggleState(subTask)"`。
- **移除整行的 `@click="switchTaskDetails(...)"`**：整行不再点击进入详情。改为在列表项末尾放置一个「查看详情」图标按钮：
  - 使用 `nue-button` 图标按钮（`theme="small,pure"`，参考 header 返回按钮的用法），`icon="right-arrow"`；
  - `@click="switchTaskDetails(subTask.id)"` 进入该子任务详情；
  - 默认隐藏（`opacity: 0`），仅当鼠标悬浮在该列表项（`.subtask-row:hover`）时显示（`opacity: 1`）；
  - 加 `:title="t('task.details.view')"` 提示（该 i18n key 已存在）。
- 说明：因勾选图标与查看按钮各自有独立点击处理、整行不再有 click，无需 `.stop` 修饰符。

**Style 部分**
- `.subtask-row`：设置明确高度（如 `min-height: var(--nue-box-size-sm)`）与内间距（保留/微调 `padding`，如 `padding: 0.375rem 0.5rem`），`background-color: transparent`（初始无背景），`transition` 保留；`:hover` 时 `background-color: var(--nue-primary-color-20)`（hover 才有背景）。整行不再是可点击区域，故移除 `cursor: pointer`。
- `.subtask-row__icon`（勾选图标）：`cursor: pointer`、`flex: none`，`data-done` 时用完成态颜色；加载 `spin` 由 `nue-icon` 自身处理。
- `.subtask-row__name`：`flex: 1` 占据剩余空间，完成态删除线样式保留。
- 查看详情按钮：`flex: none`，`opacity: 0` + `transition: opacity 0.15s ease`；`.subtask-row:hover` 时 `opacity: 1`。
- 因移除 header，可删除 `> .nue-header {...}` 相关样式。

## Assumptions & Decisions
- **保留顶部分割线**：`nue-container` 的 `border-top` 与评论区等分区保持一致，属于面板结构而非“标题信息”，予以保留。用户若希望连分割线一起去掉，可在确认阶段指出。
- **保留 loading / error 状态**：这些是列表数据的功能性反馈，不属于被要求撤销的「标题行」，保留以保证健壮性。
- **勾选加载态旋转图标**：对齐参考组件 EventRow 的交互质感，采用 `updatingIds` 记录逐项加载态。
- **状态仅在 todo/done 间切换**：按需求，`done` → `todo`，非 `done`（含 `todo`、`in-progress`）→ `done`。
- `t('task.details.subTasks')` 文案在移除标题后于本组件不再使用，但保留 i18n key（其它处或未来可能使用，避免不必要的删除）。

## Verification
1. 运行 `npx vite build --config vite.config.ts`（cwd: `apps/web`）构建通过。
2. IDE 诊断（GetDiagnostics）对该文件无报错。
3. 人工核对：
   - 子任务列表无「子任务 N」标题，直接显示列表项；
   - 列表项初始无背景色，鼠标移入显示背景色，且有明显高度与内间距；
   - 勾选按钮为方形，点击后 `state` 在 `todo`/`done` 间切换（方块↔勾选方块、名称删除线切换）；
   - 列表项末尾的「查看详情」按钮默认隐藏，鼠标悬浮该项时才显示，点击进入该子任务详情；整行其它区域点击不再跳转。
