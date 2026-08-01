# 抽离番茄专注页面头部组件（PomodoroHeader）实现计划

## Summary

将 `/pomodoro/timer`、`/pomodoro/focus`（[layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue)）与 `/pomodoro/pomodoros`（[collection/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/index.vue)）重复的头部（`nue-header`：标题 + tabs + 操作按钮）抽离为独立可复用组件 **`PomodoroHeader`**，放在 `apps/web/src/layouts/pomodoro/header/`。两个页面统一引用该组件，从而修复常用专注页面右侧「新建常用番茄专注」「查看历史专注记录」两个按钮缺失的问题。

## Current State Analysis

### 问题根因

- [layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue#L71-L78) 的 `nue-div theme="actions"` 内有两个按钮（新建常用 + 查看历史记录）。
- [collection/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/index.vue) 的 `nue-div theme="actions"` 为空（`<nue-div theme="actions" />`），因此常用专注页无这两个按钮。
- 两页头部结构、CSS（`> .nue-header { ... }` 及 `.nue-div--tabs`、`.nue-div--title-wrapper`、`.nue-div--actions`）完全重复。

### 现有实现细节

- **头部三段**：
    1. `title-wrapper`：浮动侧栏切换按钮（`v-if="isUseFloatAside"`）+ 标题「番茄专注」。
    2. `tabs`：3 个 `nue-link`（番茄专注 / 正计时 / 常用专注）。
    3. `actions`：新建常用（icon `plus`）+ 查看历史记录（icon `ntd-history`）。
- **依赖上下文**（均来自 `inject(POMODORO_VIEW_CONTEXT_KEY)!`，见 [context.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/context.ts)）：
    - `isUseFloatAside` / `isDisplayAside` / `switchDisplayAside`（浮动侧栏按钮）。
    - `dialogManager`（打开创建对话框）。
- **新建按钮逻辑**：`handleOpenCreator` = `dialogManager.open(POMODORO_CREATOR_DIALOG_KEY)`（[index.vue L20-L23](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue#L20-L23)）。
- **查看历史记录按钮**：当前**无 click 事件**（仅展示，[index.vue L75-L77](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue#L75-L77)）。保持现状（不新增行为），仅原样搬迁。
- **组件组织约定**：现有子模块（`aside/`、`task-select-dropdown/`）均为 `xxx.vue` + `index.ts`（`export const PomodoroXxx = Xxx`），并在 [layouts/pomodoro/index.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.ts) 用 `export * from './xxx'` 汇总。

## Proposed Changes

### 1. 新增 `apps/web/src/layouts/pomodoro/header/header.vue`

组件自身 `inject(POMODORO_VIEW_CONTEXT_KEY)!` 获取所需上下文，并内聚「新建常用」按钮逻辑：

- `<script setup>`：
    - `defineOptions({ name: 'PomodoroHeader' })`。
    - `inject(POMODORO_VIEW_CONTEXT_KEY)!` 取 `dialogManager`、`isUseFloatAside`、`isDisplayAside`、`switchDisplayAside`。
    - `handleOpenCreator` = `dialogManager.open(POMODORO_CREATOR_DIALOG_KEY)`（import 自 `@/infrastructure/constants/dialog-keys`）。
- `<template>`：原样搬迁现有 `nue-header` 三段（title-wrapper / tabs / actions，含两个按钮）。
- `<style scoped>`：将现有 `#Pomodoro > .nue-header { ... }` 头部相关样式迁移为**组件根级** `.nue-header { ... }`（含 `.nue-div--title-wrapper`、`.nue-div--tabs`、`.nue-div--actions` 子选择器），使样式随组件走。

**why**：头部逻辑与样式内聚到单一组件，两页复用，彻底消除重复与「按钮缺失」不一致。

### 2. 新增 `apps/web/src/layouts/pomodoro/header/index.ts`

```ts
import Header from './header.vue'

export const PomodoroHeader = Header
```

（对齐 `aside/index.ts` 风格。）

### 3. 更新 `apps/web/src/layouts/pomodoro/index.ts`

新增 `export * from './header'`，使 `PomodoroHeader` 可从 `@/layouts/pomodoro` 统一导入。

### 4. 改造 `apps/web/src/layouts/pomodoro/index.vue`（timer/focus 页）

- 删除模板中 `<nue-header>...</nue-header>` 整段，替换为 `<pomodoro-header />`。
- 删除 `<script>` 中已下沉到 header 的内容：`handleOpenCreator`、`POMODORO_CREATOR_DIALOG_KEY` 导入；`inject` 中不再需要的 `isUseFloatAside` / `isDisplayAside` / `switchDisplayAside`（**保留** `dialogManager`、`subscriber`，因 `usePomodoroPage(dialogManager, subscriber)` 仍需）。
- 引入 `PomodoroHeader`（`import { PomodoroHeader } from './header'` 或从 `@/layouts/pomodoro`；为避免潜在循环依赖，采用相对路径 `./header`）。
- 删除 `<style scoped>` 中 `#Pomodoro > .nue-header { ... }` 整段（已迁至 header 组件）；保留 `#Pomodoro > .nue-main .nue-content` 的 grid 样式。

### 5. 改造 `apps/web/src/layouts/pomodoro/collection/index.vue`（常用专注页）

- 删除模板中 `<nue-header>...</nue-header>` 整段，替换为 `<pomodoro-header />`。→ 自动获得两个操作按钮，修复缺失问题。
- 删除 `<script>` 中仅为头部服务的 `inject`（`isUseFloatAside` / `isDisplayAside` / `switchDisplayAside`）与对应逻辑；`usePomodoroCollection()` 等其余逻辑保留。
- 引入 `PomodoroHeader`（相对路径 `../header`）。
- 删除 `<style scoped>` 中 `#PomodoroCollection > .nue-header { ... }` 整段；保留 `.nue-content` grid 与列表/详情样式。

## Assumptions & Decisions

1. **标题固定为「番茄专注」**：两页现有头部标题一致，抽离后保持不变，`PomodoroHeader` 无需 props。若后续需按页面区分标题，再加 prop（当前不做，避免过度设计）。
2. **「查看历史专注记录」按钮保持无 click 行为**：与现状一致，仅搬迁，不新增功能（历史页 [history/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/history/index.vue) 目前是未实现占位，超出本次范围）。
3. **组件自身注入上下文**：`PomodoroHeader` 直接 `inject(POMODORO_VIEW_CONTEXT_KEY)`（两页均在 `PomodoroView` provide 范围内，见 [entry.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/entry.vue) → router-view 子组件），无需通过 props 传参，最简洁。
4. **样式随组件迁移**：头部 CSS 移入 `header.vue` 的 `<style scoped>`（根级 `.nue-header` 选择器），两页容器仅保留各自 main/content 布局样式。
5. **无新增依赖、无路由改动**。

## Verification

1. **类型检查**：`npx vue-tsc --noEmit -p apps/web/tsconfig.json` 退出码 0。
2. **运行时手测**：
    - `/pomodoro/timer` 与 `/pomodoro/focus`：头部展示正常，tabs 高亮正确，「新建常用番茄专注」按钮点击弹出创建对话框；浮动侧栏按钮（窄屏）正常。
    - `/pomodoro/pomodoros`：头部右侧**出现**「新建常用番茄专注」「查看历史专注记录」两个按钮，样式与其它页一致；点击「新建」弹出创建对话框。
    - 三页头部视觉与交互完全一致。
3. **回归**：timer/focus 页面主体（计时/记录/笔记）与常用专注页主体（列表/详情）功能不受影响。

## 执行顺序

1. 新增 `header/header.vue` + `header/index.ts`。
2. 更新 `layouts/pomodoro/index.ts` 汇总导出。
3. 改造 `index.vue`（timer/focus）。
4. 改造 `collection/index.vue`。
5. `vue-tsc` 类型检查 + 手测。