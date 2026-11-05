# ADR：同步感知 A′ —— 可见窗口自动刷新的门控与刷新架构

- 状态：已接受（A′ 已落地于 `feat/329-sync-perception`，待 QA/发版；`DEF-140` 的「门控被骗」口径待 `T657` 闭合后才生效）
- 更新：2026-11-05
- Owner：arch-designer
- 指针：PRD `docs/prds/2026-11-05-sync-perception-polling.md`（§五 R-1…R-10 / §七 AC · §九 重评触发）· 可行性 `docs/reports/T653-realtime-feasibility.md`（§6.3–6.4）· 限流评审 `docs/reports/T656-ratelimit-security-review.md`（C1–C7）

## 背景

- 拉取触发源原只有四个（启动/解锁 · `online` · 回前台 · 手动），**无周期刷新** ⇒ 窗口停在列表上时他端改动**永久不可见**（T653 §5）。A 批把冲突做成「可见、可恢复」，前提是拉取及时 ⇒ 本单补的是「**何时拉**」，不是「拉得多快」。
- 三条既有事实约束：① `withPullLock` 用 `navigator.locks` 的 `ifAvailable`，未取锁即**整轮跳过且无补偿** ⇒ 非主标签永久陈旧；② 桌面 `backgroundThrottling:false`（提醒引擎依赖）使 `document.visibilityState` **恒为 `visible`** ⇒ 无法区分「窗口在托盘里」；③ `pull`/`push` 共享 24 次/分/IP（跨仓 `M20261105-sync-ratelimit` 另行处理）。
- 非目标：**零数据裁决改动** —— OCC / `baseUpdatedAt` / 冲突落账 / `pull-local-wins` 全部不动（AC8）。

## 决策

1. **门控优先级 `隐藏 > 离线 > 脏队列 > 周期`**：前三项任一命中即不发周期请求；**事件触发（`online` / 回可见 / 手动）不受脏队列门限制** —— 加门会永久饿死：队列长期卡住（业务失败/凭证异常）时界面将永不更新，宁让 `remote-wins` 记账可见，也不能让用户失去唯一的自动收敛路径。
2. **合并门 `EVENT_PULL_MERGE_GATE_MS = 10s` 只对事件触发生效**（`resumeBackfill`），周期拉取与手动「立即同步」**永不过门**；判据取「距上次**成功**拉取」而非「距上次尝试」—— 失败不推进时间戳，故失败后的事件触发仍会拉取，不会把连续失败静默成「刚拉过」。
3. **单主 + `BroadcastChannel` 必须成对**：锁保留 `ifAvailable`（不排队、不阻塞 UI），补偿 = 拉取成功后广播 `{type, userId, at}`（**无数据载荷**）；非主标签收到只 `applyForeignPullComplete`（刷新本窗口视图 + 收敛合并门），**不二次发网络**（数据在同一 IndexedDB）。无 `BroadcastChannel` ⇒ 双向 no-op，不抛错。
4. **桌面可见性唯一信号 = 主进程 `show`/`hide`/`did-finish-load` → IPC `nao:window-visibility`**（preload 缓存首帧并订阅回放，抹掉「消息先到、订阅后建」的初值空洞）。装配判据 `manageDocumentVisibility: !hasWindowVisibilityBridge()`：**桥存在就不注册 `document` 监听**（否则托盘里照拉且无报错），桥缺失才退回 `document`（旧 preload 退化为「永不隐藏」而非「永不刷新」）；**不硬编码 `false`**，硬编码会让旧 preload 用户永久不刷新。
5. **退避复用 `sync-retry.ts` 的 `backoffDelayMs` / `PUSH_BACKOFF_INTERVALS_MS`**（5→10→30→60→120s 封顶，成功清零并回 30s），不新建第二套间隔表。**勘误**：PRD 初稿写的 `computeBackfillDelayMs` 是笔误（该函数是 `5·2^level` ⇒ 5/10/20/40/80/120，与 AC3 明列序列不符）；**口径以 AC3 的明文序列为准**，函数以本条为准。
6. **合并门与截断拉取的边界**：仅当**所有表取尽**（`pending.size === 0`）才推进「上次成功拉取」时间戳并广播；触顶截断（`pullIncomplete = true`）**不推进、不广播** —— 否则合并门会挡住 `DEF-6` 的续拉补拉（实现期实测把 `def6-mirror-completeness` 打红）。
7. **已知失效口径（`T657` 落地后生效，当前不成立）**：`DEF-140` 下 `/sync/pull` 的 `10051`/`90022` 被当「空拉取成功」⇒ 门控被骗（`ok:true` ⇒ 不退避）且会广播「已拉取」。`T657`（业务码非 0 且无 `data` ⇒ 判失败）落地后，本 ADR 的退避与广播语义才真正闭合；**在此之前不得对外宣称「限流可见」**。
8. **B（服务端 SSE）继续挂账**：T653 结论 = 客户端缺的是「何时拉」；SSE 只在「双端同开且要秒级」时才有增量价值（相对 A′ 增量 5.5–9 人天 + `WriteTimeout`/反代/心跳等跨仓前置）。**重评触发 = A′ 上线 1 周回看「≤30s 是否够」**：从未感到慢 ⇒ **销案**（不再挂账）；出现具体「30s 明显不够」实例 ⇒ 凭实例重新立项。

## 理由

1. 业务匹配：任务清单类「≤30s 收敛」主观等同实时（用户 2026-11-05 拍板），代价 ≈2 次/分/端；隐藏态 0 次。
2. 成熟度：只用基线原语（`setTimeout` / `BroadcastChannel` / `navigator.locks`）+ 既有退避表；无新依赖、无服务端改动、无数据迁移。
3. 可验性：门控层为纯逻辑（时间/拉取/脏队列/可见性全部注入）⇒ 假定时器可单测 AC1/3/5/6/10；运行接线只加一处装配（web `data-plane` / desktop `AppRoot`）。
4. 成本：A′ 2–3 人天 vs B′ 7.5–12（T653 §4），且 A′ 是 B 的兜底地基（B 无论如何都要它）。

## 对照过的备选模式

1. **维持现状（四个触发源）** —— 适用：单端使用、或「重进页面」是常态；代价：他端改动**永久**不可见，用户判为「数据丢了」；不采纳（用户已提诉求）。
2. **纯周期轮询（无门控 / 无单主 / 无合并门）** —— 适用：单标签、始终可见；代价：隐藏态照拉（耗电 + 请求）、多标签 N 倍、alt-tab 抖动放大；不采纳（AC5/5b/7 全落空）。
3. **只做单主、不做广播** —— 适用：各标签都能轮到锁的环境；代价：在 `ifAvailable` 语义下非主标签**永不刷新** ⇒「自动刷新」退化成「只有主标签刷新」，比现状更隐蔽；不采纳。
4. **桌面沿用 `document.visibilityState`** —— 适用：`backgroundThrottling:true`；代价：本项目为 `false`（提醒引擎依赖）⇒ 恒 `visible`，托盘里照拉且**无任何报错**；不采纳。
5. **由服务端下发变更行（事件带数据）** —— 适用：想省一次拉取；代价：等于第二条数据裁决路径（OCC / base / 落账 / `pull-local-wins` 全部要复制）；不采纳（T653 §6.1）。

## 后果与风险

- 正面：可见窗口 ≤30s 收敛；隐藏/离线零请求；多标签一致（≤2s 视图刷新）；失败退避单一实现。
- 负面：拉取频率上升会**放大真实裁决的发生次数**（尤其 `pull-local-wins` 记账）⇒ 用户可能觉得「冲突变多」；PRD §九 已设「>3 条/天即立降噪单」的触发点，本单不做。
- 风险：① 合并门时间戳是**进程内**状态，多标签靠广播收敛 ⇒ 广播不可用环境下退化为「各标签各拉一次」（能力下降、不报错）；② 桌面停轮询依赖 IPC 送达，**旧 preload** 会退化为 `document` 分支（托盘里照拉）—— 已由 `hasWindowVisibilityBridge()` 判据限定为「桥不存在」时才发生。
- 撤销：删除定时器与装配即回到旧行为（无数据迁移、无契约变更、服务端零改动）。

## 限制与已知边界

- 只决定「**何时**调既有拉取入口」，不覆盖：SSE（B 挂账）、`WriteTimeout` 仅对 SSE 放宽（B 前置）、限流维度（跨仓 `M20261105-sync-ratelimit` / T656 C1–C7）、`pull-local-wins` 降噪、Web Push / binlog CDC、移动端（红线）。
- 新鲜度判据保持单一：界面「是否最新」只读 `syncStatus.mirrorPulledAt` / `lastSyncAt`，**不得**用定时器状态或「刚跑过」推断（R-7）；合并门不覆盖 `manualSync()` 与周期拉取（见决策 2）。

## 相关指针

- 实现：`packages/infrastructure/src/persistence-sync/auto-refresh.ts`（门控/退避）· `pull-broadcast.ts`（广播）· `sync-service.ts`（`EVENT_PULL_MERGE_GATE_MS` / `lastPullSucceededAt` / `applyForeignPullComplete` / 取尽才推进）· `apps/web/src/sync-refresh-runtime.ts`（运行接线）· `apps/desktop/src/main/ipc.ts`（`bindWindowVisibility`）· `apps/desktop/src/renderer/src/window-visibility.ts`。
- 规范与上游：PRD §五 R-4/R-6/R-7/R-9/R-10 · T653 §6.3–6.4 · `DEF-140`（`docs/reports/defect-pool.md`）· 既有退避范式 `docs/adr/2026-09-13-shell-06-offline-backfill.md`。

## 参考来源

- 本仓代码（访问 2026-11-05）：`sync-retry.ts:11-20`（`PUSH_BACKOFF_INTERVALS_MS` = 5/10/30/60/120，`backoffDelayMs` 封顶）· `sync-retry.ts:65-72`（`computeBackfillDelayMs` = `BACKFILL_TICK_MS · 2^level`，即勘误所指函数）· `sync-service.ts`（`withPullLock` 的 `ifAvailable`；`pending.size === 0` 才推进镜像与广播）· `apps/desktop/src/main/index.ts:147`（`backgroundThrottling: false`）· `docs/reports/T653-realtime-feasibility.md`（SSE 的 `WriteTimeout=15s` 硬前置、单主缺广播 ⇒ 非主标签永久陈旧、事件只当信号）。
- 外部来源：**未检索到**（本次为内部既有能力的接线与自证，无外部选型对照；检索通道当日不可用，未做外部引用）。