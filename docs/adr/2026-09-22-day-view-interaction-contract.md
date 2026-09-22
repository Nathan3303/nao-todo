# 2026-09-22 日视图交互契约（贴边名称 / 左右缘拉伸 / 空白平移 / 刻度创建入口 / 全天只读条）

- **状态**：✅ 已拍板（arch-designer **T83** 裁决；PM 落盘）
- **关联**：PRD `docs/prds/2026-09-22-day-view-adjustments.md`；轴参数 ADR `2026-09-22-day-view-zoom-and-axis-parameterization.md`（**r2 双向互记**）；上游 TASK-16 ADR（C8 手势壳 / C9 写回链路唯一 / C13 真实值锚 / D2 离开视图不夹取 / D4 吸附 / D5 内联新建）；TASK-19 批次（`c08b7b3c` / `5eac8ff9`）
- **范围**：`apps/web/src/components/calendar/daily/**`、`monthly/task-bar.vue`（**仅 opt-in prop，默认零变化**）；**不动**领域 / 服务端 / 移动端 / `packages/presentation-react`

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-22** | 首次成文：T83 裁决的交互级约束 C1–C10（sticky 锚定链 / 手柄可见性不变量 / 左缘拉伸写回 / 空白平移 / 刻度创建入口 / 全天只读条 / 裁切遮罩 / 性能口径 / 锚定破坏清单 / supersede 清单）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **r2** | **2026-09-22** | **C2 改写（用户裁决）**：撤销 T83「手柄可见性不变量」，改为「**两侧手柄恒在、不做 `isStart`/`isEnd` 门控**」（左拉改 `startAt`、右拉改 `endAt`）；新增**已知可接受**登记（续接段改动落在相邻日、当前视图不可见、拖动看似无反应）；**C3 锚点约束不变且强化**（必须真实 `startAt`/`endAt` 为锚，且**不得夹取到可见日边界**）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **r3** | **2026-09-22** | **契约补全（T84 用例先行报备 6 项）**：① 新增 **C11 `n` 快捷键契约**（复用 id `calendar.quick-create` + 按 `viewMode` 分支 + 默认时段口径）；② **C6** 补全天原因提示的**机器可断言载体** `data-allday-reason`（`span-over-24h` / `end-only`）+ `title` = 任务名 + 原因（**不覆盖任务名**）；③ **C7** 遮罩类名定死 `.day-edge-fade.is-start` / `.is-end`；④ **C5** 首末列标签边界类名 `.is-first-tick` / `.is-last-tick`；⑤ 勘误：PRD 原称「`daily-view` 有 3 处 `.day-allday-chip` 断言待改」**为误述**（实为 `.day-allday-lane` 结构断言；chip 断言系 T84 新增）；⑥ AC7 的「pan 到两端 / 极端窄容器」标注为**人工验收**（jsdom 不可断言）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **r4** | **2026-09-22** | **T85 实现报备 7 项处置（PM 门禁复核后裁决）**：① **C5** `aria-hidden` 精确化为「**仅空文本列**隐藏；带文本列**不**隐藏」（否则唯一新建入口 `button` 的 `aria-label` 会被一并移出无障碍树，与 C5 自相矛盾）；② **C5** `aria-label` 统一用 **`HH:MM`**（×1 档可见文本为 `HH` 时亦然，无障碍更明确）；③ **C5** 自足回退 `tasks` = **store 已知任务 ∪ 查询快照（按 id 去重）**（仅「无宿主独立挂载」路径；真实应用由宿主 provide，不走此路径）—— 接受并登记，替代方案 = 让该用例 `await nextTick`；④ **C6** 新增第二个 opt-in prop **`titleSuffix`**（默认 `undefined` ⇒ 月/周零变化），`title = titleSuffix ? 任务名（后缀） : 任务名`；⑤ **C6** 全天泳道用 `.day-allday-slot`（`relative`，220×20）承载绝对定位 `task-bar` + `.day-allday-items` flex-wrap ⇒ 换行 + 纵向生长，**未**在 `.day-scroll` 与 `.day-allday-lane` 之间插包装层（结构契约保持）；⑥ sticky 锚定链审计通过（新增 CSS 未在 `.day-seg`/`.cal-lanes`/`.day-grid`/`.day-scroll`/`.cal-item` 加 `overflow≠visible`/`contain≠none`/`transform`/`filter`；`.day-col-label` 的 `transform` 只作用于列头按钮自身）；⑦ jsdom 不可断言项（sticky 实贴、`clip-path` 副作用、标签居中像素、遮罩显示条件、pan 手感、×4 帧率、续接段两侧手柄）→ **人工验收清单** |

## 1. 事实基线（T83 读码结论）

- **sticky 原路径被证伪**：`task-bar.vue` 的 `.cal-item` 有 `overflow: hidden`（文本裁切用）⇒ 它**自身即最近 scrollport** ⇒ `position: sticky; left: 0` 挂 `.cal-item-text` 时偏移恒为 0，**名称完全不动**。第二个独立阻断点：`.cal-item-text { flex: 1 }` ⇒ 名称宽 ≈ 条宽 ⇒ 可滑动余量 ≈ 0。
- 层叠链：`.day-body`(overflow:auto，**唯一 scrollport**) → `.day-scroll`(无 overflow) → `.day-grid` / `.day-allday-lane`(无) → `.cal-lanes`(无，仅 `pointer-events:none`) → `.day-seg`(无) → **`.cal-item`(overflow:hidden ← 元凶)** → `.cal-item-text`。链上只有 `.cal-item` 需改。
- 手势阈值已有单一来源：`use-drag-schedule.ts:15` 导出 `DRAG_THRESHOLD_PX = 5`（`:28` 用欧氏平方 `dx²+dy² ≥ 25` 判定）。
- 单例与落点先例：`useDialogManager = () => new DialogManager()`（每次 new）；**全 Web 应用只有 1 个调用点** `index-view.ts:66`，经 `INDEX_VIEW_CONTEXT_KEY` provide；`dialog-adapter.vue`（注册 `TASK_CREATOR_DIALOG_KEY` 处）与 `calendar-view.ts`（写入 `CALENDAR_VIEW_CONTEXT_KEY.dialogManager`）**注入同一 key ⇒ 同一实例**；`daily/index.vue` 已 `inject(CALENDAR_VIEW_CONTEXT_KEY, null)`（TASK-19 已加）⇒ **零新增管道**。先例：`use-calendar-monthly.ts:236-239` 的 `createTaskOnDay()` 已是 `dialogManager.open(TASK_CREATOR_DIALOG_KEY, { startAt: ISO, endAt: ISO })`。

## 2. 交互级契约

### C1 贴边名称（sticky 锚定链）

- 名称：`position: sticky; left: 0` + `width: max-content; max-width: 100%`（**必须收缩到内容宽**，否则无可滑动余量）。
- `.cal-item`：以 **`clip-path: inset(0)`** 替代 `overflow: hidden`（**视觉剪裁等价，但不建立 scroll container**）。**opt-in**：由 prop（如 `stickyLabel?: boolean`，默认 `false`）门控 ⇒ **月/周 DOM/CSS 逐字节零变化**。
- **硬约束**：`.cal-item-text → .day-body` 之间**不得存在任何 scroll container** ⇒ **禁止**在 `.day-seg` / `.cal-lanes` / `.day-grid` / `.day-scroll` / `.cal-item` 上新增 `overflow(≠visible)`、`contain(≠none)`、`transform`/`filter`（会改包含块/层叠）而不重新验证本特性。`.day-axis-bg`（无子节点、无 sticky 后代）**可**加 `contain: paint`。
- **登记为约束的必然结果（须进 AC3 文案）**：可滑动余量 = **条宽 − 名称宽**；**名称宽 ≥ 条宽时为 0** ⇒ 名称随条滚出（**非缺陷**，是「不越出自身条」的必然结果）。
- **回退方案（不推荐）**：`scrollLeft` 驱动 `transform: translateX(clamp(...))` —— 钳制上界依赖名称**实测宽** ⇒ 逐帧读布局 = layout thrash。

### C2 两侧手柄恒在（r2 修订 —— 用户 2026-09-22 裁决，取代 T83 原不变量）

> **两侧手柄恒在**：任务条**左右缘各一个手柄**，**不做 `isStart` / `isEnd` 门控**（续接段也不移除任何一侧能力）。
> **语义**：**左拉改 `startAt`（`endAt` 不变）**；**右拉改 `endAt`（`startAt` 不变）**。

- **用户原话**：「不用移除，左侧也需要同样的功能，左侧拖拉是改动开始时间，右侧拖拉是改动结束时间。」
- **被取代的 T83 原不变量**：「左手柄 ⟺ `isStart`；右手柄 ⟺ `isEnd`」（理由：手柄只在其拖动所改的时间**在当前视图可见**时存在）。T83 给出 (i) 同单禁止 / (ii) 挂账两案；用户选择**两案之外的第三种：两侧恒在、完全对称**。
- **⚠️ 已知可接受（用户明确要求，登记防误判）**：对**跨日任务的续接段** ——
    - `isStart === false`（条左缘被裁到 `00:00`）左拉 ⇒ 改的是**前一天**的 `startAt`；
    - `isEnd === false`（条右缘被裁到 `24:00`）右拉 ⇒ 改的是**次日**的 `endAt`；
    - 二者**改动落在当前视图之外**，条不会延伸（已被日界裁掉）⇒ 拖动**看起来「没反应」**，直至改动跨越 `00:00` / `24:00` 才显现；**写回与撤销 toast 仍正常发生**。
    - 这是「两侧恒在」的**必然代价**，**不是缺陷**；T83 的「小位移引发大语义变更」风险**被用户接受**。
- **TASK-16 C13（真实值锚）仍是硬约束**（不受本修订影响）：两侧手柄的拖动原点**必须**是**真实 `startAt` / `endAt`**，**禁止**用裁剪后的 `00:00` / `24:00` 反推（否则跨日任务每拖一次就漂移一次）。

### C3 左缘拉伸写回

1. **新增第三种手势**（如 `gesture='resize-start'`），**不得**复用「时长不变」的 move 分支；写回 `{ startAt: newStart, endAt: 真实 endAt 不变 }` ⇒ **时长改变**（与右缘同族）。 **两侧手柄恒在**（见 C2 r2）：左右手柄**同规格同行为**，唯一差别是所改字段。
2. 锚点 = **真实 `startAt` + Δ**（C13）；`Δ = (clientX − originX) ÷ perMin`（`pxPerMinute` 已档位无关）。
3. 吸附 `round` + 最短 `DAY_SNAP_MINUTES`：钳制 `newStart ≤ realEnd − DAY_SNAP_MINUTES`（领域不变量 `start ≤ end` 由**该钳制**保证，不得依赖领域报错）。
4. 写回链路仍走 `useCalendarSchedule` 快照 + U2 撤销内核（**TASK-16 C9 写回链路唯一不变**）；失败回退同右缘。
5. 手柄 DOM：`.day-task-resize--start`（`left: -3px`），与右缘同规格（8px 宽、`pointer-events: auto`）；注意不被 `.cal-item::before`（左缘 2px 优先级色条）遮挡（手柄在 `.day-seg` 内、`z-index: 3` 已高于条）。
6. **遵守 TASK-16 D2（离开视图不夹取）+ r2 明确**：因两侧手柄恒在，写回值**不得夹取到可见日边界** —— 左拉续接段时 `newStart` 允许早于当天 `00:00`（落在前一天）、右拉续接段时 `newEnd` 允许晚于当天 `24:00`（落在次日）；计算式 = `真实锚点 + Δ`（Δ 可为负偏移或超 24h），**禁**以 `[0, 1440]` 夹取。

### C4 空白平移（pan）

- **阈值 = `DRAG_THRESHOLD_PX`（5px，单一阈值）**：**禁止**另设 4px 等第二套阈值（否则「同样小位移，条上算点击、空白处算平移」不可解释）。
- 仅横向：`scrollLeft = startScrollLeft − (clientX − startX)`；纵向不变；未超阈值 ⇒ 不滚动。
- **目标排除清单（零抢占）**：pan 监听挂 `.day-body` **冒泡相**，首行 `if (target.closest('.cal-item, .day-seg, .day-task-resize, .day-cols-head, .day-allday-lane')) return`。
    - 条上由 `useDragSchedule` 独占（只「不处理」，**不** `stopPropagation`、**不** `preventDefault` ⇒ 顺序无关）。
    - **列头必须显式排除**（TASK-19 的 D5 结构下 header 在 `.day-body` 内）⇒ 解决「从刻度标签起拖既 pan 又开对话框」。
- 指针捕获：`setPointerCapture` 于 `.day-body` + 结束释放 ⇒ 无需 window 级监听、卸载即释放。
- **禁**在 `pointermove` 中读取布局（`offsetWidth` / `getBoundingClientRect`）—— pan **起始时**一次性读取除外。
- `.day-body.is-panning { cursor: grabbing; user-select: none }`；`.day-axis-track` 的 `cursor: pointer`（为已退休的「点击空白新建」服务）**改为 `grab`**。
- **不**并入/泛化 `useDragSchedule`（TASK-16 C8 禁第三套**任务拖拽会话壳**；pan 是不同关注点：1D 滚动、无吸附、无写回）。可新建极小 `daily/use-day-pan.ts`，仅复用 `DRAG_THRESHOLD_PX` 与「阈值/取消/卸载清理」形状。

### C5 刻度创建入口（取代 TASK-16 D5）

- **仅「带文本」刻度可点**；空文本列**不可点、不参与 tab、不触发 pan**。
- **可访问性 = 原生 `button`**（唯一的新建入口必须键盘可达；Tab + Enter/Space 免费）：`<button class="day-col-label" type="button" aria-label="在 14:30 创建任务" title="…">14:30</button>`。
- **DOM 形态**（同时解决「点击目标 ≠ 可见标签」的错位）：

    ```text
    .day-cols-head > .day-col-head（grid item，非交互，aria-hidden）
                       └─ [仅带文本列] <button class="day-col-label">
                            position: absolute; left: 0; transform: translateX(-50%)
                            （首列 translateX(0)、末列 translateX(-100%) 边界保护）
    ```

    ⇒ 点击目标 = 可见标签本身；`[data-testid="day-columns"]` 的**直接子节点数仍 === 列数**（按钮是孙节点）⇒ 既有冻结契约不受影响；标签文本仍在 `textContent` 内 ⇒ 「24/48 个有文本」断言口径不变。

- 48 个 tab stop **接受**（它们是日视图主入口）；若将来嫌噪，另立单做 roving tabindex，**不得**在本单降级为 `tabindex="-1"`。
- **无障碍细节（r4 定案）**：① `aria-hidden` **仅加在空文本列**的 `.day-col-head` 上 —— 带文本列**不隐藏**，否则其内唯一新建入口 `button` 的 `aria-label` 会被一并移出无障碍树（与 C5「必须可访问」自相矛盾）；② `aria-label` 统一格式 **`在 HH:MM 创建任务`**（即使 ×1 档可见文本为 `HH`，无障碍侧仍给完整时刻，更明确）。
- **首末列边界类名（r3，供结构断言）**：首/末**带文本**列分别加 `.is-first-tick` / `.is-last-tick`（居中由 CSS `transform: translateX(-50%)` 承担，边界保护由这两个类切换为 `translateX(0)` / `translateX(-100%)`）；**居中效果本身归人工验收**（jsdom 不可断言）。
- payload：**ISO** `{ startAt: dayjs(anchorKey).startOf('day').add(tickMin,'minute').toISOString(), endAt: +DAY_SNAP_MINUTES }`，**逐字镜像 `createTaskOnDay`**。
- **落点 = 宿主桥（单一 payload 构造点）**：新增 `CalendarDayContext.onCreateTaskAt(startMin)`，宿主侧与 `createTaskOnDay` **相邻**实现（复用同一 `prefillScope()` + `dialogManager`）；日视图自足回退（`use-calendar-day.ts` 已注入 context 作兜底）实现同一函数。**禁**日视图直连构造 payload。
- **自足回退的任务来源（r4 登记）**：无宿主直挂时，`tasks` = **`tasksStore` 已知任务 ∪ `useCalendarTaskQuery` 快照**（按 `id` 去重，`Map` 合并）—— 使「挂载即渲染」在同步断言下成立。**影响面仅限「无宿主独立挂载」路径**（真实应用由宿主 provide 日上下文，不走此路径）。**替代方案**（若日后要求回退语义纯净）：让该用例 `await nextTick` 后断言。
- 日视图**不再渲染**内联编辑器：同步删除 `onTrackClick`、`day-quick-create` 节点、`quickCreate*` 状态、`.day-quick-create` 样式、`QuickCreate` import（本单造成的孤儿）；`quick-create.vue` 组件本体**保留**（月/周在用）。

### C6 全天只读条

- 复用 `task-bar`（**无 bespoke 复制**）；**无**拖拽/拉伸手柄。
- **不可拖拽原因：机器可断言载体 + 人读 title（r3）**：任务条根元素加 **`data-allday-reason`**，取值 `span-over-24h`（跨度超过 24 小时）| `end-only`（仅设了截止时间）；同时 `title` = **`任务名（原因文案）`** —— ⚠️ **不得覆盖任务名**（`task-bar.vue:90` 原本 `:title="task.name"`）。原因文案（中文，两种）：`全天任务，跨度超过 24 小时，日视图内不可拖拽` / `全天任务，仅设了截止时间，日视图内不可拖拽`。**断言口径**：`[data-allday-reason]` 存在、取值 ∈ 上述两值、同屏两类任务时**取值互异**；`title` **包含**任务名。
- `title`/提示按**原因分档**（≥2 种：跨度超过 24 小时（跨整天）/ 仅设了截止时间（无开始时间）），须可被结构断言。
- **保持既有结构契约**：`.day-allday-lane` 仍为 `.day-scroll` 的**直接子节点**、且 `nextElementSibling === .day-grid`（现有冻结用例已断言）⇒ **不得**插入包装层。

### C7 裁切渐隐遮罩

- 置于**滚动容器之外**：新增 `.day-body-wrap`（`position: relative`）包住 `.day-body` + 两个绝对定位遮罩；`pointer-events: none`。
- 仅当该侧确有可滚动内容时显示（由 `scrollLeft` / `maxScroll` 驱动，rAF 合并）。
- **类名定死（r3，供结构断言）**：`.day-body-wrap > .day-edge-fade.is-start` / `.day-edge-fade.is-end`；两者 `pointer-events: none`。**断言口径**：`.day-body-wrap` 存在、`.day-body` 在其内、`.day-edge-fade` 恰好 2 个且类名分别为 `is-start` / `is-end`。
- **禁**计数徽标；**禁**把遮罩放进 `.day-body`（会随内容滚动）。

### C8 性能口径

- **结构性硬断言（进 CI）**：① `.day-cols-head` 子节点数 === 列数（×4 = 288）、`.day-axis-bg` 子节点 === 0、`.day-allday-lane` 内条数 === 全天任务数、`.cal-lanes` 内段数 === 当日段数（与档位无关）；② 缩放/pan/拖拽不触发任务列表重拉；③ `dayScrollWidthCss(4, 288)` 字符串断言（含 `calc(288 * 20px)`）。
- **手工门槛（人眼验收，Chrome Performance，记录一次）**：×4 首次渲染 / 档位切换 `Recalc Style + Layout + Paint` **≤ 100ms**；×4 连续 pan 3s、连续拖条 3s **p95 帧时长 ≤ 20ms（≥50fps）** 且无 >100ms 长任务；结论口径 = **「不退化」**（与 ×3 档目视 + 帧率无可感知差异）。
- **允许**：四层 CSS 渐变格线（单元素）；`contain: paint` **仅**加在无 sticky 后代的叶子（`.day-axis-bg`）；列头 288 个 div 全渲染（保契约）；`model` 纯函数重算。
- **禁止**：在 `scroll`/`pointermove` 回调读布局（pan 起始一次性除外）；给 `.day-seg` **祖先链**加 `overflow`/`contain`/`transform`/`filter`（**会再破 sticky**）；给列头加额外节点/内联样式（除容器 `grid-template-columns`）；`will-change`（层爆炸）。
- **不引入虚拟化**：① 列头是静态等宽 DOM，288 个空 div 成本可忽略；② 段数不随档位增长；③ 滚动窗口会**打破「列头子节点数 === 列数」契约与 AC6 断言**，并给 pan 引入窗口重算，收益为负。
- 规模校验：`.day-scroll` 最大宽 5760px（1200 容器）、`scrollLeft` 上限 4560px，远低于浏览器 ~33M px 限制。

### C9 锚定破坏清单

任何祖先新增 `overflow(≠visible)` / `contain(≠none)` / `transform` / `filter` ⇒ **必须重新人工验证 C1**。

### C10 supersede 清单

- **TASK-16 D5（日视图内联快速新建 = 本地编辑器）由 C5 取代**；`quick-create.vue` 组件本体保留。
- `snapMinutes(…, 'floor')` **在生产路径失去唯一消费者**（仅剩单测）⇒ 登记为**已退役模式**（保留纯函数与用例，不删除；要删另立单）。
- **不变**：TASK-16 C3（`packLanes` 单一实现）/ C8（手势壳）/ C11（领域零污染）/ C12 / C14；TASK-19 D2（吸附恒 30 分钟）/ D3（`max()` 下限）/ D5（滚动容器落点）/ V1（`+N` 折叠退休）。
- 轴参数类（档位 / 粒度 / 下限 / 格线层级）见轴 ADR（含其 **r2**）。

### C11 `n` 快捷键契约（r3 新增；用户已批准「`n` 并入本批」）

- **复用既有命令 id `calendar.quick-create`**（**不新增第二个 `n` 绑定**；registry 键保持稳定）；`scope: CALENDAR_KEY_SCOPE`（宿主 `useScope` 承接）。
- **按 `viewMode` 分支**：`month` / `week` → **保持现状**（打开月/周的内联快速新建，行为零变化）；`day` → **改为打开创建对话框**（经宿主桥 `onCreateTaskAt(defaultStartMin)`）。
- **默认时段口径（PM 定案）**：锚点日 = 宿主 `selectedKey`（当前选中日）；`defaultStartMin` = **今天**：`ceil(nowMin / 30) * 30`（即下一个 30 分钟刻度；已过 23:30 则取 23:30）；**非今天**：`540`（09:00）；跨度 = `DAY_SNAP_MINUTES`（30 分钟）。
- **断言口径**：`calendar.quick-create` 命令存在且 `n` 绑定不变；日视图下触发 → 调用 `onCreateTaskAt`（mock 可断言入参为上述口径）；月/周下触发 → 行为与基线一致。

## 3. 红线复核

月/周 **DOM/CSS 可证零变化**（`is-sticky-label` 门控 + allday 结构契约保持）✓；移动端 / `packages/presentation-react` / 服务端 / 领域**零改动** ✓；`guard:ddd` 无影响 ✓；无 keep-alive ✓；`packLanes` 不动（C3 硬红线）✓。

## 4. 人工验收必须覆盖（jsdom 不可断言）

1. sticky 贴边 + 不越出条（**含「名宽 ≥ 条宽 ⇒ 随条滚出」的反例**）；条完全可见时名称位置与改动前**逐像素一致**。
2. `clip-path` 无副作用：hover / 优先级色条 / 三点改期下拉菜单显示与层级正常；月/周任务条外观与基线截图一致。
3. pan 手感 + 「从刻度标签起拖不误触」+ 未超阈值不滚动。
4. ×4 帧率门槛（C8 手工口径）；遮罩两端显示条件。
5. **续接段两侧手柄**（r2）：跨日任务在**当天视图内**拖其续接段的左/右缘 —— 确认**写回与撤销 toast 发生**、条**不延伸**（已知可接受）、且**不漂移**（连续拖两次回到同一时间 = C13 真实值锚成立）。