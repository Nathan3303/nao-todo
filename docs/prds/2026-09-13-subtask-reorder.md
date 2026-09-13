# PRD：详情面板子任务拖拽排序（per-group 作用域；模仿检查事项列表）

- **日期**：2026-09-13
- **状态**：✅ 已交付、验收并发布（2026-09-13）：自动化 QA PASS + 用户手动通过 + 客户端 Tag `v1.6.0`；服务端 `fc20c74` 已上线
- **需求原话**：新增子任务排序 —— 增加详情面板中对子任务排序的支持，拖拽排序 UI/UX 模仿检查事项列表。
- **口径已拍板（2026-09-13 用户确认）**：
    - **作用域 = per-group（per-parent 同级分组）**：排序键 `sort_id`，同一父下独立成组；顶层任务为「组 0」（`parent_task_id = 0`）。否决 per-user 全局全序 + 重置补丁方案（多 4 项簿记、语义不干净）。
    - **重排由客户端算**（可见列表内插值，照搬检查项）；**组变更（新建/换父/升/降）由服务端补组内 `max+1`（置组末）**；**显式非零 `sortId` 优先**。
- **相关**：`docs/adr/2026-09-11-task-02-subtask-row-layout.md`（子任务行布局基线）；`docs/prds/2026-09-13-stat-counts-denormalized-completion.md`（同批任务字段透传先例）

## 1. 问题证据与 5 Whys

- **证据**：检查事项拖拽排序已完整存在（`use-event-dragger.ts` + `task-check-item.ts#resort` + `events.vue`）；子任务列表（`use-subtasks.ts` + `main/subtasks.vue`）**无任何排序能力**，顺序为服务端自然序（≈创建序）；客户端全链路未透传 `sortId`（服务端其实已有 `Task.SortId`）。
- Why 1：为何要排序？用户希望子任务按自己的执行顺序排列，而非创建顺序。
- Why 2：为何持久化？顺序需跨刷新/跨端稳定，不能仅 UI 层临时排。
- Why 3：为何 per-group？子任务顺序只对「同一父」有意义；per-user 全序会把不同组耦合，需 `转变重置` 打补丁并引入 4 项簿记（跨组耦合、重建只能组内、同值需 id 二键、uint16 溢出）。
- Why 4：为何模仿检查项？同一详情面板内两种列表交互一致，降低理解成本；且检查项算法（浮动间隔 + 重建）已验证。
- Why 5：为何跨仓？`sortId` 需持久化在服务端并随同步流转；服务端已有字段与更新入口，补 `List` 默认序与 `CreateTaskReq` 即可。

## 2. 目标指标

| 指标       | 目标                                        | 度量            |
| :--------- | :------------------------------------------ | :-------------- |
| 排序持久化 | 重排后跨刷新/换端顺序一致                   | AC1/AC11        |
| 组内隔离   | 重排某组不影响其他组顺序                    | AC9             |
| 组末语义   | 新建/换父的任务落在目标组末尾               | AC5/AC6/AC7/AC8 |
| 交互一致性 | 与检查项拖拽体验一致（整行拖 + 插入指示线） | 人工核对 + AC1  |
| 兼容       | 存量无 sortId 数据不崩、有稳定序            | AC10            |

## 3. 范围 / 非范围

**做（Do）**

1. 服务端：`GetMaxSortId` 改为按组（`parent_task_id`）取 max；`CreateTaskReq` 加 `sortId`；创建/组变更按「显式非零优先，缺省组内 `max+1`」；子任务列表查询（`parentTaskId` 过滤）默认 `sort_id ASC, id ASC`。
2. 客户端：`TaskRes/TaskEntity/TaskViewObject/UpdateTaskViewObject` + `sortId`；`persistence-go`/`persistence-local` 转换器 + `TaskRecord` + sync push 白名单 + 兜底；新增 `TaskUseCase.resort`（照搬检查项算法，重建复用现有 `batchUpdate`）；子任务列表按 `sortId` 排序；`subtasks.vue` 加拖拽 UI（整行拖 + 蓝色插入指示线）。
3. 测试：服务端单测/集成（组内 max、组变更置末、默认排序、显式优先）；客户端单测（resort 算法、透传、白名单、兜底）+ 组件/E2E。

**不做（Don't）**

- **顶层任务列表的手动拖拽排序**（组 0 的 UI；本单范围仅详情面板子任务区）。
- **跨父拖拽（DnD reparent）**：本单只做同级重排；换父仍走既有「父选择器/脱离」入口（其置末行为在本单内实现）。
- 检查项那套「搜索/筛选 header」不移植到子任务。
- 移动端 `presentation-react` 代码改动（红线：只读、零改动；响应多出 `sortId` 自动忽略）。
- 看板/表格视图的排序语义变更。

## 4. 用户场景

- **画像**：个人待办用户，在任务详情面板管理子任务。
- **场景卡**：用户打开含 ≥2 个子任务的详情；把第 3 个子任务拖到第 1 个上方；列表即时重排并持久化。
- **关键路径**：详情面板 → 子任务区 → 拖拽行（起拖 → 悬停显示上/下插入线 → 释放）→ 顺序更新（乐观 + 持久化）→ 刷新/换端保持。
- **页面状态清单**：
    - 加载中：沿用现有 `subTasksLoading` 占位；
    - 空：沿用现有空态（无子任务）；
    - 错误：沿用现有 `subTasksError` + 重试；
    - 成功：列表按 `sortId` 展示，每行可拖；
    - 拖拽态：`dragging`（被拖行视觉弱化）+ `insert-up`/`insert-down`（目标行上/下蓝色指示线），释放/取消后清除。
- **边界态**：仅 1 个子任务时不产生排序交互（拖拽 no-op）；拖到自己/相邻位置 no-op。

## 5. 业务规则

1. **排序键**：`sort_id`（uint16）。排序 = `sort_id ASC, id ASC`（`id` 为稳定二级键，兜底同值）。
2. **分组**：组 = 同一 `parent_task_id`；`parent_task_id = 0` 为顶层组（组 0），`> 0` 为某父的子任务组。
3. **生成规则（优先级）**：
    - 请求携带**显式非零 `sortId`** ⇒ 以请求值为准（客户端重排）；
    - **未携带 / 为 0**：
        - 新建（含 `parentTaskId`）⇒ 服务端置目标组 `max+1`（组末）；
        - `parentTaskId` 发生变更（升/降/换父）⇒ 服务端置**新组** `max+1`（组末）；
        - `parentTaskId` 未变 ⇒ 不改 `sortId`。
4. **`0` 语义**：`0` = 未设置/由服务端分配；客户端不得产出 `0`（与检查项一致）。
5. **重建**：浮动间隔不足（相邻差 `< 2`）或算出 `< 0` 时，**仅对当前组**重排为 `1000, 2000, 3000…`；走现有 `TaskUseCase.batchUpdate`（后端无批量接口，领域层逐条）。**禁止全局重排**（`(i+1)*1000` 在 >65 条时溢出 uint16）。
6. **边界**：`sortId` clamp 到 `0–65535`；层级深度限制沿用既有 `assertParentAssignable`（父必须为顶层、被移动方不得已有子任务、禁自指）。
7. **不变量**：排序不改变任何计数（STAT-01）与其它字段；重排只发任务更新，不触发 E1–E7 计数事件。
8. **同步**：`sortId` 纳入 desktop push 白名单；服务端 `CreateTaskReq`/`UpdateTaskReq` 均接受；拉取（`GetTaskRes` 已含）自动携带。

## 6. NFRs（业务视角基线）

| 维度   | 基线                                                                                |
| :----- | :---------------------------------------------------------------------------------- |
| 性能   | 单次重排 = 1 次任务更新；重建 = 组内 N 次（子任务量小，可接受）                     |
| 一致性 | 乐观更新 + 失败回退；重建部分失败时以服务端返回为准（复用 `batchUpdate` 既有语义）  |
| 兼容   | 存量 `sortId=0`/缺失 ⇒ 稳定兜底序；旧服务端（无默认排序）客户端仍按本地 `sortId` 排 |
| 交互   | 拖拽不得误触「勾选 / 点名称进详情 / 脱离」                                          |
| 同步   | `updated_at` 随更新推进（增量可发现）；keyset 游标契约不破坏                        |

> 技术指标转译与可行性由 arch-designer 回执（涉及查询默认排序、生成优先级、sync 契约）。

## 7. AC（Given/When/Then）

**重排（客户端算）**

- AC1：Given 父 P 有子任务 A,B,C（sortId 递增），When 拖 C 到 A 上方，Then 顺序 = C,A,B 且持久化；刷新/重进仍为 C,A,B。
- AC2：Given 同上，When 拖 A 到 C 下方，Then 顺序 = B,C,A（底部插入边界）。
- AC3：Given 任意列表，When 拖到自己或相邻无变化位置，Then 无请求、顺序不变。
- AC4（重建）：Given 相邻两子任务 `sortId` 差 `< 2`，When 插入中间，Then 组内重排为 1000/2000/…，顺序正确且仅本组重排。
- AC5（新建置末）：Given P 有子任务，When 新建子任务，Then 出现在列表末尾，`sortId = 组内 max+1`。

**组变更置末（服务端）**

- AC6（降级）：Given 顶层任务 T，When `parentTaskId = P`，Then T 置 P 组末尾。
- AC7（升级/脱离）：Given 子任务 T（父 P），When `parentTaskId = ''`，Then T 置顶层组末尾。
- AC8（换父）：Given T 在 A 下，When 改父为 B，Then T 置 B 组末尾，A 组其余顺序不变。
- AC9（隔离）：Given 多组任务，When 重排 P 组，Then 其他组顺序与各自 `sortId` 不变。

**契约与兼容**

- AC10：Given 存量任务 `sortId = 0`/缺失，When 加载列表，Then 按 `sort_id ASC, id ASC` 稳定展示、不崩、不报错。
- AC11：Given 桌面端离线重排，When 同步 push，Then 载荷含 `sortId`、服务端照存；另一端拉取后顺序一致。
- AC12：Given 请求带非零 `sortId` 的更新，Then 服务端不覆盖；未带时仅在新建/组变更补组末。
- AC13（负向）：Given 试图造成二层嵌套的换父，Then 被既有领域守卫拒绝（父必须顶层 / 有子任务不可降级 / 禁自指）；拖拽不提供跨父入口。
- AC14：Given 移动端，Then 零代码改动，响应多出 `sortId` 被忽略。
- AC15（回归）：Given 任意重排，Then 检查项/评论/子任务计数（STAT-01）不变化。

**数据不达标处置预案**：AC1/AC4/AC5/AC6/AC8 任一不过 ⇒ 回退 RD 修复后全量复跑；AC10 不过视为阻断。

## 8. 优先级（RICE + 战略筛子）

- **战略筛子**：✅ 过 —— 提升详情面板子任务可用性，复用既有模式，非新花样。
- **MoSCoW**：Must（子任务拖拽重排 + 持久化 + 组末语义）；Won't now（顶层手动排序、跨父拖拽）。
- **RICE**：
    | 项                  | Reach | Impact | Confidence | Effort | RICE |
    | :------------------ | :---- | :----- | :--------- | :----- | :--- |
    | 子任务重排 + 持久化 | 中    | 中     | 高         | 中     | 中高 |
    | sortId 全链路透传   | 中    | 中     | 高         | 中     | 中   |
    | 组末语义（服务端）  | 中    | 中     | 高         | 低     | 中高 |
- **Kano**：Performance（有了更顺手，没有也能用）。

## 9. 上线闭环

- **顺序**：先上服务端（`GetMaxSortId` 按组、`CreateTaskReq.sortId`、子任务查询默认排序）→ 再发客户端。
- **数据迁移**：**无需专门迁移**。存量 `sort_id`（per-user 生成）按组投影仍是合法序；未重排的组保持原相对顺序；首个新任务/组变更起由服务端按组补值。
- **回滚**：代码回退即可；已写入的 `sort_id` 无副作用（旧代码只忽略）。
- **监控/观察**：`sortId` 冲突（同组同值）出现频率；组内重建触发频率；sync 增量变化。

## 10. 变更治理

- 设计变更走 ADR（本单需 arch-designer 产出一份 ADR：作用域/生成优先级/重建策略/sync 契约）。
- 版本按仓库惯例协同 bump（客户端 minor；服务端无版本）。

## 11. 参考落点（RD 免反向工程；最终以 arch 评审为准）

**服务端（nao-todo-server @ arch/go-ddd）**

| 文件                                                                               | 改动                                                           |
| :--------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| `domain/task/repositories/task.go` + `infrastructure/persistence/task/repoImpl.go` | `GetMaxSortId(ctx, userId, parentTaskId)` 按组取 max（0=顶层） |
| `domain/task/service/serviceImpl.go`                                               | 创建/组变更按「显式非零优先，缺省组内 max+1」                  |
| `domain/task/valueobjects/createTask.go` / `updateTask.go`                         | 承载 `SortId`（update 已有；create 视需要）                    |
| `application/task/dto/task.go` + `interfaces/types/task.go`                        | `CreateTaskReq` + `sortId`；`UpdateTaskReq` 已有               |
| `infrastructure/persistence/task/repoImpl.go` `List`                               | `parentTaskId` 查询默认 `sort_id ASC, id ASC`                  |
| `application/task/converters.go` / `interfaces/controllers/task.go`                | 透传（`GetTaskRes` 已有 `sortId`）                             |

**客户端（nao-todo）**

| 文件                                                                              | 改动                                                                                               |
| :-------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `packages/infrastructure/src/persistence-go/models/task.ts` `TaskRes`             | +`sortId`                                                                                          |
| `packages/infrastructure/src/persistence-go/task/converters.ts`                   | `taskRes2TaskEntity`/`updateTaskValueObject2Req` 映射 `sortId`；`createTaskValueObject2Req` 视需要 |
| `packages/domain-task/src/domain/entities/task.ts` `TaskEntity`                   | +尾部可选 `sortId = 0`                                                                             |
| `packages/domain-task/src/application/viewobjects/task.ts`                        | `TaskViewObject`/`UpdateTaskViewObject` +`sortId`                                                  |
| `packages/domain-task/src/application/usecases/converters.ts`                     | 显式透传 `sortId`；update VO 映射                                                                  |
| `packages/domain-task/src/application/usecases/task.ts`                           | 新增 `resort(originalId, boundId, isBefore)`（照搬检查项算法，组内重建复用 `batchUpdate`）         |
| `packages/infrastructure/src/persistence-local/db/local-database.ts` `TaskRecord` | +`sortId`（**非索引、无需 Dexie version bump**）                                                   |
| `packages/infrastructure/src/persistence-local/converters/task.ts`                | record↔entity 映射 + 兜底 0                                                                        |
| `packages/infrastructure/src/persistence-sync/sync-service.ts`                    | tasks `entityToPush` 白名单 +`sortId`                                                              |
| `packages/presentation/task/components/task-details/use-subtasks.ts`              | 子任务列表按 `sortId` 排序；暴露 `resortSubTasks`                                                  |
| `packages/presentation/task/components/task-details/main/subtasks.vue`            | 拖拽 UI（整行 drag + 插入指示线）                                                                  |
| `packages/presentation/task/components/task-details/use-event-dragger.ts`         | 泛化以复用（或用 `data-drag-item` 适配子任务行）                                                   |

## 12. 遗留登记

| 事项                             | 处置                           |
| :------------------------------- | :----------------------------- |
| 顶层任务列表手动拖拽排序（组 0） | 另立（本单只做详情面板子任务） |
| 跨父拖拽 reparent                | 另立（本单仅同级重排）         |
| 检查项「搜索/筛选 header」移植   | 不做                           |
| `sortId` 同组同值冲突            | id 二级键兜底；观察项          |

## 13. ADR 对齐补充（T0 产出，2026-09-13）

> 设计已由 `docs/adr/2026-09-13-subtask-reorder.md`（r1，arch-designer）定稿并放行 T1/T2（用户暂缓实现）。本节记录 ADR 相对本 PRD 的**增量与强制约束**，实现前以 ADR 为准。

1. **【范围增量·需知悉】R1 阻断项：子任务须按组全量加载**。详情面板子任务现为 `limit 20` 且无 load-more；重建若只重排已加载的 20 行，未加载行会在服务端排到前面，刷新后「可见任务换人」。因此**必须**：子任务按组全量拉取（如 `limit=100`）；组 > 65 行或未取尽 ⇒ **禁用重建分支**（仅允许单条浮动赋值）。未采用「服务端按组 resort 接口」（登记遗留）。
2. **查询默认序限定**：`sort_id ASC, id ASC` **仅**加在带 `parentTaskId` 过滤且 `q.Sort == ""` 的查询上；显式 `sort` 语义不变。（全局默认会把 `sort_id=0` 旧行推到顶层列表最前。）
3. **赋值落点上移**：删除领域层 `serviceImpl.go:28` 的无条件 `max+1`，改为 **app 层**按矩阵（G1–G10）赋值——因为领域层无法区分「新建 / 覆盖且父变 / 覆盖且父未变」。`sortId` **不加入** `needReadWrite`（重排不得触发 E1–E7 计数事件）。
4. **`0` 不得写列**：`CreateTaskVOToUpdateMap` 的 `SortId` 改条件写入，否则 push 存量记录 `0` 会清零组内序；客户端 create push 在 `sortId=0` 时**不产出该字段**（双向断言）。
5. **拖拽 composable 参数化**：`useEventDragger` 现硬编码 `.nue-div--event-row` / `.nue-div--event-list` / `dataset.eid`，需参数化（row/list selector + id key），**默认值保持检查项契约不变**；另加拖拽与勾选/点名称/脱离的冲突守卫（`dragstart` 时对交互元素 `preventDefault`）。
6. **`max+1` 语义与健壮性**：`COALESCE(MAX(sort_id), 255) + 1`（空组首个 = 256）；`GetMaxSortId` 改 SQL 侧 `COALESCE` 并检查 err。
7. **其他已定语义**：`Copy` 置源父组末；`Restore` 保留原 `sortId` 不重排（登记）；组 > 65 行禁重建。

**待用户知悉的唯一口径增量**：第 1 条（子任务改为按组全量加载，或退化为「禁用重建」）。其余为 ADR 层实现约束，不改变已拍板口径。

### 13.1 QA 裁定补充（2026-09-13，用例集暴露）

| #   | 议题              | 裁定                                                                                                                   |
| :-- | :---------------- | :--------------------------------------------------------------------------------------------------------------------- |
| Q1  | uint16 回绕       | **禁止回绕**：服务端 `max+1 > 65535` ⇒ 返回明确领域错误（不写入）；客户端捕获后本组重建并重试一次；组 >65 场景登记观察 |
| Q2  | 「组未取尽」检测  | 用 `List` 的 `pagination.total` 与已加载数比较：`已加载 < total` ⇒ 禁重建                                              |
| Q3  | 位置未变 no-op    | 采纳：移植算法**之前**加位置预检，位置未变 ⇒ 不发请求；差分对照（C22）只作用于有效移动                                 |
| Q4  | 前插得 `sortId=0` | 重建触发条件由先例 `< 0` 改为 **`<= 0`**（对检查项先例的**有意偏离**，ADR r2 注记）                                    |

以上由 ADR r2 回填；RD 派单已同步。

### 13.2 服务端实现判断与既有缺陷（T1 回执 fc20c74，2026-09-13）

**已接受的三处实现判断（已请 arch 补 ADR r3）**：

1. `List` 默认序条件落为 `q.ParentTaskId > 0 && q.Sort == ""`（`QueryTask.ParentTaskId` 为 `int64`，非指针；按 §7/B5 明文理由只作用真实子任务组）。
2. G2 判定由「`Id == 0`」扩展为「**行将被创建**（`Id == 0 || 行不存在`）」——覆盖桌面端携带**本地 id** 的离线新建 push；否则会写成 `sort_id=0` 落组首，违背 AC5。
3. 修正既有缺口：`NewUpdateTask` 有 `sortId` 形参但从未赋值给 VO ⇒ PATCH 侧排序值静默丢弃、**G6 不可用**；已补 `vo.SortId = sortId` + U-S3 G6 与接口层透传测试。ADR §13 证据行需修正。

**新增遗留（非本单，待另立）**：

| 事项                                | 说明                                                                                                                                    |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `serviceImpl.Copy` 吞校验错误       | `if vo.Validate() != nil { return nil, err }`（`err` 此时为 nil）⇒ 校验失败返回 `(nil, nil)`，Copy 静默无效。rd-be 已报告，未在本单修复 |
| 检查项先例 `newSortId < 0` 漏 `==0` | ADR r2 已登记；本单不修先例                                                                                                             |

### 13.3 QA 执行结果（2026-09-13，T3-执行）

- **结论：通过（PASS），0 功能缺陷。** 报告：`docs/qa/2026-09-13-subtask-reorder-report.md`。
- **环境/版本**：服务端 `fc20c74`（integration 独立库 3307，未连 dev）；客户端 `c176c922`。
- **结果**：服务端 `build/vet/test` 全绿 + integration **48 PASS / 0 FAIL**；客户端 `vp test` **59 文件 / 540 例全绿**、`vp check --no-fmt` **1011 文件 0 错 0 警**。
- **用例**：65 PASS / **0 FAIL** / 20 未测（无 E2E 基建，均非阻断）；**AC1–AC15 全部 PASS**。
- **阻断项全过**：R1 分页×重建守卫、G1–G10 双向、Q1 溢出报错+重建重试、Q4 `<=0`、Q3 no-op、AC9 组隔离、AC15 计数零变化、AC10 默认序限定。
- **未测缺口（非缺陷、待定是否补测）**：GAP-1 顶层列表「不加默认序(B5)」无自动化（仅代码审查）；GAP-2 R1「刷新后不换人」无 E2E；及跨端同步/UI E2E 若干（详见报告 §6/§7）。
- **用户手动验收（2026-09-13）**：**通过**（含拖拽交互与视觉）。
- **验收后 UI 打磨（同批）**：`afdb8228`（拖拽预览改用 `setDragImage` 半透明 ghost，源行透明度保持）→ `c8d12d73`（ghost 浅灰底 `--nue-primary-color-100` + 圆角）；两列表共用。
- **最终提交**：客户端 `c176c922`（主体）+ `afdb8228`/`c8d12d73`（预览打磨）；服务端 `fc20c74`。

### 13.4 上线后人工复查清单（GAP-1/GAP-2，自动化未覆盖）

> 触发时机：服务端 `fc20c74` 上线 + 客户端发版后。由人工执行，结论回填本节。

1. **R1 分页×重建（GAP-2，关键）**：造一个含 **>20 个**子任务的父任务，在详情面板拖拽重排（会走重建）→ 关闭重开详情 / 刷新 → 确认**顺序与内容一致、无「换人」**。
2. **未取尽/超 65 禁重建**：组内子任务超过全量加载上限（或 >65）时拖拽 → 确认**不触发重建**（仅单条浮动或 no-op），顺序仍合理。
3. **组末语义**：新建 / 换父 / 脱离后，目标组**末尾**出现；刷新后保持。
4. **跨端同步**：桌面端离线重排 → 同步 → web 端顺序一致；服务端 `updated_at` 前进且四计数不变。
5. **B5 顶层列表不变（GAP-1）**：确认顶层任务列表顺序/语义**未**因本单改变（不因 `sort_id` 追加默认序）。