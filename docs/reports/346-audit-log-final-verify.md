# T706 · A 档审计日志 **批末独立复验报告**（Issue #346）

- 状态：**已完成（独立复验）** · 更新：2026-11-11 · Owner：qa（`T706`）
- 分支：`feat/346-audit-log` · 基线 HEAD：**`006819ad`**（核过 `git log --oneline -1`）
- 复验姿态：**自写探针，不采信自述**（`t706-qa-*` 三个文件共 **17 例**，不复用 `t697-*` / `t675` 夹具）；
  变异**逐条实测 kill**，改前后 `sha256sum -c` 逐字节还原；⛔ 未改生产代码、⛔ 未改既有用例。
- 结论：**通过（建议放行到用户视觉走查）**，附 4 条非阻塞发现（1 条新缺口 P3、1 条变异证据补强、1 条性能风险与缓解建议、1 条文档缺口）。

## 0. 结论先行

| 项                  | 结论                                                                                                | 数字                                                                                |
| :------------------ | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| ① 假刷屏双源        | ✅ **真被挡住**，且探针**有牙**（改坏归一 / 判等即红）                                              | 自写 10 例：DEF-147 重放 · DEF-159 收集箱 · 空哨兵 · 预筛解密次数 · 真实变更混入 等 |
| ② 变异抽验          | ✅ **8 条全部 kill**（含 RD 报的「结构性不可杀」2 条 —— **实际可杀**，见 §2.3）                     | 8/8 killed；sha256 还原 8/8 OK                                                      |
| ③ M6 两处修复       | ✅ 无 IndexedDB 环境零 unhandled rejection · ✅ `desktop:build` 恢复并**打进产物**                  | 新增缺口：`countAudit` 未兜底（P3，无生产调用点）                                   |
| ④ 降级实测          | ✅ 老客户端打开 v5 库：可开 · `verno=4` · `tasks` 可读 · `auditLogs` 不可见 · 15 表 schema 逐字一致 | 独立 v4 子类等价法                                                                  |
| ⑤ 面板真挂载        | ✅ 13 键中英齐备 · 可见文本无内部词 · 非表格式 · 空态/不可用态均「暂无变更记录」                    | 自写 5 例（真挂载 `history.vue`）                                                   |
| ⑥ 全量门禁 9 项     | ✅ **全绿**                                                                                         | 见 §6（含精确数字）                                                                 |
| ⑦ 偶发卡顿（499ms） | ⚠️ **不是抖动**：是「首次大批裁切」的一次性成本；p95 达标，超限溢出量大时用户侧可能偶发卡顿         | 见 §7（含最小缓解建议）                                                             |

## 1. 假刷屏双源（本档立身之本）—— 独立探针实测

文件：`packages/infrastructure/src/persistence-sync/__tests__/t706-qa-spam-probe.test.ts`（**10 例全绿**；自建假服务端，仅模拟服务端契约）

| #   | 构造                                                                      | 断言                                                                      | 结果 |
| :-- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------ | :--- |
| P1  | 同记录被回拉窗口重放 3 轮（服务端忽略游标返回该行）                       | 每轮 `tasks.put` **≥1** 且审计 **0 条**                                   | ✅   |
| P2  | 收集箱：本地 `inbox` ↔ 服务端 `userId`，3 轮                              | 每轮 **0 条** + 本地保持 `inbox`（夹具自检：服务端确为 `userId`）         | ✅   |
| P2b | 收集箱 + 每轮只推进服务端 `updatedAt`（记录层预筛挡不住）                 | 3 轮 **0 条**                                                             | ✅   |
| P3  | **真实变更 + 空哨兵并存**（`description` 真变、`startAt` 由 `''`→`null`） | `fields` **恰为 `['description']`**                                       | ✅   |
| P4  | 本机改 3 字段                                                             | 恰 1 条 `local-edit/update`，`fields` 恰 3 元组                           | ✅   |
| P5  | `auditLogs.add` 抛错                                                      | 保存成功 + 行已落库 + `audit.record.failed`（error）+ 日志不含任务名/描述 | ✅   |
| P6  | 1000 条 + 1 次真实写                                                      | 裁到 1000、最旧被淘汰、新条在                                             | ✅   |
| P7  | **恰好 5 条（= 默认页大小）**                                             | `hasMore === false`（← 独立发现，见 §2.3）                                | ✅   |
| P8  | 未变化行重放 1 轮                                                         | 审计 0 条 **且 `cryptoService.decrypt` 调用数 = 0**（预筛存在性）         | ✅   |
| P9  | 收集箱 + 远端只改 `description`                                           | `fields` 恰 `['description']`（不混入假 `projectId`）                     | ✅   |

**探针有牙的证据（§2 变异表）**：M2/M3/M8 三条变异都只被上面**新加的** P3/P9/P8 杀掉 ——
说明「记录层预筛会先挡掉大多数噪声场景」这一点会让**只看 0 条的用例失去判别力**，
必须用「真实变更 + 空哨兵/桶映射」与「解密次数」这类更尖的判据。

## 2. 变异抽验（8 条逐条实测 kill）

方法：`sha256sum` 记录目标文件基线 → 最小单点改写 → 定向跑探针 → `git checkout HEAD -- <file>` 还原 →
`sha256sum -c` 逐字节校验。**8/8 还原成功**（`task-repo-impl.ts` / `audit-log.ts` / `sync-service.ts` 三文件）。

| #   | 变异（改法）                                            | 目标文件 · 符号                              | 靶例          | 结果                                                    |
| :-- | :------------------------------------------------------ | :------------------------------------------- | :------------ | :------------------------------------------------------ |
| M1  | 摘掉本机编辑审计接线（`if (true) return`）              | `task-repo-impl.ts` · `recordLocalEditAudit` | P4            | ✅ **killed**（1 failed）                               |
| M2  | `!==` 替 `valuesEqual`（丢空哨兵归一）                  | `audit-log.ts` · `diffAuditFields`           | P3            | ✅ **killed**（首版 P3 只测纯哨兵 ⇒ **未杀**，见 §2.2） |
| M3  | 删掉实体层收集箱归一（`toLocalProjectId`）              | `sync-service.ts` · `auditPulledRecord`      | P9            | ✅ **killed**（RD 报「结构性不可杀」⇒ **实际可杀**）    |
| M4  | `recordAudit` 前置 `throw` 且不 catch                   | `audit-log.ts` · `recordAudit` 顶部          | P5            | ✅ **killed**                                           |
| M5  | 去淘汰（`pruneAuditLog` 恒 `return 0`）                 | `audit-log.ts` · `pruneAuditLog`             | P6            | ✅ **killed**（5.3s 超时后红）                          |
| M6  | 表不可用用空数组冒充（`unavailable:false`）             | `audit-log.ts` · `loadAudit`                 | `t697-ac5` N1 | ✅ **killed**                                           |
| M7  | `hasMore: window.length > limit` → `>=`                 | `audit-log.ts` · `loadAudit`                 | P7（新增）    | ✅ **killed**（原用例面**有洞**）                       |
| M8  | 删掉记录层预筛（`pickChangedFields(...)===0 ⇒ return`） | `sync-service.ts` · `auditPulledRecord`      | P8（新增）    | ✅ **killed**（其余 9 例全绿 ⇒ 只有解密次数能抓）       |

### 2.1 说明：M6 的 11 条清单未落档

仓库内**没有 M6 的变异报告文件**（`docs/reports/` 只有 `346-audit-log-red-baseline.md` 与
`346-audit-log-user-accceptance.md`），11 条清单仅存在于派单转述 ⇒ **无法逐条对照**。
本报告用 8 条**独立自选**变异覆盖同一变异面（摘接线 / 判等 / 归一 / 前置抛错 / 去淘汰 / 不可用冒充 / 分页边界 / 预筛）。

### 2.2 关于「2 条结构性不可杀」——**两条都能杀**

我按最可能的两条「结构性」候选逐一实测，**结论都是「可杀」**，原因是原断言面存在**盲区**：

| 候选结构性变异                      | 为什么原用例杀不掉                                                                                                           | 我新增的 kill 判据                                                                                           |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| 删**实体层收集箱归一**（M3）        | 记录层预筛会先挡掉「记录完全一致」的重放场景；只有「**记录真有差异**」时才会走到实体层 ⇒ 原用例全是 0 条场景，且都由预筛兜住 | **P9**：收集箱 + 远端**真改一个字段** ⇒ 断言 `fields` **恰为 `['description']`**（未归一会多出 `projectId`） |
| 删**记录层预筛**（M8）              | 删掉后实体层精筛仍会算出 0 条差异 ⇒ 所有「0 条」用例照旧全绿（行为等价，只损失性能）                                         | **P8**：未变化行重放 1 轮，断言 `cryptoService.decrypt` **调用数 = 0**（预筛存在性的唯一可观测面）           |
| （同类）`hasMore` 的 `>`→`>=`（M7） | 原分页用例只有 7 条（第二页 2 条 < limit）⇒ 边界不可见                                                                       | **P7**：**恰好 5 条** ⇒ `hasMore === false`                                                                  |

> ⇒ **判定**：这两条不是「结构性不可杀」，而是**断言有洞**。洞已由 `t706-qa-spam-probe` 的 P3/P7/P8/P9 补上
> （新增 4 个判据，均已在变异下验证过判别力）。这不是缺陷，但**建议 M6 的「不可杀」结论在文档里更正**。

## 3. M6 两处修复复核

### 3.1 无 IndexedDB 环境零 unhandled rejection（自建环境，⛔ 不看代码推定）

文件：`…/__tests__/t706-qa-no-idb-probe.test.ts`（`// @vitest-environment node`，**不加载** `fake-indexeddb`）

- 前置自检：`globalThis.indexedDB === undefined` ✅
- 触发启动同姿势 `void pruneAuditLog(uid)`（无人 await ⇒ 一 reject 即 unhandled）
- 结果：`pruneAuditLog` → **0**、`recordAudit` → **null**、`loadAudit` → `{items:[],hasMore:false,unavailable:true}`，
  700ms 防抖窗口内 `unhandledRejection` **0 次** ✅

**⚠️ 新发现（非阻塞，P3）：`countAudit` 未兜底。** 同一环境下 `countAudit(uid)` **reject**（`MissingAPIError`），
因为只有它没有 try/catch（`recordAudit` / `loadAudit` / `pruneAuditLog` 三处都有）。
现状**无生产调用点**（`grep` 全仓仅导出），故不构成用户可见问题 ⇒ 已用 `it.fails` 锁现状（修复后该用例会失败，届时改回普通 `it`）。
最小修复建议（一行级）：把 `countAudit` 的 `.count()` 包进 `try/catch` 或先判 `isAuditTableAvailable()` 且 `typeof indexedDB !== 'undefined'`。

### 3.2 桌面端 `hooks/index.ts` 导出 → `desktop:build` 恢复

- `pnpm run desktop:build` → **rc=0**（21.84s）✅
- **进一步验证「真的接上了」**（不只看构建通过）：产物里可检索到面板文案
  （`apps/desktop/out/renderer/assets/index-bQd4oyy7.js` 含「变更历史」/「暂无变更记录」）✅
- `webapp build` → rc=0（18.16s）；web 产物含同一文案（`apps/web/dist/js/locales.NPT7zI88.js`）✅

## 4. 降级实测（自己的 v4 子类等价法复跑）

`pnpm exec vp test --run …/t697-ac5-migration.test.ts` → **6 例全绿**，其中降级用例断言：

| 断言                 | 实测                                           |
| :------------------- | :--------------------------------------------- |
| v5 打开后 `verno`    | **5**（`auditLogs` 存在且空）                  |
| close 后 v4 子类再开 | 可开（不抛错）                                 |
| 降级后 `verno`       | **4**（如实回报，不伪装 5）                    |
| `tasks` 可读         | ✅ 3/3 行逐字段一致                            |
| `auditLogs` 可见性   | **不可见**（`tables` 不含）                    |
| 15 表 schema         | 与升级前**逐字一致**（`primKey` + 索引名集合） |

> 旁证：`dexie@4.4.5` 的「低版本打开高版本库」静默适配成立 ⇒ ADR §后果-风险 2 的处置（降级不是硬故障）**实测成立**。

## 5. 面板真挂载复核（⛔ 无 stub）

文件：`packages/presentation/task/components/task-details/main/__tests__/t706-qa-history-panel-probe.test.ts`（5 例全绿）

| #   | 判据                                                                                                                                                                         | 结果                                                          |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| 5.1 | 13 个 `history.*` 键 **中英齐备**、值非空且 ≠ 键名、键集一致、总数 ≤13                                                                                                       | ✅                                                            |
| 5.2 | 展开后：标题/字段中文标签（`sync.conflict.field.*`）/ 旧值→新值 / 来源中文（本机修改·同步自云端）                                                                            | ✅                                                            |
| 5.3 | **可见文本**无内部词：`source` / `action` / `field` / `seq` / `plain:` / `local-edit` / `push-merge` / `conflict-retry` / `fieldBase` / `revision` / `syncedServerUpdatedAt` | ✅（判据用 `text()`；类名含 `__source` 等属实现细节，不误判） |
| 5.4 | 非表格式：无 `<table>` / `nue-table`                                                                                                                                         | ✅                                                            |
| 5.5 | `unavailable:true` ⇒ 「暂无变更记录」，**不**显示「加载失败」                                                                                                                | ✅                                                            |
| 5.6 | 可用但 0 条 ⇒ 同样「暂无变更记录」，**不**显示「加载失败」                                                                                                                   | ✅                                                            |
| 5.7 | `hasMore` ⇒ 出现「更早」入口；点击以**最旧一条 `seq`** 作 keyset 续页（不用 offset），续页后入口消失                                                                         | ✅                                                            |

**jsdom 能力边界（交用户走查，已列 `346-audit-log-user-acceptance.md`）**：默认折叠的实际可见高度、
条目 ≥40px 的**实测像素**、三态颜色对比度、深浅色观感 —— jsdom 无布局引擎，无法量取。
（另注：`nue-collapse` 的折叠是 CSS（`max-height`）实现，内容始终在 DOM ⇒ 文本级断言不受折叠影响，
但「默认折叠」本身**未**被自动化证明。）

## 6. 全量门禁 9 项（洁净前提：无并发测试进程 · 工作区仅本档 3 个新增探针）

| #   | 门禁                 | 命令                                                                | 结果                                                                                                       |
| :-- | :------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| 1   | 格式 + lint + 类型   | `pnpm exec vp check`                                                | **rc=0**（1973 文件格式 OK · 1575 文件 lint+type **0 error**）                                             |
| 2   | 全仓测试             | `pnpm exec vp test --run`                                           | **440 文件（439 passed / 1 skipped）· 3439 例（3432 passed / 1 expected-fail / 6 skipped）· 红 0**（296s） |
| 3   | 领域隔离             | `pnpm run guard:ddd`                                                | rc=0                                                                                                       |
| 4   | 导入面可解析         | `pnpm run guard:barrel-imports`                                     | rc=0                                                                                                       |
| 5   | 移动端导入红线       | `pnpm run guard:mobile-imports`                                     | rc=0                                                                                                       |
| 6   | 测试文件位置         | `pnpm run guard:test-location`                                      | rc=0                                                                                                       |
| 7   | 门禁 pathspec 存在性 | `pnpm run guard:gate-pathspec`                                      | rc=0                                                                                                       |
| 8   | 双端构建             | `pnpm exec vp run webapp build` / `pnpm run desktop:build`          | **rc=0 / rc=0**（18.16s / 21.84s）                                                                         |
| 9   | 移动端 0 行          | `git status --porcelain -- packages/presentation-react apps/mobile` | **0 行**                                                                                                   |

> `1 expected-fail` = 我在 §3.1 登记的新缺口（`countAudit`）。

### 6.1 `AC9` 既有用例改动复核（2 处定向豁免）

`8e6d77bf` 改了两个既有测试文件，**两处都在 PM 已批的豁免面内**，且**断言未动**：

| 文件                                                                   | 改动                                                              | 判定                                                                              |
| :--------------------------------------------------------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `apps/web/src/components/sync/__tests__/conflict-field-labels.test.ts` | 仅 import 路径改为 `@nao-todo/shared/utils/conflict-field-labels` | ✅ 与豁免一致（逐字断言未变）                                                     |
| `apps/web/src/components/sync/__tests__/conflict-ux.test.ts`           | 死键守护的扫描面 `glob` **+1 个文件**（下沉后的唯一真源）         | ✅ 必要连带：不扩面则守护对下沉文件**静默失明**（假绿）；判据仍为「死键集合为空」 |

## 7. ⚠️ 499ms 偶发样本：是抖动还是真卡顿？

**结论：不是随机抖动，是「首次大批裁切」的一次性成本；典型溢出（<100 行）用户侧无感，溢出量大时可能偶发卡顿一次。**

实测（fake-indexeddb + jsdom，300 次样本，已剔除前 10 次预热；量测脚本为临时文件，**未入库**）：

| 场景                                         |     p50 |     p95 |     p99 |                max | 备注                                |
| :------------------------------------------- | ------: | ------: | ------: | -----------------: | :---------------------------------- |
| `task.update()`（0 条历史）                  | 1.53 ms | 2.19 ms | 3.88 ms |           11.16 ms | —                                   |
| `task.update()`（1000 条，**首次**调用）     |       — |       — |       — |         **823 ms** | 与首次裁切重叠                      |
| `task.update()`（1000 条，**先排空裁切后**） | 1.53 ms | 2.06 ms | 4.06 ms |        **8.21 ms** | 首5次 823→2.2 ms ⇒ 差异全部来自裁切 |
| `recordAudit`（1000+ 条）                    | 0.56 ms | 0.86 ms |  6.5 ms |    895 ms（1/300） | 与裁切事务并发的个别写被拖慢        |
| `pruneAuditLog`（频繁调用）                  |   ~2 ms |       — |       — | **845 ms（首次）** | 首次要真删；之后无可删 ⇒ 2ms        |

裁切成本随**溢出量**线性放大（fake-indexeddb；真实 IDB 通常快一个量级）：

| 溢出（删多少条）     |    100 |    300 |    1000 |     2000 |
| :------------------- | -----: | -----: | ------: | -------: |
| `pruneAuditLog` 耗时 | 269 ms | 785 ms | 3727 ms | 10456 ms |

**判读**：`pruneAuditLogInner` 对时间界与条数界各做**一次** `bulkDelete(全部键)`（单事务 N 个请求）；
`schedulePrune` 是 500ms 防抖 + 不 await（保存路径只多一次 `set`），所以**常态无感**；
风险只在「一次删很多」的那一次 —— 触发场景 = ① 首次全量镜像后一次性写入大量云端变更（回填）；
② 长期未用的账号首次启动（90 天界一次清掉大批）。⇒ p95 达标，但 **p99/max 可能被用户感知一次**。

**最小缓解建议（⛔ 本档未改代码，供 M7 决定）**：

1. `bulkDelete` **分块**（≤200 键/事务，块间 `await` 让出主线程）—— 单事务时长从「O(溢出量)」变「每块常数」，改动约 10 行；
2. 触发时机用 `requestIdleCallback({timeout: 2000})`（`setTimeout` 兜底）替代固定 500ms，避开用户正在输入/保存；
3. 每次裁切设**删除上限**（如 400 条/次，剩余留给下次），天然限幅；
4. 观测面已有 `audit.entry.evicted(count)`，建议加一项「裁切耗时 p99」（仅 dev/观测，不进 CI）。

## 8. 遗留（三出口）

| #   | 项                                                                                              | 出口                                                                        | Owner / 时点                                     |
| :-- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- | :----------------------------------------------- |
| 1   | `countAudit` 在无 IndexedDB 环境未兜底（P3，当前无生产调用点；`it.fails` 已锁）                 | **转办**（一行级修复）                                                      | rd-fe → M7（或随下次触碰 `audit-log.ts` 时带上） |
| 2   | 裁切大批删除的一次性卡顿风险（§7）                                                              | **转办**（分块 / idle 调度 / 限幅，三选一）                                 | rd-fe → M7；在此之前**接受并观测**               |
| 3   | M6 的 11 条变异清单**未落档**（`docs/reports/` 无文件），「2 条结构性不可杀」结论与本次复验不符 | **转办**（补落档 + 更正结论）                                               | PM/rd → 本批收口                                 |
| 4   | 视觉/观感项（默认折叠可见性、≥40px、对比度、深浅色）                                            | **用户走查**（清单 `docs/reports/346-audit-log-user-acceptance.md` V1–V10） | 用户                                             |
| 5   | 移动端（`presentation-react` / `apps/mobile`）                                                  | **关闭**：diff = 0 行（本次实测）                                           | —                                                |

## 9. 复现

```bash
# 独立探针（17 例）
pnpm exec vp test --run \
  packages/infrastructure/src/persistence-sync/__tests__/t706-qa-spam-probe.test.ts \
  packages/infrastructure/src/persistence-sync/__tests__/t706-qa-no-idb-probe.test.ts \
  packages/presentation/task/components/task-details/main/__tests__/t706-qa-history-panel-probe.test.ts

# 降级实测（自己的 v4 子类等价法）
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t697-ac5-migration.test.ts

# 全量门禁（9 项）
pnpm exec vp check && pnpm exec vp test --run
pnpm run guard:ddd && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports \
  && pnpm run guard:test-location && pnpm run guard:gate-pathspec
pnpm exec vp run webapp build && pnpm run desktop:build
git status --porcelain -- packages/presentation-react apps/mobile   # 必须 0 行

# 变异手法（示例，改 → 跑 → 还原 → 逐字节核对）
sha256sum packages/infrastructure/src/persistence-sync/audit-log.ts > /tmp/mut.sha
#   …最小单点改写…
pnpm exec vp test --run <靶例文件> -t "<靶例名>"
git checkout HEAD -- packages/infrastructure/src/persistence-sync/audit-log.ts
sha256sum -c /tmp/mut.sha
```