# PRD：领域统计属性联动收尾单（Task 检查项/评论/子任务数 + Project 任务数；O(1) 读；跨领域事件）

- **日期**：2026-09-13
- **状态**：✅ 已交付并上线（2026-09-13）；用户确认完成「服务端部署建列 → 生产回填 → 客户端发版（tag `v1.5.0`，origin 已推）」
- **设计依据**：`docs/adr/2026-09-12-stat-counts-denormalized-events.md`（r2，2026-09-12 已拍板，口径 a–e 全项通过）。**本 PRD 不重复设计，只定义「收尾范围 + 验收」**。
- **性质**：收尾单（前序单已完成设计拍板 + 两端大部分实现；本单把剩余项做完并验收归档）
- **相关**：`docs/prds/README.md`（归档索引）；`nao-todo-server@arch/go-ddd`（服务端工作区）

## 0. 证据（状态截至 2026-09-13 交付；初盘快照见 §12）

| 项                   | 状态            | 证据                                                                                                                                                                              |
| :------------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 设计契约             | ✅ 已拍板       | ADR `2026-09-12-stat-counts-denormalized-events.md`（r3，含 sync push E5/E6 触发点 + B12）                                                                                        |
| 客户端字段透传       | ✅ 已提交       | commit `8ce494cb`（TaskRes+3 / ProjectRes+1、实体/视图对象/兜底、push 白名单、+10 测试、ADR）                                                                                     |
| 服务端机制+字段      | ✅ 已提交       | `nao-todo-server@arch/go-ddd`：`d934c11`（主体：反规范化列 + 事件总线 + CountUpdater + 9 写路径同事务 E1–E7 + 回填 SQL）+ `a777f94`（sync push 覆盖分支补发 E5/E6）；工作区 clean |
| 服务端测试           | ✅ 全绿         | 独立库 `127.0.0.1:3307/nao_todo_test`（未连 dev）：`go build/vet` OK、18 包单测全绿、计数集成 **15/15 PASS**、`-tags integration` 全 ok；AC8 证据见 §12                           |
| 客户端版本/CHANGELOG | ✅ 已做         | root/desktop `1.5.0`、presentation/infrastructure `0.3.0`、domain-task/project `1.1.0`（shared / presentation-react 不动）；CHANGELOG 含 `[v1.5.0]`；`vp test` 515 例全绿         |
| 展示 UI              | ❌ 明确不在本单 | ADR §14 遗留：展示 UI 另立                                                                                                                                                        |
| PRD 归档             | ✅ 已归档       | 本文件 + `docs/prds/README.md` 索引（STAT-01）；QA 用例集 `docs/qa/2026-09-13-stat-counts-denormalized-completion-testcases.md`                                                   |

## 1. 问题证据与 5 Whys

需求：Task 需 O(1) 获取检查项/评论/子任务数量，Project 需 O(1) 获取任务数量；跨领域数据由领域事件联动。

- Why 1：为何要 O(1)？列表/详情页批量读取，逐行 COUNT 聚合会放大成 O(N×M)。
- Why 2：为何不用视图/缓存？sync 契约要求计数随行物化进 DTO；缓存有失效窗口。
- Why 3：为何要事件？计数属派生数据，权威在主表（检查项/评论/任务），需写路径联动维护。
- Why 4：为何要同事务？异步/outbox 会引入漂移窗口与幂等复杂度，个人单写者场景无收益。
- Why 5：为何现在收尾？前序单已把机制与两端字段写完，剩余为提交/回填/验收/归档，不做则功能不生效。

## 2. 目标指标

| 指标     | 目标                                       | 度量方式                                 |
| :------- | :----------------------------------------- | :--------------------------------------- |
| 读复杂度 | 计数读取 = 列读取 O(1)                     | 代码审查 + 响应字段断言                  |
| 一致性   | 计数与主写同事务，漂移 = 0                 | 集成测试（计数失败 ⇒ 主写回滚）          |
| 增量可见 | 计数变更 100% bump `updated_at`（B2 红线） | U-S2 断言                                |
| 兼容     | 旧服务端/存量记录缺失字段兜底 0            | U-C1 断言                                |
| 回填     | 存量数据一次性回填并 bump                  | `scripts/backfill_counts.sql` 幂等可重跑 |

## 3. 范围 / 非范围

**做（Do）**

1. 服务端：核对 ADR §13.1 落点齐备 → 独立测试库执行 integration 测试（U-S1~S4 + 原子性）→ 提交。
2. 客户端：确认 commit `8ce494cb` 覆盖 ADR §13.2 全项 → 版本协同 bump（`1.5.0` / `presentation 0.3.0` / `infrastructure 0.3.0` / `domain-task 1.1.0` / `domain-project 1.1.0`）→ CHANGELOG 条目。
3. 回填：`backfill_counts.sql` 在「首次带计数发布」之前执行一次（ADR §11.4 顺序约束）。
4. 验收：服务端 integration + 客户端单测 + 端到端联调（计数随增删实时正确）。
5. 归档：本 PRD 完成终签后同步 `docs/prds/README.md`。

**不做（Don't）**

- 计数展示 UI（角标位置/文案/项目列表任务数）——ADR §14 另立 UI 单。
- 移动端 `presentation-react` 代码改动（红线：只读受益，零改动）。
- 本地乐观增量（离线写后本地 +1 回显）——ADR §5.4 可选增强，首版不做。
- 按计数排序（需 Dexie 索引/version bump）——观察项。
- cron `DeleteDeactivatedProjects` 任务级联补齐——现状缺口，无读取方，不处理。

## 4. 用户场景

- **画像**：个人待办用户（单写者、低写频）。
- **场景卡**：用户在任务列表/详情查看「检查项 n / 评论 n / 子任务 n」，在项目列表查看「任务 n」；数值无需进入详情即可知。
- **关键路径**：新增/删除检查项、评论、子任务 → 父任务计数变化；新建/删除/恢复/复制/移动任务 → 项目任务数变化；客户端增量拉取随 `updated_at` 拿到新计数。
- **页面状态清单**：本单无 UI 落点（展示属另立单）；消费侧状态（加载/空/错误/成功）由 UI 单定义。**本条即 ADR 的既定边界，非缺失。**

## 5. 业务规则

- 口径拍板（ADR §6，用户 2026-09-12 全项通过）：
    - a. `project.task_count` 含子任务；不含已删除；**含已放弃/已归档**。
    - b. `task.subtask_count` = 直接子（1 层）。
    - c. `task.check_item_count` = 总数（含已完成，不分列）。
    - d. `task.comment_count` 不含已删除评论。
    - e. 删除即出局（不计自身，不再更新父/项目）；恢复重新计入。
- 边界（ADR §4.3 B1–B11，RD 必须遵守）：仅实际生效才发布；**B2 计数必须 bump `updated_at`（红线）**；计数 server-owned（push 白名单与服务端 req 均不含）；move/换父需扩展 `needReadWrite` 取旧值；级联场景批量重算写最终值；同事务强一致。
- 不变量：计数列 ≠ 客户端可写；计数更新绕过 `UpdateTask` 乐观锁（专用 repo 方法）。

## 6. NFRs（业务视角基线）

| 维度   | 基线                                                                         |
| :----- | :--------------------------------------------------------------------------- |
| 性能   | 计数读取不引入额外查询；写路径每次增删多写 1 行父行/项目行（个人量级可接受） |
| 一致性 | 同事务强一致；崩溃不产生半写                                                 |
| 兼容   | 旧服务端/存量客户端字段缺失兜底 0；sync keyset 游标契约不破坏                |
| 安全   | 计数不可被客户端覆盖（server-owned）                                         |
| 可观测 | 回填 SQL 幂等；版本/CHANGELOG 留痕                                           |

> 技术指标转译与可行性由架构师确认（arch-designer 回执）。本单无选型变更，可走轻量确认。

## 7. AC（Given/When/Then）

**服务端（nao-todo-server）**

- AC1：Given 任务存在，When 新增检查项（`created=true`），Then `check_item_count +1` 且该任务 `updated_at` 前进。
- AC2：Given 检查项存在，When 删除，Then `check_item_count -1` 且 bump。
- AC3：Given 评论同理（create/delete），Then `comment_count` ±1 且 bump；`created=false` 的 upsert 不变。
- AC4：Given 父任务，When 子任务 create / 换父 / 脱离 / CopyTask，Then 父 `subtask_count` 正确（±1 或双事件 A−1/B+1）。
- AC5：Given 任务，When create/delete/restore/copy/move，Then `project.task_count` ±1；move 双项目各 ±1。
- AC6：Given 项目级联删除/恢复，When 执行，Then `task_count` 按批量重算写最终值（不逐事件）。
- AC7（负向）：Given LWW 拒绝（`updated_at` 过期）或 upsert `created=false`，Then 不发布事件、计数不变；软删复活（`created=true`）Then +1。
- AC8（原子性）：Given 计数更新失败，When 主写提交，Then 整体回滚（主写不落库）。**架构评审标注：本 AC 与全部计数集成测试为「同事务强一致」NFR 的唯一证据，须在独立测试库上实跑取证。**
- AC9（B2 红线）：以上每次计数变更后对应行 `updated_at` 严格前进（可被增量拉取发现）。
- AC10：Given 客户端 push 载荷，Then 不含任何计数字段；服务端 req 不接受计数字段。

**客户端（nao-todo）**

- AC11：Given 服务端响应含计数，When `taskRes2TaskEntity`/`projectRes2Entity`，Then 字段正确映射；缺失时兜底 0。
- AC12：Given 实体，When `taskEntityToViewObject`/project 转换器，Then 计数透传。
- AC13：Given 存量 `TaskRecord`/`ProjectRecord` 无计数字段，When 读取，Then 默认 0。
- AC14：Given 新增尾部可选参数，Then 既有 8 个 `new TaskEntity(...)` 调用点零改动、既有测试全绿。
- AC15：Given push 载荷，Then 白名单回归断言不含计数。

**数据不达标处置预案**：任一 AC 未过 → 回退 RD 修复后复跑全量；B2/原子性未过视为阻断项，不得发版。

## 8. 优先级（RICE + 战略筛子）

- **战略筛子**：✅ 过 —— 服务既有核心对象（Task/Project）的正确性与性能，非新花样。
- **MoSCoW**：Must（机制+字段）；Won't now（UI/乐观增量/排序）。
- **RICE**：
    | 项                  | Reach | Impact | Confidence | Effort | RICE       |
    | :------------------ | :---- | :----- | :--------- | :----- | :--------- |
    | 服务端落地+验收     | 高    | 高     | 高         | 中     | 高         |
    | 版本/CHANGELOG/归档 | 中    | 中     | 高         | 低     | 中高       |
    | UI 展示             | 高    | 中     | 中         | 中     | 中（另立） |
- **Kano**：Must-be（列表可读数量）。

## 9. 上线闭环

- **部署顺序（强约束，架构评审修正 2026-09-13）**：先部署新服务端（GORM AutoMigrate 建计数列）→ 再执行 `backfill_counts.sql`（bump `updated_at`）→ 客户端发版。
    - 原因：计数列由服务端启动时 `AutoMigrate` 创建，列不存在时回填 SQL 报 `Unknown column`（ADR §9 顺序需照此执行）。
    - 约束：回填必须早于客户端发版，否则新版客户端读到 0/±1 错值。
    - 生产执行前建议先 `SELECT COUNT(*)` 记录各表影响行数留痕（口径 a–e 不变、无行丢失、B2 bump 保留）。
- **灰度**：个人应用，直接全量；无灰度需求。
- **监控**：观察 sync 增量流量（bump 增加的行数）；计数与实际不符时用回填 SQL 修复（幂等）。
- **回滚**：代码回退即可；计数列可保留（新字段向后兼容），无需数据回滚。

## 10. 变更治理

- 设计变更走 ADR 修订；本单为收尾，不新增设计决策。
- 版本记录：见第 3 节「客户端版本协同」。

## 11. 遗留登记

| 事项                                                                                                                                      | 处置                                                                                                                                                                                                                                   |
| :---------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 计数展示 UI                                                                                                                               | 另立 UI 单                                                                                                                                                                                                                             |
| 本地乐观增量                                                                                                                              | 可选增强                                                                                                                                                                                                                               |
| 按计数排序（Dexie version(5) + 回填）                                                                                                     | 观察项                                                                                                                                                                                                                                 |
| bump `updated_at` 的 sync 流量                                                                                                            | 观察项                                                                                                                                                                                                                                 |
| cron `DeleteDeactivatedProjects` 无任务级联                                                                                               | 若未来项目回收站展示需补重算                                                                                                                                                                                                           |
| 行内墓碑覆盖分支（ADR r3 B12）：若 upsert 覆盖仍写 `deleted_at` 且命中 `created=true`，现有实现会发虚假 `+1`（行仍为已删，口径 e 应出局） | **现状不可达**（桌面端删除走 `deletions` 数组，upsert 路径不带 `deletedAt`）；触发条件 = 未来任客户端经 upsert 携带 `deletedAt` 时不补 `+1`（`createTaskValueObject.DeletedAt.ShouldUpdate() && !IsSetToNull()` 时跳过）并发布删除联动 |

## 12. 派发与验收记录（2026-09-13）

- **会话**：PM 本体；`arch-designer` / `rd-be@nao-todo-server` / `rd-fe@nao-todo` / `qa@nao-todo`（`nao-fleet.sh ensure` 拉起，intercom 验证在线）。
- **开工确认**：用户 2026-09-13 确认开工；模型未指定 → 全部未传 `--model`（走 pi 全局默认，未继承 PM）。
- **T0 架构评审**：初评「有条件放行」→ 修正 PRD §9 部署顺序（先建列→回填→发版）+ 标注 AC8 为同事务 NFR 唯一证据；T0b 二次有界确认放行 sync push 覆盖分支补 E5/E6，ADR 补 r3（E5/E6 触发点增列覆盖分支 + 新增边界 B12）。
- **T1 服务端**：`d934c11`（主体：反规范化列 + 事件总线 + CountUpdater + 9 条写路径同事务发 E1–E7 + 回填 SQL）+ `a777f94`（sync push 覆盖分支补发 E5/E6）。集成 15/15 PASS；`TestCount_Atomicity_RollbackOnCountFailure` 为 AC8 证据；变异验证三处均失败⇒断言有咬合力；顺带修复回填 SQL ERROR 1093（自引用子查询→派生表 LEFT JOIN）。
- **T2 客户端**：`b4a6bb50`（详情面板组装器计数透传单测）+ `b1360952`（v1.5.0 协同 bump + CHANGELOG）。`vp test` 515 例全绿、`vp check --no-fmt` 0 错 0 警。
- **T3 测试**：用例集 `docs/qa/2026-09-13-stat-counts-denormalized-completion-testcases.md`（74 条 = S46/C19/R9）；Q1 裁定纳入 0→B（S14 P1）；3 缺口（AC9 全路径 bump、req 计数直测、详情面板单测）已并入并补齐。
- **PM 独立复核**：服务端 `go build/vet/test` 全绿、提交与工作区状态核实；客户端提交/版本矩阵核实。
- **AC 五覆盖结论**：AC1–AC10（服务端集成）✅；AC11–AC15（客户端单测/回归）✅；覆盖矩阵见 QA 用例集 §5。**代码/测试层未过项：无。**
- **未闭环（待用户上线）**：R04 真实部署顺序、R01–R03 生产回填（测试库已验证）、客户端打 tag/发版。
- **上线闭环（用户 2026-09-13 确认完成）**：服务端 `arch/go-ddd` 已推 origin（含 `d934c11`/`a777f94`）→ 部署建列 → 生产回填 `backfill_counts.sql` → 客户端 tag `v1.5.0` 已推 origin（指向 `b1360952`）。R01–R04 执行完成；生产校验行数/抽样值未归档，如需留证请补录。

### 变更记录

| 日期       | 版本 | 变更                                                                                                   |
| :--------- | :--- | :----------------------------------------------------------------------------------------------------- |
| 2026-09-13 | r1   | 首版收尾单（范围/AC/上线闭环）                                                                         |
| 2026-09-13 | r2   | 架构评审修正 §9 部署顺序；AC8 标注为同事务 NFR 唯一证据                                                |
| 2026-09-13 | r3   | 补 §12 派发与验收记录；T1 追加 sync push E5/E6（ADR r3 B12）已闭环                                     |
| 2026-09-13 | r4   | 同步 §0 证据表至交付终态（架构评审指出与 §12 不一致）；§9 补生产回填行数留痕建议；技术签字转无条件放行 |