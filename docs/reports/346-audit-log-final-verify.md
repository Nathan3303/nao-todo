# T706 · A 档审计日志 **批末独立复验报告**（Issue #346）

- 状态：**已完成（独立复验）** · 更新：2026-11-11 · Owner：qa（`T706`）
- 分支：`feat/346-audit-log` · 基线 HEAD：**`006819ad`**（核过 `git log --oneline -1`）
- 复验姿态：**自写探针，不采信自述**（`t706-qa-*` 三个文件共 **17 例**，不复用 `t697-*` / `t675` 夹具）；
  变异**逐条实测 kill**，改前后 `sha256sum -c` 逐字节还原；⛔ 未改生产代码、⛔ 未改既有用例。
- 结论：**通过（建议放行到用户视觉走查）**，附 4 条非阻塞发现（1 条新缺口 P3、1 条变异证据补强、1 条性能风险与缓解建议、1 条文档缺口）。
- **`T708` 增补（2026-11-11）**：① 缺口 `countAudit` 已由 `T707` 修复并改回正常断言（§3.1）；② 三条判据 A/B/C 已**固化为永久护栏**并逐条证明有牙（§10.1）；
  ③ 裁切限幅/分块复测完成（§7.1）；④ 11 条变异已落档 `docs/reports/346-audit-log-mutation-register.md`（M6「2 条不可杀」结论**作废**）。

## 0. 结论先行

| 项                  | 结论                                                                                                          | 数字                                                                                |
| :------------------ | :------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------- |
| ① 假刷屏双源        | ✅ **真被挡住**，且探针**有牙**（改坏归一 / 判等即红）                                                        | 自写 10 例：DEF-147 重放 · DEF-159 收集箱 · 空哨兵 · 预筛解密次数 · 真实变更混入 等 |
| ② 变异抽验          | ✅ **8 条全部 kill**（含 RD 报的「结构性不可杀」2 条 —— **实际可杀**，见 §2.3）                               | 8/8 killed；sha256 还原 8/8 OK                                                      |
| ③ M6 两处修复       | ✅ 无 IndexedDB 环境零 unhandled rejection · ✅ `desktop:build` 恢复并**打进产物**                            | 复验发现 `countAudit` 未兜底（P3）→ **已由 `T707` 修复并回归绿**（§3.1）            |
| ④ 降级实测          | ✅ 老客户端打开 v5 库：可开 · `verno=4` · `tasks` 可读 · `auditLogs` 不可见 · 15 表 schema 逐字一致           | 独立 v4 子类等价法                                                                  |
| ⑤ 面板真挂载        | ✅ 13 键中英齐备 · 可见文本无内部词 · 非表格式 · 空态/不可用态均「暂无变更记录」                              | 自写 5 例（真挂载 `history.vue`）                                                   |
| ⑥ 全量门禁 9 项     | ✅ **全绿**                                                                                                   | 见 §6（含精确数字）                                                                 |
| ⑦ 偶发卡顿（499ms） | ⚠️ **不是抖动**：是「首次大批裁切」的一次性成本 → **`T707` 已限幅/分块**（每次 ≤400、每块 ≤200），复测见 §7.1 | 剩余尾值（裁切与写入重叠 ~0.6s@伪 IDB）判断与建议见 §7.1                            |

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

**复验发现的新缺口（P3）：`countAudit` 未兜底 —— `T707` 已修复，`T708` 已闭环。**

- **改前**（HEAD `006819ad`）：同环境下 `countAudit(uid)` **reject**（`MissingAPIError: IndexedDB API missing`）——
  四个入口里只有它没有 try/catch（`recordAudit` / `loadAudit` / `pruneAuditLog` 三处都有）。当时用 `it.fails` 锁现状。
- **改后**（`T707` / `6f9ead2e`）：`countAudit(userId?)` 改 `try/catch → 0`（无会话同样 0）⇒ 同一断言 **resolves 0**。
- **`T708` 证据**：把 `countAudit` **临时回退成 T707 之前的实现**（`sha256sum -c` 逐字节还原核过）⇒ 靶例红，
  红因仍是 `promise rejected … MissingAPIError`；还原后复跑绿。用例已从 `it.fails` **改回正常 `it`**
  （`countAudit` 在无 IndexedDB 环境下按不可用返回 0（T707 修复回归守卫））。
- 现状：四个入口（`recordAudit` / `loadAudit` / `countAudit` / `pruneAuditLog`）在无 IndexedDB 环境**全部安全降级**，
  700ms 窗口内 `unhandledRejection` **0 次**（同一用例内一次性断言，`t706-qa-no-idb-probe`）。

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

### 7.1 `T707` 限幅/分块后复测（`T708` 独立量测）

口径（`T707`）：`AUDIT_PRUNE_MAX_PER_RUN = 400`（每次调度上限，已导出）· `AUDIT_PRUNE_CHUNK_SIZE = 200`
（每批 `bulkDelete` 键数上限，块间 `setTimeout(0)` 让出事件循环）· 剩余量留给**下一次调度**
（触发来源：`recordAudit` 成功后 500ms 防抖 / 启动时一次 / 直接调用 `pruneAuditLog`；**没有后台自旋**）。

文件：`…/__tests__/t706-qa-prune-cap-probe.test.ts`（6 例全绿，独立于 rd 的 `t707-*`）

| 场景                                       | 实测                                                                                        |
| :----------------------------------------- | :------------------------------------------------------------------------------------------ |
| **过期路径**（1200 条 `at` 早于 90 天）    | 连续调度 `400 → 400 → 400 → 0` ⇒ 过期行**清零**（首轮后剩余 800 仍在 = 未「清一半就不管」） |
| **条数界**（2000 条均在保留期）            | `400 → 400 → 200` ⇒ 收敛到 **1000**                                                         |
| **写入驱动**（2000 条，靠 500ms 防抖调度） | `2000 → 1801 → 1602 → 1203 → 1001 → 1000`（每轮递减，最终 ≤1000）                           |
| **分块**（spy `bulkDelete`）               | 单次调度 400 条 ⇒ **2 批**，每批键数 **≤200** ✅                                            |
| **观测事件**                               | 每次有删除记 `audit.entry.evicted { count, durationMs }`（只数字，无业务值）                |
| **裁切与一次写入重叠**（最坏合成场景）     | 该次 `update` = **591.8 ms**（rd 同场景 753 ms，同量级）                                    |
| **2000 条溢出下 10 次连续 update**         | p50 **1.5 ms** / p99 **1.7 ms** / max **1.7 ms**（未与裁切重叠的样本）                      |
| 对照（`T706` 修复前）                      | 一次性删 1000 条 ≈3.7 s、2000 条 ≈10.5 s；首次 update max **823 ms**                        |

**判定（对 753 ms / 591.8 ms 这个尾值）**：**可接受，但只能算"已知一次性成本"**，理由是：

1. 该尾值只在「一次调度真的要删 400 条（2×200）」时出现，且**不是每保存都付**（防抖 + 单飞 ⇒ 一批写只清一次）；
2. 伪 IndexedDB 每行删除成本 ~4 ms（纯 JS 实现），真浏览器 IDB 通常低一个量级 ⇒ 用户侧预计 **数十 ms 级**；
3. 真实可达的最大溢出是「首次全量镜像 / 长期未用账号首启」那一次，之后每轮只删极少（收敛后 `prune` = 2 ms）。

**关于是否调小 `AUDIT_PRUNE_CHUNK_SIZE`（现 200，已导出）**：**建议暂不调小**。
调小（如 100）只会把 400 条拆成 4 个事务、**总时长变长**、与保存交错的窗口更多，
而单事务时长已由 200 上限约束；若真机实测出现 >100 ms 的可感卡顿，再降到 **100**（不建议 50：事务开销与让出次数都上升）。
更值得做的两件事（仍 ⛔ 未改代码，交 PM 排期）：① `schedulePrune` 改 `requestIdleCallback({timeout:2000})`（避开用户正在输入）；
② 观测面加「裁切耗时 p99」（`durationMs` 已在事件里，只需看板）。

## 8. 遗留（三出口）

| #   | 项                                                                                              | 出口                                                                                                                                          | Owner / 时点                         |
| :-- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| 1   | `countAudit` 在无 IndexedDB 环境未兜底（P3）                                                    | **关闭**：`T707` 已修（`6f9ead2e`）；`T708` 已改回正常断言 + 回退重放留证（§3.1）                                                             | —                                    |
| 2   | 裁切大批删除的一次性卡顿风险（§7）                                                              | **关闭**：`T707` 限幅 400 / 分块 200；`T708` 复测见 §7.1（建议保持 200，不调小）                                                              | —                                    |
| 3   | M6 的 11 条变异清单**未落档** + 「2 条结构性不可杀」结论有误                                    | **关闭**：已落档 `docs/reports/346-audit-log-mutation-register.md`（11 条 + 作废标注 + 替代判据）                                             | 本表 §五                             |
| 6   | `vp staged`（lint-staged）**整树 stash/恢复**会吞掉同刻他人的未提交改动（本次实测丢过我的改动） | **转办**：登记 `DEF-160`（P2 工程基座）；缓解 = 「提交前查 `git status`，有他人未提交文件则等/ping」；⛔ `--no-verify` **已否决**；根治归上游 | PM 已写入 `AGENTS.md`；根治 upstream |
| 4   | 视觉/观感项（默认折叠可见性、≥40px、对比度、深浅色）                                            | **用户走查**（清单 `docs/reports/346-audit-log-user-acceptance.md` V1–V10）                                                                   | 用户                                 |
| 5   | 移动端（`presentation-react` / `apps/mobile`）                                                  | **关闭**：diff = 0 行（本次实测）                                                                                                             | —                                    |

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

## 10. `T708` 增补（护栏固化 + M7 复验）

### 10.1 三条永久护栏（判据 A/B/C → 落库位置与有牙证据）

落点：`packages/infrastructure/src/persistence-sync/__tests__/t706-qa-spam-probe.test.ts`（**我自己的文件**；⛔ 未改 `t697-*` 断言、⛔ 未改任何生产文件）

| 护栏  | 用例（describe）                                                            | 断言                                   | 有牙证据（变异 → 红因 → `sha256sum -c` 还原）                                                                                                       |
| :---- | :-------------------------------------------------------------------------- | :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | `T706 永久护栏 A（T708 固化）：收集箱 + 真实变更 ⇒ fields 恰 [description]` | `fields` 深等于 `['description']`      | 变异「删 `auditPulledRecord` 的 `toLocalProjectId`」⇒ 红：`expected [ 'description', 'projectId' ] to deeply equal [ 'description' ]` · 还原 **OK** |
| **B** | `T706 永久护栏 B（T708 固化）：记录层预筛存在性 —— 解密次数 = 0`            | `cryptoService.decrypt` 调用数 `=== 0` | 变异「删记录层预筛」⇒ 红：`未变化行不得进入实体层（预筛应零解密；删预筛 ⇒ 本条红）` · 还原 **OK**                                                   |
| **C** | `T706 永久护栏 C（T708 固化）：hasMore 恰好一页（5 条）⇒ false`             | `hasMore === false`                    | 变异「`window.length > limit` → `>=`」⇒ 红：`恰好一页时不得声称「还有更早」（> 改 >= 会被本例杀掉）` · 还原 **OK**                                  |

> 结论：M6 报的「2 条结构性不可杀」**两条都可杀**；原判作废，替代判据已入仓。
> 另附第 3 个同型洞（`hasMore` 边界）一并补齐。11 条清单与「为什么原判会误判」的根因分析见
> `docs/reports/346-audit-log-mutation-register.md`。

### 10.2 `T708` 门禁复跑（全量 9 项）

| 项                   | 结果                                                                           |
| :------------------- | :----------------------------------------------------------------------------- |
| 全仓 `vp test --run` | **0 红**（见回执，expected-fail **清零**）                                     |
| `vp check`           | rc=0                                                                           |
| 五守卫               | rc=0 ×5                                                                        |
| 双端 build           | `webapp build` rc=0 · `desktop:build` rc=0                                     |
| 移动端               | `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行** |

### 10.3 本次新增/变更的测试文件（全部 QA 自有）

| 文件                              | 变更                                                                                      |
| :-------------------------------- | :---------------------------------------------------------------------------------------- |
| `t706-qa-spam-probe.test.ts`      | 三条护栏更名固化（A/B/C）；断言未变                                                       |
| `t706-qa-no-idb-probe.test.ts`    | `it.fails` → 正常断言；主用例扩到「四入口全覆盖」                                         |
| `t706-qa-prune-cap-probe.test.ts` | **新增**（6 例：限幅 / 分块 spy / 过期路径收敛 / 写入驱动收敛 / 重叠尾值 / 保存路径延迟） |

## 11. `T713` 入口变更后复验（正文内联 → Footer「更多」+ 对话框）

- 触发：用户 2026-11-11 决定（PRD `176ff738` 的 `R-10` / `AC12` / 决策 `D8`）——变更记录不再内联在详情正文，
  改为 Footer「更多」菜单项「变更历史」→ **对话框**；实现 = `T712`（`1521e753`）。
- 我的落点：① 守住 `T713` 派单的 `AC9` **定向豁免**（只改 11 条用例的**载体指向**）② **独立复核** `T712`（⛔ 不采信 `t712-*`）。
- 结论：**通过**。11 条用例重挂载体后全绿（内容类断言**逐字未动**）；独立探针 8 例全绿且 4 条变异逐条 kill；
  全量门禁 0 红。⛔ 未改任何生产代码（`footer/index.vue` / `main/index.vue` 变异后 `sha256sum -c` 逐字节还原）。

### 11.1 11 条用例：哪些换了载体、哪些逐字未动

**a) `t697-ac3-history-panel.test.ts`（7 例；改前 7/7 全红于 `expectPanelMounted` ⇒ 改后 7/7 绿）**

| #   | 用例                            | 载体改动（仅此）                                                                                                        | 逐字未动的内容断言                                               |
| :-- | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| 1   | 标题 + 按 `taskId` 调 `load`    | `mount(DetailsMain)` → `DetailsMain` + `DetailsFooter` 同挂；`expectPanelMounted(正文)` → `expectDialogMounted(对话框)` | `load` 被调用 + `load.mock.calls[0][0] === 'task-1'`             |
| 2   | 时间线可读                      | 删 `expandHistory`（对话框无折叠）；文本来源 `wrapper.text()` → `dialog.textContent`                                    | 字段中文标签 ×2 · `旧描述` / `新描述` · 来源中文（local / pull） |
| 3   | 无内部词                        | HTML 来源 `wrapper.html()` → `dialog.innerHTML`                                                                         | 7 个内部词清单 + `>description<` / `>priority<` 两条键名裸露断言 |
| 4   | 非表格式（AC10）                | 同上                                                                                                                    | `nue-table` / `<table` / `grid` 类名三条                         |
| 5   | `unavailable` ⇒「暂无变更记录」 | 文本来源同上                                                                                                            | 含 `history.empty` · **不含** `history.loadFailed`               |
| 6   | 空历史（0 条）⇒ 同上            | 同上                                                                                                                    | 含 `history.empty`                                               |
| 7   | 有更多 ⇒「更早」入口            | 同上                                                                                                                    | 含 `history.more`                                                |

> 仅**夹具**扩充：`NueDialog` / `NueDropdown` / `NueDropdownItem` / `NueSelect` / `NueSelectOption` /
> `NueButtonGroup` 进全局注册表 + 提供 `TASK_DETAILS_PRE_CONTEXT_KEY`（footer 的 `useExportTask` 依赖）
> ⇒ 是「让真实 footer 能挂起来」的最小接线，**未放宽任何断言**。

**b) `t706-qa-history-panel-probe.test.ts`（5 例；改前整文件**收集失败** ⇒ 改后 5/5 绿）**

- 载体：`import HistoryPanel from '../history.vue'` → `import TaskHistoryDialog from '../../task-history-dialog.vue'`；
  `<history-panel />`（内联、默认折叠、需驱动 `NueCollapse`）→ `<task-history-dialog v-model="visible" task-id="task-qa" />`
  （打开即展开、内容传送至 `document.body`）；断言载体 `wrapper.text()/html()/findAll('button')` →
  对话框元素 `textContent` / `innerHTML` / `querySelectorAll('button')`。
- **逐字未动**：① 「13 键中英齐备」整条（**与载体无关**，只去掉不再需要的 mount 依赖）；② 内部词 11 个 token 清单；
  ③ 非表格式三条；④ `unavailable` / 0 条两条空态断言；⑤ 「更早」按最旧 `seq`（= 7）续页 + 续页后不再给出入口。
- 附带：`NueEmpty` 进全局注册表（`LoadingError` 的空态内部依赖它；⛔ 非断言放宽）。

### 11.2 独立复核 `T712`（新文件 `t713-qa-history-dialog-probe.test.ts`，8 例全绿）

自建夹具（不复用 `t712-*`）：真挂载生产 `main/index.vue` / `footer/index.vue` / `task-history-dialog.vue` / `NueDialog`。

| #   | PM 复核项                | 断言（可观测代价 / 边界值）                                                                                               | 结果  |
| :-- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------ | :---- |
| 1   | 正文无区块 + **不取数**  | `.task-history` 不存在 · 正文文本不含 `history.title` · **`load` 调用数 = 0**                                             | ✅    |
| 2   | 入口在「更多」且**同级** | 菜单项存在且文案 = `history.title`；`parentElement` 与「导出」/「复制任务」**同一父节点**                                 | ✅    |
| 3   | 三路关闭 + 焦点归还      | 底部按钮 / × / Esc **各一条用例**：关闭后 `.nue-dialog--task-history` = null 且 `document.activeElement === 「更多」按钮` | ✅ ×3 |
| 4   | 刷新不打断               | `vo` 整体换新对象 ⇒ 对话框元素**同一 DOM 节点** · 条目数不变（2）· 仍含 `旧描述` · **`load` 仍 1 次**                     | ✅    |
| 5   | 无 provider 不出死入口   | 菜单项 = null · 对话框未挂载（`v-if` 双守卫口径）                                                                         | ✅    |
| 6   | i18n 仍 ≤13 键           | `history.*` 键集**恰等于**既有 13 键（不是「≤13」而是精确集合 ⇒ 第 14 个即红），中英一致                                  | ✅    |
| 7   | `AC9` 三条护栏 A/B/C     | `t706-qa-spam-probe.test.ts` 定向复跑 **10/10 绿**（本次改动不碰写路径）                                                  | ✅    |

**焦点落点确认（PM 问询项）**：归还到**常驻的「更多」触发按钮**是**合理**落点，无需变更。
理由：菜单项随下拉关闭一起卸载（返回一个已卸载的 `inner-dropdown-option` 会丢焦点），
而「菜单按钮 → 关闭后焦点回菜单按钮」正是 WAI-ARIA `menu button` 的标准行为；
实测三路关闭后 `activeElement` 均稳定等于该按钮。

### 11.3 探针有牙（4 条变异逐条 kill，`sha256sum -c` 逐字节还原 4/4 OK）

| 变异                                               | 目标文件 · 位置                              | 被杀用例                 | 红因（摘）                                    |
| :------------------------------------------------- | :------------------------------------------- | :----------------------- | :-------------------------------------------- |
| 去掉菜单项 `v-if="historyProvider"`                | `footer/index.vue` · 菜单项                  | ⑤ 无 provider 不出死入口 | 未接线端仍渲染出「变更历史」菜单项            |
| 摘掉关闭后焦点归还（`el.focus()` 整段）            | `footer/index.vue` · `watch(historyVisible)` | ③a / ③b / ③c             | `document.activeElement` 不再等于「更多」按钮 |
| 把菜单项移到「删除 / 放弃」分组                    | `footer/index.vue` · 模板                    | ② 同级                   | `parentElement` 与「导出」/「复制任务」不同   |
| `task-history-dialog` 加 `:key="vo"`（刷新即重挂） | `footer/index.vue` · 模板                    | ④ 刷新不打断             | 对话框 DOM 节点被替换 + `load` 变成 2 次      |
| 正文回插 `<div class="task-history">`（人工回退）  | `main/index.vue` · 模板                      | ① 正文无区块             | `.task-history` 存在且正文出现「变更历史」    |

> 说明：「取数调用数 = 0」是**直接计数**判据（任意 eager 调用即红），与上面 ① 的 DOM 判据同例并存。

### 11.4 全量门禁（洁净前提：`pgrep -af vitest` 无并发进程 · `git status --porcelain` 仅本档 3 个测试文件）

| 项                   | 结果                                                                                                                      |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| 全仓 `vp test --run` | **rc=0** · 文件 **445**（444 passed / 1 skipped）· 用例 **3465**（3459 passed / 6 skipped）· **红 0** · 281.66s           |
| `vp check`           | **rc=0**（1981 文件格式 · 1580 文件 lint/类型 0 error）                                                                   |
| 五守卫               | `guard:ddd` / `guard:mobile-imports` / `guard:barrel-imports` / `guard:gate-pathspec` / `guard:test-location` **rc=0 ×5** |
| 双端 build           | `webapp build` rc=0 · `desktop:build` rc=0                                                                                |
| 移动端红线           | `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**                                            |

### 11.5 本档文件清单（全部 QA 自有测试文件，⛔ 零生产代码改动）

| 文件                                                          | 变更                                                                                                               |
| :------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| `main/__tests__/t697-ac3-history-panel.test.ts`               | 7 例改载体（入口/断言来源），内容断言逐字未动                                                                      |
| `main/__tests__/t706-qa-history-panel-probe.test.ts`          | 5 例改 import 与挂载方式，内容断言逐字未动（含 13 键那条）                                                         |
| `task-details/__tests__/t713-qa-history-dialog-probe.test.ts` | **新增 8 例**：独立复核 `T712`（正文不取数 / 同级入口 / 三路关闭焦点 / 刷新不打断 / 无 provider 无死入口 / 13 键） |