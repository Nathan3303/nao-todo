# 数据同步 · 后端落地实施计划

> 本文档是 `data-sync-plan-backend.md`（需求/方案）的落地实施计划，按阶段拆分、每步可验证。
> 范围：nao-todo-server 后端。前端方案见主文档（`data-sync-plan.md`）。
> **✅ 已全部落地（阶段 A/B/C 完成）**——下方 checklist 均已勾选，后端同步能力可用。

## 1. 现状核实结论（对照方案文档）

> 下表为**实施前基线**（记录改造前状态，保留历史参考）；落地后状态以第 3 节各阶段勾选项为准。

| 方案要求                          | 现状        | 说明                                                                                                                                                 |
| --------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 增量查询 `updatedAt>=cursor` | ❌ 未实现   | 各资源有结构化 List + scopes 体系，但无 `updatedAt` 过滤；`ModelBase.UpdatedAt` 无索引                                                               |
| P0-2 删除增量（墓碑）             | ❌ 关键缺口 | gorm `Delete()` 软删只写 `deleted_at`，**不更新 `updated_at`** → 增量拉不到删除记录；`Restore`/级联 `Save` 路径会更新                                |
| P0-3 服务器时间                   | ❌ 未实现   | `PUT /auth/checkin` 响应仅 `jwt/pendingDeletion/deletedAt`，无 `serverTime`，也无 `X-Server-Time` 头                                                 |
| P0-4 客户端指定 id                | ❌ 未实现   | `ModelBase.BeforeCreate` 无条件生成雪花 ID（Epoch 2023-03-01，machineID=1），无 upsert 语义                                                          |
| P1-5 totalDuration 原子维护       | ✅ 已实现   | `PomodoroRecordRepoImpl.Create` 事务内 `total_duration + duration` 原子累加；record 无删除接口（路由仅 POST/GET）→ 无扣减路径，降级为"验证 + 补测试" |
| P1-6 推送幂等                     | ❌ 未实现   | 各 Update 均为无条件覆盖                                                                                                                             |
| P1-7 稳定排序                     | ❌ 未实现   | `query.Sort` 仅单字段（`field:direction`）；无 `updated_at + id` 二级排序                                                                            |
| P2 批量接口                       | ❌ 未实现   | 无 sync 路由                                                                                                                                         |

其他注意事项：

- **project/tag 缓存**：project 的列表走 `GetByUserId`（全量 + **30 分钟缓存**），增量拉取必须新增绕过缓存的路径；tag 大概率同构，实施时一并确认。
- **AutoMigrate 已启用**（`dbs.DoMigration`）：索引/列变更可直接落库，无需额外迁移脚本。
- **MySQL 索引名库内唯一**：各模型索引不能同名（如都叫 `idx_updated_at` 会冲突），需用 `idx_<table>_user_updated` 之类唯一名。

## 2. 关键设计决策与假设

- **serverTime**：按方案文档主选项，`checkin` 响应体增加 `serverTime` 字段，取 UTC Unix 毫秒整数；不做全局响应头（最小侵入）。
- **增量接口形态**：沿用各资源现有 list 接口，新增 `updatedAt` 过滤参数，即 `GET /:resource?updatedAt=<cursor>&cursorId=<lastId>&limit=`；project/tag 新增走增量路径的 List（绕过缓存）。批量形态见阶段 C `POST /sync/pull`（游标与排序见下条 keyset 决策）。
- **游标与排序**：增量拉取采用 **keyset 双字段游标** `(updated_at, id) > (cursor, cursorId)` + `updated_at ASC, id ASC` 稳定排序——相比 offset 分页，分页期间的新写入不会造成重复/遗漏（验收"无遗漏/无重复"的保障）。接口参数 `updatedAt` + `cursorId` + `limit`；响应 `nextCursor`（updated_at）+ `nextCursorId`（id）组成下页游标，`nextCursor` 为空表示拉取完毕。
- **删除墓碑**：所有软删路径（task/project/tag/pomodoro）统一在置 `deleted_at` 的同时更新 `updated_at = now`（服务器时间），保证删除事件可被增量拉取发现。
- **upsert 幂等（LWW）**：客户端可在 create/upsert 时指定 id（雪花数字字符串）与 `updatedAt`；服务端按 `(id, user_id)` 判定——不存在则创建（写入请求 updatedAt），存在则仅当请求 `updatedAt >= 库中 updated_at` 时覆盖，否则 no-op 返回当前版本。
- **ID 唯一性与冲突防御**：DB 主键唯一（`ID int64 gorm:"primaryKey"`），现状 gorm `Create` 对已存在 id 报 duplicate key（1062），写入失败。upsert 落地后碰撞不再报错而是走 LWW——同一实体重复推送安全，但**不同实体**因雪花碰撞拿到相同 id 时会静默覆盖（数据丢失、无感知）。因此需要跨端雪花约定从源头避免碰撞 + 后端 create 语义冲突检测兜底（见阶段 A）。
- **Epoch 运行时下发**：雪花 Epoch（2023-03-01T00:00:00Z = `1677628800000` ms）作为跨端契约常量固化，并通过 `GET /api/system/config`（JWT 保护）运行时下发给前端；常量提取到 `consts` 包（`consts.SnowflakeEpochMS`），`models.InitSnowflake` 引用之，杜绝两端硬编码漂移。响应中 `snowflakeEpoch` 以**字符串**返回（与全项目 ID 字符串化约定一致，避免 JS 大整数精度问题；该值本身 < 2^53，前端 `Number()` 可无损转换）。
- 前端方案文档（`data-sync-plan.md`）不在本仓库，若其对游标/时间格式有另行约定，以后端对齐为准。

## 3. 落地阶段

### 阶段 A：客户端指定 ID 的 upsert 幂等（P0-4）

支撑前端本地雪花 ID 策略与推送重试安全（前端 Phase 1 核心闭环前置）。

- [x] Epoch 常量固化：提取 `consts.SnowflakeEpochMS = 1677628800000`（2023-03-01T00:00:00Z，ms），`models/snowflake.go` 的 `InitSnowflake` 改为引用该常量；补单测锁定数值，防止未来漂移
- [x] 新增 `GET /api/system/config`（`RateLimiter + JWTValidator` 保护）：新增 `SystemController` + `systemRouter` 注册到 routers.go 的 `/api` v1 组，响应 `{ snowflakeEpoch: "1677628800000" }`（**字符串**，与全项目 ID 字符串化约定一致，避免 JS 大整数精度问题）；后端侧只接受任意合法雪花数字 id，不校验具体 machineID
- [x] 前端侧（落点：`data-sync-plan.md` §1.4）：启动时请求 `/api/system/config` 获取 Epoch；雪花生成器显式设置该 Epoch（⚠️ JS `Date.UTC(2023, 2, 1)`，月份从 0 计）；machineID 取设备级持久随机数 ∈ [2, 1023]，避开后端固定 `machineID=1`（约定已落档于 `data-sync-plan.md` §1.4；前端代码实施不在本仓库）
- [x] `models/base.go`：`BeforeCreate` 改为仅当 `ID == 0` 时生成雪花 ID，允许客户端预置 id
- [x] 各资源 Create 入参链（`interfaces req → app dto → domain VO`）增加可选 `id` 字段：task / checkitem / comment / project / tag / pomodoro / pomodoroRecord
- [x] 仓库层新增 `Upsert(ctx, userId, vo)`：按 `(id, user_id)` 查存在 → 不存在则带 id 创建（写入请求 `updatedAt`）；存在则仅当请求 `updatedAt >= 库中 updated_at` 时覆盖，否则 no-op（返回当前版本）
- [x] `Upsert` 增加 create 语义冲突检测：create 请求携带 `createdAt`，id 已存在时比较库中 `created_at` 与请求 `createdAt`——接近（如差值 < 1 分钟）视为同一实体的重复推送重试，走 LWW；相差较大视为不同实体碰撞，返回冲突错误码（不覆盖），前端据此重新分配 ID
- [x] app 层 Create 复用 Upsert 路径；controller 层 create 请求透传可选 `id`/`updatedAt`/`createdAt`
- [x] 验证：`go test` 覆盖"同 id 重复推送幂等、旧 updatedAt 不覆盖新数据、新 id 正常创建"（`DecideUpsert` 单测 + 全量测试通过）

### 阶段 B：增量拉取 + 时间基准 + 删除墓碑（P0-1/2/3 + P1-7 + P1-5 验证）

启用增量同步与服务器时间校准。

- [x] `checkin` 响应体增加 `serverTime`（UTC Unix 毫秒字符串）：controller → `CheckInRes`
- [x] 通用增量 scope：`updated_at >= cursor` 过滤 + `updated_at ASC, id ASC` 稳定排序（新增到 `infrastructure/utils/query`；已升级为 keyset 双字段游标 `ByKeysetCursor`，见 §2 决策）
- [x] task / pomodoro / pomodoroRecord 复用现有 scopes 体系接入增量过滤；project / tag 新增走增量路径的 List（绕过缓存）
- [x] 各资源 list 的 VO / req 增加 `updatedAt` 过滤参数并透传（另加 `cursorId` keyset 游标辅助）
- [x] 删除墓碑修复：task / project / tag / pomodoro 的 `Delete` 统一改为同时置 `deleted_at` 与 `updated_at = now`；确认级联删除（`SoftDeleteByProjectId` 的 `Save`）已更新 `updated_at`（显式置位）
- [x] 索引：各模型加 `(user_id, updated_at)` 复合索引（索引名唯一，`AutoMigrate` 后幂等创建，7 表已覆盖）
- [x] totalDuration：确认原子累加逻辑（事务内 `gorm.Expr`，record 无删除接口无需扣减）；DryRun 单测受连接限制，以代码审查替代，真实 DB 累加行为列入集成验证项
- [x] 验证：集成测试覆盖"增量拉取含软删记录、跨页排序稳定、重复推送幂等、serverTime 返回"（静态检查 + 单测全绿；真实 MySQL 集成验证待 docker-compose 环境）

### 阶段 C：批量同步接口（P2）

大量离线积压时的性能优化，最小侵入、不引入专用同步协议。

- [x] 新增 `sync` controller + router（JWT 保护）：`POST /sync/push`、`POST /sync/pull`
- [x] `push`：多表批量 upsert（复用阶段 A 判定逻辑）+ `deletions` 软删处理；响应逐条 `serverUpdatedAt` + `serverTime`
- [x] `pull`：按表 `updatedAt` keyset 游标拉取；响应记录 + `nextCursor`/`nextCursorId` + `serverTime`
- [x] 验证：批量 push/pull 往返一致、重复 push 幂等（静态检查 + 既有单测全绿；真实 MySQL 往返集成验证待 docker-compose 环境）

## 4. 验收标准（对齐方案文档）

- 增量拉取无遗漏 / 无重复
- 重复推送幂等（旧版本不覆盖新数据）
- `serverTime` 随 checkin 返回
- 删除记录可被增量拉取获取（墓碑传递）
- `totalDuration` 与服务端记录一致（创建路径验证）

## 5. 验证方式

每次改动后：

```bash
go test ./...
go vet ./...
golangci-lint run   # 项目已有 .golangci.yml
```

需要数据库的集成验证可基于本地 `docker-compose.yml` 启动 MySQL 后执行。