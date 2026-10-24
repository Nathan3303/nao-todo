# ADR：提醒设置（通知 / 声音 / 免打扰）与弹窗「完成」

- 状态：已接受（已落地 v1.12.16，2026-10-24）
- 更新：2026-10-24
- Owner：arch-designer
- 指针：PRD `docs/prds/2026-10-24-reminder-settings.md` · 报告 `docs/reports/T530-arch-review.md` · 前序 ADR `2026-10-23-reminder-local-judgment.md` · 偏好 ADR `2026-09-23-local-preference-sync.md`

## 背景

- `v1.12.15` 已把提醒判定下移本机：`shared/reminder` 以 `taskId@remindAt` 为键，硬顺序 **claim → notify → consume**。
- 用户 2026-10-24 裁定：两端（桌面 + 手机浏览器）要设置区（通知/声音/免打扰）、免打扰静默排队补弹、弹窗「完成」（原「跳过本次」与确认等价，废弃）、清单名 + 原定时间 + 权限引导；设置跟账号同步。
- 约束：`shared/reminder` 零 infra 依赖（端口注入）；偏好走独立快照、不入 `syncQueue`；服务端 `preferences` 为哑存储 JSON；非范围 = PWA/Web Push、多设备一次、托盘/自启。

## 决策

1. **设置**：`UserConfig.preferences.reminder={notify,sound,quietHours}`（可选，version 1，服务端零改动），本地身份级单键 `REMINDER_SETTINGS`；默认 `true/true/null`，声音经 `silent`，先本地后 `markPreferenceDirty('userConfig')`，远端失败只影响回传。快照三语义：**存在即非空（仅改提醒也推送）**、**置空用显式 `quietHours:null` 传播**、**远端缺 `reminder` 不覆盖本地（仅本地从未设置取默认）**。
2. **免打扰门**：引擎 `isSuppressed(nowMs)` 在 `collectDueReminders`/`claim` **前**短路（零 claim/notify/consume）；单段半开 `[start,end)`，**`start > end` 合法跨天**，`start===end` 关闭，格式非法/缺失 fail-open；结束由既有轮询/可见性补扫，每条补弹一次，不加定时器。
3. **完成动作**：弹窗「完成」= `taskUseCase.update(state:'done')` 成功后出队；引擎展示时已 consume（顺序不变），后续重复提醒因活跃态过滤自然停止。三分类：成功出队；可重试失败（本地写/网络/OCC/离线只读）提示并保留；只读（归档/删除/放弃/他处完成）不写并出队（T193 提示单源）。**不新增引擎端口、不做 CAS**。
4. **事件**：`TaskReminderEvent` 增 `projectId` + `remindAt`（本次原定时刻）；引擎只透传，清单名由装配层注入 `getProjectName`；弹窗只展示，不引 router/仓储。
5. **权限**：三态 `granted/denied/unsupported`（含 granted 但构造失败），一次性设备级说明 + 设置区常驻；不支持时通知/声音开关置灰；索权走设置区用户手势。**适配层为唯一失败边界：内部捕获降级，禁止异常冒到引擎（禁 consume-on-throw）**；能力判定以真实发送兜底（不看 `'Notification' in window`）。
6. **NFR**：设置每轮扫描读一次（10s / O(1) / 跨标签一致，不做缓存失效）；静默时钟 = 校准 `now()` 的设备本地 `HH:mm`；旧数据缺失取默认。

## 理由

1. 业务匹配：全部为既有引擎/偏好面的加法，零服务端实体、零新同步通道。
2. 技术成熟度：`preferences` 哑存储、偏好队列、`silent`、校准 `now()` 均为现成能力，无需推送基建。
3. 团队能力：接缝集中在 `shared/reminder` + 装配层 + 设置面板，沿用端口注入范式。
4. 成本：跨仓 0；主要成本在平台能力差异的文案与引导，而非机制。

## 对照过的备选模式

1. **设置载体**：A 复用 `preferences.reminder`（适用：客户端设置、服务端不解析；代价：整快照 LWW；采纳，零跨仓）；B 服务端按字段加列（适用：服务端需查询；代价：跨仓迁移；否，违 PS-5）；C 仅本地（代价：不跨端；否，违账号同步）。
2. **免打扰门**：A 引擎 `isSuppressed` + claim 前短路（适用：静默期零副作用；代价：多一依赖；采纳）；B `notify` 内判断（代价：claim 已落 ⇒ 永久丢；否）；C `listCandidates` 返回空（代价：无法区分免打扰与读库失败；否）。
3. **弹窗动作**：A「完成」+ 设置区三态/一次性（适用：一键完成、预期可解释；代价：失败需分类；采纳）；B「跳过本次」（代价：展示后已消费，与确认等价；废弃）；C 维持现状（代价：违用户裁定；否）。

## 后果与风险

- **R1（高）**：`sendNotification` 非全函数 + Android Chrome 构造抛错 ⇒ 已 claim 未 consume、该键永久不再提醒；修复 = 适配层内部捕获/降级，**禁 consume-on-throw**（AC10）。
- **R2（高）**：手机浏览器普遍无页面级系统通知（iPhone Safari 无 API；Android Chrome 需 SW；Samsung 仅 Push）⇒ 应用内为准 + 发版说明（DP-1 A）。
- **R3（中）**：免打扰结束 N 条补弹（DP-2 逐条）；旧端整快照覆盖 `reminder`（DP-5 两端同批）；完成失败需分类（AC7/AC13），刷新后本次不补弹。

## 限制与已知边界

- 不含 PWA/Web Push、多设备只提醒一次、桌面托盘/开机自启；关闭应用无系统级提醒；免打扰按设备本地时区，不含多时段/按星期/临时关闭；不提供「跳过本次」，完成不改期/不稍后，取消提醒沿用详情页清空。

## 相关指针

- 证据 / 能力矩阵 / NFR / AC 验收口径 / 风险详表：`docs/reports/T530-arch-review.md`。
- 前序决策（不改）：「展示即消费」仍成立，完成是展示后的任务状态写：`docs/adr/2026-10-23-reminder-local-judgment.md`。
- 偏好口径（PS-1/PS-5/PS-8/PS-10）：`docs/adr/2026-09-23-local-preference-sync.md`。

## 参考来源

- [MDN: Notification](https://developer.mozilla.org/en-US/docs/Web/API/Notification) · 访问 2026-10-24 · 页面通知与权限模型；iOS Safari 普通页面不支持。
- [Can I use: Web Notifications](https://caniuse.com/notifications) · 访问 2026-10-24 · Android Chrome 需 SW、iOS Safari 需添加主屏、Samsung 仅 Push。
- [Can I use: Notification API silent](https://caniuse.com/mdn-api_notification_silent) · 访问 2026-10-24 · iOS Safari 不支持 `silent`。
- [WebKit: Web Push for Home Screen Web Apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · 访问 2026-10-24 · iOS 16.4+ 仅主屏 Web App 可推送。
- [WebKit: The User Activation API](https://webkit.org/blog/13862/the-user-activation-api/) · 访问 2026-10-24 · 通知权限需用户手势。