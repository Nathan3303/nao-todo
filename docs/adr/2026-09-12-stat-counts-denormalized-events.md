# ADR：领域统计属性联动（Task 检查事项/评论/子任务数量 + Project 任务数量；O(1) 读；跨领域事件）

- **日期**：2026-09-12
- **状态**：**已拍板（2026-09-12 用户按推荐全项通过）**；口径拍板点见 §6
- **范围**：服务端（`nao-todo-server`，分支 `arch/go-ddd`）+ 客户端全端（desktop/web 消费 `packages/presentation`；移动端 `presentation-react` **只读受益、零改动**）
- **本单只做「机制 + 字段」**：计数落库、事件联动、API/sync 字段、客户端实体/视图对象字段与解析兜底。**展示 UI（角标位置/文案）不在本单**，另立
- **相关**：`2026-09-11-def-sync-05-client-pull-cursor.md`（游标只进不退 ⇒ 计数必须 bump `updated_at` 的推演来源）；`2026-09-10-task-01-subtask-inherit.md`（D7-a 移动端不修先例）；`docs/plans/data-sync/`（同步契约）

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                                |
| :----- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-12** | 首次成文：反规范化列落点；进程内同步事件总线 + 同事务强一致；事件清单与 11 条边界；5 个口径拍板点（含推荐）；回填=一次性 SQL + bump；移动端只读受益；版本表；BC 与风险；双仓文件级落点  |
| **r2** | **2026-09-12** | **用户拍板：口径 a-e 全部按推荐通过**（含子任务/不含已删除/含已放弃已归档/1 层直接子/总数含已完成不分列/不含已删除评论/删除即出局）；范围确认 = 机制+字段，UI 展示另立；状态草案→已拍板 |

## 1. 现状与证据（只读核查）

### 1.1 服务端（nao-todo-server）

- 领域包：`identity / pomodoro / project / tag / task / types / errors`。**检查项与评论都在 task 领域**：`domain/task/entities/taskCheckItem.go`（`TaskId` 外键）、`taskComment.go`（`TaskId` 外键）；子任务 = `Task.ParentTaskId`（`domain/task/entities/task.go`；0 = 无父）。
- **无通用事件总线**。唯一端口先例：`domain/types/notification_publisher.go`（`NotificationPublisher` 接口 + `ReminderEvent` 载荷；application 层持有、`infrastructure/sse/notificationPublisher.go` 实现、`infrastructure/initialize.go:59` 装配）。
- **事务先例已存在**：`domain/types/tx.go` `TxManager`（`Do` 嵌套保护 + `DBFrom(ctx, fallback)` 取事务句柄）；**项目删除已用**：`application/project/appImpl.go:121-153` `Delete` = `txManager.Do` 内 `projectDomain.Delete` + `taskRepo.SoftDeleteByProjectId`（跨域同事务先例）。但 task 仓的 `Create/Update/Delete/Restore` 等**未走 `DBFrom`**（直接 `taskRepo.db.WithContext(ctx)`），要加入外层事务需逐方法 1 行改造（`SoftDeleteByProjectId` 已示范 `dbs.DBFrom(ctx, repo.db)`）。
- **写路径**（事件发布点，全部在 application 层）：`application/task/appImpl.go`（CreateTask/UpdateTask/DeleteTask/RestoreTask/CopyTask/ListTaskSync…）、`application/task/checkitem_app.go`、`application/task/comment_app.go`、`application/project/appImpl.go`（Create/Update/Delete/Restore/Archive/Unarchive/DeleteDeactivatedProjects）。
- **`UpdateTask` 的 LWW**：`repoImpl.go:163-190` `Update` 带 `updated_at <= req.UpdatedAt` 条件（防旧数据回滚）。**但 `needReadWrite`（appImpl.go:117-118）只含 State/ArchivedAt/StarMarkAt/GivenUpAt —— ProjectId/ParentTaskId 变更不走读-改-写**，无法在发布前得知旧值（move/换父事件需要）。
- **幂等 upsert**：task/checkitem/comment 的 Create 均走 `Upsert`（LWW + create 冲突检测，返回 `created` 标志；`repoImpl.go` UpsertCheckItem/UpsertComment 同），sync push 复用。
- **删除语义**：Task `Delete`（repoImpl.go:191）= 单行软删（`deleted_at` + `updated_at` 推进），**不级联子任务**；Project `Delete` = 软删 + `SoftDeleteByProjectId` 级联任务（无子任务递归）；cron `DeleteDeactivatedProjects`（repoImpl.go:324）= 项目软删，**无任务级联**（现状缺口，非本单）。
- **同步契约**：`interfaces/types/sync.go` pull = `(updated_at, id)` keyset 升序（`infrastructure/utils/query/sync.go`），**strict `>`**；push = 逐表循环 upsert + 墓碑，**每条独立（部分成功语义）**。pull 的 `Items` 直接复用各表 res 结构 ⇒ **Task/Project res 加字段 = sync 载荷自动携带**。
- **DTO/转换唯一出口**：`application/task/converters.go:17 TaskEntityToGetRes`、`application/project/converters.go:43 ProjectEntityToGetRes`；接口层 `interfaces/types/task.go GetTaskRes`、`project.go GetProjectRes` 逐字段搬运（`interfaces/controllers/task.go toGetTaskRes`）。
- **模型**：`infrastructure/persistence/models/task.go`（Task 表）、`models/project.go`（Project 表）；gorm 软删（`ModelBase.DeletedAt`）。

### 1.2 客户端（nao-todo）

- 实体：`TaskEntity` 构造器 = **20 个位置参数**（`packages/domain-task/src/domain/entities/task.ts`；测试注释明示「20 个位置参数」），全仓 8 个 `new TaskEntity(...)` 调用点；`ProjectEntity` 位置参数构造（`packages/domain-project/src/domain/entities/project.ts`）。**无任何计数字段**。
- 视图对象：`TaskViewObject`（`packages/domain-task/src/application/viewobjects/task.ts`）、`ProjectViewObject`（`domain-project/.../project.ts`）——显式字段类型，无计数。
- 实体→视图为**逐字段显式复制**（`packages/domain-task/src/application/usecases/converters.ts:40-75 taskEntityToViewObject`，非 spread）⇒ 计数透传需加 3 行。
- 远程模型：`packages/infrastructure/src/persistence-go/models/task.ts TaskRes`、`project.ts ProjectRes`（客户端类型别名，`ResponseBase` 派生）；转换器 `persistence-go/task/converters.ts taskRes2TaskEntity`（构造实体，位置参数）、`persistence-go/project/converters.ts projectRes2Entity`。
- 本地库：`packages/infrastructure/src/persistence-local/db/local-database.ts` —— `TaskRecord/ProjectRecord` 接口 + Dexie `NaoTodoLocalDatabase`（version 1-4）。**Dexie `stores()` 只声明索引**；非索引字段新增**不需要 version bump**（IndexedDB 对象仓库无 schema），仅需 TS 接口 + converter 兜底。
- 同步：`packages/infrastructure/src/persistence-sync/sync-service.ts` —— 7 表配置 `resToEntity / entityToRecord / recordToEntity / entityToPush`；`buildPush(fields[])` **字段白名单**（tasks 白名单无计数 ⇒ push 天然不携带；服务端 `CreateTaskReq` 也无计数字段 ⇒ 双向都不接受客户端计数）。
- 版本：root/desktop `1.4.5`；`presentation 0.2.1`；`infrastructure 0.2.2`；`domain-task 1.0.0`；`domain-project 1.0.0`；`shared 1.2.0`；`presentation-react 0.1.0`。
- 移动端：`presentation-react` 直连 API（`compose-task-usecase.ts` 等），不消费桌面端 infrastructure/sync；响应字段自动透传。

## 2. 核心决策总览

| 议题           | 决策                                                                                                                  | 状态                    |
| :------------- | :-------------------------------------------------------------------------------------------------------------------- | :---------------------- |
| O(1) 落点      | **反规范化计数列**（Task 3 列 + Project 1 列）                                                                        | ✅ 推荐（§3）           |
| 事件机制形态   | **进程内同步事件总线**（domain/types 端口 + infrastructure/events 实现，仿 notification_publisher 先例）              | ✅ 推荐（§4.1）         |
| 一致性         | **同事务强一致**（`txManager.Do` 包裹单资源写路径；计数更新经 `DBFrom` 加入同一事务）                                 | ✅ 推荐（§4.2）         |
| 同步契约       | 计数=服务端 owned 字段，只进响应/pull；push 白名单与服务端 req 均不含                                                 | ✅（§5）                |
| 本地迁移       | **无 Dexie version bump**（非索引列）；仅接口 + converter 兜底                                                        | ✅ 推荐（§5.3）         |
| 回填           | **一次性 SQL 聚合回填 + bump `updated_at`**                                                                           | ✅ 推荐（§7）           |
| 移动端         | 只读受益，零代码改动（红线）                                                                                          | ✅（§8）                |
| 版本           | root/desktop `1.5.0`；presentation `0.3.0`；infrastructure `0.3.0`；domain-task/domain-project `1.1.0`；server 无版本 | ✅（§9）                |
| 口径拍板点 a-e | 见 §6（拍板结果 = 全部按推荐）                                                                                        | ✅ 已拍板（2026-09-12） |

## 3. O(1) 落点：反规范化列（推荐）

**决策：`Task` 表加 `check_item_count / comment_count / subtask_count`，`Project` 表加 `task_count`；读 = 列读（O(1)），写 = 事件联动维护。**

否决备选：

- **计算视图/COUNT 聚合**：每次读 O(N) 或需 JOIN 子查询；任务列表/项目列表是批量读，N 次聚合放大；且 sync pull 需要**物化值**进 DTO —— 派生值只能在 DTO 组装时现算（又回到聚合）或引入缓存。
- **独立缓存层（Redis 计数）**：`domain/pomodoro` 等已用 `cache` 辅助组件，但计数一致性要求写路径与缓存原子联动，且拉取契约（`updated_at` 游标）要求计数可随行物化 —— 缓存会引入「DTO 组装时读缓存」的脆弱依赖和失效窗口。**反规范化列在 MySQL 行内与任务同生命周期，天然随 sync 游标流转。**

代价（需接受）：检查项/评论/子任务/任务的每次增删都多写**一行父行/项目行**（计数 + `updated_at`）。个人应用写频低，可接受。

## 4. 领域事件机制

### 4.1 形态：进程内同步事件总线（推荐）

- **端口**：`domain/types/` 新增 `count_events.go` —— `CountEvent` 载荷（无 JSON tag，仿 `ReminderEvent`）+ `CountEventPublisher` 接口（`PublishCountEvent(ctx, event CountEvent) error`）。
- **实现**：`infrastructure/events/` 进程内内存总线（订阅者注册表 + 同步 `Dispatch`）；**订阅者 = `application/counts/` 的 `CountUpdater`**（同时持有 taskRepo + projectRepo，跨仓访问有 `projectApp` 注入 taskRepo 的先例）。
- **装配**：`infrastructure/initialize.go`（`notificationPublisher`/`txManager` 同处）。
- **发布位置**：application 层写路径（与 `NotificationPublisher` 先例一致；domain service 保持纯净，不动）。
- **事件在事务内、提交前同步分发**；订阅者经 `DBFrom(ctx, db)` 加入同一事务。失败 ⇒ 整个事务回滚 ⇒ 计数与主写永不分离。

### 4.2 一致性：同事务强一致（推荐；否决 outbox/异步）

理由：

1. **先例齐全、成本可控**：`TxManager.Do` 嵌套保护 + `DBFrom` 已存在；项目删除已是「跨域同事务」。所需改造 = 单资源写路径包 `txManager.Do` + 相关 repo 方法改 `DBFrom`（每方法 1 行，`SoftDeleteByProjectId` 已示范）。对 4 个写入口组（task/checkitem/comment/project）是**有界、可测**的改动。
2. **outbox 的成本在这里是纯开销**：outbox 表 + 分发器 + 重试 + 补偿，换来的「最终一致」在此场景无收益——个人单写者、无跨服务订阅方、计数无并发争用；反而引入**计数漂移窗口**和**幂等/重放**复杂度。
3. **回填/重试**：强一致下无需事件重试（事务失败整体回滚，调用方重试整操作）；回填是一次性 SQL（§7）；若未来出现批量重算场景（级联/修复），用「批量重算写最终值」而非逐事件（§4.3 边界 E7）。
4. 备选（若实现成本评估后否决同事务）：计数更新作为主写后的独立自动提交语句（无 tx）—— 两语句间 crash 有极小漂移窗口，需「修复任务 + 回填 SQL 复用」兜底。**不推荐**，但登记为 B 方案。

### 4.3 事件清单（含边界）

|  #  | 事件                    | 触发点（写路径）                                                                                                  | 订阅动作                                                                                                                                                                                                                                                                                                                                                                       |
| :-: | :---------------------- | :---------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | `CheckItemCountChanged` | `CreateTaskCheckItem`（**仅 upsert `created=true`**）/ `DeleteTaskCheckItem`                                      | `tasks.check_item_count ± 1` + bump `updated_at`                                                                                                                                                                                                                                                                                                                               |
| E2  | `CommentCountChanged`   | `CreateTaskComment`（仅 created）/ `DeleteTaskComment`                                                            | `tasks.comment_count ± 1` + bump                                                                                                                                                                                                                                                                                                                                               |
| E3  | `SubTaskCountChanged`   | 子任务 create（`CreateTask` 带 parentTaskId）/ UpdateTask 清 parentTaskId / **CopyTask（复制品继承源父，父 +1）** | 父 `tasks.subtask_count ± 1` + bump                                                                                                                                                                                                                                                                                                                                            |
| E4  | `TaskCountChanged`      | `CreateTask` / `DeleteTask` / `RestoreTask` / `CopyTask`                                                          | `projects.task_count ± 1` + bump（**仅真实项目行**；隐式桶见 E8）                                                                                                                                                                                                                                                                                                              |
| E5  | `TaskMoved`             | `UpdateTask` **projectId 变更**                                                                                   | 旧项目 `-1`、新项目 `+1` + bump 两行                                                                                                                                                                                                                                                                                                                                           |
| E6  | `TaskParentChanged`     | `UpdateTask` parentTaskId 变更（A→B 或 A→0）                                                                      | 父 A `-1`、父 B `+1`                                                                                                                                                                                                                                                                                                                                                           |
| E7  | 项目级联删/恢复/归档    | `ProjectApp.Delete`（tx 内 `SoftDeleteByProjectId`）/ `Restore`（`RestoreByProjectId`）                           | **批量重算**该 `projects.task_count`（写最终值，不逐事件）                                                                                                                                                                                                                                                                                                                     |
| E8  | 计数口径过滤            | 所有计数调整                                                                                                      | 已删除（`deleted_at IS NOT NULL`）不计（§6）；归档/放弃是否计 = 待拍板。**隐式桶**：空 `projectId` 的任务服务端落 `project_id = userId`（`CreateTaskReqToValueObject`），但**无对应 `projects` 行**（内置项目 all/today/… 是客户端虚拟项目，`packages/infrastructure/src/built-in/project/default.ts`）⇒ 该桶无 `task_count` 可维护；内置项目计数若将来需要，属客户端派生/另单 |

**边界（约束规则，RD 必须遵守）**：

- **B1「仅实际生效才发布」**：LWW 拒绝（`updated_at` 过期不更新）或 upsert `created=false`（覆盖非新建）⇒ 不发布。`DeleteTaskCheckItem/DeleteTaskComment` 无 LWW，行存在即生效。
- **B2「计数与 updated_at 联动是强制项」**：任何计数列变更必须同写该行 `updated_at`，否则有游标的客户端**永不重拉**（DEF-SYNC-05 同因）。这是本 ADR 的**红线**，测试必须断言。
- **B3「计数列 server-owned」**：客户端 push 白名单（`buildPush`）与服务端 `CreateTaskReq/UpdateTaskReq` **均不接受计数字段**；计数调整走专用 repo 方法（直写列 + bump），**不走 `UpdateTask`（其 LWW 条件会把计数卡在旧值）**。
- **B4「move/换父需要旧值 ⇒ 扩展 needReadWrite」**：`UpdateTask` 的读-改-写条件须加入 `ProjectId`/`ParentTaskId`（现 appImpl.go:117-118 不含），发布前读旧值比较；仅当实际变化才发 E5/E6。
- **B5「事件幂等」**：同事务同步分发无乱序无重放；订阅方写**最终值语义**的批量方法兜底（E7）；单事件用 ±1（同 tx 内安全）。
- **B6「复活即创建」**：upsert 冲突检测把软删记录复活（推送墓碑重放场景）⇒ 按 `created=true` 口径 +1（E1/E2 已按此实现）。
- **B7「无恢复接口的删除不回补」**：检查项/评论删除后无 restore 路径 ⇒ 无反向事件（现状如此，登记防误解）。
- **B8「CopyTask 连带」**：复制任务继承源 `ParentTaskId`/`ProjectId` ⇒ 同时触发 E3（父 +1）与 E4（项目 +1）；不复制子任务/检查项/评论 ⇒ 无其他连带。
- **B9「当前无任务级联删」**：Task `Delete` 单行软删，不级联子任务 ⇒ 父删除只触发 E4（项目 -1）+ 若父本身是子任务则 E3（其父 -1）；**「父级级联删 → 递归递减」登记为将来规则**：若未来引入级联删，须按 E7 批量重算而非逐事件（否则父链上被删任务自身的计数更新无意义）。
- **B10「同步 push 循环保持部分成功语义」**：push 逐表逐条处理，**不得**把整批包进单事务；每条 = 自身操作 + 计数同事务（嵌套保护下复用外层）。
- **B11「cron 硬删项目无读取方」**：`DeleteDeactivatedProjects` 软删项目后其 `task_count` 无人读取，无需处理；若未来项目回收站展示，需补批量重算（登记遗留）。

## 5. 同步契约（客户端）

### 5.1 服务端响应与 sync 载荷

- `GetTaskRes` 加 `checkItemCount / commentCount / subtaskCount`（int）；`GetProjectRes` 加 `taskCount`（int）。
- **sync pull 自动携带**（`interfaces/types/sync.go` 的 `Items any` 直接复用 res）；DTO 转换唯一出口 `TaskEntityToGetRes / ProjectEntityToGetRes` 加 3/1 行。
- **push 不动**：白名单不含计数（§4.3 B3）。

### 5.2 客户端实体/视图对象

- `TaskEntity` + `checkItemCount/commentCount/subtaskCount`（**构造器尾部可选参数，默认 0** —— 避免破坏 8 个既有调用点；`ProjectEntity` 同理）。
- `TaskViewObject/ProjectViewObject` 加字段（`ViewObjectBase` 派生，纯增量）。
- `taskEntityToViewObject`（显式复制，`usecases/converters.ts`）+ 3 行；project 对应转换器同理。
- `taskRes2TaskEntity / projectRes2Entity`（persistence-go converters）映射计数。

### 5.3 本地 Dexie：无 version bump（评估结论）

- 计数列**不需要索引**（仅展示）⇒ `stores()` 不变 ⇒ **IndexedDB 无需迁移**，`NaoTodoLocalDatabase` 不加 version(5)。
- 改动 = `TaskRecord/ProjectRecord` 接口加字段 + `persistence-local/converters/task.ts / project.ts` 的 record↔entity 映射加字段，**undefined 兜底默认 0**（存量记录无此字段）。
- 影响面评估：**比「加列 = 迁移」预期轻一个量级**；无数据迁移、无 upgrade 逻辑、无旧数据风险。

### 5.4 本地离线写入

- 本地写**不维护计数**（删除项/新增项不回写 count 字段）：推操作 + 服务端事件重算 ⇒ **最终一致**（离线期间本地计数=同步时的快照值，展示期可旧）。
- **首版不做乐观增量**（写本地后本地 +1 的本地回显）：与「服务端为唯一计数权威」冲突且增加本地一致性维护面；登记为可选增强（§14）。

## 6. 口径拍板点（已拍板：2026-09-12 用户按推荐全项通过）

> **拍板结果**：a（含子任务 / 不含已删除 / **含已放弃已归档**）｜b（1 层直接子）｜c（总数含已完成，不分列）｜d（不含已删除评论）｜e（删除即出局、恢复重新计入）。

|  #  | 议题                                                    | 推荐                                                            | 理由                                                                                                                                     |
| :-: | :------------------------------------------------------ | :-------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
|  a  | `project.task_count` 含子任务？                         | **含**（子任务也是任务行）                                      | 「任务数量」= 该项目的任务行数；若不含子任务，父任务数对用户是反直觉的                                                                   |
|  a  | 含已删除？                                              | **不含**（软删=回收站语义）                                     | 与列表默认查询口径（`isDeleted=false` 默认）对齐                                                                                         |
|  a  | 含已放弃/已归档？                                       | **含**                                                          | 放弃/归档是状态不是删除；默认列表仍显示 ⇒ 计数与「可见任务」直觉一致；若「不含归档」则 Archive/GiveUp 也要触发事件（联动面扩大，成本高） |
|  b  | `task.subtask_count` 直接子（1 层）还是全部后代？       | **直接子（1 层）**                                              | `parentTaskId` 引用天然 1 层；全后代需递归查询破坏 O(1)；UI「子任务」即直接子                                                            |
|  c  | `task.check_item_count` 含已完成项？需 doneCount 分列？ | **总数（含已完成），首版不分列**                                | 需求原话「数量」；完成度可用详情页 checkItem 列表现算（现状已有），计数字段只服务数量展示                                                |
|  d  | `task.comment_count` 含已删除评论？                     | **不含**（软删不计）                                            | 与 task_count 口径一致；评论列表默认查询也不含已删除                                                                                     |
|  e  | 已删除任务自身还统计/计父计数？                         | **删除即出局**：不计自身、不再更新其父/项目计数；恢复时重新计入 | 删除=离开可见域；父/项目计数只反映「现存」子/任务                                                                                        |

> 拍板影响联动面：已拍「含归档/含放弃」⇒ **不新增** `Archive/Unarchive/GiveUp/UngiveUp` 事件入口；E1-E8 过滤条件 = `deleted_at IS NOT NULL` 不计（已内置），归档/放弃**不**过滤。

## 7. 回填/迁移

**决策：一次性 SQL 聚合回填（推荐），不做惰性回填。**

- 理由：个人应用数据量小；一次性成本极低；惰性需要「读取探测 + 补齐」逻辑，首读仍 O(N) 聚合，且引入「计数权威在列还是派生」的双轨；回填后列即权威。
- **回填 SQL 必须 bump `updated_at`**（`tasks.updated_at = NOW()` 或原值递增）：否则**已拉过（有游标）的存量客户端永不重拉新计数**（DEF-SYNC-05 同因）；无游标客户端的首次全量拉取天然拿到新值。
- 落点：服务端仓 `scripts/`（或 `docs/`）提供 `backfill_counts.sql`（4 个聚合 UPDATE：tasks 3 列 + projects 1 列），随部署手动执行一次（服务端无迁移框架、无版本号）。
- 检查项/评论/子任务的**存量**回填 = 各自表的聚合（`COUNT(*) WHERE deleted_at IS NULL`，口径按 §6 拍板结果加过滤）。

## 8. 移动端（红线不动）

- 服务端 `TaskRes/ProjectRes` 新增字段 ⇒ `presentation-react` 直连 API，**响应字段自动透传**，读路径免费受益。
- **零代码改动**：不修移动端（TASK-01 D7-a 先例）；移动端不消费/不展示计数（展示属后续单）；移动端写入不携带计数字段（其请求结构本就不含）。
- 版本：`presentation-react` 不动。

## 9. 版本建议

| 包                          | 现版本 | 建议      | 理由                                                                                                 |
| :-------------------------- | :----- | :-------- | :--------------------------------------------------------------------------------------------------- |
| root / apps/desktop         | 1.4.5  | **1.5.0** | 功能特性                                                                                             |
| packages/presentation       | 0.2.1  | **0.3.0** | PM 建议；导出面/依赖不变，保守 minor                                                                 |
| packages/infrastructure     | 0.2.2  | **0.3.0** | sync/converters/模型改动，PM 建议                                                                    |
| packages/domain-task        | 1.0.0  | **1.1.0** | `TaskEntity` 构造器加**尾部可选参数** ⇒ 非破坏 minor（若改位置参数破坏签名则须 2.0.0 —— **不推荐**） |
| packages/domain-project     | 1.0.0  | **1.1.0** | 同上                                                                                                 |
| packages/shared             | 1.2.0  | 不动      | `ViewObjectBase` 等仅被派生类型消费，无改动                                                          |
| packages/presentation-react | 0.1.0  | 不动      | 红线                                                                                                 |
| server                      | —      | 无版本    | deploy（git pull + docker compose）                                                                  |

## 10. BC（兼容性）

- **keyset cursor / sync 契约不破坏**：pull 契约 = `(updated_at, id)` 升序 strict `>`；新增字段不影响排序、游标、分页。push 契约不变（字段白名单不含计数）。
- **服务端响应向后兼容**：旧客户端解析新 JSON 字段 = 忽略（Go/JS 均无感）；新客户端解析旧服务端（同仓部署不适用，但字段缺失时 converter 兜底 0 已覆盖）。
- **客户端实体构造不破坏**：尾部可选参数（§9）⇒ 8 个既有 `new TaskEntity(...)` 调用点零改动。
- **既有查询/视图/移动端 API**：全部不动；`ListTask` 等无新查询参数。
- **LWW 语义不破坏**：计数更新绕过 `UpdateTask` 的乐观锁（专用 repo 方法），客户端 `updatedAt` 与计数更新互不干扰；计数列不可被客户端覆盖（B3）。
- **风险**：bump `updated_at` 增加 sync 流量（每次检查项/评论增删多拉一行任务/项目）—— 个人应用可接受；登记为观察项（§14）。

## 11. 边界/风险（本单新增，PM 清单外）

1. **B2 红线**（计数必须 bump `updated_at`）——不满足则 DEF-SYNC-05 式漏拉，计数永久陈旧；测试必断。
2. **B4 需要读-改-写**：move/换父事件的旧值来源（扩展 `needReadWrite`）；漏做则无法发 E5/E6。
3. **B3 绕过 LWW**：计数更新若误走 `UpdateTask` 会被乐观锁拒绝 ⇒ 计数卡死；必须专用 repo 方法。
4. **回填顺序**：回填必须在「首次带计数发布」之前完成，否则发布时以列为基数的最终值会把回填前的旧计数覆盖回来（发布读列 ⇒ 列=权威，回填即权威的建立时机）。
5. **E7 批量重算与 ±1 混用**：级联场景禁止逐事件（父链计数无意义、性能差）；统一「批量场景写最终值」。
6. **cron `DeleteDeactivatedProjects` 无任务级联**（现状缺口）：计数无读取方不处理；若未来项目回收站展示需补重算（B11 遗留）。
7. **Dexie 无迁移**：计数列不加索引；若未来按计数排序（如项目按任务数排序）需索引 ⇒ 那时才需 version(5) + 回填（登记遗留）。
8. **服务端无 CI/测试基建较弱**：事件联动是跨路径行为，单测 + 集成测试都要覆盖（§12）。

## 12. 测试口径

**服务端（nao-todo-server）**：

- 单测（先例：`converters_test.go`、`repoImpl_integration_test.go`）：
    - U-S1：每写路径 × 计数断言（create/delete checkitem → ±1；comment 同；子任务 create/换父/脱离 → 父 ±1；任务 create/delete/restore/copy/move → 项目 ±1；项目级联删/恢复 → 重算）。
    - U-S2：**B2 断言** —— 每次计数变更后该行 `updated_at` 前进（可被增量拉取发现）。
    - U-S3：LWW 拒绝时（`updated_at` 过期）不发布事件、计数不变；upsert `created=false` 不 ±1；复活（created=true）±1。
    - U-S4：move 事件两项目各 ±1；换父事件两父各 ±1；CopyTask 双事件。
- 集成：同事务原子性（计数更新失败 ⇒ 主写回滚）。

**客户端（nao-todo）**：

- U-C1：`taskRes2TaskEntity`/`projectRes2Entity` 映射计数；字段缺失（旧服务端/存量记录）兜底 0。
- U-C2：`taskEntityToViewObject` 计数透传；`TaskRecord` 无计数时（存量）默认 0。
- U-C3：`TaskEntity` 新尾部可选参数不破坏既有构造（既有测试全绿即验证）。
- U-C4：push 载荷断言不含计数字段（白名单回归）。

## 13. 文件级落点（RD 免反向工程）

### 13.1 服务端（nao-todo-server，分支 arch/go-ddd）

| 文件                                                                                                                 | 改动                                                                                                                                                          |
| :------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `domain/types/count_events.go`（新增）                                                                               | `CountEvent` 载荷（Type/TaskId/ParentTaskId/ProjectId/OldProjectId/NewProjectId/UserId/Delta…）+ `CountEventPublisher` 端口（仿 `notification_publisher.go`） |
| `domain/task/entities/task.go`                                                                                       | Task 实体 + `CheckItemCount/CommentCount/SubtaskCount`（承载查询结果）                                                                                        |
| `domain/project/entities/project.go`                                                                                 | Project 实体 + `TaskCount`                                                                                                                                    |
| `infrastructure/persistence/models/task.go`                                                                          | +3 列（uint，default 0）                                                                                                                                      |
| `infrastructure/persistence/models/project.go`                                                                       | +1 列                                                                                                                                                         |
| `infrastructure/persistence/task/repoImpl.go`                                                                        | 计数调整专用方法（直写列 + bump `updated_at`，**不经 UpdateTask**）；相关方法改 `DBFrom(ctx, repo.db)` 以加入外层事务                                         |
| `infrastructure/persistence/project/repoImpl.go`                                                                     | `task_count` 调整/批量重算方法（级联场景写最终值）                                                                                                            |
| `application/task/appImpl.go`                                                                                        | 写路径包 `txManager.Do` + 发布事件（E1/E3/E4/E5/E6）；`needReadWrite` 扩展 ProjectId/ParentTaskId（B4）                                                       |
| `application/task/checkitem_app.go` / `comment_app.go`                                                               | Create/Delete 包事务 + 发布（E1/E2；仅 created）                                                                                                              |
| `application/project/appImpl.go`                                                                                     | Delete/Restore 级联处发布 E7（批量重算）                                                                                                                      |
| `application/counts/count_updater.go`（新增）                                                                        | 订阅者：事件 → 各 repo 计数方法（跨仓，有 projectApp 注入 taskRepo 先例）                                                                                     |
| `infrastructure/events/bus.go`（新增）                                                                               | 内存同步总线实现                                                                                                                                              |
| `infrastructure/initialize.go`                                                                                       | 装配 bus + CountUpdater + 注入各 app（`txManager`/`notificationPublisher` 同处）                                                                              |
| `application/task/converters.go` `TaskEntityToGetRes`                                                                | +3 行计数                                                                                                                                                     |
| `application/project/converters.go` `ProjectEntityToGetRes`                                                          | +1 行                                                                                                                                                         |
| `interfaces/types/task.go` `GetTaskRes` / `project.go` `GetProjectRes`                                               | +json 字段                                                                                                                                                    |
| `interfaces/controllers/task.go` `toGetTaskRes`（:29）/ `interfaces/controllers/project.go` `toGetProjectRes`（:25） | +字段搬运                                                                                                                                                     |
| `scripts/backfill_counts.sql`（新增）                                                                                | 回填 SQL（含 bump `updated_at`）                                                                                                                              |

### 13.2 客户端（nao-todo）

| 文件                                                                                   | 改动                                                            |
| :------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `packages/infrastructure/src/persistence-go/models/task.ts` `TaskRes`                  | +3 字段                                                         |
| `packages/infrastructure/src/persistence-go/models/project.ts` `ProjectRes`            | +1 字段                                                         |
| `packages/infrastructure/src/persistence-go/task/converters.ts` `taskRes2TaskEntity`   | +3 映射                                                         |
| `packages/infrastructure/src/persistence-go/project/converters.ts` `projectRes2Entity` | +1 映射                                                         |
| `packages/domain-task/src/domain/entities/task.ts` `TaskEntity`                        | +3 尾部可选参数（默认 0）                                       |
| `packages/domain-project/src/domain/entities/project.ts` `ProjectEntity`               | +1 尾部可选参数                                                 |
| `packages/domain-task/src/application/viewobjects/task.ts` `TaskViewObject`            | +3 字段                                                         |
| `packages/domain-project/src/application/viewobjects/project.ts` `ProjectViewObject`   | +1 字段                                                         |
| `packages/domain-task/src/application/usecases/converters.ts` `taskEntityToViewObject` | +3 透传（显式复制，非 spread）                                  |
| `packages/domain-project/src/application/usecases/project-service/converters.ts`       | +1 透传                                                         |
| `packages/infrastructure/src/persistence-local/db/local-database.ts`                   | `TaskRecord`/`ProjectRecord` 接口 + 字段（**无 version bump**） |
| `packages/infrastructure/src/persistence-local/converters/task.ts` / `project.ts`      | record↔entity 映射 + undefined 兜底 0                           |
| `packages/infrastructure/src/persistence-sync/sync-service.ts`                         | **不动**（白名单已排除计数；resToEntity 已覆盖）——回归断言即可  |

## 14. 遗留登记（跨篇）

| 来源 | 事项                                                                             | 处置                         |
| :--- | :------------------------------------------------------------------------------- | :--------------------------- |
| 本单 | 计数**展示 UI**（角标位置/文案/项目列表任务数）                                  | 另立 UI 单                   |
| 本单 | 本地**乐观增量**（离线写后本地计数 +1 回显）                                     | 可选增强，首版不做           |
| 本单 | ~~若口径 a 拍「不含归档」⇒ Archive/GiveUp 触发事件~~（已拍「含」，不扩事件入口） | 已关闭                       |
| 本单 | 按计数排序（如项目按任务数排序）需索引 ⇒ 才需 Dexie version(5)                   | 观察项                       |
| 本单 | bump `updated_at` 增加 sync 流量                                                 | 观察项（个人应用量级可接受） |
| 现状 | cron `DeleteDeactivatedProjects` 无任务级联（计数无读取方，未处理）              | 若未来项目回收站展示需补重算 |

## 15. 证据索引

- 服务端：`domain/types/notification_publisher.go`（端口先例）、`domain/types/tx.go` + `infrastructure/persistence/dbs/tx.go`（TxManager/DBFrom/嵌套保护）、`application/project/appImpl.go:121-153`（跨域同事务先例）、`infrastructure/persistence/task/repoImpl.go:191`（Delete 单行软删不级联）、`:163`（Update LWW）、`application/task/appImpl.go:117-118`（needReadWrite 不含 ProjectId/ParentTaskId）、`interfaces/types/sync.go` + `infrastructure/utils/query/sync.go`（pull 契约 strict `>`）、`application/task/converters.go:17` / `application/project/converters.go:43`（DTO 唯一出口）、`interfaces/types/task.go` / `project.go`、`infrastructure/initialize.go:49-95`（装配）、`infrastructure/cron/deleteInactiveProject.go` + `repoImpl.go:324`（cron 无级联）
- 客户端：`packages/domain-task/src/domain/entities/task.ts`（20 位置参数构造，8 个 `new TaskEntity` 调用点）、`packages/domain-task/src/application/usecases/converters.ts:40-75`（显式逐字段映射）、`packages/infrastructure/src/persistence-local/db/local-database.ts`（version 1-4，stores() 仅索引）、`packages/infrastructure/src/persistence-sync/sync-service.ts`（buildPush 白名单）、`packages/infrastructure/src/persistence-go/task/converters.ts:41`（taskRes2TaskEntity）、`packages/infrastructure/src/persistence-go/project/converters.ts:28`（projectRes2Entity）、`packages/domain-project/src/application/viewobjects/project.ts`、`packages/presentation-react/src/logic/compose-task-usecase.ts`（移动端直连 API）