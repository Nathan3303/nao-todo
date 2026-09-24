# 2026-09-24 阶段二：两端同构 local-first（业务数据面）架构评审 —— 结论：**有条件可行**

- **日期**：2026-09-24
- **状态**：⏳ **有条件可行**（**DP-1…DP-4 已拍板**；**r3（2026-09-24，T161）：2B 定向设计已落 §9**（OCC 契约 / 冲突 UX / 多标签 push / 偏好收口 / 迁移优化裁定；**DP-2B-1…5 已于 2026-09-24 全部裁定（§9.10 / r4）**）｜⛔ **纯设计，未改任何代码**（含服务端）
- **任务**：`T142`（阶段二架构评审，6 项：冲突策略 / 回传机制 / 迁移 / C-59 撤销 / 回归矩阵 / 分期）
- **评审对象**：PRD `docs/prds/2026-09-23-stage2-local-first-both-ends.md`（用户 2026-09-24 批准立项，路线 A，分期 2A/2B）
- **依据**：C-59 ADR（r9 已把 web 业务只读定性为**过渡态**）· TASK-26 ADR（偏好面机制**已验证**）· 探针报告 `docs/reports/2026-09-23-DEF-PROBE-P1-offline-probes.md` §3.3（**25 写入口唯一真源**）
- **关联仓库**：`/home/nathan/Project/nao-todo`（客户端）、`/home/nathan/Project/nao-todo-server`（服务端，Q4′ 已授权跨仓只读）
- **影响面工具**：`codegraph` + 行号级读码（本 ADR 全部结论附 `文件:行`）
- **硬约束**：⭐ **不丢失功能**（阶段一功能零回归）+ **移动端 0 改动**

---

## 0. 结论摘要（先看这里）

| #      | 问题                  | 结论                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :----- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **冲突解决策略**      | **沿用 LWW（服务端权威、per-row）**，**不引入版本向量 / 字段级合并**（过度设计）。⚠️ **关键更正：per-row LWW 服务端已实现**（`DecideUpsert`），**无需新增版本标记**；真正缺口 = ① **时间基准**（客户端 `updatedAt` 未按服务端校准，`SERVER_TIME_OFFSET_KEY` 只写不读 ⇒ 死代码）② **覆盖不可观测**（静默丢败方）。⇒ **2A = 校准时间基准 + 冲突记账（含败方快照）**；**2B = 升级为服务端签发 per-row 版本 + 客户端回传 base 版本（OCC）**，彻底去掉客户端时钟依赖。**`T141`（偏好面 per-row LWW）不是阶段二业务数据面的前置**（业务面已有 per-row 机制）。 |
| **Q2** | **回传机制**          | **复用业务 `syncQueue`**（不新建业务队列）。web 写路径切本地仓储后**自动** `markDirty` ⇒ 零新管线。**`markDirty` / `pendingCount` 新语义**：web 业务 `markDirty` **不再恒 0**，改为「**有未确认本地写 ⇒ 非 0**」，`pendingCount = countDirty`（按实体去重），**成功同步后回 0**。**偏好面继续走独立偏好队列**（合成主键不兼容批量 upsert，PS-1/PS-10 不变）。                                                                                                                                                                                            |
| **Q3** | **迁移方案**          | **无数据迁移**（web 本地库与 desktop 同表同仓储，**不改 Dexie version、不加索引**）。切换 = **binding 换本地仓储 + 撤闸门 + 补 dirty 监听**。存量只读镜像**天然合法**（无 `syncQueue` 项 = 远端权威，下次 pull 覆盖）。**desktop 零改动**。**回滚路径**：回退 binding + 重挂闸门；回滚前 best-effort `pushAll()` 冲刷，未冲刷项保留在 `syncQueue`（未来 local-first 版本可续推）。                                                                                                                                                                       |
| **Q4** | **C-59 撤销路径**     | **分步退役**：① binding 换本地（业务）② 补 `syncTracker.setDirtyListener`（web 当前**缺失**）③ 撤 `decorateUseCase` 写闸门 ④ **写闸门作用面收敛至身份域**（业务 7 域条目退役；**`withReadOnlyGuard` / `OFFLINE_READONLY` / `write-methods`（身份域条目）/ `isReadOnly` 保留** —— 服务身份域 + 离线 UI 角标 / `offlineEntry` flag 生命周期）⑤ `markDirty` 语义切换 + 文档/测试口径同步。**顺序不可颠倒**（先换写路径再撤闸门，否则出现无闸门的远端直连写窗口）。                                                                                          |
| **Q5** | **回归矩阵**          | **6 大项逐项给出「如何不回归 + 验证方式 + 守护测试 + Owner」**（见 §2.5）。核心控制 = **阶段一功能不依赖业务写路径语义**（只依赖：镜像表 / 迁移器 / 清库 / 明文接缝 / 状态面 / 偏好队列），而本单**只改业务写路径接线** ⇒ 回归面天然隔离；再加**绑定级断言**（web 仓储类型 + 闸门存在性）。                                                                                                                                                                                                                                                              |
| **Q6** | **分期建议（2A/2B）** | **2A**：web 业务写路径切本地（**按域推进**：任务 → 子实体 → 容器 → 番茄）+ 队列复用 + dirty 监听 + 时间校准 + 冲突记账 + 撤闸门 + web 首拉门；**零/极小服务端改动**（仅 `SyncResult` 增 `Outcome`，additive）。**2B**：OCC per-row 版本（去时钟依赖）+ 冲突解决 UX（journal 恢复）+ 多标签 push 协调硬化 + 偏好面 `T141`/`DP-5` 收口 + 迁移优化。                                                                                                                                                                                                        |

**一句话**：阶段二**不是新建同步引擎**，而是把 **web 的接线从「远端直连 + 只读镜像」翻转为「本地仓储 + `syncQueue` 回传」**——与 desktop **同一份** `hooks/usecases/**` + 同一 `syncService`；冲突策略**沿用已实现的 LWW**，补齐**时间基准**与**可观测**两个缺口；**不丢功能**由「只改写路径接线」这一外科边界保证。

---

## 1. 事实基线（读码证据）

### 1.1 既有业务同步引擎（desktop 已在跑，**可直接复用**）

| 环节                   | 事实                                                                                                    | 证据                                                                                                                          |
| :--------------------- | :------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| 本地写 → 入队          | 本地仓储写成功后 `syncTracker.markDirty(table,id,action,updatedAt)`；同实体**去重合并**                 | `packages/infrastructure/src/persistence-local/repos/task-repo-impl.ts:122,153,168`；`persistence-sync/sync-tracker.ts:34-60` |
| 队列主键               | `${userId}:${table}:${entityId}`（天然去重）                                                            | `persistence-sync/sync-tracker.ts:47`；`persistence-local/db/local-database.ts:243`                                           |
| 推送                   | 2s 防抖 → `pushAllInner()` → `POST /sync/push`（批量 upsert + `deletions`），幂等                       | `persistence-sync/sync-service.ts:1008-1015,823-980`                                                                          |
| 拉取                   | keyset 游标 + 续拉至无更多（`PULL_LIMIT=200` / ≤10 轮 / 5000ms），`applyPullBatch` 直写表不 `markDirty` | `sync-service.ts:254,265,272,522,560,728-796`                                                                                 |
| 重试生命周期           | 网络类=暂停不计数 / 业务类=指数退避 / 凭证类=会话失效；触发=启动·`online`·前台恢复·条件定时             | `sync-service.ts:1048-1136`；`persistence-sync/sync-retry.ts`；`backfill-triggers.ts`                                         |
| 单运行边界             | `beginRun → … → endRun`；`pendingCount = countDirty`；`pullExecuted` 运行时字段                         | `persistence-sync/sync-status.ts:44-118,190-235`；`sync-service.ts:501-510`                                                   |
| 冲突判定（客户端）     | 有 `syncQueue` 项时比较 `remoteTs` vs `queued.localUpdatedAt`：远端更新 ⇒ 远端胜并**移除队列**          | `sync-service.ts:742-757`                                                                                                     |
| 时间校准（**死代码**） | `calibrateServerTime()` **写入** `SERVER_TIME_OFFSET_KEY`；`getServerTimeOffset()` **全仓无调用点**     | `sync-service.ts:431-436`；`sync-config.ts:52-64`（`grep` 仅 `set`，无 `get`）                                                |

### 1.2 服务端冲突语义（**per-row LWW 已实现，这是本篇最重要的更正**）

| 环节             | 事实                                                                                                                                   | 证据                                                                                                                  |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| push 幂等 upsert | 客户端预置 id ⇒ 记录存在时走 `DecideUpsert`；**请求 `updatedAt` 严格早于库中 `updated_at` ⇒ Noop（不写、返回库中当前版本）**；否则覆盖 | `nao-todo-server/infrastructure/persistence/task/repoImpl.go:93-152`（判定 `:119`，Noop `:127-129`，覆盖 `:130-134`） |
| 判定纯逻辑       | `DecideUpsert(existingCreated, existingUpdated, voCreated, voUpdated, conflictWindow)`                                                 | `nao-todo-server/domain/types/upsert.go:25-38`                                                                        |
| 覆盖写时间       | 覆盖时 `updateMap["updated_at"] = time.Now()`（**服务端时间为唯一基准**；LWW 判定用客户端时间）                                        | `repoImpl.go:132-134`                                                                                                 |
| push 返回        | 每项返回 `{Table, Id, ServerUpdatedAt}`（**无 outcome 字段** ⇒ 客户端无法区分 no-op / 覆盖）                                           | `nao-todo-server/interfaces/controllers/sync.go:69-140`                                                               |
| pull 排序/游标   | `updated_at ASC, id ASC` + keyset `(updated_at,id) > (cursor,cursorId)`；含软删墓碑（`.Unscoped()`）                                   | `nao-todo-server/infrastructure/utils/query/sync.go:11,26`                                                            |
| 同型 upsert      | `UpsertCheckItem` / `UpsertComment` / tag / pomodoro / pomodoroRecord 均同 `DecideUpsert` 语义                                         | `repoImpl.go:522,790`；`tag/repoImpl.go:109`；`pomodoro/*:66,80`                                                      |

**⇒ 结论：业务数据面「per-row 版本 + 服务端权威 LWW」**已是既成事实**，**阶段二**不需要**新造版本标记（PM 信封「关联 T141」的假设在此更正）。真正缺口是 **① 客户端时间未校准**、**② push no-op 不可观测**（§2.1）。

### 1.3 web 阶段一现状（待翻转的接线面）

| 环节           | 事实                                                                                                   | 证据                                                                                                          |
| :------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| 业务仓储       | **远端直连**（`*RepoImpl(requester)`），读经 `withMirrorFallback(远端, 本地, reads)`                   | `apps/web/src/hooks/usecases/binding.ts:118-153`                                                              |
| 偏好仓储       | **已是本地**（`newLocalProjectPreferenceRepository`），读时对账恢复                                    | `apps/web/src/hooks/usecases/binding.ts:136`；`persistence-local/repos/project-preference-repo-impl.ts:45-90` |
| 写闸门         | `decorateUseCase → withReadOnlyGuard(useCase, WRITE_METHODS_BY_KIND[kind])`（**web-only**）            | `apps/web/src/hooks/usecases/binding.ts:154`；`packages/presentation/offline/write-gate.ts:68`                |
| 闸门判定       | `isReadOnly() = offlineEntry \|\| offline \|\| navigator.onLine===false`                               | `packages/presentation/offline/read-only-state.ts:24-27`                                                      |
| 稳定错误码     | `OFFLINE_READONLY`（`'error'` 直返 / `'tuple'` = `[null,'OFFLINE_READONLY']`）+ 节流 `NueMessage.warn` | `write-gate.ts:22,46-56,74-78`                                                                                |
| 写方法清单     | 7 类业务用例（task/check-item/comment/project/tag/pomodoro/pomodoro-record）+ user 身份类              | `packages/presentation/offline/write-methods.ts:20-81`                                                        |
| 镜像填充       | `startWebDataPlane()` 调 `syncService.start()`（每用户一次）+ `registerBackfillTriggers`               | `apps/web/src/data-plane.ts:39-72`                                                                            |
| **dirty 监听** | ⚠️ **web 未接线** `syncTracker.setDirtyListener(...)`（**desktop 有**）⇒ 本地写后无防抖推送            | `apps/web/src/data-plane.ts`（无该调用）vs `apps/desktop/src/renderer/src/AppRoot.vue:75-76`                  |
| 首拉门         | ⚠️ **web 无 `InitialSyncGate`**（desktop 有）；web 只做非阻塞后台拉取                                  | `apps/web/src/data-plane.ts:15`（注释自述）；`apps/desktop/.../components/initial-sync-gate.vue`              |

### 1.4 偏好面（TASK-26，**已验证，阶段二不翻改**）

- 独立偏好队列（`meta` 单记录 `${userId}:preference-queue`，按单位去重）：`persistence-sync/preference-queue.ts:30-92`。
- 设置面 LWW 用**服务端** `updatedAt`（`isRemoteNewer`）：`preference-sync.ts:160-170`；`markPreferenceDirty` 入队 + 防抖：`:458-470`。
- **普通清单偏好按行 LWW v1 未落地**（R-10b / `T141`）：本地无 per-row `syncedUpdatedAt`，`converters/preference.ts:14` 为**合成主键**。
- ⚠️ **标签偏好（DP-5）**：desktop 本地仓储 `save` **不入偏好队列**（`repos/tag-preference-repo-impl.ts:39-49`）；web 仍 `withMirrorFallback(TagPreferenceRepoImpl, …, ['get'])`（写远端直连）⇒ **标签偏好两端均非 local-first**（R-9/R-14）。

### 1.5 口径更正与补强（对 PM 信封）

| #      | 原述                                                                                      | 核实结果                                                                                                                                                               | 证据                                                        |
| :----- | :---------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| **P1** | 「per-row 版本标记是否必需（关联 T141；服务端已返回 per-row `updatedAt`，缺口在客户端）」 | ⚠️ **业务数据面不成立**：服务端 `updated_at` + `DecideUpsert` + 客户端 `syncQueue.localUpdatedAt` **已构成 per-row LWW**；「缺口在客户端」只对**偏好面**（`T141`）成立 | §1.1/§1.2                                                   |
| **P2** | 「回传复用 syncQueue 还是独立队列」                                                       | 业务数据**必须复用**（偏好面因**合成主键**不兼容批量 upsert 才独立，`converters/preference.ts:14`）                                                                    | §1.4                                                        |
| **P3** | 「web 存量只读镜像 → 新语义」                                                             | **无数据迁移**：镜像行无 `syncQueue` 项 = 远端权威，天然合法；切换是**接线级**而非数据级                                                                               | §1.3；`sync-service.ts:742-757`                             |
| **P4** | 「写路径切本地后 `markDirty` 必然非 0」                                                   | ✅ 成立；但需**显式替换**阶段一不变量「web 业务 `markDirty` 恒 0」（C-59/AC10）为新不变量（§3 PS-2′）                                                                  | `docs/prds/2026-09-23-web-offline-stage1.md` AC10           |
| **P5** | 「web 业务只读 = 过渡态」                                                                 | ✅ 与 C-59 r9 一致；**但 `C-66`（web 不得接本地写仓储）必须同批修订**，否则新旧条款自相矛盾                                                                            | `web-offline-…-posture.md` §3.4 C-66                        |
| **P6** | 未述：web 首拉窗口                                                                        | ⚠️ **新风险**：web 当前**远端直连读** ⇒ 切本地后「本地空 ⇒ 首屏空」；web **无 `InitialSyncGate`** ⇒ 需补首拉门（§2.3）                                                 | `data-plane.ts:15`；`initial-sync-gate.vue`（desktop-only） |

---

## 2. 决策

### 2.1 D-1 冲突解决策略：LWW（服务端权威、per-row）为 2A 终态；2B 升级 OCC

**裁定**：

1. **2A 沿用 LWW**（`DecideUpsert`），**不做**版本向量、**不做**字段级合并（选型四步法：业务无多主合并需求；成熟度=已在跑；团队=零学习成本；成本=最低）。**软删兼容**：墓碑（`.Unscoped()` + `deletions`）继续参与同一 LWW 比较，语义不变。
2. **补齐缺口 ①（时间基准）**：本地写生成的 `updatedAt` 改为**服务端校准时间**（`new Date(Date.now() + getServerTimeOffset()).toISOString()`）。
    - 事实：`calibrateServerTime()` 每次 push/pull 都写 `SERVER_TIME_OFFSET_KEY`，但 `getServerTimeOffset()` **全仓无调用点**（§1.1）⇒ 校准数据**已在手、只是没用**。
    - 理由：`DecideUpsert` 比较的是「客户端 `updatedAt`」vs「服务端 `updated_at`」⇒ **客户端时钟偏移直接决定冲突结果**（时钟落后 ⇒ 本地写被静默 no-op；时钟超前 ⇒ 覆盖他端较新写）。
    - 约束：**不得**因此改服务端协议（C-44）；校准为**客户端本地值**，服务端仍以 `time.Now()` 为准。
3. **补齐缺口 ②（可观测）**：新增**冲突记账（conflict journal）**——凡「本地待推修改被远端覆盖」或「push 被服务端 no-op」，**记录事件 + 败方内容快照**（有界），并在同步状态面暴露计数。
    - 存储：`meta` 单记录 `${userId}:conflict-journal`（`MetaRecord` **纯追加非索引字段** ⇒ **不 bump Dexie version / 不加索引**，同 `mirror-status` / `preference-queue` 先例，不触 C-44）。
    - 写入点：`applyPullBatch` 远端胜分支（捕获**覆盖前的本地 record** 入 journal 后再 `put`）；`pushAllInner` 收到服务端 **no-op** 回执时（依赖 §2.1-DP-2 的 `Outcome` 字段）。
    - 有界：每用户上限（建议 **50 条**，环形淘汰）；**不含 PII 之外的额外敏感面**（沿用明文姿态）。
    - UI：同步状态面板新增「冲突 N」行 + 可见提示（复用 `preferenceFailedCount` 的独立字段范式，**不计入**业务 `pendingCount`/`failedCount`）。
4. **2B 升级路径（推荐，非 2A 必需）**：**OCC（乐观并发控制）**——服务端在 pull 结果中已返回 per-row `updatedAt`；客户端持久化「上次同步到的服务端版本 `syncedServerUpdatedAt`」；push 时回传该 `base` 版本，服务端仅当 `base == 当前 updated_at` 时覆盖，否则返回 conflict。**收益**：彻底去掉客户端时钟依赖；**成本**：additive 协议字段（`SyncResult.Outcome` + push `baseUpdatedAt`）⇒ 需走 C-44 协议评审。**同型先例**：偏好面设置面已用「`SETTINGS_SYNCED_AT` + 服务端权威」的等价模式（`preference-sync.ts`）。
5. **`T141` 关系**：`T141`（偏好面普通清单偏好 per-row LWW）**不是**阶段二业务数据面的前置；但其「per-row `syncedUpdatedAt`」范式与本篇 **2B 的 OCC** 同源 ⇒ **建议 `T141` 在 2B 之后复用 OCC 基建**，避免两套版本语义。

**否决**：

| 候选               | 否决理由                                                                                          |
| :----------------- | :------------------------------------------------------------------------------------------------ |
| 版本向量（VV）     | 多主合并需求不存在（服务端是唯一权威）；复杂度/存储/调试成本高 ⇒ **过度设计**                     |
| 字段级合并（2A）   | 需字段级版本 + 合并规则 + 冲突 UI；与「服务端给出确定结论」的 PRD 规则冲突；**列为 2B+ 可选增强** |
| 纯「后写覆盖」     | 无时间基准 ⇒ 换设备登录会用陈旧本地覆盖服务端较新值（用户可见回退）⇒ 已有 `DecideUpsert` 明确排除 |
| 依赖客户端时钟主张 | 时钟不可信（PS-8 同源）⇒ 2A **先校准**，2B **去依赖**                                             |

### 2.2 D-2 回传机制：复用业务 `syncQueue`（不新建业务队列）

**裁定**：

1. **业务数据复用 `syncQueue`**（`syncTracker.markDirty` → `pushAllInner`），理由：
    - 零新管线：web binding 换 `newLocal*Repository()` 后，`markDirty` 由**同一份**本地仓储**自动**触发（`task-repo-impl.ts:122` 等）。
    - 既有能力全复用：实体级去重、退避/暂停/凭证三分类、快照守卫移除、`enqueue` 串行、批量 upsert 幂等。
    - **偏好面继续独立队列**（PS-1/PS-10 不变）：偏好为**合成主键**（`converters/preference.ts:14`），与 `/sync/push` 的「客户端预置 id upsert」契约不兼容；且不得污染业务 `pendingCount`。
2. **`markDirty` / `pendingCount` 新语义（PM 明确要求）**：
    - 旧（阶段一）：web 业务 `markDirty` **恒 0**（C-59 不变量）。
    - 新：`markDirty` = 「**本地业务写已发生、待服务端确认**」；`pendingCount = countDirty(userId)`（按实体去重，**成功同步后回 0**）。
    - **可验证不变量（替代 C-59 的恒 0）**：`每次本地业务写最终收敛为「服务端确认（出队）」或「可见失败（退避/暂停计数）」；不存在无提示的永久滞留`。
    - `pendingCount` 与 `failedCount` 语义**不变**（`countDirty` / `retryCount>0`）；`preferenceFailedCount` 仍独立（TASK-26 GAP-2）。
    - **C-54 登出护栏**继续直调 `syncTracker.countDirty(userId)`（**禁**读 `syncStatus.pendingCount`）——不变。
3. **批量 / 顺序 / 幂等**：
    - **批量**：沿用 `pushAllInner` 单请求多表批量；上限 `QUEUE_LIMIT_PER_TABLE=1000` / `QUEUE_LIMIT_TOTAL=2000`（**仅提示不阻断**，SHELL-06 C-41）不变。
    - **顺序**：实体间**无依赖顺序**（id-keyed upsert）；父子/级联删除**同批入队**（`cascadeRemove`，`task-repo-impl.ts:198-231`）；pull/push 由 `enqueue` **串行**；**先拉后推**（`start`/`resumeBackfill`）⇒ 减少无谓覆盖。
    - **幂等**：服务端 upsert + LWW Noop ⇒ 重试安全（现有保证）。
4. **多标签 push 协调（新风险，必须显式处置）**：pull 已有 `navigator.locks` 单主（`sync-service.ts:537-558`）；**push 无跨标签锁**。web 写路径切本地后多标签**可写** ⇒ 两标签可并发 push。
    - **2A 处置**：**接受 + 登记**（服务端幂等 + LWW ⇒ 无数据损坏；最坏为重复推送/后写胜），**或**（推荐，低成本）复用同款 `navigator.locks` 给 push 加 `ifAvailable` 单主（`nao-todo:push:${userId}`，拿不到锁则跳过、由他标签/退避补推）。
    - **2B 处置**：完整跨标签协调（BroadcastChannel / SharedWorker / leader 选举），与 C-57（desktop 单实例锁）口径统一。

### 2.3 D-3 迁移方案：接线级切换（无数据迁移）

**裁定**：

1. **无数据迁移**：web 本地库与 desktop **同表同结构同仓储**（`local-database.ts` 11 业务表 + `meta`/`syncQueue`/`syncCursor`；**Dexie version 保持 4**，不加索引）。存量只读镜像行**天然合法**（无 `syncQueue` 项 ⇒ 远端权威，下次 pull 覆盖）。
2. **切换步骤（web）**：① binding 业务仓储 `withMirrorFallback(远端, 本地, reads)` → `newLocal*Repository()`；② `data-plane.ts` 补 `syncTracker.setDirtyListener(() => syncService.schedulePush())`；③ 撤 `decorateUseCase` 写闸门。
3. **web 首拉门（P6，新增硬约束 PS-15）**：切本地后「本地空 ⇒ 首屏空」，而 web **无 `InitialSyncGate`**。
    - 规则：`hasLocalMirror(userId)`（已有，`offline-prerequisites.ts:52-62`）为真 ⇒ **立即本地优先**；为假且在线 ⇒ **首拉门**（等待首次 `start()` 完成或超时后放行并显示「尚未同步完成」，复用 C-60③ 文案）；为假且离线 ⇒ **既有离线进入引导**（`mirror-missing`）不变。
    - **禁**：不得用「单次读返回空」推断无数据（合法的空清单）；**只以镜像存在性判据**。
4. **desktop 不受影响**：binding 逐字不变（`apps/desktop/.../binding.ts:31-39`），无迁移、无行为变更。
5. **回滚路径**：
    - 触发条件：2A 上线后出现 P0 数据回归。
    - 步骤：① `await syncService.pushAll()` best-effort 冲刷；② binding 回退 `withMirrorFallback` + 重挂 `decorateUseCase`；③ **未冲刷项保留在 `syncQueue`**（不丢），未来 local-first 版本可续推；④ 文档登记「回滚窗口内本地未推写入在回滚版本中不可见（但未删除）」。
    - **不可回滚项**：无（未改 schema、未改服务端、未删 `key-bundle`）。

### 2.4 D-4 C-59 撤销路径（web 业务只读安全退场）

**顺序（不可颠倒）**：

| 步  | 动作                                                                                                                                                           | 为何在此序                                                                                     |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| 1   | **binding 业务仓储换本地**（7 域）                                                                                                                             | 先具备本地写能力                                                                               |
| 2   | **补 web dirty 监听**（`setDirtyListener` + `schedulePush`）                                                                                                   | 否则本地写**永不回传**（当前 web 缺失，§1.3）                                                  |
| 3   | **撤 `decorateUseCase` 写闸门**（web binding 不再注入 `withReadOnlyGuard`）                                                                                    | 闸门必须在写路径就绪后撤，否则出现「无闸门的远端直连写」窗口                                   |
| 4   | **`markDirty` 语义切换 + 口径同步**（C-59/AC10/PRD/AGENTS.md/测试断言）                                                                                        | 与步骤 3 同批，避免「闸门已撤、不变量未改」的验证空窗                                          |
| 5   | **业务域闸门条目退役**（`write-methods.ts` 业务 7 域条目删除；**`withReadOnlyGuard` / `OFFLINE_READONLY_ERROR` / `isReadOnly` 保留**以服务身份域，见 §2.6 W5） | 与步骤 3 同批（避免残留空转闸门）；**闸门作用面收敛至身份域**（原「组件停用→删除」**不成立**） |
| 6   | **C-59 / C-66 条款修订**（r10：作用域=业务数据面**阶段一**；C-66「web 不得接本地写仓储」→「阶段二业务面 web **接**本地写仓储」）                               | 条款是文档事实源，必须与实现同步                                                               |

**保留项（不得删）**：

- `isReadOnly` / `read-only-state.ts`：仍供**离线 UI 角标**与 `offlineEntry` flag 生命周期（`offline-read-only.ts`）使用 ⇒ **写拦截语义保留（服务身份域）**；**仅业务域不再受其约束**（见 §2.6 W5）。
- `sync-status-bar.vue` 的离线/镜像/触顶展示（C-60）不变。
- `OFFLINE_READONLY` **保留**（服务身份域离线拦截，见 §2.6 W5）；其调用方 = `write-gate.ts` 定义 + 测试 + `write-methods.ts` **身份域条目** ⇒ **不得整体删除**。
- **`signOut` / 登出清库 / 迁移 / 离线进入 / 镜像读取** 从不受闸门约束（`write-methods.ts:81` 已排除 `signOut`）⇒ 作用面收敛后行为不变。

### 2.5 D-5 回归矩阵（阶段一功能逐项「如何保证不回归」）

> **核心控制原则**：阶段一功能**不依赖业务写路径语义**（只依赖：镜像表结构 / 迁移器 / 清库原语 / 明文接缝 / 状态面 / 偏好队列）。本单**只改业务写路径接线**（binding + 闸门 + dirty 监听），**不触碰**上述六项的实现 ⇒ **回归面天然隔离**；再以**绑定级断言**兜底。

| #    | 阶段一功能                                                     | 不回归保证（设计层）                                                                                                | 验证方式（可执行）                                                                                  | 守护测试（现有/新增）                                                                                                                                                                                           | Owner      |
| :--- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| R-01 | **离线读镜像**（远端优先 + 失败回退）                          | 镜像**写入路径不变**（`applyPullBatch` 直写表）；本单只把**读主源**由「远端优先」改为「本地优先」（终态语义）       | 断网冷启动（有镜像）⇒ 首屏有数据 + 「数据截至 X」；`mirrorPulledAt` 冷启动读 `meta` 落盘值          | 现有：`mirror-status-persistence.test.ts` · `def6-mirror-completeness.test.ts` · `apps/web/src/hooks/__tests__/use-mirror-loaded-count.test.ts` · `offline-prerequisites.test.ts`；**新增**：web 本地优先读断言 | rd-fe / qa |
| R-02 | **迁移门**（DEF-10 调用点顺序 / DEF-16 正向可达）              | `bootstrapLocalData` / `checkAndCleanExpired` / `restoreMirrorStatus` **零改动**；web `routes.ts` 的 C-61② 顺序不变 | 顺序断言（`checkAndCleanExpired` 早于 `syncService.start()`）；离线进入**正向**可达（非仅拒绝路径） | 现有：`bootstrap-local-data.test.ts` · `def10-bootstrap-order.test.ts` · `offline-entry-positive.test.ts`                                                                                                       | qa         |
| R-03 | **清库**（C-52/C-53/C-54：按键黑白名单 / 可重入 / 脏队列阻塞） | `wipeUserData` 与 `deletionSchedules` 范围**零改动**；C-54 继续直调 `countDirty`                                    | 登出 ⇒ 业务表零残留 + `nao.deviceId` 保留；故障注入 ⇒ 重启补清；`countDirty>0` ⇒ 阻塞确认           | 现有：`deletion-service.test.ts` · `deletion-wipe.test.ts` · `sign-out-wipe.test.ts`；**新增**：local-first 后 `countDirty>0` 登出护栏用例                                                                      | rd-fe / qa |
| R-04 | **明文姿态**（C-46/C-51：passthrough / 双格式读取）            | `cryptoService` 接缝、迁移器、双格式读取**零改动**（本单不碰加密/迁移路径）                                         | 混合格式读取成功；冷启动无密码；`key-bundle` 未删                                                   | 现有：`crypto-service.test.ts` · `plaintext-migration.test.ts` · `plaintext-notice.test.ts`                                                                                                                     | qa         |
| R-05 | **两端一致同步状态展示**（C-60 / T115c）                       | `sync-status-bar.vue` 与状态接口**零改动**；新增**冲突计数**为**纯追加**字段（不影响现有三态/角标）                 | 两端同一组件同一状态接口；离线/镜像/触顶三态文案不变；冲突行可见                                    | 现有：`sync-status-bar.test.ts`（两端共用）· `sync-status.test.ts`；**新增**：冲突计数不改业务计数的负向断言                                                                                                    | rd-fe / qa |
| R-06 | **偏好同步**（TASK-26：本地优先 + 独立队列 + LWW）             | 偏好队列 / `markPreferenceDirty` / `flushPreferenceQueue` **零改动**；业务队列与偏好队列**隔离**（PS-1/PS-10）      | 离线改偏好本地生效；联网回传；登出重登/换设备恢复；业务 `pendingCount` 不受偏好影响                 | 现有：`preference-queue.test.ts` · `preference-sync.test.ts` · `preference-write-gate.test.ts` · `calendar-preference-scope.test.ts`                                                                            | rd-fe / qa |
| R-07 | **DEF-5/6 回归线**                                             | DEF-5（checkin 网络类不清认证）、DEF-6（续拉至无更多）**零改动**                                                    | DEF-6：>200 行账号启动 1 次含最新；DEF-5：网络类失败不清 JWT                                        | 现有：`def6-mirror-completeness.test.ts` · `def6-mirror-e2e.test.ts` · `sync.test.ts`                                                                                                                           | qa         |
| R-08 | **移动端 0 改动**                                              | 不触碰 `packages/presentation-react` / `apps/mobile`；服务端 `project_preferences`/`tag_preferences` 语义不变       | `git status --porcelain -- packages/presentation-react apps/mobile` = 0                             | 现有：`guard:mobile-imports` · `guard:mobile-imports` 门禁                                                                                                                                                      | PM / qa    |
| R-09 | **全范围门禁**（8 项）                                         | 无 schema/协议破坏性变更                                                                                            | `vp check` 0 error · 全仓 `vp test --run` 文件/例/红 · 4 guards rc0 · 双端 build rc0                | 批末 PM/qa 统一跑                                                                                                                                                                                               | PM / qa    |

**绑定级断言（新增，防「悄悄翻回去」）**：

- **正向**：web `createTaskRepository()` 返回实例为 `LocalTaskRepoImpl`（或等价 marker）；`decorateUseCase` **未提供**（`undefined`）。
- **负向**：web 不再 import `withMirrorFallback` 于业务域（barrel/静态断言）；`OFFLINE_READONLY` 无生产引用。
- 手段：`apps/web/src/hooks/usecases/__tests__/write-gate-wiring.test.ts` 改造为**接线断言**（该文件已存在，正是「闸门是否挂上」的守护点）。

### 2.6 D-6 分期建议（2A / 2B 边界与 25 写入口推进顺序）

**2A 边界**（"写路径切本地 + 回传 + LWW，与 desktop 同构"）：

- web 业务**7 域** binding 换本地仓储 + 撤闸门 + dirty 监听。
- 时间基准校准（`getServerTimeOffset` 接线）。
- 冲突记账（journal + 计数 + 败方快照）。
- web 首拉门（PS-15）。
- 服务端：**仅** `SyncResult` 增 `Outcome`（additive；DP-2 拍板后）。
- **不含**：字段级合并、OCC per-row 版本、多标签完整协调、`T141`、`DP-5`（标签偏好）。

**2A 推进顺序（按 25 写入口所属域，逐域独立可验证）**：

| 波次   | 域（写入口 #）                                        | 用例方法（`write-methods.ts`）                                                      | 顺序理由                                                                                                                                   | Owner |
| :----- | :---------------------------------------------------- | :---------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :---- |
| **W1** | **任务**（#1–#13 / #16–#18 / #25；**16 项，最大面**） | `TASK_WRITE_METHODS`（create/update/delete/restore/batchUpdate/resort/copy/snooze） | 核心价值 + 走通全链路（含子实体级联、批量、重排、看板）⇒ **先打通主链**                                                                    | rd-fe |
| **W2** | **子实体**（#14 检查项 / #15 评论）                   | `TASK_CHECK_ITEM_WRITE_METHODS` / `TASK_COMMENT_WRITE_METHODS`                      | 依赖 W1 的任务 id 语义；级联删除已由 W1 覆盖                                                                                               | rd-fe |
| **W3** | **容器**（#22 清单 / #21 标签）                       | `PROJECT_WRITE_METHODS` / `TAG_WRITE_METHODS`                                       | 涉及计数事件/排序/归档；任务依赖清单存在 ⇒ 放 W1 之后更易验                                                                                | rd-fe |
| **W4** | **番茄**（#19 记录 / #20 常用番茄）                   | `POMODORO_RECORD_WRITE_METHODS` / `POMODORO_WRITE_METHODS`                          | 追加型、低风险、无级联 ⇒ 最后                                                                                                              | rd-fe |
| **W5** | **身份**（#23 外观 / #24 昵称密码头像会话）           | `USER_WRITE_METHODS`（**保持远端直连**，不切本地）                                  | 身份域**不在**业务同步（`SYNC_TABLES` 无 users/userConfigs）；#23 已由 TASK-26 偏好面接管；#24 与 desktop 同口径（远端直连、离线失败可见） | rd-fe |

> **W5 说明（r2 修订，2026-09-24，依据 PM 拍板 S14=(a)）**：`USER_WRITE_METHODS` **保留**为 web 离线写闸门的**唯一条目** —— **身份域保留离线写闸门**：**离线身份写 = 写前拦停 + 明确提示**（`OFFLINE_READONLY` + `NueMessage.warn`）；**desktop** 同场景 = **远端失败 toast**；**两者均属「可见失败」—— PS-13 只要求「可见」、不要求形态一致**。**不是** local-first（用户域不在业务数据面，不切本地）。
>
> **PM 拍板 S14=(a) 的四条理由（原样留档）**：① **低 churn 且已实现已验证** —— (b) 需回改 C-59 r10 残留句 + 删 `USER_WRITE_METHODS` + 重跑闸门/绑定级断言；现有实现 `b4960a4d` 已自验。② **与阶段一 web「离线明确告知」姿态一致** —— 离线身份写在**写之前**被明确拦停（`OFFLINE_READONLY` + 提示），优于「发出去再 toast 失败」；desktop 同场景为远端失败 toast ⇒ **两者均属可见失败，PS-13 只要求「可见」不要求形态一致**。③ **不构成「两端同构」违约** —— 身份域本就不在业务数据面（W5 = 保持远端直连、不切本地），local-first 同构只约束业务 7 域。④ **保留项本就是身份域用途**（`withReadOnlyGuard` / `OFFLINE_READONLY_ERROR` / `isReadOnly` / `read-only-state.ts`）⇒ 删表项不减基建，收益仅「形式统一」，代价是可见性略降。
>
> **⭐ 核验结论（按域核验、非假信号）**：业务 7 域**无**「离线只读 / 禁用」假信号 —— `isReadOnly` / `useReadOnlyState` 消费方**仅** ① `packages/presentation/offline/write-gate.ts` 内部（现仅包装 `USER_WRITE_METHODS`）② `apps/web/src/components/sync/sync-status-bar.vue`（`isReadOnly` → `resolveFreshness({ isOffline })`，驱动**数据新鲜度**文案/角标，离线时恒正确、与可否写无关）；**无任何 UI 把 `isReadOnly` 接 `disabled` / 只读文案**；`offline.readOnlyBanner` 为**死键**（零消费者）；desktop 不调 `startReadOnlyWatch`、binding 无 `decorateUseCase` ⇒ 零影响。**方法** = 全仓 grep + codegraph 影响面核对（证据见 `T151` 回执）。
>
> **双向互记**：本条 ↔ `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md` **C-59 r10「现行口径」块**（§10.11 一）；两条口径以本篇 **S14=(a)** 为准。

**2B 边界**（"精细化冲突 + 迁移优化"）：

- OCC per-row 版本（服务端签发 + 客户端 `baseUpdatedAt` 回传）⇒ 去客户端时钟依赖。
- 冲突解决 UX（journal 恢复/对比视图）+ 字段级合并（可选）。
- 多标签 push 完整协调（BroadcastChannel/leader）。
- 偏好面收口：`T141`（普通清单偏好按行 LWW）+ `DP-5`（标签偏好入偏好队列）⇒ 复用 2B OCC 基建。
- 迁移优化（`T119` 类拆分经验：**只为迭代速度**，非全仓 wall）。

---

## 3. 硬约束（PS-12…PS-16；沿用 PS-1…PS-11 不变）

- **PS-12 两端业务数据面同构 local-first（替代 C-59 的 web 恒 0）**：web 与 desktop 业务写**一律先落本地仓储** → `syncTracker.markDirty` → `syncQueue` → 回传。**web 业务 `markDirty` 非 0 合法**；阶段一「web 业务 `markDirty` 恒 0」**随 C-59 退役**。
- **PS-13 收敛不变量（可验证）**：每次本地业务写最终为「服务端确认（出队）」或「可见失败（退避/暂停/凭证计数）」；**不存在无提示的永久滞留**。`pendingCount = countDirty`，成功同步后回 0。
- **PS-14 冲突可观测**：远端胜 / push no-op **必须记账**（`meta` 冲突 journal，有界）+ 状态面可见计数；**丢败方内容入 journal**（不得静默覆盖）。
- **PS-15 时间基准统一**：本地写 `updatedAt` 使用**服务端校准时间**（`getServerTimeOffset`）；**禁**直接用裸 `new Date()` 作为 LWW 输入。（服务端仍以 `time.Now()` 为唯一权威。）
- **PS-16 web 首拉门**：`hasLocalMirror` 为假且在线 ⇒ 首拉门（等待首次拉取或超时放行 + 「尚未同步完成」文案）；**禁**以「单次读返回空」推断无数据。
- **PS-1/PS-10（沿用）**：偏好面**不得**进入业务同步引擎；偏好队列**不计入** `syncQueue`/`pendingCount`；偏好存储**不 bump Dexie version / 不加索引**。
- **PS-8（沿用）**：冲突判据以**服务端时间为权威**；客户端时间戳**不作**偏好面判据（业务面因服务端 `DecideUpsert` 以 `updated_at` 为准，客户端时间仅作输入 ⇒ 2A 校准、2B 去依赖）。
- **C-44（沿用）**：协议冻结 + 记录/状态字段纯追加；冲突 journal 落 `meta` **非索引字段** ⇒ 不违反；**若需新增 Dexie 索引 / version bump ⇒ 必须回评审**。

---

## 4. 风险清单（每项含影响 + 应对）

| #    | 风险                                                            | 影响                                    | 应对                                                                                                 |
| :--- | :-------------------------------------------------------------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| R-1  | **客户端时钟偏移**导致本地写被服务端 no-op（静默丢）            | **数据/意图丢失（P0）**                 | 2A **校准时间基准**（PS-15）+ 冲突记账；2B OCC 去依赖                                                |
| R-2  | **push no-op 不可观测**（服务端无 outcome 字段）                | 静默覆盖，违 AC3/AC4                    | 2A 服务端 `SyncResult.Outcome`（additive，DP-2）；未拍板则 2A 仅 pull 侧可观测 + 登记窄窗            |
| R-3  | **web 多标签并发 push**（无跨标签锁）                           | 重复推送 / 后写胜（无损坏）             | 2A 复用 `navigator.locks` 给 push 加单主（推荐）或接受+登记；2B 完整协调                             |
| R-4  | **web 首屏空窗**（本地空 + 远端直连读已撤）                     | 用户可见「数据消失」错觉                | PS-16 首拉门 + C-60③ 文案                                                                            |
| R-5  | **回滚后未推本地写不可见**                                      | 回滚窗口内数据「看起来丢了」            | 回滚前 `pushAll()` best-effort；未推项保留 `syncQueue`；文档登记                                     |
| R-6  | **`withMirrorFallback` 退役遗漏**（残留远端优先读）             | 两端行为不一致 / 本地写被远端陈旧值覆盖 | 绑定级断言（§2.5）+ 静态 import 断言                                                                 |
| R-7  | **`markDirty` 语义切换不同步**（文档/测试仍断言恒 0）           | 门禁假绿 / 口径漂移                     | 步骤 4 与步骤 3 同批；`write-gate-wiring.test.ts` 改造为接线断言；C-59/AC10/AGENTS.md 同批修订       |
| R-8  | **标签偏好（DP-5）仍非 local-first**                            | 「两端同构」不完整                      | 显式登记（不得声称「偏好面全一致」）；2B/`T141` 收口（DP-3）                                         |
| R-9  | **`T141` 与 2B OCC 双轨版本语义**                               | 维护两套版本逻辑                        | 建议 `T141` 在 2B 后复用 OCC 基建（DP-4）                                                            |
| R-10 | **服务端 outcome 字段触碰 C-44**                                | 协议评审成本                            | 字段 **additive + 可选**；移动端不用 `/sync/push` ⇒ 零影响；仍走协议评审（PM 拍板）                  |
| R-11 | **迁移门/清库被本地写路径污染**（本地写产生脏队列影响登出护栏） | 登出确认频繁 / 误清                     | 清库范围不变（`syncQueue` 本就清）；C-54 已用 `countDirty` ⇒ 语义正确；补用例                        |
| R-12 | **性能**：本地写即时但回传/首拉阻塞                             | UI 卡顿                                 | 本地写同步返回；回传异步防抖（既有）；首拉门**非阻塞**（超时放行 + 文案）；NFR 沿用「回传不阻塞 UI」 |
| R-13 | **全仓测试时间**（聚合工作量驱动）                              | 批末门禁慢                              | 沿用测试提速纪律（受影响面迭代 + 批末 1–2 次全仓）；**不并发跑全仓**                                 |

---

## 5. 分阶段里程碑（实施顺序）

| 阶段   | 内容                                                                                                                                       | Owner                | 依赖    |
| :----- | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------- | :------ |
| **M0** | PM 拍板 DP-1…DP-4 + PRD 口径修订（§5 业务规则 / AC / 范围）+ C-59·C-66 修订定稿                                                            | PM                   | 本 ADR  |
| **M1** | 服务端（**仅**）：`SyncResult.Outcome` additive 字段 + 测试（**若 DP-2 = 纳入**）                                                          | rd-be                | M0      |
| **M2** | 客户端基础件：`getServerTimeOffset` 接线（PS-15）+ 冲突 journal（存储/写入点/计数/UI 行）                                                  | rd-fe                | M0      |
| **M3** | web 首拉门（PS-16）+ dirty 监听接线（`setDirtyListener` + push 单主）                                                                      | rd-fe                | M0      |
| **M4** | **W1 任务域**：binding 换本地 + 撤该域闸门 + 回归                                                                                          | rd-fe                | M2/M3   |
| **M5** | **W2/W3/W4**：子实体 / 容器 / 番茄逐波切换 + 回归                                                                                          | rd-fe                | M4      |
| **M6** | **闸门作用面收敛至身份域**（组件与 `OFFLINE_READONLY` **保留**；原「停用→删除」**不成立**）+ C-59/C-66 条款 r10 + `markDirty` 口径全量同步 | rd-fe / PM           | M4/M5   |
| **M7** | 回归：§2.5 矩阵逐项 + 全范围门禁 8 项 + 移动端 0                                                                                           | qa                   | M1–M6   |
| **2B** | OCC per-row 版本 + 冲突 UX + 多标签协调 + `T141`/`DP-5` 收口 + 迁移优化                                                                    | rd-fe / rd-be / arch | 2A 发布 |

---

## 6. 连带同步清单（含 Owner）

> 本评审**改变/更正既有结论**，以下文档与代码须同步（禁只改一处）。

| #   | 文件 / 位置                                                                                                           | Owner      | 须同步内容                                                                                                                            |
| :-- | :-------------------------------------------------------------------------------------------------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 / C-66 / 变更记录 r10）                   | arch / PM  | C-59 作用域加「阶段一」限定 + 指向本篇；**C-66「web 不得接本地写仓储」→「阶段二业务面 web 接本地写仓储」**；追加 r10                  |
| S2  | `docs/prds/2026-09-23-stage2-local-first-both-ends.md`（§5/§7 AC/§17）                                                | PM         | 冲突策略（LWW + 时间校准 + journal）、回传（复用 `syncQueue`）、`markDirty` 新语义、首拉门、分期 2A/2B                                |
| S3  | `docs/prds/2026-09-23-web-offline-stage1.md`（AC10 / 不变量 ④）                                                       | PM         | 「web 业务 `markDirty` 恒 0」标注为**阶段一**口径；补新不变量指针                                                                     |
| S4  | `AGENTS.md`（项目红线 / 门禁口径）                                                                                    | PM         | 若新增守卫（绑定级断言 / 冲突 journal）则补；`markDirty` 口径更新                                                                     |
| S5  | `apps/web/src/hooks/usecases/binding.ts`                                                                              | rd-fe      | 业务仓储 `withMirrorFallback` → `newLocal*Repository()`；移除 `decorateUseCase`（写闸门）                                             |
| S6  | `apps/web/src/data-plane.ts`                                                                                          | rd-fe      | 补 `syncTracker.setDirtyListener(() => syncService.schedulePush())`；首拉门接线；push 单主                                            |
| S7  | `packages/presentation/offline/{write-gate,write-methods}.ts`                                                         | rd-fe      | 业务 7 域条目删除（`write-methods.ts`）；**保留** `write-gate.ts` / `OFFLINE_READONLY` / `read-only-state.ts`（服务身份域 + UI/flag） |
| S8  | `packages/infrastructure/src/persistence-sync/sync-config.ts` + 本地仓储（`repos/*-repo-impl.ts`）                    | rd-fe      | 接线 `getServerTimeOffset`；本地写 `updatedAt` 用校准时间（PS-15）                                                                    |
| S9  | `packages/infrastructure/src/persistence-sync/{sync-service,sync-status}.ts` + `db/local-database.ts`                 | rd-fe      | 冲突 journal 写入点/存储/计数（`meta` 纯追加字段）；`SyncResult.Outcome` 消费                                                         |
| S10 | `nao-todo-server`：`interfaces/types/sync.go` + `interfaces/controllers/sync.go` + `domain/types/upsert.go`           | rd-be      | `SyncResult` 增 `Outcome`（applied/noop/conflict，additive）；**不改既有 LWW 语义**                                                   |
| S11 | 测试：`apps/web/src/hooks/usecases/__tests__/write-gate-wiring.test.ts` + `packages/presentation/offline/__tests__/*` | rd-fe / qa | 闸门测试 → 接线断言；新增冲突 journal / 时间校准 / 首拉门用例                                                                         |
| S12 | `docs/tasks-state.md` + `docs/reports/defect-pool.md`                                                                 | PM         | `T142` 结论 + `T141`/`DP-5` 与 2B 关系；标签偏好非 local-first 登记                                                                   |
| S13 | `docs/adr/README.md`                                                                                                  | arch       | 本篇索引行 + 篇间关系（↔ C-59 / TASK-26）                                                                                             |

**移动端**：`packages/presentation-react` / `apps/mobile` **零改动**；服务端 `project_preferences`/`tag_preferences` REST **语义不变**（移动端共用，PS-3 延续）。

---

## 7. 待 PM 拍板决策点

| #        | 议题                                                                                         | 建议                                                                                                  | 备注                                                                  |
| :------- | :------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **DP-1** | **冲突可观测强度**：仅计数/提示 vs **journal 含败方内容快照**（「不丢数据」的强读法）        | **含快照**（有界 50 条，`meta` 纯追加字段）⇒ 满足「不得静默覆盖丢数据」                               | 成本低；2B 可加恢复 UX                                                |
| **DP-2** | **服务端 `SyncResult.Outcome` 是否纳入 2A**（additive，触碰 C-44 协议评审）                  | **纳入 2A**（否则 push no-op 窄窗不可观测，AC3/AC4 不完整）                                           | 移动端不用 `/sync/push` ⇒ 零影响                                      |
| **DP-3** | **标签偏好（`DP-5`/`R-14`）是否随 2A 纳入 local-first**（扩展偏好队列 `tagPreference` kind） | **纳入 2A**（低成本、消除「两端同构」不一致）或**维持后续单**（须登记「标签偏好 v1 非 local-first」） | 若维持后续单 ⇒ 撤闸门后离线标签偏好写变为「远端失败 toast」（非静默） |
| **DP-4** | **`T141`（偏好面 per-row LWW）与 2B OCC 的合并策略**                                         | **`T141` 在 2B 之后复用 OCC 基建**（避免双轨版本语义）；2A 不阻塞                                     | `T141` 非阶段二业务面前置                                             |

---

## 8. 未过项

- **未过：无**（架构师检查清单 11 项 + 硬性红线 9 项逐项核对通过；本 ADR 为纯文档产出，**未改代码**，无测试门禁口径适用；影响面评审已用 `codegraph` + 行号级读码）。
- **阻塞项：无** —— 无「不可行」结论；DP-1…DP-4 为**拍板项**，不影响 2A 主链开工（DP-2 未拍板时 2A 可先落 pull 侧可观测并登记窄窗）。
- **登记（非阻塞）**：标签偏好非 local-first（R-8）；多标签 push 协调（R-3）；服务端 outcome 字段的协议评审（R-10）。

---

## 9. 2B 定向设计（T161 / r3，2026-09-24）

> **输入**：PRD §7（AC3/AC4/AC5/AC6）· 本篇 §2.1-D-1（OCC 升级路径第 4 条）/ §2.3（多标签）/ §2.6（2B 边界）· 风险 R-2/R-3/R-8/R-9/R-10 · 硬约束 PS-12…PS-16 · Issue **#94**（`feat/94-stage2-2b`）· 2A 收批登记（push `conflict`/`error`/`skipped` **未消费**）。
> **口径**：本单 **⛔ doc-only 零代码**（含服务端）；以下为**设计契约**，落地由 PM 据 §9.7 派单。
> **事实基线（读码核实，含 2 处对信封/上批的更正）**：
>
> | #   | 事实                                                                                                                                                                                                  | 证据                                                                                                                                                                     |
> | :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | F1  | push 条目**当前无** `baseUpdatedAt`；`DecideUpsert` 只比较「客户端 `updatedAt` vs 库中 `updated_at`」（LWW）                                                                                          | `nao-todo-server/interfaces/types/sync.go`（`SyncPushReq`）；`domain/types/upsert.go:25-38`                                                                              |
> | F2  | push 逐条已回 `outcome`（2A/T143，additive）+ `serverUpdatedAt`                                                                                                                                       | `interfaces/controllers/sync.go:53-66,73-106`；`interfaces/types/sync.go`（`SyncOutcome*`）                                                                              |
> | F3  | pull 每行**已含**服务端 `updatedAt`（`RFC3339Milli`），客户端 `applyPullBatch` 已用它做 LWW                                                                                                           | `infrastructure/utils/query/sync.go`；`sync-service.ts:752-757`                                                                                                          |
> | F4  | 客户端 `SyncResult.outcome` **仅消费 `noop`**（写 journal）；`conflict`/`error`/`skipped` **未消费**                                                                                                  | `sync-service.ts:987-1001`（仅 `noop` 分支）；2A 收批登记                                                                                                                |
> | F5  | pull 有 `navigator.locks` 单主（`nao-todo:pull:${userId}`，`ifAvailable`，无锁 ⇒ 跳过；环境无 API ⇒ 记日志直跑）；**push 无任何跨标签锁**                                                             | `sync-service.ts:544-570`；`pushAllInner` 无锁                                                                                                                           |
> | F6  | 冲突 journal 已落（`meta` 单记录 `${userId}:conflict-journal`，**上限 50 环形淘汰**，含败方快照），`conflictCount` 已在状态面                                                                         | `conflict-journal.ts:24-80`；`sync-status.ts:51-53,175`                                                                                                                  |
> | F7  | 服务端 `GET /projects/:id/preference` **已回 `updatedAt`**（`ResBase` → `ProjectPreferenceEntityToGetRes`）；客户端 `ResponseBase` **已声明** `updatedAt` 且 `projectPreferenceRes2Entity` **已映射** | `interfaces/types/responseData.go:44-49`；`application/project/converters.go:126-140`；`persistence-go/models/base.ts:6`；`persistence-go/project/converters.ts:100-111` |
> | F8  | 服务端 `POST /projects/:id/preference` 响应 **`Data = projectId`，不回 `updatedAt`** ⇒ 推送成功后无法立即落 per-row 版本                                                                              | `interfaces/controllers/project.go:592-646`                                                                                                                              |
> | F9  | web `createTagPreferenceRepository` = `withMirrorFallback(TagPreferenceRepoImpl, local, ['get'])`（**读远端优先、写远端直连**）；desktop = 本地仓储但 `save` **不入偏好队列**                         | `apps/web/.../binding.ts:103-109`；`apps/desktop/.../binding.ts:39`；`persistence-local/repos/tag-preference-repo-impl.ts`                                               |
> | F10 | 本地 `ProjectPreferenceRecord` / 业务行**均无** per-row `syncedServerUpdatedAt`；`updatedAt` 在本地写后是**客户端值**（不可作判据，PS-8）                                                             | `local-database.ts:26-36`（`ProjectPreferenceRecord`）；`converters/preference.ts`                                                                                       |
>
> **更正 ①（对 `T140` 转述）**：「`persistence-go/models/project.ts` 未声明 `updatedAt`」**不成立** —— `ResponseBase` 已声明（F7），且 `projectPreferenceRes2Entity` 已映射。**真缺口 = 本地无 per-row `syncedServerUpdatedAt`**（F10）+ **push 响应不回 `updatedAt`**（F8）。
> **更正 ②（对 PM 信封 B-2 提示）**：`T141` 的「复用 2B OCC 基建」**不是**复用 `/sync/push` 通道（偏好面**禁入业务同步引擎**，PS-1/PS-10），而是复用**同一 per-row 版本字段语义 + base 比较 + conflict journal**，通道仍为**独立偏好队列 + 偏好 REST**。

### 9.1 ① OCC 契约（服务端签发 per-row 版本 + 客户端回传 base）

**9.1.1 版本令牌 = 服务端 `updated_at`（不新增 `version` 列）**

- **令牌**：服务端 `updated_at`（`RFC3339Milli`），**已由服务端签发**（写入用 `time.Now()`）、**已在 pull（F3）与 push 回执（F2）中返回** ⇒ **零 schema 迁移、零新列**。
- **理由**：满足「服务端签发」语义；与 `DecideUpsert` 现有比较基准**同源**（避免第二套版本语义，对齐 DP-4「避免双轨」）。
- **残留风险 R-14**：同毫秒并发写同一行 ⇒ 令牌可能相同 ⇒ **漏判一次冲突**（后果 = 退回 LWW 覆盖，**非数据丢失**）。缓解 = 服务端按行串行（DB 行锁）+ 概率极低；**后续可选**升级为单调 `version` 列（**需 DB 迁移 ⇒ 本批不做**，列 §9.8 不做清单）。

**9.1.2 请求字段：`baseUpdatedAt`（逐条、可选、additive）**

- **位置**：push 各表条目内，与 `id` 同级 —— `{ id, baseUpdatedAt?, ...createFields }`（`deletions` **不含**，见 §9.8）。
- **服务端类型（C-44 合规写法）**：**不改**共享 `CreateXxxReq`（避免污染 create REST）；新增 **sync 专用条目类型**（Go 嵌入 `CreateXxxReq` + `BaseUpdatedAt string \`json:"baseUpdatedAt,omitempty"\``），`SyncPushReq`各表切片改用之。JSON 层**同形 + 新可选字段** ⇒ **纯追加**；控制器取参改`&req.Tasks[i].CreateTaskReq`。
- **缺失语义**：`baseUpdatedAt` **缺失/空** ⇒ **维持现行 LWW**（客户端 `updatedAt` vs 库中 `updated_at`）⇒ **向后兼容**（2A 客户端、其它调用方**零行为变化**）。

**9.1.3 服务端判定（`DecideUpsert` 扩展，纯逻辑可单测）**

```text
DecideUpsert(existingCreated, existingUpdated, voCreated, voUpdated, baseUpdated, conflictWindow)
  baseUpdated 为零值（未提供）      → 现行 LWW（不变）
  baseUpdated 非零：
    记录不存在                     → 新建（applied；墓碑复活同现行）
    baseUpdated == existingUpdated  → 覆盖（applied）
    baseUpdated != existingUpdated  → 不写入（stale），回 ServerUpdatedAt = existingUpdated
```

- **比较口径**：瞬时比较（同 F3 的 UTC ms 口径），容忍格式差异（`+08:00`/`Z`/毫秒精度）。
- **`stale` 回执必须带 `ServerUpdatedAt`**（供客户端 rebase：拉取该行 → 以新 base 重推或入 journal）。

**9.1.4 `Outcome` 表达（复用 2A 机制；**新增 additive 值 `stale`**）**

| 值         | 语义                                                    | 客户端动作（2B）                                    |
| :--------- | :------------------------------------------------------ | :-------------------------------------------------- |
| `applied`  | 已写入（新建 / 覆盖 / 墓碑复活）                        | 出队 + 落 `syncedServerUpdatedAt`                   |
| `noop`     | 请求更旧未写入（**LWW 路径**，base 缺失时）             | 出队 + **journal**（2A 已落）                       |
| `stale`    | **OCC base 不匹配**，未写入，回库中当前版本（**新增**） | 出队 + **journal（含败方快照）** + 可见计数         |
| `conflict` | **create 语义 ID 碰撞**（既有语义**不变**）             | 出队 + 可见失败（需重生成 id；本批仅消费登记）      |
| `skipped`  | 服务端忽略（如只追加资源不支持删除）                    | 出队 + 登记（不重试）                               |
| `error`    | 处理失败（**既有行为：未消费 ⇒ 已出队**）               | **2B 必须消费**：不出队 + 业务退避（闭合 R-2 窄窗） |

- **为何新增 `stale` 而不复用 `conflict`**：二者**补救动作不同**（`conflict` = 重生成 id；`stale` = rebase/入 journal）⇒ 合并为单值会使客户端无法分流。`Outcome` 枚举本就是 additive 扩展点（2A 已定义 5 值），移动端**不用 `/sync/push`** ⇒ 零影响；**C-44 合规（纯追加枚举值）**。若 PM 坚持「严格单一 `conflict` 值」⇒ 需附 `reason` 字段方可分流（**次选**）。
- **错误码**：OCC 不匹配**不是错误** —— 走 **HTTP 200 + `code 90010`**（既有 push 成功码）+ 逐条 `outcome`；**不新增 `9001x` 错误码**（避免与参数/未登录错误混淆）。
- **⚠️ R-18（必须）**：`stale`/`conflict`/`error` 若**未消费**，客户端会**错误出队** ⇒ 本地修改静默丢失。W2 **必须**同批消费全部 outcome（闭合 2A 登记的 `error` 窄窗）。

**9.1.5 拉取侧复用（零服务端改动）**：pull 每行已含 `updatedAt`（F3）⇒ 客户端在 `applyPullBatch` 写库时**同时**落 `syncedServerUpdatedAt`（per-row base）。

**9.1.6 客户端 base 存储 —— DP-2B-1（决定 2B 实现面，需 PM 拍板）**

| 选项                                            | 做法                                                                                                                 | 代价                                                                                            | C-44                                       |
| :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- | :----------------------------------------- |
| **(i) 业务行非索引字段（推荐）**                | 业务 7 表 + `projectPreferences` 记录加 `syncedServerUpdatedAt?: string`；pull 写入 · push 确认写回 · **本地写保留** | 需触 **7 域本地 repo 写路径**（约 13 个写方法：`put` 前读出旧值并回填 / 或经 `markDirty` 捕获） | ✅ **不 bump version / 不加索引**          |
| (ii) 新 Dexie 表 `syncVersions`（`&id,userId`） | 独立 per-entity 版本表                                                                                               | 更干净（同步元数据不混入业务行）                                                                | ❌ **需 version bump + 新 store ⇒ 回评审** |

- **推荐 (i)**：与 2A 三处 `meta` 纯追加（`mirror-status`/`preference-queue`/`conflict-journal`）**同一先例**（刻意避开 version bump）。**r5 实现指针**：字段落业务行（非索引）；**本地写保留** = `persistence-local/repos/put-with-sync-base.ts`（`putWithSyncBase`，`put` 前回填旧行 base）；**pull 写入** = `putPulledRecord`；**确认写回** = `writeBackSyncBase`（`applied`/`noop`/`stale` 均以 `serverUpdatedAt` 落回）。
- **必须守护的灾难路径 R-20**：若本地写**丢失** `syncedServerUpdatedAt` 或 push 确认后**不回写** ⇒ 下次推送 base 恒不匹配 ⇒ **每次推送都 `stale`**（灾难）⇒ 守护测试 = 「本地写后 base 保留」「push 确认后 base 写回」「pull 后 base = 服务端值」。
- **写回点**：`pushAllInner` 收到 `applied`/`noop`/`stale` 回执时，以 `result.serverUpdatedAt` 落该行 `syncedServerUpdatedAt`（**stale 时即为库中当前版本**，使下次 base 命中）。

### 9.2 ② 冲突解决 UX 落点（PS-14 journal 之上）

**9.2.1 落点**

- **入口**：同步状态面板新增「冲突 N」行（**已存在** `syncStatus.conflictCount`，F6）⇒ 点击打开**冲突列表**（弹层）。
- **列表**：每条 = 表名（本地化）· 实体标题（取 `loser` 快照的 `name`/`title`，缺省 `entityId`）· 时间（`at`）· 类型（`remote-wins` / `push-noop` / **`stale`**）。
- **对比（只读）**：**败方快照**（journal）vs **当前实体**（本地表当前行 = 胜方）。**字段级差异仅展示，不做自动合并**（见 §9.2.2 边界）。
- **组件落点**：复用两端共用的同步状态面板（`apps/web/src/components/sync/sync-status-bar.vue`，desktop 经 `@` 引用）+ 新增冲突弹层；**不新增全局入口**。

**9.2.2 恢复语义（**只提供「用户显式选择」两种动作**）**

| 动作                          | 语义                                                                                                                                            | 边界                                      |
| :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| **A. 保留服务端版本**（默认） | 删除该 journal 条（本地已是胜方）⇒ 无副作用                                                                                                     | 不重推、不覆盖                            |
| **B. 以我的版本重试**         | 把 `loser` 快照**作为一次新的本地写**写回本地表（`updatedAt` = **服务端校准 now**，`markDirty`）⇒ 下轮 push 以**新 base**（当前服务端版本）推送 | 若仍不匹配 ⇒ **再次 journal**（不死循环） |
| ❌ 自动合并 / 字段级挑选      | ——                                                                                                                                              | **不做**（与「服务端给出确定结论」冲突）  |

**9.2.3 与 PRD「服务端给出确定结论」的边界（哪些冲突**不**自动解、如何可见）**

- **自动解（已解）**：`remote-wins`（pull 远端胜）· `push-noop`（LWW 拒）· **`stale`（OCC 拒）** ⇒ 结论 = **服务端版本权威**；败方内容**入 journal**（不丢）+ **可见计数**。
- **不自动解**：**「用户需要本地版本」的场景** —— 由 §9.2.2 动作 B 承担；**在用户处理前**：服务端版本保持权威、本地败方**保留在 journal**（不丢、不静默）。
- **字段级冲突（两端改不同字段）**：OCC 下亦判 `stale`（整行版本已变）⇒ **不自动合并**，用户可见并可恢复 —— 这是「客户端不做合并决策」的**直接推论**，**非缺陷**。
- **删除 vs 编辑**：`deletions` **不纳入 OCC**（§9.8）⇒ 现行「软删 + 服务端 now」不变；记为**已知局限 R-15b**。
- **登出/清库**：journal 随 `meta` 清除（既有 `clearConflictJournal` + 清库范围含 `meta`）⇒ 无跨会话残留。

**9.2.4 R-15（上限张力）**：`CONFLICT_JOURNAL_LIMIT = 50` 环形淘汰 ⇒ **丢最旧败方快照** ⇒ 与「不丢数据」有张力。**r5 落地（DP-2B-5）**：上限 **50 → 200**；淘汰以 `conflictJournalEvictedCount`（非索引字段）累计 + UI **折叠信号**（`folded` / `foldedReason ∈ {'limit','evicted'}`，**两者同真 ⇒ `evicted` 优先**）⇒ **不新增存储机制**；**不做**无限保留（已知局限，同 R-14/R-15b）。

### 9.3 ③ 多标签 push 协调（R-3）

**裁定：`navigator.locks` 单主（`nao-todo:push:${userId}`，`ifAvailable`）—— 与 pull 同构；否决 BroadcastChannel / leader 选举 / SharedWorker。**

| 候选                               | 裁定        | 理由                                                                                                                                                                                                                                                                                                                                          |
| :--------------------------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`navigator.locks` 单主**（推荐） | ✅ **采纳** | ① **已在本仓验证**（pull 同款，F5）⇒ 零新机制；② **浏览器保证** + 回调结束/异常**自动释放**（标签崩溃无活性问题）；③ push 是**短时临界区**（一次往返）⇒ `ifAvailable`「拿不到即跳过」**恰好匹配**，与 pull 语义一致；④ **降级**：无 API 环境 ⇒ 记日志 + 直跑（同 pull，`sync-service.ts:553-557`）⇒ 退化为 2A 现状（幂等 + OCC/LWW ⇒ 无损坏） |
| BroadcastChannel leader 选举       | ❌ 否决     | 需**自建**心跳/失效检测/双 leader 竞态处理 ⇒ 复杂度高、易出 bug（违简单性优先）；无「长驻协调者」需求                                                                                                                                                                                                                                         |
| SharedWorker                       | ❌ 否决     | 部署/兼容成本，无必要                                                                                                                                                                                                                                                                                                                         |

- **范围**：push 加 `ifAvailable` 单主（`deletions` 同批，同请求）；**pull 已有**。
- **临界区内含**：网络往返 + **journal 写入**（`appendConflict`）。**r5 措辞细化（实现事实）**：journal 的 `meta` 单记录 RMW 由**专用锁** `nao-todo:journal:${userId}` 保护（`withJournalRmw`，**阻塞式**读-改-写），**覆盖全部 journal 写者** —— `appendConflict`（pull/push 两侧）+ 恢复动作 A/B（`resolveConflictKeepServer` / `resolveConflictRetryLocal`）⇒ 跨路径并发亦不丢条目。**锁序固定为 pull/push → journal，无反向取锁**（`withJournalRmw` 不取 pull/push 锁；恢复动作内的 `markDirty` 仅触发**防抖定时器**、非同步取锁）⇒ **无死锁**。push 单主锁（限并发推送）与 journal 锁（护 RMW）**职责分离**。
- **未取锁行为**：**跳过本次 push**（不 `noteRunError`、不消耗重试、不 `markBusinessFailure`）⇒ 由**他标签 / 既有触发源（启动·`online`·前台恢复·条件退避）**补推（**守护 R-17**：「不丢」）。
- **与 C-57 口径统一**：「**同 origin 单写者**」= **desktop 由 C-57 单实例锁保证**（进程级）· **web 由 `navigator.locks`（pull + push）保证**（标签级）。**两者目标同一（维持 `syncQueue`/`syncCursor` 单写者假设）、机制互补、口径统一**；desktop 下 `navigator.locks` 恒无争用 ⇒ **行为等价**（同 pull 既有论证）。

### 9.4 ④ 偏好面收口（`T141` + `DP-5`）

**9.4.1 `T141` 普通清单偏好 per-row LWW（复用 OCC 基建）**

- **现状**：`GET` 已回 `updatedAt`（F7，**无需跨仓**）；**缺口** = 本地无 per-row `syncedServerUpdatedAt`（F10）+ **`POST` 响应不回 `updatedAt`**（F8）⇒ 推送成功后无法立即落版本。
- **服务端改动面（小、additive）**：`POST /projects/:id/preference` 响应 `Data` 增 `updatedAt`（**不改既有字段**）—— 与 T131 已登记的「`PUT /user/config` 不回 `updatedAt`」**同类**，**建议同批**补齐。
- **客户端改动面（r5 细化，实现事实）**：`projectPreferences` / `tagPreferences` 记录加 `syncedServerUpdatedAt`（非索引，同 §9.1.6-(i)）；**读路径 = 本地优先**（本地有行 ⇒ **立即返回、不发网络请求**）；**远端胜对账在「触发点」后台完成** —— 本项原措辞「**读时对账**」**收窄为「触发点对账」**（`reconcilePreferences`；**读路径不得被网络阻塞**；PM `T168b` 裁定）；对账判据 = 「本地缺失 **或** 服务端 `updatedAt > syncedServerUpdatedAt` ⇒ 应用远端（**远端胜 + journal**）」；**推送后以服务端回传 `updatedAt` 落新 base**。⚠️ **已知限制**：`POST /tags/:tagId/preference` **仍不回 `updatedAt`** ⇒ tag 侧 base 仅由**触发点对账**刷新（随发布说明登记）。
- **复用点（与 §9.1 同源）**：**同一 `syncedServerUpdatedAt` 字段语义 · 同一 base 比较 · 同一 conflict journal**。**差异**：通道 = **独立偏好队列 + 偏好 REST**（**禁入 `syncQueue`**，PS-1/PS-10 不变）⇒ **不新增业务 `markDirty`/`pendingCount`**。
- **实施顺序**：**必须在 §9.1 OCC 基建（W2）之后**（W4），先服务端偏好回传，再客户端对账。

**9.4.2 `DP-5` 标签偏好入偏好队列**

- **现状**：web = 读远端优先 + 写远端直连；desktop = 本地读 + 本地写**不入队**（F9）⇒ **两端均非 local-first 且不同构**（R-8）。
- **改动面**：① 偏好队列加 `kind: 'tagPreference'`（去重键 = `tagId`，同 `projectPreference` 范式）；② `LocalTagPreferenceRepoImpl.save` 入队 + `markPreferenceDirty`；③ 偏好同步新增推送项（`POST /tags/:tagId/preference`）+ **读时对账**（同 §9.4.1）；④ web `binding.ts` 改 `newLocalTagPreferenceRepository()`（**撤 `withMirrorFallback`**）；⑤ `MetaRecord.preferenceQueue` 项类型扩展（**非索引 ⇒ 不 bump**）；⑥ **需核实** 服务端 `GET /tags/:id/preference` 是否回 `updatedAt` ⇒ 若否，**additive 补齐**（同 F8 处置）。
- **移动端**：服务端 `tag_preferences` REST **语义不变** ⇒ **移动端 0 改动**（红线保持）。

**9.4.3 收口后可声明的口径**

> 仅当 **① `T141` 落地 ② `DP-5` 落地 ③ 两者均过回归** 三者同时满足，方可称「**偏好面全一致（本地优先 + 服务端权威 per-row LWW）**」。**任一未落地 ⇒ 仍不得声称**（延续 2A 收批纪律）。**本单不落地任何一项 ⇒ 口径不变**（R-8 继续有效）。

### 9.5 ⑤ 迁移优化范围

**裁定：本批不做（给出理由）。**

1. **无优化对象**：阶段二迁移已定为**接线级、无数据迁移**（§2.3），且 **2A 已完成** ⇒ 2B 不新增迁移面。
2. **T119 已证伪**：拆分**只对「受影响面迭代」有效**，对**全仓 wall 无收益**（实测 +1%）且新增 ~10s 聚合固定成本 ⇒ 无收益的拆分 = 负收益。
3. **2B 真杠杆** = OCC / 冲突 UX / 多标签 / 偏好收口，**不是测试 wall**。
4. **若仍要做**（仅在出现具体迭代痛点时）：**只对 2B 改动面涉及的关键路径**（如 `sync-service` 相关用例）按 T119 口径拆分，**先测量后给方案**（T118 纪律），**不做全仓重构**；**不新增测试池/worker 配置**（T118 已证无效/有害）。

### 9.6 风险增量 + 回归矩阵增量

**风险增量（接 §4 的 R-1…R-13）**

| #     | 风险                                                        | 影响                             | 应对                                                                 |
| :---- | :---------------------------------------------------------- | :------------------------------- | :------------------------------------------------------------------- |
| R-14  | 同毫秒版本令牌碰撞 ⇒ 漏判一次冲突                           | 退回 LWW 覆盖（**非丢数据**）    | 登记 + 依赖服务端按行串行；后续可选单调 `version` 列（**本批不做**） |
| R-15  | journal 上限 50 环形淘汰 ⇒ 最旧败方快照丢失                 | 与「不丢数据」张力               | §9.2.4：提升上限 + 折叠提示                                          |
| R-15b | 删除不纳入 OCC（删除 vs 编辑）                              | 后到删除胜（编辑可能被墓碑覆盖） | **本批不做**；登记为已知局限                                         |
| R-16  | **OCC 后离线陈旧 base ⇒ 冲突增多**（原 LWW 静默覆盖）       | 用户可见冲突上升（**行为变更**） | **W3 UX 必须同批**；登记「行为变更」（发布说明）                     |
| R-17  | push 未取锁 ⇒ 跳过 ⇒ 可能延迟回传                           | 回传延迟（**不丢**）             | 既有触发源补推；守护「未取锁不消耗重试、队列保留」                   |
| R-18  | `stale`/`conflict`/`error` 未消费 ⇒ **错误出队** ⇒ 本地丢失 | **数据丢失（P0）**               | **W2 必须消费全部 outcome**（闭合 2A `error` 窄窗）                  |
| R-19  | 偏好面收口顺序错 ⇒ 双轨版本语义                             | 维护两套逻辑                     | `T141`/`DP-5` **必须在 W2 之后**（W4）                               |
| R-20  | `syncedServerUpdatedAt` 本地写丢失 / 确认后不回写           | **每次推送都 `stale`（灾难）**   | 三处守护测试（本地写保留 / 确认写回 / pull 写入）                    |

**回归矩阵增量（接 §2.5 的 R-01…R-09）**

| #    | 场景                                | 期望                                                                    | 守护（新增/既有）                 |
| :--- | :---------------------------------- | :---------------------------------------------------------------------- | :-------------------------------- |
| R-10 | OCC base **匹配** ⇒ 覆盖            | `applied` + 版本更新                                                    | 服务端契约测试（新增）            |
| R-11 | OCC base **不匹配** ⇒ 不覆盖        | `stale` + `serverUpdatedAt` = 库中版本                                  | 服务端契约测试（新增）            |
| R-12 | `baseUpdatedAt` **缺失** ⇒ 现行 LWW | 行为逐字不变（**向后兼容**）                                            | 服务端契约测试（新增，负向）      |
| R-13 | 客户端 base 生命周期                | 本地写后**保留** / push 确认后**写回** / pull 后 = 服务端值             | 客户端单测（新增，**R-20 守护**） |
| R-14 | 多标签并发 push                     | **仅一个**执行；未取锁**不消耗重试**、队列保留                          | 客户端单测（新增）                |
| R-15 | outcome 消费                        | `stale`/`conflict` ⇒ journal；`error` ⇒ **不出队** + 退避               | 客户端单测（新增，**R-18 守护**） |
| R-16 | 冲突 UX 恢复（动作 B）              | 写回 loser + `markDirty` ⇒ 以新 base 重推（不死循环）                   | 客户端单测（新增）                |
| R-17 | `T141` 远端更新                     | 本地**不覆盖**（远端胜）+ journal                                       | 客户端单测（新增）                |
| R-18 | `DP-5` 两端同构                     | 两端同 binding + **不入 `syncQueue`**（`countDirty` 恒 0）              | 客户端单测（新增，INV-01 同口径） |
| R-19 | 阶段一/2A 零回归                    | §2.5 R-01…R-09 **全部保持**                                             | 既有守护（不变）                  |
| R-20 | 移动端 0 改动                       | `git status --porcelain -- packages/presentation-react apps/mobile` = 0 | `guard:mobile-imports`            |

### 9.7 分期建议（W0–W4 边界与依赖，供 PM 派单）

| 波次   | 内容                                                                                                                                            | Owner         | 依赖  | 交付判据（摘要）                                                                                                 |
| :----- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :---- | :--------------------------------------------------------------------------------------------------------------- |
| **W0** | **前置**：C-44 协议评审（`baseUpdatedAt` + `stale` 枚举值 + 偏好回传）· **DP-2B-1/2/3 拍板** · **R-2 消费决策**                                 | arch / PM     | —     | ✅ **W0 已完成（2026-09-24）**：C-44 要点已入 r3 + DP-2B 全部拍板（§9.10）+ R-2 决策已定 ⇒ **W1 已具备开工条件** |
| **W1** | **服务端 OCC 契约（additive）**：sync 专用条目类型 + `baseUpdatedAt` + `DecideUpsert` base 分支 + `SyncOutcomeStale` + 偏好推送回传 `updatedAt` | rd-be         | W0    | 契约测试（R-10/R-11/R-12）+ 既有 LWW 用例零回归 + `go test ./...` rc0                                            |
| **W2** | **客户端 OCC 基建**：`syncedServerUpdatedAt`（§9.1.6-(i)）· pull 写入 · push 回传 base · 确认写回 · **全 outcome 消费**（journal）              | rd-fe         | W1    | 单测 R-13/R-15 + 受影响面 `vp test --run` rc0                                                                    |
| **W3** | **冲突 UX**：列表 / 只读对比 / 恢复（动作 A/B）+ 计数行入口 + 上限提示                                                                          | rd-fe         | W2    | 单测 R-16 + 两端可见面一致                                                                                       |
| **W4** | **多标签 push 单主**（`navigator.locks`）· **偏好面收口**（`T141` + `DP-5`）· **迁移优化 = 不做**（裁定）                                       | rd-fe / rd-be | W1/W2 | 单测 R-14/R-17/R-18 + 收口口径（§9.4.3）                                                                         |
| **W5** | **回归**：§2.5 R-01…R-09 + §9.6 R-10…R-20 + 全范围门禁 8 项 + 移动端 0                                                                          | qa            | W1–W4 | 全仓门禁全绿 + 冲突/多标签实机验证                                                                               |

> **依赖硬约束**：**W1 → W2 → W3**（`stale` 必须先能产生再能展示）；**W2 → W4-偏好**（复用同一版本字段/比较/ journal）；**W0 未完成不得开工 W1**（C-44 协议评审为硬前置）—— **W0 已于 2026-09-24 收口（§9.10 / r4）⇒ W1 已开工**。
>
> **执行状态（2026-09-24，2B 收批，r5 补记）**：**W1–W4 已落地**（服务端 `54e843d`/`ac72a37`；客户端 `5db13f5b`/`355aa7d2`/`5178fe37`/`795f3c13`/`f89d0aea`）；**W5 回归**由 `T169` 终验通过（**AC 6/6 · 阶段一 R-01…R-06 6/6 · R-10…R-20 11/11 · 变异 5/5 · 8 项门禁全绿**）⇒ 详见 `docs/qa/2026-09-24-stage2-2b-acceptance.md` 与台账（本 ADR 只记设计口径）。

### 9.8 明确「不做」清单（本批）

| #   | 不做项                                                    | 理由                                                                                                    |
| :-- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| N1  | **字段级合并**（含字段级版本 / 合并规则 / 字段级挑选 UX） | 与「**服务端给出确定结论**」冲突；需字段级版本 + 合并规则 + UX ⇒ **过度设计**（ADR §2.1 已列 2B+ 可选） |
| N2  | **版本向量（VV）**                                        | 服务端为唯一权威，无多主合并需求（§2.1 既有否决）                                                       |
| N3  | **服务端单调 `version` 列 / DB 迁移**                     | 用 `updated_at` 作令牌已足够（§9.1.1）；避免 DB 迁移（R-14 登记）                                       |
| N4  | **SharedWorker / BroadcastChannel / leader 选举**         | `navigator.locks` 已充分且已验证（§9.3）                                                                |
| N5  | **删除（`deletions`）纳入 OCC**                           | 保持现行软删语义；登记 R-15b                                                                            |
| N6  | **自动合并 / 静默重试覆盖**                               | 违「不丢数据 / 可观测」（PS-14）                                                                        |
| N7  | **迁移优化（全仓测试拆分）**                              | §9.5：无对象 + T119 已证伪全仓 wall 收益                                                                |
| N8  | **移动端任何改动**                                        | 项目红线                                                                                                |
| N9  | **偏好面入业务 `syncQueue`**                              | PS-1/PS-10（合成主键不兼容批量 upsert）                                                                 |

### 9.9 连带同步清单（S 项 + Owner）

| #   | 位置                                                                                                                          | Owner     | 须同步内容                                                                                     | 状态          |
| :-- | :---------------------------------------------------------------------------------------------------------------------------- | :-------- | :--------------------------------------------------------------------------------------------- | :------------ |
| S14 | 本篇（§9 新增 · 头部状态 · 变更记录 r3）                                                                                      | **arch**  | 2B 定向设计落地                                                                                | ✅ 本单       |
| S15 | `docs/adr/README.md`（本篇索引行）                                                                                            | **arch**  | 索引行标注 **r3**                                                                              | ✅ 本单       |
| S16 | `docs/prds/2026-09-23-stage2-local-first-both-ends.md`（§7 AC3/AC4/AC6 · §17/§18）                                            | **PM**    | OCC 契约口径 · 冲突 UX 边界 · 2B 范围（W0–W4）与「不做」清单                                   | ⏳ PM         |
| S17 | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-44 邻接）                                            | **arch**  | 加「2B OCC 为 additive、经 C-44 协议评审」指针（**已批准，r4 落地**）                          | ✅ 本单（r4） |
| S18 | `docs/reports/defect-pool.md`                                                                                                 | **PM**    | 登记 R-3（多标签 push）· R-2 消费 · `T141`/`DP-5` 收口状态 · 删除 OCC 局限                     | ⏳ PM         |
| S19 | `docs/tasks-state.md`                                                                                                         | **PM**    | `T161` 回执 + 2B W0–W4 派单登记                                                                | ⏳ PM         |
| S20 | `nao-todo-server`：`interfaces/types/sync.go` · `interfaces/controllers/sync.go` · `domain/types/upsert.go` · 偏好 controller | **rd-be** | OCC additive（`baseUpdatedAt` / `stale` / `DecideUpsert` base 分支）+ 偏好推送回传 `updatedAt` | ⏳ W1         |
| S21 | `AGENTS.md`                                                                                                                   | **PM**    | 若 2B 新增守卫（冲突 UX 断言 / push 单主断言）则补                                             | ⏳ PM         |

> **Issue 指针**：`#94`（`feat/94-stage2-2b`）—— 正文权威在本篇 §9（**禁双源**）。

### 9.10 DP-2B 裁定（**PM 2026-09-24 拍板 —— 全部采纳 arch 建议**）

| #           | 议题                                                                                | arch 建议                                                                     | **PM 裁定（2026-09-24）**                                                   |
| :---------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **DP-2B-1** | **base 存储**：业务行非索引字段 (i) vs 新 Dexie 表 (ii)                             | **(i)**（不触 C-44 version bump；需 7 域本地写路径保留该字段）                | ✅ **(i)**                                                                  |
| **DP-2B-2** | **OCC 是否全局启用**（业务 7 域全部）vs 仅新写                                      | **全局启用**（base 缺失即 LWW 回退 ⇒ 平滑）；接受 R-16 行为变更（需发布说明） | ✅ **全局启用** + 接受 R-16                                                 |
| **DP-2B-3** | **`Outcome` 表达**：新增 `stale` 值 vs 复用 `conflict` + `reason` 字段              | **新增 `stale`**（可分流；additive）                                          | ✅ **新增 `stale`**                                                         |
| **DP-2B-4** | **R-2 消费范围**：是否同批消费 `error`（**2A 既有窄窗：服务端失败但客户端已出队**） | **同批消费**（否则 R-18 数据丢失风险；闭合 2A 登记）                          | ✅ **同批消费 `error`**                                                     |
| **DP-2B-5** | **journal 上限**：保持 50 vs 提升（如 200）+ 折叠提示                               | **提升 + 折叠提示**（R-15）                                                   | ✅ **50 → 200 + 折叠提示**                                                  |
| —           | **迁移优化**（N7）                                                                  | **本批不做**（§9.5）                                                          | ✅ **本批不做**                                                             |
| —           | **C-44 放行**（`T163` 的 additive 契约）                                            | 按 §9.1「C-44 要点」放行                                                      | ✅ **放行**（不改共享 create DTO · 不新增错误码 · HTTP 200 + 逐条 outcome） |

**W0 收口（2026-09-24）**：C-44 要点已入 r3 + **DP-2B-1…5 全部拍板** + **R-2 消费决策已定**（同批消费 `error`）⇒ **W0 完成，W1 可开工**（§9.7）。**S17 已批准并落地**（阶段一 ADR §2.3-K-5 加指针）。

---

## 变更记录

| 版本 | 日期       | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 作者 |
| :--- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| r1   | 2026-09-24 | 首次评审（`T142`）：6 项结论（Q1 冲突策略 / Q2 回传机制 / Q3 迁移 / Q4 C-59 撤销 / Q5 回归矩阵 / Q6 分期）+ 事实基线（含 **P1 更正：per-row LWW 服务端已实现**）+ 风险 R-1…R-13 + 里程碑 + 连带 S1–S13 + DP-1…DP-4；**⛔ 未改代码**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | arch |
| r2   | 2026-09-24 | **S14=(a) 修订（PM 拍板；arch `T151`）**：§2.6 **W5 说明**改为「**身份域保留离线写闸门**（web 写前拦停 + 明确提示；desktop 远端失败 toast；两者均属可见失败，PS-13 只要求可见）」+ PM 四条理由原样留档 + ⭐ 假信号按域核验结论；§5 **M6** 改为「**闸门作用面收敛至身份域**（组件与 `OFFLINE_READONLY` 保留；原「停用→删除」不成立）」；§2.4 **步骤 5** 收窄为「**业务域闸门条目退役**」+ 同文件旧措辞（Q4 / 保留项 / S7）连带修正；与 C-59 r10「现行口径」块**双向互记**。**⛔ 未改代码**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | arch |
| r3   | 2026-09-24 | **T161（arch，doc-only）—— 阶段二 2B 定向设计（Issue `#94`）**：新增 **§9**（5 项设计 + 事实基线 F1–F10 + 风险增量 R-14…R-20 + 回归矩阵增量 R-10…R-20 + W0–W4 分期 + 「不做」N1–N9 + 连带 S14–S21 + DP-2B-1…5）。**① OCC 契约** = 版本令牌用服务端 `updated_at`（不新增 `version` 列）· push 逐条 additive `baseUpdatedAt`（**缺失即回退现行 LWW**）· `DecideUpsert` 加 base 分支 · **新增 additive outcome `stale`**（与 `conflict` 区分）· HTTP 200 + 逐条 outcome（**不新增错误码**）· 复用 pull 的 per-row `updatedAt` · base 存储 **DP-2B-1 = (i) 业务行非索引字段**（不触 C-44 version bump）。**② 冲突 UX** = 状态面板「冲突 N」入口 + 只读对比（loser vs 当前）+ **恢复只给「保留服务端 / 以我的版本重试」**；自动合并/字段级挑选 = 不做。**③ 多标签** = **`navigator.locks` push 单主**（与 pull 同构；否决 BroadcastChannel/leader/SharedWorker）+ 与 **C-57** 统一为「同 origin 单写者」。**④ 偏好收口** = `T141`（复用同一 per-row 版本字段/比较/journal，**通道仍独立**；服务端 `POST /projects/:id/preference` 需 additive 回传 `updatedAt`）+ `DP-5`（`tagPreference` 入偏好队列、web 撤 `withMirrorFallback`）；**收口口径** = 二者均落地才可称「偏好面全一致」。**⑤ 迁移优化 = 本批不做**（无对象 + T119 已证伪全仓 wall）。**⚠️ 更正 2 处**：`T140`「models 未声明 `updatedAt`」不成立（`ResponseBase` 已声明且已映射）；`T141` 复用 OCC **不涉业务 `syncQueue`**（PS-1/PS-10）。**⛔ 未改代码/测试** | arch |
| r4   | 2026-09-24 | **T161-r4（arch，doc-only）—— DP-2B 全部裁定入档 + W0 收口（PM 2026-09-24 拍板）**：**DP-2B-1** = **(i) 业务行非索引字段 `syncedServerUpdatedAt`**（业务 7 表 + `projectPreferences`；不 bump Dexie version ⇒ 不触 C-44 version bump）· **DP-2B-2** = **全局启用 OCC**（base 缺失 ⇒ 现行 LWW 回退，向后兼容）+ **接受 R-16 行为变更**（⇒ W3 UX 必须同批 + 发布说明登记）· **DP-2B-3** = **新增 additive outcome `stale`** · **DP-2B-4** = **R-2 同批消费 `error`**（闭合 2A 窄窗 R-18）· **DP-2B-5** = **journal 上限 50 → 200 + 折叠提示** · **迁移优化 = 本批不做**（N7 采纳）· **C-44** = **`T163` 的 additive 契约（`baseUpdatedAt` + `stale` 枚举 + 偏好回传 `updatedAt`）按 §9.1「C-44 要点」放行**（不改共享 create DTO、不新增错误码、HTTP 200 + 逐条 outcome）。**S17 批准落地**（阶段一 ADR C-44 邻接加指针）· **W0 收口 = 完成** ⇒ **W1 可开工**；同时**更正变更记录顺序**（r3 误置于 r2 之前 ⇒ 修正为 r1→r2→r3→r4）。**⛔ 未改代码/测试**                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | arch |
| r5   | 2026-09-24 | **T170（arch，doc-only）—— 2B 收批评审的措辞细化（实现事实对齐，⛔ 未改设计结论）**：§9.2.4 标记 **R-15 已落地**（上限 50→200 + `conflictJournalEvictedCount` + `folded`/`foldedReason`，两者同真 ⇒ `evicted` 优先）· §9.3 细化 **journal 专用锁** `nao-todo:journal:${userId}`（`withJournalRmw` 阻塞式 RMW，覆盖 `appendConflict` + 恢复动作 A/B）与 **锁序 pull/push → journal（无反向 ⇒ 无死锁）** · §9.4.1「读时对账」**收窄为「触发点对账」**（读路径本地优先、不得被网络阻塞；PM `T168b`）+ 登记 tag `POST` 不回 `updatedAt` · §9.1.6 补 **实现指针**（`put-with-sync-base.ts` / `putPulledRecord` / `writeBackSyncBase`）· §9.7 补 **W1–W4 执行状态 + W5 终验指针**。**⛔ 未改代码**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | arch |