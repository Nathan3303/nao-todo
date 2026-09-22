# 2026-09-22 日视图交互契约（贴边名称 / 左右缘拉伸 / 空白平移 / 刻度创建入口 / 全天只读条）

- **状态**：✅ 已拍板（arch-designer **T83** 裁决；PM 落盘）
- **关联**：PRD `docs/prds/2026-09-22-day-view-adjustments.md`；轴参数 ADR `2026-09-22-day-view-zoom-and-axis-parameterization.md`（**r2 双向互记**）；上游 TASK-16 ADR（C8 手势壳 / C9 写回链路唯一 / C13 真实值锚 / D2 离开视图不夹取 / D4 吸附 / D5 内联新建）；TASK-19 批次（`c08b7b3c` / `5eac8ff9`）
- **范围**：`apps/web/src/components/calendar/daily/**`、`monthly/task-bar.vue`（**仅 opt-in prop，默认零变化**）；**不动**领域 / 服务端 / 移动端 / `packages/presentation-react`

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                              |
| :----- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **r1** | **2026-09-22** | 首次成文：T83 裁决的交互级约束 C1–C10（sticky 锚定链 / 手柄可见性不变量 / 左缘拉伸写回 / 空白平移 / 刻度创建入口 / 全天只读条 / 裁切遮罩 / 性能口径 / 锚定破坏清单 / supersede 清单） |

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

### C2 手柄可见性不变量

> **左手柄 ⟺ `isStart === true`；右手柄 ⟺ `isEnd === true`。** 即「手柄只在**段边界与真实时间边界重合**时出现」——手柄只在其拖动所改的时间**在当前视图可见**时存在。

- 取代「左禁右许」式特例解释；一条规则同时覆盖左右与首末两端。
- **TASK-16 C13（真实值锚）不被削弱、反被强化**：左手柄拖动原点必须是**真实 `startAt`**；本不变量恰好**消除了「真实锚点在视图外」的全部情形**。
- 几何补强（比 PM 原理由更硬）：`isStart === false` 时向左拖**恒为 no-op**（`newStartMin ≥ 0`），向右拖虽有效却会改**不可见的前一天**时间 ⇒ 小位移引发大语义变更。

### C3 左缘拉伸写回

1. **新增第三种手势**（如 `gesture='resize-start'`），**不得**复用「时长不变」的 move 分支；写回 `{ startAt: newStart, endAt: 真实 endAt 不变 }` ⇒ **时长改变**（与右缘同族）。
2. 锚点 = **真实 `startAt` + Δ**（C13）；`Δ = (clientX − originX) ÷ perMin`（`pxPerMinute` 已档位无关）。
3. 吸附 `round` + 最短 `DAY_SNAP_MINUTES`：钳制 `newStart ≤ realEnd − DAY_SNAP_MINUTES`（领域不变量 `start ≤ end` 由**该钳制**保证，不得依赖领域报错）。
4. 写回链路仍走 `useCalendarSchedule` 快照 + U2 撤销内核（**TASK-16 C9 写回链路唯一不变**）；失败回退同右缘。
5. 手柄 DOM：`.day-task-resize--start`（`left: -3px`），与右缘同规格（8px 宽、`pointer-events: auto`）；注意不被 `.cal-item::before`（左缘 2px 优先级色条）遮挡（手柄在 `.day-seg` 内、`z-index: 3` 已高于条）。
6. **遵守 TASK-16 D2（离开视图不夹取）**：`newStartMin` 由 `clientX ∈ [rect.left, rect.right]` 天然限界。

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
- payload：**ISO** `{ startAt: dayjs(anchorKey).startOf('day').add(tickMin,'minute').toISOString(), endAt: +DAY_SNAP_MINUTES }`，**逐字镜像 `createTaskOnDay`**。
- **落点 = 宿主桥（单一 payload 构造点）**：新增 `CalendarDayContext.onCreateTaskAt(startMin)`，宿主侧与 `createTaskOnDay` **相邻**实现（复用同一 `prefillScope()` + `dialogManager`）；日视图自足回退（`use-calendar-day.ts` 已注入 context 作兜底）实现同一函数。**禁**日视图直连构造 payload。
- 日视图**不再渲染**内联编辑器：同步删除 `onTrackClick`、`day-quick-create` 节点、`quickCreate*` 状态、`.day-quick-create` 样式、`QuickCreate` import（本单造成的孤儿）；`quick-create.vue` 组件本体**保留**（月/周在用）。

### C6 全天只读条

- 复用 `task-bar`（**无 bespoke 复制**）；**无**拖拽/拉伸手柄。
- `title`/提示按**原因分档**（≥2 种：跨度超过 24 小时（跨整天）/ 仅设了截止时间（无开始时间）），须可被结构断言。
- **保持既有结构契约**：`.day-allday-lane` 仍为 `.day-scroll` 的**直接子节点**、且 `nextElementSibling === .day-grid`（现有冻结用例已断言）⇒ **不得**插入包装层。

### C7 裁切渐隐遮罩

- 置于**滚动容器之外**：新增 `.day-body-wrap`（`position: relative`）包住 `.day-body` + 两个绝对定位遮罩；`pointer-events: none`。
- 仅当该侧确有可滚动内容时显示（由 `scrollLeft` / `maxScroll` 驱动，rAF 合并）。
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

## 3. 红线复核

月/周 **DOM/CSS 可证零变化**（`is-sticky-label` 门控 + allday 结构契约保持）✓；移动端 / `packages/presentation-react` / 服务端 / 领域**零改动** ✓；`guard:ddd` 无影响 ✓；无 keep-alive ✓；`packLanes` 不动（C3 硬红线）✓。

## 4. 人工验收必须覆盖（jsdom 不可断言）

1. sticky 贴边 + 不越出条（**含「名宽 ≥ 条宽 ⇒ 随条滚出」的反例**）；条完全可见时名称位置与改动前**逐像素一致**。
2. `clip-path` 无副作用：hover / 优先级色条 / 三点改期下拉菜单显示与层级正常；月/周任务条外观与基线截图一致。
3. pan 手感 + 「从刻度标签起拖不误触」+ 未超阈值不滚动。
4. ×4 帧率门槛（C8 手工口径）；遮罩两端显示条件。