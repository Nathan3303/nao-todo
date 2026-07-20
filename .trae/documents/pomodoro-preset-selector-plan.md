# 计时器「常用专注」选择器 实施方案

## Summary

为番茄专注计时页新增一个「常用专注」选择组件：默认显示为一段文本（当前所选常用专注名称或占位提示），鼠标悬浮显示下划线（类链接样式），点击弹出 `NueDropdown` 列出可选的常用专注；选择后文本更新为该常用专注名称，并将其 `id` 写入 `PomodoroStore` 的 `currentPomodoroId`，套用其预设时长（`duration`），最终在专注结束创建 `PomodoroRecord` 时把 `pomodoroId` 一并传递给后端。

选择器同时应用于**番茄专注（timer）与**正计时（focus）**两个模式；下拉列表**按当前模式过滤（timer 只列 `type=1`，focus 只列 `type=2`）。

## Current State Analysis

* 计时页父组件 [index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) 在 `#BelowTimeString` 插槽中已内嵌 [task-select-dropdown](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/task-select-dropdown/task-select-dropdown.vue)（关联任务下拉），是本次「常用专注选择器」的天然参照与落点。

* 页面逻辑集中在 [use-pomodoro-page.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/use-pomodoro-page.ts)，其中 `handleSelectTask` 通过 `pomodoroStore.selectTask` 更新关联任务；`timerStore/focusStore` 均在此创建。

* 共享会话/记录状态在 [pomodoro-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-store.ts)：已有 `currentTaskId/currentTaskName`、`focusDuration`、`selectTask`、`setCurrentSession`、`addRecord` 等；**尚无** `currentPomodoroId`。

* 两个计时 store 的 `buildRecord`（[pomodoro-timer-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts#L104-L114) 与 [pomodoro-focus-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts#L62-L72)）当前构造的 `CreatePomodoroRecordViewObject` **缺少** **`pomodoroId`** **字段**——而类型 [viewobjects.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts#L54-L65) 中该字段是必填。此次一并补齐。

* 常用专注列表数据由 `pomodoroUseCase.loadPomodoros()`（[pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro.ts#L53-L74)）拉取并写入 [pomodoros-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoros-store.ts)（`getAllPomodoros` / `pomodoros`）。`pomodoroUseCase` 已由 [pomodoro-view.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/pomodoro-view.ts#L77-L89) 通过 `POMODORO_VIEW_CONTEXT_KEY` 提供，计时页可直接 `inject`。

* `NueDropdown` 用法（见 task-select-dropdown）：`#trigger="{ trigger }"` 插槽触发展开、默认插槽为面板内容、`ref.close()` 命令式关闭、`close-when-executed`/`@execute` 可选。

## Proposed Changes

### 1. `PomodoroStore` 新增常用专注选择状态

文件：[pomodoro-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-store.ts)

* 新增 state：

  * `currentPomodoroId = ref<string | null>(null)`

  * `currentPomodoroName = ref('')`

* 新增 action：

  * `selectPomodoro(id: string | null, name: string)`：更新上述两个 state。

  * `clearPomodoroSelection()`：置空（供「不关联」选项使用）。

* 在 `return {}` 中导出以上 state 与 action。

* **不改动** `setCurrentSession` / `clearCurrentSession`（保持任务与常用专注的选择在会话间持续，与现有 task 行为一致）。

### 2. 两处 `buildRecord` 补齐 `pomodoroId`

文件：[pomodoro-timer-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-timer-store.ts#L104-L114)、[pomodoro-focus-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-focus-store.ts#L62-L72)

* 在两处返回的对象里新增：`pomodoroId: pomodoroStore.currentPomodoroId`。

* 这同时修复现有类型缺字段问题（`CreatePomodoroRecordViewObject.pomodoroId` 必填）。

### 3. 新增「常用专注」选择下拉组件

新建目录：`apps/web/src/layouts/pomodoro/preset-select-dropdown/`（结构参照 `task-select-dropdown/`）

* `types.ts`：

  * `PomodoroPresetSelectDropdownProps = { type: PomodoroType }`（用于按模式过滤）

  * `PomodoroPresetSelectDropdownEmits = { (e: 'selectPreset', preset: PomodoroViewObject | null): void }`（`null` 表示「不关联」）

* `use-preset-select-dropdown.ts`：

  * `inject(POMODORO_VIEW_CONTEXT_KEY)` 取 `pomodoroUseCase`。

  * `usePomodorosStore()` 取列表。

  * `onMounted` 调 `pomodoroUseCase.loadPomodoros()`（不传 type，一次性加载全部；过滤放到 computed，避免与「常用专注」集合页共享 store 时相互覆盖）。

  * 暴露 `presets = computed(() => store.getAllPomodoros().filter(p => p.type === props.type && !p.isArchived))`、`loading`、`refresh()`。

* `preset-select-dropdown.vue`：

  * `NueDropdown` + `#trigger="{ trigger }"`，默认插槽向父层暴露 `{ open }`（与 task-select 一致，让父组件自定义触发文本）。

  * 面板内容：标题「选择常用专注」+ 列表；每项显示名称与预设时长（分钟）；含一个「不关联」项。点击某项 `emit('selectPreset', preset)` 并 `dropdownRef.close()`。

  * 空列表时显示「暂无常用专注」提示。

  * 遵循 frontend-design：沿用项目 `nue-*` 组件与主题变量（`var(--nue-*)`），列表项 hover 高亮、选中项高亮，克制精致的下拉面板样式（`scoped`），不引入新字体/新配色体系，保持与现有番茄页一致的视觉语言。

* `index.ts`：`export const PomodoroPresetSelectDropdown = ...`，并 `export type` 相关类型。

### 4. 页面逻辑接入

文件：[use-pomodoro-page.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/use-pomodoro-page.ts)

* 新增 `presetName = computed(() => pomodoroStore.currentPomodoroName)`、`presetId = computed(() => pomodoroStore.currentPomodoroId)`。

* 新增 `handleSelectPreset(preset: PomodoroViewObject | null)`：

  * `preset === null` → `pomodoroStore.clearPomodoroSelection()`，直接返回。

  * 否则 `pomodoroStore.selectPomodoro(preset.id, preset.name)`。

  * **套用预设时长（仅 timer 模式且空闲时）**：当 `activeTab.value === 'timer' && timerStore.phase === 'idle'` 时，`pomodoroStore.setFocusDuration(preset.duration)` 后 `timerStore.updateConfig()`。正计时（focus）为累加计时，无时长概念，不套用（在方案「Assumptions」中说明）。

* 在返回对象中导出 `presetName`、`presetId`、`handleSelectPreset`。

### 5. 父组件模板接入

文件：[index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue)

* `import { PomodoroPresetSelectDropdown } from './preset-select-dropdown'`；从 `usePomodoroPage()` 解构 `presetName`、`handleSelectPreset`。

* 在 **timer** 与 **focus** 两个 `#BelowTimeString` 插槽内，于现有任务选择器下方追加常用专注选择器：

  ```vue
  <pomodoro-preset-select-dropdown :type="activeTab === 'focus' ? 2 : 1" @select-preset="handleSelectPreset">
    <template #default="{ open }">
      <nue-text theme="task-select-trigger" @click="open" title="常用专注">
        {{ presetName || '选择常用专注' }}
      </nue-text>
    </template>
  </pomodoro-preset-select-dropdown>
  ```

  （复用现有 `task-select-trigger` 主题即可获得「文本+悬浮下划线」的链接观感；如需与任务选择器区分，可在组件内 `scoped` 覆盖。）

## Assumptions & Decisions

1. **应用范围**：timer 与 focus 两模式都加选择器（依用户确认）。
2. **按模式过滤**：timer 列 `type=1`、focus 列 `type=2`（依用户确认）。数据一次性 `loadPomodoros()` 全量加载后在前端 `computed` 过滤，避免带 type 重新拉取覆盖共享 store。
3. **套用预设时长**：仅对 timer 且 `phase==='idle'` 生效（正计时无时长语义；运行中不打断当前计时）。若用户在运行中选择，仅更新 `currentPomodoroId` 与显示名，不改时长。
4. **选择持久性**：与关联任务一致，会话结束/重置不自动清空常用专注选择；提供「不关联」项手动清除。
5. **pomodoroId 写入时机**：记录创建时（`buildRecord`）实时读取 `pomodoroStore.currentPomodoroId`，无需在 `setCurrentSession` 时快照。
6. 不改动后端与 usecase 层（`CreatePomodoroRecordViewObject` 已含 `pomodoroId`，链路已通）。

## Verification

1. `npx vue-tsc --noEmit -p apps/web/tsconfig.json` 类型检查通过。
2. 手动验证（`/pomodoro/timer` 与 `/pomodoro/focus`）：

   * 计时器下方出现「选择常用专注」文本，悬浮显下划线，点击弹出下拉。

   * timer 下拉仅显示番茄专注（type=1），focus 仅显示正计时（type=2）。

   * 选择后文本变为该名称；timer 空闲态时计时时长同步为其预设 `duration`。

   * 点「不关联」后文本回到占位、`currentPomodoroId` 置空。

   * 完成/跳过（timer）或结束（focus）一次专注后，`POST /pomodoro-records`（或对应接口）请求体含正确的 `pomodoroId`（选中时为对应 id，未选时为 `null`）。

