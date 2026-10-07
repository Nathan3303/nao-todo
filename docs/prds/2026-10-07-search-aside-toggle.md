# 2026-10-07 搜索页侧边栏收起 / 展开按钮 PRD

> **状态**：**✅ 已交付并随 `v1.12.6` 发布**（2026-10-07 立项 · 2026-10-07 交付闭环；需求原话见 §1，交付证据见 §8 末「交付结果」）。
> **依据**：用户 2026-10-07 在 PM 会话中的原话 · 现状读码（`apps/web/src/views/index/search/*` 与全站 10 处同类入口）。
> **硬约束**：**移动端零改动**（`packages/presentation-react` / `apps/mobile`）· 不改搜索业务逻辑与服务端契约 · 不新增 `nue-*` token 或组件 · C 端界面原则（`AGENTS.md` / `DESIGN.md`）。

## TL;DR

- **做什么**：在搜索页「搜索栏**左侧**」新增收起 / 展开侧边栏按钮，行为与任务 / 番茄 / 日历 / 设置页完全一致。
- **给谁**：使用搜索页的用户（web + 桌面端；移动端不动）。
- **成功标准**：全范围门禁全绿（精确数字）+ 用户视觉勾选通过。
- **不做什么**：其他页面改动 · 搜索业务逻辑 · 侧栏折叠态持久化 · 移动端 · 新 token / 新组件。
- **为什么做**：搜索页是**唯一缺失该入口**的主页面（全站其余 10 处均已有），属交互一致性缺口。

## 1. 问题证据

- 搜索页于 v1.7.8 完成侧栏化（快捷搜索 / 常用搜索 / 最近搜索常驻左侧栏），但**页面内没有任何收起 / 展开入口**。
- 全站同类入口共 **10 处**（任务 3 · 番茄 1 · 日历日 / 周 / 月 3 · 设置 3），统一走 `inject(INDEX_VIEW_CONTEXT_KEY)` 的 `switchDisplayAside`；`views/index/search/` 与 `components/search/` 下 `menu-close` / `menu-open` **0 命中**。
- `apps/web/src/views/index/search/search-view.ts` **已经返回** `switchDisplayAside` / `isDisplayAside` / `isUseFloatAside`，但 `entry.vue` 只取其 5 项（`init` / `isLoading` / `error` / `savedSearch` / `searchHistory`）⇒ **能力已在、入口缺失**。
- 影响：用户只能切到别的页面收起侧栏再回来，与全站交互不一致。

## 2. 目标指标

- **中间指标**：搜索页出现与全站一致的切换按钮；点击后左侧栏在 **300px（含子侧栏）↔ 70px（图标轨道）** 间切换，搜索子侧栏随之显示 / 隐藏。
- **成功口径**：`vp check` 0 error · 全仓 `vp test` 0 红 · 双端 build rc0 · 移动端 diff 0 · 用户视觉勾选通过。
- **业务量化指标**：不适用（微交互，无独立业务量可测）。

## 3. 范围 / 非范围

**做**

- 搜索页工具栏搜索栏左侧新增切换按钮：`nue-button` + `theme="icon,ghost"` + `:icon="isDisplayAside ? 'menu-close' : 'menu-open'"`。
- 工具栏行改 flex（按钮 `flex: none`、输入框 `flex: 1`），按钮与输入框同排垂直居中。
- 无障碍：按钮带 `title` + `aria-label`；新增 i18n 键（收起 / 展开）三处齐备（`types.ts` / `zh-CN.ts` / `en-US.ts`）。
- 组件测试：锁「按钮存在 · 点击调用切换 · 图标与可访问名随状态」（`views/index/search/__tests__/`）。

**非范围**

- 其他页面任何改动（含应用级左栏 `aside-v2` 自身布局与 `nue-separator` 行为）。
- 搜索业务逻辑（引擎 / 筛选 / 历史 / 常用搜索 / URL 同步）。
- 侧栏折叠态持久化（沿用现状：进入搜索页默认展开，卸载不复原记忆）。
- 移动端（红线）· 新增 `nue-*` token 或组件 · 服务端。

## 4. 用户场景

- **场景卡**：进入搜索页（侧栏展开，快捷 / 常用 / 最近搜索可见）→ 点搜索栏左侧按钮 → 左栏收为 70px 图标轨道、搜索子侧栏隐藏、结果区变宽 → 再点 → 原样展开。
- **关键路径**：搜索页工具栏（按钮）→ 应用级左栏显示态（`nue-aside` 的 `v-model:displayed`）→ 子侧栏 teleport 槽位显隐。
- **状态清单**：展开态 / 收起态 · 窄屏（抽屉态 `isFloating`）· 键盘 Tab 聚焦与激活 · 中英文案。

## 5. 业务规则

- **单一真源**：复用 `INDEX_VIEW_CONTEXT_KEY` 的 `switchDisplayAside` / `isDisplayAside`（与全站 10 处同源）；禁新增状态、禁 module 单例。
- **语义与其他页面完全一致**：收起 = 左栏 300px→70px 图标轨道且子侧栏隐藏；展开 = 还原；宽度上下限与分割线拖拽行为不变。
- **按钮自身两态恒可见**，仅图标与可访问名随状态切换（视觉与读屏均可辨）。
- **不持久化**：与现状一致（搜索页挂载时调 `setControllOption({ useSlot: true, useDrawerSlot: true })` ⇒ 进入即展开）。

## 6. NFRs

- **组件 / 令牌**：沿用 `nue-button`（`theme="icon,ghost"`）与既有 `--nue-*` token；⛔ 不新增 token / 组件。
- **可访问性**：原生 `button` 可 Tab 聚焦、focus 可见；`title` + `aria-label` 中英齐备；图标语义由可访问名承载（不裸图标）。
- **对比度**：沿用 `ghost` 态既有 token（已达标），⛔ 不引入新色值。
- **移动端红线**：`packages/presentation-react` / `apps/mobile` diff = 0。

## 7. AC（五覆盖）

- **AC1 主路径·收起**：Given 搜索页且侧栏展开，When 点击搜索栏左侧按钮，Then 左栏收为 70px 图标轨道、搜索子侧栏隐藏，且按钮图标变为 `menu-open`。
- **AC2 主路径·展开**：Given 收起态，When 再次点击，Then 左栏展开还原（子侧栏回来），按钮图标变为 `menu-close`。
- **AC3 无障碍 / 键盘**：Given 键盘 Tab 聚焦该按钮，When 聚焦或激活，Then focus 可见、Enter/Space 行为同 AC1；`title` / `aria-label` 随态切换且中英文案正确。
- **AC4 边界·窄屏**：Given 窄屏（`isFloating` 抽屉态），When 点击按钮，Then 走响应式抽屉开关，无报错、无布局破损。
- **AC5 负向闭环·业务零影响**：Given 已输入关键词或已设筛选，When 收起再展开，Then 关键词、筛选、结果数、URL query、常用搜索与历史均不变；其他页面 10 处按钮行为不变。
- **AC6 设计一致性**：按钮位置（搜索栏左侧同排）、图标集与样式与任务 / 番茄 / 日历 / 设置页一致；面向用户文案说人话（⛔ 无内部术语）。

## 8. 上线闭环

- **立项**：新建 Issue（TL;DR / AC 编号 / 优先级 / 本文件指针；正文留在 `docs/`）。
- **分支 / PR**：`feat/<issue-id>-search-aside-toggle` → PR（squash 合并，RD 执行；PM 只验收授权）。
- **门禁（worker 自跑并回执精确数字）**：`vp check` 0 error · 全仓 `vp test`（文件 / 例 / 红数）· 五个守卫（`guard:ddd` / `guard:barrel-imports` / `guard:mobile-imports` / `guard:test-location` / `guard:gate-pathspec`）rc0 · `webapp build` + `desktop:build` rc0 · 移动端 diff 0。
- **发布**：SemVer **MINOR**（root / webapp / desktopapp；`packages/shared` 因新增 i18n 键 ⇒ PATCH）· tag 指向 main 合并提交 · Release 说明含面向用户「本次更新」段。
- **视觉验收**：由用户按可勾选清单执行（位置 / 图标 / 两态 / 中英文案）。

**交付结果（2026-10-07）**

- 代码 PR **#178 已 squash 合并** ⇒ main `46d67f9b`（本需求恰好 1 条提交、无 `wip()`；5 文件 + 2 文档）
- 发版 PR **#179 已 squash 合并** ⇒ main `57886c27`（7 文件：4 个 `package.json` + `CHANGELOG.md` + `docs/releases/v1.12.6.md` + 台账）
- **注解 tag `v1.12.6`**（tag 对象 `c9e8bd07` → peeled `57886c27`）· Release 已发布（非 draft / 非 prerelease；8 项产物；三份 `latest*.yml` 版本号均 `1.12.6`；正文与 `docs/releases/v1.12.6.md` **逐字同源**）
- 门禁：`vp check` 0 error · 全仓 `vp test` **230 文件 / 1806 例 / 0 红** · 5 个守卫 rc0 · 双端 build rc0 · 移动端 diff 0 · 本单 4/4；PR CI（#178 / #179）`check` + `test` 双 success；tag 构建 workflow success（3m36s）
- AC 验收：**AC1–AC6 全过**（AC4 的抽屉动画与像素观感由用户视觉走查确认 —— 用户 2026-10-07「视觉检验通过」）

## 9. 变更治理

- 范围 / AC 变更须 PM 书面同意，并回写本文件 + `docs/tasks-state.md`。
- 仅搜索页展示层：不改服务端契约、不改移动端、不改搜索引擎语义。
- **优先级**：战略筛子通过（服务检索效率 · 与全站交互一致性相关 · 不阻塞既有交付）· MoSCoW = **Should** · RICE（Reach ≈ 搜索页全部用户 · Impact 1 · Confidence 1.0 · Effort 0.5 人天 ⇒ 得分 2，属小件）。