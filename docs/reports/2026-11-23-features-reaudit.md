# `FEATURES.md` 重盘（`v1.12.17` → `v1.21.0`）

> 审计日 **2026-11-23** · 基线 `v1.21.0`（`CHANGELOG.md:5`，2026-11-22；发版事实 `docs/tasks-state.md` §一之末：PR #363 squash `7e401ae2`）· 方式 = **只读读码 + 只读命令**，未改 `FEATURES.md` / 源码 / 缺陷池。
> 证据口径：`文件:符号` / i18n 键 / 用例名 / 缺陷号。**本文件 `FEATURES.md` §16 实为 18 条**（派单口径写「20 条」，以文件为准，未见漏读）。
> 结论速览：**已实现、应从 §16 移除 = 4 条**（#4 桌面常驻/自启 · #5 自动更新 · #8 字段级合并 · #15 番茄通知）；**部分实现、需改写 = 2 条**（#2 · #17）；**仍成立 = 12 条**。

## 一、§16「已知限制」逐条复核

1. **❌ 多设备只提醒一次 → 仍成立**。账本在引擎内、键 `taskId@remindAt`，端口注入无服务端参与：`packages/shared/reminder/create-reminder-engine.ts`（`ledger.claim` 落在通知**前**、本机持久化）；服务端无账号级去重协议。
2. **❌ 关闭应用后的提醒 / PWA / Web Push → 部分实现，需改写**。仍无 Service Worker / 推送（`apps/web/src` 全仓 `serviceWorker` 0 命中）；但**桌面端「关窗口」已不等于退出**（`apps/desktop/src/main/lifecycle.ts` `createAppLifecycle`：托盘 `available|unconfirmed` ⇒ `preventDefault` + `window.hide()`），真缺口只剩「**托盘菜单「退出」之后**」。建议改写为「退出应用后不再提醒；无 PWA/Web Push（Web 关标签页即静默）」。
3. **❌ 手机浏览器系统通知 → 仍成立**。`packages/shared/utils/notification.ts:sendNotification` 只在 `'Notification' in window` 且 `permission === 'granted'` 时构造，失败返回 `false`，永降级为应用内弹窗（`v1.12.16` 起「不支持」三态 + 声音置灰）。
4. **❌ 桌面托盘常驻 / 开机自启 → 已实现，应从 §16 移除**（`v1.13.0` / `T542`）。托盘 `apps/desktop/src/main/tray.ts:createTray`（`TrayStatus = available|unconfirmed|unsupported`，tooltip 走 `DEFAULT_TRAY_TOOLTIP`）；生命周期 `lifecycle.ts`（`window-all-closed` 常驻态忽略、系统退出信号先置退出位）；自启 `autostart.ts:setAutostart` 四态 `enabled|disabled|not-effective|needs-approval`（Linux 自写 XDG `.desktop`，`shouldAutoEnableAutostart` 默认开）；首关一次性提示 `apps/desktop/src/main/index.ts`（`trayHintShown` 落 `app-settings.ts`）；设置面 `apps/web/src/components/settings/panels/reminder-panel.vue`（`settings.reminder.desktop.*`）。边界：GNOME 无托盘扩展 ⇒ 图标可能不可见（状态显示「可能不显示托盘图标」）、自启需系统批准、休眠/关机期间不提醒。
5. **❌ 自动更新 → 已实现，应从 §16 移除**（`v1.21.0` / Issue #358）。内核 `apps/desktop/src/main/updater/{core,state,install-mode,store,wiring}.ts`，UI `apps/web/src/hooks/use-desktop-updater.ts` + `components/settings/panels/data-panel.vue`（`settings.update.*`）。**能力边界（务必写进正文）**：仅 **Windows NSIS + Linux AppImage 原地更新**；macOS（未签名）与 deb ⇒ `install-mode.ts:resolveInstallMode` 返回 `download-page` ⇒ 状态恒 `unsupported`、**不发任何检查请求**（`core.ts` AC4b），改「打开下载页」；**全量安装包下载**（非增量，约百 MB 级）；**重启后生效**；`autoDownload`/`autoInstallOnAppQuit` 均关；有未同步改动时重启前二次确认。首版不自更新（本版装的即首个带更新能力版本）。
6. **❌ 多时段 / 按星期 / 临时关闭免打扰 → 仍成立**。模型只有单段 `quietHours: {start,end}|null`（`packages/presentation/pomodoro/utils/pomodoro-notify.ts` 入参类型同源），语义 `isWithinQuietHours` 半开区间、允许跨天。
7. **❌ 重复任务 → 仍成立**。全仓 `recurr|recurrence|repeatRule` 生产代码 0 命中；只有 `remindRepeat`（推进提醒时刻，不生成实例）。
8. **❌ 字段级冲突合并 → 已实现，应从 §16 移除**（`v1.19.0` / `T677`）。内核 `packages/infrastructure/src/persistence-sync/field-merge.ts`（纯函数三方合并：`B=fieldBase` / `R=云端` / `L=本地`，`valuesEqual` 单一判等）。**粒度与范围（写进正文）**：仅 **`tasks`**（`R-8`）；合并域 = 推送载荷键集 − `SYNC_COMPARE_IGNORED_FIELDS` − 队列内部字段 − 墓碑 `deletedAt`；**提醒四字段按组原子裁决**（`FIELD_GROUPS`），服务端派生计数恒取云端（`SERVER_OWNED_FIELDS`）；`sortId` 取云端。**`fieldBase` 语义**：写时捕获的字段级基准，**只含「我改过的字段」**（`packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts`），基准缺失 ⇒ 该字段 `R≠L` 即保守判冲突（不猜）。**回滚开关存在**：`localStorage['nao-todo:field-merge-mode'] = 'lww'`（唯一读取点 `field-merge.ts:resolveMergeMode`，ADR `2026-11-10-field-level-merge.md` §生产回滚），无 UI 入口（仅 devtools/控制台）。
9. **❌ 任务级独立归档入口 → 仍成立**。任务详情 footer 只有 `unarchive-todo`（`packages/presentation/task/components/task-details/footer/index.vue:118-149`），无 archive 动作 ⇒ 只能随清单归档。
10. **❌ 找回密码 → 仍成立**。认证路由只有 `signin|signup|checkin`，无 forgot/reset 页与接口调用。
11. **❌ 标签删除可恢复 → 仍成立**（删除即硬删关联，仅二次确认）。
12. **⚠️ 本地数据为明文 → 仍成立**。`packages/infrastructure/src/persistence-local/crypto/crypto-service.ts` 的 `encrypt` 直出 `plain:<原文>`（C-46 明文姿态）；`setup/unlock/ensureUnlocked` 仅为**历史密文**保留（桌面一次性口令迁移仍在）。Web 存储驱逐风险仍成立：全仓 `navigator.storage.persist` **0 命中**。
13. **⚠️ 身份域离线不可写 → 仍成立**（昵称/头像/密码/设备管理仍走远端直连）。
14. **⚠️ 提醒只看本机已同步数据 → 仍成立**（引擎 `listCandidates` 读本地仓储）。
15. **⚠️ 番茄钟通知不受提醒设置约束 → 已实现，应从 §16 移除**（`v1.13.4` / `T573`–`T576`）。`packages/presentation/pomodoro/utils/pomodoro-notify.ts:resolvePomodoroNotifyDecision`：免打扰命中 ⇒ 不发系统通知、改应用内提示；`silent = !settings.sound`；`notify === false` ⇒ 全静默。**残余边界（写进正文 ⚠️）**：免打扰期降级为应用内提示，而桌面窗口已收进托盘时该提示用户看不到。
16. **⚠️ 搜索无时间筛选 / 无用户排序 / 无分页 → 仍成立**。`apps/web/src/components/search/use-search.ts:MAX_ROWS = 5000` 一次性拉取封顶，无「加载更多」，筛选四维不含时间。
17. **⚠️ 命令面板 / 快捷键帮助 / Esc 关弹窗 → 部分实现，需改写**。前两项确为占位：`apps/web/src/commands/app.commands.ts:18`（`$mod+k`）、`:30`（`?`）处理器只 `console.info('… 待实现')`；第三项**功能上已可用但走的不是全局命令** —— `app.modal.close`（`:42`）仍是空实现，且其 `scope: 'modal'` **全仓无进入点**（`useScope` 只有 `'index-view'` / `CALENDAR_KEY_SCOPE`）⇒ 该命令不可达，属死代码；真实 Esc 关闭来自 `NueDialog` 原生 `onEscape`（`components/sync/conflict-dialog.vue:7` 注释即此口径）与局部 handler（`calendar/monthly/quick-create.vue:32`、`views/index/search/entry.vue:219`）。
18. **⚠️ 移动端功能子集 / 不在流水线 / 版本 `0.0.1` → 仍成立**（`apps/mobile` 本批零改动，红线）。

## 二、`v1.12.17` → `v1.21.0` 已上线但文档没写的能力

- **桌面常驻 + 开机自启**（`v1.13.0`）：用户看到「关窗口不退出、到点照样提醒；重启电脑它自己回来」——`apps/desktop/src/main/{tray,lifecycle,autostart}.ts` + `reminder-panel.vue` 桌面常驻块（四态文案）。
- **会话自动续期 + 会话结束横幅**（`v1.13.0` / `v1.15.1`）：常驻不再两天被踢；到期/被顶号有「登录已过期 / 已在其它设备登录」横条 —— `apps/web/src/session-end.ts` + `shared/requester/session-end-reason` + `presentation-identity/sign-in.vue`。
- **番茄通知接提醒设置 + 页签/托盘进度 + 轮次指示 + 「重新开始本周期」**（`v1.13.4` / `v1.14.0`）：`pomodoro-notify.ts`、`formatPomodoroTitle`（`pomodoro/utils/pomodoro-title.ts`）、`resetCycle()`（`stores/pomodoro-timer-store.ts`）。
- **优先级第四档「紧急」**（`v1.14.1`）：`packages/domain-task/src/domain/constants.ts:TASK_PRIORITIES = ['low','medium','high','urgent']`。
- **看板按「状态 / 优先级」分组（入口在「视图」菜单）+ 列内独立分页**（`v1.16.0`–`v1.16.2`）：`components/kanban/use-kanban-group.ts`、`use-kanban-column-paging.ts`（每列 20 条、滚到底加载）。
- **冲突可见性与处置**（`v1.17.0` / `v1.17.3` / `v1.18.2` / `v1.19.1`）：覆盖也留痕、面板说人话、按字段标冲突、「保留我的修改」可用 —— `persistence-sync/{conflict-journal,edit-overwrite}.ts` + `components/sync/conflict-dialog.vue`。
- **同步感知**（`v1.18.0`）：窗口开着时他端改动 ≤30s 自己出现；隐藏零刷新、回可见立刻刷 —— `persistence-sync/auto-refresh.ts`（`AUTO_REFRESH_INTERVAL_MS = 30_000`，门控优先级 隐藏 > 离线 > 脏队列 > 周期）+ `pull-broadcast.ts`（跨标签广播）+ `SyncService.resumeBackfill`（10s 合并门）。
- **刷新不闪 + 编辑保护**（`v1.18.1` / `v1.19.1`）：自动刷新内容不动、失败不清空、正在输入的字不被冲掉 —— 适配器暴露 `refreshError` 走非阻塞提示（`view-adapters/*/use-*-view-adapter.ts`），详情保留编辑中字段（`task-details/use-task-view-object.ts` `persistedText` 基准）。
- **变更审计（活动流）**（`v1.20.0`–`v1.20.2`）：任务详情「更多 → 变更历史」按天分组、来源四态 —— 有界 `packages/infrastructure/src/persistence-sync/audit-log.ts`（`AUDIT_LIMIT = 1000` / `AUDIT_RETENTION_DAYS = 90` / `AUDIT_PRUNE_MAX_PER_RUN = 400`）+ `apps/web/src/hooks/use-task-history.ts` + `task-details/task-history-dialog.vue`。
- **应用内自我更新**（`v1.21.0`）：见 §一 第 5 条；`apps/desktop/src/main/updater/**`。
- **设置页改版**（`v1.21.0` / #360，四分区源起 `v1.12.17`）：左栏导航态高亮（去竖线）、账户四块分区、密码表单不再折叠、间距台阶 L0–L6 每层单源 —— `components/settings/dialog/index.vue`（四个 `id: account|appearance|reminder|data`；`:272-280` 台阶注释）、`panels/account-panel.vue`。
- **设计基座与质量守卫**：`DESIGN.md` §1.4「元素形态取自组件库主题（取用阶梯 ① token → ⑤ 报 PM）」+ `pnpm run guard:contrast`（`scripts/contrast-audit.mjs`，CI 侧 `packages/shared/__tests__/contrast-audit.test.ts` 复用同一阈值/pair 表）。

## 三、未完成 / 有缺陷的能力（排期用）

**A. 占位 UI / 死键（用户按了没反应）**

- 命令面板 `Ctrl/⌘+K`、快捷键帮助 `?`：**功能未完成**。证据 `apps/web/src/commands/app.commands.ts:18/30`（`console.info('… 待实现')`）。
- `Esc` 全局关闭命令 `app.modal.close`：**工程债**（死代码）。证据 同上 `:42`；`scope: 'modal'` 无进入点（`useScope` 仅 `index-view` / `CALENDAR_KEY_SCOPE`）⇒ 永不可达。注意**不要**写成「Esc 不能关弹窗」——弹窗自身可关（§一 第 17 条）。
- 智能创建器：**功能未完成（死键）**。`dialog.taskCreator.smartModeToggle` / `smartPlaceholder` 仅存在于 `packages/shared/locales/{zh-CN.ts:947-948,en-US.ts:982-983,types.ts:918-919}`，UI 0 引用。
- `packages/shared/components/feature-unimplement/`：**工程债**（0 引用，仅 `components/index.ts:10` 导出）；「页面还在规划中」已无任何页面在用。
- 专注记录筛选第二个选择器的清除键从不渲染（`clearabl` 拼写）：**设计缺陷**。`apps/web/src/components/pomodoro/records/filter-panel.vue:64-68`（`DEF-130`，已登记未修）。

**B. 只做了一半（能力有边界，需在正文写清）**

- 字段级合并仅 `tasks`（清单/子任务/评论/标签/番茄仍整行）：**功能未完成**（后续批次）。`field-merge.ts` 模块头 + ADR `2026-11-10-field-level-merge.md` §限制。
- 变更审计仅 `tasks`、仅本机、有界 1000 条 / 90 天：**设计边界**。`audit-log.ts:59-65`；跨端操作者需改服务端协议。
- 应用内更新仅 Win NSIS + Linux AppImage、全量下载、重启生效：**设计边界**（§一 第 5 条）。
- 搜索一次性封顶 5000、无时间筛选 / 无用户排序 / 无加载更多：**功能未完成**。`search/use-search.ts:52`。
- 任务级归档入口缺失：**功能未完成**（§一 第 9 条）。
- 多设备提醒去重缺失（需服务端）：**功能未完成**（跨仓前置）。
- 有未同步改动时「重启更新」的确认有，但**下载中无进度百分比/暂停**：**设计边界**（`data-panel.vue` 状态集 `unsupported|idle|checking|…|ready`）。

**C. 有已知缺陷（未闭环）**

- 桌面端 `Ctrl+R` 刷新后跳回登录页：**缺陷待复现**（`DEF-45`，P2，2026-10-30 降为观察；原假设已被 `bootstrap-local-data.ts:44-49` 证伪，缺一次复现日志）。
- macOS 未公证 + 仅 arm64：**工程债 / 分发缺陷**。`apps/desktop/package.json:37-38`（`identity: "-"`、`hardenedRuntime: false` = B 档 ad-hoc）⇒ `DEF-75` A 档（Developer ID + 公证）挂起（用户 2026-10-21 裁定不开账号）；`DEF-76`（无 Intel 产物）维持挂起。
- 清单/标签自定义图标不跨端：**功能未完成（跨仓）**。`DEF-107`，服务端 `models.Project/Tag` 无 `icon` 列，客户端 `resToEntity` 硬编码 `'more2'` / `'tag'`；用户 2026-10-27 裁定暂缓（需 DDL）。
- 变更历史列表接近满时展开条目出现第二层滚动条：**体验缺陷**。`DEF-162`（`T719`，列表 416px + detail 内滚，双容器）。
- 更新后三处版本一致性（tag / `package.json` / `latest*.yml`）只有人工清单、无自动化：**工程债**。`docs/tasks-state.md` §一之末「本批遗留②」（需 `gh` token 具 `workflow` scope）。
- `t706-qa-prune-cap-probe` 负载相关 flake 未定位（单跑 5 次全绿）：**工程债**（同上 遗留①）。
- `vp staged` 按整棵工作树 stash/恢复（可卷走他人未提交改动）：**工程债**（`DEF-160`，根治属上游）。
- 已闭环、**不应再写进文档**的旧项（避免误报）：`DEF-27`（并入 `DEF-30`，`T521`/`a8e86173` 已闭环）· `DEF-111`（长休 off-by-one，`v1.13.4` 已修）· `DEF-113` / `DEF-125`（优先级第二份 switch 与死件，`v1.15.2` / `v1.16.0` 已清）。

**P0 / P1 判断**：**P0 = 无**（未见数据丢失或功能完全不可用级未修项）。**P1 三条** = ① 占位死键（命令面板 / `?`，按了只打 console）② 任务级归档入口缺失（预期落差，用户以为能单独归档）③ 搜索 5000 封顶且无分页（重度用户搜不全）。**P2** = mac 分发面（未公证 / 仅 arm64）、多设备提醒去重、字段合并仅任务。

## 四、`FEATURES.md` 结构建议（只给结构，不改稿）

- **新增「桌面常驻与开机自启」章**：从 §15/§16 抽出，托盘四态 + 自启四态 + 首关提示 + 「退出后不提醒」边界，一条理由 = 这是 v1.13.0 的招牌能力，现在被写在「❌ 不支持」里。
- **新增「应用内更新（关于与更新）」章，替换 §15 的「❌ 自动更新」**：理由 = 能力已交付但**有清晰边界**（两种安装形态 / 全量 / 重启生效），需要正文承载而非一行 ❌。
- **新增「变更审计（活动流）」章**：理由 = 新的用户面能力（详情 → 更多 → 变更历史），§16 完全没提。
- **新增「同步感知（自动刷新 / 多标签）」章**：理由 = 30s 自动刷新 + 可见性门控 + 跨标签广播改变了「何时会看到新数据」，属 §12 的新前提。
- **扩写「冲突与合并」**：把「✅ 冲突面板」升级为「冲突可见性 + 字段级合并（粒度 / 参与字段 / `fieldBase` / 回滚开关）」两小节；理由 = §16 的 ❌ 已不成立，且回滚开关是运维事实，文档必须留档。
- **§2 优先级改四档并补「紧急」**：理由 = `TASK_PRIORITIES` 已含 `urgent`（v1.14.1），现文写「高/中/低三档」是**错的**。
- **§6.1 看板补两条**：「按状态 / 按优先级分组（入口在视图菜单，不持久化）」「列内独立分页（每列 20 条，滚到底加载）」；理由 = 用户可感的导航变化 + 此前「只有首屏 20 条」的缺陷已修。
- **新增「设计基座与质量守卫」章（合并现 §15 的工程段）**：`DESIGN.md` §1.4 取用阶梯 + §4.5 共享分段件 + `guard:contrast` + 六守卫；理由 = 文档缺一层「为什么界面长这样、改样式怎么取件」的共同前提。
- **§16 瘦身 = 只留 12 条真限制**，把「已实现但有边界」的条目（番茄通知 → 转入 §9 ⚠️；字段合并 / 更新 / 托盘 → 转入正文 ⚠️）；理由 = §16 现在混装「不支持」与「已支持但有前提」两种性质，读者会误判能力。
- **§17 一分为二**：保留「需外部核对」两项（生产 CSP 响应头、服务端提醒 cron 运行期行为）；把已结项的（测试规模口径 → 改为「以命令自证，不写死数字」、`feature-unimplement` → 转 §16 技术债、`README` 明文口径 → 单列「待修 README」）移出；理由 = 存疑栏只该装「本次无法定论」的项。
- **新增「未完成能力与后续批次」小节（指向本文 §三 + `docs/tasks-state.md`）**：理由 = 用户本次诉求就是「列出未完成并排期」，需要文档内的稳定入口。
- **版本头改为「每次发版随 PR 更新 + 计数类数字给自证命令」**：理由 = 现头注停在 `v1.12.17`/`6dd8cd30`，已落后 8 个版本；数字写死必漂移（AGENTS「计数类数字必须一条命令自证」）。