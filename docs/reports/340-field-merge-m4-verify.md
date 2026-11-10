# 340 · B 批 `680b`：M4（push `stale` 接入 + 两条加固）独立复核 + 全量门禁

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)**
- M4 提交 **`c0a1598b`**（8 文件 +461/−79）· 基线 HEAD **`1907dfb6`** · 分支 `feat/340-field-level-merge`
- ⛔ 未改生产代码 / 未改任何既有断言（**14 路径**哈希闸通过）· 独立探针 **7 例**跑完删除、未入库 · 复验后工作区仅剩 PM 在制 ADR（非我改动）
- 独立证据载体：临时探针 `__tests__/t680b-m4-probe.test.ts`（7 例全绿，已删）

## 0. 判据结论总表

| #   | 判据                                                          | 结论                                                                                                                                                                                   |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 转绿 3 = `AC1-Y` / `AC4` / `AC4+`；仍红 2 = `AC5-⑧` / `AC5-⑨` | ✅ **完全一致**（多转绿 0、少转绿 0，无其它红）                                                                                                                                        |
| 2   | 必须保持绿：`t641-a4`（零修改）/ `t675-mode-lww` 3 例         | ✅ 均绿；`t641-a4` diff **空**                                                                                                                                                         |
| 3   | 14 路径哈希闸 + diff 为空                                     | ✅ 14/14 相等、diff 空                                                                                                                                                                 |
| 4   | 不变量：`fieldBase` = 完整合并域（17 键，pull/push 同口径）   | ✅ push/pull 双路径均 17 键、`isMergeDomainField` 单一来源、交叉路径（push→pull）幂等                                                                                                  |
| 5   | `compareConflict` 取源修正的必要性与边界                      | ✅ 修正**必要**（反事实演示：取本地行则冲突字段**无差异**）；无 `serverCurrent` 条目逐字不变；标签「云端最新」与取值**一致**；回归全绿。⚠️ 1 处注释漂移（nit）                         |
| 6   | `sync-compare.ts` 下沉（逐字 + re-export）                    | ✅ 两个函数的**代码行逐字一致**（1 行 / 12 行）、全仓仅一处定义、re-export 保持 API、importer 面未变、`def135`/`t669`/`t670` 回归绿                                                    |
| 7   | AC12 并发守卫「可达且**不记账**」                             | ❌ **部分未达**：分支**可达**、合并确实被放弃（新写未覆盖 + 保队列），但**回落今日 `stale` 分支 ⇒ 记 1 条**（非「不记账」），且该条 `loser` 取的是**新本地写**（从未推送）⇒ 见 §7 + F1 |
| 8   | 缺 `serverCurrent` / 墓碑 / 删除 ⇒ 不合并、逐字今日           | ✅ 三支均逐字今日（实验证据 §8）                                                                                                                                                       |
| 9   | 9 项门禁 + 逐项 rc + 精确数字                                 | ✅ 见 §10（②为预期 2 红）                                                                                                                                                              |

## 1. 判据 1：转绿/仍红（逐条）

全仓 `vp test --run` ⇒ **418 文件（1 红 / 416 绿 / 1 skip）· 3311 例（2 红 / 3303 绿 / 6 skip）**。

- **转绿 3**（上轮红、本轮不在 `FAIL` 名单）：`AC1-Y 先 push` · `AC4 回执 stale 零记账` · `AC4+ 300ms 双端双推` ✅
- **仍红 2**：`AC5-⑧ 部分相交`（缺 `conflictFields`）· `AC5-⑨ 远端胜支 × 同字段冲突`（缺 `conflictFields`）📌 M5
- **多转绿 0 / 少转绿 0 / 新增红 0**（全仓仅 2 条失败）。

## 2. 判据 2：必须保持绿

| 项                           | 证据                                                               | 结论           |
| ---------------------------- | ------------------------------------------------------------------ | -------------- |
| `t641-a4`（删除 stale 出队） | 全仓绿；`git diff 1907dfb6..c0a1598b -- t641-a4-…test.ts` = **空** | ✅ 零修改 + 绿 |
| `t675-mode-lww` 3 例         | 全仓绿（X/Y/Z）                                                    | ✅             |

## 3. 判据 3：14 路径哈希闸

逐文件 `git hash-object` ⇒ **14/14 与基线相等**；`git diff 1907dfb6..HEAD -- <10 个 t675-* + 4 报告>` = **空**。

```text
34bb5b28 ac1   76fd4258 ac2   efe108ed ac3   f1bb1d3e ac4   3fc815aa ac5
5a8a1d55 ac6   77ffa022 harness  c971079b remind-group  5d938eb9 mode-lww  2ff259a0 write-point
6d61a225 red-baseline   1c491e04 m1-verify   b16534c0 m2-verify   5dfb3521 m3-verify
```

> 备注：派单卡写的「`m3-verify.md` = `1075bc9a` 内容哈希」是**提交**哈希；该文件的 **blob** 哈希是 `5dfb3521`（我给的基线表即 blob 口径，一致）。

## 4. 判据 4：`fieldBase` = 完整合并域（不变量）

- **push 路径**（探针）：`stale` 合并后 `Object.keys(fieldBase)` = **17**，含 `name`/`description`/`priority`/`tags`/`archivedAt` 与四个提醒字段；退役值 = **服务端当前域值**（`base.name='A0-name'`、`base.description='A-desc'`）✅
- **pull 路径**（M3 已验 + 本轮回归绿）：同形状、同语义 ✅
- **单一来源**：`isMergeDomainField(field) = !isExcludedField(field)`（`field-merge.ts`），pull（`:838`）与 push（`:1010`）两侧都用它筛 `retiredBase` ⇒ 无第二份剔除规则 ✅
- **交叉路径幂等**（探针）：push 合并 → 再 pull 同一版本 ⇒ `journal` 0 条、`fieldBase` **不变**、`name`/`description` 都保住 ✅
- **rd-fe 的 t680 断言**：`Object.keys(fieldBase).sort()` **精确等于** `TASK_MERGE_DOMAIN`（17 键），注释标「来源：679b 判据 5（augment 第二前提）」✅（与我独立探针口径一致）

## 5. 判据 5：`compareConflict` 取源修正

### 5.1 修正确实必要（反事实演示）

场景：同字段冲突的 `stale`（本地 `priority='high'`、远端 `'low'`）⇒ M4 合并后本地行 = 我的值（冲突取 `local`）。

- **修正后**（`current` = `serverCurrent`）：`compareConflict.diffs` 含 `priority`，`current='low'`（云端最新）、`loser='high'`（我的被拒）✅
- **反事实**（按旧取源：`loser` vs **本地行**）⇒ `pickChangedFields(loser, localEntity)` **不含** `priority` ⇒ 该字段**无差异**。
  ⇒ 若不改，面板对该冲突**显示为空**（标签却是「云端最新」），正是 rd-fe 所述风险。修正属 M4 的**必要连带**（我判定**不该推到 M5**：M5 做的是「按字段呈现 + 无新 i18n 键」，而这里是「同一面板的取值正确性」）。

### 5.2 边界与回归

| 项                                            | 证据                                                                                                          | 结论                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 带 `serverCurrent` ⇒ 服务端行                 | 探针：`current='low'`（server）；且经 `resToEntity` + `toLocalProjectId` 与 pull 同一转换链                   | ✅                                        |
| **不带** `serverCurrent` ⇒ 本地行（逐字不变） | 探针：`pull-local-wins` 条目 `serverCurrent === undefined` ⇒ `current='high'`（本地）                         | ✅ 口径未变                               |
| 标签一致                                      | `sync.conflict.currentLabel`（中/英）=「云端最新 / Latest in cloud」；`loserLabel` =「我的修改 / My changes」 | ✅ 取值与标签一致（且比 M4 前**更**一致） |
| 回归                                          | `def135` / `conflict-ux-api` / `t641-a2` / `t644-a2` / `t646-a2` / `apps/web` 面板用例**全绿**（全仓仅 2 红） | ✅                                        |

### 5.3 nit（非缺陷，建议后续处理）

`apps/web/src/components/sync/conflict-title.ts:5` 与 `apps/web/src/hooks/use-conflict-ux.ts:71` 的注释仍写「与 `compareConflict` 的 `current` 同源：本地当前行明文」——M4 后 `current` 可能取服务端行，**注释已漂移**（行为无碍：标题仍读本地行以「指认对象」，与「云端最新」列语义不同）。建议 M5 顺手改注释或明确「标题取本地行、对比取当前版本」。

## 6. 判据 6：`sync-compare.ts` 下沉

| 项                 | 证据                                                                                                                                                                                                                               | 结论 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 函数体**逐字未变** | 从 `1907dfb6:conflict-journal.ts` 抽出被删块与新 `sync-compare.ts` 对比（去注释后的代码行）：`isEmptySentinel` **1 行 = 1 行**、`valuesEqual` **12 行 = 12 行**，逐行相等                                                          | ✅   |
| 唯一实现           | `grep 'export const valuesEqual\|const isEmptySentinel'`（非测试）⇒ 仅 `sync-compare.ts` 一处                                                                                                                                      | ✅   |
| 公开 API 不变      | `conflict-journal` 内 `export { valuesEqual }`（re-export）                                                                                                                                                                        | ✅   |
| importer 面        | `valuesEqual` 导入者 6 处：`conflict-journal`（re-export 源）、`edit-overwrite`、`field-base`、`field-merge`、`sync-service`、`sync-compare`；本轮**只改了 `field-base` 的 import 路径**，其余文件零改动（M4 diff 8 文件清单可证） | ✅   |
| 行为回归           | `def135-empty-sentinel-equality` / `t669-edit-overwrite` / `t670-qa-edit-overwrite-probe` 全绿                                                                                                                                     | ✅   |

## 7. 判据 7：AC12 并发守卫 —— **分支可达，但「不记账」不成立**（F1）

**探针构造**：`stale` 回执在飞时，在 `/sync/push` 请求处理中注入一次本地写（`patchLocal(name='B2-name')` ⇒ 队列 `revision` 变化）。

| 事实                       | 实测                                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 合并被放弃（新写未被覆盖） | `local.name === 'B2-name'` ✅                                                                                                                                                           |
| 保队列                     | `countQueue() === 1` ✅                                                                                                                                                                 |
| **记账**                   | **`journal` = 1 条 `stale`** ❌（派单卡期望「不记账」）                                                                                                                                 |
| 该条 `loser`               | **`loser.name === 'B2-name'`（新本地写，从未被推送）**，而 `loserUpdatedAt` = **上一轮**写入时刻 ⇒ 快照与被拒版本**不一致**                                                             |
| 后续窗口                   | `base` 已写回服务端版本 ⇒ 下一轮 push 直接 `applied`，**整行覆盖远端异字段**（实测远端 `description` 变回 `A0-desc`）—— 与今日同病，**非本批回归**，但 AC1/AC4 想消灭的窗口在此分支仍在 |

**机制**：`applyPushFieldMerge` 返回 `handled:false`（revision 不匹配）后，调用点**回落到今日 `stale` 分支**（记账 + base 写回 + 出队判定）——而不是「静默跳过」。

**建议（⛔ 未改代码，报 PM 裁决）**：revision 不匹配时**直接 `continue`**（不记账、不写回、不出队），把收敛留给下一轮 —— 下一轮 `stale` 会走完整合并（0 记账 + base 前进 + 合并落库），再下一轮 push `applied` ⇒ 两端都在。改动量 ≈ 1 个条件分支；可加断言「注入并发写 ⇒ journal 0 + 队列 1 + 本地新写保留」。

判定：**判据 7 记为「部分未达」**（守卫本身有效，回落路径与派单卡口径不符）。不阻塞本批 2 红目标（`AC1-Y`/`AC4` 无此竞态），但**建议 M4 收尾或 M5 前闭合**；若 PM 认为「回落今日行为」可接受，则属口径变更、应按 §5 更新卡与 ADR。

## 8. 判据 8：回退面（缺 `serverCurrent` / 墓碑 / 删除）

| 场景                           | 实测                                                                | 结论                                                  |
| ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `stale` **缺** `serverCurrent` | `journal` 1 条 `stale` + `syncedServerUpdatedAt` 写回 + 出队        | ✅ 今日逐字（`t641-a4` 语义未变，且该用例零修改、绿） |
| `serverCurrent` 为**墓碑**     | 不合并 ⇒ 1 条 `stale`、本地行**不写墓碑**、出队                     | ✅ 与 AC6 一致（墓碑只走整行裁决）                    |
| 删除动作（`action='delete'`）  | `staleMergeable` 要求 `action==='upsert'` ⇒ 不合并                  | ✅ 代码 + `t641-a4` 绿                                |
| `lww` 模式                     | `mergeMode==='merge'` 前置 ⇒ 整批跳过合并（`t675-mode-lww` 3 例绿） | ✅                                                    |

## 9. 附加：`t671` 翻转（M4 面）逐条判定

| 用例   | before                                                                               | after                                                                                                                                                 | 判定                                                 |
| ------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Y1** | 1 条 `stale` + `loser`/`serverCurrent`/`winnerUpdatedAt`/`loserUpdatedAt` 形状断言   | 0 条 + `name`/`description` 字段级 + `syncedServerUpdatedAt===remoteAt` + **保队列** + 第二轮 push 后**队列清空 + 两端字段都在**                      | ✅ **收紧**（与 Z1 同强度；新增 base/队列/两端三项） |
| **Y0** | 1 条 `stale` + `loser` 形状                                                          | 0 条 + 字段级两值 + 保队列 + 第二轮 push 两端都在                                                                                                     | ✅ 收紧                                              |
| **Y2** | 两侧各改不同字段；断言 `{name:'B-name', description:'A0-desc'}` / 服务端仅描述被覆盖 | **仅夹具同字段化**（两侧都改 name+description）：断言 `{name:'B-name', description:'B-desc'}`；服务端 **name + description 都被覆盖**（比原来多一项） | ✅ 断言逐条保留、强度**不降反升**                    |
| **Y3** | 同 Y2 夹具；断言 `diffs` 含 `name` + `description`                                   | **仅夹具同字段化**，断言**逐字未动**                                                                                                                  | ✅ 未放宽（见下 nit）                                |

**nit（Y3 名/前提漂移）**：M4 后 `compareConflict` 取 `serverCurrent` ⇒ **无需再等一次 pull** 即可看到双侧差异（我的探针 §5.1 即「push 后未 pull 已有 priority diff」）。Y3 的标题与注释「stale 后若先发生一次 pull ⇒ 面板对比才出现双侧字段差异」**已不成立**；因断言只校验「after 含两字段」故仍绿。建议 M5 改名为「取源 = 服务端当前行（无需等 pull）」或补一条更强的「before 即含两字段」断言。

## 10. 判据 9：全量门禁（9 项，逐项 rc）

| #   | 命令                                                                | rc                      | 关键行                                                                                                      |
| --- | ------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| ①   | `pnpm exec vp check`                                                | **0**                   | All **1932** files correctly formatted（+ 本报告后为 1933）· no warnings/lint/type errors in **1548** files |
| ②   | `pnpm exec vp test --run`                                           | **1（预期 2 红 = M5）** | **418 文件（1 红 / 416 绿 / 1 skip）· 3311 例（2 红 / 3303 绿 / 6 skip）**                                  |
| ③   | `pnpm run guard:ddd`                                                | 0                       | OK                                                                                                          |
| ④   | `pnpm exec vp run webapp build`                                     | 0                       | ✓ built in 15.32s                                                                                           |
| ④   | `pnpm run desktop:build`                                            | 0                       | ✓ built（renderer 333.01 kB）                                                                               |
| ⑤   | `git status --porcelain -- packages/presentation-react apps/mobile` | —                       | **0 行**                                                                                                    |
| ⑥   | `pnpm run guard:gate-pathspec`                                      | 0                       | OK                                                                                                          |
| ⑦   | `pnpm run guard:barrel-imports`                                     | 0                       | OK                                                                                                          |
| ⑧   | `pnpm run guard:mobile-imports`                                     | 0                       | OK（72 源文件）                                                                                             |
| ⑨   | `pnpm run guard:test-location`                                      | 0                       | OK（410 受检测试文件）                                                                                      |

## 11. 遗留（三出口）

- **转办（PM 裁决 F1，建议 M4 收尾）**：AC12 revision 不匹配时**不要**回落今日 `stale`（改 `continue`：不记账 / 不写回 / 不出队），否则留下「1 条 loser 不一致的 stale + 下一轮整行覆盖远端」窗口（实测可复现，见 §7）。
- **转办（M5）**：`AC5-⑧` / `AC5-⑨` 的 `conflictFields`（唯一剩余红点）；顺手改 §5.3 与 §9 nit 的两处注释/用例名。
- **接受（到期日 = B 批收口）**：`resolveConflictRetryLocal` 的 `previousRecord` 读取在 journal 锁内、Dexie 事务外（同源单写者假设；既有 A2 模式，非本批引入）；`conflict-title` 标题取本地行与对比取当前版本的**语义分工**需在 M5 文案里说清。
- **无关闭项**：本轮为复核，未改库存代码、无新增缺陷条目。

## 12. 复跑

```text
git log --oneline -1                       # 期望 1907dfb6（派单卡基线；M4 = c0a1598b）
pnpm exec vp test --run                    # 期望 418 文件 / 3311 例 / 2 红（AC5-⑧, AC5-⑨）
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t680-push-merge-integration.test.ts
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t675-mode-lww-verbatim.test.ts   # 3 绿
git diff 1907dfb6..HEAD -- packages/infrastructure/src/persistence-sync/__tests__/t675-   # 期望空
pnpm exec vp check && pnpm run guard:ddd && pnpm run guard:gate-pathspec && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build
```