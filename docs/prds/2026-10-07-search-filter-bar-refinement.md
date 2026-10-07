# 2026-10-07 搜索筛选栏细化 PRD（① 移除 excluded 开关 · ② archived 补标签 · ③ 下拉项间隙 · ④ 触发器已选显示）

> **状态**：**待开工确认**（2026-10-07 立项；用户原话见 §1，四项口径按 §3.1 裁决执行）。
> **依据**：用户 2026-10-07 原话 · 现状读码（`apps/web/src/components/search/*` · `apps/web/src/themes/dropdown.css` · `nue-ui@1.13.0` 的 `NueSwitch` 与 `nue-dropdown--menu` 主题样式）· 2026-10-07 需求澄清四项裁决。
> **硬约束**：**移动端零改动**（`packages/presentation-react` / `apps/mobile`）· 不改服务端契约与搜索算法语义（除 ① 的客户端契约字段移除）· 不新增 `nue-*` token / 组件 · C 端界面原则（`AGENTS.md` / `DESIGN.md`）。

## TL;DR

- **做什么**：搜索筛选栏四项细化 —— ① 移除「纳入已删除/已放弃」开关（连引擎 / URL / 常用搜索一起）② 给「包含已归档」开关补可见文字标签与键盘 / 读屏可达 ③ 所有下拉菜单项间隙收紧一档 ④ 下拉触发器改显示「已选名称」而非裸数字。
- **给谁**：使用搜索页的用户（web + 桌面端；移动端不动）。
- **成功标准**：全范围门禁全绿（精确数字）+ 用户视觉走查通过（③ 影响面横跨任务 / 日历，需对照）。
- **不做什么**：不改搜索算法与服务端 · 不加「已选筛选 chips 汇总行」（候选 S11 仍不做）· 移动端 · 新 token / 新组件。
- **为什么做**：① 该开关当前**无任何文字**（组件忽略默认插槽）几乎不可理解，且与「已删除任务不该被搜到」的直觉冲突；④ 触发器只给裸数字，用户看不出选了什么。

## 1. 问题证据

- **用户原话四条**：①「移除 excluded 的 switch」②「archived 的 switch 增加 label」③④「下拉列表中 Item 之间的间隙小一档，并且优化下拉列表按钮中的已选文本显示」。
- **①② 根因（读码确证）**：`NueSwitch`（`nue-ui@1.13.0`）只渲染 `circle` / `text` 两个具名插槽，**默认插槽被静默丢弃**；而 `search-filter-bar.vue`（L244–262）把两处文案写在默认插槽里 ⇒ **界面上两个开关完全没有文字**，只是两个无法理解的拨片。
- **③ 定位**：项间隙来自主题 `.nue-dropdown--menu > .nue-div--block { gap: var(--nue-gap-xs) }`；本仓 `apps/web/src/themes/dropdown.css` 只覆盖了 `padding: 0`、**未覆盖 gap** ⇒ 收紧一档 = `--nue-gap-xs → --nue-gap-2xs`。
- **③ 影响面（arch 评审更正）**：`theme="menu"` 的**下拉**共 **7 个组件 / 11 处**（任务·标签 / 清单 / 内建清单筛选 · 任务侧栏 · 日历月视图排序 · 搜索筛选栏 ×4 · 搜索侧栏 ×2）⇒ 视觉变化横跨任务与日历页，需在视觉走查中对照。⚠️ 原记「8 组件 13 处」把 **2 处 `nue-collapse theme="menu"`**（`calendar/aside` · `search/aside`）误计入 —— 其样式为 `.nue-collapse--menu`、**不含 `nue-dropdown` 类**，不被本选择器命中。
- **④ 现状**：四处触发器均为「维度名 + 裸数字」（如「优先级 2」，见 L67–88 等）。`filter-count`（圆形计数徽标）与 `filter-trigger--active`（激活底色）是 `b874ec4e` 初版设计，后被 `cca0c161`（用户样式提交）撤掉、样式留存为**死 CSS** ⇒ 本项是**新设计决策**，非恢复回归。

## 2. 目标指标

- **中间指标**：筛选栏无「无字开关」；开关可键盘操作且读屏可辨状态；下拉项间隙明显更紧；触发器一眼能看出「选了什么」。
- **成功口径**：`vp check` 0 error · 全仓 `vp test` 0 红 · 5 守卫 rc0 · 双端 build rc0 · 移动端 diff 0 · 用户视觉走查通过。
- **业务量化指标**：不适用（交互与信息表达优化，无独立业务量可测）。

## 3. 范围 / 非范围

**做**

- ① 彻底移除 `includeExcluded` 能力：UI + 引擎 + URL + 常用搜索 / 快捷预置 + i18n 死键 + 相关测试（逐项清单见 §5）。
- ② 「包含已归档」开关补**可见文字标签**（开关右侧兄弟元素）+ a11y（`role="switch"` / `aria-checked` / `tabindex` / Enter·Space 可切换 / 点文字也可切换）。
- ③ `apps/web/src/themes/dropdown.css` 的 `--menu` 分块 gap：`--nue-gap-xs → --nue-gap-2xs`（**全局**，一处改动全站生效）。
- ④ 四个触发器改显示「维度名 + 已选名称」；>2 项折叠为「前 2 项 +N」；标签项带色点；超宽省略。

**非范围**

- 「翻找已删除 / 已放弃任务」的替代入口（① 之后无 UI 可达，属产品决定）—— ⭐ 已按用户 2026-10-07 确认**登记产品待办**（未派单，见 `docs/tasks-state.md`）。
- 候选 S11「工具栏下方已选 chips 汇总行」（另立单）。
- 其他页面的业务逻辑与开关（③ 只改全局样式 token 值，不改任何组件结构）。
- 移动端 · 服务端 · 新 token / 新组件 · 「清空筛选 / 保存为常用搜索」按钮行为。

## 4. 用户场景

- **场景卡**：进搜索页 → 打开「优先级」→ 勾「高」「中」→ 触发器立即显示「优先级 高、中」；勾第 3 个 ⇒ 显示「优先级 高、中 +1」；「包含已归档」开关旁有文字，可 Tab 聚焦、空格切换。
- **关键路径**：筛选栏触发器（展示）→ 下拉面板（勾选）→ 引擎（过滤）→ 结果区。
- **状态清单**：未选 / 单选 / 2 项 / ≥3 项（折叠）· 标签带色点 · 长名称省略 · 明暗双主题 · 键盘聚焦态。

## 5. 业务规则

- **① 移除面（单一清单，逐项做完；arch 评审逐点确认 + 已补 4 项遗漏）**：`search-filter-bar.vue`（开关 + prop + emit + 类）· `views/index/search/entry.vue`（绑定）· `components/search/use-search.ts`（ref / `queryState` / `applyQuery` / `watch` / sweep 入参 / rows 传参 / 导出）· `search-query.ts`（state 字段 + `EXCLUDED_ON` 常量 + URL 序列化与解析 + 等值比较）· `search-tasks.ts`（option；过滤**恒**排除已删除 / 已放弃）· `saved-search.ts`（序列化字段）· `quick-search.ts`（预置字段）· 三处 locales（`search.includeExcluded` 死键删除）· 相关测试。
    - **补漏 1（必删死码）**：`use-search.ts` 的 `ROOT_STATUS_VARIANTS_INCLUDED` 仅被 `sweepRootsInto` 使用、无外部引用 ⇒ 删除，并把 `variants` 分支简化为单变体（恒 `DEFAULT`）。
    - **补漏 2（必删死 UI + 死键）**：`entry.vue` 中 `row.task.isDeleted` / `isGivenUp` 两处行内徽标变**不可达死 UI**；`search.state.deleted` / `search.state.givenUp` 两个 locale 键**仅此两处使用** ⇒ 一并清理。⚠️ **`search-row__badge--excluded` 样式必须保留** —— archived 徽标仍在用，**勿按类名删 CSS**。
    - **补漏 3（常量与注释漂移）**：`EXCLUDED_ON` 显式列入删除项；`search-query.ts` 头注与 `ARCHIVED_ON` 的「镜像 `EXCLUDED_ON`」注释同步更正。
    - **补漏 4（测试面 = 10 文件，非「相关测试」四字）**：`search-query.test.ts` · `search-tasks.test.ts` · `saved-search.test.ts` · `quick-search.test.ts` · `use-saved-search.test.ts` · `aside.test.ts` · `aside-toggle.test.ts` · `search-include-archived.baseline.test.ts`（**以其为比较锚点的 `search.state.deleted` 断言须连带改**）· `search-include-archived.wiring.test.ts` · infra `local-task-archive-search.baseline.test.ts`（仅注释）。
    - **已核实无遗漏（arch）**：`GetTasksOptions` / infrastructure / 服务端均无该字段（引擎排除靠 `buildRootQuery` 的 `isDeleted` / `isGivenUp` 变体）⇒ **无服务端契约变更**；无请求 / 结果缓存 key 含它（`sessionCache` 不按 query 分键）；`use-saved-search` 无查询去重口径；URL 无其它读取点。
    - **中间态已评估并否决**：保留 URL 解析但恒 `false` **不改善兼容**（行为等同），却留下死路径 / 常量 / 测试并造成序列化与等值比较两难 ⇒ 采纳**彻底移除**（代价：无）。
- **① 向后兼容（硬要求，arch 评审确认成立）**：旧 URL（`?excluded=1`）与 localStorage 内**旧常用搜索**携带的该字段**一律忽略、不得报错**（无迁移、无提示、无残留 UI）。机制已核实：`parseSearchQuery` 移除读取后**根本不读**该参数、`searchQueryEquals` 两侧都不含该字段 ⇒ **不触发 replace**（参数惰性残留在地址栏，属可接受）；`saved-search.ts` 的 `normalizeQuery` **逐字段显式构造、从不 spread raw** ⇒ 旧键静默丢弃、读路径不回写。⛔ **不加「写回清字段」**（会引入加载时一次 replace navigation，收益仅 URL 美观）。⚠️ 措辞更正：`search-history.ts`（关键词历史）**只存字符串**、从不存 query state ⇒ 原「历史里携带该字段」**并不存在**，非兼容项。
- **② 开关**：文字沿用既有 `search.includeArchived` 键；切换只走既有 `toggleArchived` emit；键盘 Enter / Space 与点击文字等价；⛔ **不改 `nue-switch` 组件本身**（用兄弟元素 + 属性透传实现）。
- **③ 只改 gap 值**：不动 `padding` / 项高 / 字号 / 圆角 / 阴影 / 动画；⛔ 不新增 token。
- **④ 名称解析在筛选栏本地完成**（复用既有 `projectOptions` / `tagOptions` / `priorityOptions` / `stateOptions`）⇒ ⛔ 不改引擎、不新增状态；顺序按各维度选项顺序；维度与名称之间用「：」或空格、多项之间用「、」（最终形态由视觉走查定稿）。
- **④ 折叠规则**：≤2 项全显；≥3 项显示前 2 项 + `+N`（N = 剩余项数）；触发器设最大宽度 + 省略号，不得撑破工具栏。
- **④ 可访问名** = 可见文本（含已选名称）；保留 `aria-expanded`；⛔ 不再使用「仅计数」的 `aria-label`。

## 6. NFRs

- **组件 / 令牌**：沿用 `nue-button` / `nue-switch` / `nue-dropdown` 与既有 `--nue-*` token（gap / padding / text）；⛔ 不新增 token / 组件 / 色值。
- **可访问性**：开关键盘可达 + `role="switch"` + `aria-checked`；触发器保留 `aria-expanded`、可访问名反映已选内容；不改动其他组件的 a11y 行为。
- **视觉一致性**：③ 为全局统一值 ⇒ 任务 / 日历 / 搜索三处下拉观感需一致（列入视觉走查清单对照）。
- **移动端红线**：`packages/presentation-react` / `apps/mobile` diff = 0。
- **已知上游缺口（登记，不在本单修）**：`NueSwitch` 默认插槽静默丢弃 + 组件自身缺 `role` / `aria-checked`（本单用兄弟元素 + 属性透传规避，上游侧入缺陷池）。

## 7. AC（五覆盖）

- **AC1 ① 主路径**：Given 搜索页筛选栏，When 观察，Then 不再存在「纳入已删除/已放弃」开关；且 **URL / 常用搜索 / 快捷预置任何路径都无法**让结果纳入已删除 / 已放弃任务。
- **AC2 ① 兼容（边界）**：Given 旧链接 `?excluded=1` 或含该字段的旧常用搜索，When 打开搜索页，Then 页面正常渲染、无报错、结果不含已删除 / 已放弃（字段被忽略）。
- **AC3 ② 主路径 + 无障碍**：Given 筛选栏，When 观察 / 操作，Then「包含已归档」开关右侧有可见文字「包含已归档」；**点击文字可切换**；Tab 可聚焦、Space / Enter 可切换；开关暴露 `role="switch"` 与正确的 `aria-checked`（随态翻转）。
- **AC4 ③ 全局一致性**：Given 任意 `theme="menu"` 下拉（搜索栏 / 任务筛选 / 日历经排序），When 展开，Then 项间间隙为 `--nue-gap-2xs`，其余（内边距 / 项高 / 字号 / 圆角）不变。
- **AC5 ④ 主路径**：Given 某维度已选 1 / 2 / ≥3 项，When 观察触发器，Then 分别显示「维度名 名称」「维度名 名称A、名称B」「维度名 名称A、名称B +N」；标签项带色点；未选时只显示维度名。
- **AC6 ④ 边界**：Given 名称很长或某维度近乎全选，When 观察，Then 触发器文本省略且**不撑破工具栏**（同行「清空筛选 / 保存为常用搜索」不被挤出）。
- **AC7 负向闭环**：Given 已输入关键词与已设筛选，When 完成上述四项操作，Then 关键词 / 结果数 / URL 中其余维度 / 常用搜索数据**均不变**；其他页面业务逻辑零改动（③ 仅视觉）。

## 8. 上线闭环

- **立项**：Issue（TL;DR / AC 编号 / 优先级 / 本文件指针；正文留 `docs/`）。
- **架构评审（已完成）**：① 变更了客户端**持久契约字段**（URL 查询参数 + localStorage 常用搜索）⇒ 已由 `arch-designer` 复核：**① 有条件可行**（条件 = 本文件按评审结论已修订：③ 数字更正 · 补漏 1–4 纳入）· **③ 可行**（无布局假设被破坏；保持全局、不做局部覆盖）· 中间态已否决。
- **ADR**：结论落 `docs/adr/2026-10-07-search-filter-refine.md`（由 arch 撰写、与立项 docs PR 同批入库）。
- **分支 / PR**：`feat/<issue-id>-search-filter-refine` → PR（squash 合并，RD 执行）。
- **门禁（worker 自跑并回执精确数字）**：`vp check` 0 error · 全仓 `vp test`（文件 / 例 / 红数）· 5 守卫 rc0 · `webapp build` + `desktop:build` rc0 · 移动端 diff 0。
- **发布**：PATCH（`1.12.7`）· tag 指向 main 合并提交 · Release 说明含面向用户「本次更新」段。
- **视觉验收**：由用户按可勾选清单执行（含 ③ 的**跨页面一致性对照**与 ④ 的折叠 / 省略形态）。

## 9. 变更治理

- 范围 / AC 变更须 PM 书面同意，并回写本文件 + `docs/tasks-state.md`。
- ① 变更了 URL 与 localStorage 的持久契约：兼容口径 = **忽略旧字段**（无迁移）；将来若要恢复「纳入已删除 / 已放弃」能力，须重走本文件并评估兼容。
- **架构评审留痕（2026-10-07，`arch-designer`）**：①「有条件可行」· ③「可行」· 中间态否决 · ③ 影响面更正为 7 组件 11 处 · 补漏 4 项已纳入本文件。
- **优先级**：战略筛子通过（信息可理解性 · 与全站下拉一致性 · 不阻塞既有交付）· MoSCoW = **Should** · RICE（Reach ≈ 搜索页全部用户 · Impact 1 · Confidence 1.0 · Effort 1.5 人天 ⇒ 得分 0.67，属小件）。