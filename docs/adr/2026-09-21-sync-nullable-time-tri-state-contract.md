# ADR：同步契约「可空字段三态语义」（`nil` 缺省不写 / `""` 清空置 NULL / 合法值设值）

- **日期**：2026-09-21
- **状态**：**已裁决（已实现 / 已复核）**
- **范围**：跨仓——客户端 `packages/infrastructure/src/persistence-sync/sync-service.ts` + `packages/presentation/task/**`（载荷构造）；服务端 `nao-todo-server` 的 `interfaces/types`、`interfaces/controllers`、`application/task`、`domain/task/valueobjects`、`infrastructure/persistence/task`
- **相关**：`docs/adr/2026-09-11-def-sync-05-client-pull-cursor.md`（同一条「立即同步」链的拉取侧）、`docs/adr/2026-09-13-shell-06-offline-backfill.md`（推送重试生命周期）；服务端 SYNC-DEF-01（`5c0b25d`）为本篇的直接前置
- **术语**：`DEF-SYNC-06` = 服务端 `CreateTaskReq` 缺状态时间戳字段致 push 静默丢弃；`A-1` = 批量取消放弃用 `null` 清空失效；`②` = 关闭提醒用 `null` 清空失效

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                           |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-21** | 首次成文：三处同源误用（DEF-SYNC-06 / A-1 / ②）→ 决策「可空字段三态语义为唯一口径 + 契约防复发测试」→ 否决「`null` 表清空」「push 改走 UpdateTask」→ 影响/约束 → 证据索引 → 遗留项 |

## 1. 背景与问题

桌面端为 **local-first**：所有任务写入落本地 IndexedDB 后经 `markDirty` 入队，由 `POST /sync/push` 上行（`apps/desktop/src/renderer/src/hooks/usecases/use-task-usecase.ts:8` `newLocalTaskRepository()`；`AppRoot.vue:52` 接线防抖推送）。服务端 `SyncPushReq.Tasks` 复用 **`CreateTaskReq`**（`interfaces/controllers/sync.go:79`），而非 `PUT /tasks/{id}` 的 `UpdateTaskReq`。

本轮暴露**同一语义误用的三个缺陷**：

1. **DEF-SYNC-06（服务端契约缺口，最高严重度）**：`CreateTaskReq` 原先**没有** `archivedAt`/`starMarkAt`/`givenUpAt` 字段（对比 `UpdateTaskReq` 三字段齐全）。Go `ShouldBindJSON` 对未知 JSON 字段**静默丢弃**，`CreateTask` 仍返回成功与 id ⇒ 客户端判定「已确认」→ 清队列；下次 pull 时本地无队列项被服务端 `NULL` 覆盖 ⇒ **放弃/收藏状态「标记后刷新回退」，且不进失败重试/退避（假成功）**。桌面端「放弃」无法同步到后端即由此而来。
2. **A-1（客户端载荷误用）**：`TaskHandler.unGiveUp` 原先传 `givenUpAt: null`。服务端把 `null`/缺省视为「不写列」⇒ **批量取消放弃无法清空**服务端 `given_up_at`。任务详情页 footer 路径早已传 `''`，两条路径行为不一致。
3. **②（客户端载荷误用）**：关闭提醒时 `buildUpdateVO` 原先产出 `remindAt: null`/`remindTime: null`。Web 端 `PUT /tasks/{id}` 把 `null` 按「缺省不写列」处理 ⇒ `remind_at` **残留旧值**，而 `remindRepeat='none'`/`remindWeekdays=[]` 照写 ⇒ 状态自相矛盾。

三者共同指向一个未成文的契约：**可空字段的「缺省」与「清空」必须可区分**。

## 2. 决策

**D1 — 三态语义为唯一口径（跨客户端/服务端）**：

| 载荷形态                       | 语义                               |
| :----------------------------- | :--------------------------------- |
| 字段缺省 / `nil` / JSON `null` | **不写列**（保持原值，本次不触碰） |
| `""`（空串）                   | **清空置 NULL**                    |
| 合法时间串                     | **设值**（服务端秒级截断）         |

**D2 — 新增可空时间字段必须三态对齐**：任何进入 Create/push 或 Update 路径的可空时间字段，必须按 D1 在「请求结构体 → 接口层转换 → 应用层 VO → 持久化映射」逐层实现三态；禁止新增仅 `string`（无法区分缺省与清空）或仅靠 `null` 表清空的字段。

**D3 — `CompletedAt` 不纳入 push**：完成时间由服务端状态机（`ChangeState`）派生，`CreateTaskVOToUpdateMap` 明确不触碰 `completed_at`。

**D4 — 契约防复发测试为守护**：`sync_contract_test.go` 断言「客户端 `buildTaskPush` 字段集合 ⊆ 服务端 `CreateTaskReq ∪ UpdateTaskReq` 可表达字段集合」；`clear_nullable_time_integration_test.go` 覆盖三态落库；新增可空字段须同步更新两处。

## 3. 理由与被否方案

**为什么是「三态」而非「两态（null=清空）」**：`nil`（字段缺省）与 `null`（显式空）在 Go `*string` 反序列化后**不可区分**；把 `null` 当清空会使「不触碰该字段」无法表达（同步是**部分更新**，字段级缺省是常态），并会让 `CreateTask` 的 `FillStartAt` 类兜底复活被清空的值（SYNC-DEF-01 根因）。空串是唯一能明确表达「清空」且不歧义的线格式。

**为什么服务端补 `CreateTaskReq` 而非把 push 改派 `UpdateTask`**：

| 方案                                                       | 否决理由                                                                                                                                                                                                                                                          |
| :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B：`SyncController.Push` 对已存在 id 改派 `UpdateTask`** | ① push 的 LWW（`ParseSyncMeta`，`updatedAt` 比较）与 Update 的乐观锁（`UpdateTask.UpdatedAt`）语义不同，需重新对齐；② 载荷形状不同（`CreateTaskReq` 必填 `name/state/priority` vs `UpdateTaskReq` 全指针）；③ 墓碑 `deletedAt`/upsert 语义需保留 ⇒ 回归面远大于 A |
| **C：客户端把状态时间戳拆出单独走 `PUT /tasks/{id}`**      | 破坏离线批量模型、增加往返与失败面，仅在服务端短期无法上线时作临时缓解                                                                                                                                                                                            |

**否决「在客户端 VO 边界全局归一 `null`→`''`」**：blast radius 过大（所有可空字段、所有仓储路径），且无法覆盖服务端对「缺省」的既有语义；本轮采「载荷构造端就地修正（A-1/②）+ 服务端契约补齐（DEF-SYNC-06）」的定点修复。

## 4. 影响与约束

- **不改线格式**：`CreateTaskReq` 增加 `*string` 字段，JSON tag 不变；老客户端不传 ⇒ `Valid=false` ⇒ 不写列，向后兼容。
- **服务端字段清单**：`CreateTaskReq` 增加 `ArchivedAt`/`StarMarkAt`/`GivenUpAt *string`（`interfaces/types/task.go:39-42`）；`UpdateTaskReq` 原有三字段不变（`:68-70`）。
- **持久化三态**：`CreateTaskValueObjectToModel` 与 `CreateTaskVOToUpdateMap` 按 `Valid` 写列（缺省不写、空串写 NULL、有效写值，服务端 `truncateToSecond`）；`completed_at` 仍不触碰。
- **客户端约束**：清空语义一律用 `''`；不触碰即不进载荷（`TaskRemindSetterUpdateVO` 类型由 `string | null` 收紧为 `string`，`types.ts:19-28`）。
- **约束（未来）**：新增可空时间字段必须三态对齐 + 更新契约测试，否则视为回归。

## 5. 证据索引

| 类别                | 位置 / 提交                                                                                                                                                                               |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 服务端修复          | `nao-todo-server` `9039599`（fix(sync): push 补齐状态时间戳字段）                                                                                                                         |
| 服务端测试          | `nao-todo-server` `6c35d38`（三态 + 契约防复发）                                                                                                                                          |
| 服务端请求结构      | `interfaces/types/task.go:29-51`（三字段 `:39-42`）；`application/task/dto/task.go:48-50`                                                                                                 |
| 接口层转换          | `interfaces/controllers/task.go:102-104`（`toCreateTaskReq`）                                                                                                                             |
| 应用层转换          | `application/task/converters.go:84-86`（`CreateTaskReqToValueObject`）                                                                                                                    |
| 领域 VO             | `domain/task/valueobjects/createTask.go:80`（`nullableTimeFromCreateReq`）、`:113-143`（`NewCreateTask`）                                                                                 |
| 持久化映射          | `infrastructure/persistence/task/converters.go:33-63`（Model）、`:66-104`（`CreateTaskVOToUpdateMap`，状态时间戳 `:95-104`）                                                              |
| 契约测试            | `interfaces/controllers/sync_contract_test.go:20-110`（`clientTaskPushFields` 镜像客户端 `buildTaskPush`）                                                                                |
| 集成测试            | `infrastructure/persistence/task/sync_status_time_integration_test.go:21`；`clear_nullable_time_integration_test.go:145-200`（`:156` 注记已进 Create 模型、`:163` `completed_at` 仍派生） |
| 客户端载荷（推送）  | `packages/infrastructure/src/persistence-sync/sync-service.ts:83-100`（`buildTaskPush` 含 `archivedAt/starMarkAt/givenUpAt`）                                                             |
| 客户端 A-1 修复     | `3a0a5a99`；`packages/presentation/task/handlers/task.ts:144-146`（`givenUpAt: ''`）                                                                                                      |
| 客户端 ② 修复       | `79779c13`；`packages/presentation/task/components/remind-setter/use-task-remind-setter.ts:271-280`、`types.ts:19-28`                                                                     |
| 前置（SYNC-DEF-01） | `nao-todo-server` `5c0b25d`（`startAt/endAt/remindAt` 三态化；本篇据其范式扩展）                                                                                                          |

## 6. 遗留项

- **H2（服务端，扩容前必办）**：提醒扫描 cron 为**进程内**定时器（`infrastructure/cron/cronImpl.go`，`robfig/cron` 单例），多副本部署会产生**重复推送**；扩容前需 CAS/分布式锁。
- **H3（服务端，观察项）**：`ProcessReminders` 的 CAS 失败（用户改期）项虽 `continue` 跳过更新，但 `tasks` 原列表仍被 `return`（`domain/task/service/serviceImpl.go:211`）⇒ 仍会 `PublishReminder`。属既有行为，本单未改。
- **契约测试镜像维护**：`clientTaskPushFields` 是客户端 `buildTaskPush` 的手工镜像；客户端新增推送字段时须同步更新，否则契约测试失去守护意义（见 `sync_contract_test.go:20-31` 注释）。