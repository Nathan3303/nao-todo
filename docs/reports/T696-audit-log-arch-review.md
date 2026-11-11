# T696 · A 档「变更审计日志」架构评审（11 问 11 答）

- 日期：2026-11-10 · Owner：arch-designer · 级别：**done(full)**
- 载体：分支 `feat/346-audit-log` @ HEAD `c9d373e5`（仅 PRD）· 只读评估（**未改代码 / 未建分支 / 未 commit**）
- 决策落盘：`docs/adr/2026-11-10-audit-log-bypass-log.md`
- 输入：`docs/prds/2026-11-10-audit-log.md`（R-1…R-8 / AC1–AC10）· `docs/prds/2026-11-03-data-sync-a-batch.md` · `docs/adr/2026-11-10-field-level-merge.md` · `docs/reports/671-diff-field-conflict-verdict.md`

## 0. 结论先行

**可行性结论：有条件可行（条件 = C1–C5，均可批内闭合，不需要服务端 / 不需要契约变更 / 不碰移动端）。**

| #      | 条件（不满足则不得开工签字项）                                                                                                                                                                                                               |
| :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | **判据必须锚在「落库前后本地行是否真的变了」**（实体层 `pickChangedFields`），⛔ 不得锚在「调用了一次写」。`DEF-147`（回拉 1s 窗口内未变化行仍重写）会让 30s 自刷新变成"每轮一条空审计"。                                                    |
| **C2** | **收集箱桶必须先归一再比**：本地 `'inbox'` ↔ 服务端隐式桶 `userId`。否则每个收集箱任务**每轮 pull 都会产出一条假的 `projectId` 变更** —— 这是比 `DEF-147` 更容易漏测的假刷屏源（今天 `applyPullBatch` 不比对任何东西，所以既有用例抓不到）。 |
| **C3** | **值形状 = 同步边界（实体明文）**，⛔ 不落记录层 `plain:<明文>`（`T676` 教训：UI 会显示 `plain:买牛奶`，且两侧形状不同会让判等恒假）。                                                                                                       |
| **C4** | **`R-7`「零新 i18n 键」不可行**（事实纠正，见 Q8）：字段名可复用 `conflict-field-labels`，但**面板框架文案**（标题 / 空态 / 来源 / 动作 / 更早）无处可复用，需新增约 9–13 个键。PRD 须由 PM 修正后再生效。                                   |
| **C5** | **`≤2 MB` 只在加「单条字节预算」后成立**：1000 条 × 多字段 × 2 值 × 512 字符上限的理论上界 ≈ 3 MB。需新增 `AUDIT_ENTRY_BYTE_BUDGET`（建议 1 KB）+ 断言。                                                                                     |

**不走的两条路（结论性排除）**：① 用 `meta` 单记录数组（`conflict-journal` 同型）—— 每次写要 RMW 整块且**无法走索引**取"按实体最近 N 条"，200 条就是它的容量天花板，1000 条量级不适用；② 独立第二库 —— 只为守住"回滚=清表"而引入长期双库成本，而 `dexie@4.4.5` 已消除"降级打不开库"的硬故障（参考来源 1），收益不对称。

**工期：7–8 人天（中位 ≈7.5）**。`5 人天` 不可信（拆解见 §10）；砍到 6.5 的唯一安全项是"更早"分页降级为"最近 5 条 + 条数提示"。

---

## 1. 读码确证的事实基线（后面所有结论的落点）

| 事实                                        | 证据（文件:行）                                                                                                                                                            |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dexie 当前最高版本 = **v4**，隐含全表清单   | `packages/infrastructure/src/persistence-local/db/local-database.ts:434-455`（v1 375 / v2 390 / v3 418 / v4 434）                                                          |
| `dexie@4.4.5`（≥4.0.1 ⇒ 降级会被静默适配）  | `package.json:28`、`packages/infrastructure/package.json:19`；行为见参考来源 1                                                                                             |
| 业务实体写入的**唯一两个助手**              | `persistence-local/repos/put-with-sync-base.ts:18-31`（`putWithSyncBase`，会先 `get` 旧行取 base）、`:44-63`（`putWithSyncBaseAndEnqueue`，行+入队同一事务）               |
| tasks 本地写点共 **9 处**                   | `task-repo-impl.ts`：create 129、update 185、remove 218、cascadeRemove 256/276/295、restore 313、unarchive 367、copy 542、snooze 569；级联 `project-archive-cascade.ts:73` |
| pull 落库 4 个分支                          | `sync-service.ts`：远端胜 1487、远端墓碑 1508、本地未改 1543（事务内 `rawTable.put`）、字段级合并 1455→`applyPullFieldMerge` 854-871                                       |
| push `stale` 合并落库                       | `sync-service.ts:1918`→`applyPushFieldMerge` 963，落库判据 `businessChanged                                                                                                |     | baseChanged` 995-1040 |
| 冲突重试落库                                | `conflict-journal.ts:706`（`config.putRecordAndEnqueue` → `putWithSyncBaseAndEnqueue`），注册表 `conflict-entity-registry.ts:106-116`                                      |
| 「用云端的」真写回                          | `conflict-journal.ts:526-…`（`resolveConflictKeepServer`，`stale` 且有 `serverCurrent` 时写回本地行）                                                                      |
| 回拉窗口 = **1s**                           | `sync-service.ts:343`（`PULL_BACKTRACK_MS`），每轮从 `cursor-1s` 重拉 ⇒ `DEF-147` 的实际触发面                                                                             |
| 判等唯一口径 / 忽略集唯一来源               | `persistence-sync/sync-compare.ts:31-45`（`valuesEqual`，空哨兵归一）；`sync-normalize.ts:22-29`（`SYNC_COMPARE_IGNORED_FIELDS`）                                          |
| 挑差异字段的现成原语                        | `persistence-sync/edit-overwrite.ts:24-41`（`pickChangedFields`）                                                                                                          |
| 基准捕获同族原语                            | `persistence-sync/field-base.ts:29-54`（`captureFieldBase`，同样 `valuesEqual` + 忽略集）                                                                                  |
| 明文自描述前缀                              | `persistence-local/crypto/crypto-service.ts:15-19`（`PLAIN_PREFIX='plain:'`，`encrypt` 直通）                                                                              |
| 快照截断常量 / 双标记                       | `conflict-journal.ts:41`（`CONFLICT_SNAPSHOT_TEXT_LIMIT=512`）、`:61-80`（`buildConflictSnapshot` → `truncated` + `truncatedFields`）                                      |
| 清库链路（按 `userId` 清表，名单显式）      | `persistence-local/deletion/deletion-service.ts:72-106`（`BUSINESS_TABLES` + `meta`/`syncQueue`/`syncCursor`）                                                             |
| 结构化日志（固定事件名、禁 PII）            | `observability/structured-log.ts:41-78`（`STRUCTURED_LOG_EVENTS`）                                                                                                         |
| 详情面板主体（可插入点）                    | `packages/presentation/task/components/task-details/main/index.vue:144-150`（`<details-main-events />` 区块）                                                              |
| presentation **零** import infrastructure   | 全仓 `grep '@nao-todo/infrastructure' packages/presentation`（非测试）＝ 0 命中 ⇒ 必须 DI                                                                                  |
| 端侧唯一 `provide` 点（web + desktop 共用） | `apps/web/src/App.vue` → `apps/web/src/app.ts`；desktop `AppRoot.vue:3` import `@/App.vue`，`electron.vite.config.ts:49` 把 `@` 指向 `apps/web/src`                        |
| 设备标识                                    | `packages/shared/utils/device-id.ts:11,31`（`nao.deviceId`）、`packages/shared/requester/axios.ts:69`（`X-Device-Id`）                                                     |

### 1.1 数据流（组件与交互）

```text
           ┌──────────────── 业务写（9 处） ─────────────────┐
本机编辑 ──┤ putWithSyncBase / putWithSyncBaseAndEnqueue       │
           │ （任务仓储 / 级联归档 / 冲突重试）               │
           └───────────┬──────────────────────────┬──────────┘
                       │ 写前实体 before           │ 写后实体 after
                       ▼                           ▼
              ┌──────────────────────────────────────────┐
              │ diffAuditFields(before, after)           │  ← 复用 pickChangedFields
              │  · valuesEqual（唯一判等）               │    + SYNC_COMPARE_IGNORED_FIELDS
              │  · 空集 ⇒ 不记账（这就是 DEF-147 的挡板）│
              └───────────────┬──────────────────────────┘
                              │ 1 次 add（每实体 1 条）
 云端同步 ────────────────────┤
  · pull 4 分支（1487/1508/1543/合并）                          ▼
  · push-merge（995-1040）            ┌────────────────────────────────┐
    ① 记录层预筛（零解密，挡 DEF-147）│ auditLogs（Dexie v5 新表）     │
    ② 实体层归一（toLocalProjectId）  │ ++seq / [userId+entity+…]      │
    ③ 实体层精筛 + 取值（明文）       │ [userId+at]                    │
                                      └──────┬───────────────┬─────────┘
                                             │ 单飞异步裁切   │ 读：keyset(=seq) 分页
                                             ▼                ▼
                              1000 条 / 90 天 / 1 KB    task-details「变更历史」
                              （启动 + 追加后，不阻塞）  （nue-collapse 默认折叠）
```

---

## 2. Q1 · 数据模型与迁移

**结论：同库新表 `auditLogs` + `version(5)`（只增表）；不写 `.upgrade()`；读取路径双层兜底。**

### 2.1 表结构

```ts
// local-database.ts 新增（与既有 Record 接口并列）
export interface AuditFieldDiff {
    field: string
    from: unknown
    to: unknown
}
export interface AuditLogRecord {
    /** 自增主键 = 插入序（同毫秒亦有稳定序；不拿业务时间戳排序） */
    seq?: number
    userId: string
    entity: string // 'tasks'（R-8）
    entityId: string
    action: 'create' | 'update' | 'archive' | 'unarchive' | 'delete' | 'restore'
    source: 'local-edit' | 'pull' | 'push-merge' | 'conflict-retry'
    /** 字段级 diff；非 update 类为空数组（AC7：墓碑/归档不产"字段变更"噪声） */
    fields: AuditFieldDiff[]
    at: string // 写审计时的本机校准时间（⛔ 不是行的 updatedAt —— 远端时间戳会漂）
    truncated?: boolean
    truncatedFields?: string[]
}

// version(5)：v4 全表清单逐字不改，只追加一行
this.version(5).stores({
    /* …v4 的 15 个表逐字节照抄… */
    auditLogs: '++seq, userId, [userId+entity+entityId], [userId+at]'
})
```

### 2.2 为什么这样索引

| 索引                       | 支撑的查询                                                                             | 依据                                                                                                                                                                                   |
| :------------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[userId+entity+entityId]` | 「按 entityId 取最近 N 条」：`where(idx).equals([u,'tasks',id]).reverse().limit(N)`    | IndexedDB 索引记录**按索引键排序、同键按主键排序** ⇒ 该索引键对所有命中行相同 ⇒ 迭代序退化为 `seq` 序，`reverse()` 即"最新在前"，**不需要把 `seq` 塞进复合索引**（也不必读出后再排序） |
| `[userId+at]`              | ① 90 天界淘汰 `between([u,minKey],[u,cutoff])` ② 取最旧 `(count-1000)` 条 ③ 每用户计数 | 淘汰必须**按时间**而非插入序（时钟只前进不回退，插入序与时间序在本机一致；用 `at` 让"保留期"语义可读、可审计）                                                                         |
| `userId`                   | 清库（`wipeUserData` 用 `.where('userId').equals(u).delete()`）、每用户 `count()`      | 与既有 11 张表同一清库口径（deletion-service.ts:87-97）                                                                                                                                |

不做 `entityId` 单列索引：雪花 ID 全局唯一，但本项目**一切读路径先按 `userId` 隔离**（C-55 硬失败口径），单列索引会引入"跨用户读"的可能，换来的是省一次 filter 的微小收益。

### 2.3 幂等迁移怎么写

- **只增表 ⇒ 不写 `.upgrade()`**。Dexie 在新版本里发现"新表未在旧 schema 出现"会自动 `createObjectStore`，无数据搬迁 ⇒ **空升级**；同一版本重复 `open()` 不触发 upgrade ⇒ 天然幂等。
- **⛔ 不要写 `upgrade(tx => tx.table('auditLogs').count())`**（无意义、且会让"空升级"变成有副作用的升级）。
- **⛔ 不要把 `auditLogs` 加进 `BUSINESS_TABLES`**（local-database.ts:337）：该常量被 `wipeUserData` 与 `apps/web/src/views/auth/offline-prerequisites.ts:54`（离线进入门：有业务数据才允许离线进入）共用，加进去会改变离线门的语义。清库用**显式名单**追加（Q7/§11）。
- 需要 `.upgrade()` 的唯一情形 = 将来给**既有表**加索引 —— 本档不涉及。

### 2.4 失败如何回滚

| 阶段          | 失败表现                                     | 回滚/兜底                                                                                                                                                                               |
| :------------ | :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open()` 升级 | IDB 版本事务 abort ⇒ 库停在 v4，业务数据零损 | 复用既有「DB 失败 ≠ 凭证失败」口径（`docs/adr/2026-11-10-db-failure-not-credential-failure.md`）：呈现"本地数据不可用"而**不登出**                                                      |
| 写审计        | `add` 抛错（配额/连接关闭）                  | `recordAudit` 内部 catch → `logStructured('error', AUDIT_RECORD_FAILED, {table,entityId,reason})`；**业务写已提交、不回滚**（R-1）                                                      |
| 读审计        | 表缺失 / 版本被旧标签页 patch                | `listAuditEntries` 外层 try/catch ⇒ 返回 `{items:[], hasMore:false, unavailable:true}` ⇒ 面板走空态，⛔ 不显示错误（PRD NFR「老数据无审计 ⇒ 暂无记录」）                                |
| 产品回滚      | 需撤掉能力                                   | ① 一级：开关关闭写入（保留读）② 二级：`clearAuditLog(userId)` 清表 ③ 三级：降级到上一版构建 —— `dexie@4.4.5` 会用已安装版本静默适配（参考来源 1），**但必须有用例实测**（见 §9 变异 7） |

### 2.5 「老库无表」时的读取路径

- 正常路径下 **v5 打开后表恒存在**（哪怕从未写过），因此"无表"只发生在两种情况：① 旧标签页持有连接、库里被 Dexie "schema patch" 加了表但版本号未变；② 未来降级构建的读路径。
- 兜底判据：`localDatabase.tables.some(t => t.name === 'auditLogs')`（模块级记忆化），false ⇒ 读 API 直接返回空、写 API 直接 no-op（不抛错）。

---

## 3. Q2 · 写入点与「一次写 = 1 条」

**结论：4 类来源 = 9（local-edit）+ 4（pull）+ 1（push-merge）+ 2（conflict-retry）= 16 个落点；统一规则「写前算 diff（实体层）→ 写后 `add` 一次」，且**按实体**计数。**

### 3.1 落点表（文件:行）

| 来源                     | 落点                                   | 行号                               | action 派生                                               | 备注                                                                                      |
| :----------------------- | :------------------------------------- | :--------------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `local-edit`             | `LocalTaskRepoImpl.create`             | 100-141                            | `create`                                                  | `fields: []`（新建不产字段噪声）                                                          |
| `local-edit`             | `.update`                              | 143-208                            | `update`（若载荷改 `archivedAt` ⇒ `archive`/`unarchive`） | 写前已有 `entityBefore`（165）与 `cloudFields` ⇒ **零额外解密**                           |
| `local-edit`             | `.remove`                              | 211-236                            | `delete`                                                  | 只记 action，`deletedAt` 不进 `fields`（AC7）                                             |
| `local-edit`             | `.cascadeRemove`（子任务/检查项/评论） | 239-303                            | `delete`                                                  | 仅 `tasks` 记账（`R-8`）；子实体本批不记                                                  |
| `local-edit`             | `.restore`                             | 306-325                            | `restore`                                                 | 只记 action                                                                               |
| `local-edit`             | `.unarchive`                           | 343-385                            | `unarchive`                                               | 若同时 `projectId` 变化（回收集箱）⇒ `fields` 只含 `projectId`                            |
| `local-edit`             | `.copy`                                | 514-554                            | `create`                                                  | 新实体                                                                                    |
| `local-edit`             | `.snooze`                              | 556-580                            | `update`                                                  | 提醒组字段（`remindAt` 等）走 `fields`                                                    |
| `local-edit`             | `cascadeProjectArchive`（每个 task）   | `project-archive-cascade.ts:46-88` | `archive`/`unarchive`                                     | 单事务内 N 实体 ⇒ **N 条**（每实体 1 条）；记录层即可（只改 `archivedAt`，`fields` 为空） |
| `pull`                   | `applyPullBatch` 远端胜                | 1487                               | 按状态字段派生                                            | 写前已读 `localRecord`（1480）⇒ diff 零额外 IO                                            |
| `pull`                   | `applyPullBatch` 远端墓碑              | 1508                               | `delete`/`archive`                                        | 同上                                                                                      |
| `pull`                   | `applyPullBatch` 本地未改              | 1543（事务内）                     | 按 diff 派生                                              | **必须**在事务内 `rawTable.get(id)` 取旧行（现无此读，需加）                              |
| `pull`                   | `applyPullFieldMerge`                  | 854-871（`businessChanged`）       | `update`                                                  | 已有 `local` 与 `mergedFields` ⇒ 直接复用                                                 |
| `push-merge`             | `applyPushFieldMerge`                  | 995-1040（`businessChanged`）      | `update`                                                  | 已有 `local` 与 `mergedFields`；`aborted` 分支（1041 前）⛔ 不记                          |
| `conflict-retry`         | `resolveConflictRetryLocal`            | `conflict-journal.ts:706`          | `update`（或 `restore`）                                  | 值来源 = `entry.loser`（**已是实体明文**）+ `previousRecord` 转实体                       |
| `conflict-retry`（同族） | `resolveConflictKeepServer`            | `conflict-journal.ts:566-…`        | `update`/`restore`                                        | 「用云端的」= 内容来源为云端 ⇒ 映射 `source='pull'`（见 §13 D3）                          |

### 3.2 怎么保证「同一次写 = 1 条」而不产生 N 条

1. **一次调用只 `add` 一次**（不是"逐字段 add"）：`fields` 是数组，N 个字段仍是 1 行。
2. **多字段来源只有一个**：`pickChangedFields(before, after)` 返回字段集，`to = after[f]`、`from = before[f]`，不存在"两次遍历各记一次"。
3. **合并落库分支已有天然守卫**：`businessChanged` 为 false ⇒ 0 条（`applyPullFieldMerge:831`、`applyPushFieldMerge:995`）；`aborted` ⇒ 0 条（`sync-service.ts:1928` 的 `continue`）。
4. **批量 = 按实体计数**（不是"按用户手势"）：清单归档级联 30 个任务 ⇒ 30 条，但每条只出现在**它自己**任务的「变更历史」里 ⇒ 不是刷屏。**PRD AC6 的「不刷屏」须收窄为**「同一实体的一次写不产生 N 条」——这是本评审要求 PM 明确的口径（§13 D4）。
5. **守卫（源级）**：`recordAudit` 是唯一写入口（模块导出单一函数），且全仓 `auditLogs.add(` 只允许出现在该模块（可用 grep 断言）；`appendConflict` 与 `recordAudit` 不得互相调用（防一次写两条）。

### 3.3 失败只 log 不阻断的具体位置

- 位置：`persistence-sync/audit-log.ts` 的 `recordAudit()` 内部 `try { … } catch (err) { logStructured('error', STRUCTURED_LOG_EVENTS.AUDIT_RECORD_FAILED, { table, entityId, reason: String(err) }) }`，**函数自身永不 reject**。
- 调用处一律 `void recordAudit({...})`（或 `await` 但保证不抛）——与既有 `recordEditOverwrite`（`edit-overwrite.ts:96-113`）**完全同姿态**，这是本仓已验证过的"旁路记账不阻断保存"范式。
- ⛔ 不得把 `recordAudit` 放进 Dexie 事务（`db.transaction` 内 await 外部 Promise 会 `PrematureCommitError`）；因此**审计不在业务事务内**，业务提交成功后才 add。
- ⛔ 不得为了「原子」把 `auditLogs` 加进业务事务的表清单：每个业务写点的 `db.transaction('rw', table, db.syncQueue, …)` 都要加表 ⇒ 触碰十余个事务边界，风险远大于收益；且 PRD 允许"紧随其后"。

---

## 4. Q3 · ⚠️ 防刷屏（本档最大陷阱）

**结论：判据 = `pickChangedFields(落库前实体, 落库后实体)` 非空；且必须**两级筛选**（记录层预筛 + 实体层精筛）并**先做收集箱桶归一**。**

### 4.1 为什么"按 put 计数"必然失控（三重来源）

1. **`DEF-147`**：每轮 pull 从 `cursor-1s` 回拉（`sync-service.ts:343`），`applyPullBatch` 在"本地未改"分支**无条件 `put`**（1543）；自动刷新 30s 一轮 ⇒ 回拉窗口内的行每轮都被重写。
2. **收集箱桶映射**（更隐蔽）：服务端用隐式桶 `userId` 承载收集箱，本地字面 `'inbox'`（`sync-normalize.ts:86-91`）；`valuesEqual('inbox','<userId>')===false` ⇒ 若不归一，**每个收集箱任务每轮 pull 都会产出一条假的 `projectId` 变更**（`projectId` 不在忽略集里）。今天 `applyPullBatch` 什么都不比，所以**既有 3000+ 用例全绿也抓不到它**。
3. **数组字段按 JSON 序比较**：`tags` / `remindWeekdays` 由 `valuesEqual` 走 `JSON.stringify`（`sync-compare.ts:42-44`）⇒ 服务端返回的元素顺序与本端不同即判"变更"。这不是假变更（库里确实变了），但会产生用户看不懂的"顺序变更"条目（§13 D5）。

### 4.2 判据设计（可断言）

```ts
// audit-log.ts（纯函数，无 IO）
export const diffAuditFields = (before: object, after: object): AuditFieldDiff[]
// 实现 = pickChangedFields(before, after)（edit-overwrite.ts:24-41）
//        + 逐字段取 before[f] / after[f]；⛔ 不新造忽略集/判等

// pull 侧两级筛选（bolt-on，不改 DEF-147 的写行为）
// ① 记录层预筛（零解密）：pickChangedFields(existingRecord, nextRecord).length === 0 ⇒ 无审计，直接返回
// ② 实体层精筛（仅预筛非空时）：recordToEntity(existingRecord) / recordToEntity(nextRecord)
//    ⇒ diffAuditFields(实体前, 实体后)，非空才 add（值取自实体 = 明文）
```

- 第 ① 级把 `DEF-147` 的主流量（每轮数百行的**相同**记录）挡在解密之外；第 ② 级保证「值形状」与「判等口径」都是实体层（`T676` 教训）。
- 本地写路径（9 个落点）**已有实体前后**，直接走 `diffAuditFields`，零额外读零解密。
- **`at` 用写入时刻的 `nowCalibratedIso()`，⛔ 不用行的 `updatedAt`**：pull 行的 `updatedAt` 是服务端时间（可能超前/时区不同），拿它排序会让"最近 N 条"错位。

### 4.3 用例如何证明"每 30s 自动刷新但内容没变 ⇒ 0 条"

| 用例                      | 构造                                                                                                                       | 断言（全部可自动化）                                                                                                                              |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A（`DEF-147` 主流量）** | 真仓储 + 真 `SyncService.pullAll` + 假服务端；同一任务连拉 **2 轮**，服务端两轮都返回该行且 `updatedAt` 落在 1s 回拉窗口内 | 第 2 轮 `tasks.put` 调用数 **≥1**（证明 `DEF-147` 仍在） **且** `auditLogs.count()===0`（证明审计不挂 `put`）                                     |
| **B（收集箱桶）**         | 任务 `projectId='inbox'`，服务端返回 `projectId=<userId>`，拉 1 轮                                                         | `auditLogs.count()===0`；**变异**：删掉 `toLocalProjectId` 归一 ⇒ 该例必红                                                                        |
| **C（真变更）**           | 服务端把 `description` 改成新值，拉 1 轮                                                                                   | 恰 **1 条**、`source='pull'`、`fields` 恰含 `description`（`from`=旧明文、`to`=新明文），**不含** `updatedAt`/`projectId`/`syncedServerUpdatedAt` |
| **D（空哨兵）**           | `'' → null → undefined → []` 互转                                                                                          | 0 条（`valuesEqual` 归一）；**变异**：换 `!==` ⇒ 必红                                                                                             |
| **E（时钟）**             | 服务端 `updatedAt` = 未来 1 小时                                                                                           | `at` 仍是本机时间且落在 `[now-5s, now+5s]`（`at` 不取行时间）                                                                                     |

> 口径纪律：A/B 两条**必须同时存在**才能声称"防刷屏"——一条只挡 `DEF-147`（相同记录），另一条才挡"记录不同但业务等价"（桶映射）。

---

## 5. Q4 · 值形状（`T676` 教训重放）

**结论：存同步边界（实体明文），⛔ 不存记录层 `plain:<明文>`。**

- 事实：`tasks.name` / `description` 落库为 `plain:<明文>`（`crypto-service.ts:15-19`）；记录层 vs 实体的**形状不同**（`docs/adr/2026-11-10-field-level-merge.md` §实施口径补充已验证：`valuesEqual('plain:A0-name','A0-name')` 双向 false）。
- 后果若搞错：① 界面显示 `plain:买牛奶`（直接违反 C 端「说人话」）；② 若记录层捕获做判等，**每次 pull 都会判"文本字段变了"**（形状恒不等）⇒ 与 `DEF-147` 叠加成永久刷屏。
- 三道守卫：
    1. **类型/注释**：`AuditFieldDiff.from/to: unknown` 只能填实体层值；模块头注释写明禁令（与 `field-base.ts:12-16` 同款）。
    2. **源级守卫（新用例）**：`audit-log.ts` 不得 import `crypto-service` / `converters/*`；文件内不得出现 `PLAIN_PREFIX` 或字面量 `'plain:'`。
    3. **行为用例（`T676` 重放）**：改 `name: 'A'→'B'` ⇒ 审计 `from==='A'`、`to==='B'`，且 `JSON.stringify(entry)` **不含** `plain:`。
- pull 侧天然满足：`resToEntity`（服务端行→实体）与 `recordToEntity`（本地行→实体）两侧都是明文实体。

---

## 6. Q5 · 与既有机制的边界

| 机制                                                            | 边界（一句话）                                                                                                                                                                                                                                           | 接线要求                                                                                                                                                                                                                                                                         |
| :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conflict-journal`（`conflict-journal.ts`）                     | **用途不同**：journal = "待处置的冲突败方"（用户要决策）；审计 = "已发生的变更"（只读）。**淘汰策略不同**：journal 200 条 + 按 kind 优先级；审计 1000 条 + 按时间。**去重不同**：journal 的 `pull-local-wins` 会 `occurrences += 1` 折叠；审计必须逐条。 | ⛔ 不复用表/淘汰/去重；⛔ 不把审计塞进 `MetaRecord`。可复用的只有 **常量 512** 与 **`truncated`/`truncatedFields` 语义**（建议抽成共享原语，避免第二个 512 字面量）。                                                                                                            |
| `edit-overwrite.pickChangedFields`（`edit-overwrite.ts:24-41`） | **可复用、且应复用**：它就是"两侧键并集 − 忽略集 + `valuesEqual`"，与审计需要的"哪些字段变了"完全同构。                                                                                                                                                  | 审计的 `diffAuditFields` = `pickChangedFields` + 取值。⛔ **不加第五套忽略集** —— 守卫：全仓 `SYNC_COMPARE_IGNORED_FIELDS` 只允许 1 处 `new Set(` 声明 + 1 处 `===` 引用（源级断言）。顺带建议（不属本档）：把 `captureFieldBase` 也改为委托同一 diff 原语，结构上杜绝口径漂移。 |
| `structured-log`（`observability/structured-log.ts`）           | **只记失败事件与计数，不记业务值**。审计表才是业务值载体；日志仅用于"审计写失败/被裁掉多少条"。                                                                                                                                                          | 新增事件常量 2 个：`AUDIT_RECORD_FAILED`（`audit.record.failed`：`table`/`entityId`/`reason`，⛔ 无值）、`AUDIT_ENTRY_EVICTED`（`audit.entry.evicted`：`count`）。`redactSensitive` 只作兜底，不能当"值过滤"用。                                                                 |

---

## 7. Q6 · `deviceId`

**结论：PM 的简化不仅"够用"，而且是**唯一不制造假精度**的选择 —— 首版不引入任何新设备标识，只保留 `source` 二元语义（本机 / 云端）。**

### 7.1 现有事实

| 概念           | 是什么                                                                                       | 证据                                                                                             |
| :------------- | :------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `localSession` | **当前登录用户** ID（内存 + 从 JWT 解析；无会话则库操作硬失败）                              | `persistence-local/session/local-session.ts:47-79`                                               |
| `userSessions` | **服务端**登录会话表（按 `X-Device-Id` 绑定，用于"同设备重复登录覆盖旧会话"）                | 客户端只发头：`packages/shared/requester/axios.ts:69`；模型见 `persistence-go/models/user.ts:44` |
| 稳定设备 ID    | **有**：`nao.deviceId`（随机 UUID，惰性生成、登出不清、`localStorage` 不可用时降级为进程内） | `packages/shared/utils/device-id.ts:11,31,53-60`                                                 |

### 7.2 为什么首版不需要它

1. 审计日志是**纯本机表**（不上报、不参与同步）⇒ 每一行的写者必然是"本机" ⇒ `deviceId` 是同义反复（信息量为 0，占 36 字节 × 1000 行）。
2. 用户真正要区分的是"**我改的** vs **云端带下来的**"，这正是 `source` 的语义；再细一层（"是哪台设备改的"）在本机日志里**永远无法回答**（对方设备根本不会写这张表）。
3. `nao.deviceId` 虽稳定但有真实漂移面：隐私模式 / 清站点数据 / 换浏览器 profile ⇒ 新 ID。用它做分组会制造"同机多设备"的假象，比不记更糟。

### 7.3 隐患（须写进 ADR/文档，不阻断本档）

- 将来接**服务端侧审计**或**跨端合并审计**时，需要新增字段（`deviceId` 或服务端 `actor`），**历史行无法回填** ⇒ 那段时间的归属永久不可追溯（与 PRD §九「已知不关闭」同类）。
- 用户若问"哪台设备"，今天必须回答"只能看出是本机还是云端"；文案不要暗示能区分设备。
- 若日后要区分"其它浏览器"，正确来源是**服务端** `user_sessions`（已有），不是本地随机 ID。

---

## 8. Q7 · 有界淘汰

**结论：条数 1000 / 保留 90 天 / **单条字节预算 1 KB**；裁切 = 追加后单飞异步 + 启动一次，不阻塞保存。**

### 8.1 实现位置与判据

```ts
// persistence-sync/audit-log.ts
export const AUDIT_LIMIT = 1000
export const AUDIT_RETENTION_DAYS = 90
export const AUDIT_ENTRY_BYTE_BUDGET = 1024          // 新增（PRD 缺口，C5）
export const AUDIT_VALUE_TEXT_LIMIT = CONFLICT_SNAPSHOT_TEXT_LIMIT  // 复用 512，⛔ 不写字面量

const pruneAuditLog = async (userId: string): Promise<number> // 返回实际删除条数
// ① 时间界：where('[userId+at]').between([u, minKey], [u, cutoffIso]) → primaryKeys() → bulkDelete(分块 200)
// ② 条数界：count() > AUDIT_LIMIT ⇒ 取最旧 (count - AUDIT_LIMIT) 个（同索引升序）删除
// 全程只在 auditLogs 单表事务内
```

- **触发点**：① 每次 `recordAudit` 成功后 `void schedulePrune(userId)`（模块级 `Map<userId, Promise>` 单飞 + 500ms 防抖，**同一用户不并发裁切**）；② `bootstrapLocalData` 之后一次（清掉上次异常退出残留）；③ 导出 `pruneAuditLogNow(userId)` 供测试与回滚脚本。
- **会不会卡 UI**：写入路径**不 await** 裁切；裁切只在 1000 行内做索引键扫描 + 分块删除（毫秒级）。最坏情况（用户连续 1000 次保存）也只有 1 次实际删除。
- **为什么不在业务事务内清理**：会与"审计不进业务事务"（Q2）冲突；且清理失败不应影响任何业务写。

### 8.2 单条 `fields` 截断（复用 journal 口径）

- 值级：`typeof value === 'string' && value.length > 512` ⇒ `slice(0,512)` + 收集字段名 ⇒ 与 `buildConflictSnapshot`（`conflict-journal.ts:61-80`）**同一语义**：`truncated: true` + `truncatedFields: string[]`。建议把该段抽成共享原语 `truncateTextValues(entries)` 供两处调用（⛔ 不新增 512 字面量）。
- 条目级（新增）：序列化长度 > `AUDIT_ENTRY_BYTE_BUDGET` ⇒ 按**合并域字段顺序**逐个把 `from/to` 降级为 `'[已截断]'` 直到进入预算，置 `truncated`。理由见 C5：`1000 × 3 字段 × 2 值 × 512` 的理论上界 ≈ 3 MB，破 PRD 的 ≤2 MB。

---

## 9. Q8 · 界面

**结论：落 `packages/presentation/task/components/task-details/main/`（新 `history.vue`）+ 端侧**一处** `provide`；默认折叠用 `nue-collapse`；三态一律 `LoadingError`；**零新 i18n 不可行**。**

- **落点**：`main/index.vue` 在 `<details-main-events />`（144-150 区块）之后插入 `<details-main-history />`；组件文件 `main/history.vue`（新），`index.ts` 导出；默认折叠 = `<nue-collapse :model-value="[]">`（`NueCollapse`/`NueCollapseItem` 已随 `nue-ui` 提供，参数见 `node_modules/nue-ui/dist/types/components/collapse/types.d.ts`：`modelValue?: string[]` / `accordion?`）。搜索页侧栏已用同款组件（`docs/adr` 2026-09-21 记录：`nue-collapse` + `theme="menu"`），用法有先例。
- **数据注入（分层红线）**：`packages/presentation` 对 `@nao-todo/infrastructure` **零 import**（全仓事实）⇒ 在 `task-details/context.ts` 新增 `TASK_HISTORY_CONTEXT_KEY`（接口只暴露 `load(taskId, cursorSeq?)`），由端侧 `provide`：
    - `apps/web/src/app.ts`（`App.vue` → `useApp()`，desktop 经 `electron.vite.config.ts:49` 的 `@` alias 复用同一个 `App.vue`）**一处 provide** ⇒ web + desktop 同时生效；
    - 实现新 hook `apps/web/src/hooks/use-task-history.ts`（对齐 `use-conflict-ux.ts` 直连 infrastructure 读 API 的既有先例）；
    - provider 缺省 ⇒ 区块 `v-if` 不渲染（不报错），移动端天然零改动（`packages/presentation-react` 不走这里）。
- **分页**：`seq` keyset 游标（`beforeSeq`），默认 5 条 → 「更早」每次 +10；⛔ 不用 offset（插入序会漂）。「更早」按钮带剩余条数（复刻 `offline.coverage.truncated` 的交互口径）。
- **三态**：`<loading-error :loading :error :empty>`（`packages/shared/components/loading-error`，`DESIGN.md` §4.1 硬规则）—— 空态文案必须是新的「暂无变更记录」（`sync.conflict.empty` = "暂无冲突记录"，语义错，⛔ 不复用）。
- **C 端形态**：日期分组（今天 / 昨天 / 更早）+ 时间线卡片，每条 = 「时间 · 来源标记 · 字段：旧值 → 新值」，⛔ 不用 `nue-table`（冲突面板用表是"左右对照"语义；历史是单向事件流）；条目点击区 ≥40px；来源用「颜色 + 符号 + 文字」三重冗余（AGENTS.md 三态可辨性）；对比度按卡片真实底色 ≥4.5:1（`DESIGN.md`）。
- **零新 i18n 可行性 = 否（事实纠正 C4）**：字段名可 100% 复用 `FIELD_LABEL_KEYS`（`apps/web/src/components/sync/conflict-field-labels.ts:14-58`，40+ 字段，已覆盖 `tasks` 全部字段）；但面板框架文案无处可复用。最小键集（zh / en / `types.ts` 三处齐备，死键守护会校验）：

```text
history.title            变更历史 / Change history
history.empty            暂无变更记录 / No changes yet
history.loadFailed       变更记录加载失败 / Could not load change history
history.more             更早的记录 / Show earlier
history.source.local     本机修改 / Edited on this device
history.source.pull      同步自云端 / Synced from cloud
history.source.pushMerge 已合并云端修改 / Merged cloud changes
history.source.conflictRetry 恢复了我的修改 / Restored my version
history.action.create    创建 / Created
history.action.archive   归档 / Archived
history.action.unarchive 取消归档 / Unarchived
history.action.delete    删除 / Deleted
history.action.restore   恢复 / Restored
```

⇒ **13 个键 × 2 语言**。可压到 ~9（动作名复用 `sync.conflict.field.*`），但会出现"归档状态"当动作名的语病，**不建议压**。R-7 须由 PM 改写为「复用字段标签，允许 ≤13 个面板框架键」。

---

## 10. Q9 · 红基线 + 变异点

### 10.1 AC1–AC10 的可自动化判据

| AC   | 可自动化判据（文件 / 断言）                                                                                                                                                                                                                                         |
| :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | `__tests__/audit-log-local-edit.test.ts`：真仓储改 3 字段 ⇒ `auditLogs.count()===1`、`fields.map(f=>f.field)` 逐字等于预期 3 元组（**顺序断言**，顺序 = 实体键序）、`source==='local-edit'`、`at` 在 ±5s                                                            |
| AC2  | `audit-log-pull.test.ts`：假服务端改 1 字段 ⇒ 1 条 `source='pull'`；本地编辑产生的条目不在同一行（`entityId+source` 分组断言）                                                                                                                                      |
| AC3  | `task-details/__tests__/history-panel-mounted.test.ts`：**真挂载** `details.vue`（带 provider）+ 真 DOM 断言：文案含「变更历史」、字段显示中文标签、`textContent` **不含** `fieldBase`/`revision`/`source`/`plain:`（⛔ stub 不算证据，见 AGENTS.md 前端验证纪律②） |
| AC4  | `audit-log-failure.test.ts`：把 `auditLogs.add` 替换为抛错 ⇒ 业务保存仍 `ok`、行已落库、`getStructuredLogs()` 含 `audit.record.failed` 且其 `fields` **不含**任务名/描述                                                                                            |
| AC5  | `audit-log-migration.test.ts`：先以 v4 schema 建库并写 3 行 tasks ⇒ 用 v5 类打开 ⇒ `verno===5`、`auditLogs` 存在且空、tasks 三行逐字段相同、`listAuditEntries` 返回空而非抛错                                                                                       |
| AC6  | `audit-log-bounds.test.ts`：① 写 1001 条 ⇒ 1000 条且最旧被删；② 写 1 条 `at` 早于 90 天 ⇒ 被删；③ 值 600 字符 ⇒ 512 + `truncated` + `truncatedFields`；④ 4 字段 × 512 字符 ⇒ 序列化 ≤ 1 KB 且 `truncated`                                                           |
| AC7  | `audit-log-actions.test.ts`：删除/归档/恢复各 1 条、`action` 正确、`fields` 为**空数组**（墓碑不产字段噪声）                                                                                                                                                        |
| AC8  | 变异清单见 10.2（≥5，全部要跑红）                                                                                                                                                                                                                                   |
| AC9  | `git diff --stat` 级断言 + 既有套件零修改：`vp test --run` 全仓（OCC/`field-merge`/`conflict-journal` 用例文件不得出现在 diff 中）                                                                                                                                  |
| AC10 | 真挂载用例断言容器类名不含 `nue-table`/`grid`（非表格式）、条目高度 ≥40px（量取 computed）、`FIELD_LABEL_KEYS` 覆盖 ∈ 新面板取值的字段集、i18n 新键在 zh/en/types 齐备                                                                                              |

### 10.2 变异（对应 PRD AC8，扩到 7 条）

| #   | 变异                                                    | 应红的用例                               |
| :-- | :------------------------------------------------------ | :--------------------------------------- |
| 1   | 摘掉 `update` 里的 `recordAudit` 接线                   | AC1                                      |
| 2   | `valuesEqual` 换成 `!==`（只此一处）                    | AC1 的空哨兵子例（D）                    |
| 3   | **删掉 pull 侧的 `toLocalProjectId` 归一**（收集箱）    | Q3 用例 B                                |
| 4   | 记录整行快照而不是 diff（`fields` 收全部键）            | AC1 的"恰含这 3 个字段" + AC6 的字节预算 |
| 5   | `recordAudit` 前置 `throw` 且不 catch                   | AC4                                      |
| 6   | 去掉上限淘汰（`pruneAuditLog` 恒返回 0）                | AC6 ①②                                   |
| 7   | 把 `auditLogs` 从 v5 store 清单删掉（模拟"降级后重开"） | AC5 的"表存在"断言                       |

> 变异 3 是本评审新增（PRD AC8 未列）：它是**唯一能在 3000+ 既有用例全绿的情况下上线假刷屏的洞**。

---

## 11. Q10 · 工期（落 5–8 人天？）

**结论：可信区间 7–8 人天（中位 7.5）；`5 人天` 不可信。** 拆解如下（含用例先行与门禁）：

| 里程碑 | 内容                                                                                                                              | 人天                           |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- |
| **M0** | 红基线（先写应红用例骨架）+ 夹具（v4 库/假服务端/真挂载 harness 复用）                                                            | 0.5                            |
| **M1** | 数据模型 + `version(5)` + `audit-log.ts` 读写 API + 迁移/降级用例                                                                 | 1.0                            |
| **M2** | `local-edit` 接线 **9 处**（含 `copy`/`snooze`/级联）+ action 派生 + "1 条"断言                                                   | 1.5                            |
| **M3** | `pull`(4) / `push-merge`(1) / `conflict-retry`(2) 接线 + 两级筛选 + 收集箱归一 + `DEF-147` 用例 A/B/C                             | 1.5                            |
| **M4** | 有界（1000 / 90d / **1 KB 预算**）+ 截断共享原语 + 清库链路（`wipeUserData` 名单 +1）                                             | 0.75                           |
| **M5** | 面板（`history.vue` + `TASK_HISTORY_CONTEXT_KEY` + `use-task-history.ts` + **13 i18n 键 ×2 语言** + 折叠/分页/三态 + 真挂载用例） | 2.0                            |
| **M6** | 变异 7 条 + 全量门禁 9 项 + 回滚 runbook + 发版说明                                                                               | 0.75                           |
|        | **合计**                                                                                                                          | **8.0**（乐观 6.5 / 中位 7.5） |

**为什么 5 人天不成立**：① 写入点不是"1 个 choke point"，而是 **16 处**（9 + 4 + 1 + 2），其中 `copy`/`snooze`/级联三处容易被漏（漏了就是 AC1 覆盖率不达标）；② M5 的 UI 有真挂载验收（AC3/AC10）与 13×2 个 i18n 键，压不到 1 人天以下；③ AC5 的迁移/降级必须真库验证（伪 IndexedDB），不是"写完就算"。

**若必须压到 6.5**：唯一安全项 = 砍「更早」分页（改"最近 5 条 + N 条更早"静态提示），−0.5；**不建议**砍 `pull` 侧的收集箱归一或变异 3。

**分期建议（若 PM 需要 5 人天级增量）**：数据层（M0–M4 + M6 部分）≈ 4.5–5.0 可独立成 PR，但 **AC3/AC10 无法验收**（PRD 指标 2「可读」不成立）⇒ 不构成可交付增量，不建议。

---

## 12. Q11 · 风险清单

| 风险                  | 触发                                              | 影响                                                                                                               | 处置                                                                                                                    | 验收判据                                                                                              |
| :-------------------- | :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **迁移失败**          | v5 升级事务 abort（配额/被其它标签页阻塞）        | 库停在 v4，业务数据零损但应用报"本地数据不可用"                                                                    | 只增表的空升级（无搬迁面）+ 既有"DB 失败≠凭证失败"呈现口径 + 启动重试                                                   | AC5 用例（v4→v5 真库）+ 手工验证"旧标签页持连接"时升级能完成（Dexie 默认 `versionchange` 自动关连接） |
| **写入放大**          | 批量路径（级联归档/批量删除/批量编辑）+ `DEF-147` | 单次批量 200 实体 ⇒ 200 条审计；`DEF-147` 若判据写错 ⇒ 每 30s × 每行                                               | 按实体计数（口径收窄）+ 两级筛选（Q3）+ 审计不进业务事务                                                                | 用例 A/B；观测项「审计条数/天」                                                                       |
| **存储体积**          | 多字段 + 长文本 + 1000 条                         | 破 ≤2 MB（理论上界 ≈3 MB）                                                                                         | 值 512 截断 + **条目 1 KB 预算** + 1000/90d 双界                                                                        | AC6 ④（字节断言）                                                                                     |
| **与 `DEF-147` 交互** | 回拉窗口内重写未变化行                            | 假刷屏（本档最大陷阱）；且**若顺便把"内容相同不写"做进 pull**，会连带改变 `written` 计数与 `data-changed` 广播语义 | **本档不动 pull 写行为**（只加审计侧判据）；`DEF-147` 仍挂账，若将来修，须复核审计判据（写 ADR 重评触发点）             | 用例 A 同时断言"`put` 仍发生" + "审计 0 条"                                                           |
| **隐私（明文值）**    | 审计表存业务明文                                  | 本地多一份明文副本（与业务表同姿态，但"多一处"本身是攻击面增量）                                                   | 只存**变更字段**（禁整行）+ 512 截断 + ⛔ 无 token/JWT/口令 + ⛔ 不上报 + 随登出/清库同事务删（`wipeUserData` 名单 +1） | 源级断言：审计写入不得包含 `token`/`password` 键；清库用例断言 `auditLogs` 该用户 0 行                |
| **回滚**              | 需撤掉能力                                        | PRD 写"整表清除即可"**不完整**（IDB 版本已 +1）                                                                    | 三段式：关闭写入开关 → `clearAuditLog` → 必要时降级（`dexie@4.4.5` 静默适配，参考来源 1）                               | 变异 7（模拟降级重开）                                                                                |
| **i18n 条款冲突**     | `R-7` 零新键                                      | 会导致要么裸英文键名（违反 C 端红线）、要么把"归档状态"当动作名                                                    | PM 修正 R-7（≤13 键）                                                                                                   | AC10 的键齐备断言                                                                                     |
| **可发现性**          | 面板默认折叠                                      | 「历史被打开次数 = 0」⇒ B/C 档失去依据                                                                             | 按 PRD §八 观测 2 周；折叠标题带最近一次变更的摘要（如「2 小时前，名称」）——**建议**，非本档必须                        | 观测项                                                                                                |

### 12.1 NFR 转译（可量化 + 可观测）

| PRD NFR                                  | 技术指标（可断言/可观测）                                                                                          | 观测点                                                                                    |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| 「保存路径耗时不出现可感变化」           | 保存一次（`update`）的**审计增量** p95 ≤ 5 ms（一次性 `add` + 不入业务事务）；级联归档 N 实体时审计总耗时 ≤ N×2 ms | 单测里 `performance.now()` 包住 `recordAudit`（仅基线断言，不进 CI 门禁）                 |
| 「读历史按 `entityId + at desc` 走索引」 | 查询必须命中 `[userId+entity+entityId]` 索引（Dexie `.where(...)` 而非 `.filter`）；1000 行内查询 p95 ≤ 10 ms      | 单测断言查询计划（用 `Dexie` 的 `where` 语法 + 断言返回条数），禁止 `.toArray().filter()` |
| 「体积可控 ≤2 MB」                       | 条数 ≤1000 **且** 单条序列化 ≤1 KB ⇒ 总量 ≤1 MB；值 >512 截断并双标记                                              | AC6 ④ + AC13                                                                              |
| 「审计写入失败不阻断」                   | 业务保存成功率不受审计失败影响（失败注入用例）；失败事件 `audit.record.failed` 计数可见                            | AC4 + `getStructuredLogs()`                                                               |
| 「可回滚」                               | 清表后业务读写零影响（清表前后跑同一组业务断言）；降级构建可开库                                                   | 回滚用例 + 变异 7                                                                         |
| 写入放大                                 | 每用户每天新增审计条数（用于判断是否触顶 1000）                                                                    | PRD §八 的 2 周观测项；`audit.entry.evicted` 事件计数                                     |

---

## 13. 待 PM 拍板（trade-off 不替 PM 决定）

| #      | 决策点                                      | 选项                                                                                 | 我的建议                                                                                                        |
| :----- | :------------------------------------------ | :----------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **D1** | 表形态                                      | (a) 同库新表 `version(5)` (b) 独立第二库 (c) `meta` 数组                             | **(a)**；若把"回滚=整库删"当硬需求则 (b)（成本见 ADR 对照表）                                                   |
| **D2** | `R-7` 措辞                                  | (a) 修正为"复用字段标签 + ≤13 面板键" (b) 坚持零新键                                 | **(a)**；(b) 会导致裸键或语病，违反 C 端红线                                                                    |
| **D3** | 两个恢复动作的来源                          | (a) 复用四值：「用云端的」→`pull`、「保留我的」→`conflict-retry` (b) 新增第 5/6 值   | **(a)**（`R-4` 四值固定；新增须 PRD 评审）；⛔ 但**不得**选择"这两个动作不记账"（会让两大用户动作在历史里消失） |
| **D4** | 「不刷屏」口径                              | (a) 同一实体的一次写不产生 N 条（批量 = 按实体计数） (b) 用户手势级（批量只记 1 条） | **(a)**；(b) 会让 19 个任务的历史里凭空多出一条"批量"记录且归属错误                                             |
| **D5** | 数组字段顺序噪声（`tags`/`remindWeekdays`） | (a) 按现口径记（顺序变即一条） (b) 审计内做"忽略顺序"的归一比较                      | **(a) 先接受并观测**（改比较口径会污染 `R-1` 单一判等）；若观测到刷屏再单独立项                                 |
| **D6** | 是否同批接 `projects`                       | (a) 不接（R-8 仅 tasks） (b) 同批接                                                  | **(a)**：`projects` 接入要先处理 `DEF-155`（记录层 `plain:` 捕获陷阱），不是"零成本"                            |
| **D7** | 面板是否随 desktop 上线                     | (a) 是（`app.ts` 一处 provide 覆盖两端） (b) 仅 web                                  | **(a)**：零额外成本；若 (b) 则 desktop 用户看到"没有历史"，属端间不一致                                         |

---

## 14. 建议 AC 增补（提交 PM 并入 PRD §七）

- **AC11（收集箱归一）**：`projectId='inbox'` 的任务在 pull 无业务变化时 **0 条**审计（防"每轮一条假 `projectId` 变更"）。
- **AC12（审计不与写耦合）**：`DEF-147` 场景下 `table.put` 仍发生 **且** 审计 0 条（证明判据不是"调用了一次 put"）。
- **AC13（字节预算）**：单条序列化 ≤ 1 KB；1000 条总量 ≤ 1 MB（覆盖 PRD 的 ≤2 MB 目标并留余量）。
- **AC14（两个恢复动作留痕）**：「用云端的」与「保留我的修改」各产 1 条（来源映射按 D3），且不重复（点第二次无新条目）。
- **AC15（清库）**：登出 / 注销到期 / 切换账号后，该用户 `auditLogs` 行数 = 0（与 `wipeUserData` 同事务）。
- **AC16（失败可观测）**：审计写失败的日志事件存在且 `fields` **不含**业务值（可断言 `JSON.stringify(fields)` 不含任务名）。
- **AC17（值形状）**：审计条目中 `from`/`to` 不含 `plain:` 前缀（`T676` 重放）。
- **AC18（`at` 不受远端时钟影响）**：服务端 `updatedAt` 为未来时间时，审计 `at` 仍落在本机 `[now-5s, now+5s]`。

---

## 15. 复现与验证口径（供 QA 独立复验）

```bash
# 1) 现状（PRD 分支只有文档，生产代码未变）
git -C /home/nathan/Projects/nao-todo log --oneline -1        # c9d373e5

# 2) 关键事实复核（本报告 §1 每行都可 grep 复现）
grep -n "PULL_BACKTRACK_MS\s*=" packages/infrastructure/src/persistence-sync/sync-service.ts
grep -n "toLocalProjectId" packages/infrastructure/src/persistence-sync/sync-service.ts | head
grep -rn "SYNC_COMPARE_IGNORED_FIELDS: ReadonlySet" packages/   # 必须恰 1 处
grep -rn "@nao-todo/infrastructure" packages/presentation --include=*.ts --include=*.vue | grep -v __tests__  # 必须 0 命中

# 3) 落地后门禁（按 AGENTS.md「全范围门禁」9 项）
pnpm exec vp check && pnpm exec vp test --run
pnpm run guard:ddd && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports \
  && pnpm run guard:test-location && pnpm run guard:gate-pathspec
pnpm exec vp run webapp build && pnpm run desktop:build
git status --porcelain -- packages/presentation-react apps/mobile   # 必须 0
```

## 16. 遗留 / 归口

- **PRD 待修正**（PM）：`R-7`（零新 i18n）· `AC6`（"不刷屏"口径收窄为按实体）· §八「回滚 = 整表清除即可」（补版本 +1 的降级说明）· NFR「≤2 MB」（需条目字节预算才成立）· 「`projects` 同批若无成本压力」（结论：不接，`DEF-155`）。

### 16.1 连带同步清单（Owner）

| 文档                                | 需改的条款                                                                                                                                                            | Owner         |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ |
| `docs/prds/2026-11-10-audit-log.md` | `R-7`（零新 i18n → 复用字段标签 + ≤13 面板键）· `R-5`（补单条字节预算）· `AC6`（"不刷屏"口径）· §六 NFR「≤2 MB」· §八「回滚」· §三「`projects` 同批」· 新增 AC11–AC18 | PM            |
| `docs/reports/defect-pool.md`       | `DEF-147` 行的口径备注：本档**不动** pull 写行为，只加审计侧判据（避免后人以为已修）                                                                                  | PM（qa 提议） |
| `DESIGN.md`                         | **本档不需要改**（沿用 `nue-*` token + `nue-collapse` + `LoadingError`，无新样式体系）；若 M5 引入新的历史条目样式 ⇒ 按 PRD AC10 补一节                               | rd-fe         |
| `AGENTS.md`                         | **不需要改**（无新守卫/新门禁/新命令；`auditLogs` 不进 `BUSINESS_TABLES`）                                                                                            | PM            |

- **本评审未覆盖**（如实）：① 未做像素级视觉评审（属用户走查）；② 未实测 IndexedDB 索引迭代顺序在 Safari/Firefox 的差异（以用例断言顺序为准，不依赖文档措辞）；③ 未评估 B/C 档（事件溯源）与本档的迁移路径 —— 若将来升 B 档，"审计条目 → 可撤销操作"需要额外语义（本档的 `fields` 已足够做"字段级回滚"的输入，但缺 `before` 全量快照）。
- **无生产代码 / 既有用例改动**；仅新增本报告 + ADR 两份文档，并在 `docs/adr/README.md` 索引表插入 1 行（未 commit / 未 push，提交由 PM 执行）。