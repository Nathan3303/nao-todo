# 2026-09-28 同步冲突机制检查（T325）—— 结论：**有条件可行**（机制成立，存在可复现的伪冲突与一条静默覆盖路径）

- **日期**：2026-09-28
- **状态**：⏳ **有条件可行**（**DP-T325-1…4 待 PM 拍板**；⛔ **纯设计/评审，未改任何代码/测试**（含服务端））
- **任务**：`T325`（同步冲突机制检查：全链路 / 时间精度 / 判定边界 / 时钟关系 / 根因与修法 / 复现清单）
- **触发**：用户报告 —— **desktop 生产 v1.12.0**，**频繁修改数据后有概率出现「同步冲突」**，界面左下角「同步状态 → 冲突信息 → diff」中**服务端版本 vs 我的版本**呈现 **业务字段不同 + 更新时间相差「十几毫秒」**
- **评审对象**：客户端 `nao-todo` `main@2d4f028e` · 服务端 `nao-todo-server` `main@a846c16`（跨仓只读；另对**本机运行实例**做了只读核验）
- **依据**：阶段二 ADR `docs/adr/2026-09-24-stage2-both-ends-local-first.md`（PS-12…PS-16 / §9 OCC）· 阶段一 ADR `2026-09-23-web-offline-local-first-and-security-posture.md`（C-44/C-59/C-66）· `docs/releases/v1.11.0.md` · 缺陷池 `DEF-13`/`DEF-42`…`DEF-48`
- **硬约束**：不实现、不改码；只读两仓；仅消费上文信封与只读事实，缺项在 §12 列清单
- **影响面工具**：行号级读码 + `codegraph` 同族核对 + 运行实例 `information_schema`/二进制核验

---

## 0. 结论摘要（先看这里）

| #      | 问题                           | 结论                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :----- | :----------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | 冲突判定全链路                 | `base` 三源：① **pull** 落库时写 `syncedServerUpdatedAt = 服务端 updatedAt`（`sync-service.ts:513-515`）② **push 回执** `applied/noop/stale` 后写回（`:1171-1177`）③ 本地写经 `putWithSyncBase` **保留**旧 base（`put-with-sync-base.ts`）。**base 缺失 ⇒ 服务端回退 LWW**；base 存在 ⇒ `base == 库中 updated_at` ⇒ 覆盖，否则 `stale`。pull 侧另有独立 LWW：`remoteTs > localTs` ⇒ **远端胜 + 覆盖 + 出队 + journal**（`:833-861`）。**⚠️ 结论：H1「applied 后未写回 base」不成立（写回存在）**，见 §2。 |
| **Q2** | 时间精度与截断（「十几毫秒」） | **MySQL 列一律 `datetime(3)`（ms）**（`information_schema` 实测）· Go 侧 `time.Now()`（ns）**写库时四舍五入到 ms** · 接口 `RFC3339Milli` → **精度口径自洽，不存在 ≥1ms 的截断错配**。**真正产生「十几毫秒」的是两个独立时钟**：客户端本地写 `updatedAt` 用**裸客户端时钟**（见 Q4）+ 服务端落库用 `time.Now()`。差值量级 = **时钟偏斜 δ + 半个 RTT + 批量处理耗时**。                                                                                                                                     |
| **Q3** | 判定运算符与边界               | `DecideUpsert`：`createdAt` 超 1min ⇒ `conflict`（ID 碰撞）；**base 非零** ⇒ `base.Equal(existingUpdated)` ? `applied`(覆盖) : `stale`；**base 零值** ⇒ LWW `existingUpdated.After(voUpdated)` ? `noop` : `applied`。`Equal` 是**纳秒瞬时相等**；**同一毫秒内多次编辑** ⇒ OCC 令牌相同 ⇒ **漏判一次冲突**（R-14）；**服务端每次写入都 `updated_at = 服务端 now`**（`repoImpl.go:130-134`）⇒ **客户端本轮的新编辑可能"早于"上一轮推送的服务端落库时刻** ⇒ **伪 noop/伪 remote-wins**（§4）。               |
| **Q4** | 时钟关系                       | **`getServerTimeOffset()` 恒为 0 —— 校准接线失效**：push/pull 读 `serverTime` 都**多读/少读了一层 JSON**（服务端把 `serverTime` 放在 `data.data.serverTime`，客户端读 `data.serverTime`）⇒ `calibrateServerTime` 收到 `undefined` ⇒ **永不写入偏移**（`sync-service.ts:478-482, 750-752, 1101-1102`）。同源测试 `server-time-calibration.test.ts` **只测读取侧、不测接线**。⇒ **PS-15「本地写用服务端校准时间」在运行时未生效**，本地写 = 裸客户端时钟。                                                  |
| **Q5** | 根因与修法                     | 见 §8 / §11：**RC-1 服务端派生写推进 `updated_at` 不回传**（计数联动，**最可能**，差值恰为同批 `tasks→子实体` 的处理间距 ≈ 十几毫秒）· **RC-2 时间戳作令牌 + 校准失效**（时钟偏斜即「十几毫秒」）· **RC-3 pull「本地胜」不回写 base**（OCC 下必 stale）· **RC-4 运行服务端早于 OCC 提交**（`stale` 根本不可能产生 ⇒ 全部回落 LWW）· **RC-5 put/markDirty 非原子**（**可能无 journal 的静默覆盖** ⇒ 建议 P1）。                                                                                            |
| **Q6** | 单设备连续编辑能否复现         | **能**（无需第二端）：**服务端派生计数写 + 队内 base 静默过期**（确定性）与 **推送在飞窗口 / 时钟偏斜窗口**（概率性）均可单端复现。见 §9/§10。                                                                                                                                                                                                                                                                                                                                                            |

---

## 1. 用户现象 → 判定链路 → 复现条件 → 根因 → 修法（一条链）

```text
[用户现象]  desktop v1.12.0 · 频繁改动后「冲突 N」+ diff 显示「服务端版本 vs 我的版本」
            ⇒ 业务字段不同（本地 N+1 vs 服务端 N）· updatedAt 差「十几毫秒」
     │
     ▼
[判定链路]  本地写(据 base) → syncQueue(localUpdatedAt) → push(baseUpdatedAt)
            → 服务端 DecideUpsert[base 匹配?]  ── 否 ─→ stale（OCC，未写）
                                            └─ base 缺 ─→ LWW: 请求更旧? noop : applied
            → 客户端消费 outcome（journal + 回写 base + 出队）
            同时 pull: remoteTs > queued.localUpdatedAt ─→ 远端胜 + 覆盖 + journal
     │
     ▼
[复现条件]  ① 单端：同一条目「被服务端派生写过」（加/删检查项·评论·子任务 ⇒ 父任务计数联动）
              且 客户端随后又推该父任务 ⇒ base 必过期 ⇒ stale
            ② 单端：本地新编辑的客户端时间戳 < 服务端上一笔写入的服务端时间戳
              （推送在飞窗口 / 客户端时钟落后 δ）
            ③ 无需第二端；第二端会显著放大
     │
     ▼
[根因排序]  RC-1 派生写不回传（最可能） > RC-2 时间戳令牌 + 校准失效 >
            RC-3 pull 本地胜不回写 base > RC-4 运行服务端早于 OCC > RC-5 put/markDirty 非原子
     │
     ▼
[修法]      A 修校准接线（客户端 2 行级）· B 修 pull 本地胜 rebase + 消费派生写版本（客户端）
            · C 服务端权威单调版本/ETag（协议+迁移）· D 仅部署已合并的 OCC（部署级）
            ⇒ 推荐 **D + A + B 立即**，**C 作为根治**（见 §11）
```

---

## 2. 冲突判定全链路（逐条给代码行 + 语义）

### 2.0 链路图（组件与交互）

```text
┌──────────── desktop / web 客户端（同构，v1.12.0） ────────────┐
│  视图层（pinia store / 详情页）                                │
│      │ use case                                              │
│      ▼                                                       │
│  本地仓储（persistence-local）                                │
│      putWithSyncBase(record)      ← 保留旧 base ──────┐      │
│      syncTracker.markDirty(table,id,action,updatedAt)  │   ⚠ 非原子
│                              │                          │      │
│                              ▼  (防抖 2s)              │      │
│  SyncService.pushAllInner()  ── 现读 record（同时派生 payload 与 base）
│                              │                          │      │
│                              │ POST /sync/push         │      │
│                              ▼                          │      │
│      客户端消费 outcome:                              │      │
│        applied/noop/stale → writeBackSyncBase()  ──────┘      │
│        noop/stale/conflict/skipped → appendConflict(journal)   │
│        error → 不出队 + 退避                                  │
│                              │                                │
│  SyncService.pullAllInner() ──  GET /sync/pull                │
│       applyPullBatch: remoteTs > queued.localUpdatedAt ?
│        是 → 远端胜：journal(remote-wins) + putPulledRecord + 出队
│        否 → 本地胜：跳过（⚠ base 不 rebase）
│        无队列 → 无条件覆盖
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTP（fetch/axios，响应体 = {code,message,data:{…}}）
                          ▼
┌──────────── nao-todo-server（Go） ────────────┐
│  SyncController.Push   表序：tasks → taskCheckItems → taskComments
│                              → projects → tags → pomodoros → records → deletions
│  TaskRepo.Upsert ─ DecideUpsert(base?, LWW)      │
│        base 命中 → 覆盖，写 updated_at=time.Now()
│        base 不匹配 → stale（不写，回库中版本）
│        base 缺失 → LWW（existing.After(voUpdated) ? noop : 覆盖）
│      └─ 子实体创建/删除 → CountUpdater → adjustCountColumn
│           → 父任务/清单 count 列 ±1 且 **updated_at = time.Now()**
│           ⚠ 该派生行**不在回执里**
└─────────────────────────────────────────────┘
```

**图中两个红点**即为根因入口：① 本地「落库 → 入队」非原子（可被 pull 插在中间）；② 服务端「派生写改父行版本」不回传。

### 2.1 客户端 base 从哪来

| #   | 来源              | 事实                                                                                                                                     | 证据                                                                                      |
| :-- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| B-1 | **pull 落库**     | `putPulledRecord` 在把远端行写入本地表时**同时**落 `syncedServerUpdatedAt = entity.updatedAt`（服务端值）                                | `packages/infrastructure/src/persistence-sync/sync-service.ts:499-516`（赋值 `:513-515`） |
| B-2 | **push 回执**     | `applied`/`noop`/`stale` 回执 → `writeBackSyncBase(table, id, result.serverUpdatedAt)`（**仅改 base 字段，不动业务字段、不 markDirty**） | 同文件 `:1171-1177`；`writeBackSyncBase` 定义 `:523-534`                                  |
| B-3 | **本地写保留**    | 业务实体不含该字段 ⇒ 本地写前**读出旧行的 base 再原样写回**（`putWithSyncBase`，所有本地写仓储统一走它）                                 | `packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts`               |
| B-4 | **push 发送取值** | 发送时**现读本地行**取 `record.syncedServerUpdatedAt` → 载荷 `baseUpdatedAt`（**缺失即不产出该字段** ⇒ 服务端 LWW 回退）                 | `sync-service.ts:1008-1017`                                                               |

> **判定（H1 验证）**：H1 字面命题「只在 pull 时更新 base」**不成立** —— `applied` 回执**确实**写回 base。但 H1 的精神成立，且有三处**加强版**缺口（见 §2.4）：① 回写**以 `outcome` 字段存在为前提**（服务端缺该字段 ⇒ 静默出队且不回写）；② 回写**被服务端随后的派生写覆盖**（RC-1）；③ **pull「本地胜」分支不回写 base**（RC-3）。

### 2.2 服务端 `stale` 判定

| #   | 事实                                                                                                                                                                                                                                                       | 证据                                                                                                               |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| S-1 | `DecideUpsert(existingCreated, existingUpdated, voCreated, voUpdated, baseUpdated, window)`：`createdAt` 超窗 ⇒ `conflict`；**base 非零** ⇒ `Equal` ? `Overwrite` : `Stale`；**base 零值** ⇒ LWW `existingUpdated.After(voUpdated)` ? `Noop` : `Overwrite` | `nao-todo-server/domain/types/upsert.go:37-60`                                                                     |
| S-2 | `Upsert`：base/stale 分支**不写库**，回 `existingEntity`（= 库中当前版本）供客户端 rebase；覆盖分支 `updateMap["updated_at"] = time.Now()`（**服务端时间为唯一权威**）                                                                                     | `infrastructure/persistence/task/repoImpl.go:107-150`（判定 `:120-127`，Noop/Stale `:129-133`，覆盖写 `:134-136`） |
| S-3 | 逐条回执 `{table,id,serverUpdatedAt,outcome}`；`outcome ∈ applied/noop/stale/conflict/skipped/error`（additive）                                                                                                                                           | `interfaces/controllers/sync.go:53-66`；`interfaces/types/sync.go:81-113`                                          |
| S-4 | **push 表序 `tasks → taskCheckItems → taskComments → projects → tags → pomodoros → pomodoroRecords → deletions`**（`tasks` **先于**子实体；一旦子实体触发计数联动，父任务刚落库的版本**立刻过期**）                                                        | `interfaces/controllers/sync.go:94-243`                                                                            |
| S-5 | **服务端派生写**：加/删检查项·评论·子任务 ⇒ 父任务 `check_item_count/comment_count/subtask_count` 直写列 **并在同一 SQL 内推进 `updated_at = time.Now()`**；项目任务计数同理                                                                               | `infrastructure/persistence/task/repoImpl.go:989-1031`；`infrastructure/persistence/project/repoImpl.go:353-370`   |
| S-6 | **回执只回「本次 upsert 的那一行」的版本** —— 被派生写改到的**父任务/清单行不会出现在回执里**，也没有任何 `versions: {...}` 增量                                                                                                                           | S-3 + `:94-243`（无派生行回执）                                                                                    |

### 2.3 客户端 `stale`/`noop` 处理

| #   | 事实                                                                                                                                                                                                  | 证据                                                                   |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| C-1 | `applied/noop/stale` 写回 base；`noop/stale/conflict/skipped` **全部入 journal**（`noop`/`stale` 带败方内容快照）；`error` **不出队** + 业务退避                                                      | `sync-service.ts:1141-1183`                                            |
| C-2 | 之后按快照守卫出队：`current.localUpdatedAt === snapshot` ⇒ `removeQueued`（**推送期间的本地新编辑 ⇒ 保留队列**）                                                                                     | `sync-service.ts:1179-1183`                                            |
| C-3 | ⚠️ **`stale` 也会出队**（若快照一致）⇒ 本地改动**不再重推**，只留 journal 快照；下一次 pull 会用具服务端版本覆盖本地行（**无队列 ⇒ 无新 journal**）⇒ 用户看到的 diff = journal 败方 vs 覆盖后的本地行 | C-1 + `:862` + `conflict-journal.ts` 的 `compareConflict`/`diffFields` |

### 2.4 pull 侧 LWW

| #   | 事实                                                                                                                                                                                                        | 证据                             |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------- |
| P-1 | `remoteTs = Date.parse(entity.updatedAt)`；`queued = syncQueue.get(userId:table:id)`；`remoteTs > localTs` ⇒ **远端胜**：journal（`remote-wins` + 败方快照）→ 覆盖落库 → **出队**；否则**本地胜：整段跳过** | `sync-service.ts:833-865`        |
| P-2 | ⚠️ **「本地胜」分支既不落库、也不更新 `syncedServerUpdatedAt`** ⇒ 服务端当前版本（`remoteTs`）**已知但被丢弃** ⇒ 下一次 push 仍用旧 base ⇒ **OCC 下必然 `stale`**（设计缺口）                               | `sync-service.ts:864`（无 else） |
| P-3 | 本地无队列项 ⇒ **远端无条件覆盖**（`putPulledRecord`）                                                                                                                                                      | `sync-service.ts:861-863`        |

---

## 3. 时间精度与截断（逐点，对应「十几毫秒」）

| 点                     | 事实                                                                                                                                                                                                                                                                 | 证据                                                                                                                                              |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| ① MySQL 列精度         | **全部 `datetime(3)`**（`created_at/updated_at/deleted_at` × 11 表实测）；**非** `DATETIME(0)`                                                                                                                                                                       | 运行实例 `information_schema.columns`（`DATETIME_PRECISION = 3`）                                                                                 |
| ② Go 侧                | 写入 `time.Now()`（ns）→ MySQL **四舍五入到 ms**；可空业务时间（`startAt/endAt/archivedAt/…`）另行 `truncateToSecond` 到**秒**（与 `updated_at` 无关）                                                                                                               | `task/repoImpl.go:130-134`；`task/converters.go:16-26`                                                                                            |
| ③ 接口序列化           | `updatedAt` 一律 `idutil.RFC3339Milli`（`2006-01-02T15:04:05.000Z07:00`）；`ParseTimeCompat` 先按 ms、再退回 `RFC3339`                                                                                                                                               | `application/idutil/timefmt.go:5-21`；`application/task/converters.go:21`                                                                         |
| ④ 客户端时间来源       | 本地写 `updatedAt = nowCalibratedIso()` = `new Date(Date.now() + getServerTimeOffset())` = **裸客户端时钟**（因为偏移恒 0，见 ⑤）                                                                                                                                    | `sync-config.ts:52-75`；`task-repo-impl.ts:155`                                                                                                   |
| ⑤ **校准接线（关键）** | **`calibrateServerTime` 实际收不到值**：服务端把 `serverTime` 放在 `data.data.serverTime`（`SyncPushRes`/`SyncPullRes` 的字段），客户端在 push/pull 都读 `data.serverTime`（**少一层**）⇒ `undefined` ⇒ `typeof !== 'number'`/`Number(undefined)=NaN` ⇒ **不写偏移** | `sync-service.ts:478-482`（守卫）、`:750-752`（pull 读法）、`:1101-1102`（push 读法）；服务端 `sync.go:265-271`（push）/`sync.go:461-467`（pull） |
| ⑥ 请求器层             | `requester.get/post` 返回 **AxiosResponse**（`response.data` = 业务体）；同仓 `persistence-go/**` 全部按 `response.data` 取体 ⇒ ⑤ 的层级判定成立                                                                                                                     | `packages/shared/requester/axios.ts:184-196`；`persistence-go/task/task-repo-impl.ts:39`                                                          |
| ⑦ 同毫秒碰撞           | 令牌 = `updated_at`（ms）⇒ 同 ms 并发写同一行 ⇒ `Equal` 为真 ⇒ **漏判一次冲突**（不丢数据）                                                                                                                                                                          | 2B ADR §9.1.1 / R-14（本 ADR 复核成立）                                                                                                           |
| ⑧ 结论                 | **「十几毫秒」不是精度截断造成的**；它等于 **两个时钟/两个落库时刻之间的差**（见 §5）。                                                                                                                                                                              | ①–⑦                                                                                                                                               |

---

## 4. 判定运算符与边界

- **`<` / `<=`**：LWW 用**严格** `existingUpdated.After(voUpdated)`（等价"请求严格更旧"）；**相等 ⇒ 覆盖**（服务端后写胜，不判冲突）。OCC 用 `Equal`（相等 ⇒ 覆盖）。
- **相等是否判冲突**：**否**（OCC 相等 = 命中 base = 正常覆盖；LWW 相等 = 覆盖）。
- **同一毫秒内多次编辑**：OCC 令牌可能相同 ⇒ 漏判（R-14）；LWW 下 `After` 为假 ⇒ 覆盖。
- **写后立刻 push（base 仍是旧值）**：base 旧 + 服务端无人改过 ⇒ `base == existing` ⇒ **正常 applied**（不产生伪冲突）。**真正的伪冲突来自「服务端在没有回传的情况下改了 `updated_at`」**（RC-1）或「新编辑的时间戳低于上一笔的服务端落库时刻」（RC-2）。
- **服务端每次写入都 `updated_at = 服务端 now`**（`repoImpl.go:134`）：这是 LWW 的基准，也意味着**「请求 `updatedAt`」与「服务端 `updated_at`」永远来自不同时钟**，二者的相对大小**不保证与真实先后一致**（尤其客户端时钟落后时）。
- **`deletions` 不参与 OCC**（无 base）：删除会无条件覆盖/清空（延续 R-15b 已知局限）。
- **往返归一**：`createdAt` 只在 `>1min` 窗口判 ID 碰撞；**不参与**常规冲突。

---

## 5. 时钟关系（为什么必然「十几毫秒」）

- **客户端 `now` = 客户端机器时钟**（校准失效，§3-⑤）；**服务端 `now` = 服务器时钟**。
- 两机时钟差 δ（本机/服务器实测为**未知量，需用户侧核验**，§12）通常为 **NTP 同步后的十几毫秒 ~ 几十毫秒**。
- 对**同一次编辑**：客户端时间戳在**发送前**生成；服务端时间戳在**收到后**生成 ⇒ 服务端戳 **≥** 客户端戳（差 = 单程网络 + 处理）。
- ⇒ 服务端「上一笔写入的版本戳」系统性地**领先**客户端「下一次编辑的戳」一个固定量级；**任何落在该量级窗口内的本地新编辑都会被判「更旧」**。
- ⇒ **客户端本地时间若慢于服务端 δ，则每次推送都天然落后 δ；当两次编辑间距 ≲ δ + RTT/2 + 批量处理时，第二次编辑被伪判为旧版**。diff 中两个 `updatedAt` 之差 ≈ 该量级 —— 与用户报告的「十几毫秒」数量级一致。
- **反向（客户端快于服务端）**：不会产生伪冲突，但会**放大「覆盖他端较新写」的风险**（PS-15 原文即此担忧）。

---

## 6. 队列 item 语义：payload 与 base 是否原子一致？

| 问题                                    | 判定                                                                                                                                                           | 证据                                                     |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| item 里存的是 payload 快照还是引用？    | **都不存 payload**。`SyncQueueRecord` 只存 `{id,userId,table,entityId,action,localUpdatedAt,retry…}`；**payload 与 base 都在 `pushAllInner` 发送时现读同一行** | `local-database.ts:268-278`；`sync-service.ts:1000-1017` |
| payload 与 base 是否原子一致？          | **是**（同一次 `table.get(entityId)` 取出的 record 派生两者）                                                                                                  | `sync-service.ts:1005-1017`                              |
| 合并/去重（coalesce）时 base 是否刷新？ | **coalesce 只覆盖 `localUpdatedAt`/`action`/`updatedAt`，保留 `createdAt`/退避**；**base 不在队列里**，由 `putWithSyncBase` 在每次本地写时**保留旧值**         | `sync-tracker.ts:34-60`；`put-with-sync-base.ts`         |
| 结论                                    | **PM 假设①（payload 快照 vs 旧 base）不成立**；但**「本地写与入队非原子」成立**（→ RC-5，见 §7）                                                               | 同上                                                     |

---

## 7. ⭐ 数据安全结论：pull LWW 是否会**静默**覆盖本地未推送改动？

**分三档（必须分开说，否则定性会错）**：

| 档                   | 场景                                                                                                                              | 是否有 journal                                              | 判定                                                      |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- | :-------------------------------------------------------- |
| **① 已入队**         | `queued` 命中且 `remoteTs > localTs`                                                                                              | **有**（`remote-wins` + **败方内容快照**，上限 200 可淘汰） | **非静默**（可见 + 可恢复）；**但有损**（淘汰后不可恢复） |
| **② 已入队但本地胜** | `queued` 命中且 `remoteTs <= localTs`                                                                                             | 无（不覆盖）                                                | 安全；**但 base 不 rebase ⇒ 下一推 `stale`（RC-3）**      |
| **③ 未入队**         | 本地写**已完成 `put` 但 `markDirty` 尚未执行**（pull 在窗口内读到旧队列/无队列）⇒ `:861-863` 无条件远端覆盖                       | **无任何 journal**                                          | ⚠️ **静默覆盖 = 静默丢用户编辑**                          |
| **③′ 出队竞态**      | 推送在飞期间的新编辑若 `localUpdatedAt` 与快照**同毫秒相等** ⇒ 守卫误判"未变" ⇒ `removeQueued` ⇒ 新内容永不推送，随后被 pull 覆盖 | **无 journal**                                              | ⚠️ **静默丢**（窗口极窄）                                 |

- **证据**：`applyPullBatch` 的 `queued` 读取（`:835`）与本地写路径的 `putWithSyncBase(...)`→`syncTracker.markDirty(...)` **是两次独立 await、无 Dexie 事务**（例：`task-repo-impl.ts:155-160`；对照 `unarchive` 用了 `db.transaction('rw', …, syncQueue)` 的**安全范式** `:289-311`）。`markDirty` 是 `syncQueue` 的唯一入队点（`sync-tracker.ts:34-60`），pull 不与其互斥。
- **另**：`stale`/`noop` 出队后（C-3），本地改动**不在队列**⇒ 下一次 pull 会**无条件**覆盖本地行（`:862`），只剩 journal 快照。

> **结论（回答 PM #2）**：**存在「无 journal 的静默覆盖」路径（③/③′）⇒ 应定 P1**；主报告路径（①）**不是静默**（有快照 + 可见计数），但在 journal 淘汰（上限 200）或用户不处理时会退化为**不可恢复的丢失**。另：**OCC 的 `stale` 保护覆盖不到本场景** —— `stale` 只在 **push** 侧（服务端对 base 的校验）产生，**pull 覆写走的是 `applyPullBatch` 的 LWW，与 `stale` 无关**。

---

## 8. 根因假设排序（按可能性，每条给证据）

### RC-1（最可能）服务端「派生写」推进 `updated_at` 却不回传给客户端

- **机制**：加/删**检查项 / 评论 / 子任务** ⇒ 服务端**直写父任务计数列**并在同一 SQL 里 `updated_at = time.Now()`（`task/repoImpl.go:989-1008`，`AdjustCheckItemCount/AdjustCommentCount/AdjustSubTaskCount`）；项目任务计数同理（`project/repoImpl.go:353-370`）。
- **致命点**：push 回执**只回本次 upsert 的那一行**（`sync/S-3`），**派生行（父任务/清单）的版本没有任何回传通道**；pull 也要等到下一次拉取才把父任务带回。
- **⇒ 客户端对父任务的 `base` 静默过期**。下一次用户改父任务 ⇒ `base != existing` ⇒ **`stale`**（OCC 部署时）/ 被 LWW 判旧 ⇒ `noop` 或 pull `remote-wins`（未部署 OCC 时）。
- **为什么差值正是「十几毫秒」**：同一个 push 请求内表序 `tasks → taskCheckItems/…`（`S-4`）⇒ 父任务刚落库的版本（回执给客户端）与随后计数联动的落库版本之间，只差**服务端处理这几条 SQL 的时间（十几毫秒）**。⇒ 客户端 base 与库中版本正好差"十几毫秒"。
- **与「频繁修改」吻合**：活跃使用 = 频繁加/勾检查项、写评论、建子任务 ⇒ 每次都给父任务"偷偷"换版本。
- **与「业务字段也不同」吻合**：客户端拿旧 base 推的是**本地新内容（第 N+1 版）**，服务端保留的是**第 N 版 + 新计数** ⇒ diff 两侧业务字段不同。
- **证据**：`S-4/S-5/S-6`；2B ADR `T175` 互记（归档级联 × OCC 的隐式表序契约）已注意到表序敏感性，但**未覆盖"计数联动改父行"**这一类。

### RC-2 并发令牌 = 双侧墙钟时间戳，且**客户端校准接线失效**

- **机制**：base/判定基准是 `updated_at`（墙钟）；客户端本地写用**裸客户端时钟**（§3-⑤ 校准恒 0）；服务端落库用 `time.Now()`。
- **⇒ 时钟偏斜 δ（+ RTT/2 + 处理）直接决定「谁更新」**；落在窗口内的正常新编辑被判旧版 ⇒ 伪 `noop` / 伪 `remote-wins`。
- **diff 的「十几毫秒」= δ + 单程网络 + 处理**。
- **证据**：`sync-service.ts:478-482/750-752/1101-1102`（读法错层）· `sync-config.ts:52-75` · 服务端 `upsert.go:37-60` · `repoImpl.go:134`。**该缺口未被测试覆盖**：`server-time-calibration.test.ts` 仅验证「偏移写入后读到/`nowCalibratedIso` 相加」，**不验证「同步响应真的写入了偏移」**。

### RC-3 pull「本地胜」不回写 base（OCC 下的确定性放大器）

- 机制/证据：§2.4 P-2（`sync-service.ts:864` 无 else）。只要服务端版本被 RC-1 推进过，pull 会"本地胜"跳过，base 停留在更旧值 ⇒ **下一次 push 100% `stale`**（与时钟无关）。

### RC-4（部署事实，需用户核验）当前运行的服务端早于 OCC 提交

- **事实**：本机运行容器 `naotodo-server` 的二进制 mtime = **2026-09-24 12:50 (+08)**；OCC 提交 `54e843d` 的提交时间 = **2026-09-24 19:31 (+08)**；二进制内**检索不到 `baseUpdatedAt`**（`serverUpdatedAt` 可检索到）。
- **⇒ 若用户生产环境同此**：服务端**忽略 `baseUpdatedAt`**、**不可能返回 `stale`** ⇒ 用户看到的所有「冲突」只能是 LWW 的 `noop`（"服务端未写入"）或 pull 的 `remote-wins`（"远端覆盖"）；**OCC 的"版本不匹配"保护完全不在**。
- **证据**：`docker inspect`（镜像 Created `2026-09-24T04:51Z`）· `strings /app/naotodoserver`（`baseUpdatedAt` 命中 0）· 服务端 git 提交时间线。发布说明（v1.11.0）自述该服务端改动"建议与服务端同批部署"，**未强制**。

### RC-5 put 与 markDirty 非原子（数据安全）

- 见 §7 ③/③′；建议 P1。

> **合并根因链（PM 要求）**：RC-1 与 RC-2 **相互加强** —— RC-1 让 base 静默过期（"服务端版本与客户端 base 相差十几毫秒"），RC-2 让"下一次编辑"在时间戳上**落进过期窗口**（差值同量级）⇒ 两者叠加即"频繁修改后有概率出现、且差值十几毫秒、且业务字段不同"。RC-4 决定这个冲突**以什么 kind 呈现**（有 OCC ⇒ `stale`；无 OCC ⇒ `noop`/`remote-wins`），RC-5 决定**最坏情况是否会静默丢**。

---

## 9. 单设备 vs 两端并发（回答 PM #4）

**单设备即可复现**，且是主报告的最可能路径（无需第二端）：

1. **RC-1 路径（确定性）**：本机加一个检查项/评论/子任务 → 服务端改父任务 `updated_at` → 本机再改该父任务 → `stale`/`noop`。
2. **RC-2 路径（概率性）**：本机连续编辑，第二次编辑落在**推送在飞窗口 / 时钟偏斜窗口**内（≲ δ + RTT/2 + 批量处理，十几毫秒量级）。
3. **RC-5 路径（数据安全）**：本机编辑落库与入队之间的 IndexedDB 写窗口内恰逢后台 pull。

**两端并发**不是必要条件，但会**显著提高命中率**（他端每次写入都会推进服务端 `updated_at`，等价于持续把 base 打旧）。

---

## 10. 最小复现（可执行步骤，供实现单写红测试）

### R-A：单端 · 派生写导致父任务 base 过期（确定性；对应 RC-1）

1. 在线登录，等首次同步完成（`pendingCount = 0`）。
2. 打开任务 T 详情，**修改 T 的名称** → 等 2s 防抖 + 推送完成（T 的 base = `S1`）。
3. **给 T 添加一个检查项**（或评论/子任务）→ 等推送完成（服务端把 T 的 `updated_at` 推进到 `S2 = S1 + Δ`，Δ≈十几毫秒；**客户端 T 的 base 仍是 S1**）。
4. **不要重载**，再次**修改 T 的名称** → 等推送完成。
5. **期望**：出现一条冲突（`stale`；或未部署 OCC 时为"服务端未写入"）。打开冲突 diff：**业务字段（名称）不同 + `updatedAt` 相差 ≈ Δ（十几毫秒）**。服务端未接受第 4 步的改名。
    - 断言（红测试）：`task.syncedServerUpdatedAt` 在步骤 3 后**未**被刷新（应刷新为 S2）；步骤 4 的 push 回执为 `stale`。

### R-B：单端 · 连续两次编辑 + 一次 pull 插在中间（概率性；对应 RC-2/RC-3）

1. 先制造服务端版本领先本地的状态：在**另一窗口/设备**（或直接 `PUT` 接口）改一次 T，使服务端 `updated_at` 领先本地 base。
2. 本机离线改 T（入队，`localUpdatedAt = L`）。
3. 恢复网络使之发生 **pull**（触发"立即同步"或前台恢复）。
4. **期望**：pull 判「远端胜」⇒ 覆盖本地 + `remote-wins` journal；「本地胜」⇒ 不改 base，随后 push 得 `stale`。
    - 断言：`applyPullBatch` 的「本地胜」分支**必须**把 base 写成 `remoteTs`（当前实现不写 ⇒ 红）。

### R-C（可选）· 时钟偏斜注入（对应 RC-2）

1. 用测试注入把 `SERVER_TIME_OFFSET_KEY` 设成 `-20ms`（模拟客户端慢 20ms）或把服务端 `serverTime` 响应 mock 成 `+20ms`。
2. 连续两次编辑 T，第二次编辑紧跟在第一次 push 完成之后。
3. **期望**：第二次 push 得 `noop`（客户端时间戳低于服务端落库戳）。
    - 断言：修复后（校准生效）同一用例**不得**再产生伪冲突。

> ⚠️ 红测试须**先锁定** RC-4（运行服务端是否含 OCC），否则 `stale` 用例在旧服务端上**不可能绿**。

---

## 11. 修法选项对照（代价 / 风险 / 迁移 / 数据损失风险）+ 推荐

| 选项                                        | 做法                                                                                                                                                                                      | 代价                                        | 风险                                                                           | 迁移              | 数据损失风险                                                 | 判定基准改动   |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ | :----------------------------------------------------------------------------- | :---------------- | :----------------------------------------------------------- | :------------- |
| **A. 修校准接线**（客户端，最小）           | 把 push/pull 的 `serverTime` 读取**下移一层**（`data.data.serverTime`），并加一条「响应中含 serverTime ⇒ offset 必须非 0」的接线断言（补上当前测试盲区）                                  | **极低**（2 处读法 + 1 用例）               | 低（不触协议）；但**只缩小窗口**，不解决 RC-1/RC-3                             | 无                | 无                                                           | 仍为时间戳     |
| **B. 客户端补两处缺口**                     | ① pull「本地胜」分支**回写 base = remoteTs**（RC-3）② push 回执后把**派生行的新版本**纳入 base（需服务端**先**能提供该版本，见 C/D）；③ `put`+`markDirty` 收进**同一 Dexie 事务**（RC-5） | **中**（客户端若干写路径 + 测试；③ 面较大） | 中（7 域本地写仓储需统一事务化；回归面 R-01…R-09）                             | 无（不改 schema） | **消除** RC-5 静默窗口                                       | 仍为时间戳     |
| **C. 服务端权威版本号 / ETag**（根治）      | ① 回执里带上**被本次请求影响的所有行**（含派生行）的版本，或②新增**单调 `version` 列**（或行级 `sync_version`）作令牌 + `If-Match` 语义；客户端 base 用 version 而非时间戳                | **高**（协议 additive/语义变更 + DB 迁移）  | 高（C-44 协议评审 + 移动端共享 REST 面 + 迁移/回滚）；收益：**彻底去时钟依赖** | **需 DB 迁移**    | 无（判定变严格后**冲突可能短期增多**，需 UX 同批）           | **改为版本号** |
| **D. 仅部署已合并的 OCC**（部署级）         | 把 `nao-todo-server` 的 `54e843d`/`ac72a37`（及后续 `7a25e86`/`a846c16`）部署到位；客户端零改动（additive、向后兼容）                                                                     | **最低**（一次部署）                        | 低；但**只把 `noop` 变成 `stale`**，RC-1/RC-3 仍在（冲突**更可见**，不更少）   | 无                | 无（但**离线陈旧 base 会显著变多**，见 2B R-16，需发布说明） | 仍为时间戳     |
| **E.（对照，不采纳）字段级合并 / 版本向量** | 见 §14 备选模式                                                                                                                                                                           | 高                                          | 高                                                                             | 需 schema         | —                                                            | 改语义         |

### 推荐（arch 建议，非拍板）

1. **立即（低风险、可独立发布）**：**D + A + B③** —— 部署已合并的 OCC（让 `stale` 真正产生并可观测）、修校准接线、把本地写与入队事务化（消 ③/③′ 静默窗口）。
2. **紧随（本批，中风险）**：**B① + C①**（pull 本地胜 rebase；服务端回执带上**派生行**的版本 —— 这是 RC-1 的直击修法，且**不需要 DB 迁移**，只扩 `SyncResult`/或新增 `syncVersions` 增量，属 C-44 additive）。
3. **根治（下一批，高风险）**：**C② 单调 `version` 列**（去时间戳依赖）—— 与 2B ADR 的 N3「本批不做」一致；**仅在 1+2 之后仍持续出现冲突时才做**。
4. **无论选哪条**：`deletions` 不参与 OCC（R-15b）与同 ms 令牌碰撞（R-14）**继续登记**；冲突 UX 需保证「败方快照不得因上限淘汰而静默丢失」（或把淘汰也做成可见事件）。

### 实施里程碑（供 PM 派单拆单用）

| 阶段 | 内容                                                          | Owner        | 依赖   | 交付判据（摘要）                                               |
| :--- | :------------------------------------------------------------ | :----------- | :----- | :------------------------------------------------------------- |
| M0   | **DP-T325-1…4 拍板** + 用户补充信息清单回收                   | PM / 用户    | 本 ADR | 服务端部署事实锁定；修法范围锁定                               |
| M1   | **A：校准接线修复**（push/pull `serverTime` 读层 + 接线断言） | rd-fe        | M0     | AC-T325-1/2 绿；`server-time-calibration.test.ts` 新增接线用例 |
| M2   | **B③：本地写 + 入队事务化**（7 域仓储）                       | rd-fe        | M0     | AC-T325-7/8 绿；R-01…R-06 零回归                               |
| M3   | **D：OCC 服务端部署到生产**                                   | rd-be / 部署 | M0     | 二进制/接口含 OCC；`stale` 契约可用（AC-T325-6）               |
| M4   | **B①：pull 本地胜 rebase base**                               | rd-fe        | M1     | AC-T325-3 绿                                                   |
| M5   | **C①：服务端回执带派生行版本**（additive，C-44 评审）         | rd-be        | M3     | AC-T325-4 绿 + `R-A` 端到端（AC-T325-5）绿                     |
| M6   | **回归 + 终验**：回归矩阵 + 全范围门禁 8 项 + 移动端 0        | qa           | M1–M5  | 全仓门禁全绿 + 冲突计数实机验证                                |
| M7   | （可选）**C②：单调 `version` 列**                             | arch / rd-be | M6     | 仅在 1+2 后仍持续冲突时启动                                    |

### 连带同步清单（含 Owner）

> 本篇**改变/更正既有结论**：2B ADR 声称「2A 已补时间基准 / PS-15 生效」，实测**接线失效**；发布说明声称 OCC 已随 v1.11 落地，**运行服务端实际可能未部署**。以下文档须同步（禁只改一处）。

| #   | 位置                                                                                                      | Owner | 须同步内容                                                                                                           | 状态 |
| :-- | :-------------------------------------------------------------------------------------------------------- | :---- | :------------------------------------------------------------------------------------------------------------------- | :--- |
| S1  | `docs/adr/2026-09-24-stage2-both-ends-local-first.md`（§1.1 时间校准行 / PS-15 / §9.1.6 / §9.7 执行状态） | arch  | PS-15 标注「接线失效（T325）」；OCC 的 base 生命周期补「派生写不回传」局限                                           | ⏳   |
| S2  | `docs/reports/defect-pool.md`                                                                             | PM    | 登记 `DEF-49`（校准失效）/ `DEF-50`（派生写不回传）/ `DEF-51`（pull 本地胜不 rebase）/ `DEF-52`（写+入队非原子，P1） | ⏳   |
| S3  | `docs/releases/v1.11.0.md`（兼容与数据节）                                                                | PM    | 修正「建议与服务端同批部署」为**必须核验部署**；补「OCC 未部署时 `stale` 不可达」说明                                | ⏳   |
| S4  | `docs/tasks-state.md`                                                                                     | PM    | `T325` 回执 + M0–M7 派单登记                                                                                         | ⏳   |
| S5  | 客户端测试 `server-time-calibration.test.ts`                                                              | rd-fe | 补**接线断言**（AC-T325-1）                                                                                          | ⏳   |
| S6  | 服务端 `interfaces/types/sync.go` + `controllers/sync.go`（派生行版本回传）                               | rd-be | C① additive 字段 + 契约测试（AC-T325-4）                                                                             | ⏳   |
| S7  | `packages/infrastructure/src/persistence-sync/sync-service.ts`（`:750-752` / `:1101-1102` / `:864`）      | rd-fe | A + B① 实现点                                                                                                        | ⏳   |

### 实现 AC 草案（供 PM 直接据以派单）

> 口径：`AC-T325-x` 为**验收断言**（可自动化）；`INV` 为不变量。**修复前必须先锁定 DP-T325-1（服务端是否已部署 OCC）**，否则 `stale` 类用例在旧服务端上不可达。

| #              | 覆盖 | AC（可执行断言）                                                                                                                                                                                        | 判据（改前必红/改后必绿）                                                                                                  |
| :------------- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------- |
| **AC-T325-1**  | RC-2 | **同步响应含 `serverTime` ⇒ `getServerTimeOffset()` 必须被写入非零值**（push 与 pull 各一例）；断言 `Number.isFinite` 且 `!== 0`（构造 offset=+17ms 的响应）                                            | `__tests__/server-time-calibration.test.ts` 现**无此用例**（新红）；实现后绿                                               |
| **AC-T325-2**  | RC-2 | 校准生效后：**连续两次编辑同一实体**（第二次紧跟前一次 push 完成）⇒ **不得**产生 `noop`/`remote-wins`/`stale`（冲突计数 +0）                                                                            | `R-C` 探针（改前有冲突 ⇒ 红）；改后绿                                                                                      |
| **AC-T325-3**  | RC-3 | pull 命中 `queued` 且 **`remoteTs <= localTs`（本地胜）** ⇒ 断言该行 `syncedServerUpdatedAt === remoteTs`（base 必须 rebase）；随后 push 断言回执 `applied`（且 base 命中）                             | 当前实现不写 base ⇒ 新红；改后绿                                                                                           |
| **AC-T325-4**  | RC-1 | **同批**含父任务与子实体（检查项/评论/子任务）时：服务端回执必须让客户端能把**被派生写的父任务**的 base 刷新到其**当前服务端版本**（新增断言：`parent.syncedServerUpdatedAt` 与库中 `updated_at` 相等） | 当前无派生行版本通道 ⇒ 新红；改后绿（服务端 additive 回执 / 或 pull 增量）                                                 |
| **AC-T325-5**  | RC-1 | **R-A 端到端**：改名任务 T（push 完成）→ 加检查项（push 完成）→ 再改名 T（push 完成）⇒ **冲突计数 +0**，且服务端最终名称 = 最后一次改名                                                                 | 改前必红（`stale`/`noop` + 冲突 +1）；改后绿                                                                               |
| **AC-T325-6**  | RC-4 | 服务端契约测试：`baseUpdatedAt` 命中 ⇒ 回执 `applied`；不匹配 ⇒ `stale` 且 `serverUpdatedAt = 库中当前版本`；**缺失 ⇒ 行为逐字不变（LWW）**                                                             | 服务端已有（2B R-10/R-11/R-12）；**须新增一条“部署版本自检”**（二进制/接口含 OCC ⇒ 否则 `stale` 用例标记为 skip 而非假红） |
| **AC-T325-7**  | RC-5 | **本地写 + 入队原子性**：在 `put` 与 `markDirty` 之间注入一次并发 `applyPullBatch`（同一 id，`remoteTs > localTs`）⇒ 断言本地行不得被覆盖（或**必须**产生 journal 败方快照）                            | 当前两条独立 await ⇒ 可构造出无 journal 覆盖 ⇒ 红；事务化后绿                                                              |
| **AC-T325-8**  | RC-5 | **出队竞态**：推送在飞时写入同 id 新内容且 `localUpdatedAt` 与快照**同毫秒** ⇒ 断言队列项**不被移除**（新内容仍会被推送）                                                                               | 当前守卫 `=== snapshot` 会误判移除 ⇒ 红；改后绿（比较改为内容/版本而非时间戳）                                             |
| **INV-T325-1** | 全域 | **任何**本地未确认写入最终必须要么被服务端接受，要么以**可见冲突（含可恢复快照）**呈现；不存在“既未接受也无快照”的窗口                                                                                  | 由 AC-T325-7/8 + 既有 journal 用例联合守护                                                                                 |
| **INV-T325-2** | 全域 | 客户端 `syncedServerUpdatedAt` 必须在**每一次**服务端行版本变化后一个同步周期内收敛到服务端值（不依赖“用户恰好又改了一次”）                                                                             | 由 AC-T325-3/4 守护                                                                                                        |

> **不在本 AC 草案内**（需另单）：单调 `version` 列 / DB 迁移（C②）· 字段级合并 · 版本向量 · `deletions` 纳入 OCC。

---

## 12. 待 PM 拍板决策点（不替 PM 拍板）

| #             | 议题                                                                                                       | arch 建议                                                                                             | 备注                                                     |
| :------------ | :--------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| **DP-T325-1** | **RC-4 定性**：生产服务端是否已部署 OCC？若未部署 ⇒ 本单是否先只做「部署 + A」，把「B①/ C①」拆下一单       | **先核验部署**（§12 清单第 1 项）；未部署 ⇒ **D 优先**，避免在旧服务端上写"不可能绿"的 `stale` 红测试 | 决定 `stale` 是否可复现、以及红测试的口径                |
| **DP-T325-2** | **RC-1 修法**：服务端回执补「派生行版本」（additive，无迁移）vs 直接上单调 `version`（有迁移）             | **先 additive 回执**（C①）；`version` 列留作下一批                                                    | C① 触及 C-44 协议评审（additive 放行口径）               |
| **DP-T325-3** | **RC-5 定级与范围**：是否把「本地写 + 入队」事务化作为**本批 P1**（涉及 7 域本地写仓储，回归面较大）       | **P1，但单独成单**（与冲突判定解耦；先修 TOCTOU，再修判定基准）                                       | 若不修 ⇒ **必须**在发布说明/缺陷池登记「窄窗口静默覆盖」 |
| **DP-T325-4** | **RC-2 的客户端兜底**：修校准接线之外，是否同时把客户端时间戳**向上取整/加保守偏移**（宁可"看起来更新"）？ | **不采用**（会放大"覆盖他端较新写"，违 PS-15 本意）；**只修接线 + 提交给 OCC**                        | 可用「乐观方向」需用户显式知情（安全取舍）               |

### 需要用户补充的最小信息清单（回执给 PM）

1. **生产服务端是否包含 OCC**（`nao-todo-server` 是否部署了 `54e843d`）？如何部署/更新？
2. 冲突列表里那条的**类型文案**是哪种：**「版本不匹配」(`stale`)** / **「服务端未写入」(`push-noop`)** / **「远端覆盖」(`remote-wins`)** / **「ID 冲突」**？
3. 冲突是否出现在**同一台 desktop**上（无第二端在线）？复现时**另一台设备/网页版**是否也在改同一账号？
4. 复现时用户是否刚做过**加/勾检查项、写评论、建子任务**（或移动任务到另一清单）？
5. 「十几毫秒」的具体一对时间戳（各一条）—— 用于反推 δ 与服务端处理间隔。
6. 客户端与服务端机器的**时钟偏差**（可用「服务端 `serverTime`」与本地 `Date.now()` 对拍，或两端 `ntpq -p`）。
7. 冲突条数（是否持续累积）与是否点了「保留服务端版本 / 以我的版本重试」后复发。

---

## 13. 风险清单（影响 + 应对）

| #    | 风险                                          | 影响                           | 应对                                                        |
| :--- | :-------------------------------------------- | :----------------------------- | :---------------------------------------------------------- |
| TR-1 | RC-1 派生写不回传 ⇒ 父任务/清单 base 静默过期 | 伪冲突；本地改动被拒后需手恢复 | 修法 C①（回执带派生行版本）+ B①（pull rebase）              |
| TR-2 | 校准失效 ⇒ 裸客户端时钟决定 LWW               | 伪冲突 / 覆盖他端较新写        | 修法 A（接线）+ 接线断言；根治 C②                           |
| TR-3 | RC-5 静默覆盖（put/markDirty 非原子）         | **静默丢用户编辑（P1）**       | 本地写与入队同事务；发布说明/缺陷池登记                     |
| TR-4 | 冲突 journal 上限 200 淘汰 ⇒ 败方快照丢失     | 「不丢数据」弱化               | 淘汰计入可见事件（已有 `evictedCount`）+ 提高上限或导出     |
| TR-5 | `stale` 出队后本地改动不再重推（C-3）         | 用户不处理则丢                 | 冲突 UX 默认动作要显式；或 `stale` 不出队（改为待用户处理） |
| TR-6 | `deletions` 无 OCC                            | 删除覆盖较新编辑（R-15b）      | 继续登记；OCC 扩展再评估                                    |
| TR-7 | 同 ms 令牌碰撞（R-14）                        | 漏判一次冲突                   | 登记；`version` 列可根治                                    |
| TR-8 | 部署 OCC 后冲突"变多"（R-16）                 | 用户观感                       | 发布说明明确「可见化取代静默覆盖」；UX 引导                 |
| TR-9 | 修复面跨两端 + 本地写事务化 ⇒ 回归面大        | 阶段一/2A 回归                 | 沿用回归矩阵 R-01…R-20 + 绑定级断言                         |

---

## 14. 对照过的备选模式（含不采纳理由）

| 备选                                       | 适用条件 / 代价                                                             | 不采纳理由（本场景）                                                   |
| :----------------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **维持现状（时间戳 + per-row LWW）**       | 代价 0；但并发令牌来自两个不可信时钟 ⇒ **伪冲突是结构性的**                 | 现状即报告中的缺陷来源                                                 |
| **服务端权威单调版本 / ETag (`If-Match`)** | 服务端单一权威；需协议 additive + 可能 DB 迁移；团队零学习成本（HTTP 常识） | **本次推荐为根治路径（C）**，非"不采纳"；仅因迁移成本排后              |
| **OCC（base = 服务端 `updated_at`）**      | 已实现（2B）；不改 schema；**仍以时间戳为令牌** ⇒ 保留 R-14 同 ms 碰撞      | **采用为过渡态**（RC-3/RC-1 修好即可显著收敛）；不单独根治             |
| **LWW（纯后写覆盖）**                      | 最简单；无 base                                                             | 会**静默覆盖**较新的他端写（PS-8/PS-15 明确排除）                      |
| **版本向量（VV）**                         | 多主合并场景                                                                | 服务端是唯一权威、无多主需求 ⇒ **过度设计**（沿用 2B ADR 否决）        |
| **字段级合并**                             | 两端改不同字段时减少冲突                                                    | 与"服务端给出确定结论"冲突；需字段级版本 + 冲突 UX ⇒ 过度设计（N1）    |
| **混合逻辑时钟（HLC）**                    | 分布式系统里兼顾物理时间与因果序；需节点 id + 时钟同步假设                  | 本项目非多写者 P2P；**收益可由 OCC/version 达成、复杂度更高** ⇒ 不采纳 |

---

## 15. 参考来源

- **外部检索**：**未检索到**（本单未进行外网检索；上述模式为通用工程模式，未引用外部链接）。若 PM 需要业界对照（Dynamo/Cassandra LWW、HTTP ETag/If-Match、Riak `vclock`、HLC 论文），可在派单时要求补检索并落 `docs/research/`。
- **仓内事实源（逐条已给行号）**：
    - `packages/infrastructure/src/persistence-sync/sync-service.ts`（`:478-482, 499-516, 523-534, 750-752, 820-865, 1008-1017, 1101-1102, 1141-1183`）
    - `packages/infrastructure/src/persistence-sync/sync-config.ts:52-75`；`sync-tracker.ts:34-60`；`conflict-journal.ts`（journal/compare）
    - `packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts`；`task-repo-impl.ts:155-160`、`:289-311`（事务范式对照）
    - `packages/shared/requester/axios.ts:184-196`；`packages/infrastructure/src/persistence-go/task/task-repo-impl.ts:39`
    - `nao-todo-server/domain/types/upsert.go:37-60`；`infrastructure/persistence/task/repoImpl.go:107-150, 989-1031`；`infrastructure/persistence/project/repoImpl.go:353-370`；`interfaces/controllers/sync.go:53-66, 94-243, 265-271, 461-467`；`interfaces/types/sync.go:81-113`；`application/idutil/timefmt.go:5-21`
- **运行实例核验**（只读）：`naotodo-mysql` 的 `information_schema.columns`（`datetime(3)`）；`naotodo-server` 二进制 mtime 与 `strings`（无 `baseUpdatedAt`）
- **文档**：`docs/adr/2026-09-24-stage2-both-ends-local-first.md`（PS-12…PS-16 / §9.1–§9.10）· `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-44/C-59/C-66）· `docs/releases/v1.11.0.md` · `docs/reports/defect-pool.md`

---

## 16. 明确「不做」/边界

- ⛔ **不实现、不改任何代码/测试**（含服务端）；本单为纯文档产出。
- ⛔ 不合并 PR、不部署、不改运行环境。
- ⛔ 不替 PM 拍板 DP-T325-1…4。
- 本单**未**判定 RC-4 的用户生产事实（仅核验了本机实例）——列为待用户补充信息。

---

## 变更记录

| 版本 | 日期       | 变更                                                                                                                                                                                                              |
| :--- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| r1   | 2026-09-28 | 首次成文（`T325`）：全链路判定 / 时间精度 / 判定边界 / 时钟关系 / 队列语义 / 数据安全结论 / 根因排序（RC-1…RC-5）/ 单端可复现性 / 最小复现 R-A…R-C / 修法对照与推荐 / AC 草案 / 待拍板 DP-T325-1…4 / 用户补充清单 |