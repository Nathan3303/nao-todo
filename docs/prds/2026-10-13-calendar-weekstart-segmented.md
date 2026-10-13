# 2026-10-13 日历侧边栏「周起始」选择 UI 对齐「日/月/周」分段切换 PRD

> **状态**：**✅ 已交付并随 `v1.12.8` 发布**（2026-10-13 立项 · 2026-10-13 交付闭环；需求原话见 §1，三项口径见 §5 末，交付证据见 §8 末「交付结果」）。
> **依据**：用户 2026-10-13 在 PM 会话中的原话（「把日历界面侧边栏中的周起始的选择 UI 组件样式改为与『日月周』切换组件一致」）· 现状读码（`apps/web/src/components/calendar/view-switch.vue`、`apps/web/src/components/calendar/aside/aside.vue`）。
> **硬约束**：**移动端零改动**（`packages/presentation-react` / `apps/mobile`）· 周起始与视图切换的状态语义不变 · 不新增 `nue-*` token 或色板 · C 端界面原则（`AGENTS.md` / `DESIGN.md`）。

## TL;DR

- **做什么**：抽出通用「分段切换」展示层组件，让日历侧边栏「周起始」选择与「日/月/周」切换共用同一套滑块分段视觉与交互。
- **给谁**：使用日历页的用户（web + 桌面端；移动端不动）。
- **成功标准**：两处分段视觉/交互**单一来源**且逐项一致；「日/月/周」外观与行为**零变化**；全范围门禁全绿 + 用户视觉勾选通过。
- **不做什么**：不改周起始取值与持久化 · 不改侧栏其他控件 · 不改「日/月/周」路由语义 · 移动端 · 新色板。
- **为什么做**：同一侧栏内两组「多选一」控件视觉不同（一组滑块分段、一组描边按钮对），属交互一致性缺口，且样式靠人守 ⇒ 必然漂移。

## 1. 问题证据

- 现状：侧栏顶部「日/月/周」= `view-switch.vue` 的 `segmented` 态（`nue-button-group.cal-view-toggle` + **滑块指示器** `.cal-view-thumb` + 等分透明按钮，槽底 8% 混合色，选中加粗）。
- 对照：「周起始」= `aside.vue` 内联 `.weekstart-row`（文字标签 + `.weekstart-toggle` 1px 描边内两个 `nue-button`，选中态 9% 底色加粗）——**无滑块**，非同一套视觉。
- **5 Whys**：
    1. 为什么不一致 ⇒ 两处各自手写样式，无共用件。
    2. 为什么没共用 ⇒ T445 ① 加「日/月/周」时它是路由切换专用件（3 项硬编码 + `compact` 兜底态）；「周起始」属更早的 CAL-06 行内实现，只做了外观近似。
    3. 为什么必然再漂移 ⇒ 「样式一致」靠人守、无单一来源；T447/T448 改「日/月/周」分段样式（滑块 Tab + `nue-*` token 根因修复）时「周起始」不会随之更新。
    4. 为什么值得修 ⇒ 侧栏是进入日历必读面板，同类控件外观不同提高辨识成本；任何后续分段调整都要改两处。
    5. 根因 ⇒ 缺少「分段切换」这一展示层通用组件。

## 2. 目标指标

- **中间指标**：`apps/web` 内「分段切换」实现 = **1 处**；两处渲染的类名 / token / 滑块几何逐项一致。
- **成功口径**：`vp check` 0 error · 全仓 `vp test` 0 红 · 5 个守卫 rc0 · 双端 build rc0 · 移动端 diff 0 · 用户视觉勾选通过。
- **业务量化指标**：不适用（微交互一致性项，无独立业务量可测）。

## 3. 范围 / 非范围

**做**

- 新增展示层通用「分段切换」组件（落 `apps/web/src/components/calendar/`；N 段通用：等分宽 + 滑块指示器 + 选中/hover 态 + `prefers-reduced-motion` 降级 + `role="group"`/`aria-pressed`）。
- `view-switch.vue` 的 `segmented` 态改为复用该组件，且**外观与行为零变化**（3 段等分、滑块 0/100%/200%、文案、路由切换）。
- `aside.vue`「周起始」改为复用该组件：2 段（周日 / 周一），选中态由 `weekStart` 驱动、点击调 `setWeekStart`；**保留左侧「周起始」标签**；**宽度自适应不铺满**。
- 新增 i18n 键**三处齐备**（`types.ts` / `zh-CN.ts` / `en-US.ts`）：组标签 + 两项文案。
- 测试：新增分段组件用例（N=2/N=3 等分与平移、`aria-pressed`、点击上抛、动效降级 CSS 存在）；`aside` 侧补「周起始 = 分段控件 + 点击调 `setWeekStart` + 选中态随 `weekStart` + 中英文案」。

**非范围**

- 周起始的取值 / 持久化 / 重排语义（`CALENDAR_WEEKSTART`、`weekStart`、`setWeekStart`）保持不变。
- 「日/月/周」的路由真源、`taskId`/query 透传、`compact` 兜底态的行为。
- 侧栏其他内容（两个 checkbox、清单 / 标签 smart-list）与整体布局。
- 移动端（红线）· 服务端 · 新 `nue-*` token / 色板 / 设计体系。

## 4. 用户场景

- **场景卡**：进入日历页（侧栏展开，顶部为「日/月/周」分段）→ 视线下移到「隐藏已完成 / 专注徽标 / 周起始」→「周起始」右侧 2 格滑块，当前口径（如周一）以浮起滑块 + 加粗标示 → 点「周日」→ 滑块平移、日历网格按周日重排（既有行为不变）。
- **关键路径**：侧栏（`CalendarAside`，teleport 到 `#SubPageAsideTeleportSlot`）→ 分段组件（纯展示，不持状态）→ `CALENDAR_VIEW_CONTEXT_KEY` 的 `weekStart` / `setWeekStart`。
- **页面状态清单**：**异步态不适用**（纯展示、同步控件，无 loading/empty/error）；需覆盖 = 选中「周日」态 / 选中「周一」态 · 侧栏显示态（控件仅在侧栏显示时存在）· 中英文案 · `prefers-reduced-motion` 开与关。

## 5. 业务规则

- **单一来源**：分段视觉与交互只在新增组件内定义一处；两个调用方不得再各写分段样式（防漂移）。
- **令牌**：只用既有 `nue-*` token；**禁引 `--cal-*`**（侧栏在日历令牌组 `.nue-calendar-host` 之外 ⇒ 会全量失效，T448 根因不得回归）。
- **两处只允许两轴不同**：段数（2 / 3）与宽度策略（自适应 / 铺满）；其余（槽底色、圆角、指示器底色与描边、选中字重与字色、未选中字色、hover 反馈、平移动效）必须完全一致。
- **零行为变更**：「日/月/周」的切换结果与「周起始」的持久化/重排结果均与现状逐字一致。
- **可辨性三重冗余**：滑块位置 + 字重 + `aria-pressed`（不得只靠颜色，`DESIGN.md` §5）。
- **已拍板口径（用户 2026-10-13）**：① 实现方式 = **抽公共「分段切换」组件**（非复制样式）；② 布局 = **标签在左 · 右侧 2 格小滑块 · 宽度自适应不铺满**；③ **一并补 i18n**（中英 + 类型三处齐备，顺带修掉英文界面显示中文的既有小缺口）。

## 6. NFRs

- **组件 / 令牌**：复用 `nue-button` 与既有 `--nue-*` token；新增件属 `apps/web` 展示层内部通用组件，**不构成新设计体系**（样式 100% 由既有 token 组合；已以「抽公共组件」报用户批准）。
- **可访问性**：`role="group"` + `aria-label`（走 i18n）；每段 `aria-pressed`；键盘 Tab 可达 + focus 可见；指示器 `aria-hidden` 装饰性。
- **动效**：180ms 平移；`prefers-reduced-motion: reduce` 下取消过渡。
- **对比度**：沿用既有 token（已达标）；⛔ 不引入新色值。
- **移动端红线**：`packages/presentation-react` / `apps/mobile` diff = 0。

## 7. AC（五覆盖）

- **AC1 主路径·单一来源**：Given 代码库，When 检索分段切换实现，Then 滑块分段视觉/交互仅在 **1 处**组件内定义，`view-switch.vue`（segmented）与 `aside.vue`（周起始）均引用它，两处不再各自定义分段样式。
- **AC2 主路径·周起始交互**：Given 侧栏显示且 `weekStart === 'monday'`，When 点击「周日」段，Then 调用 `setWeekStart('sunday')`、选中态与滑块位置移到「周日」、「周一」段失活。
- **AC3 一致性·外观逐项相同**：Given 同一侧栏内两处控件，When 比对，Then 槽底色 / 圆角 / 指示器底色与描边 / 选中字重与字色 / 未选中字色 / hover 反馈 / 平移动效逐项一致；唯一差异 = 段数与宽度策略。
- **AC4 边界·滑块几何**：Given 分段组件，When 段数 N=2，Then 指示器宽 = 容器 1/2、位移 0% / 100%；When N=3，Then 1/3、位移 0% / 100% / 200%。
- **AC5 负向闭环·「日/月/周」零回归**：Given 重构后的 `view-switch.vue`，When 跑既有 `view-switch.test.ts`、`view-switch-keeps-taskid.test.ts`、`aside.test.ts`，Then 全绿；中英文案 / 选中态随 `current` / 点击上抛子路由名 / 滑块平移 / `taskId` 透传 / `--cal-*` 零引用等**行为断言一条不得删除**，仅允许把「类名 · `data-testid` · CSS 归属文件」选择器改为新组件对应物。
- **AC6 异常 / 可访问性**：Given 键盘用户，When Tab 聚焦周起始两段并 Enter/Space，Then focus 可见、触发的效果同 AC2；组具 `aria-label`、两段 `aria-pressed` 正确；`prefers-reduced-motion` 开启时无过渡动画。
- **AC7 设计一致性·i18n + 说人话**：标签在左、2 格滑块在右且宽度自适应不铺满；文案中英齐备（zh 周起始 / 周日 / 周一；en Week starts on / Sunday / Monday）、`LocaleKey` 三处齐备且零死键；⛔ 界面不得出现内部键名/术语（如 `weekStart`、`sunday`）。

## 8. 上线闭环

- **立项**：建 Issue（TL;DR / AC 编号 / 优先级 / 本文件指针；正文留在 `docs/`）；本文件落 `docs/prds/`。
- **分支 / PR**：`feat/<issue-id>-calendar-weekstart-segmented` → PR（squash 合并，RD 执行；PM 只验收授权）。
- **门禁（worker 自跑并回执精确数字）**：`vp check` 0 error · 全仓 `vp test`（文件 / 例 / 红数）· 5 个守卫（`guard:ddd` / `guard:barrel-imports` / `guard:mobile-imports` / `guard:test-location` / `guard:gate-pathspec`）rc0 · `webapp build` + `desktop:build` rc0 · 移动端 diff 0。
- **发布**：SemVer **PATCH**（root / `apps/web` / `apps/desktop` `1.12.7 → 1.12.8`；`packages/shared` 因新增 i18n 键 PATCH）——依据：同类小件 T504 / T505 分别随 `v1.12.6` / `v1.12.7` 以 PATCH 发布；发版时机沿用「新需求做完统一发一次版」（用户定）。
- **视觉验收**：由用户按可勾选清单执行（两处观感一致 / 滑块平移 / 标签位置 / 中英文案 / 键盘 focus）。

## 9. 变更治理

- 范围 / AC 变更须 PM 书面同意，并回写本文件 + `docs/tasks-state.md`。
- 仅 `apps/web` 展示层：不改服务端契约、不改移动端、不改周起始与视图切换的状态语义。
- **优先级**：战略筛子**通过**（交互一致性 ⇒ 降低辨识成本，间接服务任务闭环效率；用户直接提出）· 壁垒 1/5 · 不做不构成 3 个月流失 ⇒ 低分小件，按用户诉求纳入 · MoSCoW = **Should** · Kano = 一元属性（线性满意度，小成本纳入）· RICE（Reach 归一 1 = 日历页全部用户 · Impact 0.5 · Confidence 1.0 · Effort 0.5 人天）⇒ **RICE = 1**。