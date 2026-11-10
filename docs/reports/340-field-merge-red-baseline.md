# 340 · B 批 M0：字段级合并**红基线 + 等价性清单**（T675）

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)**
- 分支：`feat/340-field-level-merge`（HEAD **`4e399d42`**，未 rebase / 未 force）· Issue **#340**
- 交付面：**只加测试 + 本报告**（⛔ 未改生产代码、未改既有测试、未改 `docs/prds|adr|T672|tasks-state|defect-pool`）
- 输入：`docs/prds/2026-11-09-field-level-merge.md`（AC1–AC9）· `docs/adr/2026-11-10-field-level-merge.md`（D-b1…D-b7）· `docs/reports/T672-field-merge-arch-review.md`（落点 / 变异 / triage）· `docs/reports/671-diff-field-conflict-verdict.md`（X/Y/Z 实测）
- 复现口径：真实本地仓储（`newLocalTaskRepository`）+ 真实 `syncQueue` + 真实 `conflict-journal`；假服务端**只**模拟服务端契约（行级 OCC = `baseUpdatedAt == updated_at`、`stale` 回执带 `serverCurrent`、pull keyset 游标），不参与任何产品判定

## 0. 结论先行

1. **红基线已就位且逐条强红**：9 个新测试文件 / **27 例** ⇒ **15 红 / 12 绿（护栏）**；红因全部是「现状裁决粒度 = 整行」的可观测行为差异（`journal` 0 条 vs 1 条、字段丢失、`conflictFields` 缺失、`fieldBase` 缺失），**没有一例是靠「模块不存在 / 收集失败」变红的**（新测试不 import 任何未实现模块）。
2. **既有用例 0 红**：全仓 `vp test --run` ⇒ **414 文件 / 3252 例 / 15 红**，15 红**全部**落在本次新增的 8 个文件里；既有 405 文件逐字绿。
3. **等价性清单比预期短**：**唯一必然失效的既有文件是 `t671-qa-diff-field-probe.test.ts`**（Y1/Y0/Z0/Z1 必须翻转；Y2/Y3 需**同字段化**）。arch 列的其余候选（`t641-a2` / `conflict-ux-*` / `t329-*` / `t326` / `t641-a1/a3/a4` / `t644-f09` / `conflict-journal` / `sync`）均**无需修改**，逐条理由见 §4（核心机制：**`fieldBase` 缺失 ⇒ 保守不合并**，而这些夹具靠直接 `markDirty` / 直接改队列 / 新建未同步行构造成立）。
4. **4 项口径冲突待 PM 拍板**（§5），其中 ①（`'none'` 哨兵）会直接影响 AC5 的一项断言口径，②（直写点实为 5 处 / 4 文件）会影响 M1 范围。

## 1. 红/绿统计

### 1.1 新增测试（`packages/infrastructure/src/persistence-sync/__tests__/`）

| 文件                                    | 例     | 红     | 绿     | 覆盖                                                   |
| --------------------------------------- | ------ | ------ | ------ | ------------------------------------------------------ |
| `t675-ac1-timings.test.ts`              | 3      | 2      | 1      | AC1 X（护栏）/ Y / Z                                   |
| `t675-ac2-tags-union.test.ts`           | 2      | 2      | 0      | AC2 并集 + 幂等                                        |
| `t675-ac3-merge-failure.test.ts`        | 1      | 1      | 0      | AC3 中途失败                                           |
| `t675-ac4-stale-no-overlap.test.ts`     | 2      | 2      | 0      | AC4 `stale` 零记账 / 300ms 双端双推                    |
| `t675-ac5-matrix.test.ts`               | 8      | 5      | 3      | AC5 八项矩阵                                           |
| `t675-ac6-tombstone-archive.test.ts`    | 3      | 1      | 2      | AC6 墓碑（护栏×2）+ 归档                               |
| `t675-field-types-remind-group.test.ts` | 2      | 1      | 1      | 提醒四字段按组原子                                     |
| `t675-mode-lww-verbatim.test.ts`        | 3      | 0      | 3      | 回滚开关双态（`mode='lww'` 逐字复现 X/Y/Z）            |
| `t675-write-point-source-guard.test.ts` | 3      | 1      | 2      | M1 直写点源级断言（扫描面 / 允许清单 / `fieldBase`）   |
| **合计**                                | **27** | **15** | **12** | `t675-field-merge-harness.ts` 为共享夹具（非测试文件） |

**12 条护栏绿（现状已正确，必须随实现保持绿）**：`AC1-X` · `AC5-①仅我改` · `AC5-②仅对方改` · `AC5-⑤空哨兵` · `AC6-删除×2` · `提醒组-组内双方都改` · `lww-X/Y/Z` · `直写点-扫描面` · `直写点-允许清单`。

### 1.2 全范围门禁（HEAD 之上含本批测试）

| 项                   | 命令                                                                | 结果                                                                                                                |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ① 格式 + lint + 类型 | `pnpm exec vp check`                                                | **rc=0** · 1922 文件格式全通过（含本报告） · 1541 文件 `no warnings, lint errors, or type errors`                   |
| ② 全仓测试           | `pnpm exec vp test --run`                                           | **rc=1（红基线预期）** · **414 文件（8 红 / 405 绿 / 1 skip）** · **3252 例（15 红 / 3231 绿 / 6 skip）** · 219.54s |
| ③ 领域隔离           | `pnpm run guard:ddd`                                                | rc=0                                                                                                                |
| ④ Web 构建           | `pnpm exec vp run webapp build`                                     | rc=0（built 12.86s）                                                                                                |
| ④ Desktop 构建       | `pnpm run desktop:build`                                            | rc=0（built 15.47s）                                                                                                |
| ⑤ 移动端红线         | `git status --porcelain -- packages/presentation-react apps/mobile` | **0 行**                                                                                                            |
| ⑥ 门禁 pathspec      | `pnpm run guard:gate-pathspec`                                      | rc=0                                                                                                                |
| ⑦ 导入面可解析       | `pnpm run guard:barrel-imports`                                     | rc=0                                                                                                                |
| ⑧ 移动端导入红线     | `pnpm run guard:mobile-imports`                                     | rc=0（72 源文件 0 违规）                                                                                            |
| ⑨ 测试文件位置       | `pnpm run guard:test-location`                                      | rc=0（406 受检测试文件均在 `__tests__/`）                                                                           |

> 口径说明：本仓**不存在** `tests/README.md`「计数可见」文件（同 `T636` 结论）⇒ 文件数 / 例数一律取**实跑输出**，不以最大编号推断。
> ② 的 rc=1 是**红基线的定义**：M2–M4 落地后本项必须转 rc=0（届时若仍有红即为实现缺陷，不是「已知红」）。

## 2. 逐条红因（现状代码落点）

| #   | 用例                         | 现状实测                                                                               | 红因（代码落点）                                                                                                               |
| --- | ---------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `AC1-Y` 先 push              | `journal` = **1 条 `stale`**；本地描述仍 `A0-desc`；队列已清（0）                      | `sync-service.ts:1591`（`stale` 一律 `appendConflict`）+ `:1613`（只写回 base）+ `:1619`（出队）⇒ 整行二选一，我的字段无人再推 |
| R2  | `AC1-Z` 先 pull              | `journal` = **1 条 `pull-local-wins`**；云端描述随后被 push 覆盖                       | `applyPullBatch` 本地胜支 `:1195` → `recordPullLocalWins` `:744-777`（整行 diff 记账，不动业务字段）⇒ 描述稍后被整行覆盖       |
| R3  | `AC2` 标签并集（×2 例）      | `journal` = 1 条；`tags` 只剩我这一侧；幂等例断言 `['#工作']` ≠ `['#工作','#紧急']`    | `buildTaskPush` `:112-143` 整数组推送 + 行级 LWW ⇒ 一边新增的标签必丢                                                          |
| R4  | `AC4` / `AC4+`（×2 例）      | 首轮 push ⇒ `journal` 1 条 `stale`、队列 0、base 已写回 ⇒ 第二轮无推送                 | 同 R1                                                                                                                          |
| R5  | `AC5-③` 我改回原值           | `journal` 1 条                                                                         | 仅按「整行有差异」记账（`recordPullLocalWins` 的 `pickChangedFields` 判据不含三方语义）                                        |
| R6  | `AC5-④` 顺序差异             | `journal` 1 条                                                                         | `valuesEqual` 对数组走 `JSON.stringify`（顺序敏感）⇒ 纯顺序差异被当成业务差异                                                  |
| R7  | `AC5-⑥` 同毫秒               | `journal` 1 条                                                                         | `remoteTs > localTs` 为假 ⇒ 落本地胜支并记账（合并判据不依赖时间戳，现状却由时间戳决定分支）                                   |
| R8  | `AC5-⑦` 字段集不相交         | `journal` 1 条；对方 `description`/`endAt` 整行丢失                                    | 同 R2                                                                                                                          |
| R9  | `AC5-⑧` 部分相交             | `conflictFields` = **undefined**；`loser` 含被合并的 `description`；`description` 丢失 | `appendConflict` 无语义字段级信号（`conflict-journal.ts:200-245`）；A1 快照 = 整行 diff                                        |
| R10 | `AC6` 归档并发               | `archivedAt` = **null（归档丢失）** + `journal` 1 条                                   | 本地胜支只 `writeBackSyncBase`（`:1203-1205`）⇒ 归档状态未落库                                                                 |
| R11 | `提醒组` 组外改 + 组内对方改 | `journal` 1 条；整组提醒丢失                                                           | 同 R2（无组原子合并）                                                                                                          |
| R12 | `AC3` 落库抛错               | `journal` = **1 条 `remote-wins`**（针对一次**从未落库**的覆盖）                       | 远端胜支**先记账后落库**（`:1150-1164` 记账 → `:1165` 落库）⇒ 失败时留下「已裁决未落库」的半成品                               |
| R13 | `直写点-` `fieldBase`        | 5 处直写点全无字段级基准（实测清单见 §5-②）                                            | `put-with-sync-base.ts:22-27` 只回填行级 `syncedServerUpdatedAt`；`markDirty` 无基准参数（`sync-tracker.ts:33-40`）            |

**红因质量说明**：13 条红因全部是**行为断言**（`journal` 条数 / 字段值 / `conflictFields` / 源码级 `fieldBase`），无一条依赖「模块缺失导致收集失败」。`AC5-⑧` 与 `AC3` 的首个失败断言分别是 `conflictFields` 与 `journal` 条数，均可直接读出「现状产出了什么」。

## 3. AC 映射矩阵

| AC                                      | 用例            | 结果                | 备注                                                                                                                                                    |
| --------------------------------------- | --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC1** 三时序不同字段                  | `AC1-X`/`Y`/`Z` | 1 绿（X）+ **2 红** | 字段级逐条断言（`name` / `description`），不用整行相等代替                                                                                              |
| AC1+ 300ms 并发                         | `AC4+`          | **红**              | 含「stale → 合并 → 下一轮 push applied」                                                                                                                |
| **AC2** 集合并集 + 幂等                 | `AC2`×2         | **2 红**            | 并集 + 去重 + 顺序确定 + 重复 pull 不变                                                                                                                 |
| **AC3** 中途失败                        | `AC3`           | **红**              | 半成品记录 = 红因；其余四项（无部分写入 / 保队列 / `ok:false` / 日志无业务值）现状已正确                                                                |
| **AC4** `stale` 无重叠零记账            | `AC4`           | **红**              | 0 记账 + 保队列 + base 前进 + 下轮 `applied`                                                                                                            |
| **AC5** 八项矩阵                        | `AC5-①…⑧`       | 3 绿 + **5 红**     | ① 仅我改 / ② 仅对方改 / ⑤ 空哨兵 = 护栏（现状零误报，须防合并后退化为 `===`）                                                                           |
| **AC6** 墓碑 / 归档                     | `AC6`×3         | 2 绿 + **1 红**     | 删除两时序现状已正确（kind 不为 `pull-local-wins`、墓碑保留、不复活）；归档必红                                                                         |
| — 字段类型规则（提醒组原子，PM 提醒项） | `提醒组`×2      | 1 绿 + **1 红**     | 组内双方都改 ⇒ 1 条且整组取一方（无混搭）；组外改 + 组内对方改 ⇒ 应 0 条并整组取对方                                                                    |
| **AC7** 变异可红（M2–M6 执行）          | —               | —                   | 本批用例即变异靶：M1（退化 LWW）⇒ AC1 全红；M2（只取本地）⇒ AC1-Y/Z 的对方字段断言；M3（集合覆盖）⇒ AC2；M5（墓碑参与合并）⇒ AC6；M4（stale 出队）⇒ AC4 |
| **AC8** 零回归 / 等价性                 | §4              | —                   | 唯一必然失效 = `t671`；其余候选逐条列「不得改动且需逐字绿」                                                                                             |
| **AC14** 开关双态                       | `lww-X/Y/Z`     | 3 绿                | `localStorage['nao-todo:field-merge-mode']='lww'` 下逐字复现今日 X/Y/Z（实现前绿、实现后必须仍绿）                                                      |
| **AC9** 面板 / 文案                     | 未新增用例      | —                   | 零新 i18n 键 + 复用 `conflict-field-labels` 属 M5；`AC5-⑧` 已断言 `conflictFields` 数据面信号                                                           |

## 4. 等价性清单（合并实现后**必然失效**的既有用例）

### 4.1 必然失效：`t671-qa-diff-field-probe.test.ts`（9 例 → 需改 5 例）

失效原因（统一）：该文件的夹具用**真实仓储写路径**（`newLocalTaskRepository().update`）改 `name`，让另一端改 `description` ⇒ M1 之后 `fieldBase` **有值**且两侧字段**不重叠** ⇒ 合并生效，Y/Z 不再产生记录（这正是本批目的，不是回归）。

| 用例            | 现断言                                                                              | 改法                                                                                                                                                            | 改后语义等价证据                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X1`            | 0 条 + 两端 `name/description`                                                      | **零修改**                                                                                                                                                      | 现状已 0 条（已拉取过 ⇒ base 已前进），合并后仍 0 条；断言不变                                                                                              |
| `X2`            | 0 条（载荷同时带 name+description）                                                 | **零修改**                                                                                                                                                      | 同上                                                                                                                                                        |
| `Y1`            | `entries` 1 条 + `kind='stale'` + `loser` 我的整行 + `serverCurrent` 云端整行       | **翻转**：`expect(await journal()).toHaveLength(0)`；`dump` 保留；新增两条字段级断言（本地 `name='B-name'` 且 `description='A-desc'`；`server.row` 同）         | 断言**没有放宽而是收紧**：`stale` 条目消失由「字段级两端都保住」承担；原断言描述的整行二选一正是本批要消灭的行为（T671 报告 §0 已定性为「诚实但不可操作」） |
| `Y0`            | 不传编辑基准 ⇒ 仍 `stale` ×1                                                        | **翻转**为 0 条 + 字段级两值；注释改为「`fieldBase` 捕获与 `origin` 参数无关」（DEF-146 的因果结论已由 T671 报告 §2 留档）                                      | 该例原目的（证明并非 DEF-146 造成）已由 T671 报告固化；B 批后其语义变为「基准捕获不依赖 `origin`」                                                          |
| `Z0`/`Z1`       | `pull-local-wins` ×1 + `loser=远端整行` + `loserUpdatedAt` + 随后 push 覆盖云端描述 | **翻转**：0 条 + 本地 `name='B-name'`/`description='A-desc'` + 队列保留；删除 `loser`/`loserUpdatedAt` 断言；把「push 后服务端描述 = A0-desc」改为 `= 'A-desc'` | `Z1` 是 PM 明确要求翻转的断言（任务卡「Z 断言必须翻转」）；翻转后由 `AC1-Z` 的字段级断言承担同一不变量                                                      |
| `Y2` 动作二选一 | `resolveConflictRetryLocal / KeepServer` 的整行行为                                 | **仅夹具同字段化**：让 A、B **都改 `name` + `description`**（值不同），仍产生 `stale`；断言（逐条）**零修改**                                                   | 「仅改夹具不改断言」：动作面作用于「已存在的 stale 条目」，与「条目如何产生」正交；整行快照内容随夹具值同步变化，断言强度不变                               |
| `Y3` 对比区时机 | `compareConflict` 的 `diffs` 含 `name` + `description`                              | **仅夹具同字段化**（同 Y2，两侧都改 `name` + `description`），断言 `arrayContaining(['description','name'])` **逐字保留**                                       | 同上：diff 字段集由「两侧都不同」保证，不因合并而缩小                                                                                                       |
| `W1` 文案       | 安全提示不含「合并/逐字段」                                                         | **零修改**（若 M5 调整文案需同步更新本断言）                                                                                                                    | AC9 要求零新 i18n 键；合并后安全提示语义需 M5 复评                                                                                                          |

> 建议落地节奏：`Y1/Y0/Z0/Z1` 的翻转属于 M3（pull 接入）实跑后一次改完；`Y2/Y3` 的同字段化在 M4 之前完成即可（两者都在同一文件，建议 M4 一次性提交）。

### 4.2 **不得改动、必须逐字绿**（arch 候选逐一核验结论）

| 文件                                                                                                            | 结论                                | 理由（核验依据）                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t641-a1-pull-local-wins-journal`                                                                               | **零修改**                          | 队列由**直接改队列记录**（`localDatabase.syncQueue.put({...queued, localUpdatedAt})`）构造，不经 `putWithSyncBase` ⇒ **无 `fieldBase`** ⇒ 按 ADR D1 走保守路径（逐字今日）；且其差异集中在 `name` 同字段 |
| `t641-a3-loser-snapshot-truncate`                                                                               | **零修改**                          | 只推 `conflict` / `skipped` 回执（不进 stale 合并支）；截断口径（512）与本批正交                                                                                                                         |
| `t641-a4-deletion-base-client`                                                                                  | **零修改（有条件，见 §5-③）**       | stale 回执**不带 `serverCurrent`** ⇒ 按 ADR R-10 / AC11 降级为今日（出队 + 记账）；墓碑 pull 分支本批不拦截。**若 M4 对「删除 stale」无条件重试则会破**                                                  |
| `t641-a2-keep-server-writeback`                                                                                 | **零修改**                          | 主用例是「本地新建、从未同步」的行（无 `syncedServerUpdatedAt` / 无旧行 ⇒ 无 `fieldBase`）⇒ 保守；其余用例直接 `appendConflict` 播种条目                                                                 |
| `t326-sync-conflict-client`                                                                                     | **零修改**                          | 夹具为同字段 `name`，或**直接改队列记录**（无基准）；涉及 `taskCheckItems` 的 TOCTOU 用例属非 `tasks` 实体（R-8 范围外）                                                                                 |
| `t329-sync-atomic-write-residue`                                                                                | **零修改**                          | 全部靠 `vi.spyOn(syncTracker,'markDirty')` 注入失败 ⇒ 不产生基准；「以我的版本重试」直写 loser + `markDirty`（无基准）                                                                                   |
| `t644-f09-pseudo-stale-equality`                                                                                | **零修改**                          | 伪 stale（载荷 == `serverCurrent`）先于合并判定；真 stale 例为**新建未同步行**（无基准），只差 `name` 同字段                                                                                             |
| `conflict-journal` / `journal-single-master` / `conflict-ux-contract` / `conflict-ux-api` / `t331` / `t641-ac9` | **零修改**                          | 直接播种 journal 条目或断言上限 / 计数 / 顺序；对条目只做 `toMatchObject` / 字段级断言，无 `Object.keys(entry)` 或整对象 `toStrictEqual` ⇒ `conflictFields` / `dedupeKey` 追加字段不影响                 |
| `occ-base-and-outcome`                                                                                          | **零修改**                          | stale 回执无 `serverCurrent`（降级）+ 新建行无基准                                                                                                                                                       |
| `sync` / `conflict-journal`（pull 用例）                                                                        | **零修改**                          | 队列由 `syncTracker.markDirty(...)` **直调**构造（无基准）                                                                                                                                               |
| `t654-*` / `t655-*` / `t657-*` / `t659-*` / `t669*` / `t670*` / `t187/t188/t190/t323/t641-a6`                   | **零修改**                          | 无「真实任务写 + 异字段远端 + 队列」组合：多为定时器 / 广播 / 保存侧三值判定 / 非 `tasks` 实体 / 只读拉取                                                                                                |
| `local-first-dirty-scope`                                                                                       | **零修改**                          | 只建行并推送（`applied`），无远端异字段冲突                                                                                                                                                              |
| `apps/web` 面板（`conflict-ux.test.ts` / `t669-keep-server-by-kind` / `t670-qa-panel-probe`）                   | **零修改（M5 若改面板呈现需复核）** | 断言作用于已播种条目的展示与动作，不含「条目如何产生」                                                                                                                                                   |

### 4.3 等价性结论（可复用判据）

> 「合并后行为是否改变」**只**取决于两点：① 该夹具的队列项是否经 `putWithSyncBase*` 产生（⇒ 有 `fieldBase`）；② 两侧差异是否落在**不同字段**。二者同时成立才会变 —— 全仓仅 `t671` 命中。

## 5. 口径冲突（**先问 PM，不自行决定**）

1. **`'none'` 空哨兵的两套口径（影响 AC5-⑤ 一项断言）**：AC5 原文把 `''`/`null`/`[]`/`'none'` 列为空哨兵四态；但 R-1 指定的唯一判等 `valuesEqual`（`conflict-journal.ts:429-440`）的空值集是 `null`/`undefined`/`''`/`[]`，**不含 `'none'`**（`'none'` 只在 `sync-normalize.isEmptySyncSentinel` 里归空）⇒ 现实测 `valuesEqual('none','') === false`。
    - 选项 A：扩 `valuesEqual` 的哨兵集（含 `'none'`）—— 会同时改变 A1 与 DEF-135 的判等面，需回归 `t669/t670/def135-*`；
    - 选项 B：合并内核改用 `sameSyncValue` —— 撞 R-1「不新增第二套比较语义」；
    - 选项 C：AC5-⑤ 的 `'none'` 明确为「同形值」（`'none'` vs `'none'`），跨形（`'none'` vs `''`）不承诺。
    - **我当前的写法**：`AC5-⑤` 覆盖「服务端 `null` × 客户端 `''`」与「集合 `[]`」两形，`'none'` 取同形，**未把 `'none'` vs `''` 写成断言**；若选 A 我补一条断言即可。
2. **直写点实为 5 处 / 4 文件（arch 清单漏 2 处）**：实测 `syncTracker.markDirty(` 直调点 = `put-with-sync-base.ts:54` · `project-archive-cascade.ts:42,65` · **`task-repo-impl.ts:361`（`unarchive` 单任务取消归档，直写 `archivedAt` + `projectId`）** · `pomodoro-record-repo-impl.ts:78`。`T672` §四-5 只列级联，§八 R-9 列级联 + 番茄。请确认 M1 是否包含 `unarchive` 与 `pomodoroRecords`（后者新建行天然无基准，接线收益≈0，但「新增直写点即红」的允许清单必须登记它）；源级护栏已按 4 文件 5 处写死，改动范围需同步改允许清单。
3. **`t641-a4`「删除 stale 出队」× M4「删除 stale 一次新 base 重试」**：该用例断言删除被拒后**出队**（`countDirty=0`）。按 ADR R-10（回执缺 `serverCurrent` ⇒ 降级今日）应零修改；若 M4 对删除 stale 也做重试（保队列）则该用例必红。请 RD 在 M4 按「缺 `serverCurrent` ⇒ 今日行为」实现，或提前告知我 triage。
4. **AC8「既有用例零修改」的落地口径**：实测等价性清单只剩 `t671`（§4）。建议把 AC8 写成两句：① 「`t671` 按 §4.1 改（翻转 + 同字段化），断言不放宽」；② 「§4.2 名单逐字绿」。这样批末门禁有唯一可核对的清单，避免「以为要改一批、实际只改一个文件」的反复。

## 6. 交付物与复跑

**新增文件（10 个，全部在 `packages/infrastructure/src/persistence-sync/__tests__/`）**

```text
t675-field-merge-harness.ts              # 共享夹具（假服务端只模拟契约；非测试文件）
t675-ac1-timings.test.ts                 # AC1 X/Y/Z
t675-ac2-tags-union.test.ts              # AC2
t675-ac3-merge-failure.test.ts           # AC3
t675-ac4-stale-no-overlap.test.ts        # AC4 + 300ms
t675-ac5-matrix.test.ts                  # AC5 八项
t675-ac6-tombstone-archive.test.ts       # AC6
t675-field-types-remind-group.test.ts    # 提醒组原子
t675-mode-lww-verbatim.test.ts           # AC14 双态
t675-write-point-source-guard.test.ts    # M1 直写点源级断言
```

**复跑**

```text
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t675-
# 期望：9 文件 / 27 例 / 15 红 12 绿（M2–M4 落地后应逐条转绿，护栏项始终绿）

pnpm exec vp test --run          # 全仓：414 文件 / 3252 例（实现后应 0 红）
pnpm exec vp check               # 0 error
```

**工程注记（踩坑留档，供后续源级测试复用）**：在本包测试里 `import 'node:fs'`（或 `/// <reference types="node" />`）会把 `@types/node` 拉进本包 TS program，令 `t654/t655/t657` 自绘假定时器的 `setTimeout` 返回类型从 `number` 变成 `Timeout` ⇒ **整片 TS 报错**（实测 6 处，2026-11-10）。源级扫描改用 `import.meta.glob('?raw')`（+ `/// <reference types="vite/client" />`）后 `vp check` 回到 0 error。

## 7. 遗留 / 归口

- **M1 派单前置**：§5-② 的直写点范围需 PM 确认；M1 实跑后 `直写点-fieldBase` 应转绿（允许清单不变）。
- **M3/M4 前置**：§4.1 的 `t671` 改动建议与 M3/M4 同 PR（本批未改既有文件，保持「只加测试」）。
- **M2 前置**：§5-① 的 `'none'` 口径；若新增合并失败专属结构化事件名，请同步告知（我在 `AC3` 只断言「既有运行级错误事件 + 日志无业务值」，未写死事件名）。
- **M5 前置**：面板按字段呈现的用例（`conflictFields` 展示 + 文案「已自动合并的字段不在此列」）本批未写，属 M5 红基线。
- 无数据/环境遗留；探针类造数已随临时目录删除（本次未建持久探针）。