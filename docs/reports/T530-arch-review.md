# T530 提醒功能补齐（一档）：影响面 / 口径评估

- 状态：评审完成（**纯设计，未改代码**）· 更新：2026-10-24 · Owner：arch-designer
- 指针：ADR `docs/adr/2026-10-24-reminder-settings-quiet-hours.md` · 前序 ADR `docs/adr/2026-10-23-reminder-local-judgment.md` · PRD `docs/prds/2026-10-23-reminder-local-polling.md` · 偏好 ADR `docs/adr/2026-09-23-local-preference-sync.md`
- 口径：`rg`/`grep` 穷尽清点 + `read --offset/--limit` 行段读码；`pi-codegraph` 已卸载 ⇒ 影响面为 grep 口径（可能漏 `import.meta.glob` 类动态加载，本需求不涉）；服务端仅只读核对（`nao-todo-server`），**未改任何仓库代码**。

## 0. 结论摘要

| #      | 问题                       | 结论                                                                                                                                                                                                                                                                                                                                                                                                              |
| :----- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | 设置落点与同步契约         | **可行，跨仓零改动**。复用 `UserConfig.preferences` 快照加可选 `reminder`；本地身份级 `localStorage` 单键 `REMINDER_SETTINGS`；默认 `notify=true` / `sound=true` / `quietHours=null`；本地优先、远端失败只影响回传。**必须在同批改 3 处快照函数**（`build` / `isSnapshotEmpty` / `apply`），否则会出现「只改提醒不推送」或「远端值拉不下来」。                                                                    |
| **Q2** | 免打扰对引擎的影响（关键） | **门必须放引擎 deps（`isSuppressed(nowMs)`），且在 `collectDueReminders` / `claim` 之前**；放 `notify` 端口**必然永久丢**（claim 已落 + 不会 consume）。时段 = **单段半开区间 `[start, end)`、允许跨天**；结束时由既有轮询 / 可见性补扫补弹（≤10s / 回前台 ≤2s），**无需新触发器**；非法/缺失 **fail-open**。                                                                                                     |
| **Q3** | 跳过本次                   | 语义 = **展示前已 claim**，skip **不再落账**，只做「`remindAt` 仍等于本次时刻」的 **CAS 推进**到 `nextOccurrence(task, now)`，**不 notify**。新键在未来 ⇒ 下轮不会补弹；旧键保留即幂等。⚠️ **不能**简单「再 consume 一次」——引擎已在 notify 后消费过，会双跳。一次性不显示；**取消提醒入口本批不做**（详情页现有清空入口保留）。                                                                                  |
| **Q4** | 弹窗补清单名 + 提醒时间    | `TaskReminderEvent` 加 **`projectId` / `remindAt` / `canSkip`**（不加 `projectName`）；清单名由**装配层注入弹窗**（`getProjectName`），引擎不依赖 infra；弹窗只展示，**不引 router / 仓储**（现状已如此）。超期补弹建议标注「原定 …」。                                                                                                                                                                           |
| **Q5** | 权限引导                   | 三态 = `granted` / `denied` / `unsupported`（含 iPhone Safari 标签页、Android Chrome 页面通知、Samsung Internet 仅 Push API、非安全上下文）。**不能只靠 `'Notification' in window`**：Android Chrome 有该对象但构造抛错 ⇒ 以**真实发送失败兜底**标记 unsupported。一次性 = **设备级 ack**；设置区**常驻状态** + 首次被拦时一次性说明；索权改为**设置区用户手势**触发（现状启动自动索权会被 Safari/Chrome 忽略）。 |
| **Q6** | NFR                        | 每轮扫描读设置（10s / O(1) / 跨标签天然一致，**不做缓存**）；静默时钟沿用 `getServerTimeOffset` 校准后的 **`now()`**；旧数据缺失取默认；快照版本**保持 1 + 可选字段**；跨时区按**设备本地**；非法配置 fail-open。                                                                                                                                                                                                 |
| **Q7** | 需拍板                     | 6 项，见 §11；其中 **DP-1（手机端系统通知不可用的预期校准）** 必须由用户确认。                                                                                                                                                                                                                                                                                                                                    |

**可行性总结论：有条件可行** —— 客户端 4 项均可加法落地、无服务端改动；条件 = ① 免打扰门位置按 Q2 ② 通知适配层改成永不抛（见 R1）③ DP-1/DP-2 拍板。

## 1. 现状核对（证据）

**提醒引擎（本批要动的接缝）**

- `packages/shared/reminder/create-reminder-engine.ts:103-134`：`performScan` = `listCandidates` → `collectDueReminders` → 逐条 `ledger.claim`（115）→ 组 `event`（116）→ `await deps.notify`（122）→ `await deps.consume(taskId, nextOccurrence(task, now))`（127-129）→ `schedulePrecise`（134）。**claim 在 notify 之前** ⇒ 静默门若放 notify 内必丢。
- `packages/shared/reminder/types.ts:54-77`：`ReminderEngineDeps` = `listCandidates` / `now` / `ledger` / `notify` / `consume?` / `requestNotificationPermission?`；**无静默/清单名/跳过端口**。
- `packages/shared/types/reminder.ts:7-11`：`TaskReminderEvent` 仅 `taskId` / `taskName` / `description` ⇒ 缺清单、提醒时间、可跳过标记。
- `packages/shared/reminder/collect-due-reminders.ts:35-52`：到期判定纯函数、闭区间 `remindAt <= now`、键 `taskId@remindAt`（`reminderKey`）。
- `packages/shared/reminder/next-occurrence.ts:70-102`：`nextOccurrence` 以**传入触发时刻**为基准推下一次（`now` 口径），与「跳过」CAS 必须同源。

**装配与弹窗**

- `apps/web/src/views/index/index-view.ts:171-186`：`notify` = 先 `appDialogManager.open(TASK_REMINDER_DIALOG_KEY, event)`，再 `sendNotification(...)`；`consume` = `taskUseCase.update(taskId, { remindAt: next })`；`requestNotificationPermission`（165-169）在引擎 `start` 时自动调用。
- `packages/shared/utils/notification.ts:22-35`：`sendNotification` **无 try/catch**，`new Notification` 抛错会穿透到引擎 `notify`（引擎 catch 后 `continue` ⇒ **已 claim、未 consume**）。
- `packages/presentation/task/components/dialogs/reminder/task-reminder.vue` + `use-task-reminder.ts`：弹窗已有队列 / 进度 / 确认 / 稍后 / 点任务名跳详情（经 props `onOpenTask`，不引 router）；动作只有「确认 / 稍后」，**无跳过**。
- `packages/presentation/task/components/dialogs/reminder/type.ts`：props = `dialogManager` / `taskUseCase` / `onOpenTask?` ⇒ 加 `getProjectName?` / `onSkip?` 即可，无需引入仓储。
- `packages/infrastructure/src/persistence-local/repos/task-reminder-candidates.ts:25-55`：候选直读本机 `tasks` 表，`record.projectId` **已有但未透出**；`name` / `description` 仅对到期行解密。

**偏好设置面（本批复用处）**

- `packages/infrastructure/src/persistence-sync/preference-sync.ts:72-83`：快照形状 `{ version:1, builtInProjectPreferences, asideWidth, calendar }`；`buildUserConfigSnapshot`（151-164）、`isSnapshotEmpty`（166-172）、`applyUserConfigSnapshot`（174-195，按字段**存在性**覆盖）。
- 同文件 `:198-212` LWW 只用服务端时间；`:300-318` 推送整快照 `PUT /user/config`；`:414-416` 成功后写 `SETTINGS_SYNCED_AT`；`:456-500` 拉取合并（远端新 ⇒ 应用；无远端 ⇒ 本地非空则入队）。
- `packages/infrastructure/src/persistence-sync/preference-queue.ts`：`userConfig` **每用户一条**、2s 防抖、失败退避；**不入 `syncQueue` / 不计业务 pending**（PS-1/PS-10）。
- **服务端已有承载**（只读核对）：`nao-todo-server/domain/identity/entities/userConfig.go:12-14`、`infrastructure/persistence/models/user.go:76`（`json` nullable）、`application/user/dto/user.go:55-64`（`Preferences` 可选、空串=清除）、`interfaces/types/user.go:54-72`。⇒ **`user_configs` 无需加字段**，`preferences` 内新增 key 服务端不解析。
- `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts:26-39`：设备级白名单（保留）；`:117` 白名单外一律清 ⇒ **提醒设置必须是身份级**（登出清、切号不串），并登记进 `USER_SCOPED_STORAGE_KEYS` 供审计/测试断言。

**设置入口/端**

- `apps/web/src/components/settings/dialog/index.vue`：设置对话框三区（个人资料 / 密码 / 应用）；`app-setter/index.vue:24-45` 为「应用」区（语言 / 主题 / 本地数据声明 / 版本）。
- `apps/desktop/src/renderer/src/AppRoot.vue:60` 注释：桌面复用 webapp 壳内的共享提醒引擎 ⇒ **桌面与手机浏览器（web 响应式）共用同一设置区与引擎**；`packages/presentation-react` / `apps/mobile` **零改动**（红线）。

## 2. Q1 设置的落点与同步契约

### 2.1 承载能力：**能承载，且不需要服务端加字段**

| 方案                                         | 结论 | 理由                                                                                                                                            |
| :------------------------------------------- | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. `preferences.reminder` 子对象（采纳）** | ✅   | `preferences` 已是 versioned 哑存储（PS-5），新增 key 零跨仓、零迁移；设置变更走既有 `userConfig` 队列项（2s 防抖、失败退避、LWW 服务端权威）。 |
| B. `user_configs` 按字段加列                 | ❌   | 每加一项就跨仓迁移 + DTO + 校验；违「服务端不解析客户端设置」的既有裁定。                                                                       |
| C. 仅本地 localStorage                       | ❌   | 违用户「跟账号走、两端一致」。                                                                                                                  |
| D. 复用 `project_preferences`                | ❌   | 不是清单偏好；且移动端共用该 REST（PS-3），不得改语义。                                                                                         |

**答案：不需要在 `nao-todo-server` 的 `user_configs` 加字段**（标「跨仓必做：无」）。若未来需要服务端查询/校验某设置（如服务端也要按免打扰抑制推送），再单独立项。

### 2.2 键名 / 默认值 / 形状（建议）

- 快照路径：`preferences.reminder = { notify, sound, quietHours }`；`reminder` 整体**可选**（旧数据缺失 = 未设置）。
- 本地：单键 `REMINDER_SETTINGS`（身份级，原子 JSON；不建议拆 3 个键 —— 免打扰是 start/end 成对写入，拆键会出现半更新）。
    - `notify: boolean`（系统通知开关；**不控制应用内弹窗**）
    - `sound: boolean`（系统通知自带声音，映射 `silent: !sound`；不新增音频素材）
    - `quietHours: { start: 'HH:mm', end: 'HH:mm' } | null`（单段、可跨天；`null` = 关闭）
- 默认值：`notify=true`、`sound=true`、`quietHours=null` ⇒ **默认行为与 `v1.12.15` 完全一致**（无静默、有通知、有声音），不做静默行为回退。
- 兼容：缺失 / 类型不符 / `HH:mm` 非法 / `start === end` ⇒ 取默认（免打扰按**关闭**处理，fail-open）。

### 2.3 同步路径与失败语义

1. 用户在设置区改 → **先写 `REMINDER_SETTINGS`**（同步成功、立即生效）→ 再 `markPreferenceDirty('userConfig')`（fire-and-forget）。
2. 引擎每轮扫描读本地键 ⇒ 本地改动**下一次扫描**即生效（≤10s），无需等回传。
3. 2s 防抖后推送**整快照**（含 `reminder`）；网络/业务失败 ⇒ 队列退避，**不阻断**、不改本地；凭证失败 ⇒ 既有会话失效路径。
4. 他端改 ⇒ 启动/登录拉取，LWW 远端胜时 `applyUserConfigSnapshot` 写本地键（含把 `quietHours` 写 `null` = 清除）⇒ 引擎下一轮生效。
5. 登出清库：身份级键被清（既有白名单驱动）；**未回传的改动会丢失**（既有 R-11，沿用登记，不在本批修）。

### 2.4 必改点（漏改的后果）

- `buildUserConfigSnapshot`：不加读取 ⇒ **改了提醒但推送不带它**（他端永远拿不到）。
- `isSnapshotEmpty`：不加判断 ⇒ 「只有提醒设置」的用户在首次登录拉取分支**不会入队**（`pullAndMergeUserConfig` 的「无远端偏好」分支）。
- `applyUserConfigSnapshot`：不加应用 ⇒ 远端胜时**拉不下来**；且必须支持显式 `null` 清理。
- 版本：**保持 `version: 1` + 可选字段**。旧客户端不读 version，bump 不提供保护；真正的保护是「两端同批发布」（见 R4）。

## 3. Q2 免打扰对引擎的影响（关键裁定）

### 3.1 门的位置：**引擎 deps，claim 之前**

```
listCandidates → now → isSuppressed(now)? →（true ⇒ 直接返回，不 claim/notify/consume）→ collect → claim → notify → consume
```

| 候选                                                                         | 裁定 | 理由                                                                                                                           |
| :--------------------------------------------------------------------------- | :--- | :----------------------------------------------------------------------------------------------------------------------------- |
| **A. 引擎 deps `isSuppressed(nowMs)`，`collectDueReminders` 前短路（采纳）** | ✅   | 满足「时段内零副作用」；可用变异测试锁死（去掉门 ⇒ claim 必须发生）；不依赖 infra。                                            |
| B. `notify` 端口内判断                                                       | ❌   | **claim 已落**（115 行在 notify 前）⇒ 时段结束也永不再弹；一次性提醒永久失效、重复提醒序列卡住。**这正是本需求要避免的失败。** |
| C. `listCandidates` 返回空                                                   | ❌   | 语义藏在数据端口，无法区分「免打扰」与「读库失败」；测试不可辨、排障困难。                                                     |
| D. 只抑制系统通知、仍弹应用内                                                | ❌   | 用户裁定「时段内**不弹**」（含应用内）。                                                                                       |

- 调用时机：取 `now = deps.now()` 之后、`collectDueReminders` 之前，**一次扫描只判一次**（避免边界前后不一致）。
- 扫描顺序不变：静默时不 claim / 不 notify / 不 consume；`schedulePrecise` 可照旧执行（无害），**不新增触发器**。
- 隐藏标签：静默期间本就不轮询；`visibilitychange → visible` / `focus` 的既有补扫会在时段结束后补弹（沿用 AC-B ≤2s）。

### 3.2 时段模型（建议口径，可直接写 AC）

- **单段**（不做多段 / 按星期 / 临时关闭）；一个 `[start, end)`。
- **跨天**：`start > end` ⇒ 命中条件 `m >= start || m < end`；`start < end` ⇒ `m >= start && m < end`。
- **半开区间**：`start` 当刻已静默、`end` 当刻**不再静默**（正好在 08:00 补弹，避免「闭区间两端重叠」与「永远多静默一分钟」）。
- `start === end` ⇒ 视为关闭（否则等于全天静默，是配置事故）。
- 边界粒度 = 分钟；判定用 `deps.now()`（校准后）→ `Date` 的**设备本地**时区取 `HH:mm`。
- 非法/缺失 ⇒ **不抑制**（宁可多提醒，不可静默吞掉）。

### 3.3 时段结束的补弹触发

- 可见态：10s 轮询即覆盖（≤10s，符合既有准时口径）。
- 隐藏后回来：`visibilitychange` / `focus` 既有补扫（≤2s）。
- 冷启动：`start()` 首轮补扫（≤30s）。
- 结论：**不新增定时器**；「时段结束」不是独立事件，只是「下一次扫描时不再被抑制」。

## 4. Q3 「跳过本次」

### 4.1 语义与账本

- 展示前已 `claim(taskId@本次remindAt)` ⇒ **旧键已在账本**。skip 的正确形态 = **推进 `remindAt`**（新键在未来）⇒ 下轮不会把它当到期项补弹；**无需额外落账**。
- 「不记错过」在本项目**没有独立错过实体**：账本 + 推进即等价语义；不新增「missed」记录。
- 一次性提醒：**不显示**该动作（用户裁定）；「取消提醒」**本批不做** —— 现有任务详情日期选择器可清空 `remindAt`（`empty string` 与 `null` 同义，`task-date-selector.vue:58`），能力不缺失。

### 4.2 实现约束（防双跳，硬性）

- 引擎**已在 notify 后立即 consume**（`nextOccurrence(task, now)`）。用户点「跳过」时，当前 `remindAt` 通常**已是下一次**。
- 因此 skip 必须带 **CAS 令牌 = 事件携带的本次 `remindAt`**：
    - 当前 `remindAt` ≠ 令牌 ⇒ **no-op**（说明已被消费，不能二次推进）。
    - 相等 ⇒ 推进到 `nextOccurrence(task, now)`（**与引擎同一 now 口径**，不得用「本次时刻 + 1」推算，否则隔天补弹会算出过去时间 ⇒ 立刻再弹）。
- 与既有 ADR 的关系：**不推翻** `2026-10-23` 的「展示即消费」；skip 是消费后的用户追加动作，受 CAS 约束。
- 交互建议：仅 `canSkip=true`（`daily/weekly/monthly`）显示；点击后出队 + 轻提示（是否提示见 DP-4）。

## 5. Q4 弹窗信息（清单名 + 提醒时间）

### 5.1 事件扩展

`TaskReminderEvent` 增加（**纯数据，不改语义**）：

- `projectId: string`（候选记录已有，透出即可）
- `remindAt: string`（**本次触发时刻**，不是推进后的值；引擎在 consume 前组事件，天然正确）
- `canSkip: boolean`（引擎按 `remindRepeat ∈ {daily, weekly, monthly}` 计算）

**不把 `projectName` 放进 `shared/reminder`**：`shared` 禁止 import infra；且项目名在本机是加密列，引擎每轮解析会引入额外解密（O(项目)）与冷启动空值问题。

### 5.2 清单名来源（两种，推荐第一种）

| 方案                                                                   | 结论 | 代价                                                                                                        |
| :--------------------------------------------------------------------- | :--- | :---------------------------------------------------------------------------------------------------------- |
| **A. 弹窗注入 `getProjectName`（装配层提供，采纳）**                   | ✅   | 与 `onOpenTask` 同范式；弹窗只展示，不引 router/仓储；项目 store 未就绪时回退「清单」文案，不空白、不阻塞。 |
| B. 引擎 deps 注入 `resolveProjectName(projectId)`（infra 实现 + 缓存） | 备选 | 系统通知冷启动也能带清单名；但每轮多一次查询/解密（需按扫描缓存），引擎接缝变宽。                           |
| C. 弹窗直接 import project store / 仓储                                | ❌   | 跨包耦合 + 违「弹窗只展示」；presentation-task 目前只依赖 task store。                                      |

- 系统通知正文：由装配层拼 `任务名 · 清单名`（清单名取不到则只留任务名）；标题保持「任务提醒」（动作语义）。
- 提醒时间展示：用 `dayjs`（presentation-task 已在用）+ i18n；**补弹条目标注「原定 …」**，避免「昨晚 23:00 的提醒今早才弹」被误读为刚到期（是否做见 DP-4 附注）。
- 弹窗布局：清单名 + 提醒时间放详情区（C 端卡片式，不新增表头/网格；文案不露 `projectId` / `remindAt` 等内部键名）。

## 6. Q5 权限引导

### 6.1 三态判定

| 状态            | 判定           | 用户看到                                                                                    | 提醒表现                                         |
| :-------------- | :------------- | :------------------------------------------------------------------------------------------ | :----------------------------------------------- |
| ① `granted`     | 支持且已授权   | 设置区显示「已开启」                                                                        | 应用内弹窗 + 系统通知（声音按开关）              |
| ② `denied`      | 支持但被拒     | 一次性说明「浏览器已阻止通知，如何重新开启」（站点设置路径）+ 设置区常驻「已关闭 / 去开启」 | 仅应用内弹窗；**不重复索权**（浏览器也不会再弹） |
| ③ `unsupported` | 无页面通知能力 | 一次性说明「此浏览器不支持系统通知，提醒仅在应用内显示」+ 设置区常驻「不支持」              | 仅应用内弹窗；**隐藏/关闭声音开关或标注不可用**  |

**能力判定要点**：

- `'Notification' in window` **不足以**判定支持：Android Chrome 存在 `Notification` 但**页面构造被禁用**（仅 Service Worker 通知），`new Notification()` 抛 `TypeError`。
- 推荐判据 = `Notification.permission` 读得到 **且**真发送时 `try/catch`：首次抛错 ⇒ 记 `unsupported`（本会话/持久标记），后续不再尝试、不产生异常开销。
- 非安全上下文（http 非 localhost）同样视为 `unsupported`。
- iOS：Safari **普通标签页无 Notification API**；16.4+ 仅「添加到主屏幕」的 Web App 可推送（本批非范围）⇒ 文案**不承诺**手机锁屏提醒。

### 6.2 一次性与常驻

- 一次性 = **设备级** ack（权限是「本浏览器/本设备」属性，不是账号属性）：建议 `REMINDER_NOTICE_ACK`（值记录已提示的状态），需显式加入 `DEVICE_LEVEL_STORAGE_KEYS`（否则登出被清、重复打扰）。
- 触发时机：**首次「因权限/能力缺失而只剩应用内弹窗」时**显示一次；设置区常驻状态行随时可查（两者不是二选一）。

### 6.3 索权时机（行为变更，需拍板）

- 现状：引擎 `start()` 自动 `requestPermission`（`create-reminder-engine.ts:211-234`；`index-view.ts:165-169` 仅 `default` 时请求）。
- 问题：Safari / Chrome 的权限提示要求 **transient user activation**；页面加载/启动时自动请求会被忽略（或被视为反模式），权限可能永远停在 `default` ⇒ 用户永远收不到系统通知，也没有引导入口。
- 建议：**设置区「开启系统通知」开关点击时索权**（用户手势）；引擎侧不再自动索权（或仅在用户已显式开启后重试）。这属用户可感的行为变更，列入 DP-3。

## 7. Q6 NFR

| 项           | 口径                                                                              | 说明                                                                                                                                                        |
| :----------- | :-------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 设置读取频率 | **每轮扫描读一次**（10s；`localStorage.getItem` O(1)）                            | 不做缓存/失效通知：读成本可忽略，且**跨标签天然一致**（同源共享），避免「缓存陈旧导致静默不生效」。设置面板另行在打开/聚焦时重读。                          |
| 静默判定时钟 | 沿用 `deps.now()`（`Date.now() + getServerTimeOffset()`）换算**设备本地** `HH:mm` | 与 `remindAt` 判定同源，避免两套时钟在边界打架；偏移为秒级，免打扰边界容忍 ±10s。**免打扰不是冲突判定**，不触 PS-8（PS-8 只约束偏好 LWW）。                 |
| 跨天 / 时区  | 单段半开区间；跨天时“开始晚于结束”（如 22:00–08:00）                              | 按设备本地时区：旅行时窗口随本地时间移动（符合直觉）；多设备不同时区 ⇒ 同一设置在不同绝对时间生效，登记为已知边界。夏令时按本地墙钟，跳过的小时自然不命中。 |
| 设置项上限   | 3 项 + 1 个时段（2 个 `HH:mm`），无用户自定义列表                                 | 无需上限/分页；校验：`HH:mm` 正则、`start !== end`、单段。快照体积 < 200B。                                                                                 |
| 向后兼容     | 缺失/非法 ⇒ 默认（`true/true/null`，fail-open）                                   | 与服务端哑存储兼容；`apply` 按字段存在性覆盖，旧端缺字段不影响本地。                                                                                        |
| 版本         | 快照 `version` **保持 1**，`reminder` 可选                                        | 旧客户端不读 version，bump 无保护作用；真正的兼容风险见 R4。                                                                                                |
| 性能         | 静默期零额外 I/O（除 read 设置）；不新增定时器                                    | 10s 轮询既有；隐藏态停轮询既有。                                                                                                                            |
| 可观测       | 静默期不产生 claim（可用账本长度/内容直接断言）                                   | 无需新增指标；设置同步失败沿用 `syncStatus.preferenceFailedCount` 可见计数。                                                                                |

## 8. 风险清单

| #       | 级别 | 风险                                                                                                                                                                         | 影响                                                                                                                       | 应对                                                                                                                                        |
| :------ | :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1**  | 高   | `sendNotification` **非全函数**（`new Notification` 无 try/catch）；Android Chrome 页面通知被禁用 ⇒ 构造抛错                                                                 | 引擎 `notify` 抛错后 **claim 已落、consume 未执行** ⇒ 该键永久不再提醒；若弹窗随刷新丢失，用户完全看不到；重复提醒序列卡住 | 通知适配层改为**永不抛**（try/catch + 能力降级标记）；`sendNotification` 内部兜住构造异常；补一条「notify 抛错」契约测试，明确账本/消费语义 |
| **R2**  | 高   | 手机浏览器普遍**无法通过页面构造函数发系统通知**（iPhone Safari 普通标签页无 Notification / 需添加到主屏；Android Chrome 必须 Service Worker；Samsung Internet 仅 Push API） | 用户以为「手机也会弹通知」，实际只有应用内弹窗 ⇒ 预期落差                                                                  | 三态引导 + 设置区状态 + 发布说明写清「手机端仅应用内提醒」；PWA/Web Push 非本批（DP-1）                                                     |
| **R3**  | 高   | 免打扰门放错位置（notify 内 / claim 之后）                                                                                                                                   | 静默期提醒**永久丢**（账本已落、不会再弹）                                                                                 | 门固定在 claim 前；加**变异测试**（移除门 ⇒ claim 必须发生；门生效 ⇒ 账本无新键）                                                           |
| **R4**  | 中   | 旧客户端推送**整快照**不含 `reminder` ⇒ 覆盖云端字段                                                                                                                         | 他端拉不到提醒设置；本端本地仍在，直到再次修改才回传                                                                       | 两端**同批发布** + 发布说明；或后续做「未知字段保留」（需缓存上次远端快照，另单）；登记已知局限                                             |
| **R5**  | 中   | 启动自动索权不在用户手势内                                                                                                                                                   | Safari/Chrome 忽略 ⇒ 权限常 `default`，系统通知永远不可用且无引导                                                          | 改为设置区手势触发（DP-3）；设置区显示当前权限状态                                                                                          |
| **R6**  | 中   | 「跳过」若实现成「再 consume 一次」                                                                                                                                          | **双跳**：跳过下一次（用户看到日期少了一天）                                                                               | CAS（`remindAt === event.remindAt`）+ 用 `now` 计算下一次；单测覆盖「引擎已消费后点击跳过」                                                 |
| **R7**  | 中   | 免打扰结束瞬间 N 条同时补弹 + N 条系统通知                                                                                                                                   | 弹窗/通知风暴（尤其 08:00）                                                                                                | DP-2 拍板：逐条 / 汇总一条 / 弹窗逐条但系统通知汇总一条                                                                                     |
| **R8**  | 低   | 声音开关依赖 `silent`；iOS Safari 不支持（且无页面通知），Safari < 16.6 不支持                                                                                               | 开关在部分平台无效                                                                                                         | 能力不支持时置灰 + 说明；文案明确「使用系统通知自带声音」                                                                                   |
| **R9**  | 低   | 远端应用设置时设置面板已打开                                                                                                                                                 | 面板显示旧值（同页不会收到自己的 `storage` 事件）                                                                          | 面板打开/聚焦时重读；本页写入后同步本地状态                                                                                                 |
| **R10** | 低   | 登出清库清掉 `REMINDER_SETTINGS` 与未回传队列                                                                                                                                | 换账号回默认；未推改动丢失（既有 R-11 口径）                                                                               | 沿用既有登记，不在本批修；不做「设备级」以免串号                                                                                            |
| **R11** | 低   | 通知开关关闭 + 标签隐藏时到点                                                                                                                                                | 应用内弹窗在后台打开、消费已完成；若随后刷新则看不到                                                                       | 用户显式关闭通知即接受该取舍；发布说明提示「关通知后请保持页面在前台」可选                                                                  |
| **R12** | 中   | 设置面为**快照级 LWW**（既有）：离线改提醒期间，他端在线改了任一设置                                                                                                         | 本端离线改动被远端覆盖（提醒设置回到他端值）                                                                               | 沿用偏好 ADR 的 R-10a 已知局限；设置低频、可再改，本批不修                                                                                  |

## 9. 影响面（RD 实施面；本单不实现）

**客户端（必改）**

- `packages/shared/reminder/types.ts`：`ReminderEngineDeps` 增 `isSuppressed?` / `skip?`；`ReminderTask` 增 `projectId`（若走候选透出）。
- `packages/shared/reminder/create-reminder-engine.ts`：扫描首部静默短路；事件组装修正（`projectId` / `remindAt` / `canSkip`）；`skip` 句柄（或 deps 端口）。
- `packages/shared/reminder/` 新增纯函数（免打扰命中 / 设置归一化）：`isWithinQuietHours(minutesOfDay, quietHours)` + `normalizeReminderSettings(raw)`（`shared` 不 import infra）。
- `packages/shared/types/reminder.ts`：事件字段扩展。
- `packages/shared/utils/notification.ts`：`silent` 选项 + 构造兜底（全函数化）。
- `packages/infrastructure/src/persistence-sync/preference-sync.ts`：常量 + `build` / `isSnapshotEmpty` / `apply` 三处。
- `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts`：`REMINDER_SETTINGS`（身份级）/ `REMINDER_NOTICE_ACK`（设备级）登记。
- `packages/infrastructure/src/persistence-local/repos/task-reminder-candidates.ts`：透出 `projectId`。
- `apps/web/src/views/index/index-view.ts`：装配 `isSuppressed` / `getProjectName` / `skip` / 索权（改为手势）。
- `packages/presentation/task/components/dialogs/reminder/*`：清单名 + 提醒时间行；「跳过本次」按钮（`canSkip`）；props 增 `getProjectName?` / `onSkip?`。
- `apps/web/src/components/settings/app-setter/`（或同目录新子组件）：提醒设置区（开关 / 免打扰起止 / 权限状态行）+ i18n（`zh-CN` / `en-US` / `types`）。
- 测试：`packages/shared/reminder/__tests__`（静默门变异、skip CAS、事件字段）、`persistence-sync/__tests__`（快照三函数 + 清除传播）、设置组件测试、`notification` 兜底测试。

**零改动**

- `nao-todo-server`（`preferences` 已可承载）；`packages/presentation-react` / `apps/mobile`（红线）；`syncQueue` / `SYNC_TABLES` / 业务 `markDirty`；桌面独立扫描器（已下线）。

## 10. NFR / AC 可验收口径（供 PM 写 PRD）

- **AC-S1 静默零副作用**：免打扰时段内扫描 ≥3 轮 ⇒ 账本无该 `taskId@remindAt`、任务 `remindAt` 未变、无弹窗/系统通知。
- **AC-S2 时段结束补弹**：可见态时段结束 ≤10s 内弹出；回前台 ≤2s；每条只补一次。
- **AC-S3 跳过**：重复提醒点「跳过本次」⇒ `remindAt` = 下一次；刷新/轮询不再弹本次；**不出现跳两次**；一次性提醒无该按钮。
- **AC-S4 弹窗信息**：含清单名 + 原定提醒时间；清单名解析失败回退「清单」不空白；不出现内部键名。
- **AC-S5 权限引导**：三态各自文案；同一设备同一状态自动出现一次；设置区常驻可查；`unsupported` 判定后不再尝试发通知。
- **AC-S6 设置同步**：任一项修改 ⇒ 本地立即生效（≤10s）→ 2s 内入队；断网仍本地生效；重登/他端拉取后一致；登出清空。
- **AC-S7 不回归**：默认值下行为与 `v1.12.15` 等价（无静默/通知开/声音开）；账本键格式不变（`taskId@remindAt`）。

## 11. 需拍板（DP）

| #        | 决策点                                                                                                   | 选项                                                                                                                                                         | 推荐                                                           |
| :------- | :------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **DP-1** | **手机端系统通知不可用的预期校准**（iPhone Safari 页面无 API；Android Chrome 页面通知须 Service Worker） | A 接受：本批手机端=应用内提醒 + 三态引导，PWA/Web Push 另单 · B 本批扩到 PWA + Web Push（破非范围，需 SW/订阅/推送基建） · C 手机端直接隐藏「通知/声音」开关 | **A**（最小、符合非范围；发布说明写清）                        |
| **DP-2** | 免打扰结束后的补弹形态                                                                                   | A 逐条补（与现有队列一致） · B 汇总为一条「N 个提醒」进队列 · C 弹窗逐条、系统通知只发一条汇总                                                               | **A**（语义最一致、零新实体）；若用户在意 08:00 风暴选 C       |
| **DP-3** | 权限索权时机                                                                                             | A 设置区开关点击时（用户手势） · B 首次提醒被拦后补问 · C 维持启动自动                                                                                       | **A**（唯一在 Safari/Chrome 可靠生效；C 实际无效）             |
| **DP-4** | 「跳过本次」反馈与过期提示                                                                               | A 轻提示「已跳过本次，下次 X」+ 补弹标注「原定 …」 · B 静默推进、不标注                                                                                      | **A**（C 端需要确认感；标注避免误读）                          |
| **DP-5** | 旧客户端整快照覆盖导致提醒设置丢失                                                                       | A 两端同批发布 + 发布说明 · B 加「未知字段保留」（客户端缓存上次远端快照合并，另单） · C 接受不同步直到再改                                                  | **A**（零成本；B 为后续加固）                                  |
| **DP-6** | 设置区形态                                                                                               | A 并入「应用设置」区块（4 组：通知 / 声音 / 免打扰 / 权限状态） · B 新增第 4 个「提醒」tab                                                                   | **A**（320px 三段 tab 已满，四段会裁字；无需改设置对话框结构） |

## 12. 连带同步清单（Owner）

- **PRD** `docs/prds/2026-10-23-reminder-local-polling.md:50`：非范围原写「免打扰 / 提示音 / 角标未提出」⇒ 本批已追加，须由 **PM** 修订（非范围收窄 + 新增 AC）。
- **任务台账** `docs/tasks-state.md`：登记 `T530`（PM）。
- **ADR 索引** `docs/adr/README.md`：新增本篇（arch，已随本次落盘）。
- **前序 ADR** `2026-10-23-reminder-local-judgment.md`：决策 1「展示即消费」**不改**；在「相关指针」互记 skip 的 CAS 约束（arch，已在新 ADR 注明）。
- **发布说明**：手机端系统通知能力边界 + 默认值不变 + 设置同步（PM，按 C 端「说人话」规范）。

## 13. 读过的文件清单

**客户端**

- `packages/shared/reminder/create-reminder-engine.ts`（全文 251 行）
- `packages/shared/reminder/types.ts` / `collect-due-reminders.ts` / `next-occurrence.ts` / `claim-ledger.ts` / `index.ts`
- `packages/shared/reminder/__tests__/reminder-harness.ts`（契约段）
- `packages/shared/types/reminder.ts`
- `packages/shared/utils/notification.ts`
- `packages/infrastructure/src/persistence-sync/preference-sync.ts`（快照 / LWW / 推送 / 拉取段）
- `packages/infrastructure/src/persistence-sync/preference-queue.ts`（队列语义段）
- `packages/infrastructure/src/persistence-sync/index.ts`
- `packages/infrastructure/src/persistence-local/repos/task-reminder-candidates.ts`
- `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts`
- `packages/infrastructure/src/persistence-local/db/local-database.ts`（tasks 索引 / 队列记录段）
- `packages/infrastructure/src/persistence-local/converters/task.ts`（projectId 段）
- `apps/web/src/views/index/index-view.ts`（引擎装配 / 设置加载 / 路由段）
- `apps/web/src/views/index/index.vue`（dialog adapter 挂载）
- `apps/web/src/components/settings/dialog/index.vue` / `state.ts`
- `apps/web/src/components/settings/app-setter/index.vue`
- `apps/web/src/components/app/aside-v2/use-settings-entry.ts`
- `apps/web/src/components/pomodoro/use-pomodoro-page.ts`（既有索权先例）
- `packages/presentation/task/components/dialogs/reminder/task-reminder.vue` / `use-task-reminder.ts` / `type.ts`
- `packages/presentation/task/components/date-selector/task-date-selector.vue`（清空提醒口径）
- `apps/desktop/src/renderer/src/AppRoot.vue`（共享壳注释）

**服务端（只读核对）**

- `nao-todo-server/domain/identity/entities/userConfig.go`
- `nao-todo-server/infrastructure/persistence/models/user.go`
- `nao-todo-server/application/user/dto/user.go`
- `nao-todo-server/interfaces/types/user.go`

**文档**

- `docs/adr/2026-10-23-reminder-local-judgment.md`
- `docs/adr/2026-09-23-local-preference-sync.md`（Q1-Q4 / D-1b / D-3 / PS-1、PS-5、PS-8、PS-10、R-10b）
- `docs/prds/2026-10-23-reminder-local-polling.md`（非范围 / NFR）
- `docs/reports/T526-arch-review.md` / `docs/adr/README.md` / `AGENTS.md` / `DESIGN.md`（C 端界面原则）