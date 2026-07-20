# 合并 Preset/Task 选择器为单个「专注依赖」Dropdown 实施方案

## Summary

将 `PomodoroPresetSelectDropdown`（常用专注）与 `PomodoroTaskSelectDropdown`（任务专注）合并为**一个** Dropdown 组件 `PomodoroFocusDependDropdown`。下拉面板顶部提供 Tabs（「常用专注」/「任务专注」）切换要选择的「专注依赖」类型。两者**相互独立、可共存**：分别写入 `currentPomodoroId` 与 `currentTaskId`，记录创建时各自独立传递。触发处文本显示当前已选依赖：任务名与常用专注名同时存在时用短横线 `-` 连接。

## Current State Analysis

- 两个现存组件同构（均基于 `NueDropdown` + `#trigger="{ trigger }"` 插槽 + `ref.close()`）：
  - [task-select-dropdown.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/task-select-dropdown/task-select-dropdown.vue)（内部用 `list-view-adapter` 展示任务列表 + 搜索框）+ [use-task-select-dropdown.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/task-select-dropdown/use-task-select-dropdown.ts) + [types.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/task-select-dropdown/types.ts)
  - [preset-select-dropdown.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/preset-select-dropdown/preset-select-dropdown.vue)（列表 + 空态 + 「不关联」项）+ [use-preset-select-dropdown.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/preset-select-dropdown/use-preset-select-dropdown.ts) + [types.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/preset-select-dropdown/types.ts)
- 两个 hook 均无副作用绑定到组件模板，可原样复用：`useTaskSelectDropdown()` 返回 `tags/viewPreference/taskUseCase/subscriber/getProjectName/showTaskDetails/getNoTaskError/refreshData`；`usePresetSelectDropdown(props)` 返回 `loading/presets/refresh`。
- **nue-ui 无 Tabs 组件**（`dist/types/components/index.d.ts` 仅含 button/button-group/link/switch/select/divider 等）。项目内 Tabs 观感由 [header.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/header/header.vue#L28-L32) 用 `nue-link` + `nue-div[theme="tabs"]` 自建。→ 合并组件的 Tabs 用同样方式（本地 `activeTab` ref + 两个可点击项 + 下边框高亮）自建，风格与页面统一。
- 父组件 [index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue)：
  - preset 选择器目前被注释（L54-L64）；task 选择器在 timer/focus 两个 `#BelowTimeString` 插槽内各出现一次（L83-L93、L118-L128）。
  - 页面逻辑 [use-pomodoro-page.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/use-pomodoro-page.ts) 已提供 `taskName/taskId/handleSelectTask` 与 `presetName/presetId/handleSelectPreset`（选中 preset 时 timer 空闲态套用时长），无需改动逻辑本体。
- `pomodoroUseCase`、`taskUseCase` 均由 `POMODORO_VIEW_CONTEXT_KEY` 提供，合并组件内两个 hook 各自 inject 即可。

## Proposed Changes

### 1. 新增合并组件目录 `apps/web/src/layouts/pomodoro/focus-depend-dropdown/`

结构参照现有两个 dropdown 目录。

- **`types.ts`**：
  ```ts
  import type { PomodoroType, PomodoroViewObject } from '@nao-todo/usecases/pomodoro'
  import type { TaskViewObject } from '@nao-todo/usecases/task'

  export type PomodoroFocusDependDropdownProps = { type: PomodoroType }
  export type PomodoroFocusDependDropdownEmits = {
      (e: 'selectPreset', preset: PomodoroViewObject | null): void
      (e: 'selectTask', task: TaskViewObject): void
  }
  export type FocusDependTab = 'preset' | 'task'
  ```

- **`focus-depend-dropdown.vue`**（组件名 `PomodoroFocusDependDropdown`）：
  - 复用两个 hook：`const { loading, presets, refresh } = usePresetSelectDropdown(props)`；`const { tags, viewPreference, taskUseCase, subscriber, getProjectName, showTaskDetails, getNoTaskError, refreshData } = useTaskSelectDropdown()`。
  - 本地 `activeTab = ref<FocusDependTab>('preset')`。
  - 单个 `NueDropdown`（`ref` + `close()`），`#trigger` 插槽向父层暴露 `{ open }`（与现有一致）。
  - 面板结构：
    - `nue-header`：标题「选择专注依赖」+ 描述。
    - **Tabs 区**：`nue-div[theme="depend-tabs"]` 内两个可点击项（`nue-link` 或 `nue-text`，`@click` 切 `activeTab`，选中态加下边框高亮，复刻 header tabs 样式），文案「常用专注」「任务专注」。
    - **内容区**（`v-if="activeTab==='preset'"` / `v-else`）：
      - preset：整体搬运现有 preset 列表（「不关联」项 + `v-for` presets + 空态），点击 `emit('selectPreset', preset)` 后 `close()`。
      - task：整体搬运现有 task 面板（搜索框 + `list-view-adapter` + `#actions` 查看按钮），`task-clicked` → `emit('selectTask', task)` 后 `close()`。
  - `@after-open`：调用 `refresh()`（preset 数据）并聚焦任务搜索框（沿用 `nextTick` 聚焦逻辑，仅当 task tab 激活时）。
  - 样式：合并两个组件已有的 `<style>`（`.nue-dropdown--pomodoro-preset-selector` 与 `#pomodoro-task-selector` 的规则）到新的选择器命名（如 `pomodoro-focus-depend-selector`），并新增 Tabs 区样式（复刻 header 的下边框高亮 + hover）。面板宽度取两者较大值（任务面板需 24rem 宽、40rem 高）。遵循 frontend-design：沿用 `var(--nue-*)` 变量、克制精致、与番茄页视觉统一，不引入新字体/新配色。

- **`index.ts`**：
  ```ts
  import FocusDependDropdown from './focus-depend-dropdown.vue'
  export const PomodoroFocusDependDropdown = FocusDependDropdown
  export type { PomodoroFocusDependDropdownProps, PomodoroFocusDependDropdownEmits, FocusDependTab } from './types'
  ```

> 说明：`useTaskSelectDropdown` / `usePresetSelectDropdown` / 各自 `types.ts` 保持原地不动，被新组件 import 复用（避免复制逻辑）。

### 2. 父组件 [index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) 接入

- import 改为：`import { PomodoroFocusDependDropdown } from './focus-depend-dropdown'`，移除 `PomodoroTaskSelectDropdown` 及被注释的 preset 引用。
- 新增 computed 触发文案 `dependLabel`（在 `<script setup>` 内，或直接模板拼接）：
  ```
  taskName 与 presetName 都有 → `${presetName} - ${taskName}`
  仅其一 → 该名称
  都无 → '选择专注依赖'
  ```
  （拼接顺序：常用专注在前、任务在后；用 ` - ` 连接。）
- timer 与 focus 两个 `#BelowTimeString` 插槽内，将原 `pomodoro-task-select-dropdown` 替换为单个：
  ```vue
  <pomodoro-focus-depend-dropdown
      :type="activeTab === 'timer' ? 1 : 2"
      @select-preset="handleSelectPreset"
      @select-task="handleSelectTask"
  >
      <template #default="{ open }">
          <nue-text theme="task-select-trigger" @click="open" title="专注依赖">
              {{ dependLabel }}
          </nue-text>
      </template>
  </pomodoro-focus-depend-dropdown>
  ```
  「查看任务详情」的 `eye` 按钮保留（`v-if="taskId"`）。
- 移除 L54-L64 被注释的 preset 选择器块。

### 3. 删除旧组件目录

合并完成、父组件不再引用后，删除：
- `apps/web/src/layouts/pomodoro/task-select-dropdown/`（整目录）
- `apps/web/src/layouts/pomodoro/preset-select-dropdown/`（整目录）

并同步修改 [layouts/pomodoro/index.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.ts#L4)：把 `export * from './task-select-dropdown'` 改为 `export * from './focus-depend-dropdown'`。

> 注意：两个 hook（`useTaskSelectDropdown`/`usePresetSelectDropdown`）随目录删除，其逻辑迁入新组件目录（作为新组件的 `use-*.ts` 或直接内联）。为减少改动，方案采用：**将两个 hook 文件一并移动到新目录**（`use-task-panel.ts`、`use-preset-panel.ts`），新组件从本目录 import；旧目录整体删除。

## Assumptions & Decisions

1. **独立共存**（依用户确认）：不互斥。`handleSelectPreset` / `handleSelectTask` 逻辑不变，分别写各自 store 字段；`buildRecord` 已分别带 `pomodoroId` 与 `taskId`，无需改动。
2. **触发文案**（依用户补充）：两者都选时 `常用专注名 - 任务名`；数据仍分开记录。
3. **默认 Tab**：`preset`（常用专注）先行；可点击切到 task。
4. **type 传参**：沿用现有语义（timer→1、focus→2）仅用于 preset 过滤；任务面板不受 type 影响。
5. **不新增第三方 Tabs 依赖**：nue-ui 无 Tabs，自建（复刻 header tabs 样式）。
6. 不改动 `use-pomodoro-page.ts` 的选择处理逻辑与 store。

## Verification

1. `npx vue-tsc --noEmit -p apps/web/tsconfig.json` 类型检查通过。
2. 手动验证（`/pomodoro/timer` 与 `/pomodoro/focus`）：
   - 计时器下方出现单个「专注依赖」触发文本，点击弹出，顶部有「常用专注 / 任务专注」两个 Tab，可切换面板。
   - 常用专注面板：timer 只列 type=1、focus 只列 type=2，含「不关联」与空态；选中后关闭并更新文案。
   - 任务专注面板：搜索 + 列表 + 查看详情按钮，选中后关闭并更新文案。
   - 同时选中任务与常用专注时，触发文本显示 `常用专注名 - 任务名`。
   - 完成/跳过（timer）或结束（focus）一次专注后，记录请求体同时含正确的 `pomodoroId` 与 `taskId`（各自独立）。
3. 全局搜索确认无残留对 `PomodoroTaskSelectDropdown` / `PomodoroPresetSelectDropdown` / 旧目录的引用。
