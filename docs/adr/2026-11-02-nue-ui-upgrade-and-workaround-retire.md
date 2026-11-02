# ADR：nue-ui 升级与「上游缺陷驱动的本仓规避」回收

- 状态：**已接受（PM 2026-11-02 拍板 D1–D5）** —— 决策 1–3 采纳（决策 3 验收加严：图标型入口须断言 `nue-link--route-icon` 类存在）；决策 4 `newTaskId` 追认**有条件接受**（C-1…C-4）；附加决定 = 3 处无名开关补 `aria-label`、身份页互链规避本批不回收（挂账到期 2026-12-31）、`focus-depend-dropdown` 两处无 `href` 链接登记新缺陷 `DEF-128`
- 更新：2026-11-02
- Owner：arch-designer
- 指针：PRD `docs/prds/2026-11-02-nue-ui-1.15.3-upgrade.md` · 评审 `docs/reports/T628-nue-ui-1153-arch-review.md` · 关联 ADR `docs/adr/2026-11-01-kanban-column-paging.md`

## 背景

- `nue-ui@1.13.0` 的 `nue-link` 路由形态渲染无 `href` 的 `<a>`（上游 `#108`），本仓于 2026-10-31 自建 `NaoRouterLink`（复刻 `router-link` + `.nue-link` 主题类）作**临时规避**：8 文件 import / 11 处模板调用点 / 1 处动态面（`smart-list`）。
- 上游 `v1.15.3` 已修 `#108` / `#109`（头像错误态复位）/ `#110`（开关默认插槽），发版说明明示「无破坏性变更」。
- 规避件与上游实现**同构**（同一批类名、同一内部节点树）⇒ 上游任何链接改动都需手工同步（双份实现）。当初的缺口是「**上游缺陷驱动的权宜实现缺少上游修复后的回收到期闭环**」。
- 回退后暴露两个上游不覆盖的点：`nue-link` **无焦点环**（两主题 `link.css` 均 0 处 `:focus-visible`）；主题类名只能由 `theme` 产出（`parseTheme` 按逗号切分，`iconLink`/`size` 两个便利 prop 在 `nue-link` 上不存在或未实现）。
- 另有一笔挂账：`v1.16.2` 看板分页引入的 `TaskKanban` 可选 prop `newTaskId`（命令通道）在 ADR `2026-11-01-kanban-column-paging.md` 决策 2 标注「待 arch 追认」。

## 决策

1. **上游修复即回收规避**：本仓不保留 `NaoRouterLink` 过渡包装，11 处 + `smart-list` 一律回到 `<nue-link route>`；规避件的**到期日 = 上游修复随版本进仓之日**。
2. **焦点环集中到项目主题层**：在 `apps/web/src/themes/link.css` 补**一条** `.nue-link:focus-visible` 规则（`outline: 2px solid var(--nue-primary-color-600); outline-offset: 2px`），不新增 token、不进组件 `scoped`、不给上游打 patch；该文件经 `@/themes` 同时供 Web 与桌面端。
3. **主题类名映射用对象语法**：需要 `route` + `route-icon` 同时命中的调用点写 `:theme="{ route: true, 'route-icon': true }"`；仅 `route` 的写 `theme="route"`。⛔ 禁止 `theme="route icon"`（空格不切分）与依赖 `size` prop 产出 `--route-<size>`（`nue-link` 的 `size` 声明未实现）。
4. **`newTaskId` 追认**：有条件接受「可选 prop 作命令通道」（条件 C-1…C-4 见评审 §6）——单向数据流未被破坏（只下传、无回写），且四个更轻备选均更差或不可行（重查整板丢分页 / 模板 ref 隐式调用 / 组件依赖全局总线 / 父级 inject 子级注册表方向不成立）。

## 理由

1. 业务匹配：规避件存在的唯一理由是上游缺陷；缺陷闭环后继续保留 = 每个链路样式改动都要改两处，且与上游分叉风险随版本增长。
2. 成熟度：`nue-link` 的路由形态已有上游 L-01…L-06 用例锁住（含 `href` 解析、无 `to` 残留、`disabled` 不可聚焦、`href` 形态逐字符零回归）。
3. 团队能力 / 成本：回退是「删代码」，不新增机制；焦点环一条 CSS 覆盖两端，成本 ≈ 1 个文件 + 1 条断言。
4. 可测：`href`/可聚焦/可访问名/SPA 点击均可用真实 router + 真实组件断言；焦点环在 jsdom 不可计算 ⇒ 源级断言 + 用户走查双证（不假装能测）。

## 对照过的备选模式

1. **维持现状（保留 `NaoRouterLink`）** —— 适用：上游长期不修，或我们需要上游没有的链接能力；代价：双份实现永久维护、样式分叉、每次 `nue-ui` 升级都要人工比对上厕所；**不采纳**：上游已修，双份实现正是本批要消除的东西。
2. **保留包装件但内部改写成 `nue-link` 薄壳** —— 适用：需要长期稳定的「便利 prop」层（`iconLink` / `size`）；代价：多一层多余抽象（单一用途包装），且 `parseTheme` 语义仍会漂移；**不采纳**：PRD R-A 明确不允许过渡包装。
3. **焦点环放组件 `scoped` / 每处调用点各写一份** —— 适用：只有 1–2 个调用点；代价：11 处 × N 份重复，漏一处即静默缺失；**不采纳**（PRD R-C 明确禁止）。
4. **给上游 `nue-ui` 提 patch / 覆写包内 CSS** —— 适用：我们有上游发布权且能长期维护；代价：主题包升级即失效，且引入「私有分支」；**不采纳**（本仓与上游是消费关系）。
5. **主题类名用字符串逗号语法 + 依赖 `size` prop** —— 适用：写法短；代价：空格/逗号写错**不报错**，`size` 完全无效 ⇒ 视觉回归型静默缺陷；**不采纳**。
6. **`newTaskId` 改为「整板重查」** —— 适用：分页无「保页」要求；代价：所有列回第 1 页，用户已加载位置丢失（可见回归，违 ADR 决策 4 / D2）；**不采纳**。
7. **`newTaskId` 改为模板 ref + `defineExpose`** —— 适用：编排天然命令式且调用点极少；代价：隐式调用、可测性下降、与既有 `KANBAN_COLUMN_PAGING_KEY` 双入口；**不采纳**。
8. **`newTaskId` 改为把 `subscriber` 下传、组件内自订阅** —— 适用：组件本就允许依赖应用级总线；代价：展示层引入全局总线耦合，脱离页面即失效；**不采纳**。

## 后果与风险

- 正面：删掉 1 个共享组件目录 + 8 处 import + 导出面；链接样式回归上游单一真源；顺带拿到 4 项跨版本 a11y/日期修复。
- 负面 / 风险：
    - `theme` 类名写错是**静默失败**（不报错、门禁全绿、只影响视觉）⇒ 必须以「类名断言 + 用户走查」兜住（评审 R1/R5）。
    - 焦点环改由项目主题层单点提供 ⇒ 该文件被误删/漏引即全站失环，需要源级断言守卫。
    - `switch` 升级后与 5 处自建 a11y **双实现**（同一元素上双 `keydown` 监听）⇒ 必须同批拆除，否则一次按键两次上抛。
    - 主题新增 `select.css` / `date-picker.css` / `message.css`（≈143 行）可能带来面板宽度/内边距位移（评审 R4）。
    - `newTaskId` 的「同值重复下发不触发」是**固有边界**，只能靠「新增 id 恒唯一」的前提守住；一旦前提不成立（撤销重建 / 离线重放）须改 `{ id, seq }`。

## 限制与已知边界

- 只覆盖 `nue-link` **路由形态**；非路由形态（`@click` 型伪链接）不因此获得键盘可达性 —— 本仓仍有 2 处（`focus-depend-dropdown` 的「专注」与「取消关联」），已按评审 R-G 登记缺陷池，不在本 ADR 范围。
- 只回收 `NaoRouterLink` 一族；`sign-in` / `sign-up` 的原生 `<router-link class="nue-link">` 互链**不在本批回收**（无用户可见缺陷，回收会把身份页纳入回归面），属挂账项。
- 焦点环为**项目主题层覆盖**，不追溯上游；上游若未来自带焦点环，需回到本 ADR 复查是否删除本仓规则。
- AC4 的焦点环**不能**由 jsdom 断言样式值，只做源级断言 + 真实渲染走查；不得以「用例绿」代替视觉确认。

## 连带同步清单（决策 4 收口原「待 arch 追认」挂账，属改变既有条款）

| 持有该结论的文档                               | 位置                                                                      | 处理                                                                                        | Owner         |
| :--------------------------------------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------ | :------------ |
| `docs/adr/2026-11-01-kanban-column-paging.md`  | `:16` 决策 2 「待 arch 追认」                                             | **已回写**：改为「arch 2026-11-02 追认：有条件接受」                                        | arch-designer |
| `docs/prds/2026-11-01-kanban-column-paging.md` | `:133-134` 偏差与遗留三出口                                               | **不回写**（历史快照）；追认结论以本 ADR 为准                                               | PM            |
| `docs/releases/v1.16.2.md`                     | `:40` 观察项                                                              | **不回写**（已发布文本，不改历史发版说明）；若需对外说明，写入下一个 Release 的「技术细节」 | PM            |
| `docs/reports/T622-qa-verification.md`         | `:95` 登记状态                                                            | **不回写**（历史验收记录）                                                                  | QA            |
| `docs/tasks-state.md`                          | 当前阶段 / 挂账栏                                                         | **待 PM 回写**：该挂账可标「已追认（2026-11-02）」                                          | PM            |
| 代码内契约说明                                 | `packages/presentation/task/components/kanban/types.ts` `newTaskId` JSDoc | **待 RD 补** 4 条条件（C-1…C-4），随 `T630` 或其他小单落地                                  | rd-fe         |

## 相关指针

- 评审报告（差异清单 · 风险 · 落地顺序 · 六个问答）：`docs/reports/T628-nue-ui-1153-arch-review.md`
- PRD：`docs/prds/2026-11-02-nue-ui-1.15.3-upgrade.md`
- 规避实现与其历史形态：`packages/shared/components/router-link/`（本批删除；历史版本见提交 `a514bc3e` / `f9daabf7`）
- 看板分页（决策 4 的上游）：`docs/adr/2026-11-01-kanban-column-paging.md`

## 参考来源

| 来源                                       | 链接 / 位置                                                                     | 访问日期   | 一句话结论                                                                               |
| :----------------------------------------- | :------------------------------------------------------------------------------ | :--------- | :--------------------------------------------------------------------------------------- |
| `NueLink` 源码（`v1.15.3`，含 `74667ab8`） | `/home/nathan/Projects/nue-ui/packages/components/link/link.vue`                | 2026-11-02 | 路由形态只绑 `to`；类名全部由 `theme` 产生；无 `iconLink`；`size` 声明未使用；无内联样式 |
| shadlike 主题 `link.css`                   | `/home/nathan/Projects/nue-ui/packages/themes/shadlike/src/components/link.css` | 2026-11-02 | **无 `:focus-visible`** ⇒ 焦点环须本仓补                                                 |
| `parseTheme`                               | `/home/nathan/Projects/nue-ui/packages/utils/component.ts`                      | 2026-11-02 | 字符串按**逗号**切分、对象按真值键 ⇒ 类名映射不能用空格                                  |
| 上游链接用例 L-01…L-06                     | `/home/nathan/Projects/nue-ui/packages/components/link/__tests__/link.test.ts`  | 2026-11-02 | 上游已锁 `href = router.resolve().href`、无 `to` 残留、`disabled` 不可聚焦               |
| `use-calendar`（`5da96222` 后）            | `/home/nathan/Projects/nue-ui/packages/hooks/use-calendar/index.ts`             | 2026-11-02 | date-only 按 `00:00` 只在「值无时刻段」兜底分支；空值仍取当前时刻                        |
| `parseDate`                                | `/home/nathan/Projects/nue-ui/packages/utils/date-utils.ts`                     | 2026-11-02 | 支持 ISO 变体 ⇒ `type="date"` 收 ISO 值不会退化为裸串                                    |
| 上游发版说明 `nue-ui 1.15.3`               | `/home/nathan/Projects/nue-ui/docs/releases/nue-ui-1.15.3.md`                   | 2026-11-02 | 无破坏性变更；`href` 与 route 并存时以 `href` 为准                                       |
| Vue Router `RouterLink` 属性语义           | 本仓既有实现与用例（`t603-nav-a11y`）                                           | 2026-11-02 | route 形态点击拦截 / `aria-current` / `href` 由 `RouterLink` 提供，回退不改变 SPA 行为   |