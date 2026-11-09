# ADR：编辑期远端变更的记账落点（`DEF-146`）

- 状态：已接受（待落地）
- 更新：2026-11-07（评审终签；派单 2026-11-06，文件名遵 PM 指定）
- Owner：arch-designer
- 指针：`docs/reports/T668-def146-verdict.md`（六问裁定与实现拆解）· `docs/reports/defect-pool.md`（`DEF-146` P1 / `DEF-145` / `DEF-147`）· `docs/adr/2026-09-28-sync-conflict-timestamp-basis.md`（OCC / base）· `docs/adr/2026-11-03-sync-conflict-journal-crypto.md`（`R-H` 快照约束）· `docs/prds/2026-11-05-sync-perception-polling.md`（自动刷新 = 窗口放大源）

## 背景

- `v1.18.0` 起自动刷新每 30s 把远端版本落库并推进该行 `syncedServerUpdatedAt`（base）；`T662`/`DEF-145` 修好「编辑输入不被冲掉」，但编辑器里的未保存输入**不在** `syncQueue` ⇒ 用户随后保存时 OCC 判「基于最新版本」⇒ `applied`，**远端那次修改被静默覆盖、无任何记录**。
- 现有记账只覆盖两个时序的一半：`remote-wins`（远端覆盖本地未推修改）与 `pull-local-wins`（A1：远端到达时**已排队**的本地修改胜出）。缺口 = 「远端先到（本地无队列）+ 我后保存」。
- 既有原则：静默覆盖必须**可见 + 可恢复**，且**不得**新增第二条数据裁决路径、不得放宽 OCC、不得改 `/sync/pull|push` 契约字段。

## 决策

**在保存侧（本地写路径）判定并记账**，判据为**字段级三值比较**：对 `F = keys(载荷) ∩ keys(编辑基准)`，当 `R_f ≠ O_f` **且** `L_f ≠ R_f` 时，把 `R_f`（云端当前值）记入既有 journal：

- `R_f` 库中当前值（远端版本，写前读取）· `L_f` 本次载荷值 · `O_f` 用户编辑起点值（编辑器「上次持久化」基准）；`≠` 一律用既有 `valuesEqual`（空值哨兵归一）。
- 记账**复用** `kind = 'pull-local-wins'` 与 `appendConflict`（字段子集快照 / ≤512 截断 + `truncated` / 上限 200 不升 / journal 锁 RMW / 状态面计数零新增）。
- **不动** OCC、`putWithSyncBase` 的 base 继承、`/sync/pull|push` 契约；移动端零改动（可选入参，go 仓储不消费）。

## 理由

1. 业务匹配：与 `pull-local-wins` 同一用户语汇（「我的版本覆盖了云端那份」），差异仅在发生时机 ⇒ 用户无需学习新概念。
2. 成熟度：只复用已发布并有用例守护的记账/展示/恢复链路（含 `DEF-139` 的恢复语义），无新表、无新字段、无新 kind、无迁移。
3. 可验性：判据是纯函数（三值），可写成反例矩阵（连改两次 / 格式化 / 远端只改别的字段 / 改回原值 / 远端改后我才输入 / 我值＝云端值 ⇒ 全部零记录），并配 5 条变异守门。
4. 成本：≈2.0–2.5 人天；替代方案（拉取侧草稿注册表 / 还回 base）均 ≥1 项跨层或核心语义改动。
5. 时序完整性：本决策让 journal 在两种到达顺序下同口径 —— A1 覆盖「远端在我保存后到」，本决策覆盖「远端在我保存前到」。

## 对照过的备选模式

1. **保存侧记账（采纳）** —— 适用：存在「用户可见的编辑起点值」的编辑器；代价：需把编辑基准透传到本地写路径（domain 端口加可选入参）、只保留最新一版被覆盖的云端内容；不采纳理由：无（采纳）。
2. **拉取侧记账**（pull 发现「该行有未保存编辑」即记败方快照） —— 适用：数据层能廉价获知编辑器草稿态；代价：须新建跨层「草稿注册表」+ 生命周期 + 每轮去重；不采纳理由：现状无该通道，且用户最终不保存时会产生**假账**（记录一次并未发生的覆盖）。
3. **两段式（pull 只写标记，保存时记账）** —— 适用：保存侧拿不到编辑起点值；代价：标记的写入/清理/过期生命周期；不采纳理由：标记信息等价于「行内容已变」，保存侧已可从 `R`/`O` 得出，净增状态不增精度。
4. **还回 base（保存时用用户看到的版本作 `baseUpdatedAt` ⇒ OCC 自判 `stale`）** —— 适用：产品接受「保存后需用户裁决才上云」且愿碰 base 语义；代价：需把 per-row base 暴露到编辑器、改 `putWithSyncBase` 的 base 继承（`R-20` 灾难路径守护点）、恢复走既有 `stale` 真写回；不采纳理由：收益（一键写回）可用更小代价按需追加（见「重评触发」），而 base 语义变更风险显著更高。
5. **维持现状** —— 适用：可接受偶发静默覆盖；代价：违反 A 批建立的可信度承诺，且自动刷新把窗口从偶发变每 30s 一次；不采纳（用户已判 P1）。
6. **本地伪造一条 `stale`** —— 不采纳理由：伪造 push 裁决 = 第二条裁决路径，违反硬约束。

## 后果与风险

- 正面：保存侧的静默覆盖变为可见条目（列表/详情/复制/导出/计数）；不改变 OCC 与同步契约；老客户端与旧服务端行为逐字不变。
- 负面：journal 条目量在「同字段并发编辑」场景上升；`pull-local-wins` 属**最先淘汰**的等级（`KIND_EVICTION_RANK = 2`），P1 记录可能先被挤掉（不改 kind 无法区分 ⇒ 另评）。
- 风险：① 记账在保存事务之后（journal 依赖 `navigator.locks` + 另一次 `meta` 写，不能进 Dexie 事务）⇒ 记账失败不阻断保存、只记日志；② 归因边界 —— 判据只要求「我编辑期间该字段被改过」，若将来出现第二个写 `name`/`description` 的本机入口，需补「base 是否前进」门；③ 保存路径读写之间的毫秒级 TOCTOU 属既有窗口，本决策不关闭、只登记。

## 限制与已知边界

- 只覆盖**同时序同字段**的覆盖：只保留最新一版被覆盖的云端内容（中间版本从未落本机，不可恢复）。
- 恢复强度 = 既有 `pull-local-wins` 语义（「保留我的修改」= 确认保留并清条目；败方可查看/复制/导出，**不**一键写回）。若要一键写回或「交给 OCC 裁决」，属独立变更（见下「重评触发」）。
- 不覆盖：`DEF-147`（回拉窗口未变化行无条件重写，独立问题）· 子任务/评论等其他实体的编辑期覆盖（同一判据可复用，但本决策不为它们扩面）· 移动端（红线）· 服务端（零改动）。
- 「base 只前进不回退」口径不变：本决策不写 base；若将来采用「内容等价则跳过 pull 写入」（`DEF-147`），**不得**跳过 `syncedServerUpdatedAt` 推进。
- 重评触发（任一成立即重开本条）：① 用户/PM 要求「一键恢复云端版本」或「保存时先让我选」⇒ 改评备选 4（还回 base）或扩展 `pull-local-wins` 的「保留服务端」为真写回；② 出现第二个写同一文本字段的本机入口 ⇒ 补 base 前进门；③ `DEF-147` 落地改变 pull 写入幂等语义 ⇒ 复核判据；④ 2027-05-07。

## 相关指针

- 判据与反例矩阵、文件级拆解、变异点、待拍板项：`docs/reports/T668-def146-verdict.md` §2/§5/§7。
- 记账与展示链路：`packages/infrastructure/src/persistence-sync/conflict-journal.ts`（`appendConflict` / `valuesEqual` / `LIST_SNAPSHOT_KINDS` / 恢复动作）· `packages/persistence-local/repos/task-repo-impl.ts` · `packages/presentation/task/components/task-details/use-task-view-object.ts` · `apps/web/src/components/sync/conflict-list.vue`。
- 上游：`DEF-146`（P1）· `DEF-145`/`T662`（编辑基准 `persistedText` 的由来）· `DEF-139`（`pull-local-wins` 恢复语义）· `docs/adr/2026-11-05-realtime-sync-polling.md`（为何窗口被放大）。

## 参考来源

- 本仓代码（访问 2026-11-07）：`persistence-local/repos/put-with-sync-base.ts:22-26`（base 在本地写时被继承 ⇒ OCC 判 `applied` 的机制根因）· `persistence-local/repos/task-repo-impl.ts:140-172` · `persistence-sync/sync-service.ts:755-790`（A1 记账判据与字段子集挑选）· `:1144-1250`（pull 应用与 LWW 分支）· `:1550-1640`（push 回执 / 伪 `stale` / 写回 base）· `persistence-sync/conflict-journal.ts:39-43,56-71,77-84,200-252,273-320,429-465,497-676` · `persistence-sync/sync-normalize.ts:22-30` · `presentation/task/components/task-details/use-task-view-object.ts:40,119-140,147-195` · `apps/web/src/components/sync/conflict-list.vue:295-310,591-596` · `packages/shared/locales/zh-CN.ts:150-151,165`。
- 内部规范：`docs/adr/2026-09-28-sync-conflict-timestamp-basis.md`（OCC/`baseUpdatedAt`/RC-5）· `docs/adr/2026-11-03-sync-conflict-journal-crypto.md`（`R-H`：只存 diff 字段 + 身份字段 / ≤512 截断 / 上限 200 不升）· `docs/reports/T640-sync-a-batch-arch-review.md`（F-01/F-09 口径）。
- 外部来源：**未检索到**（本次为既有机制内的落点裁决，无外部选型对照）。