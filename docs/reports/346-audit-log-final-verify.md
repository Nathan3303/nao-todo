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

## 12. `T717` 活动流改造后复验（`D9` / `AC13`，2026-11-13）

- 触发：用户 2026-11-12 要求「去掉左侧线条、参考业界历史记录类展示」⇒ PRD 新增 `D9` / `AC13`（活动流行式），
  `R-7` 的 i18n 预算随之 **13 → 16**（按天分组的 3 个组标题专用键）。
- 分支 `nao/M20261112-history-feed` · 实现提交 **`ad075695`**（rd-fe `T716`，5 文件 +586/−124）。
- 我的落点：① 把 3 处「`history.*` 键数」断言改到 16（只动阈值与中文标签，**不放宽任何断言形态**）
  ② **独立复核 8 项**（⛔ 不采信 `t716-*` 自测；不采信 rd-fe 报的对比度表）。
- 结论：**通过**。8 项全部达成且有独立证据；附 3 条非阻塞发现（1 条点击区不达 40px、1 条超长值展开会顶掉上下文、1 条文档内注释与实现不一致）。

### 12.1 阈值 13 → 16（3 处，`git diff` 逐行可核，⛔ 无其它断言改动）

| 文件                                                                       | 行          | 改动                                                                                                                           |
| :------------------------------------------------------------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/locales/__tests__/t697-audit-history-locale-keys.test.ts` | 37          | `MAX_NEW_KEYS = 13` → `16`（+ 一行注释说明是 `D9` 组标题）                                                                     |
| 同上                                                                       | 59/67/70    | describe/it/断言消息里的 `≤13` → `≤16`（**同一断言的标签文字**，非新断言）                                                     |
| `.../task-details/main/__tests__/t706-qa-history-panel-probe.test.ts`      | 129/155     | `toBeLessThanOrEqual(13)` → `(16)`（+ 一行注释；键集一致性断言逐字未动）                                                       |
| `.../task-details/__tests__/t713-qa-history-dialog-probe.test.ts`          | 363/377/387 | **PM 追认的第 3 处**：`toEqual(<恰 13 键>)` → 期望数组补 3 个 `history.group.*`；仍是**精确集合**（第 17 个即红），`en` 同数组 |

> 说明：`t713` 第 ⑥ 条是「恰等于」判据，预算一改必红（rd-fe 未列出，属我面），故按 PM 授权同批改到 16；
> 判据强度不变（仍是 `toEqual` 精确集合，⛔ 未降级为 `toContain`/`toBeLessThanOrEqual`）。

### 12.2 独立复核 8 项（自写 2 个文件，13 例；⛔ 零生产代码改动）

- `task-details/__tests__/t717-qa-history-feed-verify.test.ts`（jsdom，**8 例**）：结构 / 语义 / i18n / C 端红线
- `task-details/__tests__/t717-qa-history-feed-render.test.ts`（**真 Vite 构建 + 真 Vue + 真主题 + headless Chromium**，**5 例**）：
  几何 / 计算样式 / 真 hover / 真 Tab / 真 Enter / 渲染后对比度。缺 Chromium 的环境（CI）自动 skip。

| #   | PM 复核项             | 判据（可观测代价 / 边界值）                                                                                                                                                    | 实测                                                                                                                                                                                      | 结果                                                                                                                                                    |
| :-- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 样式零命中            | 组件样式**声明**级 `border-left` / `border-inline-start` / `linear-gradient` / `::before                                                                                       | ::after`竖线 = **0**；渲染后每行`borderLeftWidth`、`::before/::after` 边框宽、`box-shadow` 均 = 0                                                                                         | 声明确认：`border-left` 出现 2 次**全在注释**（「原四条已删」），声明 **0**；渲染 4/4 行 `border-left: 0px`、伪元素 `content: none`、`box-shadow: none` | ✅  |
| 2   | 行高 ≥44px、整行可点  | 渲染后 `getBoundingClientRect().height`；行宽 vs 对话框宽；点击徽标 / 主文案 / 时间三处各展开一次                                                                              | 4/4 行 **44.00px**；行宽 464 = 对话框 512 − padding；三种位置点击均展开/收起                                                                                                              | ✅                                                                                                                                                      |
| 3   | 展开 + 省略           | 折叠态 `scrollWidth > clientWidth` 且 `text-overflow: ellipsis`/`white-space: nowrap`/`overflow: hidden`；`title` = 全文；**真 Enter** 展开后 `white-space: normal` 且不再溢出 | 折叠 `scrollWidth 1607 > clientWidth 326`；`title` 与主文案**逐字相等**；Enter：`aria-expanded false→true→false`，差异块 2 行，展开后 `311 == 311`（真换行）                              | ✅                                                                                                                                                      |
| 4   | 对比度（渲染后 8 组） | `getComputedStyle` 取色后按 WCAG 公式算；文本 ≥4.5、徽标/焦点环 ≥3；**4 来源 × 浅/深 = 8 组**                                                                                  | 见 §12.3（最低：徽标浅色 **4.95**、文本浅色 **5.74**；深色 **7.17 / 6.11**）                                                                                                              | ✅                                                                                                                                                      |
| 5   | 三重冗余 / 去色       | 4 来源的符号、文案、色修饰**三通道两两互异**；灰度公式给出 4 色灰度亮度与两两差；灰度下符号:徽标仍需 ≥4.5                                                                      | 符号 `✎ ☁ ⇄ ↺` 4/4 互异；文案 4/4 互异；灰度 **51.0 / 99.5 / 85.5 / 56.2**（`✎`↔`↺` 差 **5.2** ⇒ 颜色塌缩）⇒ 靠符号+文案仍可两两区分；符号灰度对比 4.95–12.63                             | ✅                                                                                                                                                      |
| 6   | 不回归                | 三路关闭各一次（底部 / × / Esc）后 `v-model` 必为 false 且内容清空；键盘 Tab 焦点落行 + `:focus-visible`；打开期间父级重渲染 **同一 DOM 节点**、条目数不变、`load` 仍 **1** 次 | 三路关闭 3/3；Tab 8 次后焦点落在行（`focus-visible=true`，`outline 2px solid rgb(77,77,77)`）；重渲染 2 次：节点同一、4 条不变、`load` = 1（另：`t713` 8 例复跑全绿，含焦点归还「更多」） | ✅                                                                                                                                                      |
| 7   | C 端红线              | 无 `<table>` / `nue-table` / `role=table                                                                                                                                       | grid`/`tr,td,th`/ 类名含 grid/table；样式无`display: grid`                                                                                                                                | 5 条全 0 命中                                                                                                                                           | ✅  |
| 8   | i18n 16 键            | `history.*` 键集**恰等于** 16（多/少即红），zh/en 键集一致；组标题 3 键两两互异、⛔ 不挪用 `settings.sessionYesterday` / `calendar.today`                                      | 16 = 16（zh/en 同集）；3 组标题互异；挪用在**代码体**中 0 命中（注释里的「⛔ 不得挪用」是说明）                                                                                           | ✅                                                                                                                                                      |

### 12.3 渲染后对比度（`getComputedStyle` 取色 → WCAG 公式，浅 / 深各 1 轮）

| 通道（取色对象）                                                         | 浅色（白底 `#fff`） | 深色（弹层底 `#1a1a1a`） | 门槛       | 结论 |
| :----------------------------------------------------------------------- | :------------------ | :----------------------- | :--------- | :--- |
| 主文案（`--nue-primary-text-color`）                                     | **12.63**           | **10.84**                | ≥4.5       | ✅   |
| 右侧时间 / 展开·收起 / 组标题 / 差异文字（`--nue-secondary-text-color`） | **5.74**            | **6.11**                 | ≥4.5       | ✅   |
| 主文案在 **hover 底**（`--nue-primary-color-100`）                       | **10.12**           | **9.42**                 | ≥4.5       | ✅   |
| 徽标 `✎` 本机修改（填 `primary-800`）                                    | **12.63**           | **10.84**                | ≥3（图形） | ✅   |
| 徽标 `☁` 同步自云端（填 `success-90`）                                   | **4.95**            | **10.77**                | ≥3         | ✅   |
| 徽标 `⇄` 已合并（填 `warning-90`）                                       | **6.67**            | **9.26**                 | ≥3         | ✅   |
| 徽标 `↺` 恢复我的修改（填 `error-90`）                                   | **8.97**            | **7.17**                 | ≥3         | ✅   |
| 徽标**符号**：填色（白 / 近黑）                                          | 4.95–12.63          | 7.17–10.84               | ≥4.5       | ✅   |
| 焦点环（`primary-700`，2px）                                             | **8.45**            | 8.30                     | ≥3（图形） | ✅   |

- 与 rd-fe 自测的对照：其报「徽标填色:行底 最低 **4.95**（浅）/ **7.17**（深）」= 与我实测**逐位一致**；
  文本其报「5.74 / 6.11」，我实测深色为 **6.11**（若按行**自身底色** `#262626` 量则 5.31，仍 ≥4.5）——**口径差异，不是缺陷**。
- 深色 hover 底（`#262626`）与弹层底（`#1a1a1a`）**不同** ⇒ 深色下 hover 也有可见底色（实测变化，非「token 撞色」）。

**取色口径（PM 要求写明，免得后人重算对不上）**：对比度一律按「**该元素实际压在其上的那层不透明底色**」算，
实现 = `opaqueBackdrop(el)`：从元素自身向上找**第一个 `backgroundColor` alpha > 0** 的祖先并取它的渲染色。

| 场景                                                      | 元素自身底色                | 判据用底（取色对象）                                   | 浅色      | 深色      |
| :-------------------------------------------------------- | :-------------------------- | :----------------------------------------------------- | :-------- | :-------- |
| 行默认态（主文案 / 时间 / 展开·收起 / 组标题 / 差异文字） | `transparent`（行不加底色） | **弹层底**（`.nue-dialog` 的 `--nue-primary-color-0`） | `#ffffff` | `#1a1a1a` |
| 行 hover / focus 态（`:focus-visible` 实测底色）          | `--nue-primary-color-100`   | **行自身底色**（此时行自带不透明底）                   | `#e6e6e6` | `#262626` |
| 徽标（4 来源填色）                                        | 实心填色                    | **行所在底色**（同上，默认态 = 弹层底）                | `#ffffff` | `#1a1a1a` |

- **为什么默认态取弹层底而不是行底**：行的 `background-color` 是 `transparent`（`D9` 要求无卡片底色），
  用户眼睛看到的「行底」就是弹层底；此时「行底」与「弹层底」是同一个值，只有 hover / focus 才分叉。
- **深色为什么有两个值**：弹层底 `#1a1a1a`（`primary-color-0`）与 hover/focus 底 `#262626`（`primary-color-100`）不同。
  次要文字（`primary-color-600` = `#999`）在 `#1a1a1a` 上 = **6.11**，在 `#262626` 上 = **5.31**，两者都 ≥4.5 ⇒ **不是缺陷**。
  报告中「文本 6.11」= 默认态（弹层底）口径；「主文案(hover 底) 9.42」= hover 态口径。

### 12.4 灰度模拟（去色后是否还能两两区分）

| 来源           | 符号 | 徽标填色（浅）   | 灰度亮度 |
| :------------- | :--- | :--------------- | :------- |
| 本机修改       | `✎`  | `rgb(51,51,51)`  | **51.0** |
| 同步自云端     | `☁`  | `rgb(23,130,23)` | **99.5** |
| 已合并云端修改 | `⇄`  | `rgb(138,77,15)` | **85.5** |
| 恢复了我的修改 | `↺`  | `rgb(138,36,15)` | **56.2** |

- 两两灰度差：`✎/↺ = 5.2`（**颜色通道塌缩**，红绿色盲/去色后不可靠颜色区分）· 其余 29–48。
- 因此「三重冗余」的**承重通道 = 符号 + 文案**：4 个符号互异、4 条中文来源文案互异，且每行主文案以来源中文开头（灰度下仍可读）。
  ⇒ `AC13` 的「不靠颜色也能区分」**成立**；⚠️ 前提是**不得**把徽标符号去掉或把来源文案从主文案里删掉（变异已守，见 §12.5 M7）。

### 12.5 探针有牙（7 条变异逐条 kill，`sha256sum -c` 逐字节还原 7/7 OK）

| #   | 变异（生产组件 · 最小单点改写）                                                  | 被杀用例                                     | 红因（摘）                                                              |
| :-- | :------------------------------------------------------------------------------- | :------------------------------------------- | :---------------------------------------------------------------------- |
| M1  | `min-height: 44px` → `40px`                                                      | 渲染①行高                                    | `行高必须 ≥44（实测 40）`                                               |
| M2  | `.task-history__entry` 回插 `border-left: 3px solid`                             | jsdom①声明级 **+** 渲染①                     | 声明级 `not.toMatch(/border-left:/)`；`border-left 必须为 0（实测 3）`  |
| M3  | `summary` 的 `overflow/text-overflow/white-space` 三件套 → `text-overflow: clip` | 渲染①省略                                    | `expected 'clip' to be 'ellipsis'`                                      |
| M4  | 删除 `:focus-visible` 的 `outline: 2px`                                          | 渲染②焦点环                                  | `焦点环必须可见（≥2px）: expected 1`                                    |
| M5  | 徽标 `success-90` → `success-30`（浅）/ (同一处)                                 | 渲染④对比度 **+** ⑤灰度                      | `徽标(☁) vs 行底色 ≥3（实测 1.53）`                                     |
| M6  | 删掉行的 `:title="summaryText(item)"`                                            | jsdom③                                       | ``title` 必须给全文: expected ''`                                       |
| M7  | `@click="toggle(item)"` → `@click="() => undefined"`                             | 渲染②真 Enter **+** jsdom②点徽标/主文案/时间 | `真按 Enter 必须展开: false`；`点 .task-history__badge 必须展开: false` |

### 12.6 两条 PM 指定「由我判」的观察（⛔ 未改生产代码，仅建议）

1. **分页按钮 `nue-button--pure`（「更早的记录」）像不像「卡片套卡片」** —— **不构成**。渲染后实测：
   `border 1px solid` 但**边框色 alpha = 0**（`color(srgb -0.15 -0.15 -0.15 / 0)`）⇒ **肉眼无边框**；`border-radius: 0`、无阴影、背景透明。
   ⚠️ 附带真问题（**非本次引入**，`T713` 起就是 `pure,small`）：该按钮渲染高 **17px**，低于 `DESIGN.md` §3「可点控件 ≥40px」。
   最小方案（建议 RD 侧）：`.task-history__more { min-height: 40px; padding: 0 var(--nue-padding-xs); }` —— 只加内边距与最小高，不动 token/组件。
2. **展开后超长值会不会顶掉上下文** —— **会**（实测数据）：单条展开后行高 **268px**（1 长描述 + 1 优先级），
   列表可视高 `min(58vh, 26rem)=416px` ⇒ 一条展开占 **64%** 可视高；若描述达数千字，行高会继续线性增长（当前 `overflow-wrap: anywhere` 全展开）。
   判断：**不阻塞本单**（查阅型信息、且列表可滚），但极端长文本会失去上下文。最小方案（建议）：
   给差异块加上限 + 块内滚动 —— `.task-history__detail { max-height: 6.5rem; overflow: auto; }`（约 3 行 × 2 字段）；
   ⛔ 不建议 `line-clamp`（会把「展开 = 看到完整值」变成又一层省略，与 `AC13` 冲突）。
3. 文档内一致性（P3）：组件头注释写「『更早』组标题**本身即分页入口**」，实际实现是组后独立的
   `nue-button.task-history__more`（组标题始终是 `<p>`）。**注释与实现不一致**，建议 RD 侧改注释（⛔ 非行为问题）。

### 12.7 门禁（洁净前提：`pgrep -af vitest` 无并发进程 · `git status --porcelain` 仅本档 6 个文件）

| 项                   | 结果                                                                                                                      |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| 全仓 `vp test --run` | **rc=0** · 文件 **448**（447 passed / 1 skipped）· 用例 **3484**（3478 passed / 6 skipped）· **红 0** · 302.08s           |
| `vp check`           | **rc=0**（格式 + lint + 类型 0 error）                                                                                    |
| 五守卫               | `guard:ddd` / `guard:mobile-imports` / `guard:barrel-imports` / `guard:gate-pathspec` / `guard:test-location` **rc=0 ×5** |
| 移动端红线           | `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**                                            |

### 12.8 本档文件清单（全部 QA 自有测试 + 本报告，⛔ 零生产代码改动）

| 文件                                                                       | 变更                                                                                                               |
| :------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `packages/shared/locales/__tests__/t697-audit-history-locale-keys.test.ts` | 阈值 13 → 16（+ 注释 + 同断言的中文标签）                                                                          |
| `.../task-details/main/__tests__/t706-qa-history-panel-probe.test.ts`      | 阈值 13 → 16（+ 注释；键集一致性逐字未动）                                                                         |
| `.../task-details/__tests__/t713-qa-history-dialog-probe.test.ts`          | 期望数组补 3 个 `history.group.*`（仍是精确集合）                                                                  |
| `.../task-details/__tests__/t717-qa-history-feed-verify.test.ts`           | **新增 8 例**（jsdom：样式声明零命中 / 整行可点 / 展开语义 / 三重冗余 / 三路关闭 / 刷新不重挂 / C 端红线 / 16 键） |
| `.../task-details/__tests__/t717-qa-history-feed-render.test.ts`           | **新增 5 例**（真渲染：行高 / 省略真溢出 / 真 Enter / 真 hover / 渲染后对比度 8 组 / 灰度）                        |
| `docs/reports/346-audit-log-final-verify.md`                               | 本节 §12                                                                                                           |

**复现**（本机有 Chromium 才跑渲染探针；无则自动 skip）：

```text
# 结构与语义（jsdom，8 例）
pnpm exec vp test --run packages/presentation/task/components/task-details/__tests__/t717-qa-history-feed-verify.test.ts

# 渲染后实测（真 Vite 构建 + headless Chromium，5 例；产物落 $TMPDIR/t717-render-probe.json）
pnpm exec vp test --run packages/presentation/task/components/task-details/__tests__/t717-qa-history-feed-render.test.ts

# 阈值/键集三条 + 回归面
pnpm exec vp test --run packages/shared/locales/__tests__/t697-audit-history-locale-keys.test.ts \
  packages/presentation/task/components/task-details/__tests__ \
  packages/presentation/task/components/task-details/main/__tests__/t706-qa-history-panel-probe.test.ts
```

### 12.9 用户视觉验收清单（交用户人工，⛔ 不用自动化替代观感判断）

前置：本地 dev 已起（`http://localhost:5173`，API 走本地 `http://localhost:3302/api`）；打开任一任务的「更多 → 变更历史」。
本清单只判**观感 / 体感**；功能与数值项已由 §12.2–12.4 自动化覆盖。

| #   | 测什么（对应 AC）                | 怎么操作                                     | 预期结果                                                                           | 结果 |
| :-- | :------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------- | :--- |
| V1  | 无左侧线条 / 轨道（`D9` `AC13`） | 打开对话框，整体看一眼                       | 行内**没有任何左侧色条 / 竖线 / 时间轴轨道**；来源靠圆形徽标 + 文案表达            | ☐    |
| V2  | 活动流气质（`AC13`）             | 对比 GitHub / Linear / Notion 的活动列表观感 | 「行 + 圆形图标 + 右侧时间」的列表感；**不**像卡片列表、**不**像后台表格           | ☐    |
| V3  | 按天分组（`D9`）                 | 找有多天记录的任务（或制造一条昨天的改动）   | 「今天 / 昨天 / 更早」小标题分组；组间留白明显、组内紧密；无表格线                 | ☐    |
| V4  | hover / focus 体感（`AC13`）     | 鼠标逐行划过；再用 Tab 逐行聚焦              | hover 整行淡底色；Tab 聚焦到行有可见焦点环；Enter 展开、再 Enter 收起              | ☐    |
| V5  | 长值省略 + 展开（`AC13`）        | 找一条描述很长的记录：先悬停，再点击         | 行尾显示「…」；悬停显示全文气泡（`title`）；点击后完整换行显示，不再截断           | ☐    |
| V6  | 深色主题（`DESIGN` §2）          | 设置里切深色，重复 V1–V5                     | 徽标、正文、时间、组标题仍清晰；hover / 焦点环仍可见                               | ☐    |
| V7  | 「更早的记录」按钮观感           | 记录多于 1 页时看列表底部                    | 不出现「卡片套卡片」；点击目标大小可点（⚠️ 自动化实测该按钮高仅 17px，见 §12.6-1） | ☐    |
| V8  | 极端长文本（可选，看是否顶屏）   | 用 1000+ 字描述制造一条历史，展开            | 展开后不至于把上下文全部顶出可视区（建议见 §12.6-2：限 3 行 + 块内滚动）           | ☐    |

> 回填方式：把 ☐ 改成 ✅/❌ 并发回；❌ 项注明是「观感不认」还是「功能异常」，后者我按缺陷走 Verify。

## 13. `T719` 抽验 `T718` + 契约修订（展开后主文案不再换行）

- 触发：`T717` 复核结论被采纳后，PM 派 `T718` 修三处（分页点击区 / 展开区上限 / 注释订正）并顺手修掉
  「无字段条目也有『展开』」的死交互；随后 **PM 裁定**：`T717` 里那条「展开后主文案换行」的断言**要改契约**。
- 分支 `nao/M20261112-history-feed` · 实现 **`ae65a6a1`**（`T718`）+ **`1c1791d8`**（`T718 ④` 无字段断言）+ `aad32ea9`（探针放仓库外的规则）。
- 我的落点：① 按裁定改契约断言（**只这一条**）② 渲染后抽验 `T718` 四处修复（⛔ 不采信其数字）
  ③ 修掉自己探针的三个故障 + 把探针目录移出仓库 ④ 报告本节。
- 结论：**通过**；附 1 条新发现（P3：列表已满时展开会出现第二层滚动条，见 §13.4）。

### 13.1 契约修订（PM 裁定，改的那一条）

`t717-qa-history-feed-render.test.ts` 原断言：`expandedSummary.whiteSpace === 'normal'` + `scrollWidth <= clientWidth + 1`。
**新口径**（裁定理由：换行时单条 = 108% 可视高，正是要修的现象；替代方案会有双层滚动条 + 同值显示两遍）：

| 判据                                                           | 实测（渲染后）                                                                          |
| :------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| 展开后主文案**仍单行省略**（`white-space: nowrap`）            | `nowrap`                                                                                |
| 展开后主文案**仍真溢出**（全文不靠主文案承载）                 | `scrollWidth 1607 > clientWidth 311`                                                    |
| **前提①**：折叠时 `title` = 主文案全文（逐字相等）且含完整长值 | 逐字相等 ✅ · 含「这是一段非常长的描述文本…」全文 ✅                                    |
| **前提②**：展开后 `detail` 内**全文可滚**，且滚到底能看结尾    | `clientHeight 104 / scrollHeight 132`，键盘 ↓ 后 `scrollTop = 28 = 132 − 104`（到底）✅ |

⇒ 主文案省略 + `title` 全文 + `detail` 内滚三者合起来 = **无信息丢失**（不是「省掉了没人看得见」）。

### 13.2 抽验 `T718` 四处修复（渲染后实测）

| #   | 修复项                          | 判据                                                                                                                          | 实测                                                                                                                      | 结果 |
| :-- | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :--- |
| 1   | 分页「更早的记录」点击区 ≥40px  | 渲染后 `getBoundingClientRect().height`，**浅 / 深各一次**                                                                    | 修前 **17px** → 现 **40.0px / 40.0px**（`min-height:40px` + `padding:0 8px` 生效）                                        | ✅   |
| 2   | 展开区高度上限 + 内滚           | `max-height` 计算值、`overflow-y`、`clientHeight`、`scrollHeight`                                                             | `max-height: 104px`（= 6.5rem）· `overflow-y: auto` · `clientHeight 104` · `scrollHeight 132`（真溢出）                   | ✅   |
| 2b  | 内滚**键盘可操作**              | Tab 能把焦点送进 `detail` 且命中 `:focus-visible`；真 `↓` 使 `scrollTop` 增加                                                 | Tab 焦点落在 `.task-history__detail`（`focus-visible=true`）；4 次 `↓` 后 `scrollTop 0 → 28`（到底）                      | ✅   |
| 3   | 单条展开 ≤35% 可视高            | 展开行高 / 列表设计上限 `min(58vh,26rem)`                                                                                     | 行高 **135px** = **32.5%**（416px）· 若按当前内容高 354px 则 38.1%（两口径都记，判据用设计上限＝rd-fe 同口径）            | ✅   |
| 4   | `canExpand = fields.length > 0` | 墓碑动作（`archive`/`delete`/`restore`，`fields` 空）：不渲染「展开」、不置 `aria-expanded`、点了不渲染差异块；有字段仍可展开 | 无字段行：`toggle = null` · `aria-expanded` **属性不存在** · 点击后 `detail = null`；有字段行：`false → true`、1 个差异行 | ✅   |
| 5   | 分页仍按 **`seq` 游标**续页     | 点一次：`load` 调用次数 + 第 2 次游标 = 当前最旧 `seq`；`hasMore=false` 后入口消失                                            | 调用 1 → **2** 次；游标 = **1**（最旧 seq，⛔ 非 offset）；入口消失                                                       | ✅   |

### 13.3 我探针的三个故障（PM 已定位，我复核后修掉）

| #   | 故障                                            | 复核                                                                                     | 修复                                                                |
| :-- | :---------------------------------------------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| 1   | `ready()` 硬编码 `>= 4` 行                      | 确认：第二场景 `?rows=2` 只有 2 行 ⇒ 永不就绪（栈停在 `probe.mjs` 的「第二场景未就绪」） | 改成 `>= rowLimit`（由 URL 参数决定）                               |
| 2   | `window.__qaReady = ready()` 赋的是 **Promise** | 确认：靠 CDP `awaitPromise:true` 才凑巧成立（隐式契约）                                  | 改成布尔 `window.__qaIsReady`，就绪后置 `true`；探针端判 `=== true` |
| 3   | 怀疑 `canExpand` 影响我的夹具                   | 复核：**无关**（4 行夹具每条都有 `fields`）；`canExpand` 只对 `fields` 为空的行生效      | 不朝产品代码方向改；另加 §13.2-#4 专属夹具钉住                      |

**门禁污染（根因处理，非打补丁）**：上一轮为排障用 `T717_KEEP=1` 保留了 `.t717-render-probe/`（含 Chromium
`profile-*/…json` 共 160 个文件）⇒ 全仓 `vp check` 因工作区脏文件转红。**修法 = 探针目录移出仓库**：
`PROBE_DIR = $TMPDIR/t717-render-probe`，并向仓库 `node_modules` 建软链供裸模块解析（Vite 构建照常）；
跑完 `afterAll` 删除。**证据**：`git status --porcelain` = 仅本档 3 个文件；全仓 `vp check` **rc=0**。

### 13.4 新发现（P3，未改生产代码）

**列表已满时展开会出现第二层滚动条**：`scrollables` 实测（`overflow-y:auto|scroll` 且内容溢出）——

| 场景                                | 列表内容                 | 实际在滚的容器                                                |
| :---------------------------------- | :----------------------- | :------------------------------------------------------------ |
| `?rows=2`（列表未溢出）             | `scrollHeight < 416`     | **仅** `task-history__detail`（1 个）✅ 设计目标成立          |
| `?rows=4` + 展开 1 条（列表已溢出） | `scrollHeight 445 > 416` | `task-history__list` **+** `task-history__detail`（**2 个**） |

⇒ 「无双层滚动条」在**列表未满**时成立；**列表已满**（记录多到接近 416px）时展开任意一条，就会出现
「列表滚 + 展开区滚」两层，滚轮落在展开区会被吞。**不阻塞**（`D9`/`AC13` 未规定单层），但只要列表撑满就会遇到。
最小方案（供 PM 定）：展开时**收起其它行**（手风琴单开）或展开后把列表 `scrollTop` 对齐到该条；
⛔ 不建议给 `detail` 去掉内滚（会退回 108% 顶屏的老问题）。
（两个边界都已在用例里钉住：`rows=2 ⇒ 1 个`、`rows=4 ⇒ 2 个`；⛔ 没有只测能过的那个。）

### 13.5 深色底取色口径（PM 要求写明，同 §12.3）

- **默认态**：行 `background-color: transparent` ⇒「行底」= **弹层底** `#1a1a1a`（`--nue-primary-color-0`）。
  次要文字 `#999` 对 `#1a1a1a` = **6.11**。
- **hover / focus 态**：行自带不透明底 `#262626`（`--nue-primary-color-100`）⇒ 取行底。次要文字对 `#262626` = **5.31**。
- 简表：**文本默认态 = 弹层底（6.11）**；**文本 hover 态 = 行底（5.31 vs 底色 ⇒ 主文案 hover 实测 9.42）**；两者均 ≥4.5。
- 取色函数 = `opaqueBackdrop(el)`（从元素向上找第一个 alpha>0 的祖先底色），⛔ 不用「假定白色/黑色」硬编码。

### 13.6 门禁（洁净前提：`pgrep -af vitest` 无并发进程 · `git status --porcelain` 仅本档 3 文件）

| 项                   | 结果                                                                                                             |
| :------------------- | :--------------------------------------------------------------------------------------------------------------- |
| 全仓 `vp test --run` | **rc=0** · 文件 **449**（448 passed / 1 skipped）· 用例 **3489**（3483 passed / 6 skipped）· **红 0** · 326.33s  |
| `vp check`           | **rc=0**（1986 文件格式 · 1584 文件 lint/类型 0 error）                                                          |
| 移动端红线           | `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**                                   |
| 定向复跑             | `t712` **8/8** · `t713` **8/8** · `t716` **6/6** · `t717-verify` **10/10** · `t717-render` **6/6**（合计 38/38） |

### 13.7 本档文件清单（⛔ 零生产代码改动）

| 文件                                                | 变更                                                                                                                                                                                     |
| :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.../__tests__/t717-qa-history-feed-render.test.ts` | 契约断言改新口径（`nowrap` + 仍溢出 + `title` 逐字相等 + `detail` 滚到底）；新增「`T718` 抽验」1 例（6 处判据，含两个滚动条边界）；探针目录移出仓库 + 就绪标记改布尔；`?rows=2` 第二场景 |
| `.../__tests__/t717-qa-history-feed-verify.test.ts` | 新增 2 例：分页按最旧 `seq` 续页（keyset）/ `canExpand` 无字段不渲染展开                                                                                                                 |
| `docs/reports/346-audit-log-final-verify.md`        | 本节 §13（+ §12.3 已补「深色底取哪个值」口径）                                                                                                                                           |

## 14. `T721` / `T722` CI 红灯修复（探针自身缺陷，⛔ 非产品问题）

- 现象：CI run [43381026842](https://github.com/Nathan3303/nao-todo/actions/runs/43381026842)（第 1 轮）与
  其后的重跑（第 2 轮）都红在 **同一条**用例：
  `t717-qa-history-feed-render.test.ts > T719 抽验 T718 …`（`t717-render` 6 例 1 红）。
- 两轮**根因不同**，都不是产品代码：

| 轮次    | 红的样子                                                                                                  | 根因                                                                                                                                                                                                                                                       |
| :------ | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 第 1 轮 | `列表未溢出时只允许 detail 一个滚动容器（实测 []）: expected [] to deeply equal ['task-history__detail']` | **第二场景的新 target 没有布局视口**（只 `createTarget` + `attachToTarget`，从未 `Page.bringToFront`、未设视口）⇒ `clientHeight/scrollHeight` 全 0 ⇒ `scrollables()` 的 `scrollHeight > clientHeight + 1` 命中 0 个 ⇒ 「一个滚动容器」被**静默伪装成成立** |
| 第 2 轮 | `第二场景 detail 必须被 6.5rem 截到 104px（实测 96）: expected 96 to be 104`                              | **我拿硬编码 px 断言 rem 换算值**：`6.5rem` 的 px 值依赖**根字号**（CI 实测上限 ≈ 96px，非本地的 104px）；且「`clientHeight` 必须 = 上限」还隐含「内容必须够长」，把**被测性质**和**夹具前提**写进了同一条断言                                             |

### 14.1 为什么本地绿而 CI 红（两条根因 + 现在守它们的守卫）

| #   | 根因                               | 为什么本地绿                                | 现在的守卫（⛔ 让同类问题无法再静默通过）                                                                                                                                                        |
| :-- | :--------------------------------- | :------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 新 target 无布局视口（`0×0`）      | 本地新 target 恰好继承了窗口视口 ⇒ 几何正常 | 两场景都 `Page.bringToFront` + `Emulation.setDeviceMetricsOverride(1200×900, dpr 1)`；并在判「滚动容器」**之前**断言 `list.clientHeight > 0`、`detail.clientHeight > 0`（0 = 死窗口 ⇒ 直接红）   |
| 2   | `rem → px` 依赖根字号（104 vs 96） | 本地根字号 16px ⇒ 恰好 104                  | 上限**一律从计算样式取**（`parseFloat(getComputedStyle(detail).maxHeight)`，⛔ 不写 104）；判据改成**性质**：`clientHeight === min(scrollHeight, cap)` + `scrollHeight > clientHeight`（被截断） |
| 3   | 夹具可能「内容不够长」导致假成立   | 本地字体下内容恰好 > 上限                   | 夹具**强制溢出**：长值字段从 2 个加到 3 个（`description` / `name` 都是长文本）⇒ 内容高 ≈ 286px ≫ 上限（本地 104）；并断言 `scrollHeight > cap`，不够长就**红**而不是通过                        |
| 4   | 半布局帧量到偏小值                 | 本地机器快，350ms 足够                      | 新增 `waitDetailStable()`：轮询 `detail.scrollHeight` 直到**连续两次相同**再取值（最多 2s）                                                                                                      |

**连带审计（同一文件里其它 px）**：`≥44`（行高下限，生产是 `min-height: 44px` 字面 px）、
`≥40`（分页下限，`min-height: 40px` 字面 px）、徽标 `= 20`（`width/height: 20px` 字面 px）—— 三者**不依赖根字号**，
作为下限/字面值保留；`416`（列表上限 `min(58vh, 26rem)`）**已从 `maxHeight` 解析**，未硬编码。

### 14.2 守卫有牙（变异「观测器」，各一次）

| 变异                                                        | 期望                                                  | 实测                                                                      |
| :---------------------------------------------------------- | :---------------------------------------------------- | :------------------------------------------------------------------------ |
| `detailInfo().clientHeight` 谎报 `0`（等价第 1 轮的死窗口） | 死在「必须有真实布局高度」而不是「滚动容器恰好 1 个」 | 红：`detail 渲染高必须 = 上限 …（实测 0）` → 收紧后：`必须有真实布局高度` |
| 上限断言改回硬编码 `104`（等价第 2 轮）                     | 在非 16px 根字号环境下红                              | 已在 §14.1-#2 移除该写法（改 `min(scrollHeight, cap)`）                   |

### 14.3 验证

| 项                          | 结果                                                                                                                                                                                                 |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本地 `t717-render`          | **6/6 绿**（detail `clientHeight 104 / scrollHeight 286` · 键盘 ↓ 后 `scrollTop 182 = 286 − 104`（到底）· 单条展开 135px = 32.5% 设计可视高）                                                        |
| 本地 `t717-verify`          | **10/10 绿**                                                                                                                                                                                         |
| 本地全仓 `vp test --run`    | **rc=0** · 文件 **449**（448 pass / 1 skip）· 用例 **3489**（3483 pass / 6 skip）· **红 0** · 379.38s（本轮改动前基线）                                                                              |
| `vp check`                  | **rc=0**                                                                                                                                                                                             |
| **CI `test`（`0bf12310`）** | ✅ **success** · [run 43386056400](https://github.com/Nathan3303/nao-todo/actions/runs/43386056400) · 文件 **449**（448 pass / 1 skip）· 用例 **3489**（3483 pass / 6 skip）· **failed 0** · 178.58s |
| CI `check`                  | ✅ **success**（同 run）                                                                                                                                                                             |

> **结论**：两轮 CI 红都是**探针自身**问题（无布局视口 / rem 换算硬编码），与产品代码无关；修完后 CI 与本地数字
> **逐项相同**（449 文件 / 3489 例 / 0 红）⇒ 口径已对齐，后续同类批次用「本地全绿 + CI 绿」双证放行。

### 14.4 第 3 类失败：浏览器**启动**抖动（不是断言）

- [run 43387259815](https://github.com/Nathan3303/nao-todo/actions/runs/43387259815)（**只改了本报告**那次）红在
  `Error: Chromium 启动超时`（30s 内没等到 `DevTools listening`）⇒ **harness 抖动**，与用例逻辑无关
  （同代码上一轮全绿；该轮 `check` job 绿）。
- 加固（同一文件）：① 启动超时 30s → **60s**；② 探针**进程级**失败自动重试 **3 次**（1.5s 退避）。
  ⚠️ 边界：只重试「子进程没起来 / CDP 连不上 / 崩溃」；**断言在测试进程内做，重试不可能掩盖断言失败**（这也是能加重试的前提）。