# 阶段二 2B 终局独立验收报告（qa · `T169`）

> 分支 **`feat/94-stage2-2b`** · HEAD **`f89d0aea`** · Issue **#94** · 设计真源 **ADR §9（r3/r4）+ PRD §19** ·
> 服务端 **`nao-todo-server` @ `arch/go-ddd`（`54e843d` + `ac72a37`）**
> 结论级别：**终验（done(full)）** · 报告日期 2026-09-24 · 执行者 qa（`qa-T169`）
> 边界遵守：**只写测试与报告**（改动 2 个测试文件，见 §⑩）；⛔ **未改任何实现**；不碰 `packages/presentation-react` / `apps/mobile` / `docs/adr/**`。

---

## 0. 结论摘要

| 项                                         | 结论                                                                                                                                                |
| :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC 矩阵（AC1–AC6）**                     | ✅ **6/6 通过**（AC3/4/5/6 为 2B 面终稿；AC1/AC2 为 2A 回归，未退化）                                                                               |
| **阶段一零回归矩阵（ADR §2.5 R-01…R-06）** | ✅ **6/6 通过**（逐组实测，见 §②）                                                                                                                  |
| **回归矩阵增量（ADR §9.6 R-10…R-20）**     | ✅ **11/11 通过**（见 §③a）                                                                                                                         |
| **风险增量（ADR §9.6 R-14…R-20 + R-15b）** | ✅ **全部有守护或已登记**（见 §③b）                                                                                                                 |
| **变异测试**                               | ✅ **5 项全部转红 + 逐字节还原**（M1–M5）；⚠️ **M4 首跑未转红 ⇒ 抓出 1 处测试盲区并已补测闭合**（见 §④）                                            |
| **全范围门禁 8 项**                        | ✅ **全绿**（见 §⑤）                                                                                                                                |
| **文案级断言（`conflict-ux.test.ts`）**    | 🟡 **3/4 通过**：mock 补 `useConflictUx` ✅ · 两文案区分 ✅ · 交互断言 ✅ · **i18n 无死键 ⚠️ 发现 1 个死键 `sync.conflict.title`**（非阻塞，见 §⑥） |
| **跨仓服务端契约复核**                     | ✅ **自核通过**（字段/位置/语义/无迁移/无新错误码/格式/-p 1 竞态复现，见 §⑦）                                                                       |
| **预览环境实机**                           | ⚠️ **不可达**（本环境 Vercel 全域 DNS 不可解析）⇒ 已给替代证据（见 §⑧）                                                                             |
| **发布建议**                               | ✅ **可发版**（须随发布说明登记 3 项限制 + 1 项已知行为变更；见 §⑩）                                                                                |

**未过项**：无阻塞项。**待 PM 决定的小项**：① `sync.conflict.title` 死键（可派 rd-fe 一行清理，非阻塞）② 面板级 `evicted` 常驻信号（T165 已登记后续小项）。

---

## ① AC 矩阵终稿（PRD §7）

| AC      | 判据（PRD §7 + §19 口径补充）                                                           | 结论 | 证据指针                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :------ | :-------------------------------------------------------------------------------------- | :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC3** | 两端同时改同一任务 ⇒ **服务端给出确定结论**（判据 = **OCC**）、**不丢数据**、**可观测** | ✅   | **服务端**：`TestDecideUpsertOCCBase`（base 相等 ⇒ Overwrite / 不等 ⇒ Stale / 缺失 ⇒ LWW）· `TestSyncPushOutcome_StaleCarriesServerUpdatedAt` · 集成 `occ_base_integration_test.go`（真实 MySQL：相等 applied / 不等 stale 不写 + 回库中版本）。**客户端**：`occ-base-and-outcome.test.ts`「push stale ⇒ journal（kind=stale + 败方快照）+ 写回库中版本 + 出队 + 可见计数」· `conflict-ux-api.test.ts`（列表/对比/`stale` kind）。**不丢**：journal 落 `loser` 快照（`conflict-journal.ts` `SNAPSHOT_KINDS`）。**可观测**：`syncStatus.conflictCount` + 面板「冲突 N」入口。 |
| **AC4** | 回传失败 / 冲突无法自动解 ⇒ **不阻塞** + **可见提示** + **可重试**（不静默）            | ✅   | **失败不阻塞**：`occ-base-and-outcome.test.ts`「push error ⇒ **不出队** + 业务退避（DP-2B-4 / R-18）」· `conflict-journal.test.ts`「skipped ⇒ 记 journal + 出队 + 可见计数」。**可见提示**：`conflict-ux.test.ts`「入口 → 列表 → 只读对比」+「动作 B 显式失败 ⇒ 可见提示」· `sync-status-bar.test.ts`。**可重试**：`conflict-ux-api.test.ts` ⑤ 动作 A/B（`resolveConflictKeepServer` / `resolveConflictRetryLocal` 写回 + `markDirty` + 保留 base）。                                                                                                                        |
| **AC5** | 两端行为一致；**阶段一功能零回归**；**移动端 0 改动**                                   | ✅   | **两端一致**：`apps/desktop/electron.vite.config.ts:47` `'@' → ../web/src` ⇒ desktop 与 web 用**同一** `sync-status-bar.vue` + `conflict-list.vue`；`apps/desktop/.../hooks/index.ts` 转出 `use-conflict-ux`（同一 hook）。**零回归**：§② 6 组全绿。**移动端 0**：`git status --porcelain -- packages/presentation-react apps/mobile` = **0** + `guard:mobile-imports` rc0（72 文件）。                                                                                                                                                                                      |
| **AC6** | 服务端冲突解决契约自洽（请求/响应/错误码/迁移）                                         | ✅   | §⑦ 逐项自核：`baseUpdatedAt` 仅在 **sync 专用条目类型**（共享 create DTO `json:"-"`）· `stale` 与 `conflict` 语义分流 · **无 DB 迁移 / 无新错误码** · 偏好 `updatedAt` 与 GET 同 `RFC3339Milli` · HTTP 200 + 逐条 outcome。                                                                                                                                                                                                                                                                                                                                                  |
| **AC1** | （2A 回归）在线增删改 ⇒ 本地即时生效 + 回传成功                                         | ✅   | 未退化：`write-gate-wiring.test.ts`（业务 7 域绑定 = 本地仓储、`decorateUseCase` 未提供）· `data-plane.test.ts`（`setDirtyListener` ⇒ `schedulePush`）· 全仓 175 文件 0 红。                                                                                                                                                                                                                                                                                                                                                                                                 |
| **AC2** | （2A 回归）离线增删改 ⇒ 本地成功 + 界面生效 + 联网后自动回传                            | ✅   | 未退化：同上 + R-01/R-02 组（`mirror-status-persistence` / `offline-entry-positive`）· `sync-tracker` 出队语义未改（`error` 不再误出队，属**增强**非回归）。                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## ② 阶段一功能零回归矩阵（ADR §2.5 · 6 大项）

> 方法：按 ADR §2.5「验证方式」列指明的守护测试**逐组独立复跑**（不采信自述）。

| #        | 项                                                 | 如何验证（可执行）                                                                                             | 结果（精确数字）             |
| :------- | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| **R-01** | 离线读镜像（本地优先 + 冷启动）                    | `mirror-status-persistence` · `def6-mirror-completeness` · `use-mirror-loaded-count` · `offline-prerequisites` | ✅ **4 文件 / 25 例 / 0 红** |
| **R-02** | 迁移门（DEF-10 顺序 / DEF-16 正向可达）            | `bootstrap-local-data` · `def10-bootstrap-order`（desktop）· `offline-entry-positive`                          | ✅ **3 文件 / 20 例 / 0 红** |
| **R-03** | 清库（C-52/53/54：黑白名单 / 可重入 / 脏队列阻塞） | `deletion-service` · `deletion-wipe` · `sign-out-wipe`                                                         | ✅ **3 文件 / 22 例 / 0 红** |
| **R-04** | 明文姿态（C-46/C-51：passthrough / 双格式）        | `crypto-service` · `plaintext-migration` · `plaintext-notice`                                                  | ✅ **3 文件 / 20 例 / 0 红** |
| **R-05** | 两端一致同步状态展示（C-60 / T115c）               | `sync-status-bar`（两端共用）· `sync-status`                                                                   | ✅ **2 文件 / 26 例 / 0 红** |
| **R-06** | 偏好同步（TASK-26：本地优先 + 独立队列 + LWW）     | `preference-queue` · `preference-sync` · `preference-write-gate` · `calendar-preference-scope`                 | ✅ **4 文件 / 45 例 / 0 红** |

**绑定级断言（防「悄悄翻回去」）**：`write-gate-wiring.test.ts` + `data-plane.test.ts` = **2 文件 / 25 例 / 0 红**（web 业务 7 域 = 本地仓储；`decorateUseCase` 未提供；dirty ⇒ push 接线在）。

---

## ③ 风险与回归矩阵增量（ADR §9.6）

### ③a 回归矩阵增量（R-10…R-20）

| #    | 场景                                | 期望                                                                    | 结果 | 证据指针                                                                                                                                                      |
| :--- | :---------------------------------- | :---------------------------------------------------------------------- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-10 | OCC base **匹配** ⇒ 覆盖            | `applied` + 版本更新                                                    | ✅   | 服务端 `TestDecideUpsertOCCBase`（相等 ⇒ Overwrite）· 集成 `occ_base_integration_test.go`；客户端 `occ-base-and-outcome.test.ts`「push applied ⇒ 写回 base」  |
| R-11 | OCC base **不匹配** ⇒ 不覆盖        | `stale` + `serverUpdatedAt` = 库中版本                                  | ✅   | 服务端 `TestSyncPushOutcome_StaleCarriesServerUpdatedAt`；集成 stale 不写 + 回库中版本；客户端「push stale ⇒ journal + 写回库中版本」                         |
| R-12 | `baseUpdatedAt` **缺失** ⇒ 现行 LWW | 行为逐字不变（向后兼容）                                                | ✅   | 服务端 `TestDecideUpsertOCCBase`（缺失 ⇒ Noop/Overwrite）· `TestSyncPushContract_BaseUpdatedAtMissingFallsBack`；客户端「base 缺失 ⇒ 不产出 `baseUpdatedAt`」 |
| R-13 | 客户端 base 生命周期                | 本地写**保留** / push 确认**写回** / pull 后 = 服务端值                 | ✅   | `occ-base-and-outcome.test.ts` 三条（pull 落 base / 本地写保留 / applied 写回）                                                                               |
| R-14 | 多标签并发 push                     | **仅一个**执行；未取锁**不消耗重试**、队列保留                          | ✅   | `push-single-master.test.ts` ①–⑤（含「未取锁 ⇒ 不发请求 + 不消耗重试 + 队列保留」「锁内 journal 写入」）                                                      |
| R-15 | outcome 消费                        | `stale`/`conflict` ⇒ journal；`error` ⇒ 不出队 + 退避                   | ✅   | `occ-base-and-outcome.test.ts`（stale/conflict 分流 + error 不出队）· `conflict-journal.test.ts`（skipped ⇒ journal）                                         |
| R-16 | 冲突 UX 恢复（动作 B）              | 写回 loser + `markDirty` ⇒ 以新 base 重推（不死循环）                   | ✅   | `conflict-ux-api.test.ts` ⑤ · `conflict-ux.test.ts`（组件交互：入口→列表→对比→两动作）                                                                        |
| R-17 | `T141` 远端更新                     | 本地**不覆盖**（远端胜）+ journal                                       | ✅   | `preference-closure.test.ts`「触发点对账：本地 base 落后 ⇒ 应用远端」· `preference-sync.test.ts` T168b 组                                                     |
| R-18 | `DP-5` 两端同构                     | 两端同 binding + **不入 `syncQueue`**（`countDirty` 恒 0）              | ✅   | `preference-closure.test.ts`「save ⇒ 偏好队列 kind=tagPreference + 不入业务 syncQueue」· `tag-preference-local-first.test.ts`                                 |
| R-19 | 阶段一 / 2A 零回归                  | §2.5 R-01…R-09 **全部保持**                                             | ✅   | §② 6 组全绿 + 全仓 175/1447/0 红                                                                                                                              |
| R-20 | 移动端 0 改动                       | `git status --porcelain -- packages/presentation-react apps/mobile` = 0 | ✅   | 实测 **0 行** + `guard:mobile-imports` rc0                                                                                                                    |

### ③b 风险增量（R-14…R-20 + R-15b）

| #         | 风险                                                                     | 应对 / 守护是否落地                                                                               | 结果                    |
| :-------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :---------------------- |
| **R-14**  | 同毫秒版本令牌碰撞 ⇒ 漏判一次冲突                                        | 登记 + 依赖服务端按行串行；**本批不做单调 `version` 列**（N3）⇒ **已知局限**（非缺陷）            | ✅ 登记                 |
| **R-15**  | journal 上限环形淘汰 ⇒ 最旧败方快照丢失                                  | **50 → 200**（`CONFLICT_JOURNAL_LIMIT`）+ **折叠提示**（`folded`/`foldedReason`，`evicted` 优先） | ✅ 落地                 |
| **R-15b** | 删除不纳入 OCC（删除 vs 编辑）                                           | **本批不做**（N5）⇒ 登记为已知局限；`deletions` 无 `baseUpdatedAt`（服务端/客户端均未改）         | ✅ 登记                 |
| **R-16**  | OCC 后离线陈旧 base ⇒ **冲突增多**（行为变更）                           | **W3 UX 同批落地**（`T165`）+ 本报告建议**发布说明登记「行为变更」**                              | ✅ 落地 + 待登记        |
| **R-17**  | push 未取锁 ⇒ 跳过 ⇒ 可能延迟回传（**不丢**）                            | 守护「未取锁不消耗重试、队列保留」（`push-single-master.test.ts` ①）                              | ✅ 落地                 |
| **R-18**  | `stale`/`conflict`/`error` 未消费 ⇒ **错误出队** ⇒ 本地丢失              | **全 outcome 消费**（`error` 不出队 + 退避；`stale`/`conflict`/`skipped` 记 journal）             | ✅ 落地（变异 M5 钉死） |
| **R-19**  | 偏好面收口顺序错 ⇒ 双轨版本语义                                          | `T141`/`DP-5` 在 **W2 之后**（`T168` 于 `T164` 之后）；复用同一 base/比较/journal                 | ✅ 落地                 |
| **R-20**  | `syncedServerUpdatedAt` 本地写丢失 / 确认后不回写 ⇒ **每次推送都 stale** | **三守护**：本地写保留 / push 确认写回 / pull 写入（`occ-base-and-outcome.test.ts`）              | ✅ 落地                 |

---

## ④ 变异测试（5 项，全部转红 + 逐字节还原）

> 纪律：每次改动前记录实现文件 `md5`，跑完 `git checkout -- <实现文件>` 还原并**复算 md5 比对**；`skip/only/todo` = 0。

| #   | 变异                                             | 目标测试（须转红）                                                       | 结果    | 还原 md5         |
| :-- | :----------------------------------------------- | :----------------------------------------------------------------------- | :------ | :--------------- |
| M1  | **push 不带 `baseUpdatedAt`**（去掉 base 回传）  | `occ-base-and-outcome.test.ts`「push 逐条携带 baseUpdatedAt（R-10）」    | ✅ 1 红 | `b617638d…` 一致 |
| M2  | **`skipped` 不记 journal**                       | `conflict-journal.test.ts`「push outcome=skipped ⇒ 记 journal」          | ✅ 1 红 | `b617638d…` 一致 |
| M3  | **移除 push 单主锁**（未取锁仍执行）             | `push-single-master.test.ts` ①「未取得锁 ⇒ 跳过」                        | ✅ 1 红 | `b617638d…` 一致 |
| M4  | **`foldedReason` 的 `evicted` 优先改为 `limit`** | `conflict-ux-api.test.ts`「两信号同真 ⇒ evicted 优先」**（本次补测）**   | ⚠️→✅   | `9b707442…` 一致 |
| M5  | **outcome=error 未消费即出队**                   | `occ-base-and-outcome.test.ts`「push error ⇒ 不出队 + 业务退避（R-18）」 | ✅ 1 红 | `b617638d…` 一致 |

**⚠️ M4 首跑未转红 ⇒ 抓出真实测试盲区（本次验收最有价值发现）**：`conflict-ux-api.test.ts` 原「foldedReason 三态」用例只覆盖 `below→null` / `atLimit→limit` / `evicted→evicted` **三种互斥单态**，**未覆盖「两者同真」**（达 200 且 `evictedCount>0`）—— 而 PM `T165` 明确裁定「两者同真 ⇒ **`evicted` 优先**（R-15 更严重信号优先）」。⇒ 原测试**无法钉死优先级**，变异 M4 静默通过。**qa 已补 1 条断言**（`两信号同真 ⇒ evicted 优先`），补测后 M4 **按预期转红**、无变异时绿。

---

## ⑤ 全范围门禁（8 项，精确数字 + 退出码）

> 口径 = 项目 `AGENTS.md`「全范围门禁」；**全仓测试串行执行**（本环境仅 qa 在跑，PM 未并行）。

| #   | 门禁                               | 精确数字 / 结论                                                                           | 退出码 |
| :-- | :--------------------------------- | :---------------------------------------------------------------------------------------- | :----- |
| 1   | `pnpm exec vp check`               | **1446 文件格式正确 / 1231 文件 0 lint + 0 type error**                                   | **0**  |
| 2   | **全仓** `pnpm exec vp test --run` | **175 文件 / 1447 例 / 0 红**（96.64s；transform 13.73s / import 49.52s / tests 120.04s） | **0**  |
| 3   | `pnpm run guard:ddd`               | OK — domain 未引用 shared 根桶 / 展示组件 / `ResponseDataPagination`                      | **0**  |
| 4   | `pnpm run guard:gate-pathspec`     | OK — 门禁命令 pathspec 均存在                                                             | **0**  |
| 5   | `pnpm run guard:barrel-imports`    | 扫描 **1231 文件** · 校验 **1298 条导入 / 1871 命名** ⇒ 全可解析                          | **0**  |
| 6   | `pnpm run guard:mobile-imports`    | OK — **72 源文件** 未引 `persistence-local`/`persistence-sync`/`dexie`/infra 根桶         | **0**  |
| 7   | `pnpm exec vp run webapp build`    | built in 23.02s                                                                           | **0**  |
| 8   | `pnpm run desktop:build`           | built in 27.70s                                                                           | **0**  |
| —   | 移动端红线                         | `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**            | **0**  |
| —   | `skip/only/todo`                   | 2B 面 + 全仓测试文件 = **0**                                                              | —      |

---

## ⑥ 文案级断言（`apps/web/src/components/sync/__tests__/conflict-ux.test.ts`）

| 要求                                                                        | 结果 | 说明                                                                                                                                                                                                               |
| :-------------------------------------------------------------------------- | :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① `@/hooks` 整模块 mock **补 `useConflictUx`**（T165 新 hook）              | ✅   | mock 工厂新增 `useConflictUx`（可驱动 `items`/`folded`/`foldedReason`/`comparison`/`retryFailed` + 5 个动作 spy）；缺此项则挂载 `ConflictList` 即报错                                                              |
| ② **两文案区分**：`limit` vs `evicted`                                      | ✅   | 断言 `foldedReason='limit'` ⇒ `sync.conflict.foldLimit`、`='evicted'` ⇒ `sync.conflict.foldEvicted`，两者**互斥出现**；`evicted` 文案含「折叠/丢弃」语义                                                           |
| ③ 挂载 `ConflictList` 的**交互断言**（入口 → 列表 → 只读对比 → 两恢复动作） | ✅   | 新增 3 例：全链路可交互（点击入口挂载 + `refresh` / 条目渲染表名+败方标题 / 点击 ⇒ `compare(item)` / 对比渲染 loser+current / 两按钮 ⇒ `keepServer`·`retryLocal`）；动作 B 失败 ⇒ 可见提示                         |
| ④ i18n **中英键齐备、无死键**                                               | 🟡   | **齐备 ✅**（zh/en 键集合逐字相同；冲突命名空间 26 键两端非空、未回落键名；组件引用键无悬空）；**无死键 ⚠️ 发现 1 个**：`sync.conflict.title` **零生产消费者**（仅 `types.ts` + `zh-CN.ts` + `en-US.ts` 三处定义） |

**死键结论**：`sync.conflict.title` 为 `T165` 引入的**未使用键**（非功能缺陷）。已按仓库先例（`offline.readOnlyBanner` 死键被登记容忍，见 ADR 2026-09-11「三处定义零引用属预期，不得据此判死键清理」）**登记为白名单**并写进测试（`无新增死键：… = ['sync.conflict.title']`），**不将就断言、也不静默**。**建议**：由 rd-fe 一行删除或接线为列表标题（非阻塞，不影响发版）。

`conflict-ux.test.ts` 现有 **9 例 0 红**（原 2 例 + 新增 7 例）。

---

## ⑦ 跨仓服务端契约复核（`nao-todo-server` @ `arch/go-ddd`，不采信自述）

| 复核点                                                     | 方法（自读码 + 自跑）                                                                                                                                                                                                                                                                                                                                                                | 结论        |
| :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **`baseUpdatedAt` 字段名/位置**                            | `grep -rn BaseUpdatedAt`：仅出现在 7 个 **sync 专用条目类型** `SyncTaskPushItem` 等（`interfaces/types/sync.go`，匿名嵌入 `CreateXxxReq` + `json:"baseUpdatedAt,omitempty"`）；**共享 create DTO 的 `BaseUpdatedAt` 全部 `json:"-"`**（`ac72a37` 加固，`application/*/dto/*.go`）                                                                                                    | ✅ 不外溢   |
| **`stale` 与 `conflict` 语义区分**                         | `domain/types/upsert.go` `DecideUpsert`：**先判 `Conflict`（ID 碰撞）**，再判 base 分支（相等 ⇒ Overwrite / 不等 ⇒ `UpsertStale`）；`SyncOutcomeStale="stale"` 新增、既有 5 值不变                                                                                                                                                                                                   | ✅ 分流     |
| **无 DB 迁移**                                             | `git show --stat 54e843d` **无 `migrations/` / `models/` / schema 变更**；无新增 `version` 列（N3）                                                                                                                                                                                                                                                                                  | ✅ 无迁移   |
| **无新错误码**                                             | OCC 不匹配走 **HTTP 200 + 既有 `90010`** + 逐条 `outcome`；`git show 54e843d -- interfaces/types` 无新 `9001x`                                                                                                                                                                                                                                                                       | ✅ 无新码   |
| **偏好响应 `updatedAt` 与 GET 同格式**                     | `POST /projects/:id/preference` 补 `SaveProjectPreferenceRes{projectId, updatedAt}` · `PUT /user/config` 补 `UpdateUserConfigRes{updatedAt}`；二者与 GET 同源转换器 `idutil.RFC3339Milli = "2006-01-02T15:04:05.000Z07:00"`；契约测试 `TestSaveProjectPreference_ResponseHasUpdatedAt` / `TestUpdateUserConfig_ResponseHasUpdatedAt` 断言 `assertRFC3339Milli` + 与 GET **同源同值** | ✅ 同格式   |
| **`POST /tags/:tagId/preference` 不回 `updatedAt`**        | `interfaces/controllers/tag.go` `UpdateTagPreference`：`Data: tagId`（**确认**；tag base 由触发点对账刷新）                                                                                                                                                                                                                                                                          | ✅ 已知限制 |
| **集成测试 `-p 1`**                                        | 自跑 `go test -tags integration -count=1 -p 1 ./...` ⇒ **21 包 ok / 180 顶层 PASS（含子测试 441）/ 0 FAIL / 0 SKIP**                                                                                                                                                                                                                                                                 | ✅ 全绿     |
| **「不加 `-p 1` 的 AutoMigrate 竞态」为既有 harness 问题** | **实证复现**：新建空库 `nao_todo_test_fresh` ⇒ 不加 `-p 1` **`迁移失败: Error 1050 Table 'project_preferences' already exists`**（FAIL）；同库加 `-p 1` ⇒ **rc 0**。静态佐证：`AutoMigrate` 位于**多个包各自的 `TestMain`**（`task`/`tag`/`project`/`identity` 的 `repoImpl_integration_test.go`），**这些 harness 文件均未被 `54e843d`/`ac72a37` 改动**                             | ✅ 既有问题 |
| **TZ=UTC 测试库**                                          | 测试 DSN 默认 `root:dev_password@tcp(127.0.0.1:3307)/nao_todo_test?parseTime=true&loc=UTC&charset=utf8mb4`（**`loc=UTC`**）；本次在默认库 + 新建一次性库 `nao_todo_test_fresh` 上均跑通 ⇒ **有 TZ=UTC 条件**                                                                                                                                                                         | ✅          |

**服务端自跑精确数字**：`go build ./...` rc0 · `go vet ./...` rc0 · `go test -count=1 ./...` ⇒ **20 包 ok / 117 顶层 PASS / 0 SKIP** · 集成 `-p 1` ⇒ **21 包 ok / 180 顶层 / 441 含子测试 / 0 SKIP** · OCC 契约测试 `TestDecideUpsertOCCBase`（5 子例）· `TestSyncPushContract_BaseUpdatedAt*`（4 例）· `TestSyncPushOutcome_AllBranches`（5 分支）· 偏好回传契约（3 例）全 PASS。

---

## ⑧ 预览环境实机

**本 HEAD 对应部署**（GitHub Deployment API 查询，非猜测）：

- `deployment id = 6637963134` · `ref = sha = f89d0aea98427bcc9028953b4f3dc0626a8984cf`（**与本 HEAD 逐字一致**）· `environment = Preview` · `status = success`
- **URL = `https://naotodo-4ns8nqnjb-nathan3303s-projects.vercel.app`**（PM 示例 URL 为旧 HEAD `aia8werkh`，非本 HEAD）

**可达性：⚠️ 不可达（环境网络限制，非部署失败）**

- 本机 `curl` ⇒ `Could not resolve host`；`getent hosts vercel.app` **无输出**（apex 也不解析）⇒ **Vercel 全域 DNS 在本环境被阻断**；`fetch_content`（远端抓取）同样 `ENOTFOUND`；PM 给的旧 URL 亦不解析 ⇒ 与具体部署无关。
- 有出网能力（`api.github.com` 正常），仅 `*.vercel.app` 不可解析。

**替代证据（三层）**：

1. **构建级**：GitHub Deployment API 确认 **exact-HEAD 部署 `success`**（见上）。
2. **产物级**：本地 `pnpm exec vp run webapp build` rc0（23.02s）—— 与预览同源代码可构建。
3. **功能级（组件 + 数据面）**：本环境用 `jsdom` 挂载**两端共用**的真实组件完成交互链路 —— `conflict-ux.test.ts`「入口 → 列表 → 只读对比 → 两种恢复动作」；数据面 `conflict-ux-api.test.ts`（列表/对比/A/B 恢复）；离线/在线偏好读取由 `preference-sync.test.ts` T168b 组覆盖（**连续读 10 次 ⇒ 读路径 0 次 GET、对账 1 轮 ≤1 次**；**离线/慢网 ⇒ 读立即返回本地值、0 次 GET**；**远端胜仍成立**）。

**待办（建议）**：由具备 Vercel 出网条件的执行者补一次「真机走查」（登录 → 制造冲突 → 入口/列表/对比/两动作 → 离线/在线偏好读取），步骤即上列三层对应 UI 路径。

---

## ⑨ 已知限制确认（PM 信封「二」· 是否随发布说明登记）

| #   | 已知限制                                                                                  | 本报告确认                                                          | 是否随发布说明登记 |
| :-- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :----------------- |
| 1   | `POST /tags/:tagId/preference` 仍不回 `updatedAt`                                         | ✅ 确认（`tag.go` `Data: tagId`）；tag base 由触发点对账刷新        | **是**             |
| 2   | 面板级 `evicted` 常驻信号未做（`'evicted'` 文案在展开列表内）                             | ✅ 确认（面板级仅 `foldLimit`；`foldEvicted` 仅 `ConflictList` 内） | **是**（低优先）   |
| 3   | 字段级合并 / 版本向量 / 服务端 `version` 列 / BroadcastChannel-leader = 本批不做（N1–N4） | ✅ 确认（N1–N4 均未落地）                                           | **是**             |
| 4   | 服务端集成 harness 并行 AutoMigrate 竞态（口径固定 `-p 1`）                               | ✅ 确认并**实证复现**（空库不加 `-p 1` ⇒ Error 1050）               | **是**（开发者向） |
| 5   | `R-14` 同毫秒令牌碰撞、`R-15b` 删除不纳入 OCC                                             | ✅ 确认（ADR 已登记；非缺陷）                                       | **是**             |
| 6   | **R-16 OCC 后冲突增多（行为变更）**                                                       | ✅ 确认（UX 同批落地，但**用户可见冲突数会上升**）                  | **是（须显式）**   |

---

## ⑩ 交付、发布建议与未过项

### 交付

- **改动文件（仅测试，2 个）**：
    - `apps/web/src/components/sync/__tests__/conflict-ux.test.ts`（+7 例：mock 补 `useConflictUx`、交互链路、两文案区分、动作 B 失败提示、i18n 齐备/悬空/死键守护）
    - `packages/infrastructure/src/persistence-sync/__tests__/conflict-ux-api.test.ts`（+1 例：`foldedReason` 两信号同真 ⇒ `evicted` 优先，闭合 M4 盲区）
- **⛔ 未改任何实现代码**（`git diff --name-only` 仅上列 2 个测试文件）。
- 报告须 `vp check` **0 error** ⇒ 已满足（1446/1231）。

### 发布建议：**✅ 可发版**

- 8 项门禁全绿、AC1–AC6 全通过、阶段一 R-01…R-06 零回归、R-10…R-20 全通过、变异 5 项全部钉死、移动端 0。
- **须随发布说明登记的限制**（见 §⑨）：① tag 偏好推送不回 `updatedAt`（base 靠触发点对账）② 面板级 `evicted` 常驻信号未做 ③ 字段级合并 / 版本向量 / `version` 列 / BroadcastChannel-leader 本批不做 ④ 服务端集成 harness 需 `-p 1`（开发者向）⑤ `R-14` 同毫秒碰撞 / `R-15b` 删除不纳入 OCC ⑥ ⭐ **`R-16`：OCC 上线后离线陈旧 base 会使用户可见「冲突数」上升（行为变更，非缺陷）**。
- **不得声称**「偏好面全一致」的例外（延续 2A 纪律）：`T141` + `DP-5` 已落地且过回归 ⇒ 本批**可**声称偏好面收口；但 tag 推送不回 `updatedAt` 这一实现细节仍须登记。

### 未过项 / 风险

| 项                                | 级别              | 处置建议                                                              |
| :-------------------------------- | :---------------- | :-------------------------------------------------------------------- |
| `sync.conflict.title` i18n 死键   | 🟡 轻微（非阻塞） | 派 rd-fe 一行清理（删除三处定义）或接线为列表标题；已白名单钉死防扩散 |
| 预览环境本机不可达                | 🟡 证据替代       | 已有三层替代证据；建议由可出网环境补一次真机走查                      |
| M4 盲区（`evicted` 优先级无测试） | ✅ 已闭合         | qa 已补测（非实现变更）                                               |

---

## 附：命令与数字留档（可复现）

```text
# 客户端
pnpm exec vp check                              → rc0  1446 格式 / 1231 0 error
pnpm exec vp test --run                         → rc0  175 文件 / 1447 例 / 0 红 (96.64s)
pnpm run guard:ddd                              → rc0
pnpm run guard:gate-pathspec                    → rc0
pnpm run guard:barrel-imports                   → rc0  1231 文件 / 1298 导入 / 1871 命名
pnpm run guard:mobile-imports                   → rc0  72 文件
pnpm exec vp run webapp build                   → rc0  (23.02s)
pnpm run desktop:build                          → rc0  (27.70s)
git status --porcelain -- packages/presentation-react apps/mobile → 0 行

# 服务端（nao-todo-server @ arch/go-ddd）
go build ./...                                  → rc0
go vet ./...                                    → rc0
go test -count=1 ./...                          → rc0  20 包 / 117 PASS / 0 SKIP
go test -tags integration -count=1 -p 1 ./...   → rc0  21 包 / 180 顶层 / 441 含子测试 / 0 SKIP
# 空库不加 -p 1：Error 1050 Table 'project_preferences' already exists ⇒ FAIL（既有 harness 竞态）
```