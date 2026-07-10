# 重新设计 PomodoroFocusDependDropdown 不关联区域

## Summary

在 `PomodoroFocusDependDropdown` 组件中，为「常用专注」和「任务专注」两个面板各自新增一个统一的「关联状态区域」，位于 Tabs 下方、面板内容上方。该区域显示当前选中的关联名称并提供取消关联入口，形如：

```
当前专注关联：晨间深度工作  |  取消关联
```

未选择任何关联时显示占位文案（如 `当前专注关联：未关联`），不显示「取消关联」链接，保持区域始终存在、布局稳定。

同时移除现有两个旧「不关联」入口：
1. 常用专注列表首项的「不关联」项（`focus-depend-dropdown.vue` 第 138-141 行）
2. 任务面板搜索栏下方的「不关联」按钮（第 172-175 行）

## Current State Analysis

### 组件结构
[focus-depend-dropdown.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/focus-depend-dropdown/focus-depend-dropdown.vue)：
- 单个 `nue-dropdown`，顶部自建 Tabs（常用专注 / 任务专注）。
- 常用专注面板：`nue-content[theme="preset-panel"]`，列表首项为「不关联」（`handleSelectPreset(null)`）。
- 任务面板：`nue-div[theme="task-panel"]`，含搜索栏 + 一个「不关联」按钮（`handleClearTask`）+ 任务列表。

### 数据来源
- 组件当前**不感知**当前选中的名称。选中状态存于父组件 hook：
  - [use-pomodoro-page.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/use-pomodoro-page.ts#L83-L104)：`presetName`（`pomodoroStore.currentPomodoroName`）、`taskName`（`pomodoroStore.currentTaskName`）。
  - 通过 [index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) 组合触发文案 `dependLabel`。
- 因此需要将 `presetName` / `taskName` 以 props 形式传入组件。

### 事件契约
[types.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/focus-depend-dropdown/types.ts) 已有：
- `selectPreset(preset: PomodoroViewObject | null)`：`null` 即取消常用专注关联。
- `selectTask(task)`、`clearTask()`：分别为选择任务、取消任务关联。

现有事件已足够表达「取消关联」语义，无需新增 emit。

## Proposed Changes

### 1. [types.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/focus-depend-dropdown/types.ts)
在 `PomodoroFocusDependDropdownProps` 中新增两个可选字段，用于显示当前关联名称：

```ts
export type PomodoroFocusDependDropdownProps = {
    type: PomodoroType
    presetName?: string
    taskName?: string
}
```

Emits 保持不变（`selectPreset(null)` 用于取消常用专注，`clearTask()` 用于取消任务）。

### 2. [focus-depend-dropdown.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/focus-depend-dropdown/focus-depend-dropdown.vue)

**Template 改动：**
- 在 `nue-div[theme="depend-tabs"]` 之后、`nue-main` 之前，新增一个统一的关联状态栏 `nue-div[theme="depend-status"]`，根据 `activeTab` 展示对应类型的关联信息：
  - 常用专注 Tab：显示 `presetName`，取消动作 `handleSelectPreset(null)`。
  - 任务专注 Tab：显示 `taskName`，取消动作 `handleClearTask`。
  - 结构：`当前专注关联：<名称 或 未关联>`，名称存在时紧跟分隔符 `|` 和「取消关联」链接。
- 移除常用专注列表首项的「不关联」`nue-div[theme="preset-item,none"]`（第 138-141 行）。
- 移除任务面板搜索栏下的「不关联」`nue-button[theme="depend-none"]`（第 172-175 行）。

关联状态栏采用计算属性简化模板：
```ts
// 当前 Tab 对应的关联名称
const currentDependName = computed(() =>
    activeTab.value === 'preset' ? props.presetName : props.taskName
)

// 取消当前 Tab 的关联
const handleClearDepend = () => {
    if (activeTab.value === 'preset') {
        handleSelectPreset(null)
    } else {
        handleClearTask()
    }
}
```

模板（示意）：
```html
<nue-div theme="depend-status">
    <nue-text theme="depend-status-label">当前专注关联：</nue-text>
    <nue-text theme="depend-status-name">{{ currentDependName || '未关联' }}</nue-text>
    <template v-if="currentDependName">
        <nue-text theme="depend-status-divider">|</nue-text>
        <nue-link theme="depend-status-clear" @click="handleClearDepend">取消关联</nue-link>
    </template>
</nue-div>
```

> 说明：由于取消关联后 `handleSelectPreset(null)` / `handleClearTask` 会调用 `dropdownRef.value?.close()` 关闭下拉。此行为与现状一致（选择任一项都会关闭下拉），保持不变。

**Style 改动（`frontend-design` 精细化）：**
新增 `.nue-div--depend-status` 样式，遵循组件现有 CSS 变量体系（`--nue-primary-color-*`、`--nue-padding-*`、`--nue-text-*`、`--nue-primary-radius`），与 Tabs 视觉衔接：
- 单行 flex 布局，`align-items: center`，`gap` 使用 `--nue-gap-2xs`。
- 内边距 `var(--nue-padding-xs) var(--nue-padding-sm)`，底部细分隔线 `1px solid var(--nue-border-color)` 与 Tabs 呼应。
- label 用 `--nue-primary-color-400`（弱化），name 用 `--nue-primary-color-800`（强调，`font-weight` 略增），divider 用 `--nue-primary-color-300`，clear 链接 hover 变 `--nue-primary-color-900` 且下划线。
- 名称过长时 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`，`flex: 0 1 auto` 让分隔符/链接始终可见。

同步删除不再使用的样式：`.nue-div--preset-item.nue-div--none` 相关规则（第 303-305 行）、`.nue-button--depend-none` 规则（第 337-341 行）。

### 3. [index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue)
向组件传入当前关联名称 props：

```html
<pomodoro-focus-depend-dropdown
    :type="activeTab === 'timer' ? 1 : 2"
    :preset-name="presetName"
    :task-name="taskName"
    @select-preset="handleSelectPreset"
    @select-task="handleSelectTask"
    @clear-task="handleClearTask"
>
```

`presetName`、`taskName` 已在当前 `usePomodoroPage` 解构中可用，无需改动 hook。

## Assumptions & Decisions

- **空状态**：显示占位文案 `当前专注关联：未关联`，不渲染「取消关联」链接，区域常驻（用户确认）。
- **移除旧入口**：删除常用专注列表首项「不关联」与任务面板「不关联」按钮，取消关联统一收敛到顶部状态栏（用户确认）。
- **代码风格**：严格沿用组件现有约定——`nue-*` 组件 + `theme` 属性、`<style>` 内用 `#pomodoro-focus-depend-selector > ...` 层级选择器、CSS 变量、中文注释（用户强调）。
- **不新增 emit**：复用既有 `selectPreset(null)` 与 `clearTask()`，符合「只做必要改动」原则。
- **文案**：采用需求给定格式「当前专注关联：xxx | 取消关联」。

## Verification

1. `npx vue-tsc --noEmit -p apps/web/tsconfig.json` 通过（exit 0），无类型错误。
2. 手动验证（描述预期，供执行后核对）：
   - 常用专注 Tab：选中某常用专注后顶部显示其名称与「取消关联」；点击「取消关联」名称回到「未关联」且下拉关闭。
   - 任务专注 Tab：同理，显示任务名并可取消。
   - 未关联时两面板顶部均显示「当前专注关联：未关联」，无取消链接，布局不跳动。
   - 常用专注列表不再有首项「不关联」；任务面板搜索栏下方不再有「不关联」按钮。
