# ADR：搜索页侧栏架构（AppAsideV2 Adapter 接入 + 视图上下文单一真源 + 折叠组件选型）

- **日期**：2026-09-21
- **状态**：**已裁决（已实现 / 已复核）**
- **范围**：Web 搜索域——`apps/web/src/views/index/search/context.ts`、`apps/web/src/views/index/search/entry.vue`、`apps/web/src/components/search/aside/**`、`apps/web/src/components/search/quick-search.ts`；复用既有 `AppAsideV2` 控制器，**不改** `packages/shared` 的 `NaoSmartList` 与纯层 `saved-search`/`search-history`
- **相关**：`apps/web/src/components/tasks/aside/**`、`apps/web/src/components/pomodoro/aside/**`（同类接入先例）；`docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md`（宿主 Teleport 契约同源）

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                              |
| :----- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **r1** | **2026-09-21** | 首次成文：接入模式（`setControllOption` + Teleport 两段式）→ 单一真源（实例上移 Provider，禁 module 单例）→ 折叠选型（底层 `nue-collapse theme="menu"`，否决 `smart-list`）→ 证据索引 |

## 1. 背景与问题

搜索页需要一块**常驻侧栏**（快捷搜索 / 常用搜索 / 最近搜索），宿主为应用级 `AppAsideV2`（子栏 Teleport 槽 `#SubPageAsideTeleportSlot`）。落地需回答三件事：**怎么接入宿主**、**跨区状态放哪**、**折叠用什么组件**。三者都容易踩既有资产的坑。

## 2. 决策

### 2.1 接入模式：AppAsideV2 Adapter（`setControllOption` + 两段式 Teleport）

照搬 tasks/pomodoro 侧栏既有模式：

1. `onMounted` 调 `setControllOption({ useSlot: true, useDrawerSlot: true })` 打开宿主子栏（`aside.vue:38`）；
2. `<teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">`（`aside.vue:94`）；
3. **两段式延时**：`teleportDisabled` 初值 `false`，`watch(isDisplayAside, nv => nextTick(() => teleportDisabled.value = !nv))`（`aside.vue:43-44`）——等槽位渲染后再挂 teleport，避免目标未就绪。

宿主侧由 `use-app-aside-v2-controller.ts` 提供 `setControllOption`/`isDisplayAside`/`isUseFloatAside`，槽位元素在 `aside-v2-drawer.vue:39`。

### 2.2 单一真源：`SEARCH_VIEW_CONTEXT_KEY` Provider，**禁 module 单例**

`useSavedSearch()` / `useSearchHistory()` 每次调用都会 `ref(readXxx())` 新建一份状态（`use-saved-search.ts:21-22`、`use-search-history.ts:15-16`）。若侧栏与主区**各自实例化**，会出现两份互不同步的列表（侧栏删除后主区不知道）。因此：

- **在视图 Provider 实例化一次**：`entry.vue:195` `provide(SEARCH_VIEW_CONTEXT_KEY, { savedSearches, history, removeSavedSearch, …, applyKeyword, applySavedSearch, focusSearchBox })`；
- 侧栏经 `use-aside.ts` `inject(SEARCH_VIEW_CONTEXT_KEY)` 消费同一份实例（`use-aside.ts:28-40`）；
- **禁止 module 级单例**：`useSavedSearch` 若在模块作用域 `const x = useSavedSearch()` 导出，会在多测试/多次挂载间**串状态**（localStorage 与响应式 ref 双重泄漏），且难以隔离。

### 2.3 折叠组件：底层 `nue-collapse` / `nue-collapse-item theme="menu"`

- 侧栏折叠使用库组件：`<nue-collapse v-model="collapseItemsRecord" theme="menu">` + `<nue-collapse-item theme="menu">`（`aside.vue:120-124,198-200`）；
- 折叠状态 `collapseItemsRecord` 由 `use-aside.ts` 承载：**默认全展开、非 accordion、不持久化**（刷新复位）（`use-aside.ts:15,33`）；
- 快捷搜索固定常显，不入折叠控制。

## 3. 理由与被否方案

**否决「复用 `NaoSmartList` 作侧栏分区容器」**（`packages/shared/components/smart-list/smart-list.vue`）：

| 障碍                 | 说明                                                                                                                                                         |
| :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 空态不可控           | `NaoSmartList` 内容区为 `<slot v-if="count">`，否则渲染固定 `emptyText`（`:46-64`）。搜索分区需要「标题恒显 + 自定义空态引导（保存为常用搜索）」，语义不匹配 |
| 空态需骗 `count`     | 要让 slot 渲染必须伪造 `count>0`，等于绕过组件契约，脆弱且误导                                                                                               |
| 残余 route/drag 语义 | 组件内 `nue-link theme="route"` 与 drag 事件（`:47-62`）面向「清单链接导航」，搜索分区是动作/关键词项，语义与事件模型不同                                    |
| 主题跨组件不可用     | 见下                                                                                                                                                         |

**关键坑：`theme="smart-list"` 不是通用库主题。** 它是 `NaoSmartList` **自身 scoped CSS**（`smart-list.vue:14` 使用 + `:67-68` `<style scoped>@import './smart-list.css'`）。scoped 样式只作用于该组件模板，**任何跨组件复用的 `theme="smart-list"` 都拿不到样式**。故侧栏折叠只能用库的 `theme="menu"`，不能借道 `smart-list`。

**为什么「Provider 实例化」而非「侧栏自行 inject 单例」**：单一真源必须与**视图生命周期**绑定；Provider 随搜索视图挂载/卸载，天然隔离测试与路由切换。module 单例的生命周期与模块加载绑定，无法随视图清理。

## 4. 影响与约束

- 侧栏与主区共享同一份 `savedSearches`/`history` 实例与同一组跨区回调（`applyKeyword`/`applySavedSearch`/`focusSearchBox`，`context.ts:20-25`）。
- 快捷搜索为**只读预置常量**（`quick-search.ts` `QUICK_SEARCH_PRESETS`，仅优先级/状态，零模型改动），点击复用 `applySavedSearch`（`aside.vue:58-65`）。
- 折叠默认全展开、不持久化；无障碍：自定义 header 补 `role=button`/`tabindex`/`aria-expanded`/`aria-controls`，`keydown` 用 `.self` 防子按钮冒泡（`b33b9d66`）。
- **约束（未来）**：搜索侧栏新增跨区状态，一律经 `SEARCH_VIEW_CONTEXT_KEY` 提供，**不得**在组件内直接 `useSavedSearch()`/`useSearchHistory()`；折叠类 UI **不得**依赖 `theme="smart-list"`。

## 5. 证据索引

| 类别              | 位置 / 提交                                                                                                                         |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| 接入 + 上下文     | `0a5959b2`（feat(search): 搜索侧栏 + 视图上下文）；`apps/web/src/views/index/search/context.ts`；`entry.vue:195-207`                |
| 折叠 + 快捷搜索   | `3d421a7f`（侧栏分区折叠 + 快捷搜索 + 空态 T27′）；`aside.vue:120-124,198-200`；`use-aside.ts:15,33`；`quick-search.ts`             |
| 折叠头样式/无障碍 | `b33b9d66`（折叠头箭头改 `nue-icon` + 清除按钮移入头部）；`aside.vue`                                                               |
| Teleport 两段式   | `apps/web/src/components/search/aside/aside.vue:38,43-44,94`                                                                        |
| 宿主控制器        | `apps/web/src/components/app/aside-v2/use-app-aside-v2-controller.ts:5-54`；`aside-v2-drawer.vue:39`（`#SubPageAsideTeleportSlot`） |
| 组合式状态        | `apps/web/src/components/search/use-saved-search.ts:21-22`；`use-search-history.ts:15-16`                                           |
| SmartList 障碍    | `packages/shared/components/smart-list/smart-list.vue:14,46-64,67-68`（scoped CSS + `count`/`emptyText`/route/drag）                |
| 同类先例          | `apps/web/src/components/tasks/aside/aside.vue:30-38`；`apps/web/src/components/pomodoro/aside/aside.vue:18-26`                     |

## 6. 遗留项

- **移动端（浮动侧栏）**：隐藏拖拽手柄，不启用排序拖拽；若后续要在移动端支持常用搜索排序，需另评估手势与 `isUseFloatAside` 分支。
- **折叠状态持久化**：当前**有意不持久化**（刷新复位）。若产品要求记忆展开态，应落在 `use-aside.ts` 并显式登记，避免各分区各自持久化。
- **`NaoSmartList` 复用边界**：本单确认其定位为「清单链接导航 + 拖拽排序」，搜索侧栏不复用。若未来需要统一「可折叠分区」抽象，应另立 ADR 抽公共组件，而非把 `smart-list` 泛化。