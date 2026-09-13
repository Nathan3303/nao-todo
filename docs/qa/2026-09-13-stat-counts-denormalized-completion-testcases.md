# 测试用例集：领域统计属性联动收尾单（T3）

- **日期**：2026-09-13
- **角色**：QA（测试工程师）
- **状态**：用例已设计，**待用户确认范围后执行**（本单暂不执行）
- **关联需求**：`docs/prds/2026-09-13-stat-counts-denormalized-completion.md#7-AC`（AC1–AC15）
- **设计依据**：`docs/adr/2026-09-12-stat-counts-denormalized-events.md`（§4.3 事件 E1–E8 / 边界 B1–B11、§6 口径 a–e、§12 测试口径 U-S1~~S4 / U-C1~~C4）
- **部署顺序（2026-09-13 PM 修正，覆盖 PRD 旧序）**：服务端部署建列 → 执行 `backfill_counts.sql` → 客户端发版
- **范围**：出验收用例（AC1–AC15 全覆盖 + ADR 边界/口径回归）
- **非范围**：改功能代码、改 PRD/ADR、计数展示 UI、移动端代码改动、本地乐观增量

---

## 0. 用例编号与图例

| 前缀          | 层               | 类型           | 说明                            |
| :------------ | :--------------- | :------------- | :------------------------------ |
| `TC-STAT-S##` | 服务端（Go）     | 单元/集成/契约 | nao-todo-server @ `arch/go-ddd` |
| `TC-STAT-C##` | 客户端（TD/DDD） | 单元/集成回归  | nao-todo 客户端包               |
| `TC-STAT-R##` | 回填/发版/兼容   | 数据/流程/契约 | 跨仓上线与回归                  |

- **优先级**：P0＝阻断发布（B2 红线/原子性/AC 主路径）｜P1＝核心边界｜P2＝一般｜P3＝观察项
- **DDD 分层**：domain 纯单测 / application 编排（mock 端口）/ infrastructure 集成（真实 MySQL）/ presentation VTU
- **自动化落点**：已存在 = 直接复用；「待新增」= 需补用例；「人工」= 需人工核查

---

## 1. 执行环境与前置（执行阶段使用，本单不跑）

| 项             | 值                                                                                                                                |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| 服务端仓       | `/home/nathan/Project/nao-todo-server`，分支 `arch/go-ddd`                                                                        |
| 集成测试 DSN   | 默认 `root:dev_password@tcp(127.0.0.1:3307)/nao_todo_test?parseTime=true&loc=UTC&charset=utf8mb4`；可用 `NAO_TEST_MYSQL_DSN` 覆盖 |
| 测试库要求     | **独立测试库 `nao_todo_test`，禁止连 dev 库**；当前仅 3306 在监听 ⇒ 须先起独立容器（下方命令）                                    |
| 服务端单测命令 | `go build ./... && go vet ./... && go test ./...`（不带 integration tag）                                                         |
| 服务端集成命令 | `go test -tags integration ./infrastructure/persistence/task/...`（含 `TestMain` 迁移建表）                                       |
| 客户端命令     | `vp test`（按需 scoped 到包）                                                                                                     |
| 环境一致性     | 执行前记录 commit（客户端/服务端）+ MySQL 镜像版本；结论须附版本                                                                  |

独立测试库启动（禁止复用 dev 容器）：

```bash
docker run -d --name nao-todo-test-mysql \
  -e MYSQL_ROOT_PASSWORD=dev_password -e MYSQL_DATABASE=nao_todo_test \
  -p 3307:3306 mysql:8.4.9
```

---

## 2. 服务端用例

### 2.1 检查项（E1 / AC1–AC2 / 口径 c）

| ID          | 关联         | 前置                       | 步骤                                                             | 预期                                            | 优先级 | 类型 | 自动化落点                                                              |
| :---------- | :----------- | :------------------------- | :--------------------------------------------------------------- | :---------------------------------------------- | :----- | :--- | :---------------------------------------------------------------------- |
| TC-STAT-S01 | AC1          | 任务 T 存在                | `CreateTaskCheckItem(T, created=true)`                           | `T.check_item_count +1`；T 行 `updated_at` 前进 | P0     | 集成 | `count_events_integration_test.go::TestCount_CheckItemCommentLifecycle` |
| TC-STAT-S02 | AC2          | T 有 1 检查项              | `DeleteTaskCheckItem`                                            | `check_item_count -1`；T 行 `updated_at` 前进   | P0     | 集成 | 同上                                                                    |
| TC-STAT-S03 | AC2 / B7     | 检查项已软删               | 再次 `DeleteTaskCheckItem` 同 id                                 | no-op，无二次 -1，计数不变                      | P1     | 集成 | 待新增（错误推测：重复删除）                                            |
| TC-STAT-S04 | AC2          | —                          | 删除不存在的检查项 id                                            | no-op，无错误，计数不变                         | P2     | 集成 | 待新增                                                                  |
| TC-STAT-S05 | AC1 / 口径 c | T 有 N 检查项（含已 done） | 标记 `isDone=true` / 取消完成                                    | `check_item_count` 不变（总数含已完成，不分列） | P1     | 集成 | 待新增（`UpdateTaskCheckItem`）                                         |
| TC-STAT-S06 | AC1 / B1     | T 有 1 检查项              | 同 id 再次 `CreateTaskCheckItem`（upsert 覆盖，`created=false`） | 不 +1（仍 1）                                   | P0     | 集成 | `TestCount_CheckItemCommentLifecycle`                                   |

### 2.2 评论（E2 / AC3 / 口径 d）

| ID          | 关联     | 前置              | 步骤                              | 预期                                       | 优先级 | 类型 | 自动化落点                            |
| :---------- | :------- | :---------------- | :-------------------------------- | :----------------------------------------- | :----- | :--- | :------------------------------------ |
| TC-STAT-S07 | AC3      | T 存在            | `CreateTaskComment(created=true)` | `comment_count +1`；T 行 `updated_at` 前进 | P0     | 集成 | `TestCount_CheckItemCommentLifecycle` |
| TC-STAT-S08 | AC3      | T 有 1 评论       | `DeleteTaskComment`               | `comment_count -1`；bump 前进              | P0     | 集成 | 同上                                  |
| TC-STAT-S09 | AC3 / B1 | 已有评论          | 同 id upsert（`created=false`）   | 不 +1                                      | P0     | 集成 | 同上                                  |
| TC-STAT-S10 | AC3 / B7 | 评论已软删        | 再次删除同 id                     | no-op，无二次 -1                           | P1     | 集成 | 待新增                                |
| TC-STAT-S11 | 口径 d   | T 有 2 评论，删 1 | 读 `comment_count` 与评论列表     | 计数 = 未删除评论数，口径与列表一致        | P1     | 集成 | 待新增                                |

### 2.3 子任务（E3/E6 / AC4 / 口径 b、e）

| ID          | 关联          | 前置                       | 步骤                                    | 预期                                                                                         | 优先级 | 类型 | 自动化落点                                        |
| :---------- | :------------ | :------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------- | :----- | :--- | :------------------------------------------------ |
| TC-STAT-S12 | AC4           | 父 P 存在                  | `CreateTask(parentTaskId=P)`            | `P.subtask_count +1`；P 行 bump；新任务自身 `subtask_count=0`                                | P0     | 集成 | `TestCount_CreateTask_ProjectAndSubtaskIncrement` |
| TC-STAT-S13 | AC4 / E6 / B4 | 子任务 T 父=A              | `UpdateTask(T, parentTaskId=B)`         | A `-1`、B `+1`；**两父行均 bump**                                                            | P0     | 集成 | `TestCount_MoveAndReparent`                       |
| TC-STAT-S14 | AC4 / E6      | 顶层任务 T（父=0）         | `UpdateTask(T, parentTaskId=B)`（0→B）  | B `subtask_count +1`；**无旧父减 1**；**项目 `task_count` 不变**（未换项目）；无多余 ±0 事件 | P1     | 集成 | 待新增（Q1 已裁定纳入 2026-09-13）                |
| TC-STAT-S15 | AC4 / E6      | 子任务父=A                 | `UpdateTask(T, parentTaskId="")`（A→0） | A `-1`；无新父 +1                                                                            | P0     | 集成 | `TestCount_MoveAndReparent`                       |
| TC-STAT-S16 | AC4 / B8      | 子任务 T（父=P）           | `CopyTask(T)`                           | 复制品继承父 ⇒ `P.subtask_count +1`；不复制子/检查项/评论                                    | P0     | 集成 | `TestCount_CopyTask_DualEvents`                   |
| TC-STAT-S17 | AC4 / B9      | P 有子任务 C；C 有子任务 G | `DeleteTask(C)`                         | 单行软删：P `-1`；C/G 不级联（G 仍在）；被删 C 自身计数不再更新                              | P1     | 集成 | 待新增（现状缺口登记）                            |
| TC-STAT-S18 | 口径 b        | P 有子 C；C 有子 G         | 读 `P.subtask_count`                    | 只计直接子（=1），不含孙 G                                                                   | P1     | 集成 | 待新增                                            |

### 2.4 项目任务数（E4/E5/E7 / AC5–AC6 / 口径 a、e）

| ID          | 关联     | 前置                | 步骤                                                   | 预期                                                                                | 优先级 | 类型 | 自动化落点                                           |
| :---------- | :------- | :------------------ | :----------------------------------------------------- | :---------------------------------------------------------------------------------- | :----- | :--- | :--------------------------------------------------- |
| TC-STAT-S19 | AC5      | 项目 A 存在         | `CreateTask(projectId=A)`                              | `A.task_count +1`；A 行 bump                                                        | P0     | 集成 | `TestCount_CreateTask_ProjectAndSubtaskIncrement`    |
| TC-STAT-S20 | AC5      | A 有 1 任务         | `DeleteTask`                                           | `A.task_count -1`；A 行 bump                                                        | P0     | 集成 | 待新增（`TestCount_TombstoneRevive` 覆盖 delete 段） |
| TC-STAT-S21 | AC5      | A 有 1 已删任务     | `RestoreTask`                                          | `A.task_count +1`；A 行 bump                                                        | P0     | 集成 | 待新增                                               |
| TC-STAT-S22 | AC5 / B8 | 源任务在 A          | `CopyTask`                                             | A `task_count +1`                                                                   | P0     | 集成 | `TestCount_CopyTask_DualEvents`                      |
| TC-STAT-S23 | AC5 / E5 | A、B 存在，T 在 A   | `UpdateTask(projectId=B)`（move）                      | A `-1`、B `+1`；**两项目行均 bump**                                                 | P0     | 集成 | `TestCount_MoveAndReparent`                          |
| TC-STAT-S24 | 口径 a   | A 存在              | 创建**子任务**（属 A）                                 | A `task_count` 也 +1（含子任务）                                                    | P0     | 集成 | `TestCount_CreateTask_ProjectAndSubtaskIncrement`    |
| TC-STAT-S25 | AC5 / E8 | 任务 `projectId=""` | `CreateTask`                                           | 落 `project_id=userId`；**无 projects 行 ⇒ 无项目计数可维护**；不报错、任务创建成功 | P1     | 集成 | 待新增（隐式桶边界）                                 |
| TC-STAT-S26 | 口径 a   | A 有 1 任务         | 任务归档（`archivedAt`）/放弃（`givenUpAt`）设置与清除 | `A.task_count` **不变**（含归档/放弃，不新增事件）                                  | P1     | 集成 | 待新增                                               |
| TC-STAT-S27 | 口径 a   | A 有 1 任务         | 项目 `Archive` / `Unarchive`                           | `A.task_count` 不变、无重算事件（任务仅打归档标）                                   | P1     | 集成 | 待新增                                               |
| TC-STAT-S28 | AC6 / E7 | A 有 3 任务         | `Project.Delete`（级联）                               | 任务被级联软删；`A.task_count` **重算 = 0**；A 行 bump                              | P0     | 集成 | `TestCount_ProjectCascadeDeleteRestore_Recount`      |
| TC-STAT-S29 | AC6 / E7 | A 已级联删          | `Project.Restore`                                      | 任务恢复；`A.task_count` 重算 = 原值（3）                                           | P0     | 集成 | 同上                                                 |
| TC-STAT-S30 | AC6 / B5 | A 已删              | 重复触发级联删/重算                                    | 写最终值，幂等，不叠加 ±1                                                           | P1     | 集成 | 待新增                                               |
| TC-STAT-S31 | B10      | sync push 多表多条  | 一条构造失败                                           | 失败条不影响其他条；成功条主写+计数同事务生效（部分成功语义）                       | P1     | 集成 | 待新增                                               |

### 2.5 B2 红线 / 增量可发现（AC9）

| ID          | 关联        | 前置                             | 步骤                                  | 预期                                                      | 优先级 | 类型      | 自动化落点                       |
| :---------- | :---------- | :------------------------------- | :------------------------------------ | :-------------------------------------------------------- | :----- | :-------- | :------------------------------- |
| TC-STAT-S32 | AC9 / B2    | T 基准 `updated_at` 已知         | 检查项增 / 删                         | T 行 `updated_at` **严格前进**（两次变更各前进）          | P0     | 集成      | `TestCount_B2_UpdatedAtAdvances` |
| TC-STAT-S33 | AC9 / B2    | 同上                             | 评论增 / 删                           | T 行前进                                                  | P0     | 集成      | 待新增（同型扩展）               |
| TC-STAT-S34 | AC9 / B2    | 同上                             | 子任务增 / 换父 / 脱离                | **涉及的所有父行**均前进                                  | P0     | 集成      | 待新增（两父断言）               |
| TC-STAT-S35 | AC9 / B2    | 项目行基准已知                   | 任务 create / delete / restore / copy | 项目行前进                                                | P0     | 集成      | 待新增（同型扩展）               |
| TC-STAT-S36 | AC9 / B2    | 项目 A、B 基准                   | move                                  | **A、B 两行均前进**                                       | P0     | 集成      | 待新增                           |
| TC-STAT-S37 | AC9 / AC1-6 | 客户端已持游标 `(updated_at,id)` | 任一计数变更后执行 sync pull          | 该行按 keyset 顺序被拉取，返回计数为最新值（漏拉 = 失败） | P0     | 集成/契约 | 待新增（B2 的端到端意义）        |

### 2.6 LWW / 幂等 / 原子性（AC7–AC8）

| ID          | 关联     | 前置                         | 步骤                                         | 预期                                            | 优先级 | 类型 | 自动化落点                                   |
| :---------- | :------- | :--------------------------- | :------------------------------------------- | :---------------------------------------------- | :----- | :--- | :------------------------------------------- |
| TC-STAT-S38 | AC7      | T 在 A；B 存在               | `UpdateTask(T, projectId=B, updatedAt=过期)` | 更新被拒；**不发 E5**；A、B 计数均不变、不 bump | P0     | 集成 | `TestCount_LWWRejected_NoPublish`            |
| TC-STAT-S39 | AC7 / B6 | T 已软删                     | 同 id upsert 复活（`created=true`）          | 按创建 +1（项目计数回到 1）                     | P0     | 集成 | `TestCount_TombstoneRevive_CountsAsCreated`  |
| TC-STAT-S40 | AC8      | 注入「计数更新必失败」订阅者 | `CreateTask`                                 | 主写整体回滚：tasks 无新行、A `task_count` 不变 | P0     | 集成 | `TestCount_Atomicity_RollbackOnCountFailure` |
| TC-STAT-S41 | AC8      | 同上                         | 子任务路径 `CreateTask(parentTaskId)`        | 新行/父计数/项目计数**一致回滚**（半写 = 失败） | P1     | 集成 | 待新增（多事件回滚）                         |

### 2.7 server-owned 与契约（AC10）

| ID          | 关联       | 前置                              | 步骤                                                                               | 预期                                                                                             | 优先级 | 类型      | 自动化落点                                                                                                                                          |
| :---------- | :--------- | :-------------------------------- | :--------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :----- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-STAT-S42 | AC10 / B3  | —                                 | 请求体携带 `checkItemCount/commentCount/subtaskCount/taskCount` 调用 Create/Update | 字段**被忽略/拒绝**（req 结构体不存在该字段）；**不落库**：库中计数 = 服务端计算值，非请求携带值 | P0     | 集成      | 待新增（T1 补；`CreateTaskReq/UpdateTaskReq/CreateProjectReq/UpdateProjectReq`）                                                                    |
| TC-STAT-S43 | AC10 / B3  | 客户端 `updatedAt` 落后于计数更新 | 并发：客户端 UpdateTask 与计数变更交叉                                             | 计数更新绕过 `UpdateTask` 乐观锁 ⇒ **计数不被卡死**；客户端字段不被计数覆盖                      | P1     | 集成      | 待新增                                                                                                                                              |
| TC-STAT-S44 | AC10       | —                                 | 断言 res 结构含计数、req 结构不含计数                                              | `GetTaskRes/GetProjectRes` 有字段；Create/UpdateReq 无                                           | P0     | 单元      | `application/task/converters_test.go::TestTaskEntityToGetRes_Counts`、`application/project/converters_test.go::TestProjectEntityToGetRes_TaskCount` |
| TC-STAT-S45 | AC5 / 同步 | 任务/项目计数已变                 | 调用 `ListTaskSync` / 项目 sync                                                    | pull items（复用 res）携带最新计数字段                                                           | P0     | 集成/契约 | 待新增                                                                                                                                              |
| TC-STAT-S46 | AC10 / BC  | 存在 updated_at 相同的行          | 分页 pull（keyset strict `>`）                                                     | 计数 bump 产生的行按序出现，**无重复、无遗漏**；游标契约不破坏                                   | P0     | 集成/契约 | 待新增                                                                                                                                              |

---

## 3. 客户端用例

### 3.1 映射与兜底（AC11 / AC13 / U-C1）

| ID          | 关联        | 前置                                   | 步骤                          | 预期                                                    | 优先级 | 类型 | 自动化落点                                                          |
| :---------- | :---------- | :------------------------------------- | :---------------------------- | :------------------------------------------------------ | :----- | :--- | :------------------------------------------------------------------ |
| TC-STAT-C01 | AC11        | 服务端 res 带 3 计数                   | `taskRes2TaskEntity`          | 实体尾部 3 字段正确映射                                 | P0     | 单元 | `persistence-go/task/__tests__/converters.test.ts`（已有）          |
| TC-STAT-C02 | AC11        | res 带 `taskCount`                     | `projectRes2Entity`           | 实体 `taskCount` 正确映射                               | P0     | 单元 | `persistence-go/project/__tests__/converters.test.ts`（已有）       |
| TC-STAT-C03 | AC11 / BC   | res 缺 3 字段（旧服务端）              | `taskRes2TaskEntity`          | 兜底 0，不 NaN/不抛错                                   | P0     | 单元 | 同 C01（已有）                                                      |
| TC-STAT-C04 | AC11 / BC   | res 缺 `taskCount`                     | `projectRes2Entity`           | 兜底 0                                                  | P0     | 单元 | 同 C02（已有）                                                      |
| TC-STAT-C05 | AC13        | 存量 `TaskRecord` 无计数（Dexie 旧库） | record→entity 读路径          | 默认 0                                                  | P0     | 单元 | `persistence-local/converters/__tests__/converters.test.ts`（已有） |
| TC-STAT-C06 | AC13        | 存量 `ProjectRecord` 无计数            | record→entity                 | 默认 0                                                  | P0     | 单元 | 同上（已有）                                                        |
| TC-STAT-C07 | AC13        | 存量记录无计数                         | record→entity→viewobject 全链 | 全链 0，无 `undefined` 泄漏到 UI                        | P1     | 单元 | 待新增（链路级兜底）                                                |
| TC-STAT-C08 | AC13 / §5.3 | 旧版 Dexie 库（version 4）已有数据     | 升级后打开本地库              | **无 version bump、无迁移报错**，存量行可读（计数为 0） | P0     | 集成 | 待新增（Dexie 打开回归）                                            |

### 3.2 透传（AC12 / U-C2）

| ID          | 关联      | 前置                           | 步骤                                              | 预期                                              | 优先级 | 类型 | 自动化落点                                                                                              |
| :---------- | :-------- | :----------------------------- | :------------------------------------------------ | :------------------------------------------------ | :----- | :--- | :------------------------------------------------------------------------------------------------------ |
| TC-STAT-C09 | AC12      | 实体带计数                     | `taskEntityToViewObject`（显式逐字段复制）        | 3 计数透传，非 spread 回归                        | P0     | 单元 | `domain-task/.../usecases/__tests__/converters.test.ts`（已有）                                         |
| TC-STAT-C10 | AC12      | 实体带 `taskCount`             | `projectEntityToViewObject`                       | 透传                                              | P0     | 单元 | `domain-project/.../project-service/__tests__/converters.test.ts`（已有）                               |
| TC-STAT-C11 | AC12      | 实体未传计数（既有构造默认 0） | project 转换器                                    | 默认 0 并透传                                     | P1     | 单元 | 同上（已有）                                                                                            |
| TC-STAT-C12 | AC12      | 详情面板组装                   | `assembleTaskViewObject`（TaskDetailsViewObject） | 3 计数透传（继承必填，漏写 = 类型错）             | P0     | 单元 | **待新增（T2 补）**：`presentation/task/components/task-details/__tests__/use-task-view-object.test.ts` |
| TC-STAT-C13 | AC12 / B3 | viewobject → VO 写回路径       | 构造 Update 载荷                                  | 计数**不**写回（UpdateTaskViewObject 无计数字段） | P1     | 单元 | 待新增                                                                                                  |

### 3.3 构造兼容与 push 白名单（AC14 / AC15 / U-C3、U-C4）

| ID          | 关联      | 前置                       | 步骤                                           | 预期                                              | 优先级 | 类型 | 自动化落点                                        |
| :---------- | :-------- | :------------------------- | :--------------------------------------------- | :------------------------------------------------ | :----- | :--- | :------------------------------------------------ |
| TC-STAT-C14 | AC14      | 尾部可选参数默认 0         | 既有 `new TaskEntity(...)` 调用点（基线 8 处） | 零改动、编译通过、既有测试全绿                    | P0     | 回归 | 全量 `vp test` + `git diff` 核查调用点未改        |
| TC-STAT-C15 | AC14      | 同上                       | 既有 `new ProjectEntity(...)` 调用点           | 零改动、编译通过                                  | P0     | 回归 | 全量 `vp test` + diff 核查                        |
| TC-STAT-C16 | AC15 / B3 | 实体带非零 3 计数          | `pushAll()` tasks                              | 载荷无 `checkItemCount/commentCount/subtaskCount` | P0     | 单元 | `persistence-sync/__tests__/sync.test.ts`（已有） |
| TC-STAT-C17 | AC15 / B3 | 实体带非零 `taskCount`     | `pushAll()` projects                           | 载荷无 `taskCount`                                | P0     | 单元 | 待新增（projects 白名单回归；白名单已排除）       |
| TC-STAT-C18 | AC15 / BC | 新客户端 + 旧服务端响应    | 同步全流程                                     | 不崩、计数展示 0、push 正常                       | P1     | 集成 | 待新增                                            |
| TC-STAT-C19 | AC12      | 计数字段值为 0 vs 字段缺失 | 转换/展示层                                    | 两语义对消费方等价（均 0），无分支差异            | P2     | 单元 | 待新增                                            |

---

## 4. 回填 / 发版 / 兼容用例

| ID          | 关联             | 前置                                                                              | 步骤                                         | 预期                                                                                                                                                          | 优先级 | 类型      | 自动化落点                                                          |
| :---------- | :--------------- | :-------------------------------------------------------------------------------- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- | :-------- | :------------------------------------------------------------------ |
| TC-STAT-R01 | 回填 / 口径 a–e  | 构造混合数据：未删/已删任务、子任务+孙任务、已归档/已放弃、已完成检查项、已删评论 | 执行 `backfill_counts.sql`                   | 4 列按口径正确：`task_count` 含子/含归档/含放弃、不含删；`subtask_count` 仅直接子；`check_item_count` 含已完成；`comment_count` 不含删                        | P0     | 数据      | 待新增（SQL 断言脚本）                                              |
| TC-STAT-R02 | 回填 / 幂等      | R01 后                                                                            | 再次执行同 SQL                               | 结果与首次一致，无累加                                                                                                                                        | P0     | 数据      | 待新增                                                              |
| TC-STAT-R03 | 回填 / B2        | 执行前后记录 `updated_at`                                                         | 执行 SQL                                     | 被更新行 `updated_at` **前进**（有游标客户端可重拉）                                                                                                          | P0     | 数据      | 待新增                                                              |
| TC-STAT-R04 | 部署顺序（修正） | 空列版本已部署                                                                    | 按序执行：服务端部署建列 → 回填 → 客户端发版 | 顺序正确；**回填先于客户端发版**；无「发布读列后旧值覆盖回填」现象                                                                                            | P0     | 流程      | 人工检查单（ADR §11.4）                                             |
| TC-STAT-R05 | 回填 / 口径 e    | 存在「父已删、子未删」数据                                                        | 执行 SQL                                     | 子不计入已删父的 `subtask_count`；已删任务行整行不参与回填（`deleted_at IS NULL` 过滤）                                                                       | P1     | 数据      | 待新增                                                              |
| TC-STAT-R06 | 兼容 / 回滚      | 新列已建、带计数服务端回退旧代码                                                  | 回退后运行                                   | 计数列保留不报错；旧代码忽略新列；无读写异常                                                                                                                  | P2     | 人工/契约 | 人工检查单                                                          |
| TC-STAT-R07 | 版本 / CHANGELOG | 客户端工作区                                                                      | 核对版本与 CHANGELOG                         | root/desktop `1.5.0`、presentation `0.3.0`、infrastructure `0.3.0`、domain-task/project `1.1.0`、shared/presentation-react 不动；**CHANGELOG 有 v1.5.0 条目** | P2     | 人工      | 人工核查（当前 package.json 已 bump，**CHANGELOG 缺 v1.5.0 条目**） |
| TC-STAT-R08 | 监控 / 观察项    | 上线后                                                                            | 观察 sync 增量                               | bump 带来的增量行数可观测；计数与实际不符可用回填 SQL 修复（幂等）                                                                                            | P3     | 人工      | 观察项，不阻断                                                      |
| TC-STAT-R09 | 零改动红线       | —                                                                                 | 核查移动端 `presentation-react`              | 零代码改动；响应字段自动透传（读路径受益）                                                                                                                    | P1     | 人工/回归 | `git diff` 核查 + 既有测试                                          |

---

## 5. 覆盖矩阵（AC → 用例）

| AC       | 用例                    | 覆盖判定                                                           |
| :------- | :---------------------- | :----------------------------------------------------------------- |
| AC1      | S01, S05, S06           | ✅ 主路径 + upsert 负向 + 口径 c                                   |
| AC2      | S02, S03, S04           | ✅ 主路径 + 重复删/不存在                                          |
| AC3      | S07, S08, S09, S10, S11 | ✅ create/delete/upsert/重复删/口径 d                              |
| AC4      | S12–S18                 | ✅ create/换父/脱离/复制/不级联/1 层/0→B（Q1）                     |
| AC5      | S19–S27, S45            | ✅ 全写路径 + move 双项目 + 隐式桶 + 归档不联动                    |
| AC6      | S28, S29, S30           | ✅ 级联删/恢复重算 + 幂等                                          |
| AC7      | S38, S39, S06, S09      | ✅ LWW 拒绝 + created=false + 复活                                 |
| AC8      | S40, S41                | ✅ 原子性主路径 + 多事件回滚                                       |
| AC9      | S32–S37                 | ✅ 全写路径 bump + 增量可发现（**逐路径全覆盖，见下方 AC9 展开**） |
| AC10     | S42–S44, S46, C16, C17  | ✅ req 不接受 + push 不含 + 游标契约                               |
| AC11     | C01–C04, C07, C12, C18  | ✅ 映射 + 兜底 + 链路                                              |
| AC12     | C09–C13                 | ✅ 透传 + 不写回                                                   |
| AC13     | C05–C08                 | ✅ 存量记录 + Dexie 无迁移                                         |
| AC14     | C14, C15                | ✅ 调用点零改动 + 全绿                                             |
| AC15     | C16, C17                | ✅ tasks + projects 白名单                                         |
| 上线顺序 | R01–R04                 | ✅ 回填正确/幂等/bump/顺序                                         |

### 5.1 AC9「每条计数写路径 bump」展开（PM 裁定 2026-09-13：不留白）

现有 `TestCount_B2_UpdatedAtAdvances` 仅覆盖单一路径；执行阶段须**逐路径**断言「对应行 `updated_at` 严格前进」，缺一即不通过：

|  #  | 计数写路径             | 需前进的行                              | 用例 |
| :-: | :--------------------- | :-------------------------------------- | :--- |
|  1  | 检查项 create          | 所属任务行                              | S32  |
|  2  | 检查项 delete          | 所属任务行                              | S32  |
|  3  | 评论 create            | 所属任务行                              | S33  |
|  4  | 评论 delete            | 所属任务行                              | S33  |
|  5  | 子任务 create          | 父任务行                                | S34  |
|  6  | 换父 A→B（含 0→B）     | A、B 两父行                             | S34  |
|  7  | 脱离父 A→0             | A 行                                    | S34  |
|  8  | CopyTask（源为子任务） | 源父行                                  | S34  |
|  9  | 任务 create            | 项目行                                  | S35  |
| 10  | 任务 delete            | 项目行                                  | S35  |
| 11  | 任务 restore           | 项目行                                  | S35  |
| 12  | 任务 copy              | 项目行                                  | S35  |
| 13  | 任务 move A→B          | A、B 两项目行                           | S36  |
| 14  | 项目级联删             | 项目行（重算 + bump）                   | S28  |
| 15  | 项目级联恢复           | 项目行（重算 + bump）                   | S29  |
| 16  | 增量可发现（端到端）   | 变更行可被 sync pull 按游标拉取到最新值 | S37  |

### 5.2 断言缺口处置（PM 裁定：执行阶段必须补测，不得留白）

|  #  | 缺口                     | 裁定                                                     | 用例                     | 归属                |
| :-: | :----------------------- | :------------------------------------------------------- | :----------------------- | :------------------ |
|  1  | AC9 bump 仅单路径        | 扩展为**每条计数写路径**断言对应行 `updated_at` 严格前进 | S32–S37（§5.1 全 16 项） | 服务端              |
|  2  | 服务端 req 不接受计数    | 增加**直测**：请求体携带计数字段被忽略/拒绝、**不落库**  | S42（另 S43/S44）        | 服务端（**T1 补**） |
|  3  | 详情面板组装器无计数断言 | 补 `use-task-view-object` 组装器计数透传单测             | C12                      | 客户端（**T2 补**） |

> 以上 3 项均已编入上方用例表并计入 §8 执行清单；未通过 ⇒ 按 PRD §7「数据不达标处置预案」回退 RD 修复后复跑全量。

---

## 6. ADR 边界（B1–B11）→ 用例映射

| 边界 | 内容                               | 用例                        | 状态                   |
| :--- | :--------------------------------- | :-------------------------- | :--------------------- |
| B1   | 仅实际生效才发布                   | S06, S09, S38               | 已覆盖                 |
| B2   | 计数必须 bump `updated_at`（红线） | S32–S37, R03                | **部分已覆盖，需补齐** |
| B3   | 计数 server-owned（绕过 LWW）      | S42–S44, S43, C13, C16, C17 | **部分已覆盖**         |
| B4   | move/换父扩展 needReadWrite 取旧值 | S13, S15, S23, S38          | 已覆盖                 |
| B5   | 事件幂等/批量写最终值              | S28–S30                     | 已覆盖                 |
| B6   | 复活即创建                         | S39                         | 已覆盖                 |
| B7   | 无恢复接口的删除不回补             | S03, S10                    | 已覆盖                 |
| B8   | CopyTask 连带双事件                | S16, S22                    | 已覆盖                 |
| B9   | 无任务级联删                       | S17                         | 已覆盖                 |
| B10  | push 部分成功语义                  | S31                         | 待执行                 |
| B11  | cron 硬删项目无读取方              | —                           | 非本单（登记遗留）     |

## 6.1 口径 a–e → 用例映射

| 口径 | 内容                                 | 用例                              |
| :--- | :----------------------------------- | :-------------------------------- |
| a    | 项目任务数含子任务/不含删/含归档放弃 | S19, S24, S25, S26, S27, R01      |
| b    | `subtask_count` 仅直接子（1 层）     | S12, S18, R01                     |
| c    | `check_item_count` 总数含已完成      | S01, S05, R01                     |
| d    | `comment_count` 不含已删除           | S08, S11, R01                     |
| e    | 删除即出局、恢复重新计入             | S20, S21, S28, S29, S17, R01, R05 |

---

## 7. 口径确认点（不臆测，待 PM 裁定；默认按下方推荐执行）

| #   | 事项                                                                                           | 现状                                                                                                                 | QA 推荐/默认                                              | 影响                                |
| :-- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------- | :---------------------------------- |
| Q1  | AC4「换父」是否含 **0→B（顶层任务挂到父下）**                                                  | **PM 已裁定（2026-09-13）：纳入**。语义 = 父 B `subtask_count +1`、无旧父不减、项目 `task_count` 不变（与 A→0 对称） | 已纳入，用例 S14（P1）保持                                | 已关闭；建议 ADR §4.3 E6 文字补 0→B |
| Q2  | AC5「project.task_count ±1」对**隐式桶**（空 projectId → `project_id=userId`，无 projects 行） | ADR §4.3 E8 明确无行可维护                                                                                           | 不作为 ±1 断言，改断「不报错 + 无项目行副作用」，用例 S25 | 无阻塞                              |
| Q3  | 项目**归档/放弃**是否计入 `task_count`                                                         | 口径 a 已拍「含」，且**不新增** Archive/GiveUp 事件入口                                                              | 断「计数不变」，用例 S26/S27                              | 无阻塞（防回归）                    |

> 除 Q1 需 PM 一句话确认外，Q2/Q3 均可按 ADR 现有文字直接执行，不阻塞用例交付。

---

## 8. 执行前确认清单（待用户勾选范围后再跑）

**将执行的测试项（建议全跑；请指定不测项）**

1. 服务端单测/构建：`go build ./... && go vet ./... && go test ./...`
2. 服务端集成：`go test -tags integration ./infrastructure/persistence/task/...`（须先起独立 3307 测试库）
3. 客户端全量：`vp test`（含 domain-task/domain-project/infrastructure/presentation）
4. 待新增用例（**含 PM 裁定 3 项缺口，必须补测**）：S03/S04/S05/S10/S11/S14/S17/S18/S20/S21/S25/S26/S27/S30/S31/S33–S37/S41/S42/S43/S45/S46/C07/C08/**C12（T2 补）**/C13/C17/C18/C19 + R01/R02/R03/R05
5. 人工核查：R04（部署顺序）、R06（回滚）、R07（版本/CHANGELOG）、R09（移动端零改动）

**执行前置门槛**

- [ ] 3307 独立测试库就绪（**禁止连 dev 库**）
- [ ] 记录两端 commit + MySQL 镜像版本
- [ ] 用户确认「不测项」清单

---

## 9. 风险与不测项

| 项   | 说明                                                                 |
| :--- | :------------------------------------------------------------------- |
| 不测 | 计数展示 UI（另立 UI 单，本单无 UI 落点）                            |
| 不测 | 本地乐观增量（首版明确不做）                                         |
| 不测 | 按计数排序（需 Dexie version(5)，观察项）                            |
| 不测 | cron `DeleteDeactivatedProjects` 任务级联（B11，无读取方，登记遗留） |
| 风险 | 集成测试强依赖真实 MySQL；TestMain 会迁移表结构 ⇒ **必须独立库**     |
| 风险 | 时间列秒级精度 ⇒ bump 断言需前置回拨时间（既有测试已示范）           |
| 风险 | 客户端 CHANGELOG 缺 v1.5.0 条目（R07），发版前须补                   |

---

## 10. 变更记录

| 日期       | 变更                                                                                                                                                |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-13 | 首版：AC1–AC15 全覆盖 + ADR B1–B11/口径 a–e 映射；按 PM 修正部署顺序（服务端建列 → 回填 → 客户端发版）                                              |
| 2026-09-13 | PM 裁点回复并入：Q1 裁定纳入 0→B（S14 补项目计数不变断言）；§5.1 展开 AC9 全 16 项 bump 路径；§5.2 登记 3 项断言缺口处置（S33–S37、S42/T1、C12/T2） |