# ADR：字段级合并（B 批）——客户端三方合并、服务端零改动

- 状态：已接受（待落地，`v1.19.0`）
- 更新：2026-11-10
- Owner：arch-designer（`T672`）
- 指针：`docs/prds/2026-11-09-field-level-merge.md`（Issue #340）· `docs/reports/T672-field-merge-arch-review.md`（10 问 10 答 / 文件级落点 / 工期）· `docs/reports/671-diff-field-conflict-verdict.md`（X/Y/Z 实测）· `docs/adr/2026-11-06-edit-vs-remote-overwrite.md`（保存侧三值判定）· `docs/adr/2026-11-03-sync-conflict-journal-crypto.md`（快照最小化）

## 背景

- 现状裁决粒度 = **整行快照**：服务端 OCC 只比 `baseUpdatedAt == updated_at`（`domain/types/upsert.go:45-50`），冲突即整行 LWW。两端各改**不同字段**（最常见：一台改标题、一台写描述）时，只要不恰好「对方改完、我保存前」拉取过一次，就必然留一条冲突记录且只能整行二选一，**选哪边都丢另一边的字段**。
- `T671` 三时序实测：X（已拉取）= 0 条且两边字段都保住；Y（先 push）= `stale`，随后 push 覆盖对方描述；Z（先 pull）= `pull-local-wins`，同样覆盖。
- `DEF-146` 只让覆盖**可见**；A 批累计的冲突数与「不同字段占比」表明「不必要的覆盖」是主要来源。
- 约束：`R-1` 单一判等 / `R-3` 不新增 kind / `R-4` 墓碑优先 / `R-5` 幂等 / `R-8` 仅 `tasks`；移动端红线；14–20 人天预算；服务端契约变更不得与客户端 PR 混发。

## 决策

1. **路线 = 客户端侧三方字段合并**（`B` 上次同步成功的字段值 × `R` 云端当前 × `L` 本地当前），**服务端零改动**（推送仍整行、`DecideUpsert` 不动）。
2. **基准 `B` 用「写时捕获的字段级基准」**（队列项可选字段 `fieldBase`，仅覆盖我改过的字段），**不用**行级 `syncedServerUpdatedAt` 近似，**不引入**行级全量基准快照与 Dexie 版本变更。
3. **唯一实现位置** = 纯函数模块 `persistence-sync/field-merge.ts`；两个边界（pull 的 remote-wins / 本地胜两支、push 的 `stale` 回执）只做「取输入 / 落结果 / 记账」。比较一律 `valuesEqual` + `SYNC_COMPARE_IGNORED_FIELDS`，合并域 = 推送载荷键集（**不造第四张字段表**）。
4. **冲突记账零新 kind**：同字段冲突沿用该边界既有 kind，附带字段级信号 `conflictFields`；不同字段合并成功**不记账**。`:deletedAt` 不进合并域（墓碑优先、禁复活）。
5. **回滚 = 同一函数的 `mode='lww'` 退化**（默认 `merge`），不维护第二套算法；`mode='lww'` 必须逐字复现今日 X/Y/Z 与 A 批断言。

## 理由

1. 业务匹配：用户编辑单元是**字段**，版本粒度应按编辑单元对齐；不同字段零冲突是用户直接可感的主路径（场景 1）。
2. 成熟度：三方合并（diff3 思路）是同步领域成熟解法；`R`/`L` 现成，缺的只有 `B`，而 `B` 在本地写点已可**零额外 IO** 得到（写前已读旧行）。
3. 兼容性：整行推 + 行级 OCC 不变 ⇒ 服务端与**未升级客户端**行为逐字不变（最坏退化为今日 LWW，不产生数据损坏）；移动端零改动（红线）。
4. 成本：17 人天（M0–M6），无迁移、无新依赖、无跨仓发布耦合；回滚成本 = 一个开关。

## 对照过的备选模式

1. **维持现状（整行 LWW + 可见记账）** —— 适用：单端使用、冲突极少；代价：不同字段必丢一侧（X/Y/Z 已实测）；不采纳。
2. **客户端三方合并（采纳）** —— 适用：多端常开、编辑单元是字段、服务端不可随批改动；代价：需字段级基准与两个边界接入；采纳。
3. **服务端字段级 OCC / `A5` 单调版本列（不采纳）** —— 适用：需要跨端强一致并发控制、可接受跨仓同发布；代价：契约变更 + 新列 + 部署；且**老客户端只发整行**，服务端要么自行持有基准行做 diff（等价把合并搬到服务端并新增存储），要么对整行载荷判冲突（**冲突反而变多**）；违反「服务端契约变更不得与客户端 PR 混发」；不采纳（`A5` 继续挂账）。
4. **行级全量基准快照（`syncBase` 列）** —— 适用：需要完整基准、可接受迁移与写放大；代价：≈2× 行体量 + Dexie 版本 + 每次 pull 写基准（与 `DEF-147` 同族）；不采纳（只覆盖我改的字段就够）。
5. **复用 `edit-origin`（`DEF-146` 的 `O`）作基准** —— 适用：只合并编辑器打开过的文本字段；代价：`persistedText` 仅 `name`/`description`（`DEF-153` 已实证）⇒ 非文本/集合/引用无基准，AC1 一半场景失效；不采纳（仅作补充信号）。
6. **改推送粒度为字段级 + 服务端字段级写（不采纳）** —— 适用：带宽敏感 + 服务端可改；代价：契约/兼容/回滚全面变复杂；且读码证明「整行推 + 先合并落库 + base 同轮推进」已自洽（服务端只比行版本）；不采纳。

## 后果与风险

- 正面：不同字段零冲突（AC1）、集合不丢（AC2）、`stale` 无重叠字段时零记账并可自动收敛（AC4）、墓碑语义不被合并破坏（AC6）；冲突记录总量下降，面板可显示「按字段」的冲突标签（复用既有 `conflict-field-labels`，零新 i18n 键）。
- 负面/风险：① **未升级端整行推**仍可覆盖新端刚合入的字段（兼容边界，非本批缺陷）；② 少数直写点（级联归档、番茄父行计数）若无基准捕获 ⇒ 该路径退化为今日冲突（须逐一接线并用源级断言守住）；③ 提醒四字段若逐字段合并会产出非法组合 ⇒ 按组原子合并；④ 老服务端回执缺 `serverCurrent` ⇒ push 侧不合并（降级为今日 `stale`）；⑤ 合并后用户可能看到「对方的字段被带进来」——属预期，冲突仍可见、文案需说明「已自动合并的字段不在此列」。
- 控制措施：基准缺失 ⇒ 保守冲突（不猜测合并）；合并落库与本地并发写互斥（revision 校验）；合并结果与本地行相同则不写（防与 `DEF-147` 相互放大）；`stale` 合并后**保队列**、下一轮 push 完成重推（网络往返不增加）。

## 限制与已知边界

- 仅 `tasks`（`R-8`）；其余实体本批行为不变，后续按同一 helper 逐个接入。
- 不含 `A5` 服务端单调版本列；不含事件溯源/操作历史（C 批）；不含偏好设置面（`F-05`）。
- 不含 `DEF-147`（回拉未变化行仍重写）与 `DEF-153`（非文本字段编辑基准）；合并逻辑不依赖二者。
- 老客户端/移动端：协议与字段集不变，行为 = 今日整行 LWW；本 ADR 不对其做任何承诺。
- 事务边界：`fieldMerge` 只做纯计算；持久化仍走既有 Dexie 事务与 `navigator.locks` 锁序（pull → journal）。
- 用例口径：AC8「既有用例零修改」按两层执行 —— 断言不得放宽、语义不得变；**靠「不同字段」构造 `stale`/`remote-wins` 的夹具必须同字段化**（合并后不再产生该记录是设计目的，不是回归），需 qa 出具等价性清单。

## 生产回滚操作说明（M6 定稿，2026-11-10）

- **开关键**：`localStorage['nao-todo:field-merge-mode']`（代码常量 `FIELD_MERGE_MODE_KEY`）；读取点**唯一** = `field-merge.resolveMergeMode()`。
- **取值**：缺省 / 非法值 / 读失败 ⇒ `merge`（默认：字段级合并）；`'lww'` ⇒ **一键降级为整行 LWW**（逐字复现 `v1.18.2`：pull 远端胜 = 整行覆盖 + 出队、pull 本地胜 = 只推进 base、push `stale` = 记账 + 出队）。
- **生效时机**：**下一次 pull / push 运行**（模式按**批**读取：`applyPullBatch` 与 `pushAllInnerLocked` 入口各读一次）。⛔ **无需重启、无需重新登录、无需改库 / 迁移**。
- **操作步骤**（浏览器控制台或桌面端 devtools，当前 origin）：
    1. 关闭合并：`localStorage.setItem('nao-todo:field-merge-mode', 'lww')`
    2. 触发一次同步（切页再回 / 点状态栏重试 / 等 30s 自动刷新）⇒ 冲突面板与 `sync.field-merge.applied` 结构化日志**停止增长**即为已生效
    3. 恢复合并：`localStorage.removeItem('nao-todo:field-merge-mode')`（或设为 `'merge'`）
- **已知边界**：① 关闭时**捕获仍继续**（队列项照旧写 `fieldBase`），只禁**消费**（ADR D7）⇒ 重开无需回填；② 关闭**不**回滚已合并的数据（合并结果已落库，属正常数据）；③ 关闭**不**影响 `DEF-146` 保存侧记账（`v1.18.2` 已有）；④ 面板「当前版本」取源（M4：带 `serverCurrent` 的条目取服务端行）**不随开关变化**（展示口径，非同步行为）。
- **验收实测**：`t683-rollback-switch`（真实仓储 + 真实 journal + 假服务端只模拟契约）在**同一进程 / 同一 DB** 内运行中切换：`merge` ⇒ 0 条 + 字段级两值；切 `lww` ⇒ 1 条 + 整行不合并；切回 `merge` ⇒ 再 0 条；并覆盖 `lww` 下远端胜支与 push `stale` 的逐字今日行为。

## 可观测（M6 · PRD NFR）

- **合并次数**：`syncStatus.get().fieldMergeCount`（内存态累计，不落盘、不参与运行边界；每次合并真正落库或产出冲突时 +1）+ 结构化事件 `sync.field-merge.applied`（字段：`table` / `conflicts` 计数，**⛔ 不含业务值**）。
- **冲突次数（按字段）**：从 journal 条目读 —— `conflictFieldCounts(entries)`（每条目 `conflictFields` 去重后各计 1；缺省字段的旧条目不计入）。⛔ 不新增 UI 面、不新增持久化字段。

## 相关指针

- 10 问逐答 / 文件级落点 / 工期表 / 受影响用例 triage：`docs/reports/T672-field-merge-arch-review.md`
- 三时序实测与取证载体：`docs/reports/671-diff-field-conflict-verdict.md` · `packages/infrastructure/src/persistence-sync/__tests__/t671-qa-diff-field-probe.test.ts`（Z 断言将按新行为翻转）
- 保存侧既有口径（不得回归）：`docs/adr/2026-11-06-edit-vs-remote-overwrite.md` · `packages/infrastructure/src/persistence-sync/edit-overwrite.ts`

## 参考来源

- 客户端 `packages/infrastructure/src/persistence-sync/sync-service.ts:112-143,1148-1216,1549-1630` · 访问 2026-11-10 · 推送载荷字段集（单一事实源）、pull 两分支、`stale` 处置与写回。
- 客户端 `packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts:16-56` · `persistence-local/db/local-database.ts:283-306` · 访问 2026-11-10 · 写前已读旧行（基准捕获零额外 IO）、队列记录纯追加无迁移。
- 客户端 `packages/infrastructure/src/persistence-sync/conflict-journal.ts:27-70,200-245,429-440` · 访问 2026-11-10 · 上限 200 / 截断 512 / 去重键 / 单一判等。
- 服务端 `domain/types/upsert.go:38-56` · `interfaces/controllers/sync.go:84-100` · 访问 2026-11-10 · OCC 仅比行版本（故整行推可自洽）；`stale` 回执携带 `serverCurrent`（push 侧合并的 `R`）。
- 客户端 `apps/web/src/components/sync/conflict-field-labels.ts:14-58` · 访问 2026-11-10 · 字段人话标签已就绪（AC9 零新 i18n 键）。
- [RFC 9110 §13.1.2 先决条件](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2) · 访问 2026-11-10 · 以「版本先决条件 + 失败重取」实现乐观并发的通用范式（本项目用 `baseUpdatedAt` 而非 ETag）。

## 实施口径补充（M1 落地时确认，2026-11-10）

- **`fieldBase` 的捕获形状 = 同步边界形状（实体明文）**：`tasks.name` / `tasks.description` 落库为 `plain:<明文>`（`crypto-service.PLAIN_PREFIX`），与同步边界（实体明文）**不同形状** ⇒ **⛔ 不得在记录层捕获密文字段**（捕获出的 `B` 会带 `plain:` 前缀 ⇒ 三方比较 `R==B`/`L==B` 恒假 ⇒ 远端行一到就把文本字段全判冲突，AC1/AC5 恒红）。任务写路径（`update` / `snooze`）在**实体层**捕获；级联归档 / 脱归档只改非密文字段（`archivedAt` / `projectId`），记录层捕获等价。**M1 已按此实现并有探针证据**（同一任务记录层 `'plain:A0-name'` vs 实体层 `'A0-name'`，`valuesEqual` 双向 false）。
- **同族陷阱（后续实体批次必须注意）**：`project-archive-cascade.ts:42` 的**项目行**目前仍是记录层捕获，而 `projects.name` / `description` 同样 `plain:` 加密 ⇒ **`R-8` 解除、projects 接入字段级合并时同一误判必复现** ⇒ 届时须改为实体层捕获（已登记 `DEF-155`）。
- **两条已知保守边界（`P3` 备忘，已登记 `DEF-156`）**：`entityBefore` 为浅拷贝（数组字段引用共享；今天全部整体赋值、就地 `push`/`splice` 命中 0 ⇒ 安全，但未来新增就地写路径须改深拷）；`restore` 与「对方改字段」并发时不自动合并（基准缺失 ⇒ 走保守路径）。
- **M2 复核新增的三条集成守卫（M3/M4 必守）**：① 调用方传入的 `fields` 必须是**完整合并域**（`entityToPush` 键集 − 忽略集），⛔ 不得传「差异字段子集」—— 否则提醒组的整组快照与 AC5 的冲突字段集合都会残缺；② `merged` 是**部分行**（不含 `id`/`userId`/`updatedAt`/`syncedServerUpdatedAt`/`revision`/`baseUpdatedAt`/`fieldBase`/`deletedAt`）⇒ 落库必须是 `{ ...localRecord, ...mergedFiltered }` + **base 单独推进**（不回退），⛔ 不得整行 replace，且 `deletedAt` 必须从本地行保留（`R-4`）；③ `merged` 可能出现**显式 `undefined`**（远端缺键而 `R==B` 取 `R` 的边界）⇒ **落库前必须过滤 `undefined`**，否则 spread 会清空本地值（触发面很窄但后果是数据丢失）。
- **覆盖缺口（`T677b` 发现）**：既有用例缺「**远端胜支 × 同字段冲突 ⇒ 冲突字段取 `R`**」的端到端用例 ⇒ 若 M3 在该支漏传 `lwwWinner='remote'`，套件抓不到。**裁定 = M3 批内由 qa 补 1 条**（红基线计数 14 → 15 已由 PM 授权）。
- **M3 落地时的三条口径（PM 追认，2026-11-10）**：① **缺失字段的基准补齐 = 取本地当前值**（`sync-service.augmentFieldBase`）—— 数学上等价于「我未改该字段 ⇒ `L==B` ⇒ 取 `R`」，**前提是该字段的写点必定入队**；该前提由**源级护栏**保证（新增直写点即红），若未来出现漏捕写点，表现是「我的改动被静默取远端」，因此护栏不得放宽。② **`lww` 开关按批读取**（`resolveMergeMode()`，读取点唯一），`lww` 时整批逐字走今日两支（同一函数退化，非第二套算法）。③ **`AC5-⑧` 与 `AC5-⑨` 的红点是 `conflictFields`（`M5` additive 字段）**，M3 后仍红属预期；M3 的应转绿集合不含它们。
- **M4 必守不变量（`T679b` 复核后补，2026-11-10）**：push `stale` 合并成功时，队列项的 `fieldBase` **必须退役为完整合并域**（键集 = `entityToPush` 键集 − 忽略集），并加一条**不变量断言**（合并后队列 `fieldBase` 键集 = 完整域）。理由：M3 的「缺失字段基准补齐 = 取本地当前值」只有在「该字段写点必捕获 / 或 base 已退役为完整域」时才等价；否则 `partial base + 一次漏捕写 + 重试` 可拼出**静默取远端**的路径（`679b` 已用探针复现该机制，当前无产品可达序列）。
- **已知唯一漏捕业务写点（`P3`，当前不可达）**：`resolveConflictRetryLocal` → `putRecordAndEnqueue` → `putWithSyncBaseAndEnqueue`（不传 `fieldBase`）。**PM 决定纳入 M4 顺带闭合**（用写前旧实体算 `fieldBase`，一处改动），并由 qa 补一条不变量用例。
- **并发守卫的正确语义（`T680b` 发现 F1，PM 裁定 M4 收尾补，2026-11-10）**：`stale` 回执在飞期间若检测到本地 `revision` 变化（推送期间有新本地写），**必须直接放弃本轮合并并 `continue`**：⛔ 不记账、⛔ 不写回 base、⛔ 不出队。**回落到今日 `stale` 分支是错的** —— 那会 ① 用「从未推送过的新本地值」当 `loser`（快照与被拒版本不一致）② 写回 base ⇒ 下一轮 push 直接 `applied` ⇒ **整行覆盖远端异字段**（正是 AC1/AC4 要消灭的窗口）。正确收敛：放弃 ⇒ 下一轮 `stale` 走**完整合并**（0 记账 + base 前进）⇒ 再下一轮 `applied`，两端都在。