# T611 架构评审：看板分组切换移入右上角菜单

- 状态：**已验收（PM 2026-11-01）** —— D1/D2/D3 全部拍板；PRD 两处事实偏差已回写（R-A 措辞、调用方计数）；**PM 复核订正一处**：本报告的「4 → 5」经实测为 **4 → 4**（`grep -rn "<segmented-switch" \| grep -v __tests__ \| wc -l` = 4）· 更新：2026-11-01 · Owner：arch-designer
- 指针：PRD `docs/prds/2026-11-01-kanban-group-switch-in-menu.md` · 决策 `docs/adr/2026-11-01-kanban-group-state-hoisting.md`
- 口径：只读评审（未改源码 / 未提交 / 未切分支；本次唯一新增 = 本文件与 ADR）。证据 = `codegraph_explore` + `grep -rn` + 行段；未跑门禁（无代码改动）。

## 一、可行性结论

**有条件可行**，AC1–AC10 均可达。三条前提：① **状态先上提、控件后搬家**（两步分开验收，第 1 步零可见变化）；② **R-A 零改动可得**，但 **R-E 的「焦点归还原触发器」nue-dropdown 不提供**，须补一处（全仓唯一实现）；③ **R-A 措辞需更正** —— 现有菜单项**本来就不关闭**（见 §四 F-2），PRD 写的「其它命令项仍按现行为关闭」与实现不符。

## 二、五问答复

**Q1 状态归属 —— 推荐「注入式 Ref 上提到页面 Provider」，不并入 `preference`、不用 module 单例。**
新增 `packages/presentation/task/components/kanban/use-kanban-group.ts`：`KANBAN_GROUP_BY_KEY`（`InjectionKey<Ref<'state'|'priority'>>`）+ `provideKanbanGroup()` + `useKanbanGroup()`。三处页面在各自 `useXxxView()` 里调 **1 行** `provideKanbanGroup()`（`built-in-project.ts:127` / `project.ts:111` / `tag.ts:106` 附近），Provider 正是 `index.vue:15-16` 两个 `router-view` 的父级 ⇒ 菜单与看板拿同一个 ref。

- 满足 R-D：**1 份实现**（唯一创建点 = 该组合式函数），列集合仍由 `KANBAN_GROUP_BY_NAMES` 派生（`constants.ts:10-13`）⇒ 不产生第二份列集合；三处 provide 是机械调用，不含逻辑副本。
- 满足 R-C：ref 只在内存、不接任何 handler / store ⇒ 零写入。
- **不并入 `preference`**：`preference` 会被 `savePreference` 整实体落库（`packages/presentation/built-in-project/handlers/built-in-project.ts:133-141`）⇒ 必然持久化，直接违反 R-C；且要动 3 个 domain 包（超范围）。
- **不用 module 单例**：跨页串状态 + 测试串味（同 `docs/adr/2026-09-21-search-aside-appaside-adapter.md` 记过的「禁 module 单例」教训）。
- 取舍的另一候选（tasks-view 单点 provide，`apps/web/src/views/index/tasks/tasks-view.ts`）见 ADR 对照表：1 个 provide 点但换页/切视图都不重置，与 AC6「重新进入回默认」不符 ⇒ 列为 **D1**。

**Q2 `TaskKanban` 契约 —— 不加 `groupBy` prop；`TASK_KANBAN_CONTEXT_KEY` 语义不变；列组件零改动可行（已逐行核对）。**

- 加 prop 要走 3 页 + `kanban-view-adapter.vue:77-93` 三层透传，且与注入形成**双权威**；R-D 要单一权威 ⇒ prop 不作产品契约，仅把测试接缝交给 `global.provide`。
- 列组件零改动成立：`kanban.vue:57` 仍以 `:group-by` prop 下发，`kanban-column.vue:16` 只注入 `refreshKey/tags/updatingTaskIds`，`use-kanban-column.ts:17-23` 只读 `props.groupBy` ⇒ 三者不动。
- 改动仅落 `use-kanban.ts`：`states.currentGroupBy`（:22）改注入 ref、`kanbanColumns` 改 computed、删 `getKanbanColumns`（:50-55；唯一调用点 `kanban.vue:32,35`）；`handleTaskDrop` 的 `byPriority`（:30）改读同一 ref ⇒ **R2/AC5 载荷键集合零变化**。

**Q3 三处 dropdown 复用 —— 抽 `KanbanGroupSwitch`，放 `packages/presentation/task/components/kanban/`（不放 `shared`）。**

- 它**包装** `SegmentedSwitch`（`segmented-switch.vue:50-76`），不自绘分段 ⇒ **不是第二份分段实现**，与 `DESIGN.md §4.5`「复用红线」一致；调用点与 `TaskColumnDisplayController` 同级（`@nao-todo/presentation/task` 导出）。
- 不放 `packages/shared/components`：shared 不得反向依赖 `presentation/task` 的分组状态，否则只能把状态再抄一份 ⇒ 违反 R-D。
- 三处各 1 行：`<kanban-group-switch v-if="preference.viewType === 'kanban'" />`，紧跟「看板视图」`inner-dropdown-option`（`built-in-project/header/operation-dropdown.vue:47-52` / `project/…:67-72` / `tag/…:56-61`），同形插入同一个 `dropdown-div-block`（其 `gap: --nue-gap-2xs`，`dropdown-div-block.vue:19` ⇒ 自动满足 PRD §二.2「间距 ≤ 一个条目内间距」，无需额外 CSS）。
- 尺寸取 `size="md"`（≈40px，保留原看板形态 + `DESIGN §3` 点击区）+ `fill` 默认 true（与菜单行同宽）；⛔ 调用方不覆盖分段件 CSS。
- ⚠️ **PRD §六「4 → 7」应更正为「4 → 5」**：`SegmentedSwitch` 只多 1 个调用方（包装件内），三处菜单用的是包装件。请 PM 同步 `DESIGN.md §4.5`（该段现写「现为 4 个」）。

**Q4 风险与影响面（按面清点）**

- **测试面（qa 先行，结构面四条）**：① **DOM 不存在** `viewType!=='kanban'` 时无 `[data-kanban-group-switch]`（不是 `v-show`）；② **零存储写入**（spy `localStorage/sessionStorage.setItem` + `subscriber.emit('UpdatePreference')` 均为 0）；③ **载荷键集合**（`{priority}` / `{state}` 各自唯一）原样保留；④ **菜单不关闭**（点分段后弹层仍 `data-visible="true"`）。
- **既有用例必改**：`t608-kanban-harness.ts:274-280` 的 `clickSegment` 依赖「控件在 `TaskKanban` 内」⇒ 改「`mountKanban(..., { groupBy })` + `global.provide` 注入键」。牵连 **5 文件 22 例**：`t608-ac1a` 6（**整组作废**，它断言入口在看板内，与 AC3 相反）、`ac1b` 4、`ac2-ac3` 5、`ac4` 5、`ac5` 2（这 16 例只换接缝、断言不动）；`t583` 2 例不受影响。新菜单用例落 `apps/web/src/components/tasks/*/__tests__/`（受 `guard:test-location` 约束）。
- **R-A 可行且是既有行为**：弹层根 `<ul>` 用 `@click.stop`（`nue-ui` 打包 `dist/es/dropdown-DE2Hj1Lk.js:318`），关闭仅在 `e.target.dataset.executeid` 存在且 `closeWhenExecuted` 为真时发生（`:265`、`:274`）；分段是 `<button>`（`segmented-switch.vue:63-75`）无该属性 ⇒ 点它不关闭菜单。
- **F-2（PRD 事实更正）**：`operations-dropdown.vue:13-18` 未设 `close-when-executed`，`inner-dropdown-option.vue:9-22` 的 `<li>` 也 `@click.stop` ⇒ **现有菜单项点击后都不关闭**；`routes.ts:26` 是**同一条路由记录**（`viewType` 只是 param）⇒ 切视图不重建 Header ⇒ 实际表现是「菜单继续开着、看板项消失」。R-A 应改为「其它条目不改变现状（不主动关闭）」；是否顺手显式关闭 = **D3**（建议不改，超范围）。
- **R-E 键盘**：`NueOverlay` 打开时 `tabindex="-1"` 且自动 `focus()`（`dist/es/overlay-Durmb9ai.js:29,36`）⇒ Tab 直接落到弹层内第一个可聚焦元素 = 分段的「按状态」⇒ **AC8 前半免费可得**（现有 `<li>` 菜单项不可聚焦属既有债，本单不动）。**缺的一块** = 关闭时无焦点归还 ⇒ 在 `TaskOperationsDropdown` 加「打开时记 `document.activeElement`，`@close` 时 `.focus()` 回触发器」（一处，勿在 3 处复制）。
- **窄屏**：弹层 `min-width: 12rem`（`operations-dropdown.vue:30-32`）+ 溢出翻转（`dropdown-DE2Hj1Lk.js:140-165`）⇒ 不会出屏；320px 下两段中文是否裁字须实测（用户视觉勾选项，AC9）。
- **桌面端一致性**：`apps/desktop/electron.vite.config.ts:48-49` 把 `@` 指向 `apps/web/src` ⇒ 三处菜单与看板同一份代码，零额外改动。
- **清理面（R-G）**：该 header 内只有分段（`kanban.vue:40-50`）⇒ 无信息丢失；`kanban.css:9-14` 的 `.kanban-toolbar` 规则须与 `kanban.vue:40-50` 同批删（否则留死样式）；同时删 `kanban.vue:7-8` 的 `SegmentedSwitch` / `t` 导入与 `TaskKanbanVO`（`types.ts:9-12`，改 computed 后无引用）。`#TasksMainKanbanContainer` 的 `gap` 只作用于 `nue-main`（`kanban-view-adapter.vue` 样式块）⇒ 无残留空行。

**Q5 落地顺序（qa → rd-fe，4 步）**

1. **qa 接缝先行**（≈0.2d）：改 harness + 落 ①②③④ 结构用例（红基线）。
2. **rd-fe 第 1 步：状态上提**（≈0.3d）：只加 `use-kanban-group.ts` + 改 `use-kanban.ts` + 3 行 provide，**不动 DOM** ⇒ `t608`/`t583` 全绿、界面零变化，可独立验收与回滚。
3. **rd-fe 第 2 步：控件搬家**（≈0.2d）：`KanbanGroupSwitch` + 三处菜单插入 + 删 toolbar 块与 CSS。
4. **rd-fe 第 3 步：焦点归还**（≈0.1d）：`TaskOperationsDropdown` 一处。
5. qa 跑 AC1–AC6/AC8 结构面；PM 同步 `DESIGN §4.5` 与 PRD 计数；用户勾 AC7（手感）/ AC8（真机键盘）/ AC9（暗色与窄屏）。

## 三、待拍板

- **PM-D1 状态宿主**：推荐 **页面 Provider**（每页 1 行 provide，每页独立 ref ⇒ 刷新/换 section 回默认，合乎 AC6；同一 section 内换 `projectId` 不重置，如需重置加 1 行 watch）；备选 tasks-view 单点 provide（1 处，但换页/切视图都不重置，需 watch 路由补）。
- **PM-D2 文档与台账口径**：R-A 改「其它条目不改变现状」+ PRD §六「4→7」改「4→5」+ `DESIGN.md §4.5` 调用方计数 + `t608-ac1a` 6 例**整组作废**（新菜单用例取代；记「作废」而非删断言）。
- **PM-D3 切视图是否显式关菜单**：现状不关；推荐不改（若改，三处各 1 行 `dropdownRef.close()`）。

**连带同步清单（Owner）**：`DESIGN.md §4.5`（调用方 4 → 5）+ PRD §六 / R-A + `t608` 报告口径 + `tasks-state` / `v1.16.1` release notes（用户侧写「分组切换挪到右上角菜单」）→ **PM**；移动端红线目录零改动。

## 四、未做与限制

- 未跑门禁 / 未真机（只读评审）；R-A 与「菜单项不关闭」两条依据是 **`nue-ui@1.13.0` 实现细节**（弹层根 `@click.stop` / `data-executeid` 判定 / overlay 自动聚焦），升级 nue-ui 后须复核。未审 `preference.viewType` 与路由 param 的既有同步口径（沿用现有 `:checked` 同源）。