# 340 · B 批 `683b`：M6（回滚开关 + 可观测 + 全量变异）独立复核

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)** —— **B 批最后一轮**
- M6 提交 **`b89c25c9`**（7 文件 +313）· 派单 HEAD = `b89c25c9` · 基线（M6 之前）= `0ebb5717`
- ⛔ 未改生产代码 / 未改任何既有断言（**16 路径**哈希闸通过）· 独立探针 **7 例** + **6 条变异**跑完删除 / 逐字节还原 · 结束后 `git status` 空
- 配套交付：**`docs/reports/340-user-acceptance.md`**（用户走查清单定稿）

## 0. 判据结论总表

| #   | 判据                                                                                              | 结论                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **回滚开关三态（真实链路）**：`merge → lww → merge`、读取点唯一、默认 `merge`、ADR 一致、无需重启 | ✅ 独立探针 7 例（含**同一 `SyncService` 实例**贯穿三态）· `localStorage` 直读**仅 1 处** · 非法值/大写回退 `merge` · ADR 键名/时机与实现逐条一致                                |
| 2   | **可观测**：`fieldMergeCount` + 事件（无业务值）+ `conflictFieldCounts` + 零新 UI / 零持久化字段  | ✅ 计数 +1 / 不参与运行边界 / lww 不增；事件仅 `table`+`conflicts` 计数且日志序列化**不含明文业务值**；按字段计数去重、旧条目不计；`apps/`+`shared/`+`local-database` **零改动** |
| 3   | 哈希闸（16 → 17）                                                                                 | ✅ 16/16 逐一相等 + `git diff 0ebb5717..HEAD -- <16 路径>` 空；第 17 份为本报告（哈希见回执）                                                                                    |
| 4   | 门禁：全仓 **单跑 ×2 逐字相同且 0 红** + `vp check` + 9 项                                        | ✅ **422 文件 / 3330 例 / 0 红 / 6 skip**（两轮逐字相同）· `vp check` rc=0 · 5 守卫 0 · 双端 build 0 · 移动端 0 行                                                               |
| 5   | **变异抽验 ≥5（不采信自述）**                                                                     | ✅ **6 条独立重跑**（M1a/M2a/M3a/M4a/M5a/M6）逐条 kill，`sha256` **逐字节还原 6/6**                                                                                              |
| 6   | 用户走查清单定稿                                                                                  | ✅ `docs/reports/340-user-acceptance.md`（可勾选、含前置/步骤/预期/AC/回填区，⛔ 未代勾）                                                                                        |

## 1. 判据 1：回滚开关（最重要）

### 1.1 三态切换（独立探针，**同一进程 / 同一 DB / 同一 `SyncService` 实例**）

| 阶段                                                  | 操作                                                                    | 实测                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ① `merge`（键不存在）                                 | 不同字段并发（我改 name+tags / 远端改 description+priority）⇒ `pullAll` | **0 条**记录 · `name='B-name'` · `description='A-desc'` · `priority='low'`（字段级两值/三值都在）· 队列保留         |
| ② 运行中切 `lww`（`localStorage.setItem(key,'lww')`） | 新任务：同场景改 name / 远端改 description ⇒ `pullAll`                  | **1 条 `pull-local-wins`** · `name='B2-name'` · `description='A0-desc'`（**不合并**）· 队列保留 ⇒ 与 `v1.18.2` 逐字 |
| ③ 切回 `merge`（`localStorage.removeItem(key)`）      | 新任务：同 ① 场景 ⇒ `pullAll`                                           | **记录数不增** · `name='B3-name'` · `description='A3-desc'` ⇒ **无需重启/重登即恢复合并**                           |

> 关键差异点：整个三态用的是**同一个 `SyncService` 实例**（模式按**批**读取），因此「无需重启」不是靠新建实例掩盖的。

### 1.2 `lww` 下另两条边界（逐字 `v1.18.2`）

| 边界                              | 实测                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| pull **远端胜**支（远端时间更晚） | 1 条 `remote-wins` · **整行覆盖**（我的 `name` 变回 `A0-name`）· `priority='low'` · `syncedServerUpdatedAt` 写回远端版本 · **出队** |
| push **`stale`** 支               | 1 条 `stale` · **整行不合并**（`description` 仍 `A0-desc`）· base 写回 · **出队**                                                   |

### 1.3 读取点唯一（`grep` 证据）

```text
field-merge.ts:31   FIELD_MERGE_MODE_KEY = 'nao-todo:field-merge-mode'
field-merge.ts:41   localStorage.getItem(FIELD_MERGE_MODE_KEY) === 'lww' ? 'lww' : 'merge'   ← 唯一直读
sync-service.ts:1430  const mergeMode = resolveMergeMode()    ← applyPullBatch（批级）
sync-service.ts:1668  const mergeMode = resolveMergeMode()    ← pushAllInnerLocked（批级）
```

- `localStorage` 直读**全仓仅 1 处**（`field-merge.ts:41`）；`resolveMergeMode()` 调用点 = **2 个批级入口**（无第三处）。

### 1.4 默认值与 ADR 一致性

| 项                          | 实测/核对                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 默认 `merge`                | 缺键、`'merge'`、非法值 `'foo'`、大写 `'LWW'` ⇒ 均返回 `merge`（**大小写敏感**）                                                                             |
| ADR「生产回滚操作说明」键名 | ADR 写 `localStorage['nao-todo:field-merge-mode']` = 代码常量 `FIELD_MERGE_MODE_KEY` ✅                                                                      |
| ADR 生效时机                | 写「下一次 pull / push 运行（按批读取）」= 实现（两处批级 `resolveMergeMode()`）✅                                                                           |
| ADR「无需重启 / 无需改库」  | 探针在同一实例/同一 DB 内切换生效 ✅                                                                                                                         |
| ADR 四条已知边界            | ① 关闭时**捕获仍继续**（M1 写路径不受开关影响；探针②阶段后队列项仍有 `fieldBase`）② 不回滚已合并数据 ✅ ③ 不影响 DEF-146 保存侧 ✅ ④ 面板取源不随开关变化 ✅ |

## 2. 判据 2：可观测

| 项                              | 证据                                                                                                                                           | 结论          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `fieldMergeCount` 语义          | 合并落库 ⇒ **+1**；再跑同版本（无变化）⇒ 不变；`lww` 下 ⇒ 不变                                                                                 | ✅            |
| **不参与运行边界**              | `pullAll()`（内部 `beginRun`/`endRun`）之后计数**未被清零**（同上一条的两次运行）                                                              | ✅            |
| 事件 `sync.field-merge.applied` | 载荷 `{ table:'tasks', conflicts:<number> }`；`JSON.stringify(readStructuredLog())` **不含** `B-secret-name` / `A-secret-desc`                 | ✅ 无业务值   |
| 事件字段面（观察，非缺陷）      | 实现还带 `userId`（与既有 sync 事件一致，非业务值）—— 派单卡字面写「只含 `table`/`conflicts` 计数」，如需严格可去掉 `userId`；我判断**可接受** | ⚠️ 待你一句话 |
| `conflictFieldCounts(entries)`  | `[{priority,priority,name},{priority},{},{[]}]` ⇒ `{priority:2, name:1}`（条目内去重、跨条目累加、旧条目/空不计）；真实链路同口径              | ✅            |
| `conflictCount` 口径未变        | 合并后 `syncStatus.get().conflictCount === 0`（对象数口径），未被字段计数污染                                                                  | ✅            |
| 零新 UI / 零持久化字段          | `git diff --name-only 0ebb5717..b89c25c9 -- apps packages/shared packages/infrastructure/src/persistence-local` = **空**                       | ✅            |

## 3. 判据 3：哈希闸（16 → 17）

- **① 开工时 16 路径逐一相等** ✅ + `git diff 0ebb5717..HEAD -- <16 路径>` = **空**（M6 的 7 个改动文件不含我的路径）。
- **② 新增第 17 份** = 本报告 `docs/reports/340-field-merge-m6-verify.md`（blob 哈希见回执）+ 第 18 份 `340-user-acceptance.md`（PM 要求的**新交付**，非我原有路径；哈希同样在回执给出）。

```text
34bb5b28 ac1  76fd4258 ac2  efe108ed ac3  f1bb1d3e ac4  3fc815aa ac5  5a8a1d55 ac6
77ffa022 harness  c971079b remind-group  5d938eb9 mode-lww  2ff259a0 write-point
6d61a225 red-baseline  1c491e04 m1-verify  b16534c0 m2-verify  5dfb3521 m3-verify
9ac3130d m4-verify  6802a660 m5-verify
```

## 4. 判据 4：门禁（9 项，逐项 rc）

| #   | 命令                                                                                       | rc        | 关键行                                                                                  |
| --- | ------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------- |
| ①   | `pnpm exec vp check`                                                                       | **0**     | All **1938** files correctly formatted · no warnings/lint/type errors in **1552** files |
| ②   | `pnpm exec vp test --run`（单跑 ×2，洁净前提已确认：`pgrep` 无测试进程 + `git status` 空） | **0 / 0** | **422 文件（421 绿 / 1 skip）· 3330 例（3324 绿 / 6 skip / 0 红）**，两轮**逐字相同**   |
| ③   | `pnpm run guard:ddd`                                                                       | 0         | OK                                                                                      |
| ④   | `pnpm exec vp run webapp build`                                                            | 0         | ✓ built in 13.92s                                                                       |
| ④   | `pnpm run desktop:build`                                                                   | 0         | ✓ built（renderer 333.86 kB）                                                           |
| ⑤   | `git status --porcelain -- packages/presentation-react apps/mobile`                        | —         | **0 行**                                                                                |
| ⑥   | `pnpm run guard:gate-pathspec`                                                             | 0         | OK                                                                                      |
| ⑦   | `pnpm run guard:barrel-imports`                                                            | 0         | OK                                                                                      |
| ⑧   | `pnpm run guard:mobile-imports`                                                            | 0         | OK（72 源文件）                                                                         |
| ⑨   | `pnpm run guard:test-location`                                                             | 0         | OK（414 受检测试文件）                                                                  |

## 5. 判据 5：变异抽验（**6/6 kill + 逐字节还原**）

我为每条变异**自建**改动（不复用 rd-fe 的脚本），打桩 → 跑**定向用例** → 还原 → 校验 `sha256`：

| #   | 变异（我自建）                                                     | 作用点                          | 定向用例                                   | 结果        |
| --- | ------------------------------------------------------------------ | ------------------------------- | ------------------------------------------ | ----------- |
| M1a | `captureFieldBase` 永不捕获（`if (before) return undefined`）      | `field-base.ts`                 | `t676-field-base-capture`                  | **7 红** ✅ |
| M2a | `R==B ⇒ L` 改成 `R==B ⇒ R`（四律崩塌）                             | `field-merge.ts` `decideScalar` | `t677-field-merge-core`                    | **4 红** ✅ |
| M3a | pull 两支 winner 反转（`remoteTs > localTs ? 'local' : 'remote'`） | `sync-service.ts`               | `t675-ac5-matrix`                          | **3 红** ✅ |
| M4a | push `stale` 侧 `lwwWinner: 'local'` → `'remote'`                  | `sync-service.ts`               | `t680-push-merge-integration`              | **1 红** ✅ |
| M5a | 去掉 pull 侧 journal 的 `conflictFields`                           | `sync-service.ts`               | `t675-ac5-matrix` + `t682-conflict-fields` | **5 红** ✅ |
| M6  | `resolveMergeMode()` 恒返回 `'merge'`（开关失效）                  | `field-merge.ts`                | `t675-mode-lww-verbatim`                   | **2 红** ✅ |

- 6 条全部**打桩成功 → 期望用例变红 → 还原后 `sha256` 与基线逐字节一致**；全程 `git status` 为空（临时改动未入 index、未提交）。

## 6. 判据 6：用户走查清单定稿

见 **`docs/reports/340-user-acceptance.md`**（本次新增交付）：可勾选、每项含「测什么 / 怎么操作 / 预期 / 对应 AC / 失败记录」，含前置环境（本地后端 `3302` + 前端 `localhost:5173`）、**两端造法**（无痕窗口 / 另一浏览器，各自独立 IndexedDB）、以及回填区（⛔ 未代勾）。

## 7. 遗留（三出口）

- **转办（用户走查）**：`340-user-acceptance.md` 的 A–G 组（用户勾选回报；A–E 为功能、F 为运维项、G 为观感）。
- **转办（PM 一句话）**：`sync.field-merge.applied` 是否要**去掉 `userId`**（派单卡字面「只含 `table`/`conflicts`」）；我判断可接受，不强求。
- **接受（到期日 = 发版后 2 周观测）**：`fieldMergeCount` 为内存态（刷新归零）——ADR 已声明；上线后按 PRD「冲突数按 kind/字段显著下降」观测，若 `local==server` 出现新不一致 ⇒ 置 `lww` 止血（ADR 回滚说明已就绪）。
- **无关闭项**：本轮为复核，未改库存代码、未新增缺陷条目。

## 8. 复跑

```text
git log --oneline -1                                   # 期望 b89c25c9
pgrep -af "vitest|vp test"; git status --porcelain      # 期望：无测试进程 / 干净
pnpm exec vp test --run                                 # 期望 rc=0 · 422 文件 / 3330 例 / 0 红
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t683-rollback-switch.test.ts
pnpm exec vp check && pnpm run guard:ddd && pnpm run guard:gate-pathspec && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build
```