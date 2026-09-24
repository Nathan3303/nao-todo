# ADR：日历日视图（TASK-16）几何参数化 / 轨道打包抽取 / 领域边界

- **日期**：2026-09-21
- **状态**：✅ **已采纳**（几何参数化与打包抽取 = 架构已决；**D1=(b) 不显示 / D2=离开视图不夹取 / D3=日级单一 `+N` / D4=新建 floor・拖拽/拉伸 round** —— PM 拍板 2026-09-21，**待实现**）
- **范围**：`apps/web/src/components/calendar/`（新增 `day/`；改造 `monthly/use-calendar-grid.ts`、`monthly/monthly-layout.ts`）；**不改** `packages/domain-task`、`presentation-react`、`apps/mobileapp`
- **相关**：PRD `docs/prds/2026-09-21-calendar-day-view.md`（§0 A4/A5、§5.2–5.5、§6 NFR）；上游 CAL-04/07、TASK-08/11/15/18；评审编号 T48

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-21** | 首次成文：几何参数化方案（`segmentStyleInColumns` 单一实现）→ 打包抽取方案（`packLanes` + 探针式溢出）→ A4 否决 / A5 收窄裁决 → 吸附归属 → 性能约束 C1–C14 → 待拍板 D1–D4                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **r2** | **2026-09-21** | PM 拍板留痕：D1=(b) 不显示、D2=离开视图不夹取、D3=日级单一 `+N`、D4=快速新建 floor / 拖拽·拉伸 round ⇒ 状态由「⏳ 有条件通过」改「✅ 已采纳」；C1–C14 技术内容**零改动**                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **r3** | **2026-09-22** | TASK-18 修订 C14：组件内可变 viewMode 由 route.name 派生只读 computed 取代（视图成为三条子路由）；「切视图不重拉」改由「宿主上移」承接（等价约束）；A3（默认月、不持久化）语义不变；其余 C1–C13 继续有效                                                                                                                                                                                                                                                                                                                                                                                                               |
| **r4** | **2026-09-22** | **TASK-19 修订（日视图档位缩放）**：**C1** 列数改为**档位相关**、来源 = `model.columns.length`（禁内联百分比算式不变）；**C2** `columnMinutes ∈ {30,15,10}` 且 `30 % columnMinutes === 0`，`MIN_SPAN_MIN = 30` 为分钟常量不随档位变（10min 档自动 3 列最小宽）；**C5/C6** 日视图不再使用 `laneLimit` 测量与 `+N` 折叠；列头节点数 = 列数（×4 = 144）；禁 `列数×N` 背景 DOM；**C10** `snapMinutes` 步长**恒为 30**，新增单一常量 `DAY_SNAP_MINUTES`（`calendar/snap.ts`）；**D3/A6** 日级 `+N` **机制保留在 `packLanes` 调用路径**，但日视图不再折叠（全部轨道渲染、由主体纵向滚动可达）。**C3/C11/C13/C14 与其余不变** |

## 1. 事实基线（评审读码结论）

| 事实                        | 位置                                                                                     | 影响                                       |
| :-------------------------- | :--------------------------------------------------------------------------------------- | :----------------------------------------- |
| 几何硬编码 7 列             | `monthly/use-calendar-grid.ts:19-28`（`GRID_COLUMNS` 闭区间 `colEnd-colStart+1`）        | 需加列数参数                               |
| 打包函数模块私有            | `monthly/monthly-layout.ts:193-256`（`buildRowContent`）                                 | 需抽取导出                                 |
| 打包主键 = `colStart` 升序  | 同上 `:216-220`（注释明确：**禁加 `colEnd` 比较**，靠稳定排序承载用户排序 TASK-15 D1）   | 抽取时必须保留该约束                       |
| R1：仅 `startAt` → 不占格   | `monthly/monthly-layout.ts:118-135`（`buildTaskSpan`）                                   | 与 PRD A4 张力                             |
| B7：`endAt` 空 → 未安排抽屉 | `monthly/use-calendar-monthly.ts:70-72`（`unscheduledTasks = !task.endAt`）              | **仅 `startAt` 任务现居「未安排」抽屉**    |
| 领域不变量 `start <= end`   | `domain-task/.../entities/task.ts:120-137`（`updateSchedule`，错误码 `START_AFTER_END`） | 拖拽/拉伸不得违反；领域**不**管吸附/最小宽 |
| F4 改期 = 天粒度整体平移    | `monthly/reschedule.ts`（`shiftTaskDates`，Δ=目标日−原 `endAt` 日）                      | 日视图横向拖动需**分钟级**新纯函数         |
| 手势会话壳（阈值/抑制/Esc） | `monthly/use-drag-schedule.ts`（`DRAG_THRESHOLD_PX`/click 抑制/卸载清理）                | 可经 `resolveDrop` 注入复用，禁再写一套    |
| `viewMode` 仅月/周          | `monthly/use-calendar-monthly.ts:137`（`ref<'month' \| 'week'>`）                        | 需扩 `'day'`；未持久化（A3 无需改动）      |
| 未安排入口在月视图头部内    | `monthly/index.vue:441-445`（位于 `v-if viewMode==='month'` 块内）                       | 日视图头部必须自建入口（C12）              |

## 2. 决策一：几何参数化（单一实现）

**采用「追加式参数 + 委托」，不动既有签名与单测。**

在 `monthly/use-calendar-grid.ts` 内：

```ts
/** 列数可配的任务条定位（唯一实现：三视图共用） */
export const segmentStyleInColumns = (
    seg: { colStart: number; colEnd: number; lane: number },
    columnCount: number,
    topOffset: number = GRID_TOP_OFFSET
): { left: string; width: string; top: string } => {
    const left = (seg.colStart / columnCount) * 100
    const width = ((seg.colEnd - seg.colStart + 1) / columnCount) * 100
    return {
        left: `${left}%`,
        width: `${width}%`,
        top: `${topOffset + seg.lane * GRID_ITEM_STEP}px`
    }
}

/** 月/周既有入口（默认 7 列）：零破坏 */
export const segmentStyleOf = (seg, topOffset = GRID_TOP_OFFSET) =>
    segmentStyleInColumns(seg, GRID_COLUMNS, topOffset)
```

**统一约定（关键）**：`colStart/colEnd` 为**闭区间列坐标**（`colEnd` 含），可为**小数**。于是：

| 视图 | `columnCount` | `colStart`    | `colEnd`          |
| :--- | :------------ | :------------ | :---------------- |
| 月   | 7             | 整数 0..6     | 整数 0..6（现状） |
| 周   | 7             | 整数 0..6     | 整数 0..6（现状） |
| 日   | 48            | `startMin/30` | `endMin/30 − 1`   |

**校验**（均精确成立）：09:00–10:30 → `colStart=18, colEnd=20` → `width=3/48=6.25%` ✓；14:37–15:07 → `colStart=29.233…, colEnd=29.233…` → `width=1/48` ✓（连续、不吸附）；`endMin=1440` → `colEnd=47` → 右缘对齐 100% ✓；`startMin=0` → `left=0%` ✓。

**对既有调用点/单测的影响**：`monthly/index.vue:224` 与 `weekly/index.vue:119` 均 `const segStyle = segmentStyleOf`（单参调用）→ **零改动**；`__tests__/use-calendar-grid.test.ts`（含 `segmentStyleOf(seg, 0)` 位置参数）→ **零改动**；日视图局部绑定 `const segStyle = (seg) => segmentStyleInColumns(seg, DAY_COLUMNS)`。

**被否方案**：把 `columnCount` 插为第 2 位置参数（破坏既有测试与 `topOffset` 位置语义）；改造 `CalendarSegment` 携带 `leftFraction/widthFraction`（涟漪到 `task-bar.vue` 与全部月/周用例，收益不足以抵消风险）；调用方注入 `left/width` 计算器（过度抽象，与 NFR「接受列数参数」字面不符）。

## 3. 决策二：轨道打包抽取（单一实现）

**抽出视图无关纯函数 `packLanes`（新文件 `apps/web/src/components/calendar/lane-packing.ts`）：**

```ts
export type LaneProbe = { key: string; colStart: number; colEnd: number } // 溢出探针（闭区间）

export const packLanes = <T extends { colStart: number; colEnd: number }>(
    items: T[], // 入参顺序 = 用户排序（TASK-15）
    maxLanes: number,
    probes: LaneProbe[]
): { packed: (T & { lane: number })[]; overflow: { key: string; count: number }[] } => {
    // 1) 稳定排序：仅按 colStart 升序（禁加 colEnd 比较——TASK-15 D1 铁律）
    // 2) 贪婪首次适配：laneEnds 逐轨道记录已占结束列（沿用现有算法，逐字节等价）
    // 3) 溢出：对每个 probe，统计与 [colStart,colEnd] 相交且 lane>=maxLanes 的项数
}
```

**月/周适配**：`buildRowContent` 退化为「行内裁剪 + 日期格→列映射 + `packLanes` + 组装 `CalendarSegment`（补 `task`/`isStart`/`isEnd`）」，探针 = 该行 7 个日期格（`colStart=colEnd=列号`，`key=dateKey`）⇒ **输出与现状逐字节等价**（`overflow` 的 `cell` 由 `key` 反查保留）。

**日视图适配**：分钟 → 分数列（§2 约定）后调 `packLanes`；**探针 = 单个覆盖 `[0,47]` 的探针** ⇒ 日级 `+N` 计数（同一份溢出代码，无第二套）。

**月 6 行 vs 日单行的差异处理**：`packLanes` 本就是**单行**语义，月视图在 `buildGridModel` 循环 6 次、日视图调用 1 次 —— **无差异需要处理**，差异仅在「探针集合」与「续接标记」两处视图特化，已由适配层吸收。

**`+N` 语义可否完全复用**：**计数可完全复用**（同一探针机制）；**交互可复用**（点击 → `openDay(anchorKey)` 打开既有当日面板，与月视图 `+N` 同款）。**不可复用**的是「标记的摆位」（月=格内右下角；日=底部条带单一指示器）—— 属渲染层，需 D3 拍板粒度（见 §6）。

**被否方案**：把日期键→列映射塞进通用包（月专有，会污染日视图）；为日视图另写 greedy/重叠判定（PRD §6 明令禁止）。

## 4. 决策三：领域边界裁决

### 4.1 A4（仅 `startAt` 无 `endAt`）→ **裁决：A4 不成立，改为「不显示」**

**推荐 = 方案 (b) 不显示**（既不进时间轴、也不进全天行）。

理由（三方一致性）：

1. `buildTaskSpan`（R1）已把「仅 `startAt`」判定为**不占格**；月/周视图据此不渲染它；
2. B7「未安排」抽屉的判据是 `!task.endAt`（`use-calendar-monthly.ts:70-72`）⇒ 该任务**现在就在未安排抽屉里**。若日视图 A4 成立，同一任务会**同时**出现在「未安排」抽屉与日历时间轴 —— 破坏单一表示，且用户会问"它到底安排了没"；
3. PRD「不做」明确**不改月/周既有行为**，故无法通过统一改 R1 来消弭 A4 的跨视图不一致。

**备选 (c)（按 `startAt` 渲染最小 30 分钟条）**：语义上更"真"（任务确实有开始时刻），且可拖动/拉伸（拉伸即补上 `endAt`），但**必须同时解决**：该任务是否从「未安排」抽屉移除（否则双表示），以及月/周是否跟进（否则三视图不一致）⇒ **超出本单范围**，仅在 PM 明确接受该依赖时启用（见 D1）。

**被否 (a) A4 成立**：把「有时刻的任务」放进「全天行」是语义混淆（全天行应只承载无时刻任务）；且与 B7/R1 双冲突。

**对月/周一致性的影响**：选 (b) 或 (c) 均**不改月/周**；差异只存在于日视图；(b) 与 R1 完全一致，(c) 引入日视图独有表示（须登记跨视图不一致）。

### 4.2 A5（拖拽跨日）→ **裁决：成立，但收窄为「跨日即离开视图、不夹取」**

- **与领域不变量一致**：横向拖动保持时长（`newEnd = newStart + duration`），`start <= end` 恒成立；0 时长（`start == end`）为领域合法态，拖拽后仍合法；拉伸的最小 30 分钟由**交互层**守卫，领域无需改动。
- **与既有 F4 语义一致**：F4 = "拖到某日 ⇒ 任务移动"，任务离开原格是既有语义；日视图横向拖出当日 ⇒ **任务离开视图**（不再渲染），与"拖到另一天"同义。
- **不夹取的理由**：日视图没有相邻日期落点（不像月/周的格），夹取会让"想移到 02:00 的次日任务"无法表达，且夹取后条形被裁剪、位置语义失真。
- **锚点约束**：以**真实 `startAt/endAt`** 为拖动锚（不得以裁剪后的 `00:00`/`24:00` 反推），否则跨日任务每拖一次就漂移一次（C13）。

### 4.3 时长边界：领域侧 vs 渲染侧职责

| 规则                     | 归属     | 说明                                                                                      |
| :----------------------- | :------- | :---------------------------------------------------------------------------------------- |
| `start <= end` 不变量    | **领域** | 既有 `TaskEntity.updateSchedule`（`START_AFTER_END`），不加不改                           |
| 时长 0 合法              | **领域** | 领域只拒绝 `start > end`；`start == end` 合法 ⇒ **不得**把 MIN_SPAN 写进领域              |
| 最小 1 列（30 分钟）宽   | **渲染** | 纯展示下限：`endMin = max(endMin, startMin + MIN_SPAN_MIN)`（走 §2 公式，无需特判 width） |
| 时长 1 分钟              | **渲染** | 同上，被 MIN_SPAN 抬到 30 分钟宽                                                          |
| 覆盖整天 → 全天行        | **渲染** | 判定纯函数：`startMin === 0 && endMin === 1440`（跨日裁剪后）；不进 lane/`+N`             |
| 跨日裁剪 + 续接标记      | **渲染** | `startAt < 当日00:00 → contStart`；`endAt > 当日24:00 → contEnd`；以真实值判定            |
| 清空语义（`''` vs null） | **领域** | 既有 DEF-1 契约，拉伸清除走 `''`；不新增领域 API                                          |

**结论：无需新增/变更任何 domain API。**

### 4.4 吸附职责 → **presentation 纯函数，禁入领域**

- 位置：`apps/web/src/components/calendar/day/snap.ts`（或 `calendar/snap.ts`，纯函数、可单测），签名 `snapMinutes(value: number, step = 30, mode: 'floor' | 'round'): number`。
- 理由：吸附是**手势量化**（A1：展示连续、交互吸附），不是数据不变量；领域若感知 30 分钟粒度会污染"任意合法 ISO 时间"的模型。
- **显示路径禁调用**（保证 AC2 的 14:37 连续定位）。
- 模式归属待 D4 拍板（建议：快速新建 = `floor`；拖拽/拉伸 = `round`）。

## 5. 决策四：性能可行性

**结论：可行**，日视图单日数据量（48 列 × 少量轨道）远低于月视图 42 格 × 多轨道；风险在「拖拽期重算」与「背景格 DOM」。

| 项           | 约束                                                                                                                                            |
| :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| 背景格线     | **禁** 48 × laneLimit 个 DOM；用 CSS（`repeating-linear-gradient`）或单层绝对定位列绘制；列头仅 48 节点                                         |
| 拖拽重渲染   | pointermove 只写**本地 ref**（浮空提示/落位高亮），`buildDayGrid` 的 computed 依赖（anchor/tasks/laneLimit/sort）不变 ⇒ 零重算；松手才 `update` |
| 帧率         | pointermove 处理 O(1)（仅坐标→分钟映射 + snap），不做集合过滤/排序；如需可 rAF 节流                                                             |
| 可视上限     | `laneLimit` 复用 `useCalendarGrid`（ResizeObserver + 100ms 防抖，`monthly/use-calendar-grid.ts:36-58`）；超出由 `+N` 兜底                       |
| 时间线       | 仅锚点日 = 今天时挂 1 个 30s 定时器（`onUnmounted` 清理）；非今天不渲染、不挂载                                                                 |
| 全量任务过滤 | 与月/周同源（`useCalendarTaskQuery` 快照），**切视图不重拉**；日视图只对快照做一次分钟映射                                                      |

## 6. 待 PM 拍板决策点

| ID  | 议题                              | 架构建议                                                                  | 备选 / 影响                                                                                       |
| :-- | :-------------------------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------ |
| D1  | A4：仅 `startAt` 任务的日视图归属 | **(b) 不显示**（与 R1/B7 一致，本单零外溢）                               | (c) 按 `startAt` 渲染 30 分钟条 → **须同时决定是否移出「未安排」抽屉**，否则双表示；A4 原案已否决 |
| D2  | A5：跨日拖出当日视图的表现        | **离开视图、不夹取**（与 F4 一致，可撤销找回）                            | 夹取到边界 → 跨日移动不可表达、条形失真                                                           |
| D3  | 日视图 `+N` 粒度                  | **日级单一指示器**（探针 = `[0,47]`，点击开当日面板）                     | 每 30 分钟列独立 `+N` → 48 个标记，噪声大                                                         |
| D4  | 吸附模式                          | 快速新建 = `floor`；拖拽/拉伸 = `round`（AC4 两者皆兼容，**需 QA 钉死**） | 全 `floor` → 拖动偏"往回吸"，手感差                                                               |

## 7. 实现约束（C1–C14）

- **C1** 几何单一实现：日视图必须经 `segmentStyleInColumns(seg, 48)`（同一模块），**禁**内联 `min/1440` 百分比算式。
- **C2** 分数列约定：`colStart/colEnd` 闭区间、允许小数；日视图 `colStart = startMin/30`、`colEnd = endMin/30 − 1`；MIN_SPAN 通过抬高 `endMin` 实现。
- **C3** 打包单一实现：轨道分配 + 溢出计数**只经 `packLanes`**；**禁**日视图另写 greedy/重叠/溢出逻辑；`packLanes` 内部仅按 `colStart` 稳定排序（**禁**加 `colEnd` 比较 —— TASK-15 D1）。
- **C4** 月/周 probes = 7 个日期格（`colStart=colEnd=列号`，`key=dateKey`），`buildRowContent` 输出与现状**逐字节等价**（含 `cell` 字段）；日 probes = 单探针。
- **C5** 复用既有渲染件：`task-bar.vue`（`pos`/`contStart`/`contEnd`/`busy`/`dragging` 契约不变）与 `useCalendarGrid`（laneLimit 实测）；**禁**新建任务条组件或第二套行高实测。
- **C6** 时间轴背景禁 48×N DOM（CSS 绘制格线；仅列头 48 个节点）。
- **C7** 拖拽期零数据刷新：pointermove 只改本地位移/提示状态；松手才 `taskUseCase.update`；禁在 pointermove 内触发 `buildDayGrid` 重算。
- **C8** 手势壳复用：经 `useDragSchedule` 的可选 `resolveDrop` 注入日视图 px→分钟解析；**禁**复制第三套会话壳（阈值/点击抑制/Esc/卸载清理）。
- **C9** 写回链路唯一：日视图拖拽/拉伸必须经 `useCalendarSchedule` 的快照 + U2 撤销内核；失败 toast + 位置回退，不留乐观脏状态。
- **C10** 吸附纯函数唯一：`snapMinutes(value, step, mode)` 单点实现；**显示路径禁调用**（保全 AC2 连续定位）。
- **C11** 领域零污染：**禁**在 `packages/domain-task` 引入 MIN_SPAN/吸附/全天行/裁剪概念；本单**无 domain API 变更**（若实现期发现需要，须回本 ADR 并升格评审）。
- **C12** 日视图头部必须自建「未安排」入口（现入口位于月视图 `v-if` 块内，`monthly/index.vue:441`）；否则 `endAt` 为空的任务在日视图不可达。
- **C13** 跨日裁剪/续接/全天行判定一律以**真实 `startAt/endAt`** 为锚，禁以裁剪后值反推。
- **C14** `viewMode` 扩为 `'month' | 'week' | 'day'`；切视图**不重拉数据**（复用同一 `taskIds` 快照）；A3（默认月、不持久化）保持不变。

    - **r3 修订**：viewMode 由 route.name 派生（唯一写路径 = 导航动作）；切视图零重拉由单一宿主承接；A3 语义不变。

> **修订（2026-09-22，TASK-18）**：`viewMode` 将改为**由 `route.name` 派生**（只读 computed，导航为唯一写路径），组件内可变 `viewMode` 退役；**「切视图不重拉数据」不变**（TASK-18 C2），**A3 语义不变**（默认入口仍为月视图）。见 ADR `2026-09-22-calendar-view-routes-and-header-layout-baseline.md`。

## 8. 证据索引

| 类别                     | 位置                                                                           |
| :----------------------- | :----------------------------------------------------------------------------- |
| 几何（硬编码 7 列）      | `apps/web/src/components/calendar/monthly/use-calendar-grid.ts:19-28,36-58`    |
| 打包（模块私有）         | `apps/web/src/components/calendar/monthly/monthly-layout.ts:193-256`           |
| R1 跨度折算              | `apps/web/src/components/calendar/monthly/monthly-layout.ts:118-135`           |
| 未安排抽屉（`!endAt`）   | `apps/web/src/components/calendar/monthly/use-calendar-monthly.ts:70-72`       |
| 未安排入口（月视图块内） | `apps/web/src/components/calendar/monthly/index.vue:441-445`                   |
| F4 改期内核（天粒度）    | `apps/web/src/components/calendar/monthly/reschedule.ts`（`shiftTaskDates`）   |
| 手势会话壳               | `apps/web/src/components/calendar/monthly/use-drag-schedule.ts`                |
| 领域时间不变量           | `packages/domain-task/src/domain/entities/task.ts:120-137`（`updateSchedule`） |
| `viewMode` 现状          | `apps/web/src/components/calendar/monthly/use-calendar-monthly.ts:137`         |
| 几何用例（受影响基线）   | `apps/web/src/components/calendar/monthly/__tests__/use-calendar-grid.test.ts` |

## 9. 变更管理

- D1–D4 任一拍板结论与本文不一致时，须修订本 ADR 并同步 PRD §0/§5.3/§5.5 与 **AC3/AC4** 用例。
- 实现期若偏离任一 C1–C14，须回到架构评审并修订本 ADR；尤其 **C3（打包单一实现）与 C11（领域零污染）为硬红线**。
- 若 D1 选 (c)，须另立单处理 R1 + B7 抽屉口径统一，并登记跨视图不一致。
- **2026-09-22（TASK-18）**：视图路由化（三子路由 + 状态宿主上移）与三视图布局单一基线改由 ADR `2026-09-22-calendar-view-routes-and-header-layout-baseline.md`（C1–C8）与 PRD `docs/prds/2026-09-22-calendar-three-view-routes-and-layout-baseline.md` 承接；本 ADR 的 C14 见上文修订说明，其余 C1–C13 继续有效。
- **2026-09-22（TASK-19）**：日视图时间轴档位缩放（×1/×1.5/×2/×3/×4）与轴参数化由 ADR `2026-09-22-day-view-zoom-and-axis-parameterization.md` 承接；本 ADR **C1 / C2 / C5 / C6 / C10 与 D3 / A6 由该文修订**（列数档位相关、`30 % columnMinutes === 0`、日视图不再折叠 `+N`、`snapMinutes` 步长恒 30），**C3（`packLanes` 单一实现）/ C11（领域零污染）/ C13（真实值锚）/ C14 不变**。

## 10. 决策留痕（拍板）

| 决策点 | 议题                              | 架构建议                | 拍板结论                                                   | 拍板人 | 拍板时间   |
| :----- | :-------------------------------- | :---------------------- | :--------------------------------------------------------- | :----- | :--------- |
| **D1** | A4：仅 `startAt` 任务的日视图归属 | (b) 不显示              | **(b) 不显示**（采纳；A4 原案已否决）                      | PM     | 2026-09-21 |
| **D2** | A5：跨日拖出当日视图的表现        | 离开视图、不夹取        | **离开视图、不夹取**（采纳）                               | PM     | 2026-09-21 |
| **D3** | 日视图 `+N` 粒度                  | 日级单一指示器          | **日级单一 `+N`**（探针 `[0,47]`，点击开当日面板）（采纳） | PM     | 2026-09-21 |
| **D4** | 吸附模式                          | 新建 floor / 拖拽 round | **快速新建 floor / 拖拽・拉伸 round**（采纳）              | PM     | 2026-09-21 |

- PM 已同步 PRD §0（A1–A7）与 §9，并更新 §5.3/§5.4/§5.5/AC3/AC4。
- C1–C14（实现约束）技术内容未变更，其中 **C3（打包单一实现）与 C11（领域零污染）为硬红线**。
- 状态变更：`⏳ 有条件通过` → `✅ 已采纳`；**实现完成后请回本 ADR 追加实现留痕（提交号 / 回归测试）**。