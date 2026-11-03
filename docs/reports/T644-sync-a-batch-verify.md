# T644 数据同步 A 批（`A1`/`A2`/`A3`/`A4`/`A6` + `AC7`/`AC9`）轮次 2 独立复验报告

- 状态：**轮次 3 终验通过（可合）** —— 26 红逐条转绿 · 断言未放宽 · 4 变异全捕获 · **轮次 2 的 P1（DEF-132）已修复并 7 表真 JSON 复核** · 全仓门禁 9 项全绿（见 §9）
- 日期：2026-11-03 · Owner：qa（`T644`）· 需求：`T320` A 批
- 口径：**只读复验**（未改产品代码、未改 RD 用例）；新增用例仅 `F-09` 与「真服务端形状」红基线
- 基线：客户端 `feat/320-data-sync-a-batch` @ **`9a2c1fa5`**（RD 实现 `72a70855` 数据面 / `565f7924` UI 文案 / `9a2c1fa5` 文档）；我写的口径基线 = `dc7ace4b`
- 服务端：`nao-todo-server` `feat/320-sync-delete-occ` @ **`fe273fc`**（PR #86）
- 指针：PRD `docs/prds/2026-11-03-data-sync-a-batch.md` · 架构评审 `docs/reports/T640-sync-a-batch-arch-review.md` · ADR `docs/adr/2026-11-03-sync-conflict-journal-crypto.md`

---

## 0. 结论（先行）

| 项                     | 结果                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 26 条红基线            | **26/26 转绿**（逐条见 §1）                                                                                                   |
| 断言是否被放宽         | **否**（RD 只改 3 个既有测试文件，均为合法口径变更，见 §2；7 个 `t641-*` **零改动**）                                         |
| 5 条现绿护栏           | **5/5 仍绿**（§3）                                                                                                            |
| 变异探针 M1–M4         | **4/4 必红**，逐字节还原（sha1 前后一致，§4）                                                                                 |
| 跨仓真形状             | `deletions[].baseUpdatedAt` ✅ · `serverCurrent` ✅（真 JSON 核对）；**但发现 A2 客户端写回路径吃不下真形状 ⇒ P1 缺陷（§5）** |
| `F-09` 红基线          | 新增 2 例：伪 stale 判等 **1 红** / 真 stale 保留 **1 绿护栏**（§6）                                                          |
| 定向回归               | `persistence-sync/__tests__` + `locales/__tests__` 全跑：**40 文件 / 295 例 / 3 红（全是本次新增预期红）/ 292 绿**            |
| 门禁（按派单只跑定向） | `vp check` **rc=0**（1481 文件 0 error/warning）· `guard:test-location` **rc=0**（356 受检，+2 = 新增文件数）                 |
| 全仓门禁               | **未跑**（PM 指定轮次 3 统一跑）                                                                                              |

**放行判断**：`A1`/`A3`/`A4`/`A6`/`AC7`/`AC9` 可放行；**`A2` 需先修 P1**（真服务端 `serverCurrent` 的 `null` 数组会让「保留服务端」直接抛错）——用户走查清单中该项**阻塞**。

---

## 1. 26 条红基线 → 转绿逐条结论

命令：`pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t641-*.test.ts packages/shared/locales/__tests__/t641-*.test.ts`
结果：**7 文件 / 31 例 / 31 绿**（26 原红全部转绿 + 5 现绿护栏仍绿）。

### `A1`（F-01 / AC1）—— `t641-a1-pull-local-wins-journal.test.ts` 3/3 绿

| 用例                                               | 判据                                                                                  | 结论 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- |
| 本地胜 ⇒ journal 恰 1 条 `pull-local-wins`         | kind / loser=远端快照 / diff 子集 / winner·loser 时间 / base 仍收敛 / 队列保留        | ✅   |
| 重复 pull ⇒ 仍 1 条（`occurrences=2`）             | `(table,entityId,kind,winnerUpdatedAt)` 去重                                          | ✅   |
| 墓碑特例 ⇒ 墓碑生效 + 出队 + 不复活 + 本地内容入账 | kind 为 `remote-wins`、本地行 `deletedAt` 落墓碑、base=墓碑版本、下轮 push 不含该任务 | ✅   |

### `A2`（F-02 / AC2）—— `t641-a2-keep-server-writeback.test.ts` 7/7 绿（5 原红 + 2 护栏）

| 用例                                                                                           | 结论                          |
| ---------------------------------------------------------------------------------------------- | ----------------------------- |
| 写回后逐字段 == `serverCurrent` + base + 队列/journal 清空 + 再编辑 push 带新 base ⇒ `applied` | ✅                            |
| 例外① 本地又有新编辑 ⇒ 拒绝写回 + 保留条目 + 新编辑不丢                                        | ✅                            |
| 例外③ 解密失败 ⇒ `ok:false` + 不改行 + 不清条目                                                | ✅（实现确有 decrypt 读取点） |
| 例外④ 快照过期 ⇒ base 只进不退、不写回旧快照                                                   | ✅                            |
| 旧服务端无 `serverCurrent` ⇒ `pendingNextSync: true` 且 `ok:false`                             | ✅                            |
| （护栏）重复点击幂等 / 例外② 删除中不复活                                                      | ✅ ✅                         |

### `A3`（F-03 / AC3）—— `t641-a3-loser-snapshot-truncate.test.ts` 4/4 绿

`conflict` / `skipped` 的 `loser` 非空（id/name/description，无记录层字段）✅；>512 字符按 512 截断且 `truncated===true` + `truncatedFields===['description']` ✅；≤512 原样不标 ✅。

### `A4` 客户端（F-04 / AC4）—— `t641-a4-deletion-base-client.test.ts` 6/6 绿（4 原红 + 2 护栏）

`deletions` 带 `baseUpdatedAt` ✅；删除 `stale` 落账含本地内容 + 墓碑保留 + base 写回 + 出队 ✅；能力探测 `deletionOCCSupported` true/false ✅；行物理缺失不带 base ✅（护栏）；旧载荷键恰 `table/id` ✅（护栏）。

### `A6`（F-06 / AC5）—— `t641-a6-icon-contract.test.ts` 4/4 绿

`entityToPush` projects/tags 无 `icon`（`sortId` 仍在）✅；白名单 = `{taskCheckItems:[deletedAt], taskComments:[deletedAt], pomodoros:[totalDuration], pomodoroRecords:[deletedAt]}`（projects/tags/tasks 空）✅；project / tag 拉取保留本地 `icon` 且其余字段照常覆盖 ✅ ✅。

### `AC9` —— `t641-ac9-journal-stats.test.ts` 3/3 绿

`summarizeConflicts(range?)`：`byKind`/`byTable`/`byDay`（UTC 日桶，空桶不补零）✅；ISO 闭区间过滤 ✅；`exportConflicts()` 返回**对象** `{version:1, exportedAt, entries}`（并显式断言不是字符串）✅。

### `AC7` —— `packages/shared/locales/__tests__/t641-ac7-conflict-kind-labels.test.ts` 4/4 绿（3 原红 + 1 护栏）

新 kind `pull-local-wins` 双语文案 ✅；全部 kind 有 label 且 zh 互不相同 ✅；组件 `KIND_KEYS` 接入 ✅；用户可见串内控术语 0 命中 ✅（护栏）。

---

## 2. 断言改动判定（允许 / 禁止）

`git diff --name-only dc7ace4b..HEAD -- '*__tests__*'` 只命中 **3 个**既有测试文件；`t641-*` 命中 **0** ⇒ 我写的 7 个用例文件未被改动、断言未被放宽。

| 文件                                  | 改动                                                                                                            | 判定                                     | 依据 / 残余影响                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t331-conflict-count-refresh.test.ts` | 种子 `stale` → `remote-wins`（6 处）                                                                            | **允许**（合法口径变更）                 | 该文件只验「计数与 journal 同源刷新」；A2 后 `stale` 缺 `serverCurrent` 不再"只清条目"，沿用会把 A2 语义耦合进计数用例。断言强度不变（仍是「处理后 −1 / 归零 / 与列表同源」）。**残余缺口**：`stale` 处理后 `conflictCount` 归零这一组合不再被该文件覆盖（我的 `t641-a2` 只断言 journal 清空，未断言计数）⇒ 见 §7 未覆盖项 ① |
| `dropped-fields.test.ts`              | `projects.icon` 移出白名单（期望 `icon` 归入真·漂移）；新增 `pomodoros.totalDuration` 白名单正例                | **允许**（契约随 A6 合法变更，**更严**） | A6 后 `icon` 已不发送 ⇒ 若服务端仍报 `icon`，按真·漂移处理是正确收紧；新增正例补回了「白名单仍有项」的覆盖                                                                                                                                                                                                                   |
| `dropped-fields-push.test.ts`         | 「仅白名单字段」用例种子 `projects.icon` → `taskCheckItems.deletedAt`；断言（零告警 / 计数归 0 / 正常出队）不变 | **允许**（前提失效，等价替换）           | 原用例前提（客户端发 `icon`）已被 A6 移除；替换为仍在白名单的字段，覆盖强度等价                                                                                                                                                                                                                                              |

**无「放宽断言」**（如删除 expect / 改 `toBe` 为 `toBeTruthy` / 去 `toEqual` 精确比 / 加 skip）：未发现。

---

## 3. 5 条现绿护栏（仍绿）

1. `A2` 重复点击（条目已清）⇒ no-op，不额外改行。
2. `A2` 例外② 删除中 ⇒ 不复活 + 保留删除意图（队列仍 `delete`）+ 清条目。
3. `A4` 行已物理缺失 ⇒ `deletions` 不带 base（回退删除优先）。
4. `A4` 旧载荷（本地无 base）⇒ `deletions` 键恰 `{table,id}`（`R-D` 红线，逐字不变）。
5. `AC7` 用户可见串中 `stale|noop|OCC|base|derivedUpdates` 词边界 0 命中。

---

## 4. 变异探针（4 处，均必红 + 逐字节还原）

方法：对产品文件做**单点**变异 → 跑指定用例 → 断言必红 → 从备份还原 → `sha1` 前后比对。

| #   | 变异内容                                                                    | 目标用例    | 结果                                                 | 文件 sha1（before = restored）       |
| --- | --------------------------------------------------------------------------- | ----------- | ---------------------------------------------------- | ------------------------------------ |
| M1  | `A1` 复用 `remote-wins`（`recordPullLocalWins` 的 kind 改为 `remote-wins`） | `t641-a1-*` | **2 红**（kind 断言 + 去重计数）                     | `sync-service.ts` `99126deb…` ✅     |
| M2  | `A1` 去墓碑特判（把墓碑分支条件改为永假 ⇒ 墓碑走「本地胜」）                | `t641-a1-*` | **1 红**（墓碑特例：kind 变 `pull-local-wins`）      | `99126deb…` ✅                       |
| M3  | `A2` 写回不判「本地有新编辑」（例外① 条件恒假）                             | `t641-a2-*` | **1 红**（新编辑被覆盖为云端名）                     | `conflict-journal.ts` `8abf8829…` ✅ |
| M4  | `A4` 无 base 分支改成走 OCC（缺 base 时回填 `item.localUpdatedAt`）         | `t641-a4-*` | **1 红**（旧载荷逐字不变护栏：多出 `baseUpdatedAt`） | `sync-service.ts` `99126deb…` ✅     |

> M4 说明：变异命中「旧载荷」护栏（`action='delete'` 分支），未命中「行物理缺失」用例——后者走 `if (!record)` 提前分支，属**另一条**代码路径；变异仍被捕获，分支差异登记于 §7。

---

## 5. 跨仓真形状核对（不只 mock）

### 5.1 服务端契约（`feat/320-sync-delete-occ` @ `fe273fc`）

- `SyncDeletion`：`BaseUpdatedAt *string \`json:"baseUpdatedAt,omitempty"\``—— 缺省不出现；非法值逐条`error=invalid`；`pomodoroRecords`仍`skipped`。
- `SyncResult.ServerCurrent`：`json:"serverCurrent,omitempty"` —— **仅 `stale` / `noop` 返回（含删除 stale）**；`applied` 不回；形状与 `/sync/pull` 同表条目**同源 converter**。
- 删除回执 `serverUpdatedAt` = 库中真实值（R-20）。

实跑服务端契约测试：`go test ./interfaces/controllers -run 'TestSyncPushServerCurrent|TestSyncDeletion_BaseUpdatedAtOmitempty|TestSyncPushDeletion_RealTimestampAndOCC'` ⇒ **ok**（go1.27.3）。

### 5.2 真实 JSON 样例（`go run` 直接调 `SyncController.Push` 序列化，非 mock）

```json
// upsert stale
{"results":[{"id":"9001","outcome":"stale","serverCurrent":{"archivedAt":"","checkItemCount":0,"commentCount":0,"createdAt":"2026-11-03T09:00:00Z","deletedAt":"","description":"d","endAt":"","givenUpAt":"","id":"9001","name":"云端名称","parentTaskId":"","priority":"medium","projectId":"","remindAt":"","remindRepeat":"","remindTime":"","remindWeekdays":null,"sortId":256,"starMarkAt":"","startAt":"","state":"pending","subtaskCount":0,"tags":[],"updatedAt":"2026-11-03T10:00:00.123Z"},"serverUpdatedAt":"2026-11-03T10:00:00.123Z","table":"tasks"}],"serverTime":"…"}
// 删除 stale
{"results":[{"id":"9001","outcome":"stale","serverCurrent":{…,"deletedAt":"","remindWeekdays":null,"tags":null,"updatedAt":"2026-11-03T10:00:00.456Z"},"serverUpdatedAt":"2026-11-03T10:00:00.456Z","table":"tasks"}],"serverTime":"…"}
// 老客户端删除（无 base）
{"results":[{"id":"9001","outcome":"applied","serverUpdatedAt":"2026-11-03T10:00:00.456Z","table":"tasks"}],"serverTime":"…"}
```

### 5.3 客户端解析路径核对

| 服务端字段                                          | 客户端                                                                                                           | 结论                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| `deletions[].baseUpdatedAt`（`*string`，omitempty） | `deletions.push({table,id,...(base?{baseUpdatedAt}:{})})`                                                        | ✅ 键名/缺省语义一致  |
| `results[].serverCurrent`（对象，仅 stale/noop）    | `PushResult.serverCurrent?: Record<string, unknown>` → `appendConflict({serverCurrent})` → `entry.serverCurrent` | ✅ 读取与持久化正常   |
| `serverCurrent.updatedAt/deletedAt`                 | `resolveConflictKeepServer` 读 `entry.serverCurrent.updatedAt` 作 base；写回走 `entityToRecord`                  | ⚠️ **见 5.4**         |
| `results[].outcome` 有无                            | `syncStatus.setDeletionOCCSupported(...)`                                                                        | ✅ 与「能力探测」一致 |

### 5.4 🔴 P1 缺陷（新增，未修）：`A2` 写回路径吃不下真实形状

- **现象**：`resolveConflictKeepServer` 把 `entry.serverCurrent` **直接**喂给 `config.entityToRecord`（**跳过** `config.resToEntity` 归一）。服务端真实行含 `remindWeekdays: null`（upsert / 删除 stale 都有）、删除 stale 另有 `tags: null`；`taskEntityToRecord` 对 `tags` / `remindWeekdays` 做 `[...]` 展开 ⇒ `TypeError: not iterable`。
- **且**该调用**不在** `try/catch` 内 ⇒ 用户点「保留服务端」**直接抛异常**（服务端有该行时 100% 复现；只有 RD mock 的 `[]` 掩盖了它）。
- **附带**：`remindRepeat/remindAt/remindTime/deletedAt: ""` 未经 `resToEntity` 归一 ⇒ 落库哨兵与 pull 路径不一致（`remindRepeat` 应为 `'none'`、`deletedAt` 应 `null`）。
- **红基线**：`packages/infrastructure/src/persistence-sync/__tests__/t644-a2-real-server-shape.test.ts`（**2 例全红**，样例即 5.2 真 JSON）。
- **同族风险（未用真样例验证）**：`taskCommentEntityToRecord` 的 `[...entity.attachments]`（`converters/task.ts:124`）—— 若服务端返回 `attachments: null` 会同类抛错（未拿到评论真样例，登记 §7）。
- **建议修法**（供 RD，不在本单实现）：写回前 `const entity = config.resToEntity(entry.serverCurrent)` 再 `entityToRecord(entity)`；或对数组做 `?? []` 兜底 + 显式哨兵归一。**修完须让 `t644-a2-real-server-shape` 转绿**。

---

## 6. `F-09`（伪 stale 挤占真冲突）红基线

文件：`packages/infrastructure/src/persistence-sync/__tests__/t644-f09-pseudo-stale-equality.test.ts` —— **2 例：1 红 / 1 现绿护栏**。
（合跑本报告两个 `t644-*` 文件：**2 文件 / 4 例 / 3 红 / 1 绿**。）

| 用例                                                                                                                                                                       | 期望           | 现状                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------- |
| 伪 stale：`serverCurrent` 与本次推送载荷业务字段相等（服务端哨兵 `''`/`null` 差异 + `updatedAt` 前进） ⇒ **判 applied**：写回 base、出队、**不落账**、`conflictCount` 不增 | 应按已生效处理 | ❌ **红**（一律落账：出现 1 条 `stale`） |
| 真 stale：`serverCurrent` 与载荷不等 ⇒ 仍落账（kind=stale、loser 含本地内容、`winnerUpdatedAt` 正确）                                                                      | 保留真冲突     | ✅ 绿（护栏）                            |

> 口径提示：判等必须**归一哨兵**（服务端 `''`/`null` vs 客户端 `null`/`'none'`/`[]`）——用例已按真实形状构造，不能只比 raw JSON。

---

## 7. 未覆盖项（明确登记）

1. `t331` 种子改 `remote-wins` 后，「`stale` 处理后 `conflictCount` 归零」这一**组合**暂无直接断言（`t641-a2` 断言了 journal 清空；计数刷新机制由 `remote-wins` 同源验证）。建议实现 `F-09` 时顺带补 1 行断言。
2. `taskComments.attachments: null` 的真形状未验证（无评论真样例）；仅登记同族风险（§5.4）。
3. `A2` 写回后的「再编辑 push 带新 base」仅 mock 验证；**未做**客户端 ↔ 真服务端跨仓联调（服务端已就绪，可轮次 3 补）。
4. 变异 M4 只被「旧载荷」护栏捕获；「行物理缺失」走另一分支（`if (!record)`），该分支未做变异（覆盖由用例本身守护）。
5. 冲突面板 UI 观感/交互（复制按钮、两态提示文案、删除冲突说明）属**用户人工走查**，见 `docs/reports/320-sync-a-batch-user-acceptance.md`（其中 `A2` 项因 §5.4 缺陷**阻塞**）。
6. 移动端（红线）不在本批覆盖。
7. `pull` 侧既有 `remote-wins` 分支仍以**本地整表快照**入账（本批之前既有行为，非 A1 新增）；已受 512 截断与 200 上限约束，未要求本批改写。
8. 全仓门禁（`vp check` 之外 5 项）未跑 —— 轮次 3 统一。

---

## 8. 复验命令与精确数字

```text
# 26 红转绿（7 文件）
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t641-*.test.ts \
  packages/shared/locales/__tests__/t641-ac7-conflict-kind-labels.test.ts
→ 7 files / 31 tests / 31 passed

# RD 改过的 3 个既有测试
pnpm exec vp test --run .../t331-conflict-count-refresh.test.ts .../dropped-fields.test.ts .../dropped-fields-push.test.ts
→ 3 files / 17 tests / 17 passed

# 定向回归（整个 persistence-sync + locales 目录）
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__ packages/shared/locales/__tests__
→ 40 files / 295 tests / 3 failed（全部为本次新增预期红）/ 292 passed

# 新增红基线
t644-a2-real-server-shape.test.ts → 1 file / 2 tests / 2 failed（TypeError，P1）
t644-f09-pseudo-stale-equality.test.ts → 1 file / 2 tests / 1 failed · 1 passed

# 门禁（定向）
pnpm exec vp check → rc=0（1481 files，0 warning/lint/type error）
pnpm run guard:test-location → rc=0（356 受检，批前 354，+2）
```

---

# 轮次 3 终验（T646，2026-11-03）

- 基线：客户端 `feat/320-data-sync-a-batch` @ **`fbd24883`**（RD 返工 `b272d16b` 归一链 · `fbd24883` F-09）；服务端 `feat/320-sync-delete-occ` @ `fe273fc`
- 结论：**通过，建议可合**（前置：服务端 PR #86 先合并/发布，符合 PRD 发布顺序；UI 走查由用户按清单执行，不阻塞合并）

## 9.1 转绿核（逐条，自己跑）

| 目标                                                  | 结果                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `t644-a2-real-server-shape.test.ts`                   | **2/2 绿**（轮次 2 的 2 红已转）                                   |
| `t644-f09-pseudo-stale-equality.test.ts`              | **2/2 绿**（伪 stale 转绿 + 真 stale 护栏仍绿）                    |
| `t644-a2-comment-null-attachments.test.ts`（RD 新增） | **1/1 绿**                                                         |
| `t641-*` 7 文件                                       | **31/31 仍绿**                                                     |
| `conflict-entity-registry.test.ts`                    | **2/2 绿**（RD 新增 1 条「转换器 ≡ SYNC_TABLES」断言，属**加强**） |

**断言未被放宽**：`git diff dc7ace4b..fbd24883 -- '*__tests__*'` 命中 3 改 + 3 新（`t644-*`）；`git diff 59dd5726..HEAD -- '*__tests__*'` 只有 RD 新增的 `t644-a2-comment-null-attachments.test.ts` 与 `conflict-entity-registry.test.ts`（+1 用例，无删减）——**我的 `t641-*` / `t644-*` 文件零改动**。

**归一链真共用**（非第二套实现）：

- `sync-normalize.ts` 是唯一实现；`conflict-journal.ts` 引入 `toLocalProjectId`（写回桶映射），`sync-service.ts` 引入 `toLocalProjectId / toPushProjectId / syncPayloadMatchesServer`（F-09 判等 / pull 映射）——同一模块、同一 `sameSyncValue`；
- 写回链 = `config.resToEntity(entry.serverCurrent)` → （tasks 桶映射）→ `entityToRecord`，与 pull `applyPullBatch` 的 `resToEntity → entityToRecord` **同一条链**；
- 注册表新增 `resToEntity` 并新增**同一函数身份**断言（防漂移）。全仓 grep：`sameSyncValue` 仅 1 处定义、1 处调用点（`syncPayloadMatchesServer`）。

## 9.2 变异复跑（4/4 必红，逐字节还原）

| #   | 变异                                               | 目标用例          | 结果                                                                                                                                 | sha1 复原                            |
| --- | -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| M1  | 写回跳过 `resToEntity`（直喂 raw `serverCurrent`） | `t646-all-tables` | **3 红**（tasks/projects/tags；tasks 为 `null` 数组导致的 fail-soft 拒绝落库）                                                       | `conflict-journal.ts` `93706e06…` ✅ |
| M2  | `sameSyncValue` 不归一哨兵（raw 相等）             | `t644-f09`        | **1 红**（伪 stale 又落账）                                                                                                          | `sync-normalize.ts` `f844c9da…` ✅   |
| M3  | `taskCommentEntityToRecord` 去掉 `?? []`           | `t646-all-tables` | **1 红**（转换器边界 `TypeError`）；注：仅靠 RD 的评论端到端用例**不会**红（`resToEntity` 已归一），故本轮补了转换器边界用例，见 9.3 | `converters/task.ts` `0ec1de57…` ✅  |
| M4  | A1 去墓碑特判                                      | `t641-a1`         | **1 红**（kind 变 `pull-local-wins`）                                                                                                | `sync-service.ts` `3b6c0e69…` ✅     |

## 9.3 跨仓真形状（终验，非 mock）

服务端真 JSON 由 `go run` 直接调 `controllers.SyncController.Push` 生成（7 表各一条 `stale` + `serverCurrent`），三种空值形态齐全：

| 表              | `serverCurrent` 真实空值形态                                                         |
| --------------- | ------------------------------------------------------------------------------------ |
| tasks           | `remindWeekdays: null`、`tags: []`、`remindAt/remindRepeat/remindTime/deletedAt: ''` |
| taskCheckItems  | `deletedAt/description: ''`                                                          |
| taskComments    | **`attachments: null`**、`avatar/nickname: ''`                                       |
| projects        | `archivedAt/deactivedAt/deletedAt: ''`                                               |
| tags            | `deletedAt/description: ''`                                                          |
| pomodoros       | `archivedAt/deletedAt: ''`                                                           |
| pomodoroRecords | `deletedAt/startAt/endAt/taskId/taskName: ''`                                        |

- 新增 `t646-a2-all-tables-real-shape.test.ts`：**7 表逐一**用上述真 JSON 驱动「保留服务端」写回 ⇒ **7/7 不抛错**、落库正确、base 写回、条目清除；另含 1 条**转换器边界**用例（`attachments: null ⇒ []`，用于杀死 M3）。
- 该文件 **8/8 绿**；服务端契约测试（`TestSyncPushServerCurrent*` / `TestSyncDeletion_BaseUpdatedAtOmitempty` / `TestSyncPushDeletion_RealTimestampAndOCC`）实跑 **ok**（go1.27.3）。

## 9.4 批末全仓门禁（9 项，精确数字）

| 门禁                                                                       | 结果                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ① `pnpm exec vp check`                                                     | **rc=0**（1484 文件，0 warning / lint / type error；格式全通过）                                    |
| ② 全仓 `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vp test --run` | **rc=0** —— **366 文件（365 通过 + 1 跳过）/ 2907 例（2901 通过 + 6 跳过）/ 0 红**；耗时 210.1s     |
| ③ `guard:ddd`                                                              | rc=0                                                                                                |
| ④ `guard:gate-pathspec`                                                    | rc=0                                                                                                |
| ⑤ `guard:barrel-imports`                                                   | rc=0                                                                                                |
| ⑥ `guard:mobile-imports`                                                   | rc=0（72 源文件）                                                                                   |
| ⑦ `guard:test-location`                                                    | rc=0（358 受检 + 8 移动端白名单）                                                                   |
| ⑧ `pnpm exec vp run webapp build`                                          | **rc=0**（14.38s）                                                                                  |
| ⑨ `pnpm run desktop:build`                                                 | **rc=0**（16.14s；⚠️ 仅 electron-vite build，未产出 `electron-builder --dir` 可运行包，按派单范围） |
| 移动端红线                                                                 | `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**                      |

**基线对比（重要更正）**：派单给的批前基线 `351 文件 / 2846 例` **与当前 main 不符**。我在 `main f29e4a54` 建独立 worktree（`pnpm install --frozen-lockfile --offline`）实跑：**355 文件 / 2862 例 / 0 红**（354 通过 + 1 跳过文件；2856 通过 + 6 跳过例）。⇒ 增量按**实测 main** 计：

| 增量 | 数字                   | 拆解                                                                  |
| ---- | ---------------------- | --------------------------------------------------------------------- |
| 文件 | **+11**（355 → 366）   | `t641-*` 7 + `t644-*` 3 + `t646-*` 1（registry 为改文件，非新增）     |
| 例   | **+45**（2862 → 2907） | `t641-*` 31 + `t644-*` 5 + `t646-*` 8 + `conflict-entity-registry` +1 |
| 跳过 | 6 → 6（文件 1 → 1）    | 无变化（既有显式 skip）                                               |

## 9.5 体积 / 性能口径（同型夹具 3 次取中位）

夹具：1 清单 + 1 标签 + 5 任务；push 全量；pull 场景 = 1 条本地待推 + 远端同名行（走本地胜记账）。两个 worktree（main `f29e4a54` 与 HEAD `fbd24883`）跑同一夹具：

| 指标                                   | main（批前） | HEAD（本批） | 差值                |
| -------------------------------------- | ------------ | ------------ | ------------------- |
| `pushAll` 中位（3 次）                 | 12.531 ms    | 12.576 ms    | **+0.36%**（<5%）   |
| `pullAll`（本地胜 + 记账）中位（3 次） | 9.318 ms     | 9.667 ms     | **+3.75%**（<5%）   |
| 单次 push 载荷字节（同一夹具）         | 2360 B       | 2332 B       | **−28 B（−1.19%）** |

- 载荷下降来源 = `A6` 移出 `icon`：清单行 −`"icon":"more2"`、标签行 −`"icon":"tag"`，其余表 0 变化。
- ⚠️ 口径边界：jsdom + fake-indexeddb 夹具、各 3 次中位；`pullAll` 的 +0.35 ms 与样本内波动同量级（HEAD 样本 8.2/9.7/12.1 ms），**只能判「未超 5%」，不宜当作精确回归幅度**；未做真实浏览器/网络链路耗时对比。

## 9.6 轮次 3 残余未覆盖项

1. **服务端全量 CI / 真 MySQL 集成**未由我执行（仅跑 3 组契约测试 + 真 JSON dump；服务端集成用例属其仓 CI）。
2. **客户端 ↔ 真服务端联调**未做（用真 JSON 夹具代替；发布顺序仍以服务端先行）。
3. **性能**：仅 jsdom 夹具 3 次中位，非真实浏览器/网络；样本少（见 9.5）。
4. **UI 观感/交互**：用户走查未执行（清单已更新并就绪，见 `320-sync-a-batch-user-acceptance.md`）。
5. 移动端（红线）不覆盖。
6. `desktop:build` 未产出可运行包（`electron-builder --dir` 未跑，按派单范围）。
7. 变异 M1 在 projects/tags 上被「icon 不等于 undefined」用例捕获（而非数组展开），属用例内附带捕获；tasks 的 `null` 数组是主证据。