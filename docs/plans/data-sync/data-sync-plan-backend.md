# 数据同步方案 · 后端配合点

> 本文档为桌面端数据同步的后端配套说明，与 `data-sync-plan.md`（前端方案）配套。
> 后端读者聚焦"要做什么、为什么、接口形态"；前端实现细节见主文档。

## 1. 背景

桌面端（NaoTodo Desktop）将业务数据存于本地 IndexedDB（AES-GCM 加密），Web 端直连后端 API。两端共用一个 domain 模型，但**本地与远程互不迁移、无同步机制**。目标是在桌面端"离线可用"前提下与后端保持双向一致（双向同步、冲突按 LWW 解决、离线编辑恢复后补齐）。

同步需要后端配合以下能力，才能完成**增量拉取、时间基准校准、双端 id 对应、删除墓碑传递**。

### 1.1 关键约定

- **双向同步 + LWW（最后写入者优先）**：冲突以 `updatedAt` 较大者为胜，相等时远程胜（幂等）。
- **雪花 ID**：桌面端本地新建实体将改为生成与后端同格式的雪花 ID（数字字符串），双端 id 天然一致。
- **软删除墓碑**：本地与远程删除均为软删（置 `deletedAt`），同步依赖 `deletedAt` 记录完成删除传递。
- **服务器时间为唯一时间基准**：本地用 `serverTimeOffset` 校准写入的 `updatedAt`。

## 2. 后端功能要求

> 现状 `list(queryString)` 透传查询字符串、其余为标准 CRUD。以下按优先级排列；若增量能力暂不可用，前端可降级为分页全量拉取（数据量小时可接受）。

### 2.1 P0 — 必需（不做同步无法跑通）

1. **增量查询**：各资源 list 接口支持 `updatedAt>=<cursor>` 过滤并按 `updatedAt` 建索引。

    ```text
    GET /:resource?updatedAt>=<cursor>&limit=&page=
    ```

2. **删除增量**：增量查询**必须包含软删记录**——`deletedAt` 已置位但 `updatedAt` 更新的记录照常返回（前端依赖 `deletedAt` 墓碑完成删除同步）。

3. **服务器时间**：`PUT /auth/checkin` 响应体增加 `serverTime` 字段（或全部响应头 `X-Server-Time`）——前端 `serverTimeOffset` 校准的唯一来源。

4. **客户端 id 支持（upsert 幂等）**：create/upsert 接口**接受客户端指定 id**（雪花数字字符串）——id 不存在则创建，id 存在则按 `updatedAt` 幂等覆盖（更旧请求不覆盖更新数据）。这是本地雪花 ID 策略与推送重试安全（P1-2）的前提。

5. **Epoch 接口**：`GET /api/system/config`（JWT 认证）返回 `{ snowflakeEpoch: string }`——客户端以该值初始化本地雪花 ID 生成器（时间戳段 = 实际时间 − epoch），保证双端 id 语义一致。雪花 ID 对齐的前置（前端时序见 `data-sync-plan.md` §1.4）。

### 2.2 P1 — 强烈推荐（一致性/健壮性）

6. **`totalDuration` 原子维护**：pomodoro 记录创建/删除后后端**原子更新**对应 `pomodoro.totalDuration`。现状未验证后端是否已有该逻辑——实施前需确认，否则双端累计时长数据源均不完整。

7. **推送幂等**：单条 PUT/POST/DELETE 以实体 `updatedAt` 为准幂等（重复推送同版本不产生副作用）——同步重试安全的前提。

8. **稳定分页排序**：增量拉取按 `updatedAt` 升序 + **`id` 二级排序**（同 `updatedAt` 时顺序确定）——前端游标"只前进不后退"依赖稳定排序，防翻页乱序。

### 2.3 P2 — 可选优化（批量接口）

> 增量拉取逐条/逐页即可跑通，批量仅为性能优化（大量离线积压时减少请求数），建议最小侵入、不引入专用同步协议。

**批量 upsert** `POST /sync/push`：

```json
{
    "tasks": [/* CreateTaskReq / UpdateTaskReq + id */],
    "projects": [/* ... */],
    "tags": [/* ... */],
    "pomodoros": [/* ... */],
    "deletions": [{ "table": "tasks", "id": "..." }]
}
```

响应 `{ results: [{ table, id, serverUpdatedAt }], serverTime }`——每条的服务端 `updatedAt`（前端推进游标、覆盖冲突判定），`serverTime` 顺带校准时钟。

**批量增量拉取** `POST /sync/pull`（与 push 对称）：

```json
{ "tasks": { "updatedAt": "<cursor>", "page": 1, "limit": 100 }, "projects": {/* ... */} }
```

响应按表返回记录 + `nextCursor` + `serverTime`。

## 3. 与前端方案的对应关系

| 后端能力          | 前端依赖（见 `data-sync-plan.md`）          |
| ----------------- | ------------------------------------------- |
| 客户端 id 支持    | §1.4 本地雪花 ID 策略（阻断项前置）         |
| Epoch 接口        | §1.4 Epoch 对齐（登录后初始化雪花生成器）   |
| 增量查询/删除增量 | §4.1 增量拉取、§4.4 删除墓碑同步            |
| 服务器时间        | §5 LWW 时钟约定（serverTimeOffset）         |
| totalDuration     | §5 子实体一致性（拉取后重算或信任远程字段） |

## 4. 后端实施路线

- **阶段 A（P0-4 客户端 id）**：先行落地，支撑前端 Phase 1 核心闭环（全量拉取降级 + 本地时钟近似 LWW）。
- **阶段 B（P0 其余 + P1）**：增量查询、删除增量、服务器时间、totalDuration 原子维护、推送幂等、稳定排序——启用增量同步与时间校准。
- **阶段 C（P2 批量）**：批量 push/pull 接口，优化大量积压场景。
- **验收**：增量拉取无遗漏/无重复；重复推送幂等；`serverTime` 随 checkin 返回；删除记录可增量获取；`totalDuration` 与服务端记录一致。