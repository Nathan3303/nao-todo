# ADR 2026-09-22 日历三视图路由可行性与头部/容器布局基线（T68）

- **状态**：✅ **已拍板**（2026-09-22 用户裁决：**D1=(a) 三子路由**；D2–D7 全部采纳架构建议）→ 实现单 **TASK-18**，PRD `docs/prds/2026-09-22-calendar-three-view-routes-and-layout-baseline.md`
- **编号**：T68（TASK-18 第 1 单）；诊断报告：`docs/reports/T68-calendar-three-view-routing-and-header-layout-diagnosis.md`
- **关联**：TASK-16 日视图（ADR `2026-09-21-calendar-day-view-geometry-and-lane-extraction.md` C14/A3）、TASK-17 日视图头部对齐（PRD `docs/prds/2026-09-21-calendar-day-header-consistency.md` D4 遗留）
- **基线**：`4818b7c4`；含用户未提交改动 `daily/index.vue`（删根容器 `padding: 1rem`）
- **性质**：只读诊断。本 ADR 与诊断报告为唯一落盘产物（**零代码改动、零提交**）。

## 1. 裁决结论

| 问题                             | 结论                                                                                                                                                                      |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 「月/周/日」能否做成三条子路由   | **有条件可行**。条件 = **状态宿主上移**（`useCalendarMonthly()` 从 `monthly/index.vue` 上移到 entry 的子层），否则 weekly 崩、daily 重拉（破 C14）                        |
| 「切视图不重拉数据」是否仍然成立 | 路由化后**默认不成立**；上移宿主后才成立（`use-calendar-task-query.ts` 的 `onMounted → resetAndLoad` 会随视图重建重拉）                                                   |
| 三视图头部/容器是否「同一基线」  | **不是**。三处根容器规则、右组 gap（16/6/8）、未安排↔今天（8/6/4）、分隔线实现（两种）、标题宽度（132 vs 145–165）各不同                                                  |
| 切视图「元素位移」主因           | P0 日视图**双重 padding**（已由用户手工改动消除）；P1 右组 gap 三样；P2 标题宽度不稳；P3 wrap 阈值三样；P4 根容器 `flex:1` vs `height:100%`（今天等价、路由化后是脆弱点） |
| 用户未提交的 daily 改动          | **正确且完整** —— 是双重 padding 的修复；**不得**推广到 monthly（monthly 的 `padding:1rem` 是全节 padding 唯一来源）                                                      |

## 2. 既有缺陷（本次实测发现，随本单登记）

1. **`LAST_CALENDAR_ROUTE` 恢复逻辑当前失效**（`router.ts:19-26`）：父路由用 `redirect` 时全局 `beforeEach` 看到的是子路由名，`to.name in SECTION_LAST_ROUTE_MAP` 永不命中（`vue-router@5.2.0` 实测）。tasks 段因用父级 `beforeEnter` 而无此问题（`tasks/routes.ts:8-16`）——**日历应照抄该模式**。
2. **周视图 active「周」按钮误绑 `@click="onGoMonth"`**（`weekly/index.vue:213-221`）：周视图点「周」跳回月视图；月/日的 active 按钮无 click（正确）。
3. **死代码**：`.cal-aside-toggle`、`.cal-nav-btn`（×3 规则）零引用；`.cal-view-sep` 零引用（TASK-17 D4 遗留）。
4. **`.is-active{font-weight:600}` 不是位移来源**（实测证伪：三个切换按钮宽度恒 30.02px）——避免按伪因改样式。
5. **用户未提交的 `daily/index.vue` 改动附带了回归**：该笔 diff 在重写右组时**删掉了 `data-testid="day-unscheduled-entry"`**（`HEAD:295` 有、工作区无）→ 执行 `vp test run apps/web/src/components/calendar/daily/__tests__/daily-view.test.ts` = **1 failed / 3**（`日视图头部存在未安排入口（C12）`）。全仓该 testid 仅被该测试使用 ⇒ **采纳改动时必须补回该属性**，否则违反 TASK-17「既有测试全绿且不改测试文件」的硬约束。

## 3. 约束（实现期硬约束；偏离需回本 ADR）

- **C1 状态宿主唯一**：三视图的视图状态（锚点/快照/排序/拖拽/抽屉/撤销）必须由**单一宿主**持有；视图组件只 `inject` 渲染契约（对齐既有 `weekly-context.ts` / `daily/context.ts` 范式）。**禁**让三个视图各持一份状态。
- **C2 零重拉不破**：任何「切视图」路径不得触发 `useCalendarTaskQuery` 重建（ADR TASK-16 C14 的延伸）。
- **C3 禁 keep-alive 兜底**：keep-alive 保组件实例而非宿主状态，会退化为三份状态 + 三次拉取；**不得**作为宿主上移的替代。
- **C4 路由名兼容**：`calendar`（父）与 `calendar-monthly`（现名）**保持不变**，新增 `calendar-weekly` / `calendar-day`；三条子路由**都带 `:taskId?`**（`task-details` / `use-creator` 按「当前路由名 + params.taskId」泛化寻址）。
- **C5 视图态单一真源**：若做三路由，`viewMode` 必须**从 `route.name` 派生**（只读 computed + 导航动作是唯一写路径）；**禁**保留可变 `viewMode` 镜像做双向同步。
- **C6 布局基线（唯一，落地于 `calendar-grid.css` + 三视图模板）**：
    1. **padding 归属**：只由路由根容器提供（`.nue-calendar-monthly`，全节唯一）；`weekly`/`daily` 根**不得**声明 padding。
    2. **头部三层 gap**：外层 `var(--nue-gap-xs)`、左组 `2px`、右组 `var(--nue-gap-xs)`；「未安排 / 今天」为右组**直接子元素**（三视图同构，禁嵌套 wrapper）。
    3. **分隔线单一实现**：统一用共享 `.view-sep` span（1×16 + `margin: 0 4px`），删掉头部内的 `NueDivider`；`calendar-grid.css` 补 `.day-view-sep`，`.cal-view-sep` 转为在用。
    4. **标题宽度稳定**：`.cal-title/.wk-title/.day-title` 共享 `min-width ≥ 176px(11rem)`（覆盖最长文案 `2026 年 12 月 31 日` 实测 165.41px）。
    5. **根容器口径**：三视图统一 `height:100%`（+ `min-height:0`）；**禁**依赖 `flex:1`（父级非 flex 时静默塌陷：实测 486px → 88px）。
- **C7 移动端红线**：只动 `apps/web/src/components/calendar/**` 与 `calendar-grid.css`；`packages/presentation-react`、`apps/mobileapp` 零改动。
- **C8 服务端/领域零改动**：本单无 domain API 变更；分页/排序契约不动。

## 4. 技术取舍（选型四步法）

| 步骤         | 方案 1 三子路由                                                    | 方案 2 query 同步（`?view=week`）         |
| :----------- | :----------------------------------------------------------------- | :---------------------------------------- |
| 业务匹配度   | 完全满足「三段路径」字面要求                                       | 满足深链/回退/分享，但非路径段            |
| 技术成熟度   | 后端/展示层契约不变；但需新增路由层级 + 迁 provide + 拆 748 行组件 | 仅 1 个 watch + `router.replace`          |
| 团队能力     | 本仓已有 tasks 段多子路由范式可照抄                                | 更简单                                    |
| 成本效益     | ≈1.5–2.5 人天；风险中（宿主迁移漏项 = 白屏/重拉）                  | ≈0.3–0.5 人天；风险低                     |
| **架构建议** | 仅当「必须三段路径」时做，且与宿主上移**打包同单**                 | **目标为深链/回退时的首选**（不触碰 C14） |

## 5. 证据索引

| 类别                       | 位置                                                                                                                             |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| 路由骨架（含 router-view） | `apps/web/src/views/index/calendar/entry.vue`                                                                                    |
| 单子路由 + redirect        | `apps/web/src/views/index/calendar/routes.ts:7-15`                                                                               |
| tasks 的 beforeEnter 范式  | `apps/web/src/views/index/tasks/routes.ts:8-16`                                                                                  |
| section 恢复守卫（失效）   | `apps/web/src/router.ts:8-11,19-26,29-40`                                                                                        |
| `viewMode` / 三个 `goTo*`  | `apps/web/src/components/calendar/monthly/use-calendar-monthly.ts:137,148-157,188`                                               |
| 三份上下文 provide         | `apps/web/src/components/calendar/monthly/index.vue:261,302`                                                                     |
| weekly 无兜底 inject       | `apps/web/src/components/calendar/weekly/index.vue:26-63`                                                                        |
| daily 自足回退（会重拉）   | `apps/web/src/components/calendar/daily/use-calendar-day.ts:16-30`                                                               |
| 重拉锚点                   | `apps/web/src/components/calendar/monthly/use-calendar-task-query.ts:113-117,33-79`                                              |
| 详情按路由名泛化寻址       | `packages/presentation/task/components/task-details/index.vue:15`、`task-details.ts:134,137`、`dialog/creator/use-creator.ts:89` |
| 头部共享规则组             | `apps/web/src/components/calendar/calendar-grid.css:50-127`                                                                      |
| 三处根容器规则             | `monthly/index.vue:691-696`、`weekly/index.vue:360-364`、`daily/index.vue:438-442`                                               |
| 周视图 active 误绑         | `apps/web/src/components/calendar/weekly/index.vue:213-221`                                                                      |
| 零重拉约束（上游 ADR）     | `docs/adr/2026-09-21-calendar-day-view-geometry-and-lane-extraction.md` C14/A3                                                   |
| TASK-17 D4 遗留            | `docs/prds/2026-09-21-calendar-day-header-consistency.md` §9/§13                                                                 |

## 6. 决策（已拍板 2026-09-22）

> **用户裁决**：D1 = **(a) 三子路由**；D2–D7 均采纳下表「架构建议」。落地**必须与「状态宿主上移」打包同单**（C1/C2），并按 PM 定的严格串行顺序推进。

| #   | 决策点                                                     | 架构建议                                                                                                                                               |
| :-- | :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 路由方案：(a) 三子路由 / (b) query / (c) 本轮不做          | 视目标定：深链/回退 → (b)；(a) 仅在必须三段路径且与宿主上移同单时                                                                                      |
| D2  | 切视图写历史 or 不写                                       | `replace`（不污染返回栈）                                                                                                                              |
| D3  | 切视图是否保留打开的 `taskId`                              | 保留                                                                                                                                                   |
| D4  | 是否接受 `LAST_CALENDAR_ROUTE` 恢复 sub-route（含 taskId） | 接受（与 tasks 一致；修 §2-1 后自动生效）                                                                                                              |
| D5  | 是否引入 Playwright 做几何回归                             | 暂不引入（手工 + 结构断言）                                                                                                                            |
| D6  | daily 未提交改动                                           | **采纳 + 必须补回被删的 `data-testid="day-unscheduled-entry"`**（否则 `daily-view.test.ts` 红，违反 TASK-17 既有测试全绿的硬约束）；且不推广到 monthly |     |
| D7  | 是否同批修 §2-2（周 active 误绑）                          | 同批修                                                                                                                                                 |

## 7. 变更管理

- **2026-09-22 已拍板**：D1 选方案 1（三子路由），D2–D7 采纳架构建议；状态由「待拍板」升为「已拍板」，实现单 TASK-18。
- 已同步 TASK-16 ADR（`2026-09-21-calendar-day-view-geometry-and-lane-extraction.md`）**C14** 语义（`viewMode` 将由 `route.name` 派生，不再是组件内可变状态；**A3「不持久化」语义不变**——URL 即视图态，但默认入口仍为月视图），并在该 ADR §9 互记一行。
- 实现期偏离 C1–C8 任一约束 → 回到架构评审，不得就地放宽。