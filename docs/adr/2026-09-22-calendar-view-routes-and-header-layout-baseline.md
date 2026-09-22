# ADR 2026-09-22 日历三视图路由可行性与头部/容器布局基线（T68）

- **状态**：✅ **已拍板**（2026-09-22 用户裁决：**D1=(a) 三子路由**；D2–D7 全部采纳架构建议）→ 实现单 **TASK-18**，PRD `docs/prds/2026-09-22-calendar-three-view-routes-and-layout-baseline.md`
- **编号**：T68（TASK-18 第 1 单）；诊断报告：`docs/reports/T68-calendar-three-view-routing-and-header-layout-diagnosis.md`
- **关联**：TASK-16 日视图（ADR `2026-09-21-calendar-day-view-geometry-and-lane-extraction.md` C14/A3）、TASK-17 日视图头部对齐（PRD `docs/prds/2026-09-21-calendar-day-header-consistency.md` D4 遗留）
- **基线**：`4818b7c4`（T68 诊断时）；U1 已交付 `c3aa5c1b`（三视图布局单一基线 + D7）
- **性质**：T68 = 只读诊断；T74 = 仅改本 ADR（**零代码改动、零提交**）
- **2026-09-22 T74 修订（U2 落点评审）**：C1 口径细化 + 撤销栈例外、C6.1 承载层迁 `.nue-calendar-host`、新增 C9/C10/C11、C5 补充、裁决 D8/D9 —— 详见 **§7 变更管理**。

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

- **C1 状态宿主唯一（2026-09-22 T74 修订）**：
    - **口径细化（按状态性质分工）**：**结果态/持久态**（锚点年月日、任务快照、排序、抽屉开关、撤销栈与撤销 toast、周起始/专注徽标偏好）归**单一宿主**；**瞬态指针态**（`useDragSchedule` 手势会话、格内快速新建编辑器）**允许各视图本地**——二者不可能跨视图并存，上收反而制造悬挂会话。
    - **撤销栈：默认归宿主；唯一例外 = 日视图时间轴专属栈**（rd-fe 报备项 D-c，**有条件接受**，不视为偏离）。硬证据：`useCalendarSchedule` 自带 `onUnmounted(() => undoAction.value = null)`（「同视图生命周期约束」，`use-calendar-schedule.ts:175-178`）⇒ daily 本地栈随日视图卸载自动失效；若并入宿主，撤销快照将**跨视图存活**（切到月/周后仍可撤销时间轴改动，而该改动在当前视图不可见）= 语义错误。例外必须同时满足：
        1. **写回链路仍单一**：daily 与宿主复用**同一** `useCalendarSchedule` 工厂 + 同一 `useTasksStore` ⇒ **不破 TASK-16 ADR C9（写回链路唯一）**，例外只覆盖「撤销栈/toast 呈现」；
        2. **撤销 toast 呈现层唯一**（见本 ADR **C9**）：daily **不得**再自行渲染第二个 toast；
        3. **禁止上收为跨视图能力**：不得在宿主再挂第二套时间轴动作/跨视图撤销时间轴。
    - 除上述例外外，**禁**在任何视图组件内新建「结果态」的第二实例（含 `useCalendarSchedule` / `useCalendarTaskQuery` 的重复实例化）。
- **C2 零重拉不破**：任何「切视图」路径不得触发 `useCalendarTaskQuery` 重建（ADR TASK-16 C14 的延伸）。
- **C3 禁 keep-alive 兜底**：keep-alive 保组件实例而非宿主状态，会退化为三份状态 + 三次拉取；**不得**作为宿主上移的替代。
- **C4 路由名兼容**：`calendar`（父）与 `calendar-monthly`（现名）**保持不变**，新增 `calendar-weekly` / `calendar-day`；三条子路由**都带 `:taskId?`**（`task-details` / `use-creator` 按「当前路由名 + params.taskId」泛化寻址）。
- **C5 视图态单一真源**：若做三路由，`viewMode` 必须**从 `route.name` 派生**（只读 computed + 导航动作是唯一写路径）；**禁**保留可变 `viewMode` 镜像做双向同步。
    - **派生兜底（T74 确认：够稳，但须补两道防线）**：未知/父级/离开日历的路由名 → `'month'`。安全性依据：`useRoute()` 给出的是**已确认的当前路由**，日历子路由名恒在映射内，`'month'` 兜底只在宿主卸载过程中命中 ⇒ 无副作用；且派生比可变镜像**更稳**（导航被取消/失败时派生值自动回到真实值，不留失配镜像）。防线：① 映射表穷举三条名 + 断言「路由表名集合 ⊆ 映射键集合」（防未来改名后静默回落月视图）；② active 按钮**不绑**导航动作（避免冗余 `duplicated` 导航，见 C10）。**禁**用 `?? 'month'` 掩盖未知名却不设断言。
- **C6 布局基线（唯一，落地于 `calendar-grid.css` + 三视图模板）**：
    1. **承载层唯一（padding / 令牌 / 高度）**：全节 `padding: 1rem`、`--cal-*` 令牌、`height: 100%`、`background: var(--cal-bg)`、`overflow: hidden` 由**唯一承载层**提供。三视图成为兄弟路由后该层 = **`host.vue` 根容器 `.nue-calendar-host`**（原为 `.nue-calendar-monthly`）——**属 C6.1 意图保持不变、字面随结构性迁移更新，不是偏离**。四条强制落点：
        - **令牌随行**：`.nue-calendar-host` **必须**加入 `calendar-grid.css` 的 `--cal-*` 令牌选择器组（现为 `.nue-calendar-monthly, .nue-calendar-weekly`）。**⚠️ daily 本就不在组内、靠外层继承** ⇒ 只搬 padding 不搬令牌，会让日视图 `--cal-*`（背景/边框/语义色）**全部失效**；
        - `host.vue` **必须** `import '@/components/calendar/calendar-grid.css'`（幂等，保证令牌不依赖子视图的 lazy chunk）；
        - **同步动作**：`monthly` 根**必须**在同一次改动内删掉 `padding: 1rem`（否则重演「双重 padding」= U1 前 daily 的缺陷；实测整体内缩 16px、网格窄 32px）；
        - 承载层仍用 `<nue-div vertical gap="0">`（保留 flex 列语义，与 U1 前逐像素一致）；`weekly`/`daily` 根**不得**声明 padding。
    2. **头部三层 gap**：外层 `var(--nue-gap-xs)`、左组 `2px`、右组 `var(--nue-gap-xs)`；「未安排 / 今天」为右组**直接子元素**（三视图同构，禁嵌套 wrapper）。
    3. **分隔线单一实现**：统一用共享 `.view-sep` span（1×16 + `margin: 0 4px`），删掉头部内的 `NueDivider`；`calendar-grid.css` 补 `.day-view-sep`，`.cal-view-sep` 转为在用。
    4. **标题宽度稳定**：`.cal-title/.wk-title/.day-title` 共享 `min-width ≥ 176px(11rem)`（覆盖最长文案 `2026 年 12 月 31 日` 实测 165.41px）。
    5. **根容器口径**：三视图统一 `height:100%`（+ `min-height:0`）；**禁**依赖 `flex:1`（父级非 flex 时静默塌陷：实测 486px → 88px）。
- **C7 移动端红线**：只动 `apps/web/src/components/calendar/**` 与 `calendar-grid.css`；`packages/presentation-react`、`apps/mobileapp` 零改动。
- **C8 服务端/领域零改动**：本单无 domain API 变更；分页/排序契约不动。
- **C9 撤销呈现唯一（2026-09-22 T74 新增）**：全节**只允许一个** `schedule-undo-toast` 挂载点 = 宿主。daily 的时间轴 `undoAction` 经**注入通道**上报宿主渲染与转发撤销（载荷 `{ action, busy, undo, dismiss }`），撤销语义 = **最近一次动作**（与 `useCalendarSchedule` 既有「替换最近一次」一致）；无宿主（单测/独立挂载）时 daily 走**自足回退**（本地渲染 toast）⇒ `daily-interactions.test.ts` **零改动**。**禁**两 toast 并存：`undo-toast` 为 `position: fixed; top: 12px; left: 50%`（同坐标，`undo-toast.vue:69-75`），并存即**重叠遮挡**（后来者盖前者，被盖者仍可点但不可见）。
- **C10 切视图导航动作契约（2026-09-22 T74 新增）**：① **幂等**——目标 `fullPath` 与当前一致时直接返回（实测 `replace` 到同址 → `NavigationFailureType.duplicated`，`beforeEach` 不执行、`afterEach` 执行：无副作用但属冗余导航）；② `taskId` 与 `query` **原样透传**（实测 `params:{taskId:''}` 与 `undefined` 均解析为无尾斜杠路径，安全）；③ **`replace` 语义如实登记**（D2 已拍板）：`replace` **覆盖当前历史条目** ⇒ 切视图后「返回」**无法回到切换前的 URL**（含此前已打开的详情深链 `/calendar/monthly/<taskId>`）；这是 D2 的用户可见代价，须进手工验收项。
- **C11 首次切换观感（T74 提示，非硬约束）**：三视图成为路由级动态 import 后，vue-router 在确认导航前解析 chunk ⇒ 观感是「切换略有延迟」而非白屏（宿主 `router-view` 若含 `async setup` 才需自备 `suspense` 兜底）；如需零延迟可 `import()` 预热。

## 4. 技术取舍（选型四步法）

| 步骤         | 方案 1 三子路由                                                    | 方案 2 query 同步（`?view=week`）         |
| :----------- | :----------------------------------------------------------------- | :---------------------------------------- |
| 业务匹配度   | 完全满足「三段路径」字面要求                                       | 满足深链/回退/分享，但非路径段            |
| 技术成熟度   | 后端/展示层契约不变；但需新增路由层级 + 迁 provide + 拆 748 行组件 | 仅 1 个 watch + `router.replace`          |
| 团队能力     | 本仓已有 tasks 段多子路由范式可照抄                                | 更简单                                    |
| 成本效益     | ≈1.5–2.5 人天；风险中（宿主迁移漏项 = 白屏/重拉）                  | ≈0.3–0.5 人天；风险低                     |
| **架构建议** | 仅当「必须三段路径」时做，且与宿主上移**打包同单**                 | **目标为深链/回退时的首选**（不触碰 C14） |

## 5. 证据索引

| 类别                                 | 位置                                                                                                                               |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| 路由骨架（含 router-view）           | `apps/web/src/views/index/calendar/entry.vue`                                                                                      |
| 单子路由 + redirect                  | `apps/web/src/views/index/calendar/routes.ts:7-15`                                                                                 |
| tasks 的 beforeEnter 范式            | `apps/web/src/views/index/tasks/routes.ts:8-16`                                                                                    |
| section 恢复守卫（失效）             | `apps/web/src/router.ts:8-11,19-26,29-40`                                                                                          |
| `viewMode` / 三个 `goTo*`            | `apps/web/src/components/calendar/monthly/use-calendar-monthly.ts:137,148-157,188`                                                 |
| 三份上下文 provide                   | `apps/web/src/components/calendar/monthly/index.vue:261,302`                                                                       |
| weekly 无兜底 inject                 | `apps/web/src/components/calendar/weekly/index.vue:26-63`                                                                          |
| daily 自足回退（会重拉）             | `apps/web/src/components/calendar/daily/use-calendar-day.ts:16-30`                                                                 |
| 重拉锚点                             | `apps/web/src/components/calendar/monthly/use-calendar-task-query.ts:113-117,33-79`                                                |
| 详情按路由名泛化寻址                 | `packages/presentation/task/components/task-details/index.vue:15`、`task-details.ts:134,137`、`dialog/creator/use-creator.ts:89`   |
| 头部共享规则组                       | `apps/web/src/components/calendar/calendar-grid.css:50-127`                                                                        |
| 三处根容器规则                       | `monthly/index.vue:691-696`、`weekly/index.vue:360-364`、`daily/index.vue:438-442`                                                 |
| daily 本地撤销栈（C1 例外）          | `daily/index.vue:60-72`（`useCalendarSchedule` 新实例 + `applyTimePatch`）、`daily/index.vue:426-430`（本地 toast）                |
| 撤销「同视图生命周期」约束           | `apps/web/src/components/calendar/monthly/use-calendar-schedule.ts:175-178`                                                        |
| 撤销 toast 同坐标定位                | `apps/web/src/components/calendar/monthly/undo-toast.vue:69-75`                                                                    |
| 宿主侧撤销条渲染点                   | `apps/web/src/components/calendar/monthly/index.vue:669-676`                                                                       |
| `--cal-*` 令牌载体组（daily 不在内） | `apps/web/src/components/calendar/calendar-grid.css:10-11`                                                                         |
| 冻结测试：时间轴拖拽→撤销            | `apps/web/src/components/calendar/daily/__tests__/daily-interactions.test.ts:11,297-308`（独立挂载 + 组件级 `schedule-undo` 断言） |
| U1 布局基线交付                      | `c3aa5c1b`（gap/分隔线/`min-width 11rem`/压平 wrapper/根容器 `height:100%`/D7 误绑）                                               |
| 周视图 active 误绑                   | `apps/web/src/components/calendar/weekly/index.vue:213-221`                                                                        |
| 零重拉约束（上游 ADR）               | `docs/adr/2026-09-21-calendar-day-view-geometry-and-lane-extraction.md` C14/A3                                                     |
| TASK-17 D4 遗留                      | `docs/prds/2026-09-21-calendar-day-header-consistency.md` §9/§13                                                                   |

## 6. 决策记录（D1–D7 用户 2026-09-22 拍板；D8–D9 arch T74 裁决）

> **用户裁决**：D1 = **(a) 三子路由**；D2–D7 均采纳下表「架构建议」。落地**必须与「状态宿主上移」打包同单**（C1/C2），并按 PM 定的严格串行顺序推进。

| #   | 决策点                                                     | 架构建议                                                                                                                                                                                                                                                            |
| :-- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | 路由方案：(a) 三子路由 / (b) query / (c) 本轮不做          | 视目标定：深链/回退 → (b)；(a) 仅在必须三段路径且与宿主上移同单时                                                                                                                                                                                                   |
| D2  | 切视图写历史 or 不写                                       | `replace`（不污染返回栈）                                                                                                                                                                                                                                           |
| D3  | 切视图是否保留打开的 `taskId`                              | 保留                                                                                                                                                                                                                                                                |
| D4  | 是否接受 `LAST_CALENDAR_ROUTE` 恢复 sub-route（含 taskId） | 接受（与 tasks 一致；修 §2-1 后自动生效）                                                                                                                                                                                                                           |
| D5  | 是否引入 Playwright 做几何回归                             | 暂不引入（手工 + 结构断言）                                                                                                                                                                                                                                         |
| D6  | daily 未提交改动                                           | **采纳 + 必须补回被删的 `data-testid="day-unscheduled-entry"`**（否则 `daily-view.test.ts` 红，违反 TASK-17 既有测试全绿的硬约束）；且不推广到 monthly                                                                                                              |
| D7  | 是否同批修 §2-2（周 active 误绑）                          | 同批修                                                                                                                                                                                                                                                              |
| D8  | **T74/D-a：承载层迁到 host 是否偏离 C6.1？**               | **不偏离**（字面更新，意图不变）⇒ 已修订 **C6.1**：承载层 = `.nue-calendar-host`（padding + `--cal-*` 令牌 + `height:100%` + `background` + `overflow`）；`.nue-calendar-host` 入令牌选择器组；`monthly` 根同步去 `padding:1rem`；host.vue 自引 `calendar-grid.css` |
| D9  | **T74/D-c：daily 本地撤销栈（vs C1）**                     | **有条件接受为 C1 许可例外**（不要求本单合并）；三项条件 + 范围见 **C1 修订**；呈现层唯一见 **C9**；用户可见风险见下表                                                                                                                                              |

## 7. 变更管理

- **2026-09-22 已拍板**：D1 选方案 1（三子路由），D2–D7 采纳架构建议；状态由「待拍板」升为「已拍板」，实现单 TASK-18。
- **2026-09-22 修订（T74 U2 落点评审，arch）**：新增/修改 **C1**（结果态 vs 瞬态态口径 + 撤销栈例外与三项条件）、**C6.1**（承载层 `.nue-calendar-monthly` → `.nue-calendar-host`，并强制令牌随行 + monthly 去 padding）、新增 **C9**（撤销呈现唯一）、**C10**（切视图导航契约：幂等 / 透传 / `replace` 代价登记）、**C11**（首次切换观感，非硬约束）、**C5 补充**（派生兜底两道防线）；新增裁决 **D8 / D9**。触发源 = U2 落点评审（rd-fe T71-A 清单报备 D-a / D-c）。**本修订不改变 C2/C3/C4/C7/C8/C9(写回链路唯一) 与 D1–D7。**
- **对 U1（`c3aa5c1b`）的影响：无，无需回写 T70 结论。** U1 交付的是「三视图根容器口径 + 头部基线」，与「谁承载 padding」正交；且 U1 把三视图根统一为 `height:100%`，**恰好是 D-a 可行的前提**（weekly 不再依赖父级 flex 列）。唯一前置追加项 = D-a 要求 host 自身具备确定高度（`height:100%`）。

### 7.1 D9（C1 例外）的用户可见风险登记

| 风险                                            | 严重度 | 说明与处置                                                                                                                                                                       |
| :---------------------------------------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 两套撤销栈在 5s TTL 窗口内同时存活 → toast 重叠 | 低-中  | 触发需「时间轴拖拽/拉伸」与「抽屉内批量/单条排期/勾选/延到今日」在 5s 内先后发生（宿主侧动作均发生在抽屉内）；C9 已要求呈现层唯一 ⇒ 实现后**不再重叠**                           |
| 撤销语义是否不一致                              | 低     | 两者共用同一 toast 外壳与同一 `ScheduleUndoAction` 形状，语义均为「撤销最近一次改期/改时长」；C9 要求统一口径 = 最近一次动作 ⇒ 不出现「同名不同义」                              |
| 时间轴撤销跨视图存活                            | 无     | daily 本地栈随日视图卸载自动清空（`use-calendar-schedule.ts:175-178`）⇒ 不出现「在月/周视图撤销看不见的时间轴改动」                                                              |
| 实现期若改为「合并为单栈」（可选强化）          | —      | 允许且更对称（weekly 已由宿主注入 `onRescheduleTask`）；但必须同时：保留自足回退（保 `daily-interactions.test.ts` 零改动）+ 在切离日视图时显式清栈（保「同视图生命周期」不变量） |

- 已同步 TASK-16 ADR（`2026-09-21-calendar-day-view-geometry-and-lane-extraction.md`）**C14** 语义（`viewMode` 将由 `route.name` 派生，不再是组件内可变状态；**A3「不持久化」语义不变**——URL 即视图态，但默认入口仍为月视图）：该 ADR §9 已互记一行，且其 r3 修订说明与 r3 表行 **✅ 已落盘**（`d3fff86a`，2026-09-22 TASK-18）——二者口径一致（`viewMode` 由 `route.name` 派生只读、A3 语义不变）。
- 实现期偏离 C1–C8 任一约束 → 回到架构评审，不得就地放宽。