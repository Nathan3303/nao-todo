# TASK-26 偏好同步 · QA 独立复核报告（T135）

- **任务**：T135（qa 独立复核；**只复核，未改实现代码**）
- **复核对象**：客户端 `c2c24606`（T131，19 文件）· 服务端 `nao-todo-server@4728071`（T130）
- **依据**：本仓用例 `docs/qa/2026-09-23-task26-preference-sync-cases.md`（`754325f3`，52 用例）· ADR `docs/adr/2026-09-23-local-preference-sync.md`（`026f525d`，r2）· PRD v0.3 §7 AC + §14 Q-1（**权威 = PRD §7**，信封口径为超集，两套并行）
- **复核方式**：读码（客户端 + 跨仓服务端）· 定向单跑 · **独立变异 3 项** · 全范围门禁 8 项独立复跑 · 移动端 0
- **代码边界**：⛔ 未修改任何实现代码（变异均为临时改写，已全部还原，工作区 `git status --porcelain` = 0）

---

## 0. 结论摘要（先看这里）

| 项                      | 结论                                                                                                                                                                                                                             |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 红窗口                  | **7 → 0 已独立证实**：2 个骨架文件合跑 **6 例（write-gate）+ 4 例（calendar-scope）全绿**（4 文件合跑 32 例 / 0 红）                                                                                                             |
| 全范围门禁 8 项         | **全绿**，与 PM 数字**逐项一致**（见 §5）                                                                                                                                                                                        |
| 关键不变量 INV-01/03    | **成立**（读码 + 单跑 + 变异反证）                                                                                                                                                                                               |
| 契约对齐（T130 落地版） | **一致**（路径/字段/时间格式/空值/错误码逐条核对，见 §4）                                                                                                                                                                        |
| 变异 3 项               | **3/3 转红**（红数 2 / 2 / 1），已还原（见 §6）                                                                                                                                                                                  |
| **未过项**              | **2 项功能缺口**（P1 普通清单偏好无拉取恢复 · P2 失败不可见）+ 1 项次要（远端胜未清本地脏队列）见 §7                                                                                                                             |
| **发布建议**            | ⚠️ **有条件**：门禁/红窗口/不变量/契约均达标，但 **PRD §7 AC1/AC2 对「普通清单偏好」不成立**（web 由「远端优先读」改「纯本地读」后无拉取路径）⇒ 建议 **P1 返工（或用户明确登记接受）后再放行**；AC4「可见提示」为 P2，可挂后续单 |

> **一句话**：实现质量与门禁达标、7 红窗口确已闭合；但复核发现 **ADR §D-1b 的「普通清单偏好按行读时对账」未落地** —— 设置面（内建/侧边栏/日历）换设备/重登能从服务端恢复，**普通清单偏好不能**（本地被清即回默认，服务端数据读不到）。这是相对 T131 前 web 行为的**用户可见回归**，也是 PRD §7 AC1/AC2 的未满足项。

---

## 1. 覆盖矩阵终稿（52 用例逐项）

**图例**：✅ 已由自动化测试覆盖 · 🟡 部分覆盖（列缺口）· ⛔ 未覆盖（列原因）· 🧭 走查/门禁（非自动化断言）

### AC 主路径（26）

| 用例 ID         | 状态 | 覆盖载体 / 缺口                                                                                                                                                                            |
| :-------------- | :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PSYNC-AC1-01    | 🟡   | `preference-sync.test.ts`「PUT /user/config（装配全量快照）」覆盖快照+PUT+出队；**「本地写即时 + 队列出现」的接线未断言**（`built-in/project/repoImpl.ts:102` markPreferenceDirty 无测试） |
| PSYNC-AC1-02    | 🟡   | `preference-sync.test.ts`「POST /projects/:id/preference（按行）」覆盖路径/body/出队；**本地 IndexedDB 即时 + save→入队接线未断言**                                                        |
| PSYNC-AC1-03    | 🟡   | 快照 `asideWidth` 字段有断言；**`index-view.ts:123` resize→markPreferenceDirty 接线未断言**                                                                                                |
| PSYNC-AC1-04    | 🟡   | 快照 `calendar.{weekStart,pomodoroBadge,dayZoom}` 有断言；**`calendar-view.ts` 三处 watch→markPreferenceDirty 接线未断言**                                                                 |
| PSYNC-AC1-05    | 🧭   | **走查**：两端 binding 均返回 `newLocalProjectPreferenceRepository()`（web `binding.ts:129` / desktop `binding.ts:37`），web 不再 `withMirrorFallback` 远端直连；无自动化断言              |
| PSYNC-AC2-01    | 🟡   | `preference-write-gate.test.ts`「离线 updateUserConfig 透传（不拦截/不返回 OFFLINE_READONLY）」覆盖；**本地写入成功 + 队列项保留 + `NueMessage.warn` 未调用**未合并断言                    |
| PSYNC-AC2-02    | ⛔   | **无测试**：离线普通清单偏好本地写 + 队列项（`LocalProjectPreferenceRepoImpl.save` 离线路径）                                                                                              |
| PSYNC-AC2-03    | ⛔   | **无测试**：`online` 事件自动回传（`data-plane.ts:51/55`、`AppRoot.vue:157/161` 接线在 `data-plane.test.ts`/`AppRoot.test.ts` 中**仅被 mock**，无行为断言）                                |
| PSYNC-AC2-04    | 🟡   | 设置面本地优先（pull 前不覆盖本地）由 `pullAndMergeUserConfig` 分支覆盖；**普通清单偏好本地读（无远端回退）无行为断言**                                                                    |
| PSYNC-AC2-05    | ⛔   | **无测试**：store/computed 即时反映（无组件/store 断言）                                                                                                                                   |
| PSYNC-AC3-01    | 🟡   | 服务端整快照 LWW + `updated_at` 单调（服务端集成测试）；客户端快照推送（单测）；**两端端到端场景未覆盖**                                                                                   |
| PSYNC-AC3-02    | 🟡   | `preference-sync.test.ts`「服务端有更新快照 ⇒ 应用远端并记录 SETTINGS_SYNCED_AT」覆盖「远端胜」；**「本地脏 ⇒ 回传」与「远端胜 ⇒ 清本地脏」不完整**（见 §7 GAP-3）                         |
| PSYNC-AC3-03    | 🟡   | 同上（远端更新 ⇒ 应用远端）覆盖设置面；**普通清单偏好无对账**                                                                                                                              |
| PSYNC-AC3-04    | 🟡   | `pushPreferenceQueue` 返回 `{pushed, failed}`（单测断言）；**无状态面消费方**（见 §7 GAP-2）                                                                                               |
| PSYNC-AC3-05    | ⛔   | **无自动化**：数据守恒 / 白名单（人工判定）                                                                                                                                                |
| PSYNC-AC4-01    | ✅   | `preference-sync.test.ts`「网络类（5xx）⇒ 暂停不计数」（attempts 不变 + 队列保留）                                                                                                         |
| PSYNC-AC4-02    | ✅   | 「业务类（4xx）⇒ 指数退避」（attempts+1 + nextAttemptAt）                                                                                                                                  |
| PSYNC-AC4-03    | ✅   | 「凭证类（401）⇒ 标记 + 会话失效回调」（onSessionExpired 调用）                                                                                                                            |
| PSYNC-AC4-04    | ⛔   | **实现缺失**：失败仅静默降级 + 返回计数，无 `NueMessage`/状态面（见 §7 GAP-2）                                                                                                             |
| PSYNC-AC4-05    | ⛔   | **无测试**：重试触发源（启动/online/前台恢复）接线未被断言                                                                                                                                 |
| PSYNC-AC5-01    | 🟡   | 两端 binding 同构（走查）；desktop `binding.test.ts` 仅 mock，无行为比对                                                                                                                   |
| PSYNC-AC5-02 ⭐ | ✅   | `preference-write-gate.test.ts` 静态清单 ×2 + 离线行为 ×2（**变异 M1 反证**）                                                                                                              |
| PSYNC-AC5-03    | ✅   | `preference-write-gate.test.ts`「内建 savePreference 仍写本地 localStorage」                                                                                                               |
| PSYNC-AC5-04    | ✅   | 「离线业务写仍被拦截 + OFFLINE_READONLY + 原方法零调用」                                                                                                                                   |
| PSYNC-AC5-05    | ✅   | → REG-01…07（见下）                                                                                                                                                                        |
| PSYNC-AC5-06    | ✅   | 门禁命令：`git status --porcelain -- packages/presentation-react apps/mobile` = **0**                                                                                                      |

### 契约（9）— 客户端单测 + **跨仓服务端契约/路由/集成测试**

| 用例 ID | 状态 | 覆盖载体                                                                                                                               |
| :------ | :--- | :------------------------------------------------------------------------------------------------------------------------------------- |
| CT-01   | ✅   | 客户端 `preference-sync.test.ts`（PUT body 快照 version=1）+ 服务端 `user_config_contract_test.go`（RawMessage 透传）                  |
| CT-02   | ✅   | 客户端（`/projects/p-1/preference`，断言 `not.toContain('/project/')`）+ 服务端 `project_preference_route_test.go`（复数路由，禁单数） |
| CT-03   | ✅   | 客户端读 `updatedAt`；服务端 `idutil.FormatTimeMilli` = `RFC3339Milli`（毫秒）+ 集成测试断言服务端时间/单调                            |
| CT-04   | ✅   | 服务端契约测试：仅 `preferences`（缺失 appearance）绑定成功（不再 400）                                                                |
| CT-05   | ✅   | 服务端集成（列 nullable + NULL）+ 契约（未知键原样透传 / `null` 清除）                                                                 |
| CT-06   | ✅   | 服务端集成三态（仅 appearance / 仅 preferences / 两者互不覆盖）—— 同时闭合 **REG-05**                                                  |
| CT-07   | ✅   | 客户端 LWW 单测（伪造 `Date.now` 不影响结论）+ **变异 M2 反证**                                                                        |
| CT-08   | ✅   | 服务端集成（内建偏好只进 `user_configs.preferences`，不写 `project_preferences`）                                                      |
| CT-09   | ✅   | 服务端路由测试（REST 语义不变）+ 移动端门禁 = 0                                                                                        |

### 关键不变量（10）

| 用例 ID      | 状态 | 结论                                                                                                                                                                              |
| :----------- | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PSYNC-INV-01 | ✅   | **成立**：偏好入队后 `syncQueue.count()=0`、`countDirty=0`、`markDirty` 未被调用（单测 + **变异 M3**）                                                                            |
| PSYNC-INV-02 | 🟡   | 走查成立（binding 本地仓储，无远端优先读）；无行为断言                                                                                                                            |
| PSYNC-INV-03 | ✅   | **成立**：`isRemoteNewer` 仅用服务端 `updatedAt`，客户端时钟不参与（单测 + **变异 M2**）                                                                                          |
| PSYNC-INV-04 | ✅   | **成立**：`CALENDAR_WEEKSTART` 不在 `DEVICE_LEVEL_STORAGE_KEYS`、在 `USER_SCOPED_STORAGE_KEYS`，清库后被清（`calendar-preference-scope.test.ts` 4 例）                            |
| PSYNC-INV-05 | ✅   | = CT-09                                                                                                                                                                           |
| PSYNC-INV-06 | ✅   | = CT-08                                                                                                                                                                           |
| PSYNC-INV-07 | ✅   | = CT-05                                                                                                                                                                           |
| PSYNC-INV-08 | 🟡   | `meta` 单记录存储 + 去重有测试；**Dexie `version()` 未 bump / 未加索引为读码确认**（`local-database.ts` 仅加 `PreferenceQueueItem` 类型与可选字段，无 schema 变更），无自动化断言 |
| PSYNC-INV-09 | ✅   | **走查通过**：偏好面独立队列，不依赖 `syncQueue`/业务 `markDirty`/web 离线闸门；与终态 local-first 同构                                                                           |
| PSYNC-INV-10 | 🟡   | **读码确认** `TAG_WRITE_METHODS.savePreference = 'error'` 仍在（tagPreference 仍被拦，R-14/DP-5）；无自动化断言                                                                   |

### 阶段一零回归（7）

| 用例 ID      | 状态 | 覆盖载体                                                                                                  |
| :----------- | :--- | :-------------------------------------------------------------------------------------------------------- |
| PSYNC-REG-01 | ✅   | `offline/__tests__/freshness.test.ts`（全仓跑绿）                                                         |
| PSYNC-REG-02 | ✅   | `plaintext-migration.test.ts`                                                                             |
| PSYNC-REG-03 | ✅   | `deletion-wipe.test.ts`（含 `CALENDAR_WEEKSTART` 迁移后语义）                                             |
| PSYNC-REG-04 | ✅   | `deletion-wipe.test.ts`（`PLAINTEXT_NOTICE_ACK_KEY` 设备级保留）                                          |
| PSYNC-REG-05 | ✅   | 服务端集成 CT-06 三态                                                                                     |
| PSYNC-REG-06 | ✅   | `write-gate*.test.ts`（业务 `markDirty` 恒 0 + 离线拦截 + 闸门仍含业务写）                                |
| PSYNC-REG-07 | ✅   | `git status --porcelain -- packages/presentation-react apps/mobile` = **0** + `guard:mobile-imports` rc=0 |

**统计**：✅ **31** · 🟡 **14** · ⛔ **6** · 🧭 **1** = **52**。

---

## 2. 关键不变量独立验证（读码 + 单跑）

### INV-01（偏好不入业务同步引擎）✅ 成立

- 读码：`preference-queue.ts` 全文件**不 import** `sync-tracker`，仅写 `localDatabase.meta`（`preferenceQueue` 可选字段）；`preference-sync.ts` 注释与实现一致（`pushPreferenceQueue` 不触碰 `syncQueue`/`markDirty`/`pendingCount`）。
- 单跑：`preference-queue.test.ts` → 8 例全绿，其中 INV-01 例断言 `syncQueue.count()=0` / `countDirty=0` / `markDirty` 未调用。
- 反证：**变异 M3**（`savePreferenceQueue` 内追加 `syncTracker.markDirty`）⇒ **1 红**，证明该断言真实有效。

### INV-03（LWW 仅服务端时间）✅ 成立

- 读码：`isRemoteNewer(serverUpdatedAt, syncedAt)` 仅比较服务端 `updatedAt` 与本地 `SETTINGS_SYNCED_AT`；`SETTINGS_SYNCED_AT` 仅在推送成功后由**服务端返回值**写入（`writeSettingsSyncedAt(userId, outcome.serverUpdatedAt)`），客户端时间不参与。
- 单跑：`preference-sync.test.ts` → 14 例全绿，含「客户端时间戳不参与判定」例。
- 反证：**变异 M2**（`isRemoteNewer` 改用 `Date.now()`）⇒ **2 红**。

### INV-04（`CALENDAR_WEEKSTART` 用户级）✅ 成立

- `local-storage-policy.ts`：已从 `DEVICE_LEVEL_STORAGE_KEYS` 移除、加入 `USER_SCOPED_STORAGE_KEYS`；`clearUserScopedLocalStorage` 白名单驱动 ⇒ 登出即清。
- 单跑：`calendar-preference-scope.test.ts` → 4 例全绿（含「其它设备级键仍保留」回归）。

---

## 3. 阶段一零回归抽查

- 全仓 `vp test --run` 覆盖 `freshness` / `plaintext-migration` / `deletion-wipe` / `write-gate*` / `local-repos` 等全部既有套件 ⇒ **155 文件 / 1286 例 / 0 红**（见 §5）。
- 受影响面（`write-methods` / `binding` / `data-plane` / `AppRoot.vue` / `local-database` / `local-storage-policy` / `project-preference-repo-impl` / `built-in/project/repoImpl` / `calendar-view` / `index-view`）对应测试均在上述全量内跑绿。
- 清库语义：`CALENDAR_WEEKSTART` 由设备级改用户级后，`deletion-wipe.test.ts` 仍绿；REG-03/04 无回归。

---

## 4. 契约对齐核对（客户端 ⇄ T130 落地版）

| 契约点           | T130 落地（服务端）                                                                                 | 客户端实现                                                                                                   | 结论 |
| :--------------- | :-------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :--- |
| 设置面回传       | `PUT /user/config`，`preferences` = `json.RawMessage`，`appearance` 可选（`binding` 移除 required） | `pushUserConfig` → `requester.put('/user/config', { preferences: snapshot })`                                | ✅   |
| 快照形态         | 哑存储，不解析                                                                                      | `{version:1, builtInProjectPreferences, asideWidth, calendar:{weekStart,pomodoroBadge,dayZoom}}`（ADR §D-2） | ✅   |
| 普通清单偏好     | `POST /projects/:projectId/preference`（**复数**），成功码 20090                                    | `pushProjectPreference` → `POST /projects/${projectId}/preference`，校验 20090                               | ✅   |
| 拉取出参         | `GET /user/config` → `preferences`（对象）+ `updatedAt`（`FormatTimeMilli` = **RFC3339Milli**）     | `pullAndMergeUserConfig` 读 `data.updatedAt` / `data.preferences`                                            | ✅   |
| 空值口径         | 未设置 ⇒ 返回 **`{}`**                                                                              | `hasRemotePreferences = 非空对象`；空 `{}` ⇒ **以本地为准并回传**（`enqueuePreference('userConfig')`）       | ✅   |
| 成功码           | GET 10110 / PUT 10120 / POST preference 20090 / 凭证 10041                                          | 客户端逐条使用同码                                                                                           | ✅   |
| 归一化网络错误   | 请求器顶层字符串 `code`（`ERR_NETWORK` 等）                                                         | `readResponse` 顶层字符串 ⇒ `network: true` ⇒ 暂停不计数                                                     | ✅   |
| appearance 独立  | 三态互不覆盖（服务端集成测试）                                                                      | 客户端 `pushUserConfig` 仅带 `preferences`，不带 appearance                                                  | ✅   |
| 移动端 REST 语义 | 路由/表未变（`project_preference_route_test.go`）                                                   | 移动端 0 改动                                                                                                | ✅   |

**独立复跑（服务端非集成层）**：`go test -count=1 ./interfaces/controllers/... ./interfaces/routers/... ./application/idutil/...` → **全 ok**（`UserConfigContract_*` 6 例 + `ProjectPreferenceRoutes_PluralAndUnchanged` 1 例 + `FormatTimeMilli`）。

> **未做**：服务端 **DB 集成测试**（`//go:build integration`）未复跑 —— 需 UTC 测试库（PM 已挂账「集成测试须用 UTC 测试库」），本报告不重复承担；PM 已报 164 例全绿。

---

## 5. 全范围门禁独立复跑（干净树 `c2c24606`）

| #   | 门禁                                                                           | 我的结果                                         | PM 数字               | 一致 |
| :-- | :----------------------------------------------------------------------------- | :----------------------------------------------- | :-------------------- | :--- |
| ①   | `pnpm exec vp check`                                                           | **1408 格式 OK · 1199 文件 0 error**             | 1408 / 1199 / 0 error | ✅   |
| ②   | 全仓 `pnpm exec vp test --run`                                                 | **155 文件 / 1286 例 / 0 红**（79.44s）          | 155 / 1286 / 0 红     | ✅   |
| ③   | `pnpm run guard:ddd`                                                           | rc=0 OK                                          | OK                    | ✅   |
| ④   | `pnpm exec vp run webapp build`                                                | rc=0（built 14.72s）                             | rc=0                  | ✅   |
| ④   | `pnpm run desktop:build`                                                       | rc=0（built 18.10s）                             | rc=0                  | ✅   |
| ⑤   | 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` | **0**                                            | 0                     | ✅   |
| ⑥   | `pnpm run guard:gate-pathspec`                                                 | rc=0 OK                                          | OK                    | ✅   |
| ⑦   | `pnpm run guard:barrel-imports`                                                | rc=0（1199 文件 / 1255 导入 / 1817 命名 OK）     | OK                    | ✅   |
| ⑧   | `pnpm run guard:mobile-imports`                                                | rc=0（72 文件未引 persistence-local/sync/dexie） | OK                    | ✅   |

> 全仓测试**未并发跑**（复核期间 peers 均 idle），无 CPU 争抢。

---

## 6. 变异测试（独立重做，不采信自述）

| #   | 变异                                                                                      | 目标                            | 结果     | 红数             | 还原                   |
| :-- | :---------------------------------------------------------------------------------------- | :------------------------------ | :------- | :--------------- | :--------------------- |
| M1  | 把偏好写入口**放回**离线写闸门（`PROJECT_WRITE_METHODS.saveProjectPreference = 'error'`） | `preference-write-gate.test.ts` | **转红** | **2 红 / 4 绿**  | ✅ `git checkout` 还原 |
| M2  | 让 LWW 改用**客户端时间**（`isRemoteNewer` 内 `synced = Date.now()`）                     | `preference-sync.test.ts`       | **转红** | **2 红 / 12 绿** | ✅ 还原                |
| M3  | 让偏好**入 `syncQueue`**（`savePreferenceQueue` 内追加 `syncTracker.markDirty`）          | `preference-queue.test.ts`      | **转红** | **1 红 / 7 绿**  | ✅ 还原                |

**变异后工作区 `git status --porcelain` = 0**（三次均确认）。

---

## 7. 未过项 / 缺陷候选（**请 PM 裁定登记**）

### GAP-1（P1 / 严重）普通清单偏好**无拉取恢复路径** ⇒ PRD §7 AC1/AC2 对该偏好不成立

- **事实**：全仓仅 `pullAndMergeUserConfig`（设置面）有拉取；**无任何普通清单偏好拉取**（`grep` 确认 `persistence-sync/` 与 `LocalProjectPreferenceRepoImpl` 无 `GET /projects/:id/preference` 调用）。`SYNC_TABLES` 不含 preferences。
- **后果**：T131 前 web `createProjectPreferenceRepository` 是 `withMirrorFallback(远端主读, 本地兜底)`；T131 改为**纯本地读**。⇒ **换设备 / 清缓存 / 登出重登（清库）后，web 普通清单偏好回默认（viewType=table），服务端数据读不到**（PRD §7 AC1/AC2 的「偏好恢复」仅设置面成立）。
- **与 ADR 冲突**：ADR §D-1b 明确「普通清单偏好 = 按行 `updatedAt` LWW（**读时对账**）」——**未落地**。
- **建议**：返工（实现按行拉取 + 对账），或由用户明确登记「本批普通清单偏好不跨设备恢复」并同步修订 PRD/ADR。**当前不宜声称 AC1/AC2 全部达标。**

### GAP-2（P2 / 一般）失败**不可见**（AC4-04 / AC3-04 未满足）

- **事实**：`pushPreferenceQueue` 返回 `{pushed, failed}`，但**无任何消费方**（`flushPreferenceQueue`/`schedulePreferencePush` 丢弃返回值）；无 `NueMessage`、无同步状态面字段。失败仅 `catch {}` 静默降级。
- **后果**：PRD §7 AC4「可见提示（不静默吞）」与 §6「失败可见提示」未实现；AC3-04「计数可读」仅程序内可读。
- **建议**：挂后续单（或本批补一个最小可见面：失败计数/提示）。

### GAP-3（P3 / 次要）远端胜时**未清本地脏队列**

- **事实**：`pullAndMergeUserConfig` 远端更新分支应用远端后 `return`，**未清偏好队列**；随后 `pullAndMergeUserConfig().then(() => flushPreferenceQueue())` 会用「刚被远端覆盖后的本地快照」再发一次冗余 PUT（结果仍远端胜，但多一次写 + 新 `updatedAt`）。
- **与 ADR 冲突**：ADR §D-1b「远端更新 ⇒ 远端胜（应用远端、**清本地脏**）」。
- **建议**：远端胜分支清 `userConfig` 队列项（或至少注明该冗余写为已知行为）。

### 登记遗留（非本批缺陷）

- **R-5**：内建偏好键用 email ⇒ 改邮箱丢偏好（ADR 本批不改键，PSYNC-AC1-01 不判红）。
- **R-14 / DP-5**：`tagPreference` 仍被 web 离线闸门拦截 ⇒ **本批不得声称「偏好面全部一致」**（INV-10 读码确认）。
- **R-11**：登出清库丢弃未回传偏好改动（v1 接受）。

---

## 8. 未做项与原因（不阻塞）

| 未做项                                                 | 原因                                                             |
| :----------------------------------------------------- | :--------------------------------------------------------------- |
| 服务端 **DB 集成测试**复跑（`//go:build integration`） | 需 UTC 测试库（PM 已挂账）；非集成层契约/路由已独立复跑全绿      |
| 真实双端（web + desktop）端到端冒烟                    | 30 分钟窗口内未做；AC2-03/AC4-05 触发源接线以读码 + 现有单测判定 |
| 6 项 ⛔ 用例补齐（AC2-02/03/05、AC3-05、AC4-04/05）    | 属**实现/用例缺口**，非复核未做；已在 §1 逐项标注                |

---

## 9. 发布建议

- **门禁层**：8/8 全绿，红窗口 7→0 独立证实，变异 3/3 反证，契约与 T130 一致 ⇒ **技术质量达标**。
- **功能层**：**GAP-1 为 P1**（PRD §7 AC1/AC2 对普通清单偏好不成立 + 相对 T131 前 web 行为的用户可见回归）⇒ **建议返工或用户明确登记后再放行**；GAP-2（AC4-04 可见提示）建议挂后续单；GAP-3 为次要。
- **综合**：**有条件通过** —— 不阻塞代码质量验收，但 **AC1/AC2 覆盖结论须以 GAP-1 为前提修正**；不建议在未处置 GAP-1 的情况下宣称「TASK-26 全 AC 达标」。

---

## 10. 复核自检

- [x] 未修改任何实现代码（变异全部还原，`git status` = 0）
- [x] 独立重做变异 3 项（非采信自述），红数已给
- [x] 全仓门禁独立复跑（未并发），数字与 PM 逐项一致
- [x] 移动端 0 独立核验
- [x] 未覆盖/部分覆盖逐项给理由与缺口（非笼统「pass」）
- [x] 造数/探针类测试：无（未造数，无需回滚）
- [x] 未过项如实列出（GAP-1/2/3 + 登记遗留），未粉饰