# 2026-09-24 阶段二：两端同构 local-first（业务数据面）架构评审 —— 结论：**有条件可行**

- **日期**：2026-09-24
- **状态**：⏳ **有条件可行**（**待 PM 拍板 DP-1…DP-4**；无「不可行」项）｜⛔ **纯设计，未改任何代码**（含服务端）
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
| **Q4** | **C-59 撤销路径**     | **分步退役**：① binding 换本地（业务）② 补 `syncTracker.setDirtyListener`（web 当前**缺失**）③ 撤 `decorateUseCase` 写闸门 ④ **写闸门组件退役**（`withReadOnlyGuard` / `OFFLINE_READONLY` / `write-methods`），**`isReadOnly` 保留**（离线 UI 角标 / `offlineEntry` flag 生命周期仍需要）⑤ `markDirty` 语义切换 + 文档/测试口径同步。**顺序不可颠倒**（先换写路径再撤闸门，否则出现无闸门的远端直连写窗口）。                                                                                                                                            |
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

| 步  | 动作                                                                                                                             | 为何在此序                                                   |
| :-- | :------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| 1   | **binding 业务仓储换本地**（7 域）                                                                                               | 先具备本地写能力                                             |
| 2   | **补 web dirty 监听**（`setDirtyListener` + `schedulePush`）                                                                     | 否则本地写**永不回传**（当前 web 缺失，§1.3）                |
| 3   | **撤 `decorateUseCase` 写闸门**（web binding 不再注入 `withReadOnlyGuard`）                                                      | 闸门必须在写路径就绪后撤，否则出现「无闸门的远端直连写」窗口 |
| 4   | **`markDirty` 语义切换 + 口径同步**（C-59/AC10/PRD/AGENTS.md/测试断言）                                                          | 与步骤 3 同批，避免「闸门已撤、不变量未改」的验证空窗        |
| 5   | **写闸门组件退役**（`withReadOnlyGuard` / `OFFLINE_READONLY_ERROR` / `write-methods.ts` / 相关测试）                             | **先停用、后删除**（跨一个发布周期，避免不可逆删错）         |
| 6   | **C-59 / C-66 条款修订**（r10：作用域=业务数据面**阶段一**；C-66「web 不得接本地写仓储」→「阶段二业务面 web **接**本地写仓储」） | 条款是文档事实源，必须与实现同步                             |

**保留项（不得删）**：

- `isReadOnly` / `read-only-state.ts`：仍供**离线 UI 角标**与 `offlineEntry` flag 生命周期（`offline-read-only.ts`）使用 ⇒ **只退役「写拦截」语义**。
- `sync-status-bar.vue` 的离线/镜像/触顶展示（C-60）不变。
- `OFFLINE_READONLY` 退役前须确认**零调用方依赖**（当前仅 `write-gate.ts` 定义 + 测试 + `write-methods` 清单）⇒ 退役安全。
- **`signOut` / 登出清库 / 迁移 / 离线进入 / 镜像读取** 从不受闸门约束（`write-methods.ts:81` 已排除 `signOut`）⇒ 退役后行为不变。

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

> **W5 说明**：`USER_WRITE_METHODS` 退役后不再拦截，离线身份写将**远端失败 + toast**（与 desktop 一致）；**不是** local-first（用户域不在业务数据面）。

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

| 阶段   | 内容                                                                                      | Owner                | 依赖    |
| :----- | :---------------------------------------------------------------------------------------- | :------------------- | :------ |
| **M0** | PM 拍板 DP-1…DP-4 + PRD 口径修订（§5 业务规则 / AC / 范围）+ C-59·C-66 修订定稿           | PM                   | 本 ADR  |
| **M1** | 服务端（**仅**）：`SyncResult.Outcome` additive 字段 + 测试（**若 DP-2 = 纳入**）         | rd-be                | M0      |
| **M2** | 客户端基础件：`getServerTimeOffset` 接线（PS-15）+ 冲突 journal（存储/写入点/计数/UI 行） | rd-fe                | M0      |
| **M3** | web 首拉门（PS-16）+ dirty 监听接线（`setDirtyListener` + push 单主）                     | rd-fe                | M0      |
| **M4** | **W1 任务域**：binding 换本地 + 撤该域闸门 + 回归                                         | rd-fe                | M2/M3   |
| **M5** | **W2/W3/W4**：子实体 / 容器 / 番茄逐波切换 + 回归                                         | rd-fe                | M4      |
| **M6** | 闸门组件退役（停用→删除）+ C-59/C-66 条款 r10 + `markDirty` 口径全量同步                  | rd-fe / PM           | M4/M5   |
| **M7** | 回归：§2.5 矩阵逐项 + 全范围门禁 8 项 + 移动端 0                                          | qa                   | M1–M6   |
| **2B** | OCC per-row 版本 + 冲突 UX + 多标签协调 + `T141`/`DP-5` 收口 + 迁移优化                   | rd-fe / rd-be / arch | 2A 发布 |

---

## 6. 连带同步清单（含 Owner）

> 本评审**改变/更正既有结论**，以下文档与代码须同步（禁只改一处）。

| #   | 文件 / 位置                                                                                                           | Owner      | 须同步内容                                                                                                           |
| :-- | :-------------------------------------------------------------------------------------------------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------- |
| S1  | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 / C-66 / 变更记录 r10）                   | arch / PM  | C-59 作用域加「阶段一」限定 + 指向本篇；**C-66「web 不得接本地写仓储」→「阶段二业务面 web 接本地写仓储」**；追加 r10 |
| S2  | `docs/prds/2026-09-23-stage2-local-first-both-ends.md`（§5/§7 AC/§17）                                                | PM         | 冲突策略（LWW + 时间校准 + journal）、回传（复用 `syncQueue`）、`markDirty` 新语义、首拉门、分期 2A/2B               |
| S3  | `docs/prds/2026-09-23-web-offline-stage1.md`（AC10 / 不变量 ④）                                                       | PM         | 「web 业务 `markDirty` 恒 0」标注为**阶段一**口径；补新不变量指针                                                    |
| S4  | `AGENTS.md`（项目红线 / 门禁口径）                                                                                    | PM         | 若新增守卫（绑定级断言 / 冲突 journal）则补；`markDirty` 口径更新                                                    |
| S5  | `apps/web/src/hooks/usecases/binding.ts`                                                                              | rd-fe      | 业务仓储 `withMirrorFallback` → `newLocal*Repository()`；移除 `decorateUseCase`（写闸门）                            |
| S6  | `apps/web/src/data-plane.ts`                                                                                          | rd-fe      | 补 `syncTracker.setDirtyListener(() => syncService.schedulePush())`；首拉门接线；push 单主                           |
| S7  | `packages/presentation/offline/{write-gate,write-methods}.ts`                                                         | rd-fe      | 先停用后删除；保留 `read-only-state.ts`（UI/flag）                                                                   |
| S8  | `packages/infrastructure/src/persistence-sync/sync-config.ts` + 本地仓储（`repos/*-repo-impl.ts`）                    | rd-fe      | 接线 `getServerTimeOffset`；本地写 `updatedAt` 用校准时间（PS-15）                                                   |
| S9  | `packages/infrastructure/src/persistence-sync/{sync-service,sync-status}.ts` + `db/local-database.ts`                 | rd-fe      | 冲突 journal 写入点/存储/计数（`meta` 纯追加字段）；`SyncResult.Outcome` 消费                                        |
| S10 | `nao-todo-server`：`interfaces/types/sync.go` + `interfaces/controllers/sync.go` + `domain/types/upsert.go`           | rd-be      | `SyncResult` 增 `Outcome`（applied/noop/conflict，additive）；**不改既有 LWW 语义**                                  |
| S11 | 测试：`apps/web/src/hooks/usecases/__tests__/write-gate-wiring.test.ts` + `packages/presentation/offline/__tests__/*` | rd-fe / qa | 闸门测试 → 接线断言；新增冲突 journal / 时间校准 / 首拉门用例                                                        |
| S12 | `docs/tasks-state.md` + `docs/reports/defect-pool.md`                                                                 | PM         | `T142` 结论 + `T141`/`DP-5` 与 2B 关系；标签偏好非 local-first 登记                                                  |
| S13 | `docs/adr/README.md`                                                                                                  | arch       | 本篇索引行 + 篇间关系（↔ C-59 / TASK-26）                                                                            |

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

## 变更记录

| 版本 | 日期       | 变更                                                                                                                                                                                                                                | 作者 |
| :--- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| r1   | 2026-09-24 | 首次评审（`T142`）：6 项结论（Q1 冲突策略 / Q2 回传机制 / Q3 迁移 / Q4 C-59 撤销 / Q5 回归矩阵 / Q6 分期）+ 事实基线（含 **P1 更正：per-row LWW 服务端已实现**）+ 风险 R-1…R-13 + 里程碑 + 连带 S1–S13 + DP-1…DP-4；**⛔ 未改代码** | arch |