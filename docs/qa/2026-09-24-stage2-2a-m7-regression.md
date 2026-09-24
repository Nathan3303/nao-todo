# 阶段二 2A 批末硬闸门：M7 回归报告（`T152`）

- **日期**：2026-09-24
- **任务**：`T152`（qa，M7 回归 = 2A 批末硬闸门）
- **基线 HEAD**：`13c99b23`（工作区 clean，无其他在制写者；本单**只读核实 + 报告，⛔ 未改任何代码/测试**）
- **范围**：ADR `docs/adr/2026-09-24-stage2-both-ends-local-first.md`（§2.5 回归矩阵 / §5 M7 / PS-12…PS-16）+ ADR `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 r10 / §10.11）
- **被测批次**：W1–W4（`T145` `1c31e09d` / `T146` `5e19565e` / `T147` `c2459a4a` / `T148` `09c7cdff`）+ 前置四件（`T144` `6a75a0de`+`68b336b6`）+ M6（`T149` `b4960a4d` / `T150` `56b2b951` / `T151` `cd97f604`）
- **并发纪律**：全仓门禁/测试**单会话串行**（未并发起第二个全仓跑，未并行 `vp test` 与 build）

---

## 0. 结论摘要

| 项                         | 结论                                                                                                           |
| :------------------------- | :------------------------------------------------------------------------------------------------------------- |
| ① 全范围门禁 8 项 + 移动端 | ✅ **全过**（8/8 exit 0，移动端 diff = 0）                                                                     |
| ② §2.5 回归矩阵 R-01…R-07  | ⚠️ **6.5/7**：R-01…R-04、R-06、R-07 **全过**；**R-05 部分通过**（三态/角标零改动 ✓；**「冲突行可见」未满足**） |
| ③ 2A 新增面独立核实 1–4    | ✅ **全过**（含 ⭐ 假信号核验 = **0 假信号**）                                                                 |
| 未过项                     | ⚠️ **1 项口径差异**：PS-14 / R-05 的「状态面**可见**计数」未落地（PM 已于 `T144` 登记归 2B）                   |
| 红数                       | **0**（全仓 163 文件 / 1366 例 / 0 红）                                                                        |

---

## ① 全范围门禁 8 项（精确数字 / 退出码）

| #   | 门禁                                   | 命令                                                                | 结果（精确数字）                                                                                                       | 退出码 |
| :-- | :------------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------- | :----- |
| 1   | 格式 + lint + 类型                     | `pnpm exec vp check`                                                | **格式 1421 文件全部正确** · **lint+type：1210 文件 0 warning / 0 lint error / 0 type error**                          | **0**  |
| 2   | **全仓**测试                           | `pnpm exec vp test --run`                                           | **文件 163 / 例 1366 / 红 0**（Duration 87.69s；transform 13.81s · import 48.36s · tests 104.76s · env 74.02s）        | **0**  |
| 3   | 领域隔离                               | `pnpm run guard:ddd`                                                | `OK - domain 包未引用 shared 根桶 / shared 展示层组件 / ResponseDataPagination`                                        | **0**  |
| 4   | 导入面可解析性                         | `pnpm run guard:barrel-imports`                                     | `扫描 1210 文件 · 校验 1273 条 @nao-todo 导入 / 1835 个命名` → `OK`                                                    | **0**  |
| 5   | 移动端红线守卫                         | `pnpm run guard:mobile-imports`                                     | `packages/presentation-react / apps/mobile 共 72 个源文件，未引用 persistence-local / persistence-sync / dexie` → `OK` | **0**  |
| 6   | 门禁 pathspec 存在性                   | `pnpm run guard:gate-pathspec`                                      | `OK - 门禁命令 pathspec 均存在`                                                                                        | **0**  |
| 7   | web 构建                               | `pnpm exec vp run webapp build`                                     | `✓ built in 16.37s`                                                                                                    | **0**  |
| 8   | desktop 构建                           | `pnpm run desktop:build`                                            | `✓ built in 20.16s`                                                                                                    | **0**  |
| 9   | 移动端红线（`git status --porcelain`） | `git status --porcelain -- packages/presentation-react apps/mobile` | **行数 = 0**                                                                                                           | —      |

- **`DEF-28` flake**：**未复现**（全仓单跑一次即 0 红）⇒ 无需复跑，未做静默重试。
- **全仓 `git status --porcelain` = 0 行**（build 产物已被 gitignore，未污染工作区）。

---

## ② §2.5 回归矩阵逐项（结论 + 证据）

> 证据口径：**文件 + 用例名**；带 ✅ 的为本次独立执行的断言（见 §③ 的聚焦跑：**7 文件 / 65 例 / 0 红**）。

| #    | 项                                          | 结论            | 证据（测试文件 / 用例名）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :--- | :------------------------------------------ | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | **离线读镜像**（本地优先 + 冷启动）         | ✅ 通过         | `persistence-sync/__tests__/mirror-status-persistence.test.ts`「成功完整拉取 ⇒ 落 meta（mirrorPulledAt 有值 + truncated=false）且不产生 markDirty（C-59）」「**AC8：冷启动离线 + 磁盘有镜像 ⇒ start() 读回后 mirrorPulledAt 有值**」「AC9：从未成功拉取 ⇒ 冷启动离线仍为 null（与「空库」可区分）」· `sync-status-bar.test.ts`「**AC8：离线 + 有镜像 ⇒ 面板 ②「数据截至 X」+「可能不是最新」**」「AC9：离线 + 无镜像 ⇒ 面板 ③ 引导联网」· `offline-prerequisites.test.ts`「本地镜像不存在 → mirror-missing」· `use-mirror-loaded-count.test.ts`「有会话 ⇒ 按 userId 过滤 tasks 表计数」· **新增 web 本地优先读断言**：`write-gate-wiring.test.ts`「绑定级断言（ADR §2.5 正向）：web 已切域仓储 = 本地仓储」                                                                                                                                                                                                                                                                                  |
| R-02 | **迁移门**（DEF-10 顺序 / DEF-16 正向可达） | ✅ 通过         | `views/auth/bootstrap-local-data.test.ts`「**顺序不变：resumePendingWipe → 会话重建 → checkAndCleanExpired**」「C-53：每次启动先补完遗留清库（resumePendingWipe），且先于会话重建」· `def10-bootstrap-order.test.ts`「**顺序断言：checkAndCleanExpired 早于 InitialSyncGate.start()**」· `offline-entry-positive.test.ts`「**正向：JWT 可解析 + 会话一致 + 本地镜像存在 ⇒ ok（门退役后仍可达）**」「条件④已删：失败原因码集合中不再存在 locked」                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R-03 | **清库**（C-52/C-53/C-54）                  | ✅ 通过         | `deletion-wipe.test.ts`「清空目标用户 11 业务表 + meta + syncQueue + syncCursor」「AC5：localStorage 业务键清空，nao.deviceId 保留」「C-53：崩溃后 resumePendingWipe 补清」「**T106 脏队列护栏口径（C-54）：countDirty(userId) 为权威即时口径，按 userId 过滤**」· `deletion-service.test.ts`「到期：checkAndCleanExpired 清空该用户业务数据、密钥包与调度」· `sign-out-wipe.test.ts`「**有脏队列 + 用户取消 ⇒ 不清库（绝不静默清）**」「有脏队列 + 「先同步」成功清空 ⇒ 单次确认后清库」· 独立核实：`sign-out-wipe.ts:24,40` **直调 `syncTracker.countDirty(userId)`**，`apps/web` 生产码**零** `syncStatus.pendingCount` 读取（仅 `sync-status-bar.vue` 展示用）✓                                                                                                                                                                                                                                                                                                                          |
| R-04 | **明文姿态**（C-46/C-51）                   | ✅ 通过         | `crypto-service.test.ts`「setup 后加密为明文直通（`plain:` 自描述）且可往返」「未解锁时 encrypt 仍为明文直通（passthrough 不依赖 DEK）」「正确密码 unlock 后可解历史密文（迁移窗口真解密能力保留）」· `plaintext-migration.test.ts`「AC2：存量密文库 ⇒ 全库解包 + 写完成标记；**key-bundle 未删**」「AC3a/AC3b：混合格式可读取，且续跑完成（幂等）」「AC4：跳过迁移 ⇒ 完成标记未写、key-bundle 保留」· `plaintext-notice.test.ts`「首次进入 ⇒ 弹单按钮 NueConfirm，文案含明文与设置指引」                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R-05 | **两端一致同步状态展示**（C-60 / T115c）    | ⚠️ **部分通过** | **通过部分**：`sync-status-bar.test.ts`（**两端共用同一组件**）「三态文案：从未同步 / 同步中 / 失败+计数」「角标取值（通道③）：alert > warn > 无」「AC8 / AC9」「触顶且镜像已有实际加载数 ⇒「已加载 N 条」」+ `sync-status.test.ts`「C-11：仅无错误运行推进 lastSyncAt」「SHELL-06 C-41：paused 跨运行保持」+ **负向断言**：`conflict-journal.test.ts`「远端较新覆盖本地未推修改」用例内 `conflictCount = 1` **且 `pendingCount = 0`** ⇒ 冲突计数**不改业务计数** ✓。**未通过部分**：ADR §2.5 R-05 验证列要求「**冲突行可见**」、§2.1-D3 要求「同步状态面板新增「冲突 N」行」、PS-14 要求「状态面**可见**计数」—— 实测 `conflictCount` **无任何 UI 消费者**（全仓 `grep conflictCount` 仅 `sync-status.ts` 定义/赋值 + 测试；`apps/**/*.vue` 零命中；`packages/shared/locales/**` 无 `conflict` 键）⇒ **计数存在但不可见**。**PM 已于 `T144` 验收登记**：「journal 的 UI 行未做 ⇒ 按 ADR §2.1-D3 归 2B 冲突 UX（登记待派）」。⇒ 本条**非新发现缺陷**，但**批末验收判据未满足**，见 §未过项。 |
| R-06 | **偏好同步**（TASK-26）                     | ✅ 通过         | `preference-queue.test.ts`「**偏好入队不写 syncQueue、不 markDirty、countDirty 恒 0**（PS-1/PS-10/INV-01）」「projectPreference 按 projectId 去重」「业务类失败 ⇒ 指数退避」「网络类失败 ⇒ 暂停不计数」· `preference-sync.test.ts`「LWW 判据 - 仅服务端时间（PS-8）：客户端时间戳不参与判定」「回传 - 设置面全量快照（PUT /user/config）+ 出队 + 不写 syncQueue」「GAP-1 普通清单偏好拉取/恢复：登出重登 / 换设备 / 清缓存 ⇒ 从服务端恢复」· `preference-write-gate.test.ts`「离线调用 saveProjectPreference 透传（不拦截 / 不返回 OFFLINE_READONLY）」「**离线身份域写仍被拦截 + 稳定码 OFFLINE_READONLY + 原方法零调用**」· `calendar-preference-scope.test.ts`「行为：登出清库清除周起始（红基线）」「回归：其它设备级键仍保留、身份级键仍清」                                                                                                                                                                                                                                            |
| R-07 | **`DEF-5` / `DEF-6` 回归线**                | ✅ 通过         | `def6-mirror-completeness.test.ts`「pullAll() 单轮 ⇒ 本地落满全量（含最新任务）」「**时间上界：本地已含 fixture 最大 updatedAt（不截断在 200 边界）**」「总数恰为 limit 整数倍 ⇒ 末轮空页终止（400 = 200+200+0）」「keyset 不前进 ⇒ 立即终止，不死循环」「护栏 B：轮数/时间预算截断 ⇒ mirrorPulledAt 不推进 + 触顶提示」· `def6-mirror-e2e.test.ts`「**挂载 InitialSyncGate（= 启动 1 次）⇒ 本地落满 250 行且含最新任务**」· `sync.test.ts`「**拉取返回业务码 10041 ⇒ 触发会话失效回调并提示重新登录（DEF-5）**」「推送返回业务码 10041 同型」「LWW：本地未推送修改较新时，拉取不覆盖（保留队列项）」                                                                                                                                                                                                                                                                                                                                                                                        |

---

## ③ 2A 新增面的独立核实（自读码 + 自跑断言，不采信 RD 自述）

> 独立执行：`pnpm exec vp test --run` 聚焦 **7 文件 / 65 例 / 0 红**（7.49s）——
> `write-methods.test.ts` · `write-gate.test.ts` · `write-gate-wiring.test.ts` · `local-first-dirty-scope.test.ts` · `conflict-journal.test.ts` · `server-time-calibration.test.ts` · `first-pull-gate.test.ts`

### ③.1 闸门作用域 = 仅身份域 ✅

- `packages/presentation/offline/write-methods.ts`：**仅**导出 `USER_WRITE_METHODS`（全文件单一 `export const`）；`grep TASK_WRITE_METHODS|PROJECT_|TAG_|POMODORO_|TASK_CHECK_ITEM_|TASK_COMMENT_|POMODORO_RECORD_WRITE_METHODS` ⇒ **仅 2 处文档注释残留，0 代码引用**（无悬挂导入）✓
- `apps/web/src/hooks/usecases/binding.ts`：`WRITE_METHODS_BY_KIND: Partial<Record<UseCaseKind, WriteMethodMap>> = { user: USER_WRITE_METHODS }` ⇒ **仅 `user` 键**；`decorateUseCase` 对未命中键**原样返回** ✓
- **业务 7 域离线写透传**：`write-gate-wiring.test.ts`「W1 任务域已切本地优先 ⇒ 撤该域闸门（离线写透传、不返回 OFFLINE_READONLY）」「W2 子实体域（检查项/评论）⇒ 撤闸门」「W3 容器域（清单/标签）⇒ 撤闸门」「W4 番茄域（番茄/番茄记录）⇒ 撤闸门」+ 表级「闸门作用域仅身份域 —— 7 业务域 `decorateUseCase` **原样返回同一引用**」✓
- **`user` 离线仍 `OFFLINE_READONLY` 且原方法零调用**：`write-gate-wiring.test.ts`「web binding 提供 decorateUseCase；未切本地优先的域（身份域 W5）离线写被拦截、原方法零调用」+ `preference-write-gate.test.ts`「离线身份域写仍被拦截 + 稳定码 OFFLINE_READONLY + 原方法零调用」✓
- **绑定级正向**：7 域仓储 = 本地仓储（`instanceof Local*RepoImpl`）✓

### ③.2 `markDirty` 新语义（PS-12 / PS-13）✅

- **业务 7 域本地写 ⇒ 非 0**：`local-first-dirty-scope.test.ts`「**业务 7 域各写一条 ⇒ countDirty=7、队列表覆盖 7 表（不再恒 0）**」+ 7 表名精确断言 ✓
- **`pendingCount = countDirty`**：「运行结束 ⇒ pendingCount = countDirty（非 0：未确认脏队列保留）」（`dirty=7`，`pendingCount=7`）✓
- **成功同步出队回 0**：「成功同步 ⇒ 出队回 0 且 pendingCount = 0」✓
- **身份域 `user` 零 `markDirty`**：「本地身份写（`LocalUserRepoImpl`）不 markDirty ⇒ countDirty 恒 0、不计入 pendingCount」（且已造真实记录使写**真实落库**，非空转）✓
- **独立读码**：`user-repo-impl.ts` **零** `markDirty` 调用（`grep` NONE）✓；`SYNC_TABLES`（`sync-service.ts:115`）**不含 users / userConfigs** ✓
- **`setDirtyListener` 接线**：`apps/web/src/data-plane.ts:49` 注册 `syncTracker.setDirtyListener(() => syncService.schedulePush())`（整生命周期一次）；`data-plane.test.ts`「setDirtyListener 调用 1 次 + listener 触发 schedulePush」✓

### ③.3 ⭐ 假信号核验（arch 的 S14=(a) 前提，独立复核）✅ **0 假信号**

| 核验点                                                                 | 结论                                                                                                        | 证据（独立 grep / 读码）                                                                                                                                                                                                                                       |
| :--------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isReadOnly` 的**全部**消费方                                          | **仅 2 处生产消费**：① `write-gate.ts:74`（内部，现仅包 `USER_WRITE_METHODS`）② `sync-status-bar.vue:45,74` | `grep -rn isReadOnly --include=*.ts,*.vue`（排除 node_modules / 测试）：`read-only-state.ts`(定义) + `write-gate.ts`(消费) + `sync-status-bar.vue`(消费) + 2 处注释                                                                                            |
| `useReadOnlyState` 的**全部**消费方                                    | **仅 1 处**：`sync-status-bar.vue:45`（`const { isReadOnly } = useReadOnlyState()`）                        | `grep -rn useReadOnlyState` 全仓：`read-only-state.ts`(定义) + `sync-status-bar.vue`(唯一消费)                                                                                                                                                                 |
| `isReadOnly` 用途 = `resolveFreshness({isOffline})` 输入（数据新鲜度） | ✅ 是 —— 仅驱动「离线模式 · 数据截至 X」文案 / 角标，与**可否写**无关                                       | `sync-status-bar.vue:74`；`freshness.ts` 三态纯函数；`zh-CN.ts:62` `offline.freshness.mirror = '离线模式 · 数据截至 {time}'`（**无「只读」字样**）                                                                                                             |
| **任何 UI 把 `isReadOnly` 接 `disabled` / 只读文案**                   | **= 0**                                                                                                     | `grep -rniE "disabled.*(offline\|readonly)\|(offline\|readonly).*disabled" --include=*.vue apps packages` ⇒ **0 命中**；`grep -rn "只读" apps/**/*.vue` ⇒ 均为无关项（日历全天只读条 / 设置页版本只读展示 / 错误缓冲只读导出），**无一处由 `isReadOnly` 驱动** |
| `offline.readOnlyBanner` 是否死键                                      | ✅ **死键**（零消费者）                                                                                     | 全仓仅 3 处：`zh-CN.ts:59`(定义) + `en-US.ts:60`(定义) + `types.ts:56`(类型)；**无任何 `.vue`/`.ts` 生产消费者**                                                                                                                                               |
| `offline.readOnlyHint` 消费者                                          | 仅 `write-gate.ts:40` `notifyReadOnly()` ⇒ **仅身份域**触发                                                 | `grep -rn readOnlyHint\|notifyReadOnly` ⇒ `write-gate.ts` 3 处 + locale 定义；无其他消费                                                                                                                                                                       |
| 业务域是否仍显示「离线只读 / 禁用」                                    | ✅ **否** ⇒ **无假信号**                                                                                    | 离线时业务 7 域 UI 仅出现 `offline.freshness.*` / `offline.coverage.*`（数据新鲜度/覆盖度），与写能力无关                                                                                                                                                      |

**⇒ 复核结论**：与 arch `T151` 结论一致 —— **业务 7 域无「离线只读 / 禁用」假信号**；`isReadOnly` 现仅服务**身份域写拦截** + **数据新鲜度陈述**。

### ③.4 PS-14 / PS-15 / PS-16 独立证据 ✅

- **PS-14（冲突 journal：败方快照 + 有界）** ✅
    - 存储 = `meta` 单记录 `${userId}:conflict-journal`，**纯追加非索引字段**（`local-database.ts`）⇒ 未 bump Dexie version ✓
    - **含败方快照**：`conflict-journal.test.ts`「appendConflict 落 meta 单记录并**保留败方快照**」+ pull 侧「远端较新覆盖本地未推修改：journal 记本地（败方）内容 + 队列出队 + 状态面计数」（断言 `loser.name === '本地名'`、`winnerUpdatedAt` / `loserUpdatedAt`）✓
    - **有界**：「**有界：超过上限环形淘汰最旧（保留最新 N 条）**」（`CONFLICT_JOURNAL_LIMIT = 50`）✓
    - **两处写入点**（独立读码）：`sync-service.ts:766`（`applyPullBatch` 远端胜分支，覆盖前捕获本地 record）· `sync-service.ts:994`（`pushAllInner` `result.outcome === 'noop' && action === 'upsert'`）—— **按服务端 outcome 判、不自判谁赢、不用客户端时间**（PS-8）✓；`applied`/`skipped` 不记账 ✓
    - 空 `userId` 硬失败（C-55）+ 不写 `syncQueue`（不 `markDirty`）+ 冷启动 `restoreConflictCount()` 从磁盘恢复 ✓
    - **唯一缺口**：**状态面「可见」计数未落地**（见 R-05 / §未过项）
- **PS-15（`nowCalibratedIso` 被 7 域仓储实际使用）** ✅
    - `sync-config.ts:74` `nowCalibratedIso = () => new Date(Date.now() + getServerTimeOffset()).toISOString()`；`getServerTimeOffset` 由同步/checkin 响应 `serverTime` 写入（`calibrateServerTime`，`sync-service.ts:431-436`）✓
    - **7 域全部使用**（独立 grep `nowCalibratedIso` 于 `persistence-local/repos/`）：`task-repo-impl` · `task-check-item-repo-impl` · `task-comment-repo-impl` · `project-repo-impl` · `tag-repo-impl` · `pomodoro-repo-impl` · `pomodoro-record-repo-impl` —— **7/7** ✓；`user-repo-impl`（身份域，不入 `SYNC_TABLES`）**未改** ✓
    - `server-time-calibration.test.ts`「nowCalibratedIso 读取 getServerTimeOffset：偏移为正/负均生效」「本地创建任务：entity.updatedAt = 本地时钟 + 服务端偏移（**不再用裸 new Date**）」「**入队 localUpdatedAt 与实体 updatedAt 一致（同一校准基准）**」「无偏移（未校准）⇒ 回退本地时钟（缺省 0）」✓
- **PS-16（首拉门判定表）** ✅
    - 纯判定 `evaluateFirstPullGate`（`first-pull-gate.ts`），判定顺序 = PS-16 规则顺序；**只以镜像存在性/首拉信号为判据**（禁「单次读返回空」推断）✓
    - `first-pull-gate.test.ts` **12 例**（判定表逐行覆盖）：未登录 ⇒ pass · 有镜像 ⇒ pass · **本地空 + 离线 ⇒ pass（既有离线进入引导）** · **本地空 + 在线 + 未落定 ⇒ wait** · 本地空 + 在线 + 落定 ⇒ pass · **本地空 + 在线 + 超时 ⇒ released** + 接线 6 例（`waitForFirstPullGate`：未登录不触发首拉 / 有镜像不触发 / 离线走既有引导 / 在线进入等待并触发首拉 / 超时放行 / 首拉未启动不永久阻塞）✓
    - 接线：`initial-pull-gate.vue` **覆盖而非卸载 `<App/>`**（避开 requester 初始化死锁），挂 `WebRoot.vue:19` ✓

---

## 未过项（1 项，口径差异 —— 非代码缺陷）

| #      | 项                                                                                                                                                                    | 定位（最小复现）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 严重度     | 处置建议                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **U1** | **PS-14 / ADR §2.5-R-05 的「状态面**可见**计数」未落地** —— `syncStatus.conflictCount` 已实现且在冷启动恢复，但**同步状态面板无「冲突 N」行**、无 i18n 键、无可见提示 | ① 读码：`packages/infrastructure/src/persistence-sync/sync-status.ts:53,83,175`（字段定义/初始化/`setConflictCount`）—— 全仓**唯一** `conflictCount` 生产引用；② `grep -rn conflictCount apps/**/*.vue` ⇒ **0 命中**；③ `grep -rn conflict packages/shared/locales/` ⇒ **0 命中**；④ `sync-status-bar.vue` 面板行仅 `pendingCount`(L242,245) / `failedCount`(L250) / `preferenceFailedCount`(L256)，**无冲突行**。⇒ 断言级复现：`conflict-journal.test.ts`「远端较新覆盖本地未推修改」可证 `syncStatus.get().conflictCount === 1`，但**无任何 UI 用例/消费者可观察它** | P3（口径） | **PM 已登记**（`T144` 验收：「journal 的 UI 行未做 ⇒ 按 ADR §2.1-D3 归 2B 冲突 UX，登记待派」）。**但**：ADR §5 **M2** 明列「冲突 journal（存储/写入点/计数/**UI 行**）」、§2.5 **R-05** 验证列明列「**冲突行可见**」、**PS-14** 要求「状态面**可见**计数」⇒ **2A 自身验收判据未满足**。**建议二选一（PM 拍板）**：**(a)** 认账为 2A 缺口 ⇒ 派小单补「冲突 N」面板行 + i18n 键（低成本，同 `preferenceFailedCount` 范式）；**(b)** 维持归 2B ⇒ **同步修订** ADR §5 M2 与 §2.5 R-05 判据（否则批末验收口径自相矛盾）。**⛔ 本单不改代码，仅上报**。⇒ **PM 已拍板 (a)：现在补、不改判据**，由 `T154`（`1bed1d8d`）/ `T154b`（`ba2c189e`）落地；**闭合复核与 R-05 改判见 §T152b** |

**非未过项但需登记**：

- **push 响应 `conflict` / `error` / `skipped` 未消费**（仅 `noop` 记账）⇒ `error` 未消费意味着「服务端失败但客户端已出队」（**既有行为、非本单引入**）—— PM 已于 `T144` 登记为 **R-2 扩展、归 2B** ✓
- **跨标签 push 单主（R-3）未做** —— PM 已于 `T144` 登记 ✓
- **`DP-5` 标签偏好仍非 local-first（R-8）** —— 不得声称「偏好面全一致」，已登记 ✓

---

## 与 RD 自述数字的差异

| 指标                   | RD 自述（最后一单 `T149` / `T148`） | 本次实测（`13c99b23`）               | 差异说明                                                                   |
| :--------------------- | :---------------------------------- | :----------------------------------- | :------------------------------------------------------------------------- |
| `vp check` 格式文件数  | 1420（`T148`）/ 1421（`T151`）      | **1421**                             | 一致（`T151` 后新增 1 个 md 即 1421）                                      |
| `vp check` lint+type   | 1209（`T148`）/ 1210（`T151`）      | **1210**                             | 一致                                                                       |
| 全仓 `vp test` 文件数  | 未跑（按纪律留批末）                | **163**                              | 本单首次批末全仓跑；对照阶段一基线 148–151 文件 ⇒ 2A 净增 **+12～15 文件** |
| 全仓 `vp test` 例数    | 未跑                                | **1366**                             | 对照阶段一基线 1254 例 ⇒ 2A 净增 **+112 例**                               |
| 全仓 `vp test` 红数    | 未跑                                | **0**                                | 无 flake，`DEF-28` 未复现                                                  |
| `guard:barrel-imports` | 1210 文件 / 1273 条导入             | **1210 / 1273 / 1835 命名**          | 一致                                                                       |
| 受影响面聚焦跑         | `T149`：32 文件 / 297 例 / 0 红     | 本单 2A 新增面 7 文件 / 65 例 / 0 红 | 口径不同（本单只取 2A 新增面，非全受影响面）                               |

**RD 自述数字与本次实测无冲突**；`T144`/`T145`–`T148`/`T149` 的「受影响面 0 红」结论在批末全仓口径下**得到确认**。

---

## 门禁红线核对（本单自查）

- [x] 未修改任何现有功能代码 / 测试（本单 ⛔ 只读核实 + 报告）
- [x] 执行前已按 PM 指定范围执行，未擅自扩大/跳过
- [x] 未关闭任何缺陷（未 Verify 不关闭；U1 仅上报）
- [x] 定位被测代码/受影响测试未用 codegraph node/affected ⇒ **回退 grep，原因**：2A 核实项均为**全仓字面量消费方清点**（`isReadOnly` / `useReadOnlyState` / `conflictCount` / `nowCalibratedIso` / 已删写方法表），grep 是**穷尽性**更合适的手段（codegraph 面向调用链影响面）
- [x] 已跑**全范围门禁**（非子目录）并回执**精确数字**（① 表）
- [x] 无造数/探针类测试 ⇒ 无回滚/孤儿扫描适用项

## 发布建议

**除 U1 外可收批**：8 项门禁全绿、移动端 0 改动、R-01…R-04 / R-06 / R-07 全过、2A 新增面（闸门收敛 / `markDirty` 新语义 / 假信号 / PS-14·15·16）独立核实通过。
**U1（冲突计数不可见）需 PM 拍板**：或补 UI 行、或同步修订 ADR 判据；**不得带该口径矛盾直接收批而不留痕**。

> **⚠️ 本节结论已被 §T152b 取代（U1 已闭合）**：PM 拍板 **(a) 现在补、不改判据** ⇒ `T154` 补「冲突 N」行 + i18n 键，`T154b` 配色校准；经复核 **U1 已闭合、R-05 改判为通过**（详见 §T152b）。本报告 §0 / §② 的「R-05 部分通过」「U1 未过」为 **`13c99b23` 基线**口径，**最终收批口径以 §T152b 为准**。

---

# T152b —— U1 闭合复核 + 最终 HEAD 全仓门禁复跑

- **日期**：2026-09-24
- **任务**：`T152b`（qa，U1 闭合复核 + 在最终 HEAD 复跑全范围门禁）
- **基线 HEAD**：**`8ab52cdc`**（= `c4926806`（本报告）+ `T154` `1bed1d8d` + `T154b` `ba2c189e` + `T153` `7aa7c182` + PM 台账提交；工作区 clean、无其他写者，独占全仓）
- **⛔ 只读核实 + 报告**：未修任何功能代码/测试（唯一例外 = §① 的**受控负向对照**，已逐字节还原，见下）

## ① U1 闭合复核（自读码 + 自跑断言）

### ①.1 读码核实（`apps/web/src/components/sync/sync-status-bar.vue`）

| 核验点                                         | 结论 | 证据（行号 / 内容）                                                                                                                                                                                                                           |
| :--------------------------------------------- | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 冲突行存在且 `v-if` 判据 = `conflictCount > 0` | ✅   | `sync-status-bar.vue:267` `<li v-if="status.conflictCount > 0" class="sync-panel__row">`                                                                                                                                                      |
| 文案键 = `t('sync.conflict', { count })`       | ✅   | `:269` `{{ t('sync.conflict', { count: status.conflictCount }) }}`                                                                                                                                                                            |
| 位置 = `failed` / `preferenceFailed` **之后**  | ✅   | 面板行序：`pending`(L242/245) → `failed`(L250) → `preferenceFailed`(L256) → **`conflict`(L267)**；`git diff` 确认新 `<li>` 插在 `preferenceFailed` 的 `</li>` 之后                                                                            |
| 颜色 token = `--nue-warning-color-60`          | ✅   | `:268` `color="var(--nue-warning-color-60)"`（`T154b` `ba2c189e` 已由 `error` 改为 `warning`，理由见文件内注 L263-266）                                                                                                                       |
| 组件**两端同源**                               | ✅   | `apps/desktop/electron.vite.config.ts:45-47`：`@` → `apps/web/src`（仅 `@/hooks` 先命中 desktop 侧）⇒ `AppRoot.vue:7` 引的是**同一份** `sync-status-bar.vue`                                                                                  |
| **未动** `sync-status.ts`                      | ✅   | `git diff c4926806..8ab52cdc -- packages/infrastructure/.../sync-status.ts` = **空**                                                                                                                                                          |
| **未动** `statusTheme` / 角标 / `liveSummary`  | ✅   | 组件自 `c4926806` 起**仅 3 个 hunk**：① `isReadOnly`→`isOffline` 别名（`T153`）② `isOffline.value` 用法 ③ **新增冲突 `<li>`**；`statusTheme`(L66-71) / `liveSummary`(L136-141) / `dataBadgeClass`(L98) **体未变**，均**不含** `conflictCount` |

### ①.2 i18n 键（`packages/shared/locales/`）

| 文件          | 内容                                     | 结论                                                                  |
| :------------ | :--------------------------------------- | :-------------------------------------------------------------------- |
| `zh-CN.ts:47` | `'sync.conflict': '冲突 {count}'`        | ✅ 中文齐备                                                           |
| `en-US.ts:48` | `'sync.conflict': '{count} conflict(s)'` | ✅ 英文齐备                                                           |
| `types.ts:44` | `'sync.conflict': string`                | ✅ **显式键联合已含该键** ⇒ 编译期强制（缺键即 `vp check` type 报错） |

### ①.3 断言核实（`sync-status-bar.test.ts` 新增用例）

用例名：**「冲突计数：面板新增「冲突 N」行；仅计数可见、不改业务 pending/failed 行（PS-14 / ADR R-05）」**

| PM 要求                                                                   | 用例内对应断言                                                                                                                                                                      | 结论 |
| :------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| `> 0` ⇒ 行可见且含 N                                                      | `expect(panelText()).toContain('冲突 2')`（`conflictCount: 2`）                                                                                                                     | ✅   |
| `= 0` ⇒ 不渲染                                                            | 基线 `expect(panelText()).not.toContain('冲突')`；归零后再次 `not.toContain('冲突')`                                                                                                | ✅   |
| **负向**：仅 `conflictCount` 变化不得影响 `pendingCount`/`failedCount` 行 | `conflictCount: 2 → 5` 后：`toContain('冲突 5')` + **`not.toContain('冲突 2')`** + **`toContain('待推送 3')`** + **`toContain('失败 1')`**（`pendingCount`/`failedCount` 全程不动） | ✅   |

### ①.4 ⭐ 受控负向对照（防「假绿」，已实测并**逐字节还原**）

- **变异**：`sync-status-bar.vue:267` 的 `v-if="status.conflictCount > 0"` → `v-if="false"`
- **结果**：`pnpm exec vp test --run apps/web/src/components/sync/__tests__/sync-status-bar.test.ts` ⇒ **`Tests 1 failed | 18 passed (19)`**，**唯一红 = 该新增用例**：
  `AssertionError: expected '从未同步待推送 3失败 1立即同步' to contain '冲突 2'`（失败输出同时证明 `pending`/`failed` 行**独立渲染**）
- **还原**：`git checkout -- <file>`；`sha256` **前 = 后 = `939a1b87a220531b16dc03156bdbceebfef219cbd7fdba1972504501eb6f980e`** ⇒ **逐字节一致**；`git status --porcelain` = **0 行**
- **⇒ 结论**：该断言**非空转**（真钉死行存在性），且 `conflictCount` 归零路径有效。

### ①.5 文案纪律

| 要求                  | 结论 | 证据                                                                                                                         |
| :-------------------- | :--- | :--------------------------------------------------------------------------------------------------------------------------- |
| 无可点击 / 可恢复暗示 | ✅   | 行内**仅** `<nue-text>` 文本，**无** `@click` / 按钮 / `role`；文件内注 L264 明示「冲突对比与恢复 UX 属 2B，不在此提供交互」 |
| 无「数据丢失」字样    | ✅   | 双语键全文 = `冲突 {count}` / `{count} conflict(s)`；`grep 数据丢失 packages/shared/locales/` ⇒ 0 命中                       |

## ② R-05 改判为「通过」✅

**新证据**：

- **两端一致状态展示**：`sync-status-bar.vue` **两端同源**（desktop `@` → `apps/web/src`）⇒ 「冲突 N」行在 **web / desktop 同步可见**；既有三态/角标/`liveSummary` **零改动**（§①.1）。
- **「冲突行可见」（ADR §2.5 R-05 验证列）**：`sync-status-bar.test.ts`「冲突计数：面板新增「冲突 N」行…」⇒ `>0` 可见含 N、`=0` 不渲染；**受控负向对照**证明断言有效（§①.4）。
- **「新增冲突计数为纯追加字段、不影响现有三态/角标」（R-05 不回归保证）**：`statusTheme` / `dataBadgeClass` / `liveSummary` 体未变且不含 `conflictCount`；用例内负向断言（仅 `conflictCount` 变化 ⇒ `pending`/`failed` 行不变）+ `conflict-journal.test.ts`「远端较新覆盖本地未推修改」中 `conflictCount=1` **且** `pendingCount=0`。
- **PS-14「状态面可见计数」**：计数可见（面板行）+ 记账有界含败方快照（§③.4 of 前节，本次全仓复跑仍 0 红）+ 冷启动 `restoreConflictCount()` 恢复。

⇒ **R-05：由「部分通过」改判为「通过」**（`13c99b23` 基线的 U1 已闭合）。

## ③ 全范围门禁 8 项复跑（基线 `8ab52cdc`，**新数字**）

| #   | 门禁                                   | 命令                                                                | 结果（精确数字）                                                                                           | 退出码 |
| :-- | :------------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- | :----- |
| 1   | 格式 + lint + 类型                     | `pnpm exec vp check`                                                | **格式 1422 文件全正确** · **lint+type 1210 文件 0 warning / 0 lint / 0 type**                             | **0**  |
| 2   | **全仓**测试                           | `pnpm exec vp test --run`                                           | **文件 163 / 例 1367 / 红 0**（84.58s；transform 13.40s · import 45.37s · tests 100.77s · env 72.18s）     | **0**  |
| 3   | 领域隔离                               | `pnpm run guard:ddd`                                                | `OK - domain 包未引用 shared 根桶 / shared 展示层组件 / ResponseDataPagination`                            | **0**  |
| 4   | 导入面可解析性                         | `pnpm run guard:barrel-imports`                                     | `扫描 1210 文件 · 校验 1273 条 @nao-todo 导入 / 1835 个命名` → `OK`                                        | **0**  |
| 5   | 移动端红线守卫                         | `pnpm run guard:mobile-imports`                                     | `72 个源文件，未引用 persistence-local / persistence-sync / dexie / @nao-todo/infrastructure(根桶)` → `OK` | **0**  |
| 6   | 门禁 pathspec 存在性                   | `pnpm run guard:gate-pathspec`                                      | `OK - 门禁命令 pathspec 均存在`                                                                            | **0**  |
| 7   | web 构建                               | `pnpm exec vp run webapp build`                                     | `✓ built in 14.30s`                                                                                        | **0**  |
| 8   | desktop 构建                           | `pnpm run desktop:build`                                            | `✓ built in 18.56s`                                                                                        | **0**  |
| 9   | 移动端红线（`git status --porcelain`） | `git status --porcelain -- packages/presentation-react apps/mobile` | **行数 = 0**                                                                                               | —      |

- **聚焦跑**（U1 复核面）：`sync-status-bar.test.ts` + `conflict-journal.test.ts` + `sync-status.test.ts` ⇒ **3 文件 / 35 例 / 0 红**（6.28s）。
- `DEF-28` **未复现**（单跑即 0 红）；全仓 `git status --porcelain` = **0 行**；未并发跑全仓。

**与 `T152`（`13c99b23`）的差异**：

| 指标                  | `T152`（`13c99b23`） | `T152b`（`8ab52cdc`） | 差异                                                                   |
| :-------------------- | :------------------- | :-------------------- | :--------------------------------------------------------------------- |
| `vp check` 格式文件数 | 1421                 | **1422**              | +1（= `T152` 报告 md；`T154`/`T154b`/`T153` 均改既有文件、未增删文件） |
| `vp check` lint+type  | 1210                 | **1210**              | 不变                                                                   |
| 全仓测试 文件数       | 163                  | **163**               | 不变                                                                   |
| 全仓测试 例数         | 1366                 | **1367**              | **+1** = `T154` 新增冲突行用例                                         |
| 全仓测试 红数         | 0                    | **0**                 | 不变                                                                   |
| 全仓测试 耗时         | 87.69s               | **84.58s**            | 同噪声带内（82–156s 基线）                                             |

> ⚠️ 注：`T152` 节内「`vp check` 格式文件数 1421」为**当时未含本报告**的口径；本报告落盘后即为 1422（`T152` 节数字保留原口径，不追溯改写）。

## ④ U1 拍板与 PM 勘误（留档）

**PM 拍板 = (a)：现在补、不改判据。理由（原样留档）**：ADR **§5 M2 明列「计数/UI 行」**、**§2.5 R-05 期望列明写「冲突行可见」**、**PS-14 要求「状态面可见计数」** ⇒ 三条都是 **2A 自身判据**，**降低判据需更强理由**，而补一行成本极低（照 `preferenceFailedCount` 范式）且 2B 的冲突 UX 会在此行上扩展、**不算返工**。

**⭐ PM 勘误（原样留档）**：`T144` 验收里把该 UI 行「按 **ADR §2.1-D3** 归 2B」—— **那个锚点是错的**：该 ADR §2.1 下是 **D-1…D-6** 的决策节，**D-3 实为「迁移方案」**；**无任何条款把 UI 行让给 2B** ⇒ 记为 **PM 勘误**，已在台账更正。

## 未过项

- **无**。U1（冲突计数不可见）**已闭合**（`T154` `1bed1d8d` + `T154b` `ba2c189e`，经 §① 独立复核）；R-05 **改判为通过**（§②）；8 项门禁 + 移动端红线**全过**（§③）。

**非阻塞登记（延续，不随本单收口）**：push 响应 `conflict`/`error`/`skipped` 未消费（`error` 未消费 ⇒ 服务端失败但客户端已出队，**既有行为、非本单引入**）⇒ R-2 扩展归 2B · 跨标签 push 单主（R-3）归 2B · `DP-5` 标签偏好仍非 local-first（不得声称「偏好面全一致」）。

## 发布建议（最终口径）

**✅ 2A 可收批**：8 项门禁全绿（`vp check` 1422/1210 · 全仓 **163 文件 / 1367 例 / 0 红** · 4 guards rc0 · 双端 build rc0 · 移动端 diff 0）· R-01…R-07 **全部通过** · 2A 新增面（闸门收敛 / `markDirty` 新语义 / 假信号 0 / PS-14·15·16）独立核实通过 · U1 已闭合。