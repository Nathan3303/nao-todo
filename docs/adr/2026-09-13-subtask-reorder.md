# ADR：详情面板子任务拖拽排序（per-group 作用域；`sort_id` 生成优先级 / 组内重建 / 客户端持久化）

- **日期**：2026-09-13
- **状态**：**已拍板（2026-09-13 用户口径 a–h 确认；本 ADR 逐条落实，不另立口径）**；实现暂缓（用户明确只做设计步）
- **范围**：服务端（`nao-todo-server`，分支 `arch/go-ddd`）+ 客户端 desktop/web（消费 `packages/presentation`；移动端 `presentation-react` **零改动**）
- **本单只做**：详情面板**子任务同级重排**（拖拽 + 持久化 + 组末语义 + `sortId` 全链路透传）。**不做**顶层任务列表手动排序、跨父拖拽 reparent（PRD §3 Don't）
- **相关**：`docs/prds/2026-09-13-subtask-reorder.md`（需求与 AC 来源）；`2026-09-12-stat-counts-denormalized-events.md`（同批字段透传与 sync 契约先例；`needReadWrite` 扩展 B4 / upsert 覆盖分支 B12 的复用来源）；`2026-09-11-task-02-subtask-row-layout.md`（子任务行结构基线）；`2026-09-11-def-sync-05-client-pull-cursor.md`（游标只进不退）

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :----- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-13** | 首次成文：per-group 作用域 + `sort_id ASC, id ASC`；生成优先级矩阵（含 upsert 覆盖分支与「父未变不写列」）与**领域层自动赋值职责上移**；组内重建（含**分页 vs 重建范围**风险与处置）；sync 契约（push 白名单 + 服务端 Create Req）；查询默认排序**限定 `parentTaskId` 过滤**；BC/落点/测试口径/B1–B10、R1–R5                                                                                                                                                                                                                                                                                                                                                                                       |
| **r2** | **2026-09-13** | **QA 用例暴露的 3 处回填（PM 裁定，口径未变）**：① 重建触发 `newSortId < 0` → **`<= 0`**（`0` = 未设置、create push 丢弃 ⇒ 前插得 0 必须重建），对检查项先例**有意偏离**（B11，先例 `==0` 缺陷登记 §12）；② **uint16 回绕防线**：服务端 `max+1 > 65535` 返领域错误、客户端捕获后本组重建重试一次（B12）；③ **位置未变预检前置于移植算法之前**（B13，使差分对照只作用于有效移动）                                                                                                                                                                                                                                                                                                                   |
| **r3** | **2026-09-13** | **按 rd-be 实现（`fc20c74`）的事实/措辞修正（PM 已接受实现，口径未变）**：① **§7/§9.1 类型笔误**：`QueryTask.ParentTaskId` 实为 `int64`（非指针）且 `ByParentTaskId(<=0)` 一律过滤 `parent_task_id = 0` ⇒ 实现条件为 `q.ParentTaskId > 0 && q.Sort == ""`（照 `!= nil` 字面会变成「所有含顶层查询均加默认序」，与 §7/B5 直接冲突，已改正）；② **G2 判定扩展**为「**行将被创建**（`Id == 0` ∨ 行不存在）」（离线新建携本地 id 推送走 `Upsert` 的「记录不存在：带 id 创建」分支，按 `Id == 0` 会写成 `sort_id = 0` 而落组首）；③ **§13 证据修正**：`NewUpdateTask` 原有 `sortId` 形参但**从未赋值给 VO** ⇒ PATCH 排序值被静默丢弃、**G6 原不可用**，rd-be 已补 `updateTask.go:132` 并加 U-S3 G6 断言 |

## 1. 现状与证据（只读核查 2026-09-13）

### 1.1 服务端（nao-todo-server @ arch/go-ddd）

- **字段已存在**：`models.Task.SortId uint16`；`GetTaskRes.SortId uint16`（`interfaces/types/task.go:22`）⇒ **pull/详情响应已自动携带**，客户端此前未消费。
- **Req 面**：`UpdateTaskReq.SortId *uint16`（`:69`）→ `dto.UpdateTaskReq.SortId`（`dto/task.go:76`）→ `toUpdateTaskReq`（`controllers/task.go:134`）→ `NewUpdateTask(..., sortId)`（`valueobjects/updateTask.go:111`）**全链已通**，PATCH 侧只需补 G7 的注入逻辑；**`CreateTaskReq` 三处均无 `sortId`**（`interfaces/types/task.go:28-50`、`application/task/dto/task.go:37-53`、`controllers/task.go:91 toCreateTaskReq`）⇒ 新建/同步 push 无法表达显式排序值，本单补。`valueobjects.CreateTask.SortId` 已存在（`createTask.go:31`）但 `NewCreateTask` 不接收该参数 ⇒ app 层构造后赋值。
- **生成现状（per-user 全局，需改）**：`domain/task/service/serviceImpl.go:28` `CreateTask` **无条件**执行 `vo.SortId = d.taskRepo.GetMaxSortId(ctx, userId) + 1` ⇒ ① 作用域是 per-user；② **客户端显式值会被直接吃掉**（与口径「显式非零优先」冲突，必须加守卫）。
- `GetMaxSortId`（`infrastructure/persistence/task/repoImpl.go:152`）签名 `(ctx, userId)`、`MAX(sort_id)` 无 err 检查、变量初值 `255`（空集语义 ≈ 首个任务 256）。**GORM 软删默认作用域 ⇒ 已删除行天然不计**（与 STAT-01 口径 e 一致，无需额外过滤）。
- **覆盖分支会以 `0` 清零**：`CreateTaskVOToUpdateMap` 无条件写 `"SortId": vo.SortId`（`infrastructure/persistence/task/converters.go:81`）⇒ sync push 未携带（=0）的存量任务覆盖时会把组内序写成 0；`UpdateTaskValueObjectToMap` 有 `if vo.SortId != nil` 守卫（`:201`）。
- **`Copy` 不设 `SortId`**（`serviceImpl.go` `Copy` 构造 VO 未赋值）⇒ 依赖 `CreateTask` 的自动赋值（职责上移后必须在 `Copy` 内显式赋值）。
- **旧值与事件先例可直接复用**：`UpdateTask` 的 `needReadWrite` 已含 `ParentTaskId`（`application/task/appImpl.go:162-167`，STAT-01 B4）；`CreateTask` 的 upsert 覆盖分支已有事务内 `before` 读（同文件，STAT-01 B12）⇒ **「组变更」判定零额外 SELECT**。
- **列表排序现状**：`List` 仅 `query.Sort(q.Sort)`，`q.Sort == ""` 时**不加任何 ORDER BY**（`infrastructure/utils/query/sorting.go:14-15`）⇒ 子任务分页（limit 20）在无默认序时组合不稳定。`ListSync` 有独立 keyset 序（不受影响）。`ByParentTaskId` 过滤已存在。
- **无批量接口**：客户端重建走逐条更新（PRD 口径 5）。

### 1.2 客户端（nao-todo）

- **检查项先例（要模仿的对象，已全链路可用）**：`packages/domain-task/src/application/usecases/task-check-item.ts#resort`（`:125-193` 浮动间隔 `INTERVAL=1000`、`(prev+next)/2`、`diff<2 || newSortId<0 ⇒ 重建`；`:201-209` 单条；`:218-263` 重建为 `1000,2000,…`）；排序入口 `packages/presentation/task/components/task-details/use-check-items.ts#resortCheckItems`（`:89-95`）；存储层已按 `sortId` 排序（`packages/presentation/task/hooks/use-task-check-item-store-base.ts:43`）。
- **先例的关键前提：检查项是「全量在 store」**（`loadCheckItems` 直接 `list(taskId)`，无分页、无 limit）⇒ 重建范围 = 全量 = 可见范围。**子任务不同**：`use-subtasks.ts` 用 `useTasksLoader(subTaskUseCase, { limit: 20 })`，且 `subtasks.vue` 无 `load-more` ⇒ 可见/已加载 ≠ 全组（见 R1）。
- **拖拽 composable 硬编码**：`use-event-dragger.ts` 在 `resetDragElementDOD`（`:22-31`）写死 `.nue-div--event-row`，在 `handleDragLeave`（`:95-103`）写死 `.nue-div--event-list`；dataset 契约 = `data-drag-item`/`data-dod`/`data-dragging`，ID 取 `dragged.dataset.eid`（`main/events.vue:67`）。
- **Task 全链路无 `sortId`**：`TaskRes`/`TaskEntity`/`TaskViewObject`/`UpdateTaskViewObject`/`TaskRecord`/`taskRes2TaskEntity`/record↔entity 转换器/`taskEntityToViewObject`（显式逐字段）/本地 Dexie 仓库/子任务列表均无；`TaskEntity` 构造器为位置参数（STAT-01 已加 3 个尾部可选计数参数）。
- **push 白名单**：`packages/infrastructure/src/persistence-sync/sync-service.ts` tasks `entityToPush`（`:110-133`）含 `parentTaskId/projectId/deletedAt/updatedAt` 等，**不含 `sortId`** ⇒ 需新增。
- **本地列表排序能力有限**：`persistence-local/repos/task-repo-impl.ts` 支持 `query.sort` 单键 `field:order`（`:316-330`），**无法表达 `(sortId, id)` 二级键**；`parentTaskId` 过滤在 `:289-291`（`''` = 顶层）。
- **可复用的批量入口**：`TaskUseCase.batchUpdate`（`packages/domain-task/src/application/usecases/task.ts:249-278`）已存在，逐条更新且按成功项同步 store。

## 2. 决策总览

| 议题             | 决策                                                                                                                                   | 状态        |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| 作用域           | **per-group（组 = 同一 `parent_task_id`；`0` = 顶层组 0）**；否决 per-user 全局序 + 重置补丁                                           | ✅ 用户拍板 |
| 排序键           | `sort_id ASC, id ASC`（`id` 稳定二级键）                                                                                               | ✅ 用户拍板 |
| 生成优先级       | 显式非零 `sortId` 优先；未带/为 0 时，**新建/组变更**由服务端置**新组 `max+1`**；**父未变则不动**                                      | ✅ 用户拍板 |
| `0` 语义         | `0` = 未设置/服务端分配；**客户端不产出 0**；clamp `0–65535`                                                                           | ✅ 用户拍板 |
| 重建             | **仅当前组**，`1000,2000,…`；复用 `TaskUseCase.batchUpdate`；触发条件 =「间隔 < 2」或「`newSortId <= 0`」；禁止全局重排（uint16 溢出） | ✅ 用户拍板 |
| sync 契约        | `sortId` 进 desktop push 白名单；服务端 **Create/Update Req 均接受**；pull 自动携带                                                    | ✅ 用户拍板 |
| 数据迁移         | **无需**（存量 per-user `sort_id` 按组投影仍合法）                                                                                     | ✅ 用户拍板 |
| 移动端           | 零改动（响应多出字段自动忽略）                                                                                                         | ✅ 用户拍板 |
| **查询默认序**   | **仅 `q.ParentTaskId > 0`（真实子任务组）**在 `q.Sort` 为空时追加 `sort_id ASC, id ASC`（§7；`ParentTaskId` 为 `int64`，顶层不追加）   | 🟡 本 ADR   |
| **生成赋值落点** | **领域层不再无条件赋值**（`serviceImpl.go:28` 删除）⇒ 由 app 层按「新建/覆盖/换父」矩阵赋值（§4；理由见 B3）                           | 🟡 本 ADR   |
| **重建范围前提** | 详情面板子任务按组**全量拉取**（取消 `limit 20` 隐式截断）；组 > 65 行禁止重建（§5；否则 R1 成立）                                     | 🟡 本 ADR   |
| 拖拽 composable  | `useEventDragger` **参数化**（row/list selector + id dataset key），默认值保持检查项契约不变（§9.2）                                   | 🟡 本 ADR   |

## 3. 作用域与排序键

- **组键 = `parent_task_id`**：`0` 为顶层组（组 0），`> 0` 为某父的子任务组。同组内独立全序，跨组互不影响（AC9）。
- **排序 = `sort_id ASC, id ASC`**：`id` 为稳定二级键，兜底同值/存量 0 值（AC10）。
- **项目变更不改 `sortId`**：组的键是 parent 而非 project ⇒ STAT-01 的 E5（`TaskMoved`）与排序无关，**不交叉**（回应 PM 的潜在冲突点 2：无冲突；两者只是共用 `needReadWrite` 的同一次读）。
- 否决备选（per-user 全局序 + 变更重置）：把互不相关的组耦合进同一全序，需 4 项簿记（跨组重排、组内重建、同值二级键、uint16 溢出），语义与「子任务顺序」直觉不符。

## 4. 生成优先级（规则矩阵与落点）

**总规则**：请求**显式非零** `sortId` ⇒ 以请求值为准（客户端重排）；否则**仅**在「新建」或「`parentTaskId` 变化」时置**新组 `max+1`**；**其余情况不写该列**。

| #   | 入口 / 场景                                                | 请求 `sortId`                | 结果                               | 落点（裁定）                                                       |
| :-- | :--------------------------------------------------------- | :--------------------------- | :--------------------------------- | :----------------------------------------------------------------- |
| G1  | `CreateTaskReq`（新建：`Id == 0` ∨ 行不存在）              | 非零                         | 用请求值                           | app `CreateTask` 透传（领域层**不再改写**）                        |
| G2  | `CreateTaskReq`（新建：同上）                              | 未带 / 0                     | **组内 `max+1`**（组 = 新 parent） | app `CreateTask` 赋值（沿用 255 基线的 `MAX+1` 语义）              |
| G3  | `CreateTaskReq`（upsert 覆盖，`Id != 0`）                  | 非零                         | 用请求值并写列                     | app 透传 + `updateMap` 写入                                        |
| G4  | 同上（覆盖）                                               | 0 且 **父未变**              | **不写列**（保持库中原值）         | `CreateTaskVOToUpdateMap` 加守卫（B1）                             |
| G5  | 同上（覆盖）                                               | 0 且 **父已变**（换父/升降） | **新组 `max+1`**                   | app 层用 `before` 判定后赋值（复用 STAT-01 B12 的读）              |
| G6  | `UpdateTaskReq`（PATCH，sortId 显式）                      | 非零                         | 用请求值                           | 现有 `VO.SortId != nil` 守卫（`converters.go:201`）                |
| G7  | `UpdateTaskReq`（PATCH，`parentTaskId` 变化且未带 sortId） | 未带 / 0                     | **新组 `max+1`**                   | app `UpdateTask` 注入（与 E6 的 `parentChanged` 判定共用同一次读） |
| G8  | `UpdateTaskReq`（PATCH，父未变）                           | 未带                         | 不动（`nil`）                      | 现状不变                                                           |
| G9  | `CopyTask`（domain `Copy`）                                | —                            | 源父组 `max+1`（组末）             | `Copy` 内显式赋值（职责上移后必须补，否则为 0）                    |
| G10 | `RestoreTask`（恢复）                                      | —                            | **保留原 `sortId`、不重排**        | 不改代码；登记为已知语义（B7）                                     |

**「行将被创建」的判定（r3）**：`Id == 0`（服务端分配 id）**或** 「`Id != 0` 且事务内 `before == nil`」（**行不存在**）。后者是真实路径：桌面端离线新建的任务带**本地 id** 推送，`Upsert` 走「记录不存在：带 id 创建」分支（`repoImpl.go:109-114`）。若严格按 `Id == 0` 判 G2，这类新建会以 `sort_id = 0` 落库 ⇒ 排在组首，**违背 AC5（新建置末）**。故 G2/G5 统一用「创建或换父」判定，而不是 `Id` 字面。

**为何删掉领域层无条件赋值（`serviceImpl.go:28`）**：G4 要求「父未变 ⇒ 不写列」，而领域层 `CreateTask` 无法区分「新建 / 覆盖且父变 / 覆盖且父未变」（不知旧值）⇒ 保留无条件赋值会把 G4 变成「每次 push 都重排到组末」，破坏「父未变则不动」。故把赋值决策**上移到 app 层**（该层已有 `before` / `needReadWrite` 读，零额外 SELECT），领域层只做 `Validate` 与 `Upsert`。**这是与检查项先例的有意分歧**（检查项无「父未变则不动」约束，其领域层守卫 `if vo.SortId == 0` 可保留）。

**`max+1` 语义细化**：`COALESCE(MAX(sort_id), 255) + 1`（空组首个 = 256），沿用现状基线以免无谓行为漂移；**必须显式处理 NULL**（现实现依赖变量初值且未检查 err，per-group 化后建议写进 SQL 表达式，避免把 NULL 扫描语义留给驱动）。Clients clamp `0–65535`；服务端 `uint16` 直接拒绝越界 JSON（负数/超界 ⇒ 400，属可接受）。

**`0` 语义约束（B1）**：`0` = 未设置。客户端**不得**产出 0（`TaskEntity.sortId` 默认 0 只作为「未同步到值」的占位）；服务端在**覆盖分支**遇到 0 必须**跳过写列**，否则存量本地记录一旦入白名单推送就会把组内序清零。

## 5. 重建与 `uint16` 边界

- **算法照搬检查项**（浮动间隔）：`INTERVAL = 1000`；插入最前 = `next - 1000`、最后 = `prev + 1000`、中间 = `round((prev+next)/2)`；**触发重建** `(prev && next && |next-prev| < 2) || newSortId <= 0`；重建 = 本组重排为 `1000, 2000, …`（AC4）。
    - **`<= 0`（非先例的 `< 0`）—— 对检查项先例的有意偏离（B11）**：`sortId = 0` 是「未设置」哨兵（客户端 create push 丢弃 0、服务端覆盖分支跳过写列，B1/G4）⇒ 任一被赋值为 0 的排序键在同步后**退化为未设置**，顺序不可持久化。先例 `task-check-item.ts:186` 用 `newSortId < 0` ⇒ 首行 `sortId = 1000` 前插得 `0` 时不重建，落回服务端后语义丢失（先例潜在缺陷，登记 §12，本单不修）。
    - 触发阈值不变部分：`(prev && next && |next - prev| < 2)`（间隔耗尽 = 同值/相邻值，`(prev+next)/2` 取整后无法插入）。
- **位置未变预检（B13，前置于移植算法）**：移植前先做**位置预检** —— 若 `originalId == boundId`，或按当前 `(sortId, id)` 序计算的目标插入位与源位**相同**（含「相邻位置 + `isUp` 指向原位」的全部落空组合），直接 `return null`，**不发请求、不动 store**（AC3）。
    - 该预检必须位于「取相邻元素 / 计算 `newSortId`」**之前**：否则会先算出无意义的 `prev/next`，可能在 `sortId` 已耗尽时误触发**重建**（写 N 条），或在 `newSortId <= 0` 时误报回绕。差分对照用例（QA C22）只应作用于**有效移动**。
- **首次拖拽必然重建（预期行为）**：组内新任务由 `max+1` 生成 ⇒ 相邻差为 1 ⇒ 首次插入即触发重建。与检查项先例同型，成本 = 组内 N 条更新（`batchUpdate` 逐条），子任务组体量小、可接受。
- **仅当前组**：重建集合 = **该组全部行**；禁止全局（`(i+1)*1000` 在 > 65 行时溢出 `uint16`）。
- **uint16 回绕防线（B12，双层）**：
    - **服务端**：`max+1 > 65535` ⇒ **返回明确领域错误**（错误码可辨识，如 `ErrSortIdExhausted`），**禁止回绕/截断**（回绕会把新行插到组首，静默乱序）。同理，显式 `sortId` 超界由 `uint16` 绑定直接 400（不变）。
    - **客户端**：捕获该错误 ⇒ 对**本组**重建（`1000,2000,…`）并**重试一次**；仅当重建后仍失败（组 > 65 行导致重建必然溢出）才向用户暴露错误。重试只允许一次（避免循环）。
- **容量守卫**：组内行数 > 65 ⇒ **禁止重建**（不降级为部分重建；`(i+1)*1000` 与 `max+1` 都必然溢出）；此时新任务入组只能失败并暴露错误，登记观察项（§12）。
- **重建范围 = 可见范围（R1，必须满足的前提）**：检查项先例之所以正确，是因为检查项**全量在 store**。子任务现为 `limit 20` 分页且无 load-more ⇒ 若只对已加载的 20 行重建为 `1000..20000`，未加载行（值更小，如 `276…280`）会在服务端排到**重建行之前**，刷新后可见任务**换人**（顺序与内容同时变化）。
    - **处置（本单口径内，不改「客户端算 + batchUpdate」）**：详情面板子任务加载改为**按组全量**（`limit` 取组容量上界，如 100；超过则维持截断并**禁用重建分支**，仅允许 G1–G3 式的单条浮动赋值）。
    - 未采用「服务端 resort 接口按组重排」：会引入新接口与新的口径（登记为遗留，见 §12）。
- **单条浮动赋值不受 R1 影响**：只改一条可见行的值仍落在本页区间内，隐藏行相对序不变。

## 6. 同步契约

- **push（desktop）**：tasks `entityToPush` 白名单 +`sortId`（现无）。值来自实体（本地记录），因此**G4 的服务端守卫是必需的**（本地存量记录 `sortId = 0`）。
- **服务端 Req**：`CreateTaskReq` +`sortId`（`uint16`，可空语义同检查项）；`UpdateTaskReq.SortId` 已有。
- **pull / 详情响应**：`GetTaskRes.SortId` 已存在 ⇒ 自动携带，无需改动；`ListSync` 的 keyset 序不受新字段影响（BC 不破）。
- **`updated_at` 推进**：重排/重建走正常更新路径（`updateMap["updated_at"] = now`）⇒ 增量拉取可发现（与 STAT-01 B2 同精神）；**keyset 游标契约不变**。
- **与计数（STAT-01）零交叉（B8）**：`sortId` **不加入** `needReadWrite`（纯重排不应多读）；`UpdateTask` 的 E5/E6 仅在 `ProjectId/ParentTaskId` 实际变化时发布，`CreateTask` 覆盖分支的 `before` 比较同理 ⇒ 重排**不触发 E1–E7**、计数不变（AC15）。

## 7. 查询默认排序（回应 PM 潜在冲突点 1）

- **决策**：**仅当查询带真实子任务组条件（`q.ParentTaskId > 0`）**且 `q.Sort == ""` 时，追加 `ORDER BY sort_id ASC, id ASC`；显式 `q.Sort` 存在时**保持现有语义**（`query.Sort` 生效、不追加默认序）。
    - **类型与语义前提（r3 修正）**：`QueryTask.ParentTaskId` 是 **`int64`（非指针）**（`valueobjects/queryTask.go:7`），且 `ByParentTaskId` 对 `<= 0` **一律过滤 `parent_task_id = 0`**（`scopes.go:13-21`）⇒「未传 parentTaskId」≡「**显式查组 0（顶层）**」，两者不可区分。故**不能**用 `!= nil` 表达「带过滤」（那会把所有含顶层的查询都加上默认序，直接与 B5/本决策冲突），实现条件必须写 `q.ParentTaskId > 0`。
- **理由**：子任务列表按 limit 20 分页，需要**确定性顺序**，否则页组合不稳定（重建/浮动赋值后的页间跳行）；且 AC10 要求存量 `sortId = 0` 也能稳定展示。
- **否决「全局默认序」**：会改变**顶层任务列表**顺序 —— 存量 `sort_id = 0` 的行（历史版本/非常规路径产生）会全部排到有值行（≥256）**之前**，表现为「老任务跳到列表最前」。顶层手动排序本单**非范围**，不应顺手改语义。若将来要做，需先做 `sort_id = 0` 数据普查 + 回填，属独立单（§12）。
- **兼容性核对**：`query.Sort` 与默认序不冲突（默认序仅在 `q.Sort == ""` 分支追加，两者互斥）；`ListSync` 使用 `query.SyncOrder()`，与本决策无关。

## 8. BC（兼容性）

- **无需数据迁移**：存量 `sort_id` 由 per-user 全局 `max+1` 生成，按组投影仍是合法（且与创建序一致）的组内序；未重排的组保持原相对顺序。
- **存量 `sortId = 0` / 缺失**：`(sort_id, id)` 使其稳定落在组内最前（0 最小）；不崩、不报错（AC10）。**仅在覆盖分支跳过写列**（G4）⇒ 不会把 0 扩散。
- **旧服务端 + 新客户端**：客户端按本地 `sortId` 排序（presentation 层），无默认序时仍可用；`CreateTaskReq.sortId` 被旧服务端忽略 ⇒ 新建落组末由旧逻辑（per-user `max+1`）近似满足。
- **新服务端 + 旧客户端**：响应多出字段被忽略；`getMaxSortId` per-group 会让新建值的具体数字变化，但旧客户端不消费 `sortId` ⇒ 无可感知差异。
- **移动端零改动**：`presentation-react` 直连 API，响应字段自动忽略；其请求不含 `sortId`（不产出 0）。
- **`Copy` 行为**：复制品在源父组末尾（G9），与既有「复制品出现在列表末尾」观感一致。

## 9. 文件级落点（RD 免反向工程）

### 9.1 服务端（nao-todo-server @ arch/go-ddd）

| 文件                                                                                                                              | 改动                                                                                                                                                                                                                               |
| :-------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/task/repositories/task.go` + `infrastructure/persistence/task/repoImpl.go`                                                | `GetMaxSortId(ctx, userId, parentTaskId int64) uint16` **按组**取 max（`COALESCE(MAX(sort_id), 255)`；软删默认作用域天然排除）                                                                                                     |
| `domain/task/service/serviceImpl.go`                                                                                              | **删除** `CreateTask` 中无条件的 `vo.SortId = GetMaxSortId(userId)+1`（`B3`）；`Copy` 内显式置「源父组 `max+1`」（G9）；`max+1 > 65535` ⇒ **返明确领域错误**（如 `ErrSortIdExhausted`，**不回绕**，B12）                           |
| `application/task/appImpl.go` `CreateTask`                                                                                        | 复用已有 `before` 读（STAT-01 B12）：**行将被创建（`Id==0` ∨ `before==nil`）**且 `SortId==0` ⇒ 组内 `max+1`（G2，含离线携本地 id 推送的新建）；`before!=nil && SortId==0 && parentChanged` ⇒ 新组 `max+1`（G5）；非零透传（G1/G3） |
| `application/task/appImpl.go` `UpdateTask`                                                                                        | 在既有 `parentChanged` 判定（`:162-167` 读）处：`parentChanged && (req.SortId == nil \|\| *req.SortId == 0)` ⇒ 新组 `max+1`（G7）；其余不动（G6/G8）                                                                               |
| `interfaces/types/task.go` + `application/task/dto/task.go` `CreateTaskReq` + `interfaces/controllers/task.go:91 toCreateTaskReq` | **三处**补 `SortId uint16`（json tag `sortId`，现均无）；`UpdateTaskReq` 全链已通，勿动                                                                                                                                            |
| `infrastructure/persistence/task/converters.go` `CreateTaskVOToUpdateMap`                                                         | `"SortId"` 改为**条件写入**（`vo.SortId != 0` 才写，G4/B1）；`CreateTaskVOToModel` 保持直写（新建路径值已由 app 层定）                                                                                                             |
| `infrastructure/persistence/task/repoImpl.go` `List`                                                                              | `q.ParentTaskId > 0 && q.Sort == ""` ⇒ 追加 `Order("sort_id ASC").Order("id ASC")`（§7；**不可写 `!= nil`**，`ParentTaskId` 为 `int64`，见 `scopes.go:13-21`）                                                                     |
| `application/task/converters.go` / `interfaces/controllers/task.go`                                                               | 透传 `SortId`（`GetTaskRes` 已有字段，确认 create/update 入口不被丢弃）                                                                                                                                                            |
| `interfaces/controllers/sync.go`                                                                                                  | push tasks 循环无需改（复用 `CreateTaskReq`，随 `toCreateTaskReq` 带上 `sortId`）                                                                                                                                                  |

### 9.2 客户端（nao-todo）

| 文件                                                                              | 改动                                                                                                                                                                                                                                                                                                                        |
| :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/infrastructure/src/persistence-go/models/task.ts` `TaskRes`             | +`sortId: number`                                                                                                                                                                                                                                                                                                           |
| `packages/infrastructure/src/persistence-go/task/converters.ts`                   | `taskRes2TaskEntity` 映射 `sortId`（缺失兜底 0）；create/update VO→Req 带 `sortId`（当值非零时才写入 create req，避免产出 0）                                                                                                                                                                                               |
| `packages/domain-task/src/domain/entities/task.ts` `TaskEntity`                   | +**尾部可选** `sortId = 0`（既有调用点零改动）                                                                                                                                                                                                                                                                              |
| `packages/domain-task/src/application/viewobjects/task.ts`                        | `TaskViewObject` +`sortId: number`；`UpdateTaskViewObject` +`sortId?: number`                                                                                                                                                                                                                                               |
| `packages/domain-task/src/application/usecases/converters.ts`                     | `taskEntityToViewObject` 显式透传 `sortId`（非 spread）；update VO 映射                                                                                                                                                                                                                                                     |
| `packages/domain-task/src/application/usecases/task.ts`                           | 新增 `resort(originalId, boundId, isBefore)`（照抄 `task-check-item.ts:125-263` 的浮动/重建两段；重建走既有 `batchUpdate`）；**位置未变预检前置于算法之前**（B13，`return null` 不发请求）；触发条件改 `newSortId <= 0`（B11）；**捕获 `ErrSortIdExhausted` ⇒ 本组重建 + 重试一次**（B12）；**重建范围守卫**（§5 R1/65 行） |
| `packages/infrastructure/src/persistence-local/db/local-database.ts` `TaskRecord` | +`sortId`（**非索引 ⇒ 无 Dexie version bump**）                                                                                                                                                                                                                                                                             |
| `packages/infrastructure/src/persistence-local/converters/task.ts`                | record↔entity 映射 + undefined 兜底 0                                                                                                                                                                                                                                                                                       |
| `packages/infrastructure/src/persistence-sync/sync-service.ts`                    | tasks `entityToPush` 白名单 +`sortId`                                                                                                                                                                                                                                                                                       |
| `packages/presentation/task/components/task-details/use-subtasks.ts`              | 子任务加载**按组全量**（取消隐式 limit 截断，见 §5）；`subTasks` 按 `(sortId, id)` 排序；暴露 `resortSubTasks(originalId, boundId, isUp)`                                                                                                                                                                                   |
| `packages/presentation/task/components/task-details/main/subtasks.vue`            | 行加 `draggable` + `data-drag-item="true"` + `data-sid`；绑定 drag 事件；插入指示线 CSS（照抄 `events.vue:212-223` 的 `[data-dod]` 样式）                                                                                                                                                                                   |
| `packages/presentation/task/components/task-details/use-event-dragger.ts`         | **参数化**：`useEventDragger(handler, { rowSelector?, listSelector?, idKey? })`，默认值 = 现检查项契约（`.nue-div--event-row`/`.nue-div--event-list`/`eid`）；新增**同列表守卫**（`dragged.closest(listSelector) === dropped.closest(listSelector)`，否则 no-op）                                                           |

## 10. 测试口径

**服务端**

- U-S1：`GetMaxSortId(userId, parentTaskId)` 按组取值（组 0 与子组互不影响；软删行不计；空组 = 256）。
- U-S2：G1–G5 矩阵 —— 新建未带 ⇒ 组末；**离线携本地 id 推送的新建（`Id != 0` 且行不存在）未带 ⇒ 组末**（不是 `sort_id = 0` 落组首，G2 扩展）；新建显式非零 ⇒ 请求值（**断言不被 `max+1` 覆盖**，防回归 `serviceImpl.go:28`）；覆盖未带 ⇒ **`sort_id` 列不变**（守卫生效）；覆盖换父未带 ⇒ 新组组末、旧组不动；覆盖显式非零 ⇒ 请求值。
- U-S3：G6–G8 —— **PATCH 显式非零 ⇒ 真实写入请求值**（针对性断言：`NewUpdateTask` 曾不赋值 VO ⇒ G6 静默失效，r3 已修）；PATCH 换父未带 ⇒ 新组末；PATCH 父未变未带 ⇒ `sort_id` 不变且 `updated_at` 不因排序而变。
- U-S4：G9 `Copy` ⇒ 源父组末；G10 `Restore` ⇒ `sort_id` 保持。
- U-S5（BC）：存量 `sort_id = 0` 的组，`parentTaskId` 过滤查询按 `sort_id ASC, id ASC` 稳定返回；显式 `sort` 参数存在时**不**追加默认序（AC10 + §7）。
- U-S6（隔离）：重排/重建后同组序正确、其它组各 `sort_id` 不变（AC9）；计数（check/comment/subtask/task）**零变化**（AC15，与 STAT-01 集成测试同库）。
- U-S7（回绕防线，B12）：组内 `MAX(sort_id) = 65535` 时新建/换父 ⇒ 返回领域错误（**断言不写入、不回绕为 0/小值**，且行未创建）。

**客户端**

- U-C1：`taskRes2TaskEntity` / record↔entity / `taskEntityToViewObject` 透传 `sortId`，缺失兜底 0；`TaskEntity` 尾部可选参数不破坏既有构造（既有测试全绿即证）。
- U-C2：`resort` 单条分支（首/中/末三种插入位）与重建分支（差 <2 触发、**`<=0` 触发**）结果与检查项先例**逐例一致**（同输入同输出），**唯 `newSortId == 0` 例外：本单重建、先例不重建**。
- U-C2b（预检，B13）：拖到自己、拖到相邻位置的四种落空组合（`isUp` × 上/下邻）⇒ **无请求、store 不变、不触发重建**（AC3）；且**差分对照（QA C22）只在有效移动上执行**。
- U-C3：重建**仅本组**（构造两组，断言另一组无更新）；**>65 行不重建**；**组内总数 > 已加载数时不重建**（R1 守卫）。
- U-C4：push 载荷白名单包含 `sortId`；**`sortId = 0` 时的 create push 不产出该字段**（G4 前置）。
- U-C5（回绕重试，B12）：mock 服务端返 `ErrSortIdExhausted` ⇒ 客户端本组重建并**重试一次**；若重试成功 ⇒ 顺序正确；再失败 ⇒ 暴露错误且不循环。
- 组件/E2E：拖拽整行 → 插入指示线（up/down）→ 释放后顺序持久化、刷新后保持（AC1/AC2）；拖到自身/相邻 ⇒ 无请求（AC3）；**勾选/点名称/脱离按钮不触发拖拽**（AC13 交互面）；仅 1 个子任务 ⇒ 拖拽 no-op。

**不达标处置**：AC1/AC4/AC5/AC6/AC8 任一不过 ⇒ 回退修复后全量复跑；AC10 不过视为阻断；R1 守卫缺失视为阻断（数据顺序会被破坏）。

## 11. 边界与风险

| 编号 | 约束/风险                                                                                                                                                              | 处置                                                                                            |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| B1   | **`0` 不得写列**：`CreateTaskVOToUpdateMap` 现无条件写 `SortId`；不守卫则 push 存量记录清零组内序                                                                      | 条件写入（G4）；客户端 create push 不产出 0（U-C4 双向断言）                                    |
| B2   | **显式值优先必须先修领域层**：`serviceImpl.go:28` 现无条件覆盖 ⇒ 客户端重排值被吃掉                                                                                    | 删除该行，赋值决策上移到 app 层（§4 理由）                                                      |
| B3   | **领域层无法区分「新建/覆盖且父变/覆盖且父未变」**（无旧值）                                                                                                           | 赋值上移到 app 层；领域层保持纯净（只 Validate + Upsert）                                       |
| B4   | **组变更判定复用已有读**：勿新增查询                                                                                                                                   | 复用 STAT-01 的 `before`（CreateTask）/`needReadWrite`（UpdateTask）读；E6 与 G7 共用同一次判定 |
| B5   | **默认序只作用于 `parentTaskId` 查询**：全局默认序会把 `sort_id = 0` 的行推到顶层列表最前                                                                              | §7 限定条件；顶层列表语义不动                                                                   |
| B6   | **重建范围必须 = 可见范围**（否则隐藏行跳到前面、刷新后换人）                                                                                                          | 子任务按组全量加载；组 > 65 行或未取尽 ⇒ 禁重建（§5、R1）                                       |
| B7   | **`Restore` 不重排**：恢复行保留原 `sort_id`，可能落在组中而非组末                                                                                                     | 明确语义，不改代码；如需「恢复即组末」另立（§12）                                               |
| B8   | **重排不得触发计数事件**：`sortId` 不加入 `needReadWrite`；E1–E7 只看 Project/Parent 实际变化                                                                          | 代码约束 + U-S6 断言                                                                            |
| B9   | **`id` 二级键不可省**：存量同组同值（0 或重复）时无 `id` 兜底顺序不稳定                                                                                                | 客户端排序与（§7 的）服务端默认序都带 `id`                                                      |
| B10  | **拖拽与行内交互冲突**：子任务行有勾选/名称进入详情/脱离三个点击目标                                                                                                   | 整行 `draggable` + `dragstart` 时对交互元素（button/input/a）`preventDefault`；组件测试覆盖     |
| B11  | **重建触发为 `<= 0`（有意偏离检查项先例的 `< 0`）**：`0` = 未设置哨兵（create push 丢弃、覆盖分支不写列）⇒ 首行 `1000` 前插得 `0` 若落回服务端即语义丢失、顺序不可持久 | 客户端改 `<= 0` 触发重建（U-C2）；先例 `==0` 缺陷登记 §12，本单不修先例                         |
| B12  | **uint16 回绕**：服务端 `max+1 > 65535` 若回绕/截断会把新行插到组首（静默乱序）                                                                                        | 服务端返领域错误、不回绕；客户端捕获 ⇒ 本组重建 + 重试**一次**（U-S7/U-C5）                     |
| B13  | **位置未变必须无副作用**：无预检则可能先算 `prev/next`，在 `sortId` 已耗尽时误触发重建（写 N 条）或误报回绕                                                            | 预检**前置于移植算法**（取相邻/算值之前）⇒ `return null`（AC3、U-C2b）                          |
| R1   | **分页 × 重建**（见 §5）：`limit 20` 且无 load-more ⇒ 重建后可见集合会变                                                                                               | 本单必须按组全量加载或禁用重建；**视为阻断项**                                                  |
| R2   | **`GetMaxSortId` 无 err 检查 + 初值 255**：per-group 化后 NULL 语义依赖驱动行为                                                                                        | 改为 SQL 侧 `COALESCE(MAX(sort_id), 255)` 并检查 err                                            |
| R3   | **`sortId` 冲突（同组同值）**：并发/离线双端可能产生                                                                                                                   | `id` 二级键兜底；不做去冲突；观察频率（PRD §9）                                                 |
| R4   | **uint16 溢出**：组 > 65 行时重建与 `max+1` 均必然溢出                                                                                                                 | 禁止重建；服务端返错误（B12）；登记观察                                                         |
| R5   | **bump `updated_at` 增加 sync 流量**：重建 = N 行更新                                                                                                                  | 子任务组体量小；与 STAT-01 同属观察项                                                           |

## 12. 遗留登记（跨篇）

| 来源     | 事项                                                                                                                                                                                     | 处置                                                          |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| 本单     | 顶层任务列表手动拖拽排序（组 0）与顶层列表默认序（需先 `sort_id = 0` 数据普查/回填）                                                                                                     | 另立                                                          |
| 本单     | 跨父拖拽 reparent（本单只做同级重排；换父仍走父选择器/脱离入口）                                                                                                                         | 另立                                                          |
| 本单     | 服务端按组 `resort` 接口（与检查项 `ResortTaskCheckItems*` 同型），可解 R1/R4 的客户端范围约束                                                                                           | 观察项（引入新接口与口径，本单不做）                          |
| 本单     | 「恢复即组末」（B7）                                                                                                                                                                     | 观察项                                                        |
| 本单     | 组内 > 65 行的重建降级策略（B12/R4：`max+1` 与重建均溢出）                                                                                                                               | 观察项                                                        |
| **先例** | **检查项 `resort` 的 `newSortId < 0` 触发条件漏掉 `== 0`**（`task-check-item.ts:186`）：首行 `1000` 前插得 `0` ⇒ 不重建 ⇒ `0` = 未设置，create push 丢弃后顺序不可持久（B11 的偏离来源） | 本单不修（子任务用 `<= 0`）；登记为检查项遗留，如需修另立小单 |
| 本单     | 检查项「搜索/筛选 header」移植到子任务                                                                                                                                                   | 不做（PRD 明示）                                              |

## 13. 证据索引

- 服务端：`domain/task/service/serviceImpl.go:28`（无条件 `max+1`）、`:64`（`Copy` 走 `CreateTask`）、`infrastructure/persistence/task/repoImpl.go:152`（per-user `GetMaxSortId`，初值 255，无 err 检查）、`:93-146`（`Upsert` 覆盖分支与 `created=existing.DeletedAt.Valid`）、**`:109-114`（「记录不存在：带 id 创建」分支 —— r3 G2 扩展的代码依据）**、`:265-315`（`List`；r3 后 `:292-297` 已追加子任务组默认序）、`infrastructure/persistence/task/converters.go:81`（`SortId` 无条件写）、`:201`（`UpdateTask` 的 nil 守卫）、`interfaces/types/task.go:22`（`GetTaskRes.SortId`）、`:28-50`（`CreateTaskReq` 无 sortId）、`:69`（`UpdateTaskReq.SortId`）、`application/task/dto/task.go:37-53`（dto `CreateTaskReq` 无 sortId）/`:76`（dto `UpdateTaskReq.SortId`）、`interfaces/controllers/task.go:91-110`（`toCreateTaskReq` 无映射）/`:134`（`toUpdateTaskReq` 已映射）、`domain/task/valueobjects/createTask.go:31`（VO 有 SortId）/`:87-101`（`NewCreateTask` 不接收）、`domain/task/valueobjects/updateTask.go:33`（VO 字段 `SortId *uint16`）/**`:132`（`vo.SortId = sortId` —— r3 前缺失 ⇒ PATCH 排序值静默丢弃、G6 不可用；`fc20c74` 已补）**、`domain/task/valueobjects/queryTask.go:7`（`ParentTaskId int64`）、`infrastructure/persistence/task/scopes.go:13-21`（`ByParentTaskId(<=0)` ⇒ `parent_task_id = 0`）、`infrastructure/persistence/task/repoImpl.go:292-297`（`q.ParentTaskId > 0 && q.Sort == ""` 追加默认序的落地）、`application/task/appImpl.go:95-105`（CreateTask 的 `before` 读）、`:162-167`（`needReadWrite` 含 `ParentTaskId`）、`infrastructure/utils/query/sorting.go:14-15`（`sort` 为空不加 ORDER BY）
- 客户端：`packages/domain-task/src/application/usecases/task-check-item.ts:125-193/201-209/218-263`（浮动间隔 + 重建先例）、`:183-191`（`needsRebuild = … || newSortId < 0` —— B11 偏离点）、`packages/presentation/task/components/task-details/use-check-items.ts:89-95`、`packages/presentation/task/hooks/use-task-check-item-store-base.ts:43`（store 内排序）、`packages/presentation/task/components/task-details/use-event-dragger.ts:22-31/95-103`（硬编码 selector）、`main/events.vue:67/212-223`（`dataset.eid` + 指示线 CSS）、`packages/presentation/task/components/task-details/use-subtasks.ts:44-50/72`（`limit 20`、无排序）、`main/subtasks.vue:98-140`（行结构与交互目标）、`packages/infrastructure/src/persistence-local/repos/task-repo-impl.ts:289-291/316-330`（`parentTaskId` 过滤与单键 sort）、`packages/infrastructure/src/persistence-sync/sync-service.ts:110-133`（tasks 白名单）、`packages/domain-task/src/application/usecases/task.ts:249-278`（`batchUpdate`）