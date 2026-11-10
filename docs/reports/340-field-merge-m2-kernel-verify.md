# 340 · B 批 `677b`：M2（合并内核）独立复核 + 全量门禁

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)**
- HEAD **`5c314acf`**（rd-fe M2：**仅 2 个新文件** +906）· 分支 `feat/340-field-level-merge` · ⛔ 未改生产代码 / 未改任何既有用例（复核用临时探针已删除、未入库）
- 复核对象：`feat(340): B 批 M2 —— 字段级三方合并内核（纯函数 field-merge.ts）`
- 独立证据载体：临时探针 `__tests__/t677b-kernel-probe.test.ts`（**18 例，全绿**，跑完删除；复验后 `git status` 为空）

## 0. 结论先行（对照 PM 派的 5 条判据）

| #   | 判据                                                                   | 结论                                                                                   |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | 14 条红**名称集合逐条相等、一条都不转绿**                              | ✅ 完全一致（§1），**无一条转绿** ⇒ M2 未偷偷接线                                      |
| 2   | 内核绿**只在** `t677-field-merge-core.test.ts`；我的 12 文件 zero-diff | ✅ M2 只新增 2 文件；我 12 文件 `git hash-object` **逐一相等** + `git diff` 为空（§2） |
| 3   | `sync-service.ts` diff 为空                                            | ✅ 空（且**无 import 无调用**，§3）                                                    |
| 4   | 独立探针验 R-2 四律 / tags / 提醒组 / 幂等 / `lww` / 纯函数            | ✅ 18 例全绿，含双向 winner 与「`lww` 不读 base」（§4）                                |
| 5   | 门禁 9 项 + 逐项 rc + 精确数字                                         | ✅ 见 §6（②为预期 14 红）                                                              |

**PM 两处拍板口径的复核结论**：① `lwwWinner` 显式方向**支持**（`local`/`remote` 双向实测），`mode='lww'` **不读 base**、`conflicts=[]` ✅；② 提醒组「两侧都动过且组值不同 ⇒ 整组冲突」**按裁定判为非缺陷**，且**组外字段照常三方合并**、**不产出混搭组合** ✅；③ 附加项「整组快照」**结构支持**（`conflicts` 在 `fields` 含整组四字段时返回整组四字段）——**前提条件**见 §5.3。

**我新发现 2 条需 M3/M4 落地时防的集成风险**（非 M2 缺陷，§7）：`merged` 是**部分行**且**可能带显式 `undefined`** ⇒ 落库若整行 replace / 不过滤 `undefined`，会清掉本地值或丢掉身份与同步元数据。

## 1. 判据 1：14 条红逐条对照（**无转绿、无新增**）

全仓 `vp test --run`：**416 文件（7 红 / 408 绿 / 1 skip）· 3301 例（14 红 / 3281 绿 / 6 skip）**。

| #   | 文件 : 用例（`FAIL` 行名）                                      | M0 清单 | 现况  |
| --- | --------------------------------------------------------------- | ------- | ----- |
| 1   | `t675-ac1-timings` : AC1-Y 先 push                              | 红      | 红 ✅ |
| 2   | `t675-ac1-timings` : AC1-Z 先 pull                              | 红      | 红 ✅ |
| 3   | `t675-ac2-tags-union` : AC2 并集不丢                            | 红      | 红 ✅ |
| 4   | `t675-ac2-tags-union` : AC2 幂等                                | 红      | 红 ✅ |
| 5   | `t675-ac3-merge-failure` : AC3 中途失败                         | 红      | 红 ✅ |
| 6   | `t675-ac4-stale-no-overlap` : AC4 stale 零记账                  | 红      | 红 ✅ |
| 7   | `t675-ac4-stale-no-overlap` : AC4+ 300ms                        | 红      | 红 ✅ |
| 8   | `t675-ac5-matrix` : AC5-③ 改回原值                              | 红      | 红 ✅ |
| 9   | `t675-ac5-matrix` : AC5-④ 顺序差异                              | 红      | 红 ✅ |
| 10  | `t675-ac5-matrix` : AC5-⑥ 同毫秒                                | 红      | 红 ✅ |
| 11  | `t675-ac5-matrix` : AC5-⑦ 字段集不相交                          | 红      | 红 ✅ |
| 12  | `t675-ac5-matrix` : AC5-⑧ 部分相交                              | 红      | 红 ✅ |
| 13  | `t675-ac6-tombstone-archive` : AC6 归档并发                     | 红      | 红 ✅ |
| 14  | `t675-field-types-remind-group` : 提醒组（组外改 + 组内对方改） | 红      | 红 ✅ |

- 集合比对方式：`grep "^ FAIL"` 取**用例全名**逐条字符串比对（不用文件红数概括）。
- **多 0 / 少 0 / 转绿 0** ⇒ 与判据 1 一致；M0 的 `直写点-fieldBase` 保持绿（M1 达成）。

## 2. 判据 2：改动面与「我的断言未被动过」

- M2 提交改动面（`git diff --name-only 5e28feb2..HEAD`）= **恰好 2 个新文件**：`persistence-sync/field-merge.ts`、`__tests__/t677-field-merge-core.test.ts`。
- 我的 12 个文件（10 个 `t675-*` + 2 份报告）**逐个 blob 哈希与基线逐一相等**（脚本比对输出：`12 文件 hash 逐一相等 ✅`）；`git diff 5e28feb2..HEAD -- __tests__/t675-*` = **空**。
    - 基线样例：`t675-ac5-matrix.test.ts = 77ffa022…` · `t675-write-point-source-guard.test.ts = 1c491e04…` · `t675-field-merge-harness.ts = 5d938eb9…`
- ⇒ 「断言不被放宽」在本轮**机验成立**（不是人工目测）。

## 3. 判据 3：未接线（越界事实面）

- `git diff 5e28feb2..HEAD -- packages/infrastructure/src/persistence-sync/sync-service.ts` = **空**。
- 额外事实（中性）：`sync-service.ts` 中 `field-merge` / `mergeBusinessFields` 命中 = **0**（没有 import 也没有调用）⇒ 不存在「import 未调用」的模糊态。

## 4. 判据 4：内核独立复核（**不依赖 t677 自证**）

### 4.1 源码级

| 项                | 证据                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 纯函数            | `field-merge.ts` 只有 3 个 import：`isAbsentStamp`（`persistence-local/utils`，该文件 0 import、纯判断）· `valuesEqual` · `SYNC_COMPARE_IGNORED_FIELDS` ⇒ 无 Dexie / 无 crypto / 无网络 / 无日志；全文件 **0 处 `async`/`await`** |
| `mode` 单一分支点 | `mode === 'lww'` 出现 **1 次**（`:250`），`lww` 分支**先于**任何 base 使用 ⇒ 结构上不可能读 base                                                                                                                                  |
| 不造字段表        | `fields` 由调用方传入；`resolveFields` 仅在缺省时取 `local ∪ remote ∪ base` 键集                                                                                                                                                  |

### 4.2 行为级（临时探针 18 例，全绿；跑完删除）

| 组           | 覆盖                                                                                                                                                                                                       | 结果   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| R-2 四律     | `R==B⇒L` · `L==B⇒R` · `R==L⇒取一` · 两两不等⇒冲突（`lwwWinner` 双向：local⇒L / remote⇒R）                                                                                                                  | ✅ 4/4 |
| 基准缺失     | 整份缺 / 单字段缺 ⇒ `R≠L` 即冲突；`R==L` 不冲突                                                                                                                                                            | ✅     |
| `tags`       | 并集+去重+顺序（`['t3','t1','t2']`）· 同一标签双方都加只出现一次 · **单侧删/双侧删均不复活** · 同输入重复应用结果相同（幂等）· 基准缺 ⇒ 保守冲突取 winner                                                  | ✅ 5/5 |
| 提醒组       | 两侧都改且不同 ⇒ **`conflicts` = 整组四字段** + 整组取 winner（不混搭）+ **组外 `name` 照常三方合并且不入 conflicts** · 仅一侧改 ⇒ 整组取该侧 · 两侧同值 ⇒ 无冲突 · 组内基准只含我改的字段 ⇒ 保守整组冲突  | ✅ 4/4 |
| `archivedAt` | 单侧归档 ⇒ 归档胜（**双向对称**）+ 其它字段继续合并 · 两侧都非空且不同 ⇒ 按三方冲突                                                                                                                        | ✅     |
| 剔除面       | `deletedAt` / `fieldBase` / `id` / `userId` / `updatedAt` / `syncedServerUpdatedAt` / `revision` / `baseUpdatedAt` **均不进 `merged`**；服务端 owned（`checkItemCount`）恒取 `R`；`sortId` 本地 `0` 取 `R` | ✅     |
| `mode='lww'` | 整行取 winner（local / remote 双向）· `conflicts=[]` · **三组不同 base（有 base / 另一个 base / 无 base）结果逐字相同** ⇒ 不读 base · 剔除面仍生效                                                         | ✅     |
| 输出结构     | `conflicts` 顺序 = `fields` 顺序（`['priority','name']`）· 观察项见 §7.1                                                                                                                                   | ✅     |

## 5. PM 拍板口径的逐条核对

### 5.1 `lwwWinner`（PM 批准为必需项）

- 内核**支持显式方向**：`merge` 模式下冲突字段取值随 `lwwWinner`（实测 `low`/`high` 双向）；`lww` 模式下整行赢家随 `lwwWinner`（`L-name`/`R-name` 双向）。
- `lww` **不读 base**、`conflicts=[]` ✅。
- **M3/M4 的接口约定（我复核时会按此判）**：三个边界调用点必须**显式**传 winner —— pull 远端胜支 `'remote'`；pull 本地胜支与 push `stale`（默认）—— ⛔ 不得依赖默认 `local`（默认值在远端胜支是**错的**，且静默）。这条我已在 §7.2 列为 M3/M4 检查项。

### 5.2 提醒组（PM 裁定「两侧都动过且组值不同 ⇒ 整组冲突」）

- 实测**符合裁定**，且满足两条附加要求：**组外字段照常三方合并**（`name` 取 L、不入 conflicts）· **不产出混搭组合**（整组四字段取自同一侧）。
- 观察（ADR「基准缺失 ⇒ 保守」的自然后果，**非缺陷**）：由于 `fieldBase` 只覆盖「我改过的字段」，若我只改组内 `remindTime`、对方改 `remindRepeat`，组内其余字段在我这侧「无基准」⇒ `changedBy(local, …)` 也为真 ⇒ 判「双方都动过」⇒ **整组冲突**（而不是静默只取一侧）。按 PM 裁定这是**更安全**的选择；我按此判，不报缺陷。

### 5.3 「提醒组冲突时快照应含整组四字段」——**结构支持**

- 实测：`fields` 含整组四字段时，组冲突 ⇒ `conflicts` = **整组四字段**，且 `merged` 同时含整组四字段 ⇒ M5 可据此构造整组快照（无需额外结构）。
- **前提条件（必须写进 M3/M4/M5）**：调用方传给内核的 `fields` 必须是**完整合并域**（`entityToPush` 键集 − 忽略集），⛔ **不得**传「本次差异字段子集」；否则 `present` 会缩水，快照就缺字段。

## 6. 全量门禁（9 项，逐项 `rc`）

| #   | 命令                                                                | rc                               | 关键行                                                                                              |
| --- | ------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| ①   | `pnpm exec vp check`                                                | **0**                            | All **1928** files correctly formatted（含本报告） · no warnings/lint/type errors in **1545** files |
| ②   | `pnpm exec vp test --run`                                           | **1（预期 14 红 = M3/M4 未接）** | **416 文件（7 红 / 408 绿 / 1 skip）· 3301 例（14 红 / 3281 绿 / 6 skip）**                         |
| ③   | `pnpm run guard:ddd`                                                | 0                                | OK                                                                                                  |
| ④   | `pnpm exec vp run webapp build`                                     | 0                                | ✓ built in 15.03s                                                                                   |
| ④   | `pnpm run desktop:build`                                            | 0                                | ✓ built（renderer 326.60 kB）                                                                       |
| ⑤   | `git status --porcelain -- packages/presentation-react apps/mobile` | —                                | **0 行**                                                                                            |
| ⑥   | `pnpm run guard:gate-pathspec`                                      | 0                                | OK                                                                                                  |
| ⑦   | `pnpm run guard:barrel-imports`                                     | 0                                | OK                                                                                                  |
| ⑧   | `pnpm run guard:mobile-imports`                                     | 0                                | OK（72 源文件）                                                                                     |
| ⑨   | `pnpm run guard:test-location`                                      | 0                                | OK（408 受检测试文件）                                                                              |

> 内核单测：`t677-field-merge-core.test.ts` **39 例全绿**（由全仓例数 3262 → 3301 与红例不变交叉验证一致）。

## 7. 发现（供 M3/M4/M5，非 M2 缺陷）

1. **`merged` 可能带显式 `undefined`**（可复现）：`base.endAt='2026-01-01…'`（非空）· `remote` **缺** `endAt` 键 · `local.endAt` 同 base ⇒ 按 `R==B` 取 `R` = `undefined` ⇒ `merged` 含 `endAt: undefined`。
    - 风险：M3/M4 若把 `merged` 直接 spread 进记录，`undefined` 可能把本地值清空/污染实体。
    - 处置建议（不改内核也可）：**落库前过滤 `undefined` 值**（`Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined))`）；对照实验已确认「等价空（`''` vs 缺键）被 `valuesEqual` 归一」⇒ 该路径不会产出 `undefined`，故实际触发面很窄（仅服务端真缺键 + 我未改该字段）。
2. **`merged` 是「部分行」**：不含 `id`/`userId`/`updatedAt`/`syncedServerUpdatedAt`/`revision`/`baseUpdatedAt`/`fieldBase`/`deletedAt`。
    - 处置建议：M3/M4 必须 `{ ...localRecord, ...mergedFiltered }` 写回，**base 单独推进**（`syncedServerUpdatedAt = R.updatedAt`），⛔ **不得整行 replace**；`deletedAt` 必须从**本地行**保留（R-4 墓碑不进合并）。
3. **M3/M4 三处 `lwwWinner` 必须显式**（见 §5.1）：远端胜支传 `'remote'`，其余两支用 `'local'`；我 M3 的端到端用例会分别覆盖两支，缺少显式传参会被抓到。
4. **覆盖缺口（我的，需在 M3 补）**：现有 M0 用例覆盖「**本地胜支** × 同字段冲突 ⇒ 冲突字段取 L」（`AC5-⑧`）与「push stale × 冲突」（`AC4`），但**没有**「远端胜支 × 同字段冲突 ⇒ 冲突字段取 R」的端到端用例 ⇒ 若 M3 在远端胜支漏传 `'remote'`，我的套件抓不到。**建议在 M3 派单时我补 1 条**（会使当批红数 +1，需 PM 在 M3 卡里同意计数基线变化）。

## 8. 复跑

```text
git log --oneline -1                       # 期望 5c314acf
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t677-field-merge-core.test.ts   # 39 例绿
pnpm exec vp test --run                    # 期望 416 文件 / 3301 例 / 14 红（全为 t675 M3–M4 端到端）
git diff 5e28feb2..HEAD -- packages/infrastructure/src/persistence-sync/sync-service.ts   # 期望空
pnpm exec vp check && pnpm run guard:ddd && pnpm run guard:gate-pathspec && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build
```