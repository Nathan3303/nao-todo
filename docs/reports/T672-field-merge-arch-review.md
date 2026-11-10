# T672 · B 批（字段级合并）架构评审

- 状态：**有条件可行（唯一推荐路线已定；5 项待 PM 拍板）** · ⛔ 未改代码 / 未建分支 / 未 commit
- 日期：2026-11-10 · Owner：arch-designer（`T672`）
- 分支：`feat/340-field-level-merge`（HEAD `4a338be1`，含 PRD 提交）· Issue **#340**
- 输入：`docs/prds/2026-11-09-field-level-merge.md`（R-1…R-8 / AC1–AC9）· `docs/reports/671-diff-field-conflict-verdict.md`（X/Y/Z 实测，取自 `nao/671-diff-field-verdict` 分支）· `docs/prds/2026-11-03-data-sync-a-batch.md` · `docs/adr/2026-11-03-sync-conflict-journal-crypto.md` · `docs/adr/2026-11-06-edit-vs-remote-overwrite.md`
- 跨仓只读：`nao-todo-server@730455d`（结论：**本批服务端零改动**）
- 产物：本报告 + `docs/adr/2026-11-10-field-level-merge.md`（+ 索引一行）

## 一、结论先行（10 问 10 答）

| #   | 问题                         | 结论                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 合并算法落点 / 基准 `B` 来源 | **纯函数模块 `persistence-sync/field-merge.ts`（唯一实现）**，两个边界调用它；`B` = **写时捕获的字段级基准**（`SyncQueueRecord.fieldBase`，可选字段、**零 Dexie 版本变更 / 零迁移**）。行级 `syncedServerUpdatedAt` **不够**（它只证明「行变过」，不能回答「哪个字段变过」）；`edit-origin` **不能复用为基准源**（只覆盖编辑器打开过的文本字段，`DEF-153` 已实证）                                             |
| 2   | 是否必须改服务端             | **不必**。唯一推荐 **(i) 客户端侧三方合并**；**(ii) 服务端字段级 OCC / `A5` 单调版本列 ⇒ 否决**（对老客户端反而制造更多冲突，且违反 PRD 变更治理「不得与客户端 PR 混发」）。(i) **足以满足 AC1**，硬缺陷仅「老客户端整行推可覆盖新客户端字段」（见 §四 R-3，属兼容边界不是本批缺陷）                                                                                                                           |
| 3   | 整行推是否会自造冲突         | **不会——前提是合并结果先落本地、`base` 同轮推进**（这正是设计）。读码证据：`DecideUpsert` 的 OCC 分支只比 `baseUpdated == existingUpdated`（`domain/types/upsert.go:45-51`）⇒ 合并后本地行 = `R` 的未改字段 + 我的字段、base = `R.updated_at` ⇒ push 必判 `Overwrite`。**唯一会 stale 的时序是「先 push 后 pull」（T671 时序 Y）⇒ 用 stale 回执里的 `serverCurrent` 就地合并、保队列，下一轮 push 必 applied** |
| 4   | 字段类型规则                 | 见 §三 D4 表：标量/枚举/布尔/时间 = 三方；`tags` = **逐元素存在性三方 + 并集不丢**（非整数组覆盖）；`parentTaskId`/`projectId` = 引用标量；`archivedAt` = **归档优先**（非空方胜）；`deletedAt` = **墓碑优先**（整行裁决、不参与字段合并、不得复活）；派生计数（`checkItemCount` 等）= **服务端 owned，恒取 `R`**                                                                                              |
| 5   | 冲突记账口径                 | **不新增 kind**。合并成功 0 记账；同字段冲突走该边界既有的 kind（pull 侧 `remote-wins` / `pull-local-wins`，push 侧 `stale`），**附加字段级信号 `conflictFields: string[]`**（追加字段，不改既有语义）；去重/幂等由 `appendConflict` 的可选 `dedupeKey` 承担（默认关闭 ⇒ 老调用点零变化）；`occurrences` 语义不变，上限 200 与 512 截断**不受影响**（条目数只会下降）                                          |
| 6   | 幂等与 `DEF-147`             | 合并必须幂等（重复应用结果不变）；**`DEF-147` 不必同批修**——合并路径自身「无差异不写」，不依赖「每轮都重写」；两者唯一耦合是写放大，合并上线后反而变小                                                                                                                                                                                                                                                         |
| 7   | 回滚开关                     | `fieldMerge` 模式开关（`localStorage` 持久，默认 `merge`）+ **同一函数 `mode: 'lww'` 退化**（不是第二套实现）；`mode='lww'` 时 T671 X/Y/Z 与 A 批既有断言逐字复现（双态断言守住「开关真的退化」）                                                                                                                                                                                                              |
| 8   | 红基线 + 变异                | 不变量 6 组（AC1 X/Y/Z + 300ms、AC2 集合、AC4 stale 重推、AC5 八项矩阵、AC6 墓碑、AC8 零回归）；**变异 6 条**（AC7 五条 + 「未知基准当基准」）见 §六                                                                                                                                                                                                                                                           |
| 9   | 工期                         | **17 人天**（M0–M6，见 §七）⇒ 落在 14–20 上限内                                                                                                                                                                                                                                                                                                                                                                |
| 10  | 风险                         | 10 项见 §八（老客户端整行推 · 移动端只读 · 墓碑误复活 · 集合重复 · 同毫秒/时钟 · 首次全量 · 用户看到意外值需不需要告知 · 提醒字段耦合 · 写点漏捕 · 老回执缺 `serverCurrent`）                                                                                                                                                                                                                                  |

## 二、证据锚点（读码，不推定）

| 事实                                                                                                       | 位置                                                          | 对决策的作用                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 拉取分支现状：`queued` + `remoteTs > localTs` ⇒ **remote-wins 整行覆盖 + 出队**                            | `sync-service.ts:1148-1178`                                   | 时序「远端更新后本端才 push」也会丢我的字段 ⇒ **必须在此支拦截合并**                          |
| `queued` + 远端墓碑 ⇒ remote-wins（禁复活）                                                                | `sync-service.ts:1179-1202`                                   | 墓碑只能整行裁决，**不得**进字段合并                                                          |
| `queued` + `remoteTs <= localTs` ⇒ 本地胜：A1 记 `pull-local-wins` + **仅推进 base、不动业务字段、不出队** | `sync-service.ts:1203-1216` + `744-777`                       | 时序 Z 的现状：记账诚实但**整行覆盖**（T671 Z）                                               |
| A1 的「挑差异字段」已抽成共享 helper `pickChangedFields`（`valuesEqual` + 忽略集单一来源）                 | `edit-overwrite.ts:31-46`                                     | 合并内核必须复用同一判等，**不得**新增第二套比较语义（R-1）                                   |
| 保存侧三值判定 `pickOverwrittenFields`（`R`/`L`/`O`）已在本地写点                                          | `persistence-local/repos/task-repo-impl.ts:145-165`           | 与合并判据**同源**（同一 `valuesEqual`）；但 `O` 只覆盖「编辑器打开过的字段」⇒ 不能当全局基准 |
| 本地写 → 行 + 入队**同一事务**，且写前已读旧行                                                             | `put-with-sync-base.ts:16-27,44-56`                           | **基准捕获的天然落点**（旧行 = 基准候选，零额外 IO）                                          |
| 队列记录结构纯追加、**无 Dexie 版本约束**                                                                  | `local-database.ts:283-306`（`revision` 注释即先例）          | 新增可选 `fieldBase` **不 bump version、无迁移**                                              |
| push 回执已携带 `serverCurrent`（仅 `stale`/`noop`）                                                       | 服务端 `interfaces/controllers/sync.go:84-100`                | push 侧合并的 `R` 现成；**缺省即降级**（老服务端）                                            |
| `stale` 现状：记 `stale` + 写回 base + **出队**                                                            | `sync-service.ts:1576-1630`                                   | 合并后必须**保留队列项**（否则我的字段无人推送）                                              |
| F-09 伪 stale 消噪（载荷 == `serverCurrent` ⇒ 判 applied）                                                 | `sync-service.ts:1549-1555` + `sync-normalize.ts:73-88`       | 合并路径与其**正交**（合并结果是「我 + 他」的并集，不等于 `serverCurrent`）⇒ 不能靠它兜底     |
| 服务端 OCC 只看行版本，无字段概念                                                                          | `domain/types/upsert.go:38-56`                                | 证明「整行推 + 字段级合并」在服务端**无感知、零契约变更**即可成立                             |
| 推送载荷字段集是单一事实源（`buildTaskPush`）                                                              | `sync-service.ts:112-143`                                     | 合并域 = `entityToPush` 键集 − 忽略集（**不再造第四张字段表**）                               |
| 冲突字段已有人话标签表（含 `name`/`description`/`tags`/`archivedAt` 等 40+ 键）                            | `apps/web/src/components/sync/conflict-field-labels.ts:14-58` | AC9「按字段呈现、零新 i18n 键」**已具备**，只差把 `conflictFields` 传给面板                   |

## 三、逐问详答

### D1 合并算法：唯一落点与基准来源

**落点（唯一实现位置）**

- 新增 **纯函数模块** `packages/infrastructure/src/persistence-sync/field-merge.ts`：
    - 入口 `mergeBusinessFields({ table, base, remote, local })` → `{ merged, conflictFields, localOnlyFields, remoteOnlyFields, retiredBase }`；
    - **无存储 / 无网络 / 无日志副作用**（可 100% 单测 + 变异，AC5 矩阵、AC7 变异都靠它）。
- **两个调用点**（都在 `sync-service.ts`，只做「取输入 / 落结果 / 记账」，不含判定逻辑）：
    1. `applyPullBatch`：拦截「remote-wins」与「本地胜」两支（墓碑支**不拦截**）；
    2. `pushAllInnerLocked`：`outcome === 'stale'` 且有 `serverCurrent` 时（F-09 之后、journal 之前）。
- **不放在本地仓储**：仓储写路径拿不到 `R`（云端当前）——它只在 pull / push 回执里出现；放在仓储会强迫「合并 = 保存时行为」，与「拉取时合并」的时序矛盾，且会把同步语义塞进写路径（违反 A 批已建立的「保存侧只管可见性」分层）。
- **不新增第二套判等**：比较一律 `valuesEqual`（`conflict-journal.ts:429-440`，空哨兵归一），字段域一律 `SYNC_COMPARE_IGNORED_FIELDS`（`sync-normalize.ts:26-33`）+ `entityToPush` 键集。**禁**新增忽略表 / 字段白名单。

**基准 `B`：行级时间戳不够，必须有字段级基准**

- 反证：`B` 的用途是回答「**这个字段**对方改过吗」。可行级 `syncedServerUpdatedAt` 只能回答「这一行变过」，于是「对方改了描述、我改了标题」时，我的标题会被判成「对方也改过标题」——**正是 AC1 主路径**。用时间戳近似 ⇒ 要么过度冲突（AC1 红），要么过度合并（丢对方字段）。
- **采纳设计：写时捕获（增量基准）**
    - `put-with-sync-base.ts` 已经 `table.get(record.id)` 读旧行（为回填 `syncedServerUpdatedAt`）⇒ 同一处顺便算出 `touched = {f | !valuesEqual(existing[f], record[f])}`，把**旧值**写入队列项 `fieldBase`（`fieldBase[f] ??= existing[f]`，**首次写胜**，后续同实体重复写只更新 `L` 不覆盖 `B`）；
    - 合并只需 `B` 的字段 = 我改过的字段（未改动字段直接取 `R`）⇒ 存储量 = 每个脏行的「改动字段数」，典型 < 1 KB；
    - 合并成功（或 pull 收敛 base）后，把 `fieldBase[f]` 重置为 `R[f]`（基准只前进，R-6 同源），使「同一笔未推送改动」在重复 pull 下判据稳定（幂等）。
- **成本对照（迁移 / 存储）**

| 方案                                   | 存储                            | 迁移                                | 代价                                                                                                                                         | 结论                         |
| -------------------------------------- | ------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **写时捕获 `fieldBase`（采纳）**       | 仅脏行 + 仅改动字段             | **无**（可选字段、无 version bump） | 需要覆盖全部本地写点（清单见 §五 D1-b）                                                                                                      | 采纳                         |
| 行级全量基准快照 `syncBase`            | 全量行 × 业务字段（≈2× 行体量） | 需 version bump + 回填/懒建         | 每次 pull 都要写基准 ⇒ 写放大（与 `DEF-147` 同族）                                                                                           | 不采纳                       |
| 复用 `edit-origin`（`DEF-146` 的 `O`） | 0（已有）                       | 无                                  | **只覆盖编辑器打开过的文本字段**（`persistedText` 仅 `name`/`description`，`DEF-153` 已挂账）⇒ 非文本/集合/引用全无基准 ⇒ AC1 一半场景无法判 | 仅作**补充信号**，不作基准源 |

**基准缺失时（老数据 / 未覆盖写点 / 首次升级）**：`B_f` 未知 ⇒ **该字段按「不许合并」处理**（`R≠L` 即视为冲突，走今日整行裁决）。理由：宁可退回今天的行为，也不做「基于猜测的静默覆盖」。这条同时是 A 批既有用例（`t641-a1` 等）**零修改**能保持绿的原因（其夹具正是同字段或基准缺失）。

### D2 是否必须改服务端：路线对比与推荐

| 维度        | (i) 客户端三方合并（**推荐**）                       | (ii) 服务端字段级 OCC / `A5` 单调版本列                                                                                     |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| AC1 可行性  | ✅（`R`/`B`/`L` 齐备即可）                           | ✅（但需要字段级 diff 提交格式）                                                                                            |
| 服务端契约  | **零变更**（整行推不变，`DecideUpsert` 不动）        | 变更：推送载荷需字段级 base / 版本列；`A5` 需新列 + 部署                                                                    |
| 老客户端    | 行为不变（其整行推照旧走行级 OCC/LWW）               | **更差**：老客户端只发整行 ⇒ 服务端需自行做「基准行 diff」才能判字段，等价把合并搬到服务端且无 `B` 行快照（要么再存基准行） |
| 部署/回滚   | 前端发版即生效，一键开关降级                         | 前后端必须同步；违反 PRD 变更治理「重评触发点 2：不得与客户端 PR 混发」                                                     |
| 成本        | 17 人天（M0–M6）                                     | +服务端列/迁移/兼容矩阵，≥10 人天附加                                                                                       |
| 时钟/同毫秒 | 不依赖客户端时钟（OCC 只比服务端返回的 base 字符串） | 同左，但引入新版本语义需再定「同版本并发」口径                                                                              |

**结论：唯一推荐 (i)。** (i) 对 AC1 的硬边界只有一条：**老客户端（未升级）的整行推仍会覆盖新客户端刚合入的字段**——这不是本批引入的缺陷（今天所有端都这样），且合并会让它在**新端可见、可恢复**（journal 里有败方字段）。`A5` 留作「多端高并发 + 需要真正字段级乐观并发」时的独立批次（PRD 已挂账）。

### D3 推送粒度：整行推 + 字段级合并能否自洽（本批核心风险点）

**结论：能自洽，且不需要改推送粒度。** 读码依据与推演：

1. 服务端写判定（`DecideUpsert`）**只比行版本**：`base == existing.updated_at` ⇒ `Overwrite`（整行写），否则 `Stale`。它不读字段，因此「合并 → 整行推」在服务端看来是一次普通覆盖，**不会因为「我带了未改动字段」而 stale**。
2. 所以自洽的**充要条件**是：**合并结果必须在 push 之前落到本地行，且同轮把 base 推进到 `R`**。满足后，push 载荷 = 合并结果（含对方的未冲突字段），服务端覆盖后两端一致（AC1 的 `name`/`description` 都保住）。
3. **唯一会 stale 的时序是「先 push 后 pull」（T671 Y）**——此时客户端还没见过 `R`，服务端按行版本判 stale 是**正确**的（它保护了对方那次写入）。修复点不在「改粒度」，而在**回执侧**：`stale` 已带 `serverCurrent`（服务端 `sync.go:96-100`）⇒ 拿它当 `R`、拿 `fieldBase` 当 `B`、拿本地行当 `L` 就地合并；无同字段冲突 ⇒ **不记账、不删队列项**，下一轮 push 以新 base 命中 `applied`（AC4 形状）。
4. **反证「不改粒度就会制造冲突」**：若只做 pull 侧合并不做回执侧合并，则 Y 时序仍每轮记一条 `stale`（AC1 红）；若做了回执侧合并但**出队**，则我的字段无人再推（下次 pull 无队列 ⇒ 被 `R` 整行覆盖）⇒ 必须**保队列**。这两点是本批最容易写错的实现细节，已列为变异点（§六 M4）。

### D4 字段类型规则（合并域 = `entityToPush` 键集 − 忽略集）

| 类型                     | 字段                                                                                     | 规则                                                                                                                                                 | 理由                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 文本                     | `name` `description`                                                                     | 三方（`R==B`→`L`；`L==B`→`R`；`R==L`→任一；否则冲突）                                                                                                | 用户编辑单元就是字段                                                                                                            |
| 枚举 / 布尔              | `state` `priority` `isTopUp`                                                             | 同标量三方                                                                                                                                           | 无中间态可合并；冲突必须可见（R-2）                                                                                             |
| 时间戳（标量）           | `startAt` `endAt` `starMarkAt` `givenUpAt` `remindAt`                                    | 同标量三方；空哨兵归一（`''`≡`null`）                                                                                                                | 空/非空是业务态，不参与「取更晚」                                                                                               |
| 时间戳（墓碑）           | `deletedAt`                                                                              | **不进合并**：任一侧非空 ⇒ 该行按墓碑语义整行裁决（删除优先，禁复活）                                                                                | PRD R-4；A 批已验证「墓碑参与合并 ⇒ 确定性复活」                                                                                |
| 时间戳（软状态）         | `archivedAt`                                                                             | **归档优先**：任一侧非空且另一侧为空 ⇒ 取非空；两侧同为空 ⇒ 按三方                                                                                   | AC6「归档与改字段并发 ⇒ 归档胜」；归档不删除内容 ⇒ 其它字段继续合并                                                             |
| 集合                     | `tags`                                                                                   | **逐元素存在性三方 + 并集不丢**：结果 =（我的集合 ∪ 对方集合）− 我删除的 − 对方删除的；去重（按值）；顺序 = 我的相对顺序在前，对方新增按对方顺序追加 | AC2「两边标签都在、不重复」；整数组覆盖会丢标签                                                                                 |
| 引用                     | `parentTaskId` `projectId` `taskId`                                                      | 同标量三方（引用是单个值，没有「并集」语义）                                                                                                         | 场景 6：移动父子 + 改标题互不覆盖                                                                                               |
| 提醒组                   | `remindAt` `remindRepeat` `remindTime` `remindWeekdays`                                  | **按组原子三方**（组内任一字段双方都改 ⇒ 整组冲突；否则取改动方）                                                                                    | 四个字段语义耦合，逐字段合并会产出「weekly + 对方的工作日」这类非法组合；**用同一函数的 `FIELD_GROUPS` 表表达，不是第二套判等** |
| 派生计数（服务端 owned） | `checkItemCount` `commentCount` `subtaskCount`                                           | **恒取 `R`**（不进合并）                                                                                                                             | 服务端派生，本地不可写（`entityToPush` 不含 ⇒ 合并域天然排除）                                                                  |
| 排序值                   | `sortId`                                                                                 | 三方；本地为 `0`（未设置）时取 `R`                                                                                                                   | 与 `buildTaskPush` 的「0 不发送」口径一致                                                                                       |
| 身份 / 同步元数据        | `id` `userId` `createdAt` `updatedAt` `syncedServerUpdatedAt` `revision` `baseUpdatedAt` | 忽略（`SYNC_COMPARE_IGNORED_FIELDS`）                                                                                                                | 既有单一来源                                                                                                                    |

### D5 冲突记账：与 `DEF-146` 统一 helper、去重/幂等、上限影响

**统一 helper（与保存侧**同一套**判据，不是两套）**

```text
field-merge.ts
  pickChangedFields()        ← 已存在（edit-overwrite.ts），pull A1 与合并共用
  mergeBusinessFields()      ← 新增：三方判定 + 字段类型规则 + 返回冲突字段集
  planBoundaryMerge()        ← 新增：把「合并结果」翻成边界动作（pull 两支 / push stale 一支）
edit-overwrite.ts            ← 不动（保存侧只管「可见性」：pickOverwrittenFields + recordEditOverwrite）
```

- 保存侧（`DEF-146`）与合并侧**分居两期但同源**：都只用 `valuesEqual`/`pickChangedFields`；保存侧回答「我是否覆盖了别人」，合并侧回答「能不能不覆盖」。**⛔ 不让保存侧调用合并**（保存时拿不到 `R` 的字段级新值？拿得到，但把合并塞进保存会让「保存即同步」——破坏 A 批分层与离线语义）。

**记账口径（零新 kind）**

| 边界                | 合并结果                                      | 记账                                                                      | 队列                     | 落库                               |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------- | ------------------------ | ---------------------------------- |
| pull（remote 更新） | 仅我改的字段（`localOnly > 0`，无同字段冲突） | **0 条**                                                                  | **保留**                 | 合并行 + base=`R`                  |
| pull（remote 更新） | 同字段冲突                                    | `remote-wins`（既有 kind，败方=我的整行）+ `conflictFields`               | 保留（我的其它字段要推） | 合并行（冲突字段取 `R`）+ base=`R` |
| pull（本地更新）    | 仅我改的字段                                  | **0 条**                                                                  | 保留                     | 合并行 + base=`R`                  |
| pull（本地更新）    | 同字段冲突                                    | `pull-local-wins`（既有 kind，败方=`R` 的差异字段）+ `conflictFields`     | 保留                     | 合并行（冲突字段取 `L`）+ base=`R` |
| pull                | 远端墓碑                                      | `remote-wins`（**既有语义不变**）                                         | **出队**                 | 墓碑行（禁合并）                   |
| push `stale`        | 仅我改的字段                                  | **0 条**（AC4）                                                           | **保留**（下一轮 push）  | 合并行 + base=`serverUpdatedAt`    |
| push `stale`        | 同字段冲突                                    | `stale`（既有形状：`loser`=我的整行 + `serverCurrent`）+ `conflictFields` | 保留                     | 同上                               |
| 任一                | 无我方可保留字段（全冲突且 `R` 全胜）         | 按上表对应 kind                                                           | 出队（= 今日行为）       | = 今日行为                         |
| 任一                | `fieldBase` 缺失 / 回执无 `serverCurrent`     | **不合并**，逐字走今日分支                                                |                          |                                    |

**去重 / 幂等**

- `appendConflict` 已有 `(table, entityId, kind, winnerUpdatedAt)` 去重（仅 `pull-local-wins`，`conflict-journal.ts:210-228`）。合并路径需要**同一去重**（重复 pull 回拉同一版本）：给 `appendConflict` 增加**可选** `dedupeKey`（默认 `undefined` ⇒ 老调用点逐字不变），合并路径传入 `kind + winnerUpdatedAt + conflictFields 排序后拼串`；命中 ⇒ `occurrences += 1`，不追加条目。
- 幂等不变量：同一 `(B, R, L)` 重复应用 ⇒ `merged` 相同、`conflictFields` 相同、journal 条目数相同、`base` 相同。

**上限 / 截断影响**

- `CONFLICT_JOURNAL_LIMIT = 200`（环形淘汰）：合并上线后条目**只减不增**（不同字段场景从「每次一条」变为 0 条）⇒ 无压力；`conflictFields` 每条 ≤ 字段数（tasks ≤ 20），可忽略。
- `CONFLICT_SNAPSHOT_TEXT_LIMIT = 512`（文本截断 + `truncatedFields`）：**不变**；合并路径的败方快照比今天更小（同字段冲突才记）。
- `occurrences`：语义不变（仍只表达「同一裁决重复出现」）。

### D6 幂等与 `DEF-147`

- 合并**必须**幂等：pull 的 `PULL_BACKTRACK_MS=1000` 回拉窗口每轮会重放同一行（`sync-service.ts:334-341`），合并会在同一 `(B,R,L)` 上被重复调用。
- 设计保证：① 纯函数 + 无副作用；② 合并后 `fieldBase := R`（基准只前进）⇒ 第二轮 `R==B` ⇒ 取 `L` ⇒ 结果相同；③ **合并结果与本地行相等时不写库**（比较在事务内做）⇒ 不放大 `DEF-147` 的写放大。
- **`DEF-147` 不必同批修**（同意 PM 倾向）：它是「无队列时未变化行仍 put」的全局语义变更（`defect-pool.md` 明写「需 arch 定」），与合并判据无依赖。合并上线后它的影响面只会更小；若将来修它，合并路径也无需改动。

### D7 回滚开关（一键降级为整行 LWW，不引入两套实现）

- 位置：`persistence-sync/field-merge.ts` 内的 `resolveMergeMode()`（读 `localStorage['nao-todo:field-merge-mode']`，取值 `merge | lww`，**默认 `merge`**；读失败/无 localStorage ⇒ `merge`）。
- 判据单一：`mergeBusinessFields(..., mode)` —— `mode='lww'` 时**同一函数**返回 `{ merged: local, conflictFields: [], degraded: true }`（语义 = 今日「本地胜」）或由 `planBoundaryMerge` 直接产出今日动作（remote-wins 支 = `{merged: remote}`、stale 支 = `{journal: true}`）。**没有第二份算法**，只有一次参数分支。
- 禁用/断言：① `mode='lww'` 下 T671 X/Y/Z 与 A 批 `t641-*` 断言**逐字**复现（同一测试文件跑两态）；② 开关读取点唯一（`resolveMergeMode`）有单测；③ 关闭时不得写 `fieldBase` 的消费路径（捕获可继续写，消费被禁止，便于重新开启）。
- 默认开启但**上线后 2 周观测**：冲突数按 kind/字段应显著下降（PRD §八）；`local==server` 对账出现新不一致 ⇒ 立即置 `lww`（PRD 重评触发点 1）。

### D8 红基线 + 变异点

**不变量清单（可自动化）**

| 组   | 不变量                                                                                        | 断言方式                                                                              |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| AC1  | X / Y / Z 三时序：不同字段 ⇒ journal **0** 条 + 两端 `name`/`description` 字段级逐条相等      | 复用 T671 的等价数据层夹具（真实本地仓储 + 真实 journal + 假服务端只模拟 OCC/keyset） |
| AC1+ | 300ms 内先后保存不同字段 ⇒ 同上（含「两端都 push」的 stale→合并→下一轮推成功）                | 假服务端按 row 版本裁决；两次 `pushAll()`                                             |
| AC2  | 集合：手机加 `#紧急` + 桌面加 `#工作` ⇒ 两标签都在、无重复、顺序稳定                          | 单测 + 端到端                                                                         |
| AC4  | `stale` 且无同字段冲突 ⇒ **0 记账** + 队列项保留 + 下一轮 `applied`                           | 断言队列数、base、journal                                                             |
| AC5  | 八项矩阵（仅我改 / 仅对方改 / 我改回原值 / 格式化差异 / 空哨兵 / 同毫秒 / 不相交 / 部分相交） | 纯函数表驱动（`mergeBusinessFields`）                                                 |
| AC6  | 删除 + 改字段 ⇒ 删除胜、无「我的修改已覆盖云端」假账                                          | 端到端 + journal kind 断言                                                            |
| AC8  | A 批既有断言零修改（`t641-*` / `t326` / `t659` / `t669` / `t670`）                            | 全量跑，逐条不改                                                                      |
| 回滚 | `mode='lww'` ⇒ T671 X/Y/Z 与今日逐字一致                                                      | 同一测试跑两态                                                                        |

**红基线（当前代码必红）**：`AC1-X/Y/Z`、`AC1-300ms`、`AC2`、`AC4`、`AC6` 均为红（现状为整行 LWW：Y/Z 必出 1 条记录、集合被覆盖、stale 必记账、删除+改字段产出整行冲突或复活风险）。

**变异（≥5，对应 AC7）**

| #   | 变异                                                            | 必红用例                                      |
| --- | --------------------------------------------------------------- | --------------------------------------------- |
| M1  | 去掉三方判定，退化为「整行 LWW」                                | AC1 X/Y/Z、300ms                              |
| M2  | 合并只取本地（忽略 `R`）                                        | AC1（对方字段丢失）、AC5-仅对方改             |
| M3  | 集合改整数组覆盖                                                | AC2                                           |
| M4  | push `stale` 合并后**出队**（或改推送粒度但仍在 pull 之后出队） | AC1-Y（我的字段无人推）+ 下一轮 pull 覆盖断言 |
| M5  | 墓碑参与字段合并                                                | AC6（复活）                                   |
| M6  | 基准缺失时把 `L` 当 `B`（「未知当基准」）                       | AC5-仅我改（假冲突吞掉对方字段）              |

### D9 工期拆解（17 人天，落在 14–20）

| 里程碑                   | 内容                                                                                           | 人天     | 可验证判据                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| **M0** 用例先行 + 红基线 | X/Y/Z + 300ms + 集合 + 墓碑 + AC5 八项矩阵 + 回滚双态（复用 T671 夹具）                        | 2.0      | 红基线全红、可复跑脚本                                      |
| **M1** 基准捕获          | `putWithSyncBase*` 差分捕获 + `SyncQueueRecord.fieldBase` + 级联/直写点补齐 + 缺失降级         | 2.5      | 单测：首次写胜、重复写不覆盖 `B`、无 `fieldBase` 走保守路径 |
| **M2** 合并内核          | `field-merge.ts`（三方 + 类型规则 + 提醒组 + 集合 + `mode`）                                   | 3.0      | AC5 矩阵全绿；M1/M2/M3/M5/M6 变异红                         |
| **M3** pull 接入         | 拦截 remote-wins / 本地胜两支；保队列、推进 base、无差异不写、事务内 revision 校验             | 2.5      | AC1 X/Z、幂等（重复 pull 结果不变）                         |
| **M4** push 接入         | `stale` + `serverCurrent` 合并；保队列；缺省降级；删除 stale 的「删除优先 + 一次新 base 重试」 | 2.5      | AC1 Y、AC4、AC6、M4 变异红                                  |
| **M5** 记账与面板        | `conflictFields` 追加字段 + `dedupeKey` + 面板按字段标签（复用 `conflict-field-labels`）+ 文案 | 2.0      | AC9（零新 i18n 键）、DEF-146 用例零回归                     |
| **M6** 开关 + 收口       | `mode='lww'` 降级 + 端到端 + 门禁 9 项 + 文档/台账                                             | 2.5      | 双态全绿；门禁 exit 0                                       |
| **合计**                 |                                                                                                | **17.0** |                                                             |

### D10 风险清单

| #    | 风险                           | 触发                                                                                                                                    | 影响                                                                                                                                                 | 处置                                                                                                                                   |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| R-1  | **老客户端整行推**（未升级端） | 混用端                                                                                                                                  | 其整行覆盖会把新端刚合入的字段改回旧值                                                                                                               | 不可根除（今天亦然）；合并让它在**新端可见可恢复**（journal 败方字段）；发布说明提示「建议多端同步升级」                               |
| R-2  | 移动端只读兼容                 | 移动端只 pull/push 整行                                                                                                                 | ⛔ 不改移动端；其行为 = 老客户端（R-1），须验「协议签名不变、字段集不变」                                                                            | 门禁：`apps/mobile` / `presentation-react` diff = 0；合并仅在 web/desktop 生效                                                         |
| R-3  | **墓碑误复活**                 | 合并把 `deletedAt` 当普通字段 / base 恰等于墓碑版本                                                                                     | 已删任务复活（A 批 `F-04` 复发）                                                                                                                     | 墓碑**不进合并域**；pull 墓碑支保持「remote-wins + 出队」；push 删除 stale 走「新 base 重试删除」而非合并且**不记假账**；变异 M5 守门  |
| R-4  | 集合重复                       | 并集未去重 / 顺序不定                                                                                                                   | 标签重复、每次合并顺序抖动（触发无意义写）                                                                                                           | 按值去重 + 确定顺序（我的在前、对方新增追加）；幂等断言                                                                                |
| R-5  | 时钟 / 同毫秒                  | 客户端时钟偏、同 ms 双写                                                                                                                | 现状：OCC 只比服务端 base（不吃客户端时钟）⇒ push 无风险；pull 的 `remoteTs > localTs` 只决定分支，合并后**两支都会合并** ⇒ 时钟不再影响「是否合并」 | 需保留「时间只用于分支选择，不用于字段判定」的断言                                                                                     |
| R-6  | 首次全量拉取                   | 新设备首拉（无基准、无队列）                                                                                                            | 无队列 ⇒ 直接落库（今日行为），不触发合并                                                                                                            | 断言：首拉 journal = 0                                                                                                                 |
| R-7  | **用户看到意外的值**           | 合并把对方字段带进来                                                                                                                    | 用户以为自己的编辑「变了」                                                                                                                           | 合并**只增加对方字段、不改我改的字段**；冲突仍可见；建议面板加一句「已自动合并的字段不会出现在这里」（AC9 文案，零新键可复用现有段落） |
| R-8  | 提醒字段耦合                   | 两端分别改 `remindRepeat` / `remindWeekdays`                                                                                            | 产出非法组合                                                                                                                                         | 组内原子三方（D4）；变异补一条（拆散组 ⇒ 矩阵红）                                                                                      |
| R-9  | **写点漏捕**（基准缺失）       | 少数写路径未走 `putWithSyncBase*`（如 `project-archive-cascade.ts:42,65` 直接 `markDirty`；`pomodoro-record-repo-impl.ts:75` 直写父行） | 该字段无基准 ⇒ 降级为今日冲突（**不丢数据，但 AC1 在这些路径不成立**）                                                                               | M1 必须逐一接线（级联两支传 `fieldBase`），并在测试里对「直写点清单」做源级断言（新增直写点即红）                                      |
| R-10 | 老服务端回执缺 `serverCurrent` | 服务端未升级（当前生产已带，属防御）                                                                                                    | 无法在 push 侧合并                                                                                                                                   | 缺省 ⇒ **不合并**、走今日 `stale` 记账（不得假成功）                                                                                   |

## 四、文件级落点（实施清单，供开工确认卡）

**客户端（`nao-todo`）**

| #   | 文件                                                                                                  | 改动                                                                                                       | 类别       |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `packages/infrastructure/src/persistence-sync/field-merge.ts`（新）                                   | 三方合并纯函数 + 类型规则 + `FIELD_GROUPS` + `resolveMergeMode` + `planBoundaryMerge`                      | 新增       |
| 2   | `packages/infrastructure/src/persistence-local/db/local-database.ts`                                  | `SyncQueueRecord.fieldBase?: Record<string, unknown>`（可选，无 version bump）                             | 类型追加   |
| 3   | `packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts`                           | 写前差分捕获 `fieldBase` 并传入 `markDirty`；`markDirty` 内 `??=` 合并                                     | 核心       |
| 4   | `packages/infrastructure/src/persistence-sync/sync-tracker.ts`                                        | `markDirty(..., fieldBase?)`（可选参数，老调用点零变化）                                                   | 追加       |
| 5   | `packages/infrastructure/src/persistence-local/repos/project-archive-cascade.ts`                      | 两处直接 `markDirty` 补 `fieldBase`（`archivedAt` 一项）                                                   | 补齐写点   |
| 6   | `packages/infrastructure/src/persistence-sync/sync-service.ts`                                        | `applyPullBatch` 两分支拦截 + `pushAllInnerLocked` stale 分支拦截 + 保队列/无差异不写/事务内 revision 校验 | 核心       |
| 7   | `packages/infrastructure/src/persistence-sync/conflict-journal.ts`                                    | `appendConflict` 可选 `dedupeKey` + 条目 `conflictFields?: string[]`（追加字段）                           | 追加       |
| 8   | `packages/infrastructure/src/persistence-sync/edit-overwrite.ts`                                      | 仅导出复用（**不改判据**）                                                                                 | 无实质改动 |
| 9   | `apps/web/src/components/sync/*`（面板 + `conflict-field-labels`）                                    | 展示 `conflictFields`（复用既有标签表，**零新 i18n 键**）+ 一句「已自动合并的字段不在此列」                | 展示       |
| 10  | `packages/infrastructure/src/persistence-sync/__tests__/field-merge-*.test.ts`（新）+ `t671` 探针更新 | AC1/AC2/AC4/AC5/AC6/回滚双态/变异                                                                          | 用例       |

**服务端（`nao-todo-server`）**：**0 处**（`DecideUpsert`、`sync.go` 回执、DTO 全不动）。移动端（`apps/mobile` / `packages/presentation-react`）：**0 处**。

**受影响既有用例（须逐一 triage，不是全部要改）**

- **零修改（必须逐字绿）**：`t641-a1-pull-local-wins-journal`（夹具为**同字段**或基准缺失 ⇒ 行为不变，已逐例核）、`t641-a3`、`t641-a4`、`t659`、`t669/t670`（`DEF-146` 保存侧）、`conflict-journal*`、`journal-single-master`、`push/pull-single-master`。
- **按新行为更新（旧行为取证，非契约）**：`packages/infrastructure/src/persistence-sync/__tests__/t671-qa-diff-field-probe.test.ts`（Z 时序的 `pull-local-wins` 断言必须翻转为「0 条」，并在用例注释里标注翻转理由）。
- **需 triage 判据**：凡夹具「两侧差异落在**不同字段**且带基准」的 `remote-wins` / `pull-local-wins` 断言 ⇒ 行为会变；「同字段」或「无基准」者不变。**候选清单（逐例核，勿预设）**：`t326-sync-conflict-client`（多数夹具为同字段 `name`，预计零修改）、`conflict-ux-*`、`t329-sync-atomic-write-residue`、`t641-a2`（A2「保留服务端真写回」——**动作语义不变**，但其夹具靠「不同字段制造 stale」的用例需改成同字段才能继续造出记录）。

> **AC8 口径校正建议（PM 必读）**：AC8 原文「既有 kind 集合与对外语义零变化 + A 批用例零修改」在合并上线后需要分两层读 —— ①**断言不得放宽**、语义不得变（必须守住）；②「零修改」对**靠不同字段构造 `stale`/`remote-wins` 的夹具**客观不成立（合并后不再产生该记录，这是本批的设计目的）。建议改为「**只允许夹具构造方式调整（同字段化），一律不得放宽断言**」，并由 qa 逐例出具「改的是什么、断言是否等价」清单。

## 五、建议 AC 增补（PM 拍板后并入 PRD）

- **AC10（基准缺失降级）**：`fieldBase` 缺失 / 老队列项 ⇒ **必须**走今日整行裁决（不得凭猜测合并，不得静默覆盖），且有断言。
- **AC11（老回执降级）**：push 回执缺 `serverCurrent` ⇒ 不合并、走既有 `stale` 记账（不得 `ok:true` 假成功）。
- **AC12（并发写不被合并覆盖）**：合并落库必须与本地并发写互斥（同事务内 `revision` 复核）；合并期间有新本地写 ⇒ **放弃本次合并**、保留队列项、下轮重来。
- **AC13（无差异不写）**：合并结果与本地行相同 ⇒ 不写库、不广播（防与 `DEF-147` 相互放大）。
- **AC14（开关双态）**：`mode='lww'` ⇒ T671 X/Y/Z 与 A 批断言逐字复现；开关读取点唯一。
- **AC15（提醒组原子性）**：组内任一字段双方都改 ⇒ 整组冲突（不得产出非法组合）。

## 六、待 PM 拍板

1. **D2 路线**：确认 (i) 客户端合并、服务端零改动（= `A5` 继续挂账，不进本批）。
2. **D3 合并时序口径**：确认「pull 两支都拦截 + push `stale` 拦截 + **保队列、不立即重推**（下一轮 push 完成 AC4）」——即 **网络往返不增加**（NFR 指标 4）。
3. **D4 两条产品口径细化**：① `archivedAt` = 归档优先但**其它字段继续合并**（vs 整行归档胜）；② 提醒四字段**按组原子**合并（新增 `FIELD_GROUPS` 表，仍属同一判等）。
4. **D5 记账形态**：`conflictFields` 作为**追加字段**（不改 `stale`/`remote-wins` 既有形状）；`dedupeKey` 可选参数。
5. **工期与分期**：17 人天；若需压缩，先砍 M5（面板按字段呈现 → 仅加一句文案）可省 1.5 人天，**不可**砍 M0/M1/M4（AC1/AC4 主路径）。

## 七、参考来源

- `docs/prds/2026-11-09-field-level-merge.md` · 访问 2026-11-10 · 9 模块 / R-1…R-8 / AC1–AC9 与本报告逐条对应。
- `docs/reports/671-diff-field-conflict-verdict.md`（取自 `nao/671-diff-field-verdict`，`d9aba69b`）· 访问 2026-11-10 · X=0 条、Y=`stale`、Z=`pull-local-wins`，均已实测。
- 客户端 `packages/infrastructure/src/persistence-sync/sync-service.ts:112-143,1148-1216,744-777,1549-1630` · 访问 2026-11-10 · 推送载荷字段集、pull 两分支、A1 记账、stale 处置。
- 客户端 `packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts:16-56` · `persistence-local/db/local-database.ts:283-306` · 访问 2026-11-10 · 基准捕获落点与「纯追加无迁移」先例。
- 客户端 `packages/infrastructure/src/persistence-sync/{edit-overwrite.ts:31-88,sync-normalize.ts:26-88,conflict-journal.ts:27-70,200-245,429-440}` · 访问 2026-11-10 · 单一判等 / 忽略集 / 快照上限 / 去重。
- 服务端 `domain/types/upsert.go:38-56` · `interfaces/controllers/sync.go:84-100` · 访问 2026-11-10 · OCC 只比行版本；`stale` 回执携带 `serverCurrent`。
- `apps/web/src/components/sync/conflict-field-labels.ts:14-58` · 访问 2026-11-10 · 字段人话标签已就绪（AC9 零新 i18n 键）。
- `docs/adr/2026-11-06-edit-vs-remote-overwrite.md` · `docs/adr/2026-11-03-sync-conflict-journal-crypto.md` · 访问 2026-11-10 · 保存侧三值判定与快照最小化约束继续有效。
- [RFC 9110 §13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2) · 访问 2026-11-10 · 条件请求 / 先决条件语义参考（本项目以 `baseUpdatedAt` 实现（乐观并发），非 ETag）。