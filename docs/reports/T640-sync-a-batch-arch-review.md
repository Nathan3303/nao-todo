# T640 数据同步 A 批（止血批）架构评审 —— 结论：**有条件可行**

- 状态：待 PM 拍板 · 更新：2026-11-03 · Owner：arch-designer
- 指针：PRD `docs/prds/2026-11-03-data-sync-a-batch.md`（AC1–AC11）· 审计 `docs/reports/2026-10-27-T562-data-sync-audit.md` · ADR `2026-09-24-stage2-both-ends-local-first.md`（§9.2/§9.8）· `2026-09-28-sync-conflict-timestamp-basis.md`（AC-T325-3）· 本次决策 ADR `docs/adr/2026-11-03-sync-conflict-journal-crypto.md`
- 口径：只读。**基线**：客户端 commit `6b7b023a`（`feat/320-data-sync-a-batch`，`main..HEAD` 仅 3 个文档提交 ⇒ 实现面 = `main`）；服务端 commit **`f0b84af`**。服务端工作区 `M docker-compose.yml` 为用户未提交改动，**未读未计入**（PM 已确认口径）。行号以当前 HEAD 为准（PRD/审计引用的 `sync-service.ts:967-981` 现值 **992-998**，评审按符号名引用）。
- **T562 基线（`5950c284`）→ 本基线（`f0b84af`）sync 语义核对**：相关提交 3 组 —— `230fcd0`（批量/分页/body 上限，无裁决语义，T562 已按工作区改动计入）· `7c8f483` + `f494f9e`（**F-06 修复**：检查项备注不再被清空、`sortId`/`attachments`/`isTopUp` 入 sync 契约）· `f0b84af`（SEC-12：逐条 `Error` 文案收窄为 `invalid/conflict/server_error`，**`outcome` 不变**）。⇒ **冲突/删除/游标语义与 T562 一致，其结论可直接引用**；但 **`F-06` 的事实基础已过期**，按本报告 Q5 更正。

## 0. 结论（先行）

可行，但**三处必须先修正前提**：① `R-H` 取 (b) 沿用明文 + 登记边界（(a)/(c) 均不可行，见 ADR）；② `A2` 缺「服务端行」来源，需定读路径（建议服务端 additive `serverCurrent`）；③ `A1` 若照现状写法落账，会**把墓碑复活制度化**（见 Q2）。`A6` 的事实基础已过期，实际只剩 `icon` 一项且**零 DDL**。预算 9–14 人天**偏紧**，实际 10.5–16.5（Q6）。

## 1. 六问逐条

**Q1 `R-H` 密文姿态（硬闸门）→ 结论 (b) 沿用现状 + 登记风险接受；否决 (a) 与 (c)。**

- 前提更正（决定性）：业务字段**早已不是密文** —— `cryptoService.encrypt` 恒出 `plain:<原文>`（`persistence-local/crypto/crypto-service.ts:207-211`），C-46 明文姿态已生效；故 `loser` 明文**不构成「弱于业务库」的副本**，F-13 的「加密/明文不一致」在 HEAD 已不成立。
- 否决 (a) 同批加密：C-46 明令「**禁止半明文**（部分字段加密/部分明文）——与弱化 KEK 同源，制造虚假安全感」（`2026-09-23-web-offline-*`:84）；且 web 从不 `setup/unlock`（仅 desktop，`apps/desktop/.../binding.ts:129,148`）⇒ 只加密 journal 会让 web 端要么读不出、要么回落明文（假安全）。真加密 = 全库专项（5–8 人天 + 冷启动密码门），与 D-6/K8 互斥。
- 否决 (c) 只存摘要：AC1 要求「据此恢复被覆盖字段」，无值即不可恢复 ⇒ 与验收冲突。
- 边界（须写入 ADR 与发布说明）：journal 仅存本机 IndexedDB (`meta`)，随登出/清库清除，无网络上报；威胁模型 = 能读本机磁盘/配置目录者可读 —— 与业务表同级。
- **代价**：实现成本 **0 人天**（(a) 单点加密 ≈1.5–2 人天但被 C-46 否决；(a′) 全库加密 5–8 人天 + 冷启动密码门）；残留风险 = 本机明文副本（≤200 条 × diff 子集），保留至登出/淘汰。
- 到期：三个触发点任一成立即重评 —— C-46 被重开（引入本地加密）/ B 批立项（字段级 journal 扩容）/ **2027-02-03**。
- 实施约束（(b) 的代价控制）：快照**只存 diff 涉及的字段 + 身份字段**（禁整行复制）、文本字段截断（≤512 字符 + `truncated` 标记）、上限**保持 200 不升**。ADR 落盘前不得实现快照落库（PRD R-H 原文）。

**Q2 `A1` 记账正确性。**

- 触发判据（三者同时）：`queued` 存在 · `remoteTs <= localTs` · **逐字段 diff 非空**（排除 `updatedAt/syncedServerUpdatedAt/revision`）。语义 = loser 是**远端快照**（将被本地覆盖的那一版）、winner 是本地。
- 必须新开 kind（如 `pull-local-wins`），**禁止复用 `remote-wins`**：后者 loser = 本地，`resolveConflictRetryLocal` 会把 loser 当本地版本重推；复用即「把对手内容当我方重推」。
- **墓碑特例（硬约束）**：远端是墓碑（`deletedAt` 非空）时**不得**走本分支。必须改走「远端胜」路径（应用墓碑 + 出队 + journal 本地内容）。现行本分支只收敛 base（`sync-service.ts:992-998`）⇒ 下一步 push 的 base 恰等于墓碑版本 ⇒ 服务端判 `Overwrite` 并无条件清 `deleted_at`（`task/repoImpl.go:135-141`）⇒ **确定性复活**。F-04 的「复活」实际由本分支制造，A1 必须同批修掉。
- 去重（必需，非可选）：pull 会多次跑在同一 queued 实体上。判据 `(table, entityId, kind, winnerUpdatedAt)` 已存在 ⇒ 不追加，仅 `occurrences += 1`。
- 有界：上限 200 不变，但增加**淘汰优先级** = `conflict`（不可恢复，保 50 个保留位）> `stale/noop/remote-wins` > `pull-local-wins`；`conflictJournalEvictedCount` 口径不变。
- 与 `F-09`：**必须同批**给优先级，否则伪 `stale` 会先把真冲突挤掉（直接违背 R-B）。低成本消噪（不需幂等键）：`stale/noop` 回执带服务端当前行（Q3 的 `serverCurrent`），若与本次推送载荷逐字段相等 ⇒ 判 `applied`（写回 base，不落账）⇒ 伪 stale 归零。

**Q3 `A2` 语义修正。**

- 前置缺口（预算被低估的原因）：**当前拿不到「服务端行」** —— `/sync/pull` 只有 keyset 批量（无按 id）；`stale/noop` 回执只有 `serverUpdatedAt`；REST `GET /tasks/:id` 等形状与 sync 条目不同（另一套 converter）。二选一：**(i) 推荐** `SyncResult` 增 additive `serverCurrent`（sync 条目形状，老客户端忽略）—— 一次改动同时服务 A2、A4（删除败方内容）、F-09（判等）；**(ii)** 客户端「按行补拉」（pull 该表 cursor=winner−1s、limit 200 内找 id、**不推进游标**）：零服务端改动、多一次往返、可能取不到。
- 四条不能写回的例外：① **本地又有新编辑**（队列 `revision`/`localUpdatedAt` 晚于该 journal 条目 `at`）⇒ 拒绝写回 + 保留条目 + 可见提示（否则静默丢新编辑）；② **删除中**（队列 `action='delete'` 或本地 `deletedAt` 非空）⇒ 不复活，保留删除意图并清条目；③ **解密/转换失败**（历史密文无 DEK ⇒ `decrypt` 抛错）⇒ fail-soft：不改行、不清条目、可见错误；④ **快照已过期**（服务端版本已新于 `serverCurrent`）⇒ 以新者为准，禁把 base 写回旧值。
- 幂等/并发：写回必须是**单 Dexie 事务**（业务表 + `syncQueue` + `meta`），锁序固定 `journal 锁 → Dexie 事务`（现有 `withJournalRmw` 只碰 `meta`、无反向取锁 ⇒ 无死锁）；**base 只前进不回退**（`newBase <= 当前 base` 则跳过）；重复点击因条目已清 ⇒ no-op；与后台 pull/push 并发的最坏结果 = 下轮 `stale`（可见，不静默）。
- UI 缺口：`resolveConflictKeepServer` 恒返回 `ok:true`，hook 直接忽略返回值（`apps/web/src/hooks/use-conflict-ux.ts:79`）⇒ 必须接出「失败 / 待下次同步生效」两态，否则 AC2 无法验收。
- 旧服务端降级：回执无 `serverCurrent` ⇒ 显示「将在下次同步后生效」，**不得**假装已生效（R-E）。

**Q4 `A4` 跨仓删除 OCC。**

- 契约：`SyncDeletion` 加 `baseUpdatedAt,omitempty`（缺省 ⇒ 逐字现状，`interfaces/types/sync.go:5-9`）。客户端逐条取该行 `syncedServerUpdatedAt`；行已物理缺失 ⇒ 不带 base（回退删除优先）。
- 服务端守卫（6 表；`pomodoroRecords` 保持 `skipped`）：无 base ⇒ 无条件软删（逐字不变）；`base == updated_at` ⇒ 软删；不等 ⇒ `stale` 不写。**必须回传真实写入的 `updated_at`** —— 现状控制器用循环前的 `now`（`interfaces/controllers/sync.go:339-370`）而各 repo 自行 `time.Now()`，两者可差 1ms ⇒ 客户端写回 base 后**永久 stale**（R-20 级灾难路径，A4 会把它激活）。
- 兼容矩阵：老客户端 + 新服务端 ⇒ 无 base ⇒ 删除优先（回归用例锁死）；新客户端 + 老服务端 ⇒ base 被忽略 ⇒ 删除优先，客户端**不得**据「没收到 stale」认定已裁决（以回执是否有 `outcome` 做能力探测）。**R-D 逐字不变成立**。
- 两种顺序：编辑先推、删除后到（旧 base）⇒ `stale` ⇒ 编辑赢，删除入账（「未删除」可见）；删除先到、编辑后推 ⇒ `stale`（base 不匹配墓碑）⇒ 删除赢，编辑入账。同向重复删除（已是墓碑）⇒ 幂等 `applied`，不记账（避免噪声）。
- 墓碑复活：带 base 的新客户端在 base ≠ 墓碑版本时天然不能复活；**仅「无 base 的本地新行/旧库行」仍可复活**（老行为，登记）。真正的复活主因是 Q2 的 tombstone 特例，必须同批修。
- 拉取语义：**不变**（`deletions` 不进 pull；墓碑仍由 `/sync/pull` 按 `updated_at` 游标下发）。删除被 `stale` 拒绝 ⇒ 不产生新墓碑 ⇒ 无游标变化，对端仍看到编辑后的行（正确）。
- 连带风险（登记）：父子级联删除（删任务 ⇒ 子任务/检查项/评论各自入队）在父删除 `stale` 时会**部分删除**。A4 只让它可见，不修。

**Q5 `A6` 字段收口落地形态（事实已大幅收敛，审计 F-06 部分过期）。**

- `projects/tags.sortId`：**已进契约**（服务端 `f494f9e`，DTO `*uint16` 存在性语义）⇒ 不需 DDL、不需改。
- `taskComments.attachments/isTopUp`：**已进契约**（`7c8f483`，存在性遮蔽）⇒ 不需 DDL。
- `taskCheckItems.description`：服务端**已改为存在性写入**（`NullableString` + `DescriptionSet`，缺键不写列，`infrastructure/persistence/task/converters.go:115-124`）；客户端本就无该字段（`persistence-go/task/converters.ts:158` 注释掉）且无 UI ⇒ 结论 = **「客户端不承载」**，不补字段、不加列。静默清空已不存在。
- `projects.icon`/`tags.icon`：**唯一真缺口**。无列、无 DTO、**无写入口径**（全仓 icon 恒 `'more2'`/`'tag'`，无图标选择器），拉取侧硬编码覆盖本地（`persistence-go/{project,tag}/converters.ts`）。
    - 推荐：**收口为「契约不承载」** —— 从 `SYNC_TABLES.entityToPush` 移除 `icon`、清空对应白名单、文档/发布说明写「清单/标签图标为本地默认样式」。**DDL = 0**。
    - 不推荐加列：为无写入口的字段建列 + 迁移 + 回填 + 回滚（2–3 人天，收益 0）。若 PM 要「图标可跨端」⇒ 那是**新功能**（选择器 + 列 + DTO + 迁移 ≥3 人天），出 A 批。
- `pomodoros.totalDuration`：服务端原子维护，白名单保留（无害）。
- ⇒ **A6 零 DDL，回填/回滚代价 = 0**，预算 2–3 → **0.5–1 人天**。

**Q6 拆分顺序与可测性。**

- 建议改序：**服务端先**（A4 删除 OCC + `serverCurrent` additive）→ **A2** → **A1 + A3** → **A6**（A6 也可提前，与其余零耦合、零风险）。理由：A2/A1/A3 都要「服务端行」；A2 最小且是 AC2 前提。
- 红基线（全部可 jsdom + fake-indexeddb + mock Requester 造，同型夹具见 `__tests__/t326-sync-conflict-client.test.ts`）：
    - A2：`stale` 条目 → 点「保留服务端」→ 断言本地行逐字段 == 服务端行、`syncedServerUpdatedAt == serverUpdatedAt`、队列空、journal 空；再断言「点后编辑 → push 带新 base ⇒ `applied`」；另断言四条例外各自不写回。
    - A1：queued + `remoteTs <= localTs` + 字段差异 ⇒ journal 恰 1 条 `pull-local-wins`（loser=远端快照、diff 仅差异字段）；重复 pull ⇒ 仍 1 条；**remote 为墓碑 ⇒ 墓碑生效 + 出队 + 不复活**。
    - A3：`conflict`/`skipped` 的 `loser` 非空；「重生成 ID」先只覆盖**无子实体**任务。
    - A4：客户端侧 mock 回执 `stale` ⇒ journal + 本地行保留 + 不复活；服务端侧必须 Go 用例（`DecideUpsert` 同族的删除判定纯逻辑 + 控制器契约：无 base 逐字旧行为 / base 命中 / base 不匹配 / 墓碑幂等 / **回传时间戳 == 库中值**）。
    - A6：`dropped-fields.test.ts` 的「精确相等」契约镜像（移 icon 后必须同步服务端承载集 fixture）+ 拉取 converter 不再硬编码覆盖。
- 只能真服务端证明的：A4 的「回传 `updated_at` == 库值」（Go 集成，本仓不引入 MySQL）；`serverCurrent` 形状（服务端契约测试）。

## 2. 风险清单（影响 → 应对）

1. R-H 未落 ADR 就实现快照 → 返工/合规 → 前置条件（ADR 已写，待 PM 提交）。
2. A1 复用 `remote-wins` → 恢复动作方向反了（把对手内容当我方重推）→ 新 kind + 两侧动作白名单。
3. A1 不特判墓碑 → 复活被制度化 → Q2 硬约束 + 红基线。
4. A2 写回过期快照 → base 回退 → 只前进 + 版本比较。
5. A4 服务端回传时间戳 ≠ 库值 → 永久 stale → 回传真实值 + Go 用例。
6. 父子级联删除部分删除 → 可见但不修 → 登记接受或另立单。
7. journal 体积/淘汰挤占 → 保护位 + 去重 + 截断（Q2）。
8. 旧服务端无 `serverCurrent` → A2 假装成功 → 显式「待下次同步生效」。
9. 新 kind 漏本地化 → AC7 内部词回归 → 三处 locale + `KIND_KEYS` + `SNAPSHOT_KINDS` + 死键/零命中用例。

## 3. 实施约束（可直接落成验收条款；论证见 Q1–Q4）

- 快照 = **diff 子集**，非整行；文本截断 ≤512 字符；上限 200 不升；淘汰按 Q2 优先级；本机明文姿态（C-46）不变，**不得**「部分字段加密」。
- `deletions` 缺省行为与老客户端行为**逐字不变**（回归用例）；服务端 delete 结果 = 库中真实 `updated_at`；`A1` 的墓碑特例为硬约束。
- `A2`：单事务写回 + base 只前进 + 四例外不写回 + UI 两态（失败 / 待生效）；旧服务端降级须可见、不得假装生效。
- `A4`：服务端先发；`AC7` 扩展为新 kind 的用户可读标签（禁 `pull-local-wins` 等裸词）。
- NFR 口径：同步主路径**往返次数不变**（`A1` 仅本地 `meta` 一次 RMW；`A2` 的读只在用户点击时发生；`A4` 零增往返）；验收 = 单端同步耗时前后差值 <5%（同型夹具跑 3 次取中位）+ `push` 体积中位数无增长（`A6` 移 `icon` 后应下降）。

## 4. 预算复核：**9–14 偏紧，实际 10.5–16.5（中位 ≈13）**

- 分项：A1 **2.5–3**（原 2–3）· A2 **1.5–2.5**（原 0.5–1，含 `serverCurrent` 客户端侧 + 两态 UX）· A3 **0.5–1**（砍「重生成 ID」）/ **1.5–2.5**（含）· A4 **3–4.5**（原 2–3.5，6 表 + 真实时间戳 + 老客户端回归）· A6 **0.5–1**（原 2–3）· AC9 统计/导出 **0.5–1**（原未单列）· 门禁 + QA + 跨仓联调 **2–3**。
- 超支风险点：跨仓两 PR 的发布顺序与联调 · 冲突 UI 三处新 kind 接入 · 父子级联删除语义 · A3 的级联改 FK。
- 保 14 的三条切口（按性价比）：① A3「重生成 ID」拆 A3b（−1–1.5）② A6 移 icon 出载荷（−1.5–2）③ A2 改客户端按行补拉（服务端 −1 / 客户端 +0.5，但牺牲 F-09 判等）。**不建议**砍 A4 的真实时间戳回传（R-20 级）。

## 5. 待 PM 拍板（trade-off，不代拍）

- **D1** `R-H` = (b)？(a)/(c) 已否决；是否接受 ADR `2026-11-03-sync-conflict-journal-crypto.md` 并据此解禁快照落库。
- **D2** A2 读路径：(i) 服务端 `serverCurrent`（+1 服务端人天，同时解 A4/F-09）还是 (ii) 客户端按行补拉（零服务端改动）。
- **D3** A3 是否含「重生成 ID」（含 ⇒ +1–1.5 人天 + 级联 FK 风险）。
- **D4** A6 的 `icon`：移出契约（推荐，0 DDL）还是纳入「图标跨端」新功能（出 A 批）。
- **D5** 预算上限：维持 14 并用三条切口，还是上调至 16。
- **D6** A4 默认方向签字：带 base 时「按 base 判」、缺 base 时「删除优先」；同向重复删除幂等不记账。
- **D7** `F-09`（伪 stale 挤占）是否同批（推荐：是，用 `serverCurrent` 判等）。

## 6. 连带同步清单（本次结论改变既有条款）

- `docs/adr/2026-09-24-stage2-both-ends-local-first.md`：§9.8 `R-15b`（删除不纳入 OCC）由 A4 解除；§9.2.1 kind 枚举 + §9.2.4 上限策略扩展；§9.1.3 本地胜 rebase 加墓碑例外。Owner：arch → PM 定稿。
- `docs/adr/2026-09-28-sync-conflict-timestamp-basis.md`：`AC-T325-3`（本地胜必 rebase）加墓碑例外。Owner：arch。
- `docs/reports/2026-10-27-T562-data-sync-audit.md` §2 `F-06`：`sortId`/`attachments`/`isTopUp`/`checkItem.description` 已在 HEAD 修复（服务端 `f494f9e`/`7c8f483`）⇒ 事实更正；`F-13` 前提按 Q1 更正。Owner：qa/PM。
- PRD `2026-11-03-data-sync-a-batch.md`：A3 范围、A6 范围、AC5（icon）、§六 R-H 引用 ADR。Owner：PM。

## 7. 参考来源

- 客户端：`packages/infrastructure/src/persistence-sync/{sync-service,conflict-journal,dropped-fields}.ts` · `persistence-local/crypto/crypto-service.ts:207-211` · `persistence-local/migration/plaintext-migration.ts` · 访问 2026-11-03 · 拉取/推送/journal/白名单/明文姿态。
- 服务端（`f0b84af`）：`domain/types/upsert.go` · `infrastructure/persistence/task/{repoImpl,converters}.go` · `interfaces/controllers/sync.go` · `interfaces/types/{sync,task,project,tag}.go` · 访问 2026-11-03 · 裁决/删除/时间戳/DTO 承载。
- 文档：C-46 明文姿态 ADR · 阶段二 ADR §9 · T325 ADR · T562 审计 · 访问 2026-11-03 · 既有条款与前提。

> 未检索外部资料：本单为仓内机制评审 + 既有条款裁决，无需业界方案对照；若 A6 改走「图标跨端」新功能，建议届时补同类产品对照。

- 修订：2026-11-03 首次评审（六问结论 + 预算复核 + 待拍板 7 项）