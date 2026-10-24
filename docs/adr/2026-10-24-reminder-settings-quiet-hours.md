# ADR：提醒设置（通知 / 声音 / 免打扰）与「跳过本次」

- 状态：提议（待 PM 拍板 DP-1…DP-6；**纯设计，未改任何代码**）
- 更新：2026-10-24
- Owner：arch-designer
- 指针：逐条结论 / 风险 / NFR / 待拍板 = `docs/reports/T530-arch-review.md` · PRD `docs/prds/2026-10-23-reminder-local-polling.md` · 前序 ADR `docs/adr/2026-10-23-reminder-local-judgment.md` · 偏好同步 ADR `docs/adr/2026-09-23-local-preference-sync.md`

## 背景

- `v1.12.15`（`6b0db9ef`）已把提醒判定下移到本机：`packages/shared/reminder` 的 `collectDueReminders` / `nextOccurrence` / `claimLedger` / `createReminderEngine`，顺序硬约束 = **claim → notify → consume**，去重键 `taskId@remindAt`。
- 用户 2026-10-23 追加（已裁定，不需重新选型）：两端（桌面 + 手机浏览器）都要用；本批 4 项 = 提醒设置区（通知/声音/免打扰）· 免打扰静默排队后补弹 · 重复提醒「跳过本次」· 弹窗补清单名与提醒时间 + 权限引导；设置跟账号同步。
- 非范围：多设备只提醒一次 · 桌面托盘常驻/开机自启 · PWA/Web Push。
- 关键既有约束：`shared/reminder` **零 infra 依赖**（端口注入）；偏好面走独立快照（**不入 `syncQueue`**，PS-1/PS-10）；服务端 `preferences` 为**哑存储 JSON**（PS-5）。

## 决策

1. **设置落点 = 复用既有偏好快照，服务端零改动**：`UserConfig.preferences` 增加**可选** `reminder` 子对象（`{ notify, sound, quietHours }`），本地写**身份级** `localStorage` 单键 `REMINDER_SETTINGS`（原子 JSON），变更后 `markPreferenceDirty('userConfig')` 走既有偏好队列。默认 `notify=true` / `sound=true` / `quietHours=null`；远端失败**只影响回传**，本地立即生效。
2. **免打扰门放引擎依赖，不放 `notify` 端口**：新增 `isSuppressed(nowMs)`，在 `collectDueReminders`/`claim` **之前**短路 ⇒ 时段内既不 claim、也不 notify、也不 consume；时段结束（或回前台/重新打开）由既有 10s 轮询 / 可见性补扫补弹一次。时段模型 = **单段、半开区间 `[start, end)`、允许跨天**（`start > end`），`start === end` 视为未启用；非法/缺失 ⇒ **fail-open（不抑制）**。
3. **「跳过本次」= 消费后的 CAS 推进**：只对 `daily/weekly/monthly` 显示；展示前已 claim，故 skip **不新增账本**，仅在「当前 `remindAt` 仍等于事件携带的本次时刻」时推进到 `nextOccurrence(task, now)`，**不 notify**；新键在未来 ⇒ 不会被下轮补弹。一次性提醒不显示该动作；「取消提醒」入口**本批不做**（任务详情现有清空入口保留）。
4. **事件扩展 = `projectId` + `remindAt` + `canSkip`**：`shared/reminder` 只透传数据，**不解析清单名**；清单名由装配层注入弹窗（`getProjectName`），弹窗只负责展示（不引 router / 仓储）；系统通知文案同样在装配层拼装。
5. **权限引导 = 三态 + 一次性 + 设置区常驻**：① `granted` 不提示 ② `denied` 一次性说明「如何重新开启」+ 设置区常驻状态 ③ `unsupported`（iPhone Safari 普通标签页、Android Chrome 页面通知、Samsung Internet 仅 Push API、非安全上下文）一次性说明「仅在应用内提醒」。能力判定以**真实发送失败兜底**（不能只看 `'Notification' in window`）。权限请求改为**设置区开关的用户手势触发**，停止启动时自动索权。
6. **NFR**：设置**每轮扫描读一次**（10s / O(1) / 跨标签天然一致，不做缓存失效）；静默判定时钟 = 既有校准 `deps.now()` 换算**设备本地**分钟数；旧数据缺失取默认；快照版本**保持 1 + 可选字段**，登记「旧客户端整快照覆盖」风险。

## 理由

1. 业务匹配：4 项都可在既有引擎/偏好面上以**加法**完成，不新增服务端实体、不新增同步通道。
2. 技术成熟度：`preferences` 哑存储、偏好队列、`silent` 通知选项、`getServerTimeOffset` 均为现成能力；无需推送基建。
3. 团队能力：改动集中在 `shared/reminder` 接缝 + `index-view` 装配 + 设置面板，与现有端口注入范式一致。
4. 成本：**跨仓 0**（服务端零改动）；主要成本在三种能力差异的**文案与引导**，而非机制。

## 对照过的备选模式

1. **设置载体**
    - A **复用 `preferences` 快照（采纳）** —— 适用：客户端拥有的设置、服务端不需解析；代价：整快照 LWW 的既有局限；零跨仓。
    - B 服务端按字段加列 —— 适用：需要服务端查询/校验；代价：每加一项就跨仓迁移 + DTO；**不采纳**（违 PS-5「哑存储」）。
    - C 仅本地不同步 —— 适用：纯设备偏好；代价：违用户「跟账号走」；**不采纳**。
2. **免打扰门位置**
    - A **引擎依赖 `isSuppressed()`，claim 前短路（采纳）** —— 适用：要求「静默期零副作用」；代价：引擎多一个依赖；可单测/变异。
    - B `notify` 端口内判断 —— 代价：**claim 已落**，静默期结束也不会再弹（永久丢），且重复提醒被卡住；**不采纳**（正是本需求要防的失败）。
    - C `listCandidates` 返回空 —— 代价：语义藏在数据端口、无法区分「免打扰」与「读库失败」，测试不可辨；**不采纳**。
3. **跳过本次**
    - A **展示即消费（现状不动）+ 跳过做 CAS 再推进（采纳）** —— 适用：保持「同一条只弹一次」；代价：需要 `remindAt` 作为 CAS 令牌。
    - B 延后消费到用户操作 —— 代价：关闭/刷新前未操作的提醒会重复补弹，违既有口径；**不采纳**。
    - C 跳过只关弹窗、不推进 —— 代价：重复提醒永久停在这一条；**不采纳**。
4. **权限引导形态**
    - A **设置区常驻状态 + 首次被拦时一次性说明（采纳）** —— 适用：用户既知道现状、又不被反复打扰。
    - B 仅一次性弹窗 —— 代价：错过即无处可查；**不采纳**。
    - C 仅设置区静态说明 —— 代价：用户不知道「为什么没弹」；**不采纳**。
5. **维持现状（不加设置、不做跳过）** —— 适用：只想最小改动；代价：直接违背用户 4 项裁定；**不采纳**。

## 后果与风险

- 正向：免打扰不产生「已消费但没提醒」的永久丢失；跳过不双跳；设置两端一致且离线可用。
- 风险（高）：既有 `sendNotification` **非全函数**（`new Notification` 未 try/catch）；Android Chrome 页面通知被禁用会**构造抛错** ⇒ 引擎 `notify` 抛错后已 claim 未 consume，刷新后弹窗丢失且该键永久不再提醒。必须让通知适配层**永不抛**并记录能力降级。
- 风险（高）：手机浏览器**普遍无法通过页面构造函数发系统通知**（iPhone Safari 普通标签页无 Notification、需添加到主屏；Android Chrome 必须 Service Worker；Samsung Internet 仅 Push API）⇒ 用户对「手机也提醒」的预期需靠引导与发布说明校准（PWA/Web Push 非本批）。
- 风险（中）：旧客户端推送整快照时不带 `reminder` ⇒ 云端字段被覆盖（本地仍在，他端不收敛），登记为已知局限。
- 风险（中）：免打扰结束瞬间 N 条同时补弹 + N 条系统通知（burst），需 PM 在 DP-2 定形态。
- 风险（中）：启动自动索权不在用户手势内（Safari/Chrome 会忽略且不弹），现状路径可能一直停在 `default`；改为设置区手势触发。
- 风险（低）：`silent` 在旧 Safari / iOS 不可用（iOS 本就无页面通知）⇒ 声音开关仅部分平台有效，需能力提示。

## 限制与已知边界

- 不含 PWA / Service Worker / Web Push；关闭应用后无系统级提醒（既有边界）。
- 不含多设备只提醒一次；不含「按账号时区」解释免打扰（按**设备本地时区**，跨时区旅行窗口随本地时间移动）。
- 不含免打扰多时段 / 按星期 / 临时关闭；不含「静默期待弹数量」角标。
- 一次性提醒的「取消提醒」本批不做（沿用任务详情清空入口）。

## 相关指针

- 逐条结论 / 证据行号 / 风险表 / NFR 验收口径 / 连带同步清单：`docs/reports/T530-arch-review.md`
- 提醒本地化前序决策（不改）：`docs/adr/2026-10-23-reminder-local-judgment.md`（「展示即消费」仍成立；skip 是消费后的受 CAS 约束的用户动作）
- 偏好同步口径（PS-1 / PS-5 / PS-8 / PS-10）：`docs/adr/2026-09-23-local-preference-sync.md`

## 参考来源

- [MDN: Notification](https://developer.mozilla.org/en-US/docs/Web/API/Notification) · 访问 2026-10-24 · 页面通知构造函数与权限模型；iOS Safari 普通页面不支持。
- [MDN: Notification: silent](https://developer.mozilla.org/en-US/docs/Web/API/Notification/silent) · 访问 2026-10-24 · `silent` 非 Baseline，部分主流浏览器不支持。
- [Can I use: Notification API silent](https://caniuse.com/mdn-api_notification_silent) · 访问 2026-10-24 · Chrome/Edge 支持、Safari 16.6+ 支持、**iOS Safari 不支持**。
- [Can I use: Web Notifications](https://caniuse.com/notifications) · 访问 2026-10-24 · Chrome for Android 需 Service Worker 注册、iOS Safari 需添加到主屏、Samsung Internet 仅 Push API。
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · 访问 2026-10-24 · 16.4+ 仅「添加到主屏幕」的 Web App 可申请推送，普通标签页不可。
- [Chromium blink-dev: Android is only shipping Service Worker-based Notifications](https://groups.google.com/a/chromium.org/g/blink-dev/c/BygptYClroM) · 访问 2026-10-24 · Android 禁用非 Service Worker 的 `new Notification()`。
- [WebKit: The User Activation API](https://webkit.org/blog/13862/the-user-activation-api/) · 访问 2026-10-24 · 通知权限请求需 transient activation（用户手势）。
- [Chrome for Developers: Requests the notification permission on page load](https://developer.chrome.com/docs/lighthouse/best-practices/notification-on-start) · 访问 2026-10-24 · 页面加载即索权属反模式，可能被忽略。