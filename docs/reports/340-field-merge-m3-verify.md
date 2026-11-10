# 340 · B 批 `679b`：M3（pull 接入）独立复核 + 全量门禁

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)**
- M3 提交 **`6f6529f0`**（4 文件 +388/−36）· 派单卡 HEAD（diff 起点）**`18f5875b`** · 分支 `feat/340-field-level-merge`
- ⛔ 未改生产代码 / 未改任何既有断言（13 路径哈希闸通过）；独立探针 **5 例**跑完删除、未入库；复验后工作区仅剩 PM 在制 ADR（非我改动）
- 独立证据载体：临时探针 `__tests__/t679b-m3-probe.test.ts`（5 例全绿，已删）

## 0. 判据结论总表

| #   | 判据                                               | 结论                                                                                                                                                              |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 转绿集合 = 10 条且**逐条名称相等**（多转绿算越界） | ✅ 10 条全中，**多转绿 0**（§1）                                                                                                                                  |
| 2   | 仍红集合 = 5 条逐条相等                            | ✅ `AC1-Y` / `AC4` / `AC4+` / `AC5-⑧` / `AC5-⑨`（§2）                                                                                                             |
| 3   | 13 路径哈希闸 + `t675-` diff 为空                  | ✅ 13/13 相等（含 1 处**我自己**的基线更新，已提前声明）；diff 空（§3）                                                                                           |
| 4   | `t671` 翻转是「收紧」不是「放宽」                  | ✅ 逐条 before/after 见 §4；**未发现任何一条弱于原断言**；Y0/Y1 未动（M4 面）                                                                                     |
| 5   | `augmentFieldBase` 等价性 + 反例风险               | ✅ 等价性成立（有前提）；⚠️ **反例机制已复现**（可静默取远端），但**当前无可达路径**——闭合条件是「合并后 `fieldBase` 退役为**完整域**」（§5，含给 M4 的守卫要求） |
| 6   | push 面零改动                                      | ✅ 全部改动 hunk 落在 pull 段（最大行号 1347 < `pushAll` 起点 1466）（§6）                                                                                        |
| 7   | `lww` 降级逐字复现                                 | ✅ `t675-mode-lww` 3 例绿 + 独立探针补 **远端胜支**逐字（§7）                                                                                                     |
| 8   | 9 项门禁 + 逐项 rc + 精确数字                      | ✅ 见 §8（②为预期 5 红）                                                                                                                                          |

## 1. 判据 1：转绿 10 条（逐条名称）

全仓 `vp test --run` ⇒ **417 文件（3 红 / 413 绿 / 1 skip）· 3307 例（5 红 / 3296 绿 / 6 skip）**。
「转绿」定义 = 上一轮（`a3d2986c`，15 红）里红、本轮不在 `FAIL` 名单里。

| #   | 用例（名称逐条）                                                | 现况  |
| --- | --------------------------------------------------------------- | ----- |
| 1   | `t675-ac1-timings` : AC1-Z 先 pull                              | 绿 ✅ |
| 2   | `t675-ac2-tags-union` : AC2 并集不丢                            | 绿 ✅ |
| 3   | `t675-ac2-tags-union` : AC2 幂等                                | 绿 ✅ |
| 4   | `t675-ac5-matrix` : AC5-③ 改回原值                              | 绿 ✅ |
| 5   | `t675-ac5-matrix` : AC5-④ 顺序差异                              | 绿 ✅ |
| 6   | `t675-ac5-matrix` : AC5-⑥ 同毫秒                                | 绿 ✅ |
| 7   | `t675-ac5-matrix` : AC5-⑦ 字段集不相交                          | 绿 ✅ |
| 8   | `t675-ac6-tombstone-archive` : AC6 归档并发                     | 绿 ✅ |
| 9   | `t675-field-types-remind-group` : 提醒组（组外改 + 组内对方改） | 绿 ✅ |
| 10  | `t675-ac3-merge-failure` : AC3 中途失败                         | 绿 ✅ |

**多转绿 0**：15 红 − 5 仍红 = 10，且这 10 条与派单卡清单**逐一对应**（无第 11 条、无「只转绿一部分断言」的情况——失败清单是全或无的用例级判断）。

## 2. 判据 2：仍红 5 条与红因（均在 M4/M5 面内）

| #   | 用例                               | 红因（实测断言）                                                                  | 归属                     |
| --- | ---------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| 1   | `AC1-Y 先 push`                    | `expected [ { kind: 'stale' } ] to have a length of +0 but got 1`                 | **push `stale` 支 = M4** |
| 2   | `AC4 回执 stale ⇒ 0 条 + 保队列 …` | 同上（`stale` × 1）                                                               | M4                       |
| 3   | `AC4+ 两端 300ms 双端双推`         | 同上（`stale` × 1）                                                               | M4                       |
| 4   | `AC5-⑧ 部分相交`                   | `expected undefined to deeply equal ['priority']`（缺 `conflictFields`）          | **M5（记账 additive）**  |
| 5   | `AC5-⑨ 远端胜支 × 同字段冲突`      | `远端胜支的记账缺 conflictFields（字段级信号）: expected undefined to be defined` | M5                       |

> 说明：`AC5-⑧` 的其余断言（loser 只含冲突字段、合并字段照常落库）**已绿**；`AC5-⑨` 的前两条（kind=`remote-wins`、落库 = 远端值 `'low'`）**已绿** ⇒ 两支 winner 方向已正确，仅差字段级信号。

## 3. 判据 3：13 路径哈希闸

逐文件 `git hash-object` 与基线比对 ⇒ **13/13 相等**（`t675-ac1…27` 共 10 个测试文件 + 3 份报告；`git diff 18f5875b..HEAD -- __tests__/t675-` = 空）。

| 文件                                                                | 哈希（前 8）                                                   | 说明                                                                                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `t675-ac1-timings` / `ac2` / `ac3` / `ac4`                          | `34bb5b28` / `76fd4258` / `efe108ed` / `f1bb1d3e`              | 未变                                                                                                                                                         |
| `t675-ac5-matrix`                                                   | `3fc815aa`                                                     | T678 后新基线（未再变）                                                                                                                                      |
| `t675-ac6` / `harness` / `field-types` / `mode-lww` / `write-point` | `5a8a1d55` / `77ffa022` / `c971079b` / `5d938eb9` / `2ff259a0` | 未变                                                                                                                                                         |
| `340-field-merge-red-baseline.md` / `m1-verify.md`                  | `6d61a225` / `1c491e04`                                        | 未变                                                                                                                                                         |
| `340-field-merge-m2-kernel-verify.md`                               | `b16534c0`                                                     | **我自己**在 `a3d2986c` 内的编辑（§9 追加 + 哈希标签更正）；我给 679b 的表里预告过「若我再改会更新」——非 M3 改动（`git diff 18f5875b..HEAD -- 该文件` = 空） |

## 4. 判据 4：`t671` 翻转是「收紧」而非「放宽」（逐条 before/after）

改动面：仅 `Z0` / `Z1` 两个 `it`（`Y0`/`Y1` 零 diff，`grep '^[-+].*(Y0|Y1)'` 无命中 ⇒ M4 面保持原样）。

### Z0

| 项       | before（原断言）                    | after（M3 翻转）                                                   | 判定                             |
| -------- | ----------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| 记录     | `journal` 恰 1 条 `pull-local-wins` | `journal` **0 条**                                                 | 行为契约变更（本批目的），非放宽 |
| 记录形状 | `loserUpdatedAt` 有值               | 删除（记录已不存在）                                               | 断言对象消失 ⇒ 由下两行替代      |
| 业务字段 | **未断言**                          | `local.name='B-name'` + `local.description='A-desc'`（字段级两值） | **新增更强断言**                 |
| 队列     | 未断言                              | 队列项存在（保队列）                                               | **新增断言**                     |

### Z1

| 项            | before                                                              | after                                                | 判定                                                |
| ------------- | ------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| 记录          | 1 条 `pull-local-wins` + `loser` = 远端整行（`name`/`description`） | `journal` **0 条**                                   | 契约变更                                            |
| A1 标志       | `loserUpdatedAt === remoteAt`                                       | `syncedServerUpdatedAt === remoteAt`（base 前进）    | **等价强度**（同值、同语义：base 已收敛到远端版本） |
| 业务字段      | 未断言                                                              | `name='B-name'` + `description='A-desc'`             | **新增更强断言**                                    |
| 队列          | 未断言                                                              | 队列项存在                                           | **新增**                                            |
| push 后服务端 | `name=B-name` + `description=**A0-desc**`（云端描述被覆盖）         | `name=B-name` + `description=**A-desc**`（两端都在） | **收紧**（原断言记录的是丢数据行为）                |

**结论**：Z0/Z1 的净变化 = 「记录存在性」断言 → 「字段值 + base + 队列 + 两端」断言；**未发现任何一条弱于原断言**（且 `it` 名加 `【M3 翻转】` 防后人修回）。符合 T675 报告 §4.1 的「断言一律不放宽、仅夹具/契约随行为收紧」口径。

## 5. 判据 5：`augmentFieldBase` 等价性与反例风险（本步核心判断）

### 5.1 实现与前提

```text
base[f] = f ∈ fieldBase ? fieldBase[f] : local[f]        // sync-service.augmentFieldBase
mergeable = mode==='merge' && table==='tasks' && action==='upsert' && fieldBase !== undefined
```

- **等价性命题**：`f ∉ fieldBase ⇒ 我未改 f ⇒ local[f] === 我上次同步到的值（= 真基准 B_f）`。
- 该命题由两件事支撑（均已独立核）：
    1. **捕获键集 = 我改过的字段**（M1 `captureFieldBase`，`675b` 已验：改 1 只含 1 键、未改不落键）；
    2. **同步侧写本地只在「同一事务内把 `fieldBase` 退役为完整域」时发生**（M3：`retiredBase[每个域字段] = remoteEntity[字段]`，与本方法同事务写队列）⇒ 不会出现「local 被同步写过、而 base 仍是 partial」的中间态。

### 5.2 反例机制（**已复现**，探针 5 例之一）

- 构造：`patchLocal({name})` ⇒ `fieldBase = {name}`（partial）；随后**一次不经 capture 的业务写**（直接改行 `priority='high'` + 直接 `syncTracker.markDirty`，等价于 `conflict-entity-registry.putRecordAndEnqueue` 的现状——它**不传** `fieldBase`）；远端 `priority='low'` 且时间更晚。
- 实测：`priority` 落库 = **`'low'`（远端）**，`journal` = **0 条** ⇒ **我的改动被静默取远端、且无任何记录**。
- 对照（同数据、同冲突，但 `priority` 经捕获写点）：`journal` = 1 条 `remote-wins` ⇒ **有账**。
  ⇒ 「静默 vs 有账」的差别**只**取决于该字段是否进入了 `fieldBase`。

### 5.3 可达性结论：**当前（M3）无可达路径**，但机制真实存在

`tasks` 业务字段写点与捕获覆盖（源级清点）：

| 写点                                                                      | 改的业务字段                     | 捕获 `fieldBase`                                                                  | 备注                                              |
| ------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `create` / `copy`                                                         | 全部（新行）                     | 无                                                                                | 无旧行 ⇒ 正确（`mergeable=false` 或新 id 无基准） |
| `update`（含编辑器保存）                                                  | 任意                             | ✅ 实体层                                                                         | M1                                                |
| `snooze`                                                                  | `remindAt` / `remindTime`        | ✅ 实体层                                                                         | M1                                                |
| `remove` / `restore` / `cascadeRemove`                                    | 仅 `deletedAt`                   | 无                                                                                | `deletedAt` **不进合并域**（R-4）⇒ 无风险         |
| `unarchive`（单任务）                                                     | `archivedAt` / `projectId`       | ✅ 记录层                                                                         | M1                                                |
| `archiveByProjectId` / `unarchiveByProjectId`（级联）                     | `archivedAt`（projects + tasks） | ✅ 记录层                                                                         | M1                                                |
| **`resolveConflictRetryLocal`**（`stale`/`remote-wins`/`push-noop` 条目） | **败方快照（业务字段）**         | ❌ **经 `putRecordAndEnqueue` → `putWithSyncBaseAndEnqueue`（不传 `fieldBase`）** | **唯一的漏捕业务写点**                            |

**为何 M3 下不可达**（三条互斥覆盖）：

1. 要能「重试」必须先有 journal 条目；`pull-local-wins` 条目的重试**只清条目、不写行**（`conflict-journal.ts:669-672`）⇒ 无写；
2. `stale` / `push-noop` / `conflict` / `skipped` 条目的**产生路径一律出队**（push 面尚无合并；M4 才接）⇒ 重试时队列为空 ⇒ 新队列项**无 `fieldBase`** ⇒ `mergeable=false` ⇒ 走今日保守分支；
3. `remote-wins` 条目：若来自**墓碑支**或 `mergeable=false` 的旧支 ⇒ 出队；若来自 **M3 合并路径** ⇒ 队列可能保留，但该路径**同事务已把 `fieldBase` 退役为完整域**（探针实测：`Object.keys(fieldBase) ≥ 15`，含 `name`/`description`/`priority`/`tags`/`archivedAt`…）⇒ 重试写的每个字段都**有基准** ⇒ 落回三方判定（冲突会记账），不会静默。
   ⇒ **未能构造出「partial base + 漏捕业务写」的可达序列**（探针的复现是**直接构造**该状态，不是产品路径）。

### 5.4 给 M4/M6 的守卫要求（⛔ 未改代码，供 PM 裁决）

1. **M4 必须沿用「合并后 `fieldBase` 退役为完整域」**（push `stale` 合并路径同规则）。否则 `stale` 合并保留队列 + partial base + 重试的漏捕写，**就会**拼出 5.2 的静默路径。
2. **建议把上述不变量写成断言**（M6 或 M4 顺手）：`merge` 路径落库后，队列项 `fieldBase` 的键集 = 完整合并域（键数 ≥ 15 且含四个提醒字段）。
3. **建议源级护栏扩展**（可选，P3）：把「`putRecordAndEnqueue` / `putWithSyncBaseAndEnqueue` 的 **tasks 业务写**调用点」纳入「必须传 `fieldBase` 或显式声明仅墓碑字段」的检查；或最简单——在 `resolveConflictRetryLocal` 对 tasks 用**写前旧实体**算 `fieldBase`（一处即可闭合该面）。**当前不阻塞本批**（不可达），但它是 5.2 机制的唯一入口。

## 6. 判据 6：push 面零改动（hunk 证据）

`git diff a3d2986c..6f6529f0 -U0 -- sync-service.ts` 的 hunk 头与新文件行号：

```text
@@ -53 +53 @@        import 段
@@ -54,0 +55 @@      import 段（新增 field-merge/resolveMergeMode/valuesEqual）
@@ -775,0 +777,148 @@ 新增 pull 侧 4 个私有方法（applyPullFieldMerge / augmentFieldBase / fieldBaseEquals）
@@ -1135,0 +1285,3 @@  applyPullBatch：批级 resolveMergeMode()
@@ -1146 +1298,30 @@  applyPullBatch：合并分支
@@ -1166,5 +1347 @@  applyPullBatch：墓碑判定变量化（remoteDeleted）
```

`pushAll` 起点 = 新文件 **1466** 行 ⇒ **所有 hunk（最大 1347）均在 push 段之前**；`pushAll` / `pushAllInner` / `pushAllInnerLocked` / `stale` 分支（含 `effectiveOutcome==='noop'||'stale'` 记账块）**零 diff** ✅。

## 7. 判据 7：`lww` 降级逐字复现

- `t675-mode-lww` 3 例（X / Y / Z）**全绿**（不在 `FAIL` 名单）。
- 独立探针补了 `t675` 未覆盖的一支：**`lww` + 远端胜支** ⇒ 实测 `remote-wins` × 1 + 整行覆盖（我的名称丢失）+ 出队 ⇒ **与今日逐字相同**；**`lww` + 本地胜支** ⇒ `pull-local-wins` × 1 + 不动业务字段 + 保队列 + base 前进 ⇒ 与今日逐字相同。
- 源级：`resolveMergeMode()` 是**唯一**读取点（`field-merge.ts`），`applyPullBatch` **批级**读一次；`lww` ⇒ `mergeable=false` ⇒ 整批走今日两支（不是第二套算法）。

## 8. 判据 8：全量门禁（9 项，逐项 rc）

| #   | 命令                                                                | rc                             | 关键行                                                                                                      |
| --- | ------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| ①   | `pnpm exec vp check`                                                | **0**                          | All **1929** files correctly formatted（+ 本报告后为 1930）· no warnings/lint/type errors in **1546** files |
| ②   | `pnpm exec vp test --run`                                           | **1（预期：5 红 = M4/M5 面）** | **417 文件（3 红 / 413 绿 / 1 skip）· 3307 例（5 红 / 3296 绿 / 6 skip）**                                  |
| ③   | `pnpm run guard:ddd`                                                | 0                              | OK                                                                                                          |
| ④   | `pnpm exec vp run webapp build`                                     | 0                              | ✓ built in 17.87s                                                                                           |
| ④   | `pnpm run desktop:build`                                            | 0                              | ✓ built（renderer 331.11 kB）                                                                               |
| ⑤   | `git status --porcelain -- packages/presentation-react apps/mobile` | —                              | **0 行**                                                                                                    |
| ⑥   | `pnpm run guard:gate-pathspec`                                      | 0                              | OK                                                                                                          |
| ⑦   | `pnpm run guard:barrel-imports`                                     | 0                              | OK                                                                                                          |
| ⑧   | `pnpm run guard:mobile-imports`                                     | 0                              | OK（72 源文件）                                                                                             |
| ⑨   | `pnpm run guard:test-location`                                      | 0                              | OK（409 受检测试文件）                                                                                      |

## 9. 实现细节核（三条集成守卫与边界）

| 项                      | 证据                                                                                                                                | 结论                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `fields` = 完整合并域   | `Object.keys(config.entityToPush(remoteEntity))`                                                                                    | ✅ 非「差异字段子集」               |
| `projectId` 形状归一    | 合并前 `toLocalProjectId(...)`（避免 `'inbox'` vs `userId` 假差异）                                                                 | ✅ 额外正确性                       |
| `undefined` 过滤        | `Object.entries(merged).filter(([,v]) => v !== undefined)`                                                                          | ✅                                  |
| 部分行写回              | `nextEntity = {...local, ...mergedFields}` → `entityToRecord`（重新加密 `plain:`）；`nextRecord.syncedServerUpdatedAt` **单独**推进 | ✅ 无整行 replace                   |
| `deletedAt` 保留（R-4） | `local` 为完整实体 ⇒ 墓碑字段来自本地；且 `remoteDeleted` 时**不进合并路径**                                                        | ✅ 墓碑两护栏仍绿                   |
| 记账顺序（AC3）         | 行 + 队列 base **同事务**落库 ⇒ **落库成功后才** `appendConflict`                                                                   | ✅ 半成品消失（AC3 转绿）           |
| kind 零扩张             | 远端胜 = `remote-wins`；本地胜 = `pull-local-wins`；本步**不加** `conflictFields`                                                   | ✅ 与 AC8 一致                      |
| loser 最小化            | 本地胜 ⇒ `{id} + 冲突字段（取远端值）`；远端胜 ⇒ 本地整行（= 今日形状）                                                             | ✅ AC5-⑧ 的「合并字段不入快照」已绿 |
| 出队判据                | 远端胜且 `keptLocalFields===false` ⇒ 出队（= 今日）；仍有我方字段 ⇒ 保队列                                                          | ✅ D-b2                             |
| 幂等                    | 重复 pull：`fieldBase` 已退役为远端域值 ⇒ 判据稳定（AC2 幂等转绿；`queueBaseChanged` 为假则不写队列）                               | ✅                                  |
| 基准只前进（R-6）       | `retiredBase` = 远端当前域值；`baseChanged` 仅在本行 base ≠ 远端版本时推进                                                          | ✅ 无回退                           |

## 10. 遗留（三出口）

- **转办（M4）**：① push `stale` 支必须**沿用**「合并后 `fieldBase` 退役为完整域」（§5.4-1，否则 5.2 静默机制可被拼出）；② `AC1-Y` / `AC4` / `AC4+` 三例在 M4 应转绿；③ 删除 stale 必须按 ADR R-10 缺 `serverCurrent` ⇒ 降级今日（`t641-a4` 零修改）。
- **转办（M5）**：`AC5-⑧` / `AC5-⑨` 的 `conflictFields` 是唯一剩余红点。
- **接受（到期日 = B 批收口）**：§5.2 的机制 + §5.4-3 的护栏扩展建议（P3，当前不可达）；`resolveConflictRetryLocal` 不捕获 `fieldBase` 属既有 A2 形状。
- **无关闭项**：本轮为复核，未改库存代码、无新增缺陷条目。

## 11. 复跑

```text
git log --oneline -1                       # 期望 18f5875b（派单卡 HEAD）
pnpm exec vp test --run                    # 期望 417 文件 / 3307 例 / 5 红（AC1-Y, AC4, AC4+, AC5-⑧, AC5-⑨）
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t675-mode-lww-verbatim.test.ts  # 3 例绿
git diff 18f5875b..HEAD -- packages/infrastructure/src/persistence-sync/__tests__/t675-   # 期望空
pnpm exec vp check && pnpm run guard:ddd && pnpm run guard:gate-pathspec && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build
```