# T68 诊断：日历「月/周/日三路由」可行性 + 三视图头部/容器一致性（只读诊断）

- **编号**：T68（TASK-18 第 1 单）
- **角色**：arch-designer（架构）
- **日期**：2026-09-22
- **基线**：`4818b7c4`（HEAD）；工作区含用户未提交改动：`apps/web/src/components/calendar/daily/index.vue`（移除 `.nue-calendar-daily` 的 `padding: 1rem`）
- **性质**：**只读诊断**。本单未改任何代码、未提交、未 push。本报告（+ 同日 ADR）是本单唯一的落盘产物。
- **方法**：静态读码 + `vue-router@5.2.0` 行为实测（memory history 探针）+ headless Chromium 布局实测（真实 nue-ui / shadcn-like 主题 CSS + 真实头部标记，逐元素 `getBoundingClientRect`）。原始数据见附录。

---

## 0. 结论摘要（TL;DR）

1. **用户问的「月/周/日三个路由」：技术上可行，但不能只改 `routes.ts`。** 三个视图的状态所有者是 `components/calendar/monthly/index.vue`（`useCalendarMonthly()`），weekly 的上下文用 `inject(...)!` 无兜底 → 直接把 weekly 变成路由组件会**当场崩**；daily 有自足回退但会**自行重拉数据**，违反 ADR C14。
2. **「切视图不重拉数据」是既有硬约束**（A1 提交 + ADR C14），它正是靠「宿主组件不卸载、只换 `v-if` 子树」实现的。路由化 ⇒ 宿主随路由卸载 ⇒ 必须先把状态宿主上移一层，否则 C14 破。
3. **顺带实测发现一个既有缺陷**：`router.ts` 的「回到上次日历位置」（`SECTION_LAST_ROUTE_MAP.calendar`）**当前已失效** —— 父路由用 `redirect` 时全局 `beforeEach` 看到的是子路由名，永远命中不了。tasks 段用的是父级 `beforeEnter` 模式（`tasks/routes.ts:8-16`），**日历应照抄**。
4. **用户那笔未提交的 `daily` 改动：CSS 部分（删 `padding: 1rem`）完全正确且完整，不要推广到 monthly；但同一笔 diff 顺手删掉了 `data-testid="day-unscheduled-entry"` → 既有测试已红。** 实测：删前日视图整体内缩 16px、网格窄 32px（双重 padding）；删后与月/周**像素级一致**（dx=17 / w=866 / h=450，三视图同值）。⚠️ 同时执行 `vp test run apps/web/src/components/calendar/daily/__tests__/daily-view.test.ts` = **1 failed / 3**（`日视图头部存在未安排入口（C12）`，TASK-16 的 DOM 契约）⇒ **采纳该改动时必须把该 `data-testid` 补回**（C-6）。
5. **切视图「元素位移」的剩余主因是头部右组的 gap 三样 + 标题宽度不稳**，不是 active 字重（实测证伪：月/周/日按钮宽度均为 30.02px）。实测零 padding 基准下，右组 `sort` 按钮在月/周/日之间横移 **+24px / +28px**，`toggle` 横移 **+14px / +20px**。
6. **建议**：若目标只是「可深链 / 可前进后退 / URL 可分享」→ 走 query 折中方案（≈0.3–0.5 人天，零 C14 风险）；若必须「三段路径」→ 走三子路由，但**必须与「状态宿主上移」打包成一单**（≈1.5–2.5 人天）。二选一**请 PM/用户拍板**（§C-1）。

---

## A. 路由问题

### A0 能力判定（先纠正一个前提）

- `apps/web/src/views/index/calendar/entry.vue` **已经**含 `<router-view v-slot>` + `<suspense>`，且 `CalendarAside` 与内容区同层 → **多子路由所需的宿主骨架已存在**，不需要新建宿主层。
- 但 `entry.vue` 自己**不能**既 `provide(CALENDAR_VIEW_CONTEXT_KEY)` 又 `inject` 它（Vue 3 `inject` 不读自身 `provide`）——见 `views/index/calendar/calendar-view.ts` 的 `provide(CALENDAR_VIEW_CONTEXT_KEY, {...})`。这决定了状态宿主上移的具体落点（§A3）。
- **`apps/web/src/router-access.ts` / `router-access.test.ts` 与「路由访问控制」无关**：它是 SHELL-05 的「实例无关 router 访问器」（`selectRouter` / `reportRouterInjection` 纯函数，规避双物理 `vue-router` 实例导致 `useRouter()` 为 undefined），不解析路由表、不受子路由增删影响。
- `apps/web/src/views/auth/routes.test.ts` 只测 **auth 守卫的离线进入四条件**（`views/auth/routes.ts` 的 `beforeEnter`）→ 与日历子路由**零关系**。全仓 grep：**没有任何测试引用 `calendar-monthly` 之外的路由名，也没有测试 import `views/index/calendar/routes`**。

### A1 可行性结论

**可行（有条件可行）**。条件（缺一不可）：

| #   | 条件                                                                                                     | 不满足的后果（代码证据）                                                                                                                                                                         |
| :-- | :------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | `useCalendarMonthly()` 的状态宿主上移到「entry 的子层」（新 layout 组件，或改 DI 入参后在 entry 内组装） | weekly 的 `inject(CALENDAR_WEEKLY_CONTEXT_KEY)!` 解构 `undefined` → **setup 抛错、周视图白屏**（`weekly/index.vue:26-63`）                                                                       |
| A-2 | 任务快照所有权随宿主上移（`useCalendarTaskQuery` 不随视图重建）                                          | `use-calendar-task-query.ts:113-117` 的 `onMounted(() => resetAndLoad())` + `resetAndLoad` 清空 `taskIds` → **每次切视图全量重拉**，违反 C14                                                     |
| A-3 | 三条子路由都带 `:taskId?`                                                                                | `task-details/index.vue:15` 读 `route.params.taskId`；`task-details.ts:134/137`、`use-creator.ts:89` 以 `{name: 当前路由名, params:{taskId}}` 寻址 → 缺参数则周/日视图**打不开也关不掉详情抽屉** |
| A-4 | 父级 `redirect` 改 `beforeEnter`                                                                         | 全局 `SECTION_LAST_ROUTE_MAP.calendar` 的「回上次日历位置」继续失效（§A2-③，已实测）                                                                                                             |

### A2 「现在不是三路由制」的成因与代价（用证据说话，不猜）

**① 三视图共享一套状态，宿主是 `monthly/index.vue`，weekly/daily 只是渲染件**

```
views/index/calendar/entry.vue          ← provide CALENDAR_VIEW_CONTEXT_KEY + CalendarAside + <router-view>
  └─ routes: calendar → children[1] = monthly/:taskId?  →  components/calendar/monthly/index.vue
       ├─ useCalendarMonthly()           ← 状态所有者：year/monthIndex/selectedKey/viewMode
       │                                    + useCalendarTaskQuery(任务快照) + useCalendarSort + useCalendarSchedule
       │                                    + useDragSchedule + 未安排抽屉 + 撤销 + 周起始/专注徽标
       ├─ provide(CALENDAR_WEEKLY_CONTEXT_KEY, {...})   monthly/index.vue:261
       ├─ provide(CALENDAR_DAY_CONTEXT_KEY, {...})      monthly/index.vue:302
       └─ v-if viewMode==='month'  →（月份头部 + 网格，内联）
          v-else-if 'week'        → <calendar-weekly />   ← weekly 只 inject，不持有状态
          v-else                  → <calendar-daily />    ← daily 有「自足回退」，但那会自行重拉
```

- `weekly-context.ts` / `daily/context.ts` 的注释写得很明确：它们是**渲染契约**（「状态与动作由 provide 注入，无 props 穿透」），不是状态所有者。
- `daily/use-calendar-day.ts:16-18` 的兜底分支自带 `useCalendarTaskQuery` + `anchorKey = todayDateKey()` → 独立挂载时**重新拉取、锚点回到今天**；这是「单测可用」的便利，不是「可直接当路由组件」的能力。

**② 成因是「零重拉」这条 ADR 约束，不是路由方案被否决**

- A1 提交 `1691353e`（2026-09-06，CAL-04 月/周切换）正文自述：`use-calendar-monthly.ts` … **暴露 tasks 快照（视图切换零重拉）**；`monthly/index.vue` … **周分支挂 weekly**。即：**视图切换被刻意实现在组件内部状态里**。
- ADR `2026-09-21-calendar-day-view-geometry-and-lane-extraction.md` **C14** 原文：「`viewMode` 扩为 `'month'|'week'|'day'`；切视图**不重拉数据**（复用同一 `taskIds` 快照）；A3（默认月、**不持久化**）保持不变。」
- ADR 同篇约束表：`viewMode` … **未持久化（A3 无需改动）**。⇒ **「视图写进 URL」从来不是需求**，所以没人做三路由。
- 路由骨架（`entry.vue` + `redirect` + 单条 `monthly` 子路由）来自 **2026-05-15 `01766346`**（对话框上下文注入重构 + 「日历组件从 views/index/calendar 迁移至 layouts/calendar」）——那是**布局抽取的机械产物**（当时只有月视图），不是「三视图路由」的设计决策。后续 `d833fa6d`（2026-09-04）只把 `monthly` 改成 `monthly/:taskId?` 给详情抽屉用。
- ⇒ 结论：**没有任何一篇 ADR/PRD 评估并否决过三视图路由**；现状是「状态就近落在 monthly 组件里」的自然结果。

**③ 顺带实测：`LAST_CALENDAR_ROUTE` 的恢复逻辑当前已失效**

```text
router.ts:19-26   beforeEach:  if (!(to.name in SECTION_LAST_ROUTE_MAP)) return true   // 只看 to.name
router.ts:8-11    SECTION_LAST_ROUTE_MAP = { tasks: 'LAST_TASKS_ROUTE', calendar: 'LAST_CALENDAR_ROUTE' }
```

用 `vue-router@5.2.0`（memory history）实测：

```text
[现状 redirect]      push('/calendar') → beforeEach 看到 name='calendar-monthly' → sectionHit=false
                                        → 不回恢复，直接落 /calendar/monthly（matched=index,calendar,calendar-monthly）
[tasks 式 beforeEnter] push('/calendar') → beforeEach 看到 name='calendar'       → sectionHit=true（可恢复）
                                        → 父级 beforeEnter 再把裸 /calendar 打到默认子路由
```

父级 `redirect` 在**解析期**生效，全局守卫看不到父名 → 日历段的「回到上次位置」**从未真正生效过**（`LAST_CALENDAR_ROUTE` 只写不读）。tasks 段没这个问题，因为它在父级用 `beforeEnter`（`tasks/routes.ts:8-16`，`if (to.name !== 'tasks') return` + 返回重定向目标）。

### A3 改法（方案 1：三子路由，目标态）

**文件级落点**

| #   | 文件                                                  | 改动                                                                                                                                                                                                 |
| :-- | :---------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `views/index/calendar/routes.ts`                      | `redirect` → 父级 `beforeEnter`（照抄 tasks 模式，保留 `name:'calendar'`）；`children` 三条：`monthly/:taskId?` / `weekly/:taskId?` / `daily/:taskId?`（保 `calendar-monthly` 名不变，减少爆炸半径） |
| 2   | `views/index/calendar/` 新增「日历布局」组件          | 持有 `useCalendarMonthly()`（= 状态宿主上移）并 `provide` 三份视图上下文；内部再放 `<router-view>`。落点有两种，见下（2a/2b）                                                                        |
| 3   | `components/calendar/monthly/index.vue`               | 瘦身为**月视图渲染件**：保留月份头部 + 网格（约 414-630 行），删 `viewMode` 与 `goToWeekView/goToMonthView/goToDayView`，改 inject 新 `CALENDAR_MONTH_CONTEXT_KEY`                                   |
| 4   | `components/calendar/monthly/use-calendar-monthly.ts` | 删 `viewMode = ref(...)`（137）与三个 `goTo*View`（148-157）；`watch([...,viewMode])`（188）改用注入的 `currentView`；新增/复用「切视图 = 导航」动作                                                 |
| 5   | `components/calendar/daily/context.ts` 同构新增       | `CALENDAR_MONTH_CONTEXT_KEY`（月视图渲染契约，与 weekly/day 对称）                                                                                                                                   |
| 6   | `views/index/calendar/entry.vue`                      | 基本不动（骨架已在）；若走 2b 则在 setup 内组装宿主                                                                                                                                                  |

**状态宿主上移的两种落点（择一）**

- **2a 新增路由层级（推荐，语义最干净）**：`calendar`(entry.vue) → 匿名子路由(`layout.vue`，状态宿主) → 三条视图路由。代价：路由树 2 层→3 层，`to.matched[1].name` 仍是 `calendar`（section map 不受影响，已实测 matched 顺序）。
- **2b 改 DI 入参（diff 更小）**：把 `useCalendarMonthly()` 对 `CALENDAR_VIEW_CONTEXT_KEY` 的 `inject` 改成**显式入参**（该文件已有此风格：`useCalendarTaskQuery({ tasksStore, taskUseCase })` 就是 DI 入口单一），即可在 `entry.vue` 内「先 `useCalendarView()` 拿 ctx → 再调 `useCalendarMonthly(ctx)` → `provide` 三份上下文」；`entry.vue` 不 `inject` 自己 `provide` 的键，无 Vue 限制问题。

**`viewMode` 的归属：建议「派生」，不做双向同步**

```text
const currentView = computed(() => VIEW_OF_ROUTE_NAME[route.name])   // 'calendar-monthly'|'weekly'|'daily' → 'month'|'week'|'day'
const goToWeekView = () => router.push({ name: 'calendar-weekly', params: { taskId: currentTaskId }, query: route.query })
```

- **理由**：`route.name` 与 `viewMode` 双写会出现「谁是真源」的经典竞态（快速连点、前进后退、守卫重定向各写一次）；本仓 ADR 文化一贯要求「单一真源」（`viewMode` 只读派生 + 导航动作是唯一写路径）。
- 受影响处仅 1 处 watch（`use-calendar-monthly.ts:188` 用 `viewMode` 关快速新建编辑器）→ 换 `currentView` 即可。

**默认视图 / 深链 / 前进后退**

- `/calendar` 落点：父级 `beforeEnter` 返回 `calendar-monthly`（**或**先读 `LAST_CALENDAR_ROUTE` 恢复上次的视图+taskId；修好 §A2-③ 后该逻辑自动生效）。
- 深链：`/calendar/weekly/<taskId>`、`/calendar/daily/<taskId>` 直接可用（`task-details` 泛化寻址，无需改 presentation）。
- 前进/后退：获得原生语义（视图成为历史条目）。**代价**：`router.push` 会把「切视图」写进历史（返回键回到上一个视图而非上一页）。若希望不写历史 → 切视图动作改用 `router.replace` ⇒ **决策点 C-2**。

**`taskId` 三条都要带**：理由见 A-3。切换视图时是否保留当前打开的 `taskId`（详情抽屉不丢）⇒ **决策点 C-3**（保留=详情跨视图续看；不保留=切视图即关抽屉，语义更干净）。

**`router-access` / 测试影响面**

- `router-access.ts`、`router-access.test.ts`、`views/auth/routes.test.ts`、`safe-navigation.test.ts`：**零影响**（§A0）。
- 全仓 grep 实证：无测试引用 `viewMode` / `goToWeekView` / `goToDayView` / `goToMonthView`；无测试引用 `calendar-weekly`/`calendar-daily`；`calendar-monthly` 仅出现在 `routes.ts` 自身。
- **会受影响的既有测试（间接）**：`daily/__tests__/daily-view.test.ts`、`daily-interactions.test.ts` 挂载 daily 组件（走自足回退）→ 若保留回退则不动；若按 A-1 删除回退则必须改（**建议保留回退**，把「宿主上移」限制在 provide 层）。`views/index/index-view.test.ts` 覆盖 `taskDetailsLocation`（`name` 泛化）→ 只要三条都带 `:taskId?` 即不变。

### A4 代价与风险（方案 1）

| 风险                       | 影响                                                                                                                               | 应对                                                                                                                           |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| 状态宿主迁移不彻底         | weekly 直接崩 / daily 重拉（C14 破）                                                                                               | 把「宿主上移」列为**同单必做项**，用 A-1/A-2 作验收断言（切视图零网络请求）                                                    |
| 路由组件卸载 → 重建        | 视图级 UI 状态（当日抽屉、快速新建、撤销 toast、拖拽会话）重建                                                                     | 抽屉/撤销/拖拽状态已在宿主（上移后仍在）→ 语义不变；`dayDrawerOpen`/`unscheduledOpen` 等若留在月视图内需同步上移               |
| `keep-alive` 被当成银弹    | keep-alive 保的是「视图组件实例」而不是宿主状态 → 三视图各持状态 = 三份锚点 + 三份快照 + 3 次拉取，反而更糟                        | **明确否决 keep-alive**；宿主上移是唯一正解                                                                                    |
| 懒加载闪烁                 | 三个视图从「静态 import 子组件」变「路由动态 import」→ 首次切换出现 `<suspense>` pending 闪烁                                      | 预加载（`import()` 预热）或接受首次切换一次 loading；不得为此引入 keep-alive                                                   |
| 滚动位置                   | 三个视图根都是 `overflow: hidden`（滚动在外层 `.nue-content`）→ 切视图不丢滚动；但**日视图内部时间轴**若有自身滚动容器会重置       | 现状核对 + 必要时把轴滚动状态放宿主（本单未发现日视图有独立滚动容器）                                                          |
| 拖拽中切视图               | 拖拽会话在宿主（上移后仍在），被拖 DOM 被销毁 → 浮空胶囊停留到 `pointerup`（`use-drag-schedule.ts` 的 window 级 up/cancel 会自愈） | 切视图动作里显式 `drag.cancel()`；**注**：这是现状即有的小瑕疵（`watch(viewMode)` 目前只关快速新建、不取消拖拽），非路由化新增 |
| `LAST_CALENDAR_ROUTE` 语义 | 修好 §A2-③ 后，冷启动会把 `/calendar/weekly/<taskId>` 一起恢复 → 直接回到周视图（并可能重开详情抽屉）                              | 是否接受 ⇒ **决策点 C-4**（tasks 段已有同样行为，建议接受以保持一致）                                                          |
| 历史/书签兼容              | 旧 `/calendar/monthly` 深链仍有效（名与路径都保留）                                                                                | 无需迁移                                                                                                                       |

### A5 建议（折中方案 2：仅把视图与 URL 同步，不拆路由）

**做法**：保留单路由 + 单宿主，`viewMode` 与 `route.query.view` 同步（1 个 `watch` + `router.replace`），例如 `/calendar/monthly/<taskId>?view=week`。

| 维度       | 方案 1（三子路由）                                                                 | 方案 2（query 同步）             |
| :--------- | :--------------------------------------------------------------------------------- | :------------------------------- |
| 深链/分享  | ✅ 三路径段                                                                        | ✅ query（非路径段）             |
| 前进后退   | ✅（但会多写历史，需选 push/replace）                                              | ✅（replace 时不污染历史）       |
| C14 零重拉 | ⚠️ 需先做宿主上移                                                                  | ✅ 天然满足（组件不卸载）        |
| 改动面     | routes + 新宿主 + `monthly/index.vue` 748 行拆分 + 新 context 键 + 导航动作 + 回归 | 1 个文件 + 1 个 watch + 导航动作 |
| 估算       | ≈1.5–2.5 人天（拆模板/迁 provide/回归月历单测）                                    | ≈0.3–0.5 人天                    |
| 风险       | 中（宿主迁移漏项 = 白屏/重拉）                                                     | 低                               |

**架构建议**：如果目标的**本质**是「可深链 / 可回退 / URL 可分享」，方案 2 的性价比显著更高，且不触碰 C14 与 748 行拆分。**只有当**必须「`月` / `周` / `日` 三段独立路径」（用户明确要求，或未来要做视图级权限/埋点/统计）时，才做方案 1，并**一并承接宿主上移**。⇒ 决策点 C-1。

---

## B. 头部与容器一致性 + 位移根因

### B0 一个关键结构事实（决定了 padding 归属）

三视图**不是三个平级组件**：weekly/daily 渲染在 **`.nue-calendar-monthly` 这个根容器内部**（`monthly/index.vue:411` 开 → `687` 闭，两个分支都在其中）。因此：

```text
.nue-content (entry.vue: display:block, height:100%, overflow:hidden, 无 padding)
  └─ .nue-calendar-monthly  ← 路由组件根：height:100% + padding:1rem（本容器是全节 padding 的唯一来源）
       ├─ 月分支：头部 + 星期表头 + .cal-body(flex:1)
       ├─ 周分支：<calendar-weekly/>   ← .nue-calendar-weekly{flex:1;min-height:0} ⇒ 由父级 flex 列撑满
       └─ 日分支：<calendar-daily/>    ← .nue-calendar-daily{height:100%}      ⇒ 由父级给定高度
```

⇒ **`padding: 1rem` 属于「路由根容器」这一层**（与任务区惯例一致：`tasks/built-in-project/index.vue:22` 等三个入口都在自己的根容器上给 `padding: 1rem`），**子视图不得再自带 padding**。

### B1 差异清单（逐项，含 PM 未发现的）

#### B1-1 头部右组（❌ 三样，主因）

| 项                     | monthly                                      | weekly                                   | daily                                          |
| :--------------------- | :------------------------------------------- | :--------------------------------------- | :--------------------------------------------- |
| 右组容器 `gap`         | **无 gap** → `.nue-div` 默认 **1rem = 16px** | `gap="6px"`（字面量）                    | `gap="var(--nue-gap-xs)"` = **8px**            |
| 「未安排 / 今天」外层  | `<nue-div gap="var(--nue-gap-xs)">` = 8px    | **无外层**（直接子元素）                 | `<nue-div gap="var(--nue-gap-2xs)">` = **4px** |
| 未安排 ↔ 今天 实际间距 | 8px                                          | 6px                                      | 4px                                            |
| 分隔线元素             | `<nue-divider vertical>`（NueDivider）       | `<span class="wk-view-sep">`（共享 CSS） | `<nue-divider vertical>`                       |
| 分隔线两侧间距         | 16px（= 组 gap，无 margin）                  | 6 + 4 = **10px**（自带 `margin: 0 4px`） | 8px                                            |
| 渲染尺寸               | 1×16px                                       | 1×16px + margin 0 4px                    | 1×16px                                         |

> **PM 未发现的两项**：① 「未安排 / 今天」有一层**嵌套 wrapper**，而 weekly 没有 → 三视图该处间距口径不同（8 / 6 / 4）；② 分隔线是**两种实现**（NueDivider vs `.wk-view-sep`），周视图自带 `margin: 0 4px` 而另两视图没有 → 即使把组 gap 统一，分隔线两侧间距仍会差 4px。

#### B1-2 头部左组（✅ 位置一致，❌ 宽度不稳定）

- 结构、顺序、`gap="2px"`、四个元素属性三视图逐字一致（侧边栏开关 / ← / 标题 / →）。
- **标题宽度不稳**（`.cal-title`/`.wk-title`/`.day-title` 共享 `min-width: 132px`，实测文本宽度）：

| 文本（标题格式）                       | 实测宽度   | 是否被 `min-width:132px` 兜住 |
| :------------------------------------- | :--------- | :---------------------------- |
| `2026 年 9 月` / `2026 年 12 月`（月） | 132 / 132  | ✅ 稳定                       |
| `9月 · 1日–7日`（周）                  | 132        | ✅                            |
| `12月 · 29日–4日`（周，跨月双位数）    | **148.69** | ❌ 溢出 16.69px               |
| `2026 年 9 月 1 日`（日）              | **145.27** | ❌                            |
| `2026 年 9 月 21 日`（日）             | **155.33** | ❌                            |
| `2026 年 12 月 31 日`（日）            | **165.41** | ❌                            |

⇒ 同一「日视图」内部，切换日期（1–9 号 vs 10–31 号、9 月 vs 12 月）也会让 → 按钮横移 **13–20px**。

#### B1-3 根容器（❌ 三样）

| 视图                     | 根容器规则（现状）                                                                    | 实测高度（真父链下，内容高 518） | 实测内容宽 |
| :----------------------- | :------------------------------------------------------------------------------------ | :------------------------------- | :--------- |
| monthly                  | `height:100%; padding:1rem; background:var(--cal-bg); overflow:hidden`                | 518（本层）→ 网格 450            | 866        |
| weekly                   | `flex:1; min-height:0; overflow:hidden`（**无 padding / 无 height / 无 background**） | 486（撑满）→ 网格 450            | 866        |
| daily（改动后）          | `height:100%; background:var(--cal-bg); overflow:hidden`                              | 486（撑满）→ 网格 450            | 866        |
| daily（`9d5f3a77` 原状） | `height:100%; **padding:1rem**; background; overflow:hidden`                          | 486 → 网格 **418**               | **834**    |

- `.nue-div{box-sizing:border-box}` → 日视图原状 = **双重 padding**（外层 16 + 自身 16 = 32px gutter）：整个日视图（含头部）内缩 16px、网格窄 32px。**这就是「切到日视图时头部/控件整体位移」的最大单一来源，用户已自行删掉。**
- **`flex:1` 是「隐性依赖」**：它只在「父级恰好是 flex 列且高度确定」时才等于撑满。实测换成 block 父级（`.nue-content` 就是 block）时，同一份规则渲染高度 **486 → 88px**（`.wk-body{flex:1;min-height:0}` 随之塌陷）。`height:100%` 在两种父级下都成立。⇒ 这条差异今天**视觉无害**，但**对 §A 的路由化是脆弱点**（新宿主一旦不是 flex 列，周视图会静默塌陷）。

#### B1-4 PM 未发现的其它项

1. **周视图 `is-active` 的「周」按钮绑了 `@click="onGoMonth"`**（`weekly/index.vue:213-221`）→ 在周视图点「周」会**跳回月视图**；月视图的「月」、日视图的「日」都没有 click（正确）。**疑似复制粘贴缺陷**。
2. **窄窗下 wrap 阈值三样**（`.cal-header/.wk-header/.day-header` 共享 `flex-wrap: wrap` + `justify-content: space-between`）：实测同一个 530px 容器 —— **月 80px / 周 36px / 日 80px**（月与日折成两行、周不折）⇒ 该宽度区间内切视图，头部高度从 36→80，网格整体下移 44px。
3. **死代码 3 处**：`.cal-aside-toggle{margin-right:4px}`（`monthly/index.vue:722`，全仓无使用者）、`.cal-nav-btn` 三条规则（`monthly/index.vue:699/714/718`，模板零引用）、`.cal-view-sep`（`calendar-grid.css:120`，仅与 `.wk-view-sep` 共享选择器，自身零引用 = TASK-17 D4 遗留）。
4. **`title` 文案口径不一**（非位移）：月「当前：月视图」/ 周「切回月视图」/ 日「切换月视图」；左侧按钮标题均无 `title`/`aria-label`（TASK-17 已记遗留）。
5. **分隔线选择器缺口**：`calendar-grid.css` 有 `.cal-view-sep, .wk-view-sep`，**没有 `.day-view-sep`**（因为日视图用了 NueDivider）。

### B2 位移根因（含被证伪的假设）

统一口径：把三视图根容器 padding 全部归零后测量（隔离「头部内部差异」），取 898px 宽头部内各控件的左边界（相对容器左沿）：

| 控件                     | 月     | 周     | 日     | Δ(月→周) | Δ(周→日)   | Δ(月→日)   |
| :----------------------- | :----- | :----- | :----- | :------- | :--------- | :--------- |
| 右组容器 / `sort`        | 607.88 | 631.88 | 635.88 | **+24**  | +4         | **+28**    |
| 视图切换组 `toggle`      | 659.88 | 673.88 | 679.88 | **+14**  | +6         | **+20**    |
| 分隔线 `sep`             | 767.92 | 775.92 | 779.92 | +8       | +4         | **+12**    |
| 「未安排」               | 784.92 | 786.92 | 788.92 | +2       | +2         | +4         |
| 「今天」（右锚）         | 856.98 | 856.98 | 856.98 | 0        | 0          | 0          |
| 左组右沿 / → 按钮        | 247    | 247    | 270.33 | 0        | **+23.33** | **+23.33** |
| 视图切换按钮宽度（各态） | 30.02  | 30.02  | 30.02  | 0        | 0          | 0          |

**根因排序（按影响量级）**

| 级别   | 因素                                                                                                    | 量级（实测）                                                                 | 证据                      |
| :----- | :------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------- | :------------------------ |
| **P0** | 日视图根容器**双重 padding**（已由用户未提交改动消除）                                                  | 头部整体 +16px x/y、网格 −32px 宽                                            | B1-3 实测表               |
| **P1** | 右组 **gap 三样（16 / 6 / 8）+ 未安排/今天 wrapper（8 / 直连 6 / 4）+ 分隔线两种实现（+margin 0 4px）** | `sort` **+24/+28px**、`toggle` **+14/+20px**、`sep` +8/+12px、未安排 +2/+4px | B1-1 + 上表               |
| **P2** | **标题宽度不稳**（`min-width:132px` 兜不住日视图 145–165px、周视图跨月 148.69px）                       | 左组右沿/→ 按钮 **+23.33px**（月/周→日）；日期变化再 ±13–20px                | B1-2 实测表 + 上表        |
| **P3** | **wrap 阈值三样**（`flex-wrap` + `space-between`，因 P1/P2 造成总宽不同）                               | 同宽窗口下月/日 80px vs 周 36px → 网格整体 **+44px**                         | B1-4-2 实测（530px 容器） |
| **P4** | 根容器 `flex:1` vs `height:100%`（今天视觉等价）                                                        | 现状 0；换父级时为 **486 → 88px**                                            | B1-3 实测 + §A4           |

**被证伪的假设（省一次白改）**

- ❌ **「`.is-active{font-weight:600}` 让标签变宽 → 切换时控件宽度变化」**：实测四种组合（月视图的月、周视图的周、日视图的日、以及非 active 态）按钮宽度**恒为 30.02px**。原因：CJK 字形 advance 是整字宽（1em=12px），字重不改变 advance；按钮宽 = 12 + 2×8(`--nue-padding-xs`) + 2×1(border) = 30。⇒ **不是根因**，不要按它改（在非 CJK 或可变字宽字体下理论上有偏差，但这三个按钮实测无差）。
- ❌ 「`.cal-aside-toggle` 的 `margin-right:4px` 造成间距差」：该类**零引用**（死代码），不参与渲染。
- ❌ 「三视图的 `nue-divider` 与 `.wk-view-sep` 渲染尺寸不同」：实测两者都是 **1×16px**；差异在**两侧间距**（16 vs 10）而非元素本身。

### B3 修复方案 —— 确立「单一布局基线」

| #    | 基线                                                                                                                                                                              | 具体落点（文件 + 规则）                                                                                                                                                                                                                               |
| :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BL-1 | **padding 归属唯一：路由根容器提供，子视图禁自带**；**采纳用户 daily 改动时须补回 `data-testid="day-unscheduled-entry"`**                                                         | 保留 `.nue-calendar-monthly{padding:1rem}`（`monthly/index.vue:691-696`，同时建议补一行注释说明它其实是「日历节根容器」）；`.nue-calendar-weekly`/`.nue-calendar-daily` **不得**声明 padding。**采纳用户对 daily 的未提交改动，且不推广到 monthly。** |
| BL-2 | **头部三层 gap 统一**：L1 外层 `var(--nue-gap-xs)`(=8px)：L2 左组 `2px`；L3 右组 `var(--nue-gap-xs)`(=8px)，**并压平「未安排/今天」的 wrapper**（三个视图都改成右组的直接子元素） | `monthly/index.vue:415/461/492`、`weekly/index.vue:159/196`、`daily/index.vue:241/263/294`；把字面量 `8px`/`6px` 统一成 `var(--nue-gap-xs)`（token 化）                                                                                               |
| BL-3 | **分隔线单一实现**：三视图统一用共享 `.view-sep` span（1×16 + `margin: 0 4px`）                                                                                                   | `calendar-grid.css:120-127` 已存在 `.cal-view-sep,.wk-view-sep` → 追加 `.day-view-sep`；三个头部各换成 `<span class="cal-view-sep                                                                                                                     | wk-view-sep | day-view-sep" aria-hidden="true">`，删掉两处 `<nue-divider vertical>`。**收益**：顺带清掉 TASK-17 D4 遗留与 `.cal-view-sep` 死代码 |
| BL-4 | **标题宽度稳定**：`.cal-title/.wk-title/.day-title` 共享 `min-width` **≥ 176px（11rem）**                                                                                         | `calendar-grid.css:66-80` 的共享规则把 `min-width:132px` → `11rem`（实测最长 165.41px，留 ~10px 余量；`text-align:center` 保证文本恒居中）。**收益**：跨视图、跨日期的 → 按钮位置恒定；左组宽度恒定 ⇒ 与 BL-2 一起消除 P2/P3                          |
| BL-5 | **根容器 flex/height 口径统一为 `height:100%`（+ 保留 `min-height:0`）**                                                                                                          | `.nue-calendar-weekly` 的 `flex:1` → `height:100%; min-height:0`（今天等价，路由化/换父级后不再静默塌陷）；顺带给 weekly 补 `background: var(--cal-bg)`（今天由父级提供，视觉 no-op）                                                                 |
| BL-6 | （可选，收尾）删除死代码 `.cal-aside-toggle` / `.cal-nav-btn`（×3）                                                                                                               | `monthly/index.vue:699-725`；`.cal-view-sep` 经 BL-3 转为**在用**                                                                                                                                                                                     |
| BL-7 | （同批修补，非位移相关）周视图 active「周」按钮去掉 `@click="onGoMonth"`；三视图 `title` 文案口径统一                                                                             | `weekly/index.vue:213-221`                                                                                                                                                                                                                            |

**预计效果**：三视图头部**结构同构**（同层同 gap / 同分隔线 / 同标题宽度）⇒ 右组各控件与左组 → 按钮在切视图时**零位移**；wrap 阈值因结构完全一致而**自动趋于一致**（P3 消失）；根容器口径一致（P4 消失）。

### B4 影响面与回归风险

- **月视图**：标题 `min-width` 132→176（左组加宽 44px）、右组 gap 16→8（紧凑化）、分隔线换元素（视觉近似）→ 需用户确认观感；月份网格逻辑零改动。
- **周视图**：右组 6→8、未安排/今天 6→8、分隔线两侧 10→12、根容器 `flex:1`→`height:100%` ⇒ **本项改动最大**，需实测宽/窄窗两周。
- **日视图**：已由用户改动对齐 padding；本批再对齐右组 gap（4→8）与分隔线实现。
- **宽/窄窗**：`flex-wrap` 行为改变（统一后阈值一致）→ 必须在 ~1280 / ~1024 / ~900 / ~700 四档宽度各看一遍。
- **移动端红线**：本次建议**只动** `apps/web/src/components/calendar/**` 与 `calendar-grid.css`；`packages/presentation-react`、`apps/mobileapp` **零改动**（两处均不含日历头部样式，grep 确认）。
- **不动的契约**：`calendar-grid.css` 的 `.cal-*`/`.wk-*` 令牌与网格规则（格/条/线/溢出）**不动**；`.nue-calendar-*` 以外不改；服务端契约与展示层排序不动。
- **测试基线**：TASK-17 的硬约束是「既有测试全绿且不改测试文件」；本批若只改 CSS/标记，理论零测试改动（**但 daily-interactions/daily-view 会断言头部结构**，统一 wrapper 后可能触发断言 → 需先跑一遍确认；这是本批最可能的测试连带改动点）。

### B5 验证方式

1. **人眼观感（必做）**：宽窗（≥1280）逐次切 月→周→日→月，盯三处：① 视图切换组三个按钮的**左边界不动**；② → 按钮不动；③ 头部高度不变（36px）。再在日视图连续点 →（1 号 → 31 号 → 跨到 12 月）确认 → 按钮不抖。最后在 ~700px 窄窗复查一次（应同时折行或同时不折）。
2. **可自动化的结构断言（推荐，`vp test` 可跑）**：jsdom **无布局引擎** ⇒ 几何断言不可自动化。可自动化的是**结构一致性**：
    - 挂载三视图头部（或直接静态解析 `calendar-grid.css` + 三个 `.vue` 模板），断言：① 三层容器的 `gap` 值三视图逐一相等；② 右组子元素序列一致 = `[sort, toggle, sep, 未安排, 今天]`；③ 分隔线用**同一套**类名/规则；④ 标题 `min-width` 三视图同值且 ≥ 最长文案宽度常量。
    - 断言「样式归属」：三个视图的 `<style>` 不得声明 `.xxx-header` 的 gap 与根容器 padding（扩展 TASK-17 AC3 的静态核验范式）。
3. **几何回归（可选，一次性工具而非 CI）**：本诊断已证明可行 —— headless Chromium 加载 `calendar-grid.css` + 真实头部标记，逐元素 `getBoundingClientRect`，对「切视图前后同名控件 x 相同」做阈值断言（如 |Δx| ≤ 1px）。若要纳入 CI 需引入 Playwright（超出本单范围 ⇒ 决策点 C-5）。
4. **验收数字（供手工测试当尺子）**：宽窗下三视图 `sort` / `toggle` / `sep` / 「未安排」/「今天」左边界**应完全一致**；实测现状位移（真实 padding 下）= 月→周 `+40 / +30 / +24 / +18 / +16px`、月→日 `+44 / +36 / +28 / +20 / +16px`，BL-1…BL-4 落地后应全部为 **0**；头部高度恒 36px。

---

## C. 需 PM 拍板的决策点

| #   | 决策点                                                               | 选项                                                                                      | 架构建议                                                                          |
| :-- | :------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| C-1 | 路由方案                                                             | (a) 三子路由（方案 1，含宿主上移）(b) query 同步（方案 2）(c) 本轮不做                    | **若目标只是深链/回退 → (b)**；(a) 仅在「必须三段路径」时做，且与宿主上移同单     |
| C-2 | 切视图是否写历史                                                     | `push`（返回键回上一个视图）/ `replace`（不写）                                           | `replace`（切视图不是「导航」语义，避免污染返回栈）                               |
| C-3 | 切视图是否保留当前打开的 `taskId`（详情抽屉）                        | 保留 / 切视图即关抽屉                                                                     | 保留（URL 语义更完整，且三条路由都带 `:taskId?` 时零成本）                        |
| C-4 | 是否接受 `LAST_CALENDAR_ROUTE` 恢复 sub-route（含 taskId）           | 接受 / 只恢复视图不恢复 taskId / 关闭该机制                                               | 接受（与 tasks 段一致；修 §A2-③ 后自动生效）                                      |
| C-5 | 是否引入 Playwright 做头部几何回归                                   | 引入 / 保持手工 + 结构断言                                                                | 暂不引入（本单已给出可复现的手工/一次性探针方法）                                 |
| C-6 | daily 未提交改动（删 `padding: 1rem`，`daily/index.vue`）            | 采纳 + 补回 testid / 整体回退（**不可原样提交：`daily-view.test.ts` 现为 1 failed / 3**） | **采纳**（实测为双重 padding 修复，删后三视图像素级一致），**不要**推广到 monthly |
| C-7 | 头部统一后是否同步修 BL-7（周视图 active「周」按钮误绑 `onGoMonth`） | 同批修 / 另立单                                                                           | 同批修（一行改动，且属同一处代码）                                                |

---

## D. 遗留项

1. `viewMode` 若走方案 2，仍不持久化（与 ADR A3 一致）；若走方案 1，视图进入 URL = **事实上的持久化**，需回头在 ADR 记一行（A3 语义变更）。
2. 侧边栏开关在三个视图均无 `title` / `aria-label`（TASK-17 遗留，本单不扩大范围）。
3. `.nue-calendar-monthly` 命名与实际职责（日历节根容器）不符 ⇒ 建议后续重命名为 `.nue-calendar-layout`，但**不在本批**（surgical changes）。
4. 日视图标题为静态（无点击），与月/周可点标题的交互差异属 TASK-17 D1 既有决策。

---

## 附录：测量方法与原始数据（可复现）

**方法**：把真实主题 CSS（`nue-ui-theme-shadlike` 的 `variables/html-reset/div/button/divider/container` + `apps/web/src/themes/variables.css` + `apps/web/src/components/calendar/calendar-grid.css`）与**逐字复刻的三个头部标记**放进单个 HTML，用 `chromium --headless=new --dump-dom` + 页内 `getBoundingClientRect` 输出 JSON。字体命中 `Noto Sans CJK SC`（与 `--nue-primary-font-family` 同栈），`--nue-primary-font-size: 16px`（= `--nue-text-df`）。

- 零 padding 基准（隔离头部内部差异，头部宽 898px）：`sort` x = 607.88 / 631.88 / 635.88（月/周/日）；`toggle` x = 659.88 / 673.88 / 679.88；`sep` x = 767.92 / 775.92 / 779.92；「未安排」x = 784.92 / 786.92 / 788.92；「今天」x 恒 856.98；左组右沿 = 247 / 247 / 270.33；按钮宽恒 30.02。
- 真实 padding 基准（月 16 / 周 0 / 日 0）：`sort` x = 591.88 / 631.88 / 635.88（月↔周 **+40px**、月↔日 **+44px**）。
- 真父链（`.nue-content` → `.nue-calendar-monthly`）网格矩形：月 `dx=17,w=866,h=450`；周 `dx=17,w=866,h=450`；日（改动后）`dx=17,w=866,h=450`；日（原状）`dx=33,w=834,h=418`。
- 标题宽度：见 B1-2 表。wrap 对照（530px 容器）：月/日 header `80px` vs 周 `36px`。
- `vue-router@5.2.0` 探针：`redirect` 模式下 `beforeEach` 看到 `name='calendar-monthly'`（section 恢复失配）；`beforeEnter` 模式下看到 `name='calendar'`（可恢复）；两种模式 `matched` 均为 `index,calendar,<child>`。