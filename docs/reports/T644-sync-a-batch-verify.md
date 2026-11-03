# T644 数据同步 A 批（`A1`/`A2`/`A3`/`A4`/`A6` + `AC7`/`AC9`）轮次 2 独立复验报告

- 状态：**有条件通过**（26 红逐条转绿 · 断言未被放宽 · 4 处变异均被捕获 · **新增 1 个 P1 跨仓真形状缺陷**）
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