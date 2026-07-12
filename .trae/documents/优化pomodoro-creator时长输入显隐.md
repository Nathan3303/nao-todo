# 优化 pomodoro-creator：按类型显隐时长输入

## Summary
优化 pomodoro-creator 组件，使「专注时长（分钟）」输入项仅在 `Type = 1（番茄专注）` 时显示，`Type = 2（正计时）` 时隐藏，以减少对用户的干扰。创建（调用 `pomodoroUseCase.create`）时传递的参数结构保持不变。

## Current State Analysis
- 组件：[pomodoro-creator.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/pomodoro-creator.vue)
  - [L79-L96](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/pomodoro-creator.vue#L79-L96) 为「专注时长（分钟）」区块，当前无条件渲染。
  - [L74-L77](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/pomodoro-creator.vue#L74-L77) 为类型选择 `nue-select`，`form.type` 取值 `1` 或 `2`。
- 逻辑：[use-pomodoro-creator.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/use-pomodoro-creator.ts)
  - `form.duration` 默认 `25`（[L39](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/use-pomodoro-creator.ts#L39)、[L48](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/use-pomodoro-creator.ts#L48)）。
  - `handleConfirm` 中 [L62-L65](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/use-pomodoro-creator.ts#L62-L65) 校验 `duration` 范围 5-180；[L68-L73](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/use-pomodoro-creator.ts#L68-L73) 调用 create 传入 `duration: f.duration * 60`。

## Proposed Changes

### 1. pomodoro-creator.vue（模板显隐）
- 在时长区块外层 `nue-div`（[L79](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/pomodoro-creator.vue#L79)）添加 `v-if="form.type === 1"`，使其仅在番茄专注型时渲染。
- **原因**：正计时型无需固定时长，隐藏可减少干扰。
- **保持参数不变**：`form.duration` 默认值 `25` 仍在，隐藏时不清空，create 仍照常传 `duration`。

## Assumptions & Decisions
- **参数不变的解读**：`pomodoroUseCase.create` 的调用参数结构与取值来源保持不变，Type=2 时仍传递 `form.duration`（默认 25 分钟 → 900 秒）。因此 `handleConfirm` 中的 duration 校验保留即可（默认值 25 恒在合法范围内），无需为 Type=2 特殊处理，避免超范围改动。
- 仅改动模板显隐，不改动 `use-pomodoro-creator.ts` 逻辑，符合「最小改动」原则。

## Verification
1. 打开新建常用番茄专注对话框，默认类型「番茄专注」，时长输入项可见。
2. 切换为「正计时」，时长输入项隐藏；切回「番茄专注」，重新显示。
3. 「正计时」类型下点击创建，成功创建且不报错（duration 仍按默认值传递）。
4. 「番茄专注」类型下修改时长并创建，行为与改动前一致。
