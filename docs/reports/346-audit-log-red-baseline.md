# T697 · A 档审计日志 **M0 红基线 + 覆盖清单**（Issue #346）

- 状态：**已交付（M0）** · 更新：2026-11-10 · Owner：qa（`T697`）
- 分支：`feat/346-audit-log` · 基线 HEAD：`9af77cb3`（核过：`git log --oneline -1`，未 rebase / 未 force）
- 范围：**只加测试 + 本报告**（⛔ 未改生产代码 / 未改 `docs/prds/` `docs/adr/` `docs/reports/T696-*` `docs/tasks-state.md` `docs/reports/defect-pool.md`）
- 上游依据：`docs/prds/2026-11-10-audit-log.md`（R-1…R-9 / AC1–AC11）· `docs/adr/2026-11-10-audit-log-bypass-log.md` · `docs/reports/T696-audit-log-arch-review.md`（§3.1 落点 / §4 防刷屏 / §8 有界 / §10 红基线 / §13 D1–D7）

## 0. 结论先行（数字口径）

| 指标                           | 实测                                                       | 命令 / 说明                                                                                  |
| :----------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| 新增测试文件                   | **9 个 + 1 个夹具**                                        | 见 §1                                                                                        |
| 用例数                         | **52**                                                     | `pnpm exec vp test --run <9 文件>`                                                           |
| 红                             | **44**                                                     | 全部为**AC 级断言失败**（见 §2），**零**「模块不存在 / 收集失败」                            |
| 绿（因实现缺失而绿，**弱绿**） | **8**                                                      | 均为「0 条 / 不得出现」型断言（见 §6），必须靠 M6 变异 ②③ 证明其判别力                       |
| `vp check`                     | **rc=0**（1964 文件格式 OK · 1568 文件 lint+type 0 error） | `pnpm exec vp check`                                                                         |
| 既有守卫                       | **rc=0 ×4**                                                | `guard:test-location` / `guard:barrel-imports` / `guard:ddd` / `guard:gate-pathspec`         |
| 受影响面回归                   | **67 文件 / 524 例 / 0 红**                                | `pnpm exec vp test --run packages/infrastructure/src/persistence-sync --exclude '**/t697-*'` |
| AC9「既有用例零改动」          | **改动 0 行**                                              | `git diff --name-only HEAD` 为空（本档只新增未跟踪文件）                                     |

> 口径纪律：本档**不 import** 尚不存在的 `persistence-sync/audit-log.ts`。审计一律经**测试侧探针**读
> （`t697-audit-harness.ts`：表不存在 ⇒ 返回 `[]`），因此每条红都是
> `expected 1 audit entry, received 0` 这类**与 AC 直接对应**的断言失败，而不是 import 崩溃。

## 1. 文件清单与 AC 映射

| 文件                                                                                               | 覆盖                                                               | 例数（红/绿） |
| :------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- | :------------ |
| `packages/infrastructure/src/persistence-sync/__tests__/t697-audit-harness.ts`                     | 夹具（探针 + 假服务端 + 常量）                                     | —（无断言）   |
| `…/__tests__/t697-ac1-local-edit.test.ts`                                                          | AC1 / AC7 / R-2 / R-3 / R-4                                        | 8/1           |
| `…/__tests__/t697-ac11-pull-spam.test.ts`                                                          | **AC11（DEF-147 + DEF-159）** / AC2 / AC18 / AC17                  | 7/5           |
| `…/__tests__/t697-ac2-other-sources.test.ts`                                                       | AC2 另两来源（`push-merge` / `conflict-retry`）+ D3 映射           | 5/1           |
| `…/__tests__/t697-ac4-audit-failure.test.ts`                                                       | AC4 / R-1（失败不阻断 + 可观测 + 不含业务值）                      | 2/0           |
| `…/__tests__/t697-ac5-migration.test.ts`                                                           | AC5（v4→v5 空升级 / 幂等 / **降级实测**）                          | 4/0           |
| `…/__tests__/t697-ac6-bounds.test.ts`                                                              | AC6（1000 条 / 90 天 / 512 截断 / **1 KB 字节预算** / 按实体计数） | 5/0           |
| `…/__tests__/t697-audit-source-guard.test.ts`                                                      | 源级守卫（值形状 / 唯一写入口 / 不得互调）                         | 4/1           |
| `packages/presentation/task/components/task-details/main/__tests__/t697-ac3-history-panel.test.ts` | AC3 真挂载 / AC10 部分                                             | 7/0           |
| `packages/shared/locales/__tests__/t697-audit-history-locale-keys.test.ts`                         | R-7（≤13 键 / 双语言 / 说人话）                                    | 5/0           |

## 2. 逐条红因（全部实测，⛔ 无收集失败）

| #     | AC       | 用例（简写）                                       | 实测红因（原文）                                                                                                                                                                                               |
| :---- | :------- | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | AC1      | 改 3 字段 ⇒ 恰 1 条 + 字段序                       | `expected [] to have a length of 1 but got +0`                                                                                                                                                                 |
| 2     | AC1      | 同值再写一次 ⇒ 0 条新增                            | `expected [] to have a length of 1 but got +0`（先建立 1 条基线）                                                                                                                                              |
| 3     | AC1      | create ⇒ 1 条 `action=create`                      | `expected [] to have a length of 1 but got +0`                                                                                                                                                                 |
| 4     | AC7      | 删除 ⇒ `delete`                                    | `expected [] to have a length of 1 but got +0`                                                                                                                                                                 |
| 5     | AC7      | 归档 ⇒ `archive`                                   | 同上                                                                                                                                                                                                           |
| 6     | AC7      | 取消归档 ⇒ `unarchive`                             | 同上                                                                                                                                                                                                           |
| 7     | AC7      | 恢复 ⇒ `restore`                                   | 同上                                                                                                                                                                                                           |
| 8     | R-4      | 动作值落在枚举内                                   | `expected 0 to be greater than 0`                                                                                                                                                                              |
| 9     | AC2      | pull 改 1 字段 ⇒ 1 条 `source=pull`                | `expected [] to have a length of 1 but got +0`                                                                                                                                                                 |
| 10    | AC2      | 本机编辑 + 远端另改 ⇒ 两条分来源                   | `expected [] to deeply equal [ 'local-edit', 'pull' ]`                                                                                                                                                         |
| 11    | AC2      | pull 字段级合并分支 ⇒ 只含远端字段                 | 同上                                                                                                                                                                                                           |
| 12    | AC2      | 远端墓碑 ⇒ `action=delete` + `fields=[]`           | `远端墓碑必须留痕: expected undefined to be truthy`                                                                                                                                                            |
| 13    | AC18     | 远端时间在未来 ⇒ `at` 仍为本机                     | `expected [] to have a length of 1 but got +0`                                                                                                                                                                 |
| 14    | AC2      | push-merge 合并落库 ⇒ 1 条                         | `expected [] to deeply equal [ 'local-edit', 'push-merge' ]`                                                                                                                                                   |
| 15    | AC2      | stale 但无业务变化 ⇒ 不新增                        | `expected [] to deeply equal [ 'local-edit' ]`                                                                                                                                                                 |
| 16    | AC2/D3   | 「保留我的修改」⇒ `conflict-retry`                 | `expected [] to deeply equal [ 'local-edit', 'pull' ]`（前置：远端胜支未留痕）                                                                                                                                 |
| 17    | AC2/D3   | 「用云端的」⇒ `source=pull`                        | `expected +0 to be 1`                                                                                                                                                                                          |
| 18    | AC4      | 审计 add 抛错 ⇒ 业务仍成功 + `audit.record.failed` | `审计失败必须有结构化 error 事件（AC4/AC16）: expected [] to include 'audit.record.failed'`                                                                                                                    |
| 19    | AC4      | 失败后可继续写 ⇒ 恢复后照常记账                    | `expected [] to have a length of 1 but got +0`                                                                                                                                                                 |
| 20    | AC5      | 老库升级 ⇒ `verno=5`                               | `version(5) 必须真的生效（ADR D1）: expected 4 to be 5`                                                                                                                                                        |
| 21    | AC5      | 读路径兜底（老数据 ⇒ 0 条不抛错）                  | `审计表 auditLogs 不存在（ADR D1：version(5) 只增表）: expected false to be true`                                                                                                                              |
| 22    | AC5      | 重复打开 ⇒ 幂等                                    | 同上                                                                                                                                                                                                           |
| 23    | AC5      | **降级**（v4 打开 v5 库）                          | `expected 4 to be 5`（前置 v5 未生效）                                                                                                                                                                         |
| 24    | AC6      | 1001 条 ⇒ 裁到 1000 淘汰最旧                       | `审计表 auditLogs 不存在（…）`                                                                                                                                                                                 |
| 25    | AC6      | >90 天 ⇒ 淘汰                                      | 同上                                                                                                                                                                                                           |
| 26    | AC6      | 600 字符 ⇒ 512 + `truncated`                       | `expected [] to have a length of 1 but got +0`                                                                                                                                                                 |
| 27    | AC6      | 512 后仍超预算 ⇒ ≤1 KB 字节                        | 同上                                                                                                                                                                                                           |
| 28    | AC6/D4   | 批量按实体计数（2 任务 ⇒ 2 条）                    | `expected [] to have a length of 2 but got +0`                                                                                                                                                                 |
| 29–32 | AC17/§5  | 源级守卫 4 条                                      | `源级守卫：未找到 /packages/infrastructure/src/persistence-sync/audit-log.ts（M1 应新增该模块）` · `auditLogs 的写入只允许出现在 audit-log.ts（recordAudit 唯一门）: expected [] to deeply equal [ Array(1) ]` |
| 33–39 | AC3/AC10 | 面板真挂载 7 条                                    | `详情面板必须出现「变更历史」区块（AC3）: … to contain 'history.title'`（其余 6 条同因：面板尚未渲染）                                                                                                         |
| 40–44 | R-7      | 文案键 5 条                                        | `zh-CN 缺少 history.title: expected undefined to be truthy` · `expected 0 to be greater than 0`（新增键数） · `同组文案必须互不相同…: expected 1 to be 4` · `zh-CN 缺少 history.empty`                         |

## 3. AC 映射矩阵（本轮覆盖 / 后续 / 用户）

| AC / R   | 判据（可自动化）                                              | 本轮              | 备注                                                                                                  |
| :------- | :------------------------------------------------------------ | :---------------- | :---------------------------------------------------------------------------------------------------- |
| AC1      | 3 字段 ⇒ 1 条 + 顺序 + `source` + `at`                        | ✅ 红             | 顺序期望由 `SYNC_TABLES.tasks.entityToPush` **动态派生**（⛔ 不硬编码副本）                           |
| AC2      | 四来源各 1 例 + 不混记                                        | ✅ 红             | 另加 pull 三条分支（远端胜 / 墓碑 / 字段级合并）                                                      |
| AC3      | 真挂载 + 可读 + 中文标签 + 无内部词                           | ✅ 红（7 条）     | `条目高度 ≥40px` / 对比度 / 日期分组观感 **jsdom 无法量取** ⇒ 交用户（§7）                            |
| AC4      | 失败不阻断 + 结构化日志 + 不含业务值                          | ✅ 红             | 注入方式 = 按表名过滤的 `Table.prototype.add` mock（对两种写法都生效）                                |
| AC5      | v4→v5 空升级 + 历史空 + 业务零变化 + **降级实测**             | ✅ 红（4 条）     | 降级用 v4 子类实测（`dexie@4.4.5` 已在 node 侧先行验证可行）                                          |
| AC6      | 1000 / 90 天 / 512 / **1 KB 字节** / 按实体计数               | ✅ 红（5 条）     | 字节按 **UTF-8** 计量（`TextEncoder`）                                                                |
| AC7      | 删除/归档/取消归档/恢复 + 墓碑无噪声                          | ✅ 红             | `fields === []` 冻结口径见 §5-c                                                                       |
| **AC11** | DEF-147（相同记录重放）**且** DEF-159（收集箱桶）**分别成例** | ✅ **红/弱绿**    | 见 §4 —— 两条都必须能抓「按 put 计数」与「按真实字段变化」的实现差异                                  |
| AC8      | 变异 ≥5 逐条跑                                                | ⏳ **设计（§5）** | M0 无实现 ⇒ 执行放 **M6**（PM 裁定），若 M1/M2 后可提前跑则追加回执                                   |
| AC9      | 不侵入                                                        | ✅ 证据           | `git diff --name-only HEAD` = 空 + 既有 persistence-sync 67 文件 524 例全绿                           |
| AC10     | C 端形态 / 复用标签 / 移动端 0 行 / `DESIGN.md`               | 部分 ✅           | 非表格式 + 无内部词 + 键齐备可自动化；观感/对比度交用户                                               |
| R-1      | 旁路不阻断、不参与裁决                                        | ✅                | AC4 用例 + AC9 回归                                                                                   |
| R-2      | 只记实际变化 + `valuesEqual` 单一口径                         | ✅                | 两条空哨兵用例（本机 / pull 跨断层）                                                                  |
| R-3      | 一次写 1 条 + 顺序稳定                                        | ✅                | + 批量按实体（D4）                                                                                    |
| R-4      | 来源四值固定                                                  | ✅                | 枚举断言 + 每条用例的 `source` 断言                                                                   |
| R-5      | 有界（1000 / 90 天 / 512 / 1 KB）                             | ✅                | §6                                                                                                    |
| R-7      | 复用字段标签 + ≤13 框架键                                     | ✅                | 键数上限 + 双语言 + 说人话断言                                                                        |
| R-8      | 首版只 `tasks`                                                | 部分              | 「不得记 projects」**未单独立例**（级联用例里项目行未产审计可作旁证）⇒ 建议 M2 补                     |
| R-9      | 收集箱桶归一                                                  | ✅                | AC11-②                                                                                                |
| R-6      | 隐私（明文姿态 / 不存 token / 清库删除）                      | 部分              | 「日志不含业务值」已断言；`wipeUserData` 清表 **未覆盖**（AC15 属 arch 建议项，未进 PRD）⇒ 建议 M4 补 |

## 4. AC11 两条假刷屏来源（本档最重要，分别成例）

| 来源                                   | 构造                                                                                                        | 断言                                                                                       | 现状                                                   |
| :------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| **DEF-147**（相同记录重放）            | 假服务端 `replay=true`（每轮忽略游标返回该行）⇒ 连拉 3 轮                                                   | 每轮 `tasks.put` 调用数 **≥1**（证明 DEF-147 仍在、本档未顺手改写行为）**且**审计 **0 条** | **弱绿**（0 条因实现缺失而绿；`put` 断言已生效）       |
| **DEF-147 变体**（记录不同、业务等价） | 每轮只推进服务端 `updatedAt`（记录层预筛挡不住）                                                            | 每轮审计 **0 条**（实体层精筛兜底）                                                        | **弱绿**                                               |
| **DEF-159**（收集箱桶归一）            | 本地 `projectId='inbox'`，服务端隐式桶 `projectId=<userId>`（夹具自检断言服务端确实是 `userId`）⇒ 连拉 3 轮 | 每轮 **0 条** + 本地仍为字面 `'inbox'`                                                     | **弱绿**（漏归一 ⇒ 每轮 1 条假 `projectId`，见变异 ③） |
| 对照例                                 | 普通清单（两边 `project-1` 一致）连拉 3 轮                                                                  | 0 条（排除「一律不记」的假绿）                                                             | 弱绿                                                   |

> 口径纪律（T696 §4.3）：只有 **A（DEF-147）+ B（DEF-159）同时存在** 才能声称「防刷屏」。
> 二者都**同时**要求「按真实字段变化记账」，因此 `按 put 计数` 与 `按调用计数` 的实现都会被抓。

## 5. 覆盖清单：16 处写入点（arch §3.1）

| #   | 来源           | 落点                                       | 本轮      | 用例                                                        |
| :-- | :------------- | :----------------------------------------- | :-------- | :---------------------------------------------------------- |
| 1   | local-edit     | `LocalTaskRepoImpl.create`                 | ✅        | AC1「create ⇒ 1 条」                                        |
| 2   | local-edit     | `.update`（含 `archivedAt` ⇒ archive）     | ✅        | AC1 3 字段 / AC7 归档                                       |
| 3   | local-edit     | `.remove`                                  | ✅        | AC7 删除                                                    |
| 4   | local-edit     | `.cascadeRemove`                           | ❌ **M2** | 需子实体夹具（子实体本批不记）；建议 M2 补「仅父任务 1 条」 |
| 5   | local-edit     | `.restore`                                 | ✅        | AC7 恢复                                                    |
| 6   | local-edit     | `.unarchive`                               | ✅        | AC7 取消归档                                                |
| 7   | local-edit     | `.copy`                                    | ❌ **M2** | 新实体 ⇒ `create`                                           |
| 8   | local-edit     | `.snooze`                                  | ❌ **M2** | 提醒组字段进 `fields`                                       |
| 9   | local-edit     | `cascadeProjectArchive`（每 task）         | ✅        | AC6「级联 2 任务 ⇒ 2 条（按实体计数）」                     |
| 10  | pull           | `applyPullBatch` 远端胜                    | ✅        | AC2「保留我的修改」前置断言（`['local-edit','pull']`）      |
| 11  | pull           | `applyPullBatch` 远端墓碑                  | ✅        | AC2「远端墓碑 ⇒ delete + fields=[]」                        |
| 12  | pull           | `applyPullBatch` 本地未改                  | ✅        | AC11 全组 + AC2「pull 改 1 字段」+ AC18                     |
| 13  | pull           | `applyPullFieldMerge`（`businessChanged`） | ✅        | AC2「pull 字段级合并分支」                                  |
| 14  | push-merge     | `applyPushFieldMerge`                      | ✅        | AC2 push-merge 2 例（含「无业务变化 ⇒ 0 条」）              |
| 15  | conflict-retry | `resolveConflictRetryLocal`                | ✅        | AC2「保留我的修改」+ 幂等重复点击                           |
| 16  | conflict-retry | `resolveConflictKeepServer`                | ✅        | AC2「用云端的 ⇒ source=pull」                               |

**合计：13/16 已覆盖；3 处（`cascadeRemove` / `copy` / `snooze`）明确留给 M2**（避免「实现全接了、用例只测一处」）。

## 6. AC8 变异设计（M0 只交设计；执行窗口 = **M6**，PM 裁定）

> 行号会随 M1 漂移 ⇒ 定位用**符号 + 当前行区间**；改法一律「最小单点改动 + 只跑受影响文件」。
> **M6 验收要求（PM 硬要求）**：① 每条给出**具体红例名**（不是文件红数）；② 逐字节还原用
> `sha256sum -c`（改前 `sha256sum <file> > /tmp/mut.sha`，还原后 `sha256sum -c /tmp/mut.sha`）。

| #   | 变异                               | 文件 · 符号（当前行区间）                                                                                         | 改法                                                                | 期望红（具体用例名）                                                                                                                         |
| :-- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 去掉审计接线                       | `persistence-local/repos/task-repo-impl.ts` · `update()`（143–208，接线点 = 写事务后 `recordEditOverwrite` 附近） | 注释掉该处 `recordAudit(...)` 调用                                  | `T697 / AC1 … > 改 3 个字段（name/description/priority）⇒ 恰 1 条…` + AC7 全部 4 例                                                          |
| 2   | `!==` 替 `valuesEqual`（只此一处） | `persistence-sync/audit-log.ts` · `diffAuditFields` 内字段比较                                                    | 把 `valuesEqual(before[f], after[f])` 改为 `before[f] === after[f]` | `T697 / AC1 … > 空哨兵等价（startAt: null 写到已是 '' 的任务）⇒ 0 条` 与 `… / AC2 pull … > 空哨兵跨断层：本地 startAt='' ↔ 远端 null ⇒ 0 条` |
| 3   | **删掉收集箱归一**                 | `audit-log.ts` 的 diff 入口（`toLocalProjectId` 归一调用）或 pull 接线处                                          | 去掉 `toLocalProjectId(...)` 归一（直接用 `entity.projectId` 比较） | `T697 / AC11-② … > 本地 inbox ↔ 服务端 userId：3 轮 0 条（漏归一 ⇒ 每轮 1 条假 projectId 变更）`                                             |
| 4   | 记整行快照                         | `audit-log.ts` · `diffAuditFields`                                                                                | `fields` 收 `Object.keys(after)` 全量（不做 diff）                  | `T697 / AC1 … > 改 3 个字段…fields 恰为这 3 个字段` + `T697 / AC6 … > 多字段长值（512 截断后仍超预算）⇒ 序列化 ≤1 KB`                        |
| 5   | 审计前置 `throw` 且不 catch        | `audit-log.ts` · `recordAudit` 入口                                                                               | 在 `try` 之前 `throw new Error('mutant')`                           | `T697 / AC4 … > add 抛错 ⇒ 保存返回 null…` + `… > 失败后可继续写…`（业务保存必须仍成功）                                                     |
| 6   | 去掉上限淘汰                       | `audit-log.ts` · `pruneAuditLog`                                                                                  | 函数体 `return 0`（恒不删）                                         | `T697 / AC6 … > 已有 1000 条 + 1 次真实写 ⇒ 裁到 1000…` + `… > 200 天前的记录被清走、近期记录保留`                                           |
| 7   | 从 v5 store 清单删掉 `auditLogs`   | `persistence-local/db/local-database.ts` · `version(5).stores`                                                    | 删掉 `auditLogs:` 一行（模拟「降级后再重开 / 漏建表」）             | `T697 / AC5 … > 老库升级 ⇒ verno=5 + auditLogs 存在且空…` + 所有 `requireAuditTable()` 用例（AC6 全部）                                      |

> 变异 ③ 是本档**新增**（PRD AC8 未列）：它是**唯一能在 3000+ 既有用例全绿的情况下上线假刷屏**的洞。

## 7. 用户验收清单（视觉/UI 呈现类，交用户人工执行）

前置：需求分支本地栈（`pnpm webapp dev` ⇒ `http://localhost:5173`，API 走本地后端）。⛔ 本档不做浏览器自动化。

| #   | 测什么                     | 怎么操作                                 | 预期结果                                                                                                                 | 对应 AC         |
| :-- | :------------------------- | :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :-------------- |
| V1  | 面板存在与默认折叠         | 打开任务详情                             | 出现「变更历史」，**默认折叠**；标题不抢主题内容                                                                         | AC3 / AC10      |
| V2  | 可读性（说人话）           | 展开                                     | 每条 = 时间 · 来源（本机修改/同步自云端/…）· 字段中文名 + 旧值→新值；**看不到** `fieldBase`/`revision`/`source`/`plain:` | AC3 / R-7       |
| V3  | C 端观感（非管理台）       | 展开 + 滚动                              | 卡片/时间线（非表头+行+网格）；留白与圆角舒展；条目点击区 ≥40px                                                          | AC10            |
| V4  | 三态可辨（颜色+符号+文字） | 看来源标记                               | 四来源在**红绿色盲模拟/去色**下仍可两两区分（有符号或文字兜底），文本对比度 ≥4.5:1                                       | AGENTS.md §4/§5 |
| V5  | 空态与老数据               | 打开一个从未修改过的老任务（升级前数据） | 显示「暂无变更记录」，**不报错**、不显示「加载失败」                                                                     | AC5 / NFR 兼容  |
| V6  | 深浅色                     | 切换主题                                 | 两套主题下均可读、无刺眼反差                                                                                             | AC10            |

## 8. 口径冲突与 PM 裁定（留痕）

| #   | 冲突                                                                                                                                                                                              | 裁定（PM `T697`）                                                                                                                                                                                                                                                                                                                   | 落点                              |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- |
| Q1  | AC8 要求「变异逐条跑」，但 M0 无实现 ⇒ 变异无处可跑                                                                                                                                               | M0 只交**可执行粒度的设计**；**执行放 M6**，且 M6 必须给**每条 kill 证据**（红例名 + `sha256sum -c` 还原）；M1/M2 后若可提前跑则追加回执                                                                                                                                                                                            | §6                                |
| Q2  | AC3 需冻结 provider 契约；且 `fieldLabel`/`FIELD_LABEL_KEYS` 在 `apps/web/src/components/sync/`，`packages/presentation` **不能 import apps/web** ⇒ R-7「复用既有字段标签」在 arch 落点下不可实现 | ① 契约按最小形状：`load(taskId, beforeSeq?) → { items, hasMore, unavailable }`，`item={seq,at,source,action,fields:[{field,from,to}]}`；`unavailable` 专表「老数据无历史」（⛔ 不用空数组冒充）② 字段标签**下沉 `packages/shared`**（纯迁移、导出面不变）；`conflict-field-labels.test.ts` **只允许改 import 路径**（断言逐字不动） | AC3 用例按 ① 写；§9 遗留          |
| Q3  | AC5「降级实测」在伪 IDB 下无法装旧构建                                                                                                                                                            | 等价法批准：v4 子类**照抄 15 表 stores**；断言四件（`verno=5` / `auditLogs` 空 / tasks 逐字段相同 / 其余 14 表 stores 未变）+ 降级后 `verno=4` / tasks 可读 / `auditLogs` 不可见                                                                                                                                                    | §1 · `t697-ac5-migration.test.ts` |
| Q4  | AC6「同一次写 1 条」是否按用户手势                                                                                                                                                                | 按 PRD **D4**：同一实体一次写 1 条，批量**按实体计数**                                                                                                                                                                                                                                                                              | AC6 级联用例                      |

**另有 3 条 M0 期间发现的实现口径，请 M2/M3 落地时对齐（不阻塞本档）**：

- **a. `fieldBase` 的记录层陷阱（`DEF-155` 同族）**：`cascadeProjectArchive` 当前用 `captureFieldBase(taskRecord, nextTask)`（**记录层**，文本字段为 `plain:` 形状）。若审计在级联路径也用记录层取值，`from` 会写成 `plain:xxx`（→ 界面出现 `plain:`、且与实体层判等不一致）。⇒ **级联路径必须用实体层**（`recordToEntity` 后再 diff）。本档 AC17 源级守卫 + 「不含 `plain:`」行为断言会抓住。
- **b. `AC6`「4 字段 × 512 ⇒ ≤1KB」在 `tasks` 上不可构造**：`TASK_NAME_MAX_LENGTH=128` / `TASK_DESC_MAX_LENGTH=256`（领域校验上限，本地仓储虽不校验，但构造 4×512 会违背领域语义）。⇒ 本档改用 **2 个长文本 + 60 个 tags**（512 截断后仍超预算）实现**等价**的字节预算断言，仍能区分「只有值级截断、没有条目级预算」的实现。
- **c. 墓碑/归档动作的 `fields` 口径已冻结为 `[]`**（arch §3.1 + AC7「墓碑不产字段变更噪声」）：`delete` / `archive` / `unarchive`（未搬收集箱）/ `restore` 四动作 `fields === []`；`unarchive` 若同时 `projectId` 回收集箱则**只含 `projectId`**（本档只覆盖「不搬」分支）。

## 9. 遗留 / 后续（三出口）

| 项                                                       | 出口                                     | Owner / 时点       |
| :------------------------------------------------------- | :--------------------------------------- | :----------------- |
| `cascadeRemove` / `copy` / `snooze` 三处写入点的审计断言 | **转办** M2 实现时补                     | rd → qa 复验（M2） |
| R-8「`projects` 不得进审计」显式例                       | **转办** M2                              | rd/qa（M2）        |
| `wipeUserData` 清审计（AC15 / R-6）                      | **转办** M4                              | rd/qa（M4）        |
| `field-label` 下沉 `packages/shared`（Q2 裁定）          | **转办** M5（生产改动，本档不做）        | rd-fe（M5）        |
| AC8 变异 7 条执行 + kill 证据                            | **转办** M6（PM 裁定）                   | qa（M6）           |
| 条目高度 ≥40px / 对比度 / 日期分组观感                   | **用户走查**（§7）                       | 用户               |
| 首屏性能（「保存路径无可感变化」，p95 ≤5ms）             | 未测（不进 CI 门禁；建议 M6 一次性量取） | qa（M6）           |

## 10. 复现

```bash
# 红基线（9 文件 / 52 例 / 44 红 / 8 弱绿）
pnpm exec vp test --run \
  packages/infrastructure/src/persistence-sync/__tests__/t697-ac1-local-edit.test.ts \
  packages/infrastructure/src/persistence-sync/__tests__/t697-ac11-pull-spam.test.ts \
  packages/infrastructure/src/persistence-sync/__tests__/t697-ac2-other-sources.test.ts \
  packages/infrastructure/src/persistence-sync/__tests__/t697-ac4-audit-failure.test.ts \
  packages/infrastructure/src/persistence-sync/__tests__/t697-ac5-migration.test.ts \
  packages/infrastructure/src/persistence-sync/__tests__/t697-ac6-bounds.test.ts \
  packages/infrastructure/src/persistence-sync/__tests__/t697-audit-source-guard.test.ts \
  packages/presentation/task/components/task-details/main/__tests__/t697-ac3-history-panel.test.ts \
  packages/shared/locales/__tests__/t697-audit-history-locale-keys.test.ts

# 门禁（本轮口径）
pnpm exec vp check
pnpm run guard:test-location && pnpm run guard:barrel-imports && pnpm run guard:ddd \
  && pnpm run guard:gate-pathspec

# 受影响面回归（应 0 红）
pnpm exec vp test --run packages/infrastructure/src/persistence-sync --exclude '**/t697-*'

# AC9 证据（应为空）
git diff --name-only HEAD
```