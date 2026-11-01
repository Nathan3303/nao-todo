# ADR：看板分组状态上提与控件入菜单

- 状态：**已采纳（PM 2026-11-01 拍板：D1 = 页面 Provider · D2 = 采纳并订正计数 · D3 = 不改，切视图不关菜单）**
- 更新：2026-11-01
- Owner：arch-designer
- 指针：PRD `docs/prds/2026-11-01-kanban-group-switch-in-menu.md` · 评审 `docs/reports/T611-arch-review.md`

## 背景

- 分组控件从看板内容区顶部搬进右上角「视图」菜单（仅看板视图渲染）⇒ 控件与状态**跨层**：菜单在页面 header，状态原本在看板内部（`use-kanban.ts:22`）。
- 硬约束：三处页面共用一份实现（R-D）· 不写偏好存储（R-C）· 列集合与拖拽载荷语义零变化（AC5）· 视觉零回归（R-F）。

## 决策

1. 分组状态 = 注入式 `Ref<'state'|'priority'>`，实现单点 `packages/presentation/task/components/kanban/use-kanban-group.ts`（`KANBAN_GROUP_BY_KEY` / `provideKanbanGroup` / `useKanbanGroup`）；**每页视图组合式各 provide 1 次**（Provider 位置 = `index.vue:15-16` 两个 `router-view` 的父级）。
2. `TaskKanban` **不加 prop**，改从注入取分组；列集合由 `KANBAN_GROUP_BY_NAMES` 派生为 computed；`TASK_KANBAN_CONTEXT_KEY` 与列组件（`kanban-column.vue` / `use-kanban-column.ts`）零改动。
3. 菜单控件 = `components/kanban/kanban-group-switch.vue`，**包装** `SegmentedSwitch`，三处菜单各 1 行且 `v-if` 仅看板视图。
4. 焦点归还补在 `TaskOperationsDropdown` 一处（nue-dropdown 不提供）。

## 理由

- 业务匹配：三处页面同形 ⇒ 单一实现即满足「三处一致」，且无三份逻辑副本。
- 成熟度：provide/inject 为 Vue 既有机制；`SegmentedSwitch` 已是 `DESIGN §4.5` 单一来源件，包装不引新体系、不新增 token / i18n 键。
- 团队能力 / 成本：≈0.6 人天；零 domain / 零契约 / 零持久化改动，第 1 步（状态上提）可独立验收与回滚。
- 可测：注入键可经 `global.provide` 直接注入 ⇒ 行为用例（载荷键集合）不必挂菜单，降低测试面耦合。

## 对照过的备选模式

1. **维持现状（控件留在看板内）** —— 适用：无需收敛入口；代价：内容区常驻一行 + 入口割裂（用户已明示否决）；不采纳。
2. **并入 `preference`（视图偏好对象）** —— 适用：需要跨会话记忆分组；代价：`savePreference` 整实体落库（`handlers/built-in-project.ts:133-141`）⇒ 违反 R-C，且须改 3 个 domain 包；不采纳。
3. **module 级单例 ref** —— 适用：单实例、无路由多页；代价：跨页串状态、测试串味（同 `2026-09-21-search-aside-appaside-adapter` 的「禁 module 单例」）；不采纳。
4. **页面级 Pinia store 切片** —— 适用：多入口读写同一视图状态且需跨组件订阅；代价：为一个二值状态引入 store + 生命周期重置逻辑，属过设计；不采纳。
5. **tasks-view 单点 provide（entry 级）** —— 适用：要求绝对只有 1 个 provide 点；代价：换页与切视图都不重置，须 watch 路由补重置，与 AC6「重新进入回默认」不符；不采纳为默认（保留为 D1 备选）。
6. **`TaskKanban` 增 `groupBy` prop** —— 适用：组件独立发布、需显式契约；代价：3 页 + `kanban-view-adapter` 三层透传，且 prop 与注入形成双权威；不采纳（测试接缝由 `global.provide` 承担）。

## 后果与风险

- 正面：一处实现三处复用；DOM 搬家不触拖拽与载荷；控件仍用同一分段件，视觉零回归。
- 风险①：注入键漏 provide ⇒ 菜单与看板各持一份 ref（静默分歧）。应对：`useKanbanGroup` 缺 Provider 时开发态 `console.error` + 本地回退，并加「三处页面均 provide」断言。
- 风险②：R-A 与「菜单项不关闭」依据为 `nue-ui@1.13.0` 实现细节（弹层根 `@click.stop` + `data-executeid` 判定 + overlay 自动聚焦），升级 nue-ui 须复核。
- 风险③：三处 provide 是机械重复（3 行），新增任务视图页易漏。

## 限制与已知边界

- 只覆盖 web / desktop（桌面经 `@` 别名复用 web 源码）；移动端与 `presentation-react` 不受影响。
- 不覆盖：分组持久化、菜单其它条目行为、`<li>` 菜单项键盘可达性（既有债，不在本单）。
- 状态生命周期 = 页面组件实例：同页内切视图保持；刷新 / 换 section 回 `state`；同一 section 内换 `projectId` 保持（如不可接受，加 1 行 watch）。

## 相关指针

- 评审（证据行号 + 测试面清点 + 落地顺序）：`docs/reports/T611-arch-review.md`
- 单一来源件与视觉契约：`packages/shared/components/segmented-switch/segmented-switch.vue` · `DESIGN.md §4.5`

## 参考来源

- 未检索到外部来源；行为依据为本地依赖源码 `nue-ui@1.13.0`（`dist/es/dropdown-DE2Hj1Lk.js`、`dist/es/overlay-Durmb9ai.js`）· 访问 2026-11-01。