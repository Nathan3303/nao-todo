# 2026-09-13 SHELL-06：离线写入与自动回传（暂停-恢复语义 + nextAttemptAt 退避 + 回传触发）

- **评审对象**：`docs/prds/2026-09-13-shell-06-offline-backfill.md`（R1–R5 / 缺口 G1–G4·G8·G11 + G6/G13 / AC1–AC7 / D12–D15 已定稿）
- **结论**：✅ **有条件可行**（约束 C-38…C-45；D12–D15 已由用户/PM 定稿，本 ADR 固化实现口径，无新增待拍板）
- **范围**：`packages/infrastructure/src/persistence-sync/*`（推送重试生命周期 + 回传触发）+ `packages/infrastructure/src/persistence-local/db/local-database.ts`（队列记录**纯追加**字段）+ desktop/web 装配层触发注册 + 同步状态 UI（复用 SHELL-02 状态轨）
- **代码边界**：本 ADR 为**纯文档产出**，评审方未修改仓库代码（只读评审）
- **前序**：`docs/adr/2026-09-13-shell-05-offline-entry-hardening.md` §11.3（缺口表）/ §11.4（PRE-SHELL-06 设计）；`docs/adr/2026-09-10-shell-03-offline-availability.md`（C-07…C-11 运行边界、C-22 禁 `navigator.onLine` 鉴权）

---

## 0. 与 SHELL-05 / SHELL-03 的关系

| 关系                | 说明                                                                                                                                                                                                                          |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHELL-05 → SHELL-06 | SHELL-05 修「**进得去**」（H6/H1/D-08/B-07/B-04）；SHELL-06 修「**写得回**」。SHELL-05 §11.4 的 R1–R5 在此**升格为正式约束与落点**，不得再由 SHELL-05 承载                                                                    |
| SHELL-06 → SHELL-03 | **不改** SHELL-03 的 run 生命周期语义（C-07…C-11：`beginRun/noteRunError/endRun`、`lastError` 聚合、`lastSyncAt` 仅成功推进、`SyncRunResult` 判成败）。SHELL-06 只**新增**「重试生命周期」（暂停/退避/触发），与 run 边界正交 |
| 冲突裁决            | 若本 ADR 与 SHELL-03/SHELL-05 冲突，以**更晚落盘并经评审**者为准，并在两篇「变更管理」互记一行                                                                                                                                |

---

## 1. 缺口与根因（证据）

> 行号取自评审快照（2026-09-13）。定位歧义时以符号名/函数名为准。

| ID      | 现象                                                        | 根因（证据）                                                                                                                                                                   | 严重度       |
| :------ | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| **G1**  | 离线写入项 `retryCount>=5` 后**永不重推**，联网恢复也不补传 | `sync-service.ts:246` `MAX_PUSH_RETRY=5`；`:599` `if (item.retryCount >= MAX_PUSH_RETRY) continue`；全库**无 `retryCount` 重置路径**（`sync-tracker.ts` 仅有 `+1` 与出队删除） | Must         |
| **G2**  | 离线几次编辑即触顶                                          | 一次网络失败对**整批**快照队列 `markFailed()`（`sync-service.ts:640-648`，每项 +1）                                                                                            | Must         |
| **G3**  | 恢复网络后**不自动补传**（仅手动/重启）                     | 全库无 `addEventListener('online')` / `visibilitychange` / 周期退避；`schedulePush()` 仅由本地写 2s 防抖触发（`sync-service.ts:711-717`）                                      | Must         |
| **G4**  | 无本地写上限/暂停可见性                                     | 无队列总量/单表阈值判定，无「暂停/待同步」终态（SHELL-03 L2 遗留）                                                                                                             | Must         |
| **G8**  | 触顶的**删除**项永不推送 → 远端数据「复活」                 | 同 G1：`pushAllInner` 在分类 upsert/delete **之前**跳过触顶项（`:598-600`），`deletions` 一并被跳过                                                                            | Must         |
| **G11** | 离线期每次写仍发起无效推送，加速触顶                        | `syncTracker.markDirty → dirtyListener → schedulePush`（`sync-tracker.ts:50`、`sync-service.ts:711`）无离线/退避判断；每次失败又对整批 +1                                      | Must         |
| **G6**  | 触顶后每次冷启动 `start()` 恒失败 ⇒ 门恒失败                | G1 衍生：`:630-634` `noteRunError(ERR_PUSH_RETRY_EXCEEDED)`                                                                                                                    | Should（P1） |
| **G13** | 会话管理离线 toast 噪声                                     | `session-manager.vue:18-27` `loadSessions` 远程失败直接 `NueMessage.error`，无离线降级态                                                                                       | Could（P1）  |

**共同根因**：同步层只有「**run 边界**」（一次运行成败可判），没有「**重试生命周期**」（暂停/退避/恢复/触发）。于是把「网络不可达」与「真实失败」混为一谈地累加计数，且没有任何「连接恢复」的唤醒源 ⇒ 队列一旦触顶即**永久滞留**。

**已具备的防线（不得回退）**：

- 拉取 LWW：本地有未推送修改（在 `syncQueue`）时**保留队列**（`applyPullBatch:505-518`）。
- 推送确认：发送前快照 `localUpdatedAt`，确认时若本地又改则**保留队列重推**（`:687-693`）。
- 运行必达结束（SHELL-03 C-08 / DEF-SYNC-02/03 修复）。

---

## 2. 决策（D12–D15 已定稿，本 ADR 固化口径）

| #       | 议题             | 定稿结论                                                                        | 本 ADR 口径                                                    |
| :------ | :--------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| **D12** | 重试机制         | ✅ 改 **`nextAttemptAt` 指数退避**                                              | 废弃 `retryCount>=MAX` 硬跳过；改 `nextAttemptAt` 退避（C-39） |
| **D13** | 周期退避定时     | ✅ 引入（仅当有待推送/失败，最长 **120s**，成功即停）                           | 触发源之一，经 `enqueue` 串行、有界且可停（C-40）              |
| **D14** | 写上限阈值与文案 | ✅ **单表 1000 / 总量 2000**；文案「有 N 项修改待同步（离线，联网后自动同步）」 | 上限仅**提示不阻断**；文案 i18n 化（C-41）                     |
| **D15** | G6/G13           | ✅ **随单（P1）**                                                               | G6 由「启动重置 + 退避」自然消解；G13 离线占位降级             |
| **Q**   | QA（T3）         | ✅ 启用                                                                         | BC-13…BC-16 由 QA 在打包态实机回归                             |

### 2.1 R1–R5 最小方案（PRD §3 P0 的设计口径）

- **R1 回传触发（re-submission）**：
    - 触发源：① 启动/解锁（既有 `start()`）；② 前台恢复（`visibilitychange → visible`，**节流**）；③ **条件指数退避定时**（仅当存在「待推送或暂停/退避」项：5s→10s→30s→60s→120s 封顶，成功/队列清空即停）；④ `online` 事件即时一次。
    - **全部经 `syncService.enqueue` 串行**，防并发/重入（C-45）。
    - **`online` / `navigator.onLine` 仅作触发或提示，不作鉴权/放行判据**（承接 C-22；`offline` 事件**不阻断**任何功能）。
- **R2 重试语义（暂停 vs 真实失败）**：
    - **网络类**（`ERR_NETWORK`/超时/`ECONNABORTED`/5xx/归一化断网）⇒ **暂停**：**不递增 `attempts`**，仅置服务级 `pausedUntil` 与 `lastAttemptAt`；网络/前台恢复 ⇒ **清暂停并立即重试**（根治 G2/G11）。
    - **业务/数据类**（推送未确认、字段不匹配、非 401/403 的 4xx）⇒ 计 `attempts` + `nextAttemptAt = now + min(BASE·2^attempts, 120s)`（退避封顶，**不设永久跳过**）。
    - **凭证类**（401/403/10041）⇒ 维持现状：不计退避、不清队列、走会话失效跳登录（C-06/C-34）。
- **R3 写上限与暂停可见性**：`syncStatus` 新增 `paused`/`pendingCount`/`failedCount` 展示；队列超阈值（单表 1000 / 总量 2000）⇒ UI 显式「待同步（暂停）」+ 计数 + 「立即重试」；**不阻断本地写、不丢数据**（C-41）。
- **R4 触顶/暂停可恢复（含删除项）**：新增 `syncTracker.resetFailed(userId)`（清 `attempts`/`nextAttemptAt`）与 `syncService.resumeBackfill()`（清 `pausedUntil`），在**手动同步 / 网络恢复 / 前台恢复 / 启动**时调用；`deletions` 与 upsert **同策略**（不再有「删除项永久跳过」）。
- **R5 不阻塞功能（AC11 不回退）**：本地 CRUD 不等网络；同步状态只读展示；任何同步态不得改变页面可用性。

---

## 3. 约束清单（C-38…C-45，承接 SHELL-05 C-37）

- [ ] **C-38 失败分类与暂停语义（P0）**：推送失败必须三分类处理——**网络类=暂停**（不消耗重试额度）、**业务/数据类=退避**、**凭证类=会话失效**。网络类判定以既有归一化结果为准（`ERR_NETWORK`/超时/5xx/归一化 `code`），**禁止**把网络类计入 `attempts`。`navigator.onLine` 不得作为分类依据。
- [ ] **C-39 `nextAttemptAt` 退避（P0）**：每条队列记录以 `nextAttemptAt` 决定何时可再推送（替代 `retryCount >= MAX_PUSH_RETRY` 永久跳过）。退避为**指数封顶 120s**；`attempts` 仅业务/数据类递增；**成功出队**即结束其生命周期。
- [ ] **C-40 回传触发源与限频（P0）**：启动/解锁、前台恢复（节流）、条件退避定时（5s→…→120s 封顶、成功即停）、`online` 即时一次，四源均经 `enqueue` 串行；定时器**有界且可停**（无待推送/暂停项时不得存在常驻定时器）。
- [ ] **C-41 队列上限与不丢数据（P0）**：单表 1000 / 总量 2000；超限**仅提示**（「有 N 项修改待同步（离线，联网后自动同步）」）并进入可见的「待同步（暂停）」态，**不得阻断本地写、不得丢弃/静默**；文案走 i18n 键（`locales/{types,zh-CN,en-US}.ts` 三处）。
- [ ] **C-42 暂停/触顶可恢复（含删除项，P0）**：任何「暂停/退避/超限」态都必须存在恢复路径（手动同步 / 网络恢复 / 前台恢复 / 启动）；`upsert` 与 `delete` 队列项**同策略**（消除 G8 的远端数据「复活」）。
- [ ] **C-43 `online` 不作鉴权（P0，承接 C-22）**：`online`/`navigator.onLine` 仅可作触发/提示；**不得**用于路由放行、离线进入授权、会话有效性判定。
- [ ] **C-44 协议冻结与纯追加兼容（P0）**：不改同步协议/表结构/游标；`SyncQueueRecord` 新字段（`attempts`/`nextAttemptAt`/`lastErrorClass`）与 `SyncStatusState` 新字段（`paused` 等）均为**可选/纯追加**，**旧记录无新字段即视为「可立即推送」**（向后兼容）；Dexie 不新增索引、不改 schema 版本（若确需索引/版本变更，必须回到架构评审）。
- [ ] **C-45 串行与运行边界兼容（P0）**：所有推送入口经 `enqueue` 串行；沿用 SHELL-03 运行边界（`beginRun → noteRunError* → endRun`，任何 return/throw 不得绕过 `endRun`）；`SyncRunResult` 字段**只增不改**；`lastSyncAt` 仍仅成功推进；`ok=false` 语义不变（门仍据此判失败，但**触顶不再永久失败**：启动重置 + 退避使其在联网后自愈，见 G6）。

---

## 4. 最小方案与文件级落点

> 单写者纪律：改动集中 `packages/infrastructure/src/persistence-sync/*`，由**同一 writer 串行**完成，避免与在飞单改同文件冲突。

| #            | 文件                                                                                                                                              | 改动                                                                                                                                                                                                                                                                                                                                             | 约束                |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------ |
| **F1**       | `packages/infrastructure/src/persistence-local/db/local-database.ts`                                                                              | `SyncQueueRecord` 纯追加：`attempts?: number`、`nextAttemptAt?: string \| null`、`lastErrorClass?: 'network' \| 'business' \| 'credential'`（**不新增索引、不改 version**）                                                                                                                                                                      | C-44                |
| **F2**       | `packages/infrastructure/src/persistence-sync/sync-tracker.ts`                                                                                    | `markFailed` 拆为 `markBusinessFailure(id, nextAt)`；新增 `resetFailed(userId)`、`countByTable(userId)`、`countPaused(userId)`；`markDirty` 合并时**保留** `attempts/nextAttemptAt`（同实体重写不重置退避，但 `nextAttemptAt` 过期即可推）                                                                                                       | C-38/C-39/C-41/C-42 |
| **F3**       | `packages/infrastructure/src/persistence-sync/sync-service.ts`                                                                                    | ① 推送循环跳过条件改 `nextAttemptAt > now` / `pausedUntil > now`；② 网络类失败**不 `markFailed`**（置 `pausedUntil` + `lastAttemptAt`）；业务类 `attempts++` + 指数退避；凭证类维持；③ 新增 `resumeBackfill()`（清 `pausedUntil`，经 `enqueue`）；④ `start()/manualSync()` 入口先 `resetFailed` + `resumeBackfill`；⑤ **删除项与 upsert 同策略** | C-38/C-39/C-42/C-45 |
| **F4**       | `packages/infrastructure/src/persistence-sync/sync-status.ts`                                                                                     | `SyncStatusState` 纯追加：`paused: boolean`、`pausedReason?: 'offline' \| 'over-limit'`；`beginRun/endRun` 语义不动                                                                                                                                                                                                                              | C-41/C-44/C-45      |
| **F5**       | 装配层触发注册：`apps/desktop/src/renderer/src/AppRoot.vue`（已有 `syncTracker.setDirtyListener`）、`apps/web/src/app.ts`（可选）                 | 注册 `online` / `visibilitychange`（节流）→ `syncService` 触发；退避定时的启停由 service 内部按「有待推送/暂停项」管理                                                                                                                                                                                                                           | C-40/C-43           |
| **F6**       | 状态 UI：`apps/desktop/src/renderer/src/components/sync-status-bar.vue` + `hooks/use-sync-status.ts`（复用 SHELL-02 状态轨宿主，不新增常驻大 UI） | 展示「待同步（暂停）/待推送 N/失败 N」+「立即重试」；超限文案 i18n                                                                                                                                                                                                                                                                               | C-41                |
| **F7**       | `packages/shared/locales/{types.ts,zh-CN.ts,en-US.ts}`                                                                                            | 新增 C-41 文案键（类型强制）；键名不得与在飞单重复                                                                                                                                                                                                                                                                                               | C-41                |
| **F8**（P1） | `packages/presentation-identity/src/components/session-manager/session-manager.vue`（G13）                                                        | 离线时置「需联网查看」占位，不弹 toast                                                                                                                                                                                                                                                                                                           | D15                 |

**不落点（明确）**：不改 `persistence-go/*`（远端适配器）、不改 `domain-*`（无领域不变量变化）、不改同步协议/表结构/游标、不新增网络请求类型。

---

## 5. 验收基线（BC-13…BC-16）与 SHELL-03 兼容

### 5.1 BC-13…BC-16（可测）

| 基线                                  | 定义                                                                                                                                                                 | 验证方式                                                                            |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **BC-13 离线回传自动恢复**            | 离线完成 N 次本地写（含删除）→ 恢复网络（**不手动操作**）⇒ 队列在 **≤1 个退避周期（≤120s）** 内 `pendingCount/failedCount → 0`，远端与本地一致（删除不回退「复活」） | 单测（注入 requester 断网→恢复）+ QA 实机（打包态，复用 `scripts/electron-smoke/`） |
| **BC-14 离线暂停不消耗重试额度**      | 离线连续 ≥5 次编辑 ⇒ `attempts` 不递增（网络类不计数）；恢复后立即重试直至补传成功                                                                                   | 单测（断言 `attempts`/`nextAttemptAt` 不变、恢复后出队）                            |
| **BC-15 触顶/暂停可恢复（含删除项）** | 构造「业务类退避/超限暂停」⇒ 手动同步 / 网络恢复 / 前台恢复 / 重启任一 ⇒ 触发重新入列并完成回传；删除项同样上报                                                      | 单测（分类注入 + 删除项用例）+ QA 实机                                              |
| **BC-16 本地写不阻塞/不丢**           | 队列超上限（单表 1000 / 总 2000）⇒ 继续本地写**不阻断、不丢**；UI 显式「待同步（暂停）+ 计数」；恢复后仍全部回传                                                     | 单测（灌队列至超限）+ 组件测试（文案/计数）+ QA 冒烟                                |

### 5.2 与 SHELL-03 运行边界的兼容（**不得回退**）

| SHELL-03 约束                                | SHELL-06 兼容性                                                                                |
| :------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| C-07 `beginRun/noteRunError/endRun` 运行边界 | **保持不变**；暂停/退避是**跨运行**的队列状态，不改变单次运行的开始/结束语义                   |
| C-08 任何 return/throw 必达 `endRun`         | **保持不变**；F3 新增分支必须在 `runFull` 内 return                                            |
| C-09 阶段不直接写 `lastError`                | **保持不变**；新增暂停态写 `syncStatus.paused`（独立字段），不篡改 `lastError`                 |
| C-10 门以 `SyncRunResult` 判成败             | **保持不变**（字段只增不改）；G6 通过「启动重置 + 退避」消解「触顶永久失败」，而非改变门的判据 |
| C-11 `lastSyncAt` 仅成功推进                 | **保持不变**                                                                                   |
| BC-3（拉取失败可见）/ BC-6（运行必终结）     | **保持不变**，SHELL-06 回归须复验                                                              |
| C-22 禁 `navigator.onLine` 鉴权              | **强化为 C-43**                                                                                |

---

## 6. 风险清单与回滚

| #        | 风险                                                                                                       | 影响                           | 应对                                                                                                       |
| :------- | :--------------------------------------------------------------------------------------------------------- | :----------------------------- | :--------------------------------------------------------------------------------------------------------- |
| R1       | 回传触发引入**请求风暴**                                                                                   | 无效推送、服务端压力、加速触顶 | C-40 限频 + 退避 + 仅「有待推送/暂停项」时启用定时 + `enqueue` 串行；G11 修复后离线期不再发无效推送        |
| R2       | 退避定时器**耗电/常驻**                                                                                    | 桌面端资源                     | 定时器**按需创建、成功/清空即 `clearTimeout`**；最长 120s；无待推送时不得存在                              |
| R3       | LWW 与队列交互被削弱                                                                                       | 本地修改丢失                   | **不改 LWW/快照逻辑**；退避只影响「何时发」，不影响「谁胜」（C-44/C-45；复验 `applyPullBatch` 与推送快照） |
| R4       | 凭证类失败被误判为业务类而无限退避                                                                         | 无效重试、账号风控             | C-38：401/403/10041 单列，维持会话失效路径（复验 C-34 结构化判定）                                         |
| R5       | 上限提示误伤/文案不 i18n                                                                                   | 体验/返工                      | 文案走 i18n 三文件（F7）；上限仅提示不阻断                                                                 |
| R6       | `SyncQueueRecord` 字段扩展破坏旧数据                                                                       | 老用户队列异常                 | C-44 纯追加 + 旧记录默认「可推」；**不新增索引/不改 Dexie 版本**                                           |
| R7       | `guard:ddd` 命中                                                                                           | CI 红                          | 改动在 `infrastructure` + `apps`（非 `domain-*`）；不得让 domain 反向依赖 infra；提交前跑 `pnpm guard:ddd` |
| **回滚** | 无协议/表结构变更 ⇒ **revert 对应提交**；队列数据向后兼容（纯追加字段被旧代码忽略），无需数据迁移/回滚脚本 |

---

## 7. 变更管理

1. 本 ADR 为 SHELL-06 实现基线；偏离 §3 任一约束 → 回到架构评审（口头同意不计）。
2. SHELL-06 与 SHELL-03 冲突 ⇒ 以本 ADR（更晚落盘并评审）为准，并在两篇「变更管理」互记一行。
3. 任何对同步协议/表结构/游标/`SyncRunResult` 现有字段语义的改动 → 必须重新评审（C-44/C-45 红线）。
4. `SyncQueueRecord` 若确需新增**索引**或 Dexie **版本升级** → 停止实现，回架构评审（涉及迁移）。
5. 归档：`docs/adr/`，索引更新 `docs/adr/README.md`；日期取评审终签日（2026-09-13）。
6. 实现完成后回填 PRD §12 派发记录（T1 R1+R2 / T2 R3+R4+G6/G13 / T3 QA 实机）。

---

## 8. 证据索引

> 行号取自评审快照（2026-09-13）。

- `packages/infrastructure/src/persistence-sync/sync-service.ts:246`（`MAX_PUSH_RETRY=5`）、`:244`（`PUSH_DEBOUNCE_MS=2000`）、`:598-600`（触顶跳过）、`:630-634`（全部触顶 → `ERR_PUSH_RETRY_EXCEEDED`）、`:636-655`（网络失败 → 整批 `markFailed`）、`:660-705`（凭证/归一化/未确认分类）、`:687-693`（快照冲突保留队列）、`:711-717`（`schedulePush` 2s 防抖）、`:362-372`（`start()`）
- `packages/infrastructure/src/persistence-sync/sync-tracker.ts:29-51`（`markDirty` 回调）、`:63-70`（`markFailed` +1）、`:87-96`（`countFailed`）
- `packages/infrastructure/src/persistence-local/db/local-database.ts:191-203`（`SyncQueueRecord`）、`:332`（`syncQueue: '&id, userId, table, retryCount'`）
- `packages/infrastructure/src/persistence-sync/sync-status.ts`（`SyncStatusState` 字段与 run 边界）
- `apps/desktop/src/renderer/src/AppRoot.vue`（`syncTracker.setDirtyListener` → `schedulePush`）
- `apps/desktop/src/renderer/src/components/sync-status-bar.vue`、`hooks/use-sync-status.ts`（状态 UI）
- `packages/presentation-identity/src/components/session-manager/session-manager.vue:18-27`（G13）
- 前序：`docs/adr/2026-09-13-shell-05-offline-entry-hardening.md` §11.3／§11.4；`docs/adr/2026-09-10-shell-03-offline-availability.md` C-07…C-11、C-22；`docs/prds/2026-09-13-shell-06-offline-backfill.md`