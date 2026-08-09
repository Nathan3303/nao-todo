# 数据同步方案（桌面端本地 ⇄ 后端 API）

> 桌面端本地加密数据层（`persistence-local`）与后端 API（`persistence-go`）的双向同步方案。
> 已确认决策：**双向同步**、**最后写入者优先（LWW）**、**启动时 + 变更后节流 + 手动刷新**。

## 1. 现状与目标

### 1.1 现状

- 桌面端业务数据存于本地 IndexedDB（`nao-todo-desktop`，AES-GCM 加密：敏感字段密文、结构字段明文保索引），由 `persistence-local` 提供仓储实现。
- Web 端业务数据直连后端 API（`persistence-go`），无业务缓存。
- 两端共用同一套 domain `Repository` 接口（`packages/*/src/domain/repositories/`），本地与远程实现可互换。
- 当前本地与远程**互不迁移，无同步机制**（两套独立存储）。

### 1.2 目标

在桌面端"离线可用"前提下与后端保持双向一致：

- 本地变更推送到远程；远程变更拉取到本地；
- 两端均可编辑，冲突按 LWW 解决；
- 离线编辑不阻塞，恢复在线后自动补齐。

### 1.3 同步范围

| 参与同步（11 张业务表） | 不参与同步（本地设备状态）              |
| ----------------------- | --------------------------------------- |
| `projects`              | `meta`（密钥包 `${userId}:key-bundle`） |
| `projectPreferences`    | `deletionSchedules`（注销反悔期调度）   |
| `tags`                  |                                         |
| `tagPreferences`        |                                         |
| `tasks`                 |                                         |
| `taskCheckItems`        |                                         |
| `taskComments`          |                                         |
| `pomodoros`             |                                         |
| `pomodoroRecords`       |                                         |
| `users`                 |                                         |
| `userConfigs`           |                                         |

> `users`/`userConfigs` 桌面端当前不产生本地数据（用户域已切远程 API），参与同步为空转；保留无副作用（未来可作本地缓存）。
>
> `projectPreferences`/`tagPreferences` 无独立游标与批量接口：随父实体 `projects`/`tags`（后端 `Preload("Preference")`）一并拉取/推送，不入 `syncQueue` 单独成表。

### 1.4 前置条件：ID 策略

**问题**：本地创建实体用 `crypto.randomUUID()`（UUID v4，共 8 处：project/tag/task/taskCheckItem/taskComment/pomodoro/pomodoroRecord/copy），后端为**雪花 ID**（超 `Number.MAX_SAFE_INTEGER` 的数字，按字符串处理）。id 格式不一致会导致：推送 create 返回新雪花 id 使双端 id 不同；更新/删除推送按本地 UUID 找不到远程记录；增量拉取将本地 UUID 记录视为新实体**重复拉取**。

**方案：本地雪花 ID + 后端接受客户端 id**

1. 新增**雪花 ID 生成器**（`persistence-sync` 或 `shared`）：时间戳 41bit + 机器/随机 10bit + 序列 12bit，产出与后端同格式的数字字符串；替换本地 8 处 `crypto.randomUUID()`。
2. **Epoch 对齐**：雪花时间戳段 = 实际时间 − epoch，双端须用同一 epoch 保证 id 语义一致。后端开放 `GET /api/system/config`（需 JWT）返回 `snowflakeEpoch`（字符串，见 `data-sync-plan-backend.md` §2.1-5）。认证流程（signIn/signUp/checkIn）**不创建业务实体、不涉及雪花 ID**，因此顺序为：登录（JWT 到手）→ 拉取 `snowflakeEpoch` 初始化本地生成器 → 解锁本地与同步（无循环依赖）。epoch 为全局常量：缓存到 localStorage，离线启动用缓存兜底、登录时刷新；未初始化前不生成业务 id。
   **缓存访问点**：desktop 当前无直接 `localStorage` 访问（经 user-store/session 间接），epoch 缓存随 `SyncConfig` 新增访问点（读写 `snowflakeEpoch` key）。
   **机器位约定**：本地生成器机器位取**设备级持久随机数 ∈ [2, 1023]**，避开后端固定 `machineID=1`，避免同毫秒同机器位跨端碰撞。
3. 后端 create/upsert **接受客户端指定 id**，id 存在则按 `updatedAt` 幂等覆盖（后端要求见 `data-sync-plan-backend.md` §2.1-4）。后端对 create 语义有**碰撞检测**（请求 `createdAt` 与库中 `created_at` 相差 > 1 分钟 → 返回冲突错误 `ErrIDConflict`）：推送收到该错误时，前端应**重新分配新 ID** 重试，不得覆盖已有实体。
4. 收益：双端 id 天然一致，零 id 映射、外键（parentTaskId/projectId/tags/taskId）零重写。

**存量 UUID 数据迁移**：

- 优先：**以远程为准重建**——清空本地业务表后全量拉取（数据量小时成本低）；
- 备选：本地库 v5 迁移重写全部记录 id 与外键引用（工程量大，仅需保留本地优先数据时选用）。

> 不采用同步层 id 映射表：推送后写回远程 id 并重写外键，易漏且增量去重复杂。

## 2. 总体架构

```
┌──────────────────────── 桌面端 ────────────────────────┐
│  UI/useCase 层（现状不动，仍调本地仓储）                    │
│        │ 写路径                                          │
│  ┌─────▼──────┐   登记脏   ┌────────────┐              │
│  │ 本地仓储层  │───────────▶│ SyncTracker │              │
│  │(persistence│  写后标记   │ (sync_queue │              │
│  │  -local)   │            │  +cursor)   │              │
│  └─────┬──────┘            └─────┬──────┘              │
│        │ 读路径（不加同步逻辑）     │ 触发/查询             │
│  ┌─────▼──────┐            ┌─────▼──────┐              │
│  │ 本地 IndexedDB│          │ SyncService │              │
│  └────────────┘            └─────┬──────┘              │
│                                   │ 推/拉                │
└───────────────────────────────────┼─────────────────────┘
                                    │ HTTPS（JWT 鉴权）
                        ┌───────────▼───────────┐
                        │  后端 API（需小扩展）    │
                        └───────────────────────┘
```

新增模块（`packages/infrastructure/src/persistence-sync/`）：

| 模块                | 职责                                             | 依赖                                   |
| ------------------- | ------------------------------------------------ | -------------------------------------- |
| `SyncTracker`       | 登记脏实体、维护拉取游标；纯本地，不依赖网络     | `persistence-local`                    |
| `SyncService`       | 编排推/拉/冲突/重试/时机；唯一与网络打交道的模块 | `persistence-local` + `persistence-go` |
| `SyncConfig/Events` | 节流配置、同步状态（供 UI 订阅）                 | 无                                     |

## 3. 本地侧扩展

关键取舍：**不在业务表上逐个增加 `isDirty/lastSyncedAt` 列**（需改 11 个 record 类型 + 转换器 + 迁移），改用两张独立元数据表，将脏追踪从业务读路径剥离，仓储代码改动最小。

新增两张表（数据库迁移 v4）：

### 3.1 `syncQueue`（脏实体队列）

```text
{
  id:              `${userId}:${table}:${entityId}`,  // 主键，天然去重
  userId,          // 多用户隔离
  table,           // 表名（如 'tasks'）
  entityId,
  action,          // 'upsert' | 'delete'
  localUpdatedAt,  // 本地实体 updatedAt（删除时为 deletedAt）
  retryCount,      // 推送失败重试计数
  createdAt, updatedAt
}
```

索引：`&id, userId, table, retryCount`。

### 3.2 `syncCursor`（拉取游标，每表一个）

```text
{
  id:        `${userId}:${table}`,
  userId, table,
  lastPullAt,   // 上次成功增量拉取的远程 updatedAt 游标
  lastPullId,   // keyset 游标辅助：与 lastPullAt 组成 (updated_at, id) > (lastPullAt, lastPullId)
  lastPushAt,   // 上次推送推进点（推/拉独立游标，避免互相卡死）
  updatedAt
}
```

索引：`&id, userId`。

### 3.3 写路径埋点

本地仓储 `create/update/remove/restore` 成功后调用 `SyncTracker.markDirty(table, entityId, action, updatedAt)`；约 11 个 repo-impl 的写方法尾部可用小包装（装饰器或基类方法）批量接入。**读路径不增加任何同步逻辑。**

## 4. 同步数据流

### 4.1 启动同步（解锁后 `SyncService.start()`，先拉后推）

先拉后推——以远程为基准接收变更，再推送本地积压，减少冲突。

```text
1. 增量拉取（每表）：
   list(`updatedAt=${cursor.lastPullAt}&cursorId=${cursor.lastPullId}&limit=`) → {记录, nextCursor, nextCursorId}
   对每条：
     if 本地该实体不在 syncQueue → 直接写入（远程胜）
     else → 进入冲突判定（见 §5）
   拉完推进 cursor.lastPullAt = nextCursor, cursor.lastPullId = nextCursorId（nextCursor 为空即拉完）
   后端增量接口为 **keyset 双字段游标** `(updated_at, id) > (cursor, cursorId)` + `updated_at ASC, id ASC` 稳定排序：
   相比 offset 分页，分页期间的新写入不会造成重复/遗漏；单资源接口为
   `GET /:resource?updatedAt=&cursorId=&limit=`，批量接口为 `POST /sync/pull`（响应含 `nextCursor`/`nextCursorId`/`serverTime`）。

2. 推送脏队列（syncQueue 中未失败项）：
   对每条：
     if 本地 updatedAt > 远程实体 updatedAt → PUT/POST/DELETE 推送
     else → 本地被远程覆盖：从 queue 移除，重新拉取该实体
   成功 → 从 syncQueue 删除；失败 → retryCount++，保留（走 §6 重试）
```

**拉取写入路径**：远程拉回的明文记录**必须复用 converters**（`xxxEntityToRecord` 用当前用户 DEK 加密）后落库，**不经过本地仓储写方法、不触发 `markDirty`**（否则拉取重新入队造成同步回环）。SyncService 直连表 + converters，与业务写路径完全隔离。**converters 引用路径**：`persistence-local/index.ts` 当前未导出 converters，SyncService 需按文件路径直接 import（`../persistence-local/converters/xxx`）或实现时补导出。

### 4.2 变更后节流推送

- 本地仓储写 → `markDirty` → 2s debounce（同一实体重复写合并为一条，取最新 `updatedAt`）。
- 推送失败不阻塞 UI，静默进重试队列；复用 `operation-log` 的 `replayFailedOperations()`（`packages/shared/requester/index.ts:44`）。

### 4.3 手动刷新

完整执行一次"拉取全部 + 推送全部"，结果经 `SyncStatus`（上次同步时间、待推送数、失败数）暴露给 UI。

### 4.4 删除同步（软删除墓碑）

本地与远程删除均为**软删**（置 `deletedAt`），天然是墓碑，无需额外机制：

- 本地删 → `action='delete'` 入队 → 推送远程 `remove`/`DELETE` → 远程置 `deletedAt`；
- 远程删 → 增量拉取到 `deletedAt` 记录 → 本地置 `deletedAt`（UI 过滤掉）；
- 物理清理仅在注销反悔期到期（`deletionService.checkAndCleanExpired`），与同步无冲突。

**特例（projects）**：后端 `projects` 的用户删除置 `deactivedAt`（停用）而非 `deletedAt`（`deleted_at` 仅注销清理时置位，见 `data-sync-plan-backend-implementation.md` 阶段 B）。增量拉取到 `deactivedAt` 非空的项目应视为已删除（UI 过滤、不覆盖本地活跃版本之外）；推送本地 project 删除走 DELETE 即可（后端 `UpdateState` 自动推进 `updated_at`，删除事件增量可见）。

## 5. 冲突解决（LWW）

两端 `updatedAt` 须基于**同一时间基准**才有可比性：

- **时钟约定**：以**服务器时间为唯一基准**。推送/拉取响应头或 `checkIn` 返回服务器时间，本地用 `serverTimeOffset` 校准写入的 `updatedAt`；离线期间用本地时钟 + 启动时校准的 offset。离线过久（如 24h）offset 漂移会致 LWW 误判——可接受（LWW 为近似方案），离线超阈值后触发一次完整拉取校准，UI 注明"最终一致（近似）"。
- **判定规则**：
    - 远程 `updatedAt` > 本地 → 远程胜：覆盖本地（删除 queue 项）；
    - 本地 `updatedAt` > 远程 → 本地胜：推送覆盖远程；
    - 相等 → 远程胜（保持幂等）。
- **子实体一致性**：
    - **totalDuration**：本地 `totalDuration` 由 `LocalPomodoroRecordRepoImpl.create` 事务内累加，同步拉取的 `pomodoroRecords` 不经过 create、不会触发累加 → 拉取后需重算该 `pomodoroId` 的累计值（sum 未删记录）或信任远程字段覆盖。**已确认（后端）**：`PomodoroRecordRepoImpl.Create` 事务内原子累加 `total_duration`，且 record 无删除接口、无需扣减（见 `data-sync-plan-backend-implementation.md` 阶段 B）——前端 Phase 1 拉取后重算、Phase 2 信任远程字段两种策略均可行。
    - **级联删除**：本地 `task remove` 仅置单条 `deletedAt`（已核实 `task-repo-impl.ts`），不级联子任务/检查项/评论。任务删除需将关联子实体一并 `delete` 入队（或先补本地仓储级联删除），否则远程残留孤儿子实体。

## 6. 可靠性与边界

| 场景          | 处理                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 离线推送失败  | 保留 `syncQueue`，`operation-log` 幂等重放；`enableRetry` 已处理超时/429                                                                                          |
| 增量拉取断页  | 现有 `pagination` 逐页拉全，页间失败整体重试                                                                                                                      |
| 游标倒退/乱序 | 拉取按 `updatedAt` 升序，游标只前进不后退；本地时间戳乱序以服务器时间覆盖                                                                                         |
| 多用户切换    | 全部按 `userId` 隔离，`syncQueue/syncCursor` 主键含 userId；切换用户不交叉                                                                                        |
| 注销反悔期    | 注销后本地暂停同步；恢复后以远程为准重新拉取。接入点：`SyncService.start` 先查 `deletionSchedules` 中当前 userId 是否有调度记录，存在则跳过启动（反悔期内不同步） |
| 加密内容      | 同步仅用明文结构字段（id/时间戳/状态/外键）做游标与判定；内容字段推送时解密后经 HTTPS 传输，与现有远程数据流一致                                                  |
| 附件/文件     | `attachments` 为数组字段，先按普通字段同步；大文件后续单独方案                                                                                                    |

## 7. 后端配合点

> 后端所需的增量查询、删除增量、服务器时间、客户端 id 支持、totalDuration 原子维护、批量接口等要求已迁移至 **`docs/plans/data-sync-plan-backend.md`**（含背景、P0/P1/P2 功能描述与实施路线）。
> 若增量能力暂不可用，前端可降级为分页全量拉取（数据量小可接受）。

**后端落地状态**：**已全部落地**（阶段 A/B/C 完成，见 `data-sync-plan-backend-implementation.md`）——客户端 id upsert（LWW + 碰撞检测）、增量查询（keyset 游标 + 稳定排序 + 复合索引）、删除墓碑（含 project `deactivedAt` 特例）、`serverTime`、`totalDuration` 原子维护、Update 写路径 LWW 幂等、批量 `POST /sync/push`/`/sync/pull` 均已就绪。前端 Phase 1 直接用增量接口，全量分页降级保留为兜底。注意：**`taskCheckItems`/`taskComments` 无独立增量接口**，前端经 task 关联接口全量拉取（数据量小，可接受）。

## 8. 实施路线

- **Phase 1 前置：ID 策略（§1.4 阻断项）**
    - 新增雪花 ID 生成器，替换本地 8 处 `crypto.randomUUID()`；
    - 存量 UUID 数据迁移：优先以远程为准重建（清本地业务表后全量拉取），数据多需保留本地时选用 v5 迁移重写。
    - 验收：本地新建实体 id 为雪花数字字符串，双端 id 可直接对应。

- **Phase 1 核心闭环**
    - `syncQueue/syncCursor`（v4 迁移）+ `SyncTracker` + `SyncService` 拉取/推送 + LWW + 启动/节流/手动触发；
    - **级联删除**：任务删除连带子任务/检查项/评论 `delete` 入队（§5）；
    - **totalDuration**：拉取 `pomodoroRecords` 后重算对应 `pomodoro.totalDuration`（§5）；
    - 降级说明：后端能力已全部落地（见 `data-sync-plan-backend-implementation.md`），Phase 1 **直接用增量接口与服务器时间校准**；全量分页保留为兜底（数据量小或增量异常时）。
    - 验收：桌面端与 Web 端**增/删/改**双向可见；离线编辑上线后合并。

- **Phase 2 健壮性**
    - 直接启用：增量同步（`updatedAt>=` + 删除增量）、服务器时间校准（`serverTime` → `serverTimeOffset`）、批量推送/拉取（`POST /sync/push`/`/sync/pull`，后端已落地）；
    - totalDuration 策略：**信任远程字段为主**、本地拉取后重算为兜底；
    - 前端适配：LWW 以服务器时间为基准、失败重试与幂等闭环。
    - 验收：增量同步、游标推进稳定、重试不产生重复数据。

- **Phase 3 可观测**
    - 同步状态 UI、冲突计数、手动重试入口。

> **Web 端不接入同步**（保持远程直连），同步是桌面端离线能力；`persistence-go` 与 `persistence-local` 共用同一套 domain `Repository` 接口，同步层直接复用两者，无需新接口定义。