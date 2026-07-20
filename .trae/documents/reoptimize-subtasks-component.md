# 重新优化 SubTasks 组件

## Summary
对任务详情面板的子任务列表 [subtasks.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/subtasks.vue) 做一次「视觉/质感提升 + 结构对齐 EventRow」的重构。保持极简信息密度（勾选框 + 名称 + 悬浮查看按钮），不新增元数据、不改动数据流与 context。严格沿用项目现有代码风格（NueUI 组件 + `--nue-*` 设计令牌 + `theme` prop 约定）。

**改动范围：仅单文件 `apps/web/src/layouts/app/task-details/main/subtasks.vue`。** 不改 context、store、i18n。

## Current State Analysis
- 当前 [subtasks.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/task-details/main/subtasks.vue) 结构：`nue-container > nue-main > nue-content`，内部 `v-for` 渲染 `nue-div.subtask-row`（勾选 `nue-icon` + 名称 `nue-text` + 悬浮 `nue-button` 查看），并含 loading / error 分支。功能完整。
- 现有样式与共享组件 [EventRow](file:///home/nathan/Projects/nao-todo/packages/components/event-row/row.vue) / [row.css](file:///home/nathan/Projects/nao-todo/packages/components/event-row/row.css) 存在若干不一致：
  - 尺寸/间距用了字面量（`min-height: var(--nue-box-size-sm)`、`padding: 0.375rem 0.5rem`、`gap: 0.5rem`、`font-size: 1.05em`），而 EventRow 统一用令牌（`height: var(--nue-box-size-sm)`、`gap: var(--nue-gap-xs)`、图标 `var(--nue-text-md)`）。
  - hover 背景用 `--nue-primary-color-20` + `border-radius`，EventRow 用 `--nue-primary-color-100` 且做「整行满溢」(`width: calc(100% + 2rem)` + 负 margin，无圆角)。
  - 勾选图标自定义 `cursor: pointer`，EventRow 用 `theme="pointer"`（`.nue-icon--pointer`）约定。
  - 完成态名称色 `--nue-primary-color-400`，EventRow 用 `--nue-primary-color-600 + line-through`。
- 参考对象 EventRow 的交互范式：图标用 `square` / `square-check-fill`，加载时 `loading` + `spin`；右侧操作区 `nue-div theme="actions"` 默认 `display:none`，`:hover / :focus-within` 时显示。

## Proposed Changes

### 文件：`apps/web/src/layouts/app/task-details/main/subtasks.vue`

**Script（基本不动，保持现有逻辑与风格）**
- 保留 `inject(TASK_DETAILS_CONTEXT_KEY)`、`updatingIds`、`toggleState`、`switchTaskDetails` 全部逻辑与注释风格（中文行注释，与项目一致）。
- 无新增依赖、无新增 props/emit。

**Template（对齐 EventRow 的行结构与语义）**
- 保留外层 `nue-container#TodoDetailsSubTasksContainer > nue-main > nue-content` 与 loading / error 分支（结构性容器与功能状态，保持不变）。
- 行元素 `nue-div.subtask-row` 调整为对齐 EventRow 的写法：
  - 勾选 `nue-icon`：`theme="pointer"`（替换自定义 cursor），`:name` 逻辑不变（`loading` / `square-check-fill` / `square`），`:spin` 不变，`@click="toggleState(subTask)"` 不变。
  - 名称 `nue-text :clamped="1"` 不变。
  - 悬浮查看按钮改为 EventRow 的「操作区」范式：用一个 `nue-div class="subtask-row__actions"` 包裹查看按钮（`nue-button icon="right-arrow" theme="small,pure" :title="t('task.details.view')" @click="switchTaskDetails(subTask.id)"`），由 CSS 控制 hover 显隐，语义与 EventRow `theme="actions"` 一致。

**Style（核心重构——令牌化 + 对齐 EventRow 质感）**
- `.subtask-row`：
  - `height: var(--nue-box-size-sm)`（替代 `min-height` 字面量）；`gap: var(--nue-gap-xs)`；`align-items: center`；`color: var(--nue-primary-color-900)`。
  - 采用 EventRow 的「整行满溢」hover：`width: calc(100% + 1rem)`、`margin: 0 -0.5rem`、`padding: 0 0.5rem`（与容器 `0.5rem` 内边距抵消，使 hover 背景延伸到分区边缘；EventRow 用 `1rem/padding-df`，此处按本容器 `0.5rem` 匹配），去掉 `border-radius`。
  - 初始 `background-color: transparent`；`transition: background-color var(--nue-animation-duration, 0.15s) ease`。
  - `&:hover, &:focus-within { background-color: var(--nue-primary-color-100); }`（对齐 EventRow）。
- `.subtask-row__icon`（勾选图标）：`font-size: var(--nue-text-md)`（对齐 EventRow）；`flex: none`；完成态 `&[data-done='true'] .subtask-row__icon` 保留一处强调色，改用语义化 `var(--nue-primary-color-600)` 使明暗模式一致（去掉 `--nue-success-color-80` 回退写法，收敛为项目主色体系）。
- `.subtask-row__name`：`flex: 1`；`font-size: var(--nue-text-sm)`；`color: inherit`。完成态：`text-decoration: line-through; color: var(--nue-primary-color-600)`（对齐 EventRow 完成态）。
- `.subtask-row__actions`：`display: flex; align-items: center; flex-shrink: 0; opacity: 0; transition: opacity var(--nue-animation-duration, 0.15s) ease;`，`.subtask-row:hover &, .subtask-row:focus-within & { opacity: 1; }`（对齐 EventRow 操作区显隐范式）。
- 保留 `#TodoDetailsSubTasksContainer` 及 `> .nue-main / > .nue-content` 现有规则（分区分割线、间距），仅将行相关样式令牌化。

## Assumptions & Decisions
- **保持极简**（用户确认）：不加优先级/日期/进度等元数据，不加「添加子任务」输入。仅做视觉与结构层面的优化。
- **对齐 EventRow**（用户确认）：采用 EventRow 的令牌、hover 满溢背景（无圆角）、`theme="pointer"`、操作区显隐范式、完成态配色，使子任务行与检查事项行在全局观感一致。
- **完成态强调色收敛为主色 `--nue-primary-color-600`**：替换原 `--nue-success-color-80` 回退式写法，统一到项目主色体系，保证明暗模式表现一致（符合「严格遵循项目风格」与设计令牌规范）。
- **不改动逻辑/数据流**：`toggleState`、`updatingIds`、`switchTaskDetails`、loading/error 分支全部保留。
- 不删除任何 i18n key。

## Verification
1. `GetDiagnostics` 对 `subtasks.vue` 无报错。
2. `npx vite build --config vite.config.ts`（cwd: `apps/web`）构建通过。
3. 人工核对：
   - 行高、间距、图标尺寸与检查事项行(EventRow)观感一致；
   - 初始无背景，鼠标移入整行显示背景（延伸到分区边缘、无圆角）；
   - 勾选框为方形，点击在 `todo`/`done` 间切换，更新中显示旋转 loading，完成态名称删除线 + 主色；
   - 查看按钮默认隐藏，悬浮该行时显示，点击进入该子任务详情；
   - 明暗模式下颜色均正常（全部走 `--nue-*` 令牌）。
