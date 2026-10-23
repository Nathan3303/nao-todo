# T526 提醒本地化：影响面 / 数据可用性 / NFR 评估

- 状态：草稿 · 更新：2026-10-23 · Owner：arch-designer · 指针：ADR `docs/adr/2026-10-23-reminder-local-judgment.md` · qa 接缝（T525）· 需求 `docs/tasks-state.md`（T524）· 口径：`rg` 全仓穷尽清点 + 行段读码（codegraph 已卸载，可能漏 `import.meta.glob`）
- 结论：**有条件可行**（客户端无阻塞；条件 = D1-A 服务端停 cron 与 D2-A 重复提醒同批）

## 1. 影响面（保留 / 改造 / 下线）

- `apps/web/src/views/index/reminder-sse.ts` + `__tests__/reminder-sse.test.ts`：**下线**（传输/鉴权路径退役；「通知权限请求」迁入共享引擎）。
- `packages/shared/hooks/use-sse.ts`：**下线**（全仓零引用，死代码）；`packages/shared/types/sse.ts`：**改造**（载荷类型保留、改名 `TaskReminderEvent` 迁 `types/reminder.ts`，现被 5 处引用）。
- 桌面 `hooks/use-local-reminder.ts` + `hooks/usecases/use-task-reminder.ts` + `AppRoot.vue` 的独立 `dialogManager`/`TaskReminderDialog`：**下线**（改由 webapp 壳统一启动，否则两套并存会双弹）。
- `apps/web/src/views/index/index-view.ts`：**改造**（`connectReminderSSE` → 引擎 `start/stop`；删 `VITE_DISABLE_SSE` 分支；启动排在首拉门/解锁门之后）；`VITE_DISABLE_SSE` **下线**（`apps/desktop/.env.development:8`、`.env.production:8`、`index-view.ts:148`、`csp-policy.ts:19` 注释、README 两处）。
- `packages/presentation/task/components/dialogs/reminder/*`：**改造**（`viewDetail` 经 props `onOpenTask` 接通、不引 router；`sendNotification` 补 `onClick`）；复用不新建：`shared/utils/notification.ts`（已有 `onClick`）· `reminder-parser.ts`（位掩码）· `sync-config.ts`（`nowCalibratedIso`）· `backfill-triggers.ts`（online/visibility）。
- 服务端 `/sse/reminders`（跨仓 `nao-todo-server/interfaces/routers/sseRouter.go:18`、`interfaces/controllers/sse.go`）：**可延后**（客户端不连即空转，零功能影响）；连带文档 `apps/desktop/README.md:27,48`（Owner rd-fe）· `csp-policy.ts:19` 注释（rd-fe）· `docs/adr/2026-09-10-shell-03-offline-availability.md:427` 只加注不改写（arch）。
- 服务端 reminder cron 的**字段改写**（跨仓 `infrastructure/initialize.go` 的 LoadCron 注册、`infrastructure/cron/reminder.go`、`application/task/appImpl.go:665-686`、`domain/task/service/serviceImpl.go:151-211`）：**本批必做**（不停用 ⇒ 一次性提醒补弹不可达，见 R1）。

## 2. 数据可用性

- Web 本地任务库可用且离线可读：`apps/web/src/hooks/usecases/binding.ts:103` 的 `createTaskRepository = newLocalTaskRepository()`，镜像由 `apps/web/src/data-plane.ts` 填充（阶段二本地优先）。
- `remindAt` 在本地记录上且**明文 + 已建索引**（`persistence-local/db/local-database.ts:86`、`:353`；`converters/task.ts:27/65` 不加密，`name`/`description` 加密）；语义字段齐全：`deletedAt`/`archivedAt`/`givenUpAt`/`state`/`parentTaskId`/`remindRepeat`/`remindTime`/`remindWeekdays`。
- 两个现成坑：`LocalTaskRepoImpl.list()` 默认**只取顶层任务**（`parentTaskId=''`，`:393-394`）、**不排 `done`**（`:380-384` 仅按传入 `state`）⇒ 直接复用会漏子任务、误弹已完成。

## 3. 统一形态落点

- 新目录 `packages/shared/reminder/`：`collect-due-reminders.ts`（纯判定）· `next-occurrence.ts`（续期，镜像服务端语义）· `claim-ledger.ts`（注入 `Storage`）· `create-reminder-engine.ts`（调度/可见性/锁）。
- 端口：`listCandidates()` · `claim(keys)` · `notify(event)` · `consume?(taskId, nextRemindAt|null)` · `now()` · `locks?`。**禁** shared / presentation 内 import `persistence-local`（移动端红线 + DDD 守卫）。
- 装配：`index-view.ts` 以 `newLocalTaskRepository()` 实现 `listCandidates`（需新增直读方法，见 §6）；`showTaskDetails` 已在 `INDEX_VIEW_CONTEXT_KEY`，经 `dialog-adapter.vue` 传入 `TaskReminderDialog`。桌面删扫描器后 `syncTracker.setDirtyListener → rescan` 改在壳内注册。

## 4. Q1 准入口径（可直接写 AC）

- AC-A 可见态：**前台可见**标签页，`remindAt` 到达后 **≤10s** 出现提醒（弹窗 + 系统通知）；精确调度路径下应 ≤1s。
- AC-B 隐藏态：**不承诺**时刻；`visibilitychange→visible` / `focus` / `online` / 系统恢复后 **≤2s** 完成补扫并弹出期间到期项（依据：Chrome 隐藏 ≥5 分钟后定时器降至 1 次/分钟，MDN 记录后台 ≥1s 粗化）。
- AC-C 冷启动补弹：重开/登录后 **≤30s** 内对「本机数据里已到期且未提醒过」的条目补弹一次。
- AC-D 离线：断网下 AC-A / AC-C 同样成立（判定不发网络请求）。
- AC-E 单次性：同一 `taskId@remindAt` 在同浏览器（多标签 + 刷新 + 重开）只弹一次；Snooze 产生新 `remindAt` 视为新条目。

## 5. Q2–Q7 裁示

- **Q2 重复提醒：本期必做**（展示后本地推进 daily/weekly，monthly 仅历史兼容），且服务端 cron 必须同批停用；只响一次 = 既有能力回退，用户可感。
- **Q3 活跃过滤：对齐 ADR D1** —— 排除 `deletedAt`/`archivedAt`/`givenUpAt`/`state=done`，且**不过滤 `parentTaskId`**（子任务今日服务端会弹、桌面漏弹，统一后不得继续漏）。
- **Q4 claim 时机：展示前落账**（先 claim 再开弹窗/发通知）；确认/稍后不参与「是否已提醒」判定，否则刷新即重复，违「只一次」。**Q5 跨标签**：`navigator.locks.request('nao-todo:reminder-scan',{ifAvailable})` 互斥 + `localStorage` 账本为持久判据（写后回读校验），无 Locks 降级 CAS（允许极低概率双弹并留痕）；可测强度 = 注入共享 fake storage/locks 的单元/集成（断言两引擎并发只产 1 条），真机双标签冒烟归用户。
- **Q6/Q7 SSE**：客户端**整体删除**（不留开关，回滚 = 回退版本；双源并存会双提醒、开关漏配即静默改行为）；服务端 `/sse/reminders` 可延后（空转无害），cron 字段改写本批必做，两项合并为下一批跨仓清理 issue。

## 6. NFR 技术翻译

- **轮询与功耗**：基准 10s，仅**可见**时启用；隐藏态停轮询（靠 AC-B 补扫）+ 最近一条精确 `setTimeout` ⇒ 隐藏态额外开销 ≈0。
- **本地库读取**：现成 `list()` 全表**解密 O(N) 次 AES** ⇒ 禁每 10s 复用；需新增候选查询（只读明文列，仅对到期行解密 `name`），索引粗筛后**必须解析时间比较**（服务端 RFC3339 可能带偏移，字符串比较不可靠）。
- **失败与降级**：库不可读/桌面未解锁 ⇒ 不提醒 + 单次告警日志、解锁后补扫；`localStorage` 不可用 ⇒ 内存账本（跨标签/刷新失效，登记已知限制）+ 旧键裁剪；通知权限 `denied` ⇒ 只弹应用内、不重复索权；时钟回拨 ⇒ 判重只看 `remindAt`，`now` 用服务端校准偏移；多设备 ⇒ 各自提醒（口径内）。

## 7. 风险

- **R1（高，阻塞「补弹」）**：服务端 cron 每分钟清空/推进 `remind_at` ⇒ 应用关闭期间到期的一次性提醒在上云后失去到期痕迹，重开无补弹。
- **R2（中）**：只改客户端不停 cron ⇒ 重复提醒双写（本机 vs 服务端），产生 OCC 冲突日志与偶发跳过。
- **R3/R4（中/低）**：沿用现成 `list()` ⇒ 漏子任务、误弹已完成；桌面解锁前无法提醒；claim 账本需 GC；隐藏标签不保证准时（已写入 AC-B）。

## 8. 需拍板（其余口径本人已裁，不再上报）

- **D1 服务端 cron**：A 本批停用（推荐，满足补弹）· B 延后 + 客户端影子账本（成本高、易误弹）· C 延后并接受「一次性提醒不补弹」的降级 AC。
- **D2 重复提醒**：A 本期做（推荐）· B 本期只响一次并写进发布说明「已知变更」。
- **D3 子任务提醒**：A 纳入候选（推荐，与服务端现状一致）· B 不提醒并写进 PRD 非范围。
- **D4 未操作是否复弹**：A 只弹一次（推荐，符合「同一条只补一次」）· B 关闭未操作下次开页再补一次。