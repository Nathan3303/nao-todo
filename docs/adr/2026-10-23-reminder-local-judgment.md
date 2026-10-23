# ADR：任务提醒本地化（判定权下移本机 + `remind_at` 单写者）

- 状态：已接受（待落地）
- 更新：2026-10-23
- Owner：arch-designer
- 指针：PRD `docs/prds/2026-10-23-reminder-local-polling.md`（Issue #232 · PR #233）· `docs/reports/T526-arch-review.md`（影响面 / NFR / Q1–Q7 裁示）· `docs/tasks-state.md`（T524/T525/T526）· `docs/adr/2026-09-21-reminder-scan-and-recovery.md`（扫描口径 D1/D2）

## 背景

- 用户 2026-10-23 裁定：Web 提醒由 SSE 改本地轮询；Web 与桌面统一一套；判定只以本机已同步数据为准；离线也要提醒；同浏览器只提醒一次；重开补弹一次；准时 ≤10s；通知点击 = 聚焦 + 打开任务详情。
- 现状：Web 连服务端 `/sse/reminders`（`apps/web/src/views/index/reminder-sse.ts`）；桌面已本地扫描（10s 兜底 + 最近一条 `setTimeout` + 内存 `Set` 去重，`apps/desktop/src/renderer/src/hooks/use-local-reminder.ts`）。
- 冲突根因：服务端 cron 每分钟 `ProcessReminders`（`nao-todo-server/infrastructure/initialize.go` 注册；`domain/task/service/serviceImpl.go:151-211`）会**清空一次性提醒的 `remind_at`、推进重复提醒**，而它是用户可见且会同步的字段 ⇒ 与本机判定并存时「到期痕迹」在上云后 ≤60s 被抹掉。

## 决策

1. 判定权归客户端本机（只读本机已同步数据、不依赖网络）；`remind_at` 只保留**一个写者 = 展示提醒的那一端**：展示即消费（一次性 → 清空；daily/weekly/monthly → 推进下一次，next 越过 `endAt` 则清空并停止重复；月度仅对历史数据生效）。消费产生的本地写走**既有同步队列**（不新增通道）；服务端 reminder cron 本批停用（跨仓开关，不删已上线字段）。
2. 共用引擎落 `packages/shared/reminder/`（纯核心 `collectDueReminders` + `nextOccurrence` + claim 账本 + 引擎工厂，依赖一律端口注入），装配点 = `apps/web/src/views/index/index-view.ts`（桌面经 `@nao-todo/webapp` 复用同一壳），桌面自有扫描器下线。
3. 单次性 = **展示前**写持久 claim 账本（键 `taskId@remindAt`，localStorage）+ Web Locks 跨标签互斥（不可用则 CAS 降级）；应用内弹窗与系统通知点击统一走「聚焦 + 路由到该任务详情」。

## 理由

1. 业务匹配：唯一能同时满足离线提醒 + 重开补弹 + 两端一套的形态（服务端推送在离线时本就不可达）。
2. 技术成熟度：轮询 + 持久账本 + Web Locks 均属基线能力（Locks 2022-03 起 Baseline），无新依赖、无需推送基建。
3. 团队能力：复用既有本地仓储、`nowCalibratedIso` 时钟校准、`registerBackfillTriggers` 触发源、`sendNotification` 封装，新增面小。
4. 成本：客户端 ≈1 个新目录 + 3 处接线；跨仓只有「停用 cron 注册」一处开关，可回滚。

## 对照过的备选模式

1. **维持现状（服务端 cron + SSE）** —— 适用：始终在线、单端；代价：离线无提醒、无补弹、两端两套。不采纳：不满足用户裁定。
2. **本机轮询但保留服务端写权（cron 照旧）** —— 适用：只想换传输层；代价：一次性提醒的到期痕迹被服务端 ≤60s 抹掉 ⇒ 补弹不可达；重复提醒双写产生 OCC 冲突噪声。不采纳。
3. **本机轮询 + 客户端消费 + 停用服务端 cron（采纳）** —— 适用：以本机数据为准、离线可用；代价：需跨仓一处开关 + 多设备各自提醒（符合「同浏览器一次」口径）。
4. **本机轮询 + 影子账本（不改服务端）** —— 适用：无法推动跨仓；代价：第二份「提醒日程」真源，他端改期后易误弹。降为备选（报告 D1-B）。
5. **Service Worker + Web Push** —— 适用：关闭应用也要提醒；代价：推送基建 + 订阅管理 + SW 生命周期，且超出「只以本机数据为准」。本期不采纳，登记为演进方向。

## 后果与风险

- 正向：离线 / 刷新 / 多标签行为一致且可单测；提醒判定与同步链路解耦。
- 风险：多设备各弹一次（口径内）；桌面解锁前不提醒；后台标签被节流（best-effort，见报告 AC-B）；claim 账本需 GC；跨仓发布顺序（服务端先停 cron，再发客户端）。

## 限制与已知边界

- 不含移动端（`packages/presentation-react` / `apps/mobile` 红线）；不含跨设备去重；不含应用关闭后的系统级提醒（无 SW / 推送）。
- 月度重复仅兼容历史数据（UI 已隐藏该选项），本地续期语义对齐服务端 `calculateNextRemindAt`。

## 相关指针

- 影响面清单 / 数据可用性 / Q1–Q7 裁示 / NFR 翻译 / 待拍板：`docs/reports/T526-arch-review.md`
- 跨仓回滚耦合：服务端开关与客户端必须**同批回退**（禁只恢复服务端开关而保留新客户端）→ PRD `docs/prds/2026-10-23-reminder-local-polling.md` §八
- 扫描口径来源：`docs/adr/2026-09-21-reminder-scan-and-recovery.md`（D1 排除 done / 归档 / 放弃；D2 不清 `remind_at` 实现暂停恢复）

## 参考来源

- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) · 访问 2026-10-23 · 隐藏页的定时器受浏览器策略节流，需以可见性事件补扫
- [Heavy throttling of chained JS timers beginning in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88) · 访问 2026-10-23 · 隐藏 ≥5 分钟后链式定时器降至 1 次/分钟 ⇒ 后台不承诺 ≤10s
- [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) · 访问 2026-10-23 · 跨标签互斥原语，2022-03 起 Baseline（需安全上下文）
- [Window: setInterval()](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval) · 访问 2026-10-23 · 后台/非活动标签存在 ≥1s 粗化