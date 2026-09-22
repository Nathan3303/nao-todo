# 2026-09-22 日视图时间轴缩放与轴参数化（档位 ×1–×4 / 列宽下限 / 纵向 V1）（TASK-19）

- **状态**：✅ 已拍板（arch-designer **T77** 裁决；PM 落盘）
- **关联**：PRD `docs/prds/2026-09-22-day-view-zoom-and-allday-lane.md`；上游 TASK-16 ADR `2026-09-21-calendar-day-view-geometry-and-lane-extraction.md`（**r4 互记**）；TASK-18 ADR `2026-09-22-calendar-view-routes-and-header-layout-baseline.md`
- **范围**：`apps/web/src/components/calendar/**` 表现层；**不动**领域 / 服务端 / `apps/mobileapp` / `packages/presentation-react`

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :----- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-22** | 首次成文：档位矩阵（I1–I4 唯一解）→ 标签两型 + 格线三级 → 吸附恒定 30 分钟 + `DAY_SNAP_MINUTES` → 列宽下限 `max()` 公式 → 纵向 **V1**（日视图 `+N` 退休、机制保留）→ 滚动容器落点（`host.vue` 零改动）→ 参数化落点清单与测试矩阵                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **r2** | **2026-09-22** | **TASK-19 追加批次 r2（T83 裁决）**：① **D1 矩阵 ×4 行**：粒度 `10min -> 5min`、列数 `144 -> 288`、列宽@1200 `33.3 -> 20`（**下限绑定**）、`px/min@1200 = 4.0`，标签数仍 48；② **I2 降级为 I2'**：`>= 25px -> >= 20px`（与 D3 运行时下限同值），**唯一性推导在 I2' 下仍成立**，并**登记代价**（容器 <1440px 时 ×4 下限绑定 ⇒ 1200px 容器总宽 5760px = **等效 4.8×**，满足 AC1 的**下界**形式）；③ **D1.2 格线三级 -> 四级**（`60/30/10/5`）+ **嵌套链规则**；④ **C2 枚举** `{30,15,10} -> {30,15,5}`；⑤ **C6** 列头节点数 ×4 `144 -> 288`；⑥ **D2 登记更新** 视觉跳变 `100px -> 120px` + 新增「细格线管读数 / 吸附管写入」分工说明。**交互级决策见新 ADR `2026-09-22-day-view-interaction-contract.md`**（双向互记） |
| **r3** | **2026-09-22** | **TASK-20 契约修订（用户裁决）**：① **缩放入口由三入口收敛为两入口** —— 移除头部 `−`/`+` 按钮（`data-testid="day-zoom-out/in"` 退役），保留 `Ctrl/⌘ ±` / `Ctrl/⌘ 0` 与 `Ctrl/⌘ + 滚轮`（见 §5.3 #11）；② **总宽公式改整数列宽**：`max(k × 容器宽, 列数 × 20px)` → **`max(列数 × ceil(k × 容器宽 / 列数), 列数 × 20px)`**（每列整数像素 ⇒ 消除格线子像素抗锯齿，见 §3-D3）；③ **格线细层对比度提升**（10min `30% → 55%`、5min `22% → 45%`，见 §3-D1.2）。**AC1 下界 `总宽 ≥ k × 容器宽` 仍成立**（向上取整只增不减）                                                                                                                                                                                                  |

## 1. 事实基线（T77 读码结论）

| 项   | 现状                                                                                                                                                                                                              |
| :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 列数 | `daily/build-day-grid.ts` 常量 `DAY_COLUMNS = 48`、`COLUMN_MINUTES = 30`、`MIN_SPAN_MIN = 30`；`buildColumns()` 偶数位 `HH`、奇数位空文本                                                                         |
| 样式 | `daily/index.vue` → `segmentStyleInColumns(seg, DAY_COLUMNS, 0)`；`.day-cols-head` = `repeat(48, 1fr)`；`.day-grid` = `flex:1; min-height:0`（放不下折叠 `+N`）；`.day-axis-bg` **两级**渐变格线（24 格 + 48 格） |
| 手势 | `snapMinutes(v, 30, mode)` 硬编码 **3 处**（拖拽 `round` / 拉伸 `round` / 快速新建 `floor`）；`MIN_TASK_MINUTES = 30`（`daily/index.vue:24`）                                                                     |
| 轨道 | `useCalendarGrid({containerEl: bodyEl, rowSelector: '.day-grid'})` 测 `laneLimit`；`visibleTimed` 过滤 `seg.lane < laneLimit`；日级单探针 `+N`                                                                    |
| 全天 | `.day-allday` = 时间轴**上方独立行**（非网格内）                                                                                                                                                                  |

## 2. 设计不变量（档位矩阵唯一性依据）

| 记  | 不变量                                                                                                                                                             | 理由                                                                    |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| I1  | `30 % columnMinutes === 0`                                                                                                                                         | ① `MIN_SPAN_MIN = 30` 必须为**整数列**；② 30 分钟对齐标签必须落在列边界 |
| I2' | `列宽 = k × 容器宽 ÷ 列数 >= 20px`（参考容器 1200px）—— r1 原为 25px，**r2 降级为与 D3 运行时下限同值**                                                            | 档位**永不比现状更窄**；降级理由与代价见 §3-D1「r2 代价登记」           |
| D3′ | **总宽公式（r3）**：`总宽 = max(列数 × ceil(k × 容器宽 ÷ 列数), 列数 × 20px)`（**整数列宽**）—— 消除 1px 格线在设备像素网格上的半像素抗锯齿（细线消失/闪烁的根因） | 每列整数像素 ⇒ 格线整像素落位；AC1 下界形式不变                         |
| I3  | 每级至少新增「列宽」或「粒度细化」之一                                                                                                                             | 防冗余档位                                                              |
| I4  | 粒度随 k 单调不增                                                                                                                                                  | PRD §4「30 → 15 → 10」                                                  |

## 3. 决策

### D1 档位矩阵（I1–I4 下的**唯一解**，确认 PM 建议）

| 档   | k   | 粒度     | 列数    | 列宽@1200 | 列宽@1600 | px·min⁻¹@1200 | 标签文本 | 标签数 | 本级新增           |
| :--- | :-- | :------- | :------ | :-------- | :-------- | :------------ | :------- | :----- | :----------------- |
| ×1   | 1   | 30min    | 48      | 25        | 33.3      | 0.833         | `HH`     | 24     | （基线）           |
| ×1.5 | 1.5 | 30min    | 48      | 37.5      | 50        | 1.25          | `HH`     | 24     | 列宽 +50%          |
| ×2   | 2   | 15min    | 96      | 25        | 33.3      | 1.667         | `HH:MM`  | 48     | 粒度细化           |
| ×3   | 3   | 15min    | 96      | 37.5      | 50        | 2.5           | `HH:MM`  | 48     | 列宽 +50%          |
| ×4   | 4   | **5min** | **288** | **20**    | **22.2**  | **4.0**       | `HH:MM`  | 48     | 粒度细化（**r2**） |

- `px/min` 严格递增；列宽全程落在 **25–37.5px** 可读带；每级恰好新增一项（I3）。
- **唯一性推导（摘要）**：k=1.5 时 `列数 ≤ 72` ⇒ I1 仅允许 30min（15min ⇒ 96 列 ⇒ 18.75px < 25，违 I2）；k=2 时 I1 允许 {30,15}，I3 取细 ⇒ 15；k=3 时若取 10 会使 k=4 与 k=3 冗余（违 I3）⇒ 15；k=4 ⇒ 10（6/5min 虽满足 I1–I2，但对日轴非人类常用量子，且与 30min 吸附的整倍数关系变弱）。
- **数学等价**：`列宽 = k × 容器宽 ÷ 列数` 与 PRD「每分钟像素 = k × 容器宽 ÷ 1440」等价 ⇒ 实现只需 `repeat(列数, 1fr)` + 容器宽 = k×容器宽，**列宽无需单独设置**。
- **r2 唯一性复验**：k=1.5 的 15min ⇒ 18.75px < 20 ⇒ 仍被排除；k=2 的 {30,15} 均 >=20 ⇒ I3 取细 = 15；k=3 取 15（避免与 k=4 冗余）；k=4 取 5min ⇒ `max(4800, 5760) / 288 = 20px` **恰好等于下限** ⇒ 「I1–I4 唯一解」结论**在 I2' 下不变**。
- **r2 代价登记（必读）**：×4 档在**容器 < 1440px** 时 D3 下限绑定（`288 × 20 = 5760 > 4 × W`）⇒ **1200px 容器下 ×4 实际总宽 5760px = 等效 4.8×**，列宽 20px（非 r1 的 33.3px）。`px/min` 仍单调（×3 = 2.5 → ×4 = 4.0）。**AC1 不被破**：r1 已把 AC1 等式降为**下界** `总宽 >= k × 容器宽`，4.8× 落在允许域内。
- **r3 格线子像素修复（用户 2026-09-22 裁决 A+B）**：根因 = 4 层 `repeating-linear-gradient` 周期为 `100%/N`，当 `元素宽 ÷ N` 非整数设备像素时，固定 1px 线跨像素 ⇒ 抗锯齿摊薄 alpha（DPR=1 时近乎减半），细层（10/5min，`30%/22%` mix）**消失或闪烁**；粗层（60/30min）周期大故不受影响。**修法**：① **整数列宽**（上表 D3′，根治）；② **提高细层对比**（10min `30% → 55%`、5min `22% → 45%`）。**DPR 门控（C 方案）本批不做**，登记为兜底备选。

### D1.1 标签文本两型（覆盖 PRD §5.1 原措辞）

- 30min 档：`HH`（`"00".."23"`，24 个）—— **与现状逐字节一致**，兑现「k=1 与现状视觉等价」。
- 15min / 10min 档：`HH:MM`（`:00` / `:30`，48 个）。
- **规则函数（2026-09-22 修正，见下「公式勘误」）**：
    ```text
    label = columnMinutes === 30
        ? (minutes % 60 === 0 ? HH : '')      // 30min 档：仅整点 → 24 个
        : (minutes % 30 === 0 ? HH:MM : '')   // 15/10min 档：整点+半点 → 48 个
    ```
- **公式勘误（r1 内修正，QA T78 报备）**：r1 初稿写作 `label = minutes % 30 ? '' : (columnMinutes === 30 ? HH : HH:MM)`，该式在 30min 档下 `minutes % 30` 恒为 0 ⇒ **48 列全部出文本**，与本段「24 个 / 与现状逐字节一致」及 AC2 冲突（**自相矛盾**）。已修正为**分档两式**：30min 档以 `minutes % 60 === 0` 取整点（24），15/10min 档以 `minutes % 30 === 0` 取整点+半点（48）。**唯一有效版本以上方代码块为准**。
- **原措辞缺陷登记**：PRD §5.1「列头文本仅出现在对齐 30 分钟的列上」在 30min 粒度下字面等于「48 列全部有文本」，与现状（24）及 AC2 直接矛盾 ⇒ 已拆为「① 标签仅落在 ≥30 分钟刻度的**列边界**上；② 30min 档仅整点（24，与现状一致），15/10min 档整点 + 半点（48）」。

### D1.2 格线四级 + 嵌套链规则（r2 修订）

- 现 `.day-axis-bg` 仅两级；10min 档下**吸附点（30min）与格线不可区分**（3 条线里只有 1 条是吸附线）。
- **r2 改四级**：`60min`（`--cal-border` 实线）> `30min`（当前 55% 混色）> `10min` > `5min`（透明度随粒度变细**单调递减**；最细层须与背景有可辨对比，20px 间距）。**规则 = 格线集合是「当前粒度 ⊕ 其嵌套上级（直至 60min）」**，相邻层级必须为**整除关系**：30min 档 = `60/30`（**两层，与 ×1/×1.5 现状视觉等价**）；15min 档 = `60/30/15`；5min 档 = `60/30/10/5`（嵌套成立：60=2×30、30=3×10、10=2×5）。实现以**档位修饰类**（`.day-col-lines--30 / --15 / --5`）驱动；四层周期 `100%/24`、`100%/48`、`100%/144`、`100%/288` **只与分钟有关、与档位无关**，可硬编码 ⇒ **仍 100% CSS 渐变**（C6 不变）。用类名承载档位 ⇒ AC6「格线四级可见」可做**结构断言**（比断言 computed style 稳）。**回退预案**（若人眼反馈 5min 层过噪）：×4 可退为 `60/30/10`（3 层）；**不默认如此**。 **（r3 数值）** 透明度：60min 实色 / 30min 55% / 10min **55%** / 5min **45%**（原 30%/22% 提升，见 §3-D3「r3 格线子像素修复」）。
- 三级**全部**由 CSS 渐变绘制（TASK-16 C6「禁 `列数×N` 背景 DOM」口径不变）。
- 附带校验：标签 `overflow: visible` 在 20px 下限下仍不截断（`HH:MM` ≈30px；15min 档槽位 2×20=40px、10min 档 3×20=60px）。

### D2 吸附步长 = **恒定 30 分钟**（与视觉缩放解耦）

| #   | 依据                                                                                                                                                                               |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PRD §5.6 / Q11=A 已把缩放定义为**纯视觉**（「仅刻度密度变化，字号/条高不变」）；吸附若跟随档位即同时改变**数据落点**语义 ⇒ 自相矛盾                                                |
| 2   | TASK-16 D4（`floor`/`round`）已冻结且经 QA 钉死；跟随档位需连带修订 D4 与 `daily-interactions.test.ts` 的 6 条吸附断言，**突破 PRD 只批准的 2 个测试文件范围**                     |
| 3   | 手势一致性：吸附是「手势量化」，与视口缩放无关 —— 同一指针落点在不同档位必须落到**同一时间**                                                                                       |
| 4   | 数据侧量子一致：`MIN_SPAN_MIN = 30`（最小条宽）与 `MIN_TASK_MINUTES = 30`（新建时长）均为 30min；吸附降到 10min 会出现两套量子，涟漪到 `task-bar` 最小宽、拉伸下限、`+N`、撤销文案 |

- **P1（采纳，落法 2026-09-22 定案）**：`apps/web/src/components/calendar/snap.ts` 导出 **`export const DAY_SNAP_MINUTES = 30`** 作为唯一量子常量（**单一来源**）：
    1. `build-day-grid.ts`：`MIN_SPAN_MIN` 改为 `import { DAY_SNAP_MINUTES }` 后 **`export const MIN_SPAN_MIN = DAY_SNAP_MINUTES`**（保留既有具名导出面与语义命名）；
    2. `daily/index.vue`：**删除局部 `MIN_TASK_MINUTES = 30`**，2 处调用改用 `DAY_SNAP_MINUTES`；
    3. `snapMinutes` 的 3 处调用改用 `DAY_SNAP_MINUTES`。
- **不变量断言（修正版）**：`DAY_SNAP_MINUTES === 30` **且** `MIN_SPAN_MIN === DAY_SNAP_MINUTES`（两个可导入常量）。**取消** r1 初稿的「三重等式」—— `MIN_TASK_MINUTES` 作为独立常量**消失**（它无导入落点，而归一本就是 P1 的初衷）⇒ QA T78 报备的「无导入落点」关闭。
- **登记（不阻塞，r2 更新数值）**：×4 档下 30 分钟 = **120px**（5760 / 48，r1 误记 100px），吸附落定跳变明显。若用户人眼验收反馈「放大后落点仍太粗」，那属**吸附量子自身的决定**（30→15），须**另立单**并同步 D4 / `MIN_SPAN_MIN`，**不得**与缩放耦合。
- **分工说明（r2 新增，防验收误判）**：细格线的价值在**读数**（看出 14:35 这类边界），吸附仍管**写入**（TASK-16 C2「显示路径连续不吸附」）。5min 格线 + 恒定 30min 吸附 = 6 条线中 1 条可吸附，**不是矛盾**。

### D3 列宽下限与总宽公式（AC1 与 AC6 **同时成立**，不存在二者择一）

```text
时间轴总宽 = max( k × 容器宽 , 列数 × 20px )
```

- `k=1` 且容器 ≥ 960px ⇒ 总宽 = 容器宽，**无横向滚动（容差 ≤1px）** ⇒ 兑现「与现状视觉等价」。
- 容器更窄时总宽被下限抬高 ⇒ 溢出量转为**横向滚动**（正是 AC6 要的）。
- **AC1 的等式降为下界**：`总宽 ≥ k × 容器宽`，当 `k × 容器宽 ≥ 列数 × 20px` 时取等。
- 阈值 **20px** 推导：A 交互可用（`.day-task-resize` 8px + `right:-3px`，可拖主体 ≥12px）⇒ 20px；C 现状最差容差（现 `repeat(48,1fr)` 无下限，960px 容器时列宽**恰为 20px**，用户已在承受）⇒ **20px = 现状实际可达的最低列宽**。取 25px 会过度绑定（侧边栏一开即触发，档位退化为非 `k×` 比例、破 AC1 语义）。
- **禁**以 per-column `min-width` 实现下限（破坏 `1fr` 等分 ⇒ 列头与网格错位）；下限必须作用在**容器总宽**上。
- 下限触发条件：×1/×2 容器 <960px；×1.5/×3 <640px；×4 <720px。
- **AC6 口径**：「比例不因 resize 变化」= **档位值 k 不被 resize 改写**（时间轴宽为百分比、自动跟随）；**不要求** resize 后重锚视口中心（那需额外记录 last-center，PRD 未要求）。

### D4 纵向模型 **V1**：日视图 `+N` 退休（机制保留）

- **收口 PRD 内部冲突**：§1③ 把 `+N` 折叠列为**问题**、§4 场景明写「纵向溢出可滚动到全部（**不再只有 +N**）」、§2 目标「纵向溢出 100% 可达」 ↔ §5.3-3 原写「`+N` 语义保留」⇒ 直接冲突。
- **裁决：「机制保留、用户可见折叠退休」** —— `packLanes` + 日级单探针仍照常调用（C3 单一实现与 D3/A6 机制在码上存续），但日视图传 `maxLanes = Infinity` ⇒ `overflow` 恒空；`.day-more` 按钮与 `overflowCount` 分支按 AGENTS §3「清理自身造成的孤儿」删除（**机制不删**）。
- **影响面核查（PM 复核）**：`build-day-grid.test.ts` 的 `+N` 用例以**显式 `maxLanes`** 调用函数、`lane-packing.test.ts` 直接测 `packLanes` ⇒ **均仍绿**；`daily/index.vue` 是唯一把折叠接到 UI 的地方 ⇒ **无新增测试契约变更**（仍限于已批准的 2 个文件）。

### D5 滚动容器落点：`daily/index.vue` 内（**`host.vue` 零改动**）

理由：① 可滚动区仅日视图时间轴（月/周必须零变化，PRD 非范围）；② `.nue-calendar-host` 是 TASK-18 C6.1 承载层（padding / 令牌 / `height:100%` / `overflow:hidden`），在其上加 `overflow:auto` 会让**三视图兄弟共用滚动** ⇒ 破 TASK-18 AC1/AC2；③ 子路由卸载即丢弃滚动态，与 §5.2「进入即重定位」自洽。

```text
.nue-calendar-daily            （不动：height:100% / background / overflow:hidden）
├─ .day-header                 （不动；右组新增 − / + / 复位）
└─ .day-body                   ← 新增 overflow:auto（双轴滚动容器；position:relative）
   └─ .day-scroll              ← 新增：width = dayScrollWidthCss(zoom, columns)（>100% 即横向溢出）
      │                            display:flex; column; min-height:100%（撑满视口）
      ├─ .day-cols-head        ← position:sticky; top:0; z-index:5; background:var(--cal-bg)
      │                            （垂直固定 ✓ / 随 .day-scroll 横向滚动 ✓ 同一滚动源，免 JS 同步）
      ├─ .day-allday-lane      ← 全天泳道：从「时间轴上方独立行」**移入此处**（时间轴区顶部）
      │                            flex:none；chips 换行 ⇒ 纵向生长 ⇒ 由 .day-body 纵向滚动承接（不吸顶）
      │                            背景复用共享格线类，**与 .day-grid 同列宽基准 ⇒ 同横向坐标系** ✓
      └─ .day-grid             ← flex:1 0 auto；高度公式复用既有常量
                                    （GRID_ITEM_STEP(22) / GRID_BAND_HEIGHT(24)，均自 monthly/use-calendar-grid 导入；
                                     topOffset 仍为 0；.day-axis-bg inset:0 不变；track / lanes / now-line 不变）
```

- ⚠️ **AC4「网格内独立泳道」措辞澄清**：实现为 `.day-scroll` 内、`.day-grid` **之上**的兄弟块（共用列宽基准与格线类），**不是** `.day-grid` 元素的子节点。理由：若塞进 `.day-grid`，所有 lane 的 `top` 需减去动态泳道高 ⇒ 污染 `segmentStyleInColumns` / `packLanes` 的既冻结几何（C1/C2）。语义等价（时间轴坐标系内、时间轴区顶部）。
- **格线共享**：把 `.day-axis-bg` 的两级 `repeating-linear-gradient` 抽成共享类（如 `.day-col-lines`），供 `.day-axis-bg` 与全天泳道背景同时使用 ⇒ 泳道与 0–24 刻度**逐像素对齐**且单一来源；`data-testid="day-axis-bg"` 仍**无子节点**（C6 ✓）。

### D6 持久化落点：entry 级 `CALENDAR_DAY_ZOOM`（确认）

- 置于 `views/index/calendar/calendar-view.ts` 的 `CALENDAR_VIEW_CONTEXT`，与 `CALENDAR_WEEK_START` / 专注徽标同处 —— 在宿主**之上**、单实例、跨视图存活（§5.5「切月/周后回日视图沿用」）⇒ **不破 TASK-18 C1「结果态单宿主」**（属偏好/结果态，由 entry 级单源承载，与周起始同构）。
- 新增 `dayZoom: Ref<DayZoom>` + `setDayZoom`；**建议 `dayZoom?` 声明为可选**并让日视图 `?? ref(1)` 兜底：`daily-view.test.ts` 手搓的 context 字面量没有该字段，可选化可把该测试改动限制在**已批准的列头断言**内（否则 mount 会因缺字段失败），standalone 单测挂载同样安全。

## 4. 参数化约束（C1–C8）

| 记  | 约束                                                                                                                                                                               |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 几何仍必经 `segmentStyleInColumns`（同模块单一实现）；列数改为**档位相关**、来源 = `model.columns.length`；**禁内联百分比算式**不变（TASK-16 C1 更新）                             |
| C2  | `columnMinutes ∈ {30,15,5}`（**r2**：原 `{30,15,10}` 中的 10 已退役）且 `30 % columnMinutes === 0`；`MIN_SPAN_MIN = 30` 为**分钟常量、不随档位变**（5min 档自动为 **6 列**最小宽） |
| C3  | `packLanes` **单一实现、签名不动**（`colEnd: columns - 1` 的探针仍在调用侧）—— **硬红线，不变**                                                                                    |
| C4  | 列数**不新增** `DayGridModel` 字段：`columns.length` 即列数（单一真源，禁第二份可漂移镜像）                                                                                        |
| C5  | 日视图**不再**使用 `laneLimit` 测量与 `+N` 折叠；月/周**照旧**（`useCalendarGrid` 复用不变）                                                                                       |
| C6  | 禁 `列数 × N` 背景 DOM；列头节点数 = 列数（**×4 = 288**，r2 更新）；格线仍 CSS 渐变（四层单元素）                                                                                  |
| C7  | `snapMinutes` 步长**恒为 30**，单一常量 `DAY_SNAP_MINUTES`                                                                                                                         |
| C8  | 移动端 / `packages/presentation-react` / 服务端 / 领域**零改动**；无 keep-alive                                                                                                    |

**TASK-16 ADR 条款继承**：其 **C1 / C2 / C5 / C6 / C10** 与 **D3 / A6** 由本 ADR 修订（互记见 §7.2）；**C3（`packLanes` 单一实现）/ C11（领域零污染）/ C13（真实值锚）/ C14** 及 TASK-18 C1–C11 **全部不变**。

## 5. 参数化落点清单（供 T78/T79 直接引用）

### 5.1 新增纯模块 `apps/web/src/components/calendar/daily/day-zoom.ts`（无 Vue 依赖）

```ts
export type DayZoom = 1 | 1.5 | 2 | 3 | 4
export const DAY_ZOOM_LEVELS: readonly DayZoom[] = [1, 1.5, 2, 3, 4]
export const DAY_ZOOM_DEFAULT: DayZoom = 1
export const MIN_DAY_COLUMN_PX = 20 // D3
export type DayAxisSpec = { zoom: DayZoom; columnMinutes: 30 | 15 | 10; columns: number }
export const dayAxisSpecOf = (z: DayZoom): DayAxisSpec
export const nextDayZoom = (z: DayZoom): DayZoom // 到端返回自身（按钮 disabled 用）
export const prevDayZoom = (z: DayZoom): DayZoom
export const dayScrollWidthCss = (z: DayZoom, columns: number): string // "max(calc(1.5 * 100%), calc(48 * 20px))"
export const readDayZoom = (storage: Storage): DayZoom // 缺失/非法 → 1 并规范写回
export const writeDayZoom = (storage: Storage, z: DayZoom): void
```

理由：档位阶梯 / 下限 / 宽度公式 / 偏好读写必须是**同一个可单测的纯函数源**（`max()` 在 jsdom 无法计算 ⇒ 断言 `dayScrollWidthCss` 字符串而非 computed style）。`readDayZoom/writeDayZoom` 注入 storage，沿用 `readPomodoroBadgePref(localStorage)` 范式；`calendar-view.ts` 保持轻薄。

### 5.2 `daily/build-day-grid.ts`

| 符号                         | 处置                                                                                                                                                                               |
| :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildDayGrid`               | **追加式参数**（既有单测调用不变）：`(anchorKey, tasks, maxLanes = MAX_VISIBLE_LANES, todayKey = todayDateKey(), geometry: { columnMinutes: 30\|15\|10 } = { columnMinutes: 30 })` |
| `DAY_COLUMNS = 48`（export） | **退役**（变「说谎常量」）：改模块内 `const columns = DAY_MINUTES / geometry.columnMinutes`；引用点仅 `daily/index.vue:18/222` 与既有测试，可控                                    |
| `COLUMN_MINUTES = 30`        | 改为 `geometry.columnMinutes`                                                                                                                                                      |
| `MIN_SPAN_MIN = 30`          | **不动**（分钟语义，与粒度解耦）⇒ 10min 档自动为 3 列最小宽                                                                                                                        |
| `buildColumns()`             | 参数化：`minutes = index * columnMinutes`；`label = minutes % 30 ? '' : (columnMinutes === 30 ? HH : HH:MM)`（D1.1）                                                               |
| `packLanes` 探针             | `colEnd: columns - 1`（替换硬编码 `47`）；`packLanes` **签名不动**（C3）                                                                                                           |
| 列数进 `DayGridModel`？      | **否**（C4）：`columns: DayColumn[]` 已承载，`columns.length` 即列数                                                                                                               |
| 日视图 `maxLanes`            | 传 `Number.POSITIVE_INFINITY`（D4/V1）⇒ `overflow` 恒空                                                                                                                            |

### 5.3 `daily/index.vue` 调用点

| #   | 位置                                                                        | 处置                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :-- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `useCalendarGrid({containerEl: bodyEl, rowSelector: '.day-grid'})` (:60)    | **移除**（V1 下不需 laneLimit 测量；月/周继续用，C5 复用不变）                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | `DAY_COLUMNS` import (:18)                                                  | 删除；改 `dayAxisSpecOf(zoom)`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | `zoom` 来源                                                                 | `inject(CALENDAR_VIEW_CONTEXT_KEY)!.dayZoom ?? ref(DAY_ZOOM_DEFAULT)`（**context 字段可选**，见 D6）                                                                                                                                                                                                                                                                                                                                                                |
| 4   | `model` computed (:210)                                                     | 入参追加 `{ columnMinutes: axis.value.columnMinutes }`；`maxLanes` 传 `Infinity`；`axis.columnMinutes` 成为依赖 ⇒ 缩放会重算模型（**纯派生、不发请求**，AC7 安全）                                                                                                                                                                                                                                                                                                  |
| 5   | `visibleTimed` (:214) / `overflowCount` (:217) / `.day-more`                | 过滤与 `+N` UI **删除**（全部轨道渲染；D4/V1）                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6   | `segStyle` (:222)                                                           | `segmentStyleInColumns(seg, model.value.columns.length, 0)`（列数来源改为模型；C1 仍成立）                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | `.day-cols-head` 模板                                                       | `:style="{ gridTemplateColumns: \`repeat(${model.columns.length}, 1fr)\` }"`（列宽自动 = k×容器宽/列数）                                                                                                                                                                                                                                                                                                                                                            |
| 8   | `pxPerMinute` / `perMin` (:104/116)                                         | **零改动** ✓（`rect.width` = 时间轴实宽 = k×容器宽 ⇒ 自动等于 PRD 公式；×4 下 `clientX-rect.left` 映射仍精确）                                                                                                                                                                                                                                                                                                                                                      |
| 9   | `onTrackClick` (:205) / `quickCreate` left%（:371）                         | **零改动** ✓（均以 `DAY_MINUTES` 归一化为百分比）                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 10  | `nowLeft`                                                                   | **零改动** ✓ 同理                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 11  | 缩放**两入口**（**r3 修订**：用户 2026-09-22 裁决移除头部按钮；原为三入口） | ① **按钮：已移除**（`data-testid="day-zoom-out"` / `"day-zoom-in"` **退役**；qa 2 条按钮用例改写为「按钮不存在」负向断言）。② **快捷键**：`useShortcut` 三条，id = `calendar.dayzoom.in` / `calendar.dayzoom.out` / `calendar.dayzoom.reset`，keys = `$mod+=` / `$mod+-` / `$mod+0`，`scope: CALENDAR_KEY_SCOPE`，随 day view 卸载注销。③ **滚轮**：`.day-body` 上 `@wheel.ctrl.prevent`，`deltaY < 0` 放大、`> 0` 缩小、`=== 0` 忽略。④ 不作断言项：视觉规格归人眼 |
| 12  | 视口锚定                                                                    | 进入：`scrollLeft = clamp(nowMin/1440 × W − 容器宽/2, 0, W−容器宽)`（非今天 → 0）；缩放：先取 `centerMin = (scrollLeft + 容器宽/2)/W × 1440`，`nextTick` 后写回新 W（**禁 smooth**，避免与宽度变更竞态）；**不持久化 `scrollLeft`**                                                                                                                                                                                                                                 |

### 5.4 测试矩阵（PRD §6 已批准的 2 文件 + 新增纯函数用例）

| 文件                         | 变更                                                                                                                                                                                                           |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build-day-grid.test.ts`     | 表驱动 ×5 档：`columns.length === 1440/columnMinutes`、标签数 24/48、`30 % columnMinutes === 0`；`maxLanes=Infinity` ⇒ `overflow` 恒空且全部 item 有 lane；**既有 48 列断言原样保留为 ×1 例**                  |
| `daily-view.test.ts`         | 列头断言改为**按档位矩阵**；**×1 例保留 48 子节点 / 24 有文本**（default zoom=1 ⇒ 与现状逐字相同）；新增 `.day-cols-head` 与全天泳道同处 `.day-scroll` 内、`.day-scroll` 宽度样式 = `dayScrollWidthCss(1, 48)` |
| **新增 `day-zoom.test.ts`**  | 阶梯顺序 / 到端不动、`dayScrollWidthCss` 字符串、`readDayZoom` 非法值回退 + 规范写回、不变量 `DAY_SNAP_MINUTES === MIN_SPAN_MIN === MIN_TASK_MINUTES === 30`                                                   |
| `daily-interactions.test.ts` | **零改动** ✓（mock `rect.width = 1440`，与档位无关；几何/吸附语义未变）                                                                                                                                        |

## 6. 红线复核

移动端 + `packages/presentation-react` **零改动** ✓；`guard:ddd` 无影响 ✓（无领域/服务端变更，吸附仍留表现层纯函数）；**无 keep-alive** 引入 ✓；月/周零改动 ✓。

## 7. 变更管理与互记

- **r1 内勘误（2026-09-22，QA T78 / T78-B 报备后 PM/arch 收口）**：① D1.1 标签公式**自相矛盾已修正**（见 §3-D1.1「公式勘误」）；② D2 常量落法由「三重等式」改为「单一来源 + 两常量断言」（见 §3-D2）；③ §5.3 #11 补齐**入口 DOM / 快捷键 / 滚轮契约**（原缺，新增）；④ **keys 字面量**（`$mod+=` / `$mod+-` / `$mod+0`，禁 `$mod++`）与 **滚轮方向**（`deltaY < 0` = 放大）定死，并登记「`theme` 不作断言」口径。 |

### 7.1 本 ADR 修订条件

- **r2 修订（2026-09-22，TASK-19 追加批次 / T83 裁决）**：见修订记录 r2 行；改动块 = D1 矩阵 ×4 行、I2→I2'、D1.2 格线层级、C2 枚举、C6 列头节点数、D2 登记数值 + 分工说明。
- **互记（r2）**：本 ADR 的**交互/DOM 契约类**决策全部移交 ADR `2026-09-22-day-view-interaction-contract.md`（贴边名称 / 手柄可见性不变量 / 左缘拉伸写回 / 空白平移 / 刻度创建入口 / 全天只读条 / 裁切遮罩 / 性能口径）；该文亦互记本 ADR。
- **caveat**：`daily/day-zoom.ts` 的 `DayAxisSpec.columnMinutes: 30|15|10` **须同步为 `30|15|5`**（属 T85 实现范围，类型层不得再允许已退役的 10min）。

- 实现期偏离 **D1–D6 / C1–C8** 任一 ⇒ **回到架构评审**并修订本 ADR。
- 吸附量子若改（30 → 15）⇒ **另立单**并同步 TASK-16 D4 / `MIN_SPAN_MIN`，不得与缩放耦合。
- 列宽下限阈值（20px）若调整 ⇒ 同步 AC1/AC6 口径与 §3-D3 推导。

### 7.2 TASK-16 ADR 互记（已落盘）

已在该文 **修订记录 r4** 与 **§9 变更管理**互记一行：本 ADR 修订其 C1 / C2 / C5 / C6 / C10 与 D3 / A6；C3 / C11 / C13 / C14 不变。

### 7.3 归档

TASK-19 PRD 与本文同日归档；`docs/adr/README.md` 索引同步。

## 8. 挂账 / 非阻塞

- **TASK-16 D5 supersede（r2 登记）**：TASK-16 ADR **D5（日视图内联快速新建 = 本地编辑器）由交互 ADR C5（刻度点击 → 创建对话框）取代**；`quick-create.vue` 组件本体**保留**（月/周仍在用）。
- **`snapMinutes(..., 'floor')` 模式退役登记**：因 D5 被取代，`'floor'` 在生产路径**失去唯一消费者**（仅剩单测）。**保留**纯函数与其用例，**不删除**；若日后要删，另立单。

- **INFO（既有，非本单引入）**：`daily/index.vue:24 MIN_TASK_MINUTES = 30` 与 `build-day-grid.ts MIN_SPAN_MIN = 30` 语义重复 —— 采纳 D2/P1 后归一为 `DAY_SNAP_MINUTES`（属清晰化，非重构）。
- **×4 档吸附跳变观感**：交 T82 用户人眼验收；若反馈「太粗」按 §7.1 另立单。
- TASK-16 PRD §13 既有遗留（死代码 `.cal-aside-toggle` / `.cal-nav-btn`、Playwright 几何回归暂不引入）继续挂账。