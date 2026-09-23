# DEF-PROBE-P1 实机探针报告（DEF-6 确证 + 离线边界实测）

> **性质**：探针报告（只读为主 + 受控造数）。**非 PRD**。
> **执行**：qa（本会话）｜**日期**：2026-09-23｜**授权**：用户已授权 dev 库造数（可回退）
> **登记源**：`docs/reports/defect-pool.md`（DEF-6/DEF-12/OFF-1）｜**勘察纪要**：`docs/prds/2026-09-23-web-offline-recon.md`
> **代码变更**：**0**（未改动仓库任何代码；探针脚本全部在 `/tmp/qa-defprobe/`，本报告为唯一仓内产物）
> **凭据纪律**：`NAO_QA_EMAIL` / `NAO_QA_PASSWORD` **不可用**（见 §0）。本报告与全部证据文件**不含任何凭据**；探针所用临时账号口令为**运行时随机生成、仅存内存**，未落任何文件。

---

## 0. 前置自检与口径纠正（T0）

### 0.1 凭据不可用（阻塞项）

| 项                     | 结果                                                                                                                  |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `NAO_QA_EMAIL`         | **未注入**（`env` 中 `NAO_*` 计数 = 0）                                                                               |
| `NAO_QA_PASSWORD`      | **未注入**                                                                                                            |
| 判定                   | **凭据不可用** ⇒ 依赖既有账号登录的项按 PM 约定标注阻塞；本轮改用**自建临时账号**                                     |
| 环境（不依赖凭据部分） | dev 后端 `localhost:3302` 存活（`/api/ping` → `{"code":200}`）；MySQL `naotodo` 可达（docker `naotodo-mysql`，8.4.9） |

**未走"停做"而是自建临时账号的理由（请 PM 复核是否越界）**：DEF-6 是 WEB-OFFLINE 阶段一硬前置，判据本身只要求「**>200 行账号**」，与账号身份无关。dev 库**已有前例**（`qa.shell05.*` / `qa.shell06.*` / `probe@x.local` 等 QA 自建账号）。故本轮用 `POST /api/auth/signup` 自建 `qa.defprobe.*` 临时账号（口令运行时随机、仅内存），**未触碰任何既有账号**，结束后硬删（见 §1.3）。若 PM 认为该做法越界，T2/T3-web/T6 需以正式 QA 账号复跑。

### 0.2 口径纠正（重要，避免沿用错误前提）

PM 派单中的两个数字**是"全库"口径，不是"单账号"口径**，而 DEF-6 的 `PULL_LIMIT` 是**按 `user_id` 过滤后**的每表窗口：

| 派单所述           | 实测（2026-09-23）                                                 | 口径                                     |
| :----------------- | :----------------------------------------------------------------- | :--------------------------------------- |
| 全表 **189 行**    | `tasks` 全表 **436 行**，其中墓碑 247 行                           | **189 = 存活（非软删）行数**，非全表行数 |
| **162 条顶层任务** | 存活顶层任务（`deleted_at IS NULL AND parent_task_id=0`）**= 162** | 全库汇总，非单账号                       |

**⇒ 单账号是否触发截断，取决于该账号自己的行数（含墓碑）**：dev 库现存账号 `467296091008667648`（`probe@x.local` / QA-Shell03）**已有 256 行（>200）**，即 DEF-6 的截断**在既有账号上已可触发**；而 189/162 这两个数**不能**用来判断某个账号是否会截断。

### 0.3 被测服务版本口径（caveat）

- 运行中的后端容器 `naotodo-server` 镜像构建于 **2026-09-21T06:17Z**；源码 `nao-todo-server` HEAD 为 **2026-09-21 18:45 +0800**（晚约 4.5h，差异提交为 reminder 相关）。
- 结论：T7 的 HTTP 语义结论对应**该镜像**；与源码 HEAD 的差异不在 tasks 列表路径上，但**严格起见记为未核验项**。

---

## 1. T1 造数清单与回滚

### 1.1 清单

| 批次                 | 账号（临时）                                              | 前缀                | 插入行数 | 造数前 | 造数后 | 命名/排序控制                                      |
| :------------------- | :-------------------------------------------------------- | :------------------ | :------- | :----- | :----- | :------------------------------------------------- |
| A（dense）           | `qa.defprobe.def6.<ts>@qa.local`（id 471903400456359936） | `[QA-DEF6-<ts>]`    | 620      | 0      | 620    | `updated_at` 间隔 **10ms**；末 3 行为 `NEWEST-*`   |
| B（sparse，复现）    | 同上（id 471904062669852672）                             | `[QA-DEF6-<ts>]`    | 620      | 0      | 620    | `updated_at` 间隔 **1500ms**；末 3 行为 `NEWEST-*` |
| C（T3 desktop）      | `qa.defprobe.off.<ts>@qa.local`                           | `[QA-OFFLINE-<ts>]` | 6        | 0      | 6      | 稀疏                                               |
| D（T3 desktop 精测） | `qa.defprobe.t3.<ts>@qa.local`                            | `[QA-T3-<ts>]`      | 1        | 0      | 1      | —                                                  |
| E（T3 web）          | `qa.defprobe.web.<ts>@qa.local`                           | `[QA-WEB-T3-<ts>]`  | 1        | 0      | 1      | —                                                  |
| F（T7）              | `qa.defprobe.t7.<ts>@qa.local`                            | `[QA-T7-<ts>]`      | 8        | 0      | 8      | 含 1 归档 + 1 墓碑；priority 0–4                   |

### 1.2 造数方式

SQL 直插（`docker exec naotodo-mysql mysql`）——**绕开写桶限流**（`/tasks` 写桶 = 48 req/min，620 次 API 创建不可行），且 id 走 `AUTO_INCREMENT`、`updated_at` 可控（DEF-6 的排序键）。表结构 `CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`（后者是 T7 大小写不敏感的根因）。

### 1.3 回滚方式与回退证明

```text
DELETE FROM naotodo.tasks         WHERE user_id IN (SELECT id FROM naotodo.users WHERE email LIKE 'qa.defprobe%');
DELETE FROM naotodo.user_sessions WHERE user_id IN (SELECT id FROM naotodo.users WHERE email LIKE 'qa.defprobe%');
DELETE FROM naotodo.users         WHERE email LIKE 'qa.defprobe%';
```

| 校验（清理后）                                  | 值                                                                                                    |
| :---------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `SELECT COUNT(*) FROM tasks`                    | **436**（与造数前一致）                                                                               |
| `SELECT COUNT(*) FROM users`                    | **14**                                                                                                |
| `email LIKE 'qa.defprobe%'` 残留账号            | **0**                                                                                                 |
| 本批各前缀残留任务（DEF6/OFFLINE/T3/WEB-T3/T7） | **均 0**                                                                                              |
| 桌面 profile                                    | 已从 `/tmp/qa-defprobe/userdata-backup-*` **还原**（`IndexedDB/` 4 个 origin 目录齐全，含 `file__0`） |

> 现存 256 条 `[QA-%` 任务属**既有** `467296091008667648`（前轮 QA-Shell03 造数），**非本批产物**。

---

## 2. T2 · V1：DEF-6 确证（核心，P1）

### 2.1 机制（读码，作为实测对照）

| 环节     | 事实                                                                                      | 位置                                                                   |
| :------- | :---------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| 窗口上限 | `PULL_LIMIT = 200`（**每表**）                                                            | `packages/infrastructure/src/persistence-sync/sync-service.ts:242`     |
| 排序     | `updated_at ASC, id ASC`（**最旧优先**）                                                  | `infrastructure/utils/query/sync.go:11`（服务端）                      |
| 含墓碑   | `.Unscoped()`（软删行**占窗口**）                                                         | `infrastructure/persistence/task/repoImpl.go:323`（服务端 `ListSync`） |
| 单轮     | `pullAllInner()` 一次 `POST /sync/pull`，**无续拉循环**                                   | `sync-service.ts:432`                                                  |
| 回拉窗口 | `PULL_BACKTRACK_MS = 1000` ⇒ 第二轮会把边界前 1s 的行**重复计入**（净增 < 200）           | `sync-service.ts:250`                                                  |
| 触发点   | 仅 3 处：`start()` / `pullAll()` / `manualSync()`；`resumeBackfill()` **只 push 不 pull** | `sync-service.ts:388/395/780`                                          |

### 2.2 实测步骤与结果（批次 B，sparse）

前置：清空桌面 profile（`~/.config/@nao-todo/desktopapp` 先备份）→ 启动 Electron dev（CDP 9333）→ **真实口令登录**（建立 key bundle、解锁 `cryptoService`）→ 重启（reload + 解锁）触发 `start()`。每阶段读本地 IndexedDB `tasks.count()` 与「最新 3 条 id 是否在本地」。

| 阶段                          | `tasks.count()` | 相对上一步 | 最新 3 条 id 在本地？ | `/sync/pull` 请求 |
| :---------------------------- | :-------------- | :--------- | :-------------------- | :---------------- |
| **M0 登录后**（未重启）       | **0**           | —          | 否                    | 0                 |
| **M1 启动 1 次**（`start()`） | **200**         | **+200**   | **否**（最旧 3 条在） | 1（+1 预检）      |
| **M2 点「立即同步」**         | **399**         | **+199**   | **否**                | 1                 |
| **M3 再启动 1 次**            | **598**         | **+199**   | **否**                | 1                 |
| **M4 再启动 1 次**            | **620**         | +22        | **是**（已补全）      | 1                 |

（批次 A dense：M1=200 → M2=299 → M3=398 → M4=497，每次净增 **+99**；差异全部由 §2.1「回拉窗口 1s + `updated_at` 密度」解释。）

### 2.3 判据逐条结论

| #   | 判据（arch 规格）                       | 结论                                                                 | 证据  |
| :-- | :-------------------------------------- | :------------------------------------------------------------------- | :---- |
| ①   | count 是否停在 ≈200（而非全部）         | **成立**（首轮恰 200）                                               | M1    |
| ②   | 本地是否含最新任务 id                   | **成立：不含**（最新 3 条全 false）                                  | M1–M3 |
| ③   | 「立即同步」后增量是否仍受 200 限制     | **成立**（+199 ≤ 200；游标推进但只到 200 边界）                      | M2    |
| ④   | 多启动几次是否逐次 +200（= 无自动补全） | **成立**：620 行需 **3 次启动 + 1 次手动同步**才补齐；无任何自动续拉 | M1–M4 |

**⇒ DEF-6（= C5/OFF-2）由「读码推断」升级为「实测确证」：本地镜像以「最旧优先、≤200 行/表/次拉取」填充且无自动补全，大账号下 desktop 读不到最新任务。**（**未复现** 不适用：结果是**复现**，且前置条件——账号 >200 行——已由 §1 造数满足并记录。）

---

## 3. T3 · 离线写入口清单（Z6，阶段一「必须禁写」依据）

### 3.1 关键发现：写路径**分端**，结论必须分端表述

| 端             | 业务仓储装配                                                                                                                    | 断网写行为                                                                      | 证据                                                             |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------ | :--------------------------------------------------------------- |
| **desktop**    | **全部本地优先**（`newLocal*Repository()`：task/check-item/comment/tag/tag-pref/project/project-pref/pomodoro/pomodoro-record） | 写 **Dexie + `syncTracker.markDirty`** ⇒ **入队待推**（`/sync/push`），**不丢** | `apps/desktop/src/renderer/src/hooks/usecases/*.ts`；实测 §3.2-A |
| **web**        | **全部服务端直连**（`*RepoImpl(requester)`）                                                                                    | 写请求失败（`ERR_NETWORK`→归一化 resolve）⇒ **写丢失**；调用方 toast 或静默     | `apps/web/src/hooks/usecases/*.ts`；实测 §3.2-B                  |
| 例外（两端同） | **identity**：昵称/密码/头像/**user-config（外观偏好）** 走服务端直连                                                           | 断网失败 ⇒ toast（主题已本地应用，属**部分误判**）                              | `use-user-usecase.ts`（desktop 亦 `newUserConfigRepository`）    |

> 机制（读码确证）：`packages/shared/requester/axios.ts:75-104` —— `TOO_MANY_REQUESTS` / `ECONNABORTED` / `ERR_NETWORK` 一律 **`Promise.resolve({code:'ERR_NETWORK', data:{code:50300,…}})`（不 reject）**；仓储只比业务码 ⇒ 得到 error 字符串；是否可见取决于调用方。

### 3.2 实测证据

**A. desktop（实测，批次 C/D）** —— 详情·星标 / 详情·状态勾选（断网后点击）：

| 观测项                      | 结果                                                                          |
| :-------------------------- | :---------------------------------------------------------------------------- |
| 服务端 `PUT /api/tasks/:id` | **未发生**（`cdp.requests()` 无此 URL）                                       |
| 唯一被阻断请求              | `POST /api/sync/push`（即 `markDirty` 后的推送）                              |
| 本地详情「最后修改时间」    | **已更新为当前时刻**（本地记录确已改）                                        |
| toast                       | **无**（`use-task-view-object.updateTaskDetails` 仅错误时 toast，成功无提示） |
| 判定                        | **写入本地成功并入队** ⇒ **不构成「误判已保存」**（它确实已保存，只是待推）   |

**B. web（实测，批次 E）** —— 详情·状态勾选（先在线开详情，再断网点击）：

| 观测项     | 结果                                                                              |
| :--------- | :-------------------------------------------------------------------------------- |
| 被阻断请求 | **`PUT /api/tasks/468766103720433492` × 3**（幂等 PUT 的 `ERR_NETWORK` 自动重试） |
| toast      | **「网络错误，请检查您的网络连接」**                                              |
| 判定       | 写**丢失**、用户**可见错误** ⇒ 不误判（但必须禁写：无本地队列，离线写必丢）       |

### 3.3 「离线时必须禁写的入口清单」

图例：**写失败可见性** = `toast`（用户可见错误）/ `静默`（无任何反馈 ⇒ **误判「已保存」**）。严重度按「用户是否会据此做出错误决策 / 是否丢数据」。

| #   | 入口                         | 入口位置                                                                                           | 写失败可见性（web）           | desktop                                | 误判       | 严重度     |
| :-- | :--------------------------- | :------------------------------------------------------------------------------------------------- | :---------------------------- | :------------------------------------- | :--------- | :--------- |
| 1   | 详情·状态勾选                | `task-details/header/index.vue:12` → `use-task-view-object.ts:137`                                 | toast（**实测**）             | 入队                                   | 否         | P1（禁写） |
| 2   | 详情·星标/取消星标           | `task-details/footer/index.vue:58-63`                                                              | toast                         | 入队（**实测**）                       | 否         | P1         |
| 3   | 详情·放弃/取消放弃           | `task-details/footer/index.vue:83-88` → `use-task-view-object.ts:207/223`                          | toast                         | 入队                                   | 否         | P1         |
| 4   | 详情·日期/提醒改期           | `task-details/header/index.vue:16`                                                                 | toast                         | 入队                                   | 否         | P1         |
| 5   | 详情·描述 inline 保存        | `use-task-view-object.ts`（`updateTaskDetails`）                                                   | toast                         | 入队                                   | 否         | P1         |
| 6   | 详情·所属清单切换            | `task-details/footer/index.vue:103`                                                                | toast                         | 入队                                   | 否         | P1         |
| 7   | 详情·删除/恢复任务           | `footer/index.vue:77-82` → `handlers/task.ts`                                                      | toast                         | 入队                                   | 否         | P1         |
| 8   | 列表/表格行·删除/恢复        | `table-main.vue:177`、`list-main.vue:58`                                                           | toast                         | 入队                                   | 否         | P1         |
| 9   | **看板·拖拽改状态**          | `kanban/use-kanban.ts:23`（`await taskUseCase.update(...)`，**返回值被丢弃**）                     | **静默**                      | 入队                                   | **是**     | **P0**     |
| 10  | **看板·完成/取消完成**       | `view-adapters/kanban-view-adapter.vue:64-65`（同上丢弃）                                          | **静默**                      | 入队                                   | **是**     | **P0**     |
| 11  | **详情·创建子任务**          | `task-details/main/subtasks.vue:83` → `use-subtasks.ts:109`（返回 err，调用方 `await` 后**丢弃**） | **静默**                      | 入队                                   | **是**     | **P1**     |
| 12  | 详情·子任务勾选              | `subtasks.vue:71` → `handlers/task.ts:update`                                                      | toast                         | 入队                                   | 否         | P2         |
| 13  | 详情·子任务拖拽改序          | `use-subtasks.ts:141 resortSubTasks`（返回 err，**调用方未见 toast**）                             | 静默（待实测）                | 入队                                   | 疑似是     | P2         |
| 14  | 详情·检查项 增/改/删         | `handlers/task-check-item.ts:31/53/71`                                                             | toast                         | 入队                                   | 否         | P2         |
| 15  | 详情·评论 增/改/删           | `handlers/task-comment.ts:37/59/77`                                                                | toast                         | 入队                                   | 否         | P2         |
| 16  | 创建任务对话框               | `dialogs/creator/use-creator.ts:86`                                                                | toast                         | 入队                                   | 否         | P1         |
| 17  | 多选批量操作                 | `multi-select/use-task-multi-select-panel.ts:49`                                                   | toast（含失败计数）           | 入队                                   | 否         | P1         |
| 18  | 已过期任务重排               | `reschedule-panel/reschedule-panel.vue:56`                                                         | toast                         | 入队                                   | 否         | P2         |
| 19  | **番茄结束落库**             | `pomodoro/utils/pomodoro.ts:85` `persistPomodoroRecord`（**仅 `console.error`**）                  | **静默**                      | 入队（local repo）                     | **是**     | **P1**     |
| 20  | 常用番茄专注 增/改/删/归档   | `pomodoro/handlers/*`（`NueMessage.success` 前置校验）                                             | toast                         | 入队                                   | 否         | P2         |
| 21  | 标签 增/改/删                | `tag/handlers/tag.ts:142/158/190`                                                                  | toast                         | 入队                                   | 否         | P2         |
| 22  | 清单 增/改/删/恢复           | `project/handlers/project.ts:156/175/192`                                                          | toast                         | 入队                                   | 否         | P2         |
| 23  | **外观主题偏好（静默保存）** | `theme-setter.vue:37 debounceUpdateUserTheme`                                                      | toast（**但主题已本地应用**） | **服务端直连**（user-config 非 local） | **部分是** | P2         |
| 24  | 昵称/密码/头像/会话/注销     | `presentation-identity/**`                                                                         | toast                         | 服务端直连                             | 否         | P2         |

**给阶段一的直接结论**：

1. **必须禁写清单 = 上表全部 24 项**（web 无本地队列，任何离线写都丢）。
2. **误判风险（= 用户不知道丢了）集中在 #9/#10/#11/#13/#19 + #23（部分）** —— 这些入口**即使将来允许离线写，也必须补错误反馈**。
3. **不要逐个改仓储**（recon 建议成立）：统一在 UI 层开关禁用写入口 + 显式提示。
4. ⚠️ **desktop 现状是"能写"（本地优先入队）**，与 web 不同；若阶段一要求"只读"，desktop 也需显式禁写，否则会产生 `markDirty`（违反「阶段一不产生任何 `markDirty`」纪律），并触发 C-1（登出清库 ⇒ 未推送队列永久丢失）。

---

## 4. T4 · 浏览器存储驱逐策略（Z8）

| 端/浏览器                      | 实测/结论                                                                                                                                                     | 证据                                                                                                   |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------- |
| **desktop（Electron 43）**     | `navigator.storage.persisted() === true`（**默认持久**，不受浏览器驱逐）；存储位于 Electron 用户目录                                                          | **实测**：`/tmp/qa-defprobe/fileproto`（Electron 内 `persisted:true`）                                 |
| **web（Chromium 系）**         | **best-effort**：存储压力下按 origin **LRU 驱逐**；`persist()` 是权限，Chromium 仅在启发式满足（已加书签/高站点参与度/已安装/有推送）时自动授予，否则**拒绝** | `navigator.storage.persist()` 权限语义：web.dev「Persistent storage」、MDN「StorageManager.persist()」 |
| **web（Safari / WebKit ITP）** | **7 天上限**：网站 **7 天无用户交互** ⇒ 删除其**全部脚本可写存储**（IndexedDB、LocalStorage、Cache 等）                                                       | WebKit「Tracking Prevention in WebKit」§7-Day Cap on All Script-Writeable Storage；ITP 2.3             |
| **本仓现状**                   | 全仓**零** `navigator.storage.persist()` / `StorageManager` 调用（grep 为空）⇒ **web 从未申请持久化**，驱逐风险 100% 暴露                                     | `grep -rn "storage.persist\|navigator.storage" packages apps`（无命中）                                |

**结论**：驱逐是 **web 独有**（desktop 默认持久，已实测）；web 侧当前**既未申请 `persist()`，也未做驱逐提示** ⇒ 阶段一若依赖本地镜像，必须至少「申请 `persist()` + 文案告知数据可能被清理」。

---

## 5. T5 · desktop `file://` 存储归属（Z4，打包版）

生产态 desktop 走 `win.loadFile`（`apps/desktop/src/main/index.ts:40`），即 **`file://`**。

**实测（Electron 43，`/tmp/qa-defprobe/fileproto`）**：pageA 写入 → pageB（同目录）与 pageC（**不同目录**）读取：

| 读方              | `location.origin` | localStorage            | IndexedDB               |
| :---------------- | :---------------- | :---------------------- | :---------------------- |
| pageB（同目录）   | `file://`         | **读到 `WRITTEN-BY-A`** | **读到 `WRITTEN-BY-A`** |
| pageC（其它目录） | `file://`         | **读到 `WRITTEN-BY-A`** | **读到 `WRITTEN-BY-A`** |

**⇒ 确证 DEF-8/OFF-4 的担忧：Chromium/Electron 下所有 `file://` 文档共享**同一个 origin（`origin === "file://"`）**，localStorage 与 IndexedDB 均**跨文件、跨目录共享**。同 profile 下任何其它本地 HTML（含被诱导打开的恶意页）都能读到本应用落盘数据。明文姿态下这是**直接的机密性边界失效**，CSP（`<meta>`）与「明文落盘」必须同时收紧。

---

## 6. T6 · `checkIn` 网络类失败是否清 JWT（Z2 / OFF-1）

**读码**：`AuthUseCase.checkIn`（`packages/domain-identity/src/application/usecases/auth-service/usecase.ts:67-72`）**任何错误**（含网络类）都调 `authStore.clearAuthData()` → `clearUserData()` → **`localStorage.clear()`**（`user-store.ts:55-67`）。UI 层（`check-in.vue`）已按 SHELL-03 B-3 把网络类失败做成**可重试失败态**（不跳 signin）。

**实测**（desktop，仅阻断 `/api/auth/checkin`，其余 API 正常 ⇒ 精确隔离"网络类 checkIn 失败"）：

| 观测项                             | 结果                                                                                                                                                |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| 检入页文案                         | 「网络错误，请检查您的网络连接 / **重试** / **重新登录**」（= 网络类失败态，未跳 signin，UI 层符合 C-24）                                           |
| `localStorage.getItem('USER_JWT')` | **空串**（`jwtPresent=false`，键仍在但值为空）                                                                                                      |
| `Object.keys(localStorage)`        | **仅剩 `["USER_JWT"]`**（`nao.deviceId` / `USER_PROFILE_CACHE` / `snowflakeEpoch` / `LAST_VISITED_ROUTE` … **全部被 `localStorage.clear()` 抹掉**） |
| 被阻断请求                         | `PUT /api/auth/checkin` ×3（重试后仍失败）                                                                                                          |

**⇒ 确证 OFF-1/DEF-5**：**网络类 checkIn 失败会清空认证**（JWT 变空串 + 全量 localStorage 键被抹）。后果：desktop/web 离线刷新一次即**彻底进不去**（离线无法重新登录，且 JWT 已空 ⇒ 离线进入四条件中的「JWT 可解析」也不再满足）。**副作用扩大**：`localStorage.clear()` 还抹掉了 `X-Device-Id`（`nao.deviceId`）与主题/语言等**本应保留**的键。

---

## 7. T7 · 端到端 HTTP 语义（铸/取 JWT 后）

方法：`POST /auth/signup` + `POST /auth/signin` 取**真实 JWT**（非铸密钥），受控造数 8 行（含 1 归档、1 墓碑），然后 `GET /api/tasks/?...`。证据：`/tmp/qa-defprobe/t7-evidence.json`。

| #   | 问题                                     | 结论                          | 实测数值                                                                                                                                                                                                              |
| :-- | :--------------------------------------- | :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | `name` 是否**子串** / **大小写不敏感**   | **均是**                      | `name=alpha` → 3 行；`name=ALPHA` → **同 3 行**（`Alpha Beta`/`ALPHA2`/`alphabet`）；`name=ZZZ-no-match` → 1 行。根因：`name LIKE '%…%'`（`scopes.go:61`）+ 列 collation **`utf8mb4_0900_ai_ci`**                     |
| ②   | `%` 是否**未转义**                       | **未转义（LIKE 通配符注入）** | `name=%` → **7/7 全命中**；`name=_` → **7/7**。⚠️ 是 **LIKE 通配符**滥用面（可枚举全表），非 SQL 注入（参数化绑定仍在）                                                                                               |
| ③   | `isArchived=false` 是否**漏入归档任务**  | **漏入（确证）**              | `isArchived=false` 返回 **7 行且含 `ARCHIVED-LEAK`**（`ByTaskArchived(false)` 是 **no-op**：`scopes.go:139-146`）；`isArchived=true` → 1 行（仅归档）。默认无过滤同样含归档、**不含墓碑**（墓碑默认被 GORM 软删过滤） |
| ④   | `sort` 是否**数值 rank**（而非字符串序） | **数值 rank（正确）**         | `sort=priority:asc` → `none(0) → low(1)×3 → medium(2) → high(3) → urgent(4)`；`desc` 完全逆序。若为字符串序应为 `high,low,medium,none,urgent`（不符）                                                                 |
| ⑤   | `pagination` 字段是否返回                | **返回**                      | `{total, page, limit, maxPage}`（`pagination.total` 与 `data.length` 一致）                                                                                                                                           |
| 附  | `sort` 无白名单（OFF-8 注入面）          | **确证**                      | `sort=id;SELECT 1:asc` → `HTTP 200 / code 40052`，message 回显 MySQL 语法错误（`near '_s_elect 1 asc'`）⇒ 字段名被**字符串拼接**进 `ORDER BY`，且**错误原文透传给客户端**                                             |

> 注：④ 与 DEF-11（desktop/index list 的 priority 为**字母序**）**不冲突**：T7 测的是**服务端** `sort=priority:asc`（数值列 `priority tinyint` ⇒ 数值序正确）；DEF-11 指的是**客户端**（desktop/index list）另有的字母序问题，属另一条路径，本轮未覆盖。

---

## 8. 未确认项与阻塞项

| #   | 项                                       | 状态             | 说明                                                                                                      |
| :-- | :--------------------------------------- | :--------------- | :-------------------------------------------------------------------------------------------------------- |
| B1  | 既有 QA 账号登录（`NAO_QA_*`）           | **阻塞**         | 环境变量未注入（§0.1）；本轮以自建临时账号代跑                                                            |
| B2  | 正式账号下的 T2 复跑                     | **建议**         | 若 PM 要求"非自建账号"证据，需注入 `NAO_QA_*` 后复跑 `app-probe.mjs`（脚本在 `/tmp/qa-defprobe/`）        |
| U1  | 服务端镜像 vs 源码 HEAD 差异对 T7 的影响 | 未核验           | 镜像早于 HEAD 约 4.5h（§0.3）                                                                             |
| U2  | 子任务拖拽改序（#13）断网可见性          | 走查（疑似静默） | 未实测                                                                                                    |
| U3  | 列表/表格行「删除」按钮 web 实测         | 未取到           | 首轮 `rowInfo.found=false`（行内按钮选择器未命中）；该项已由 #7/#8 走查覆盖（`handlers/task.ts` → toast） |
| U4  | 看板拖拽（#9/#10）实测                   | 走查             | 桌面默认视图为 `table`，驱动看板需切视图；结论基于代码（返回值被丢弃）                                    |
| U5  | web 侧「静默」入口（#9/#10/#11/#19）实测 | 走查             | 静默性由**共享 presentation 代码**决定，端无关；已用 web 实测确证同族「toast 分支」机制（§3.2-B）         |
| U6  | `checkAndCleanExpired` 等 OFF-6 相关项   | 不在本批范围     | —                                                                                                         |

---

## 9. 证据索引（均在 `/tmp`，凭据不入内）

| 文件                                      | 内容                                             |
| :---------------------------------------- | :----------------------------------------------- |
| `/tmp/qa-defprobe/app-evidence.json`      | T1/T2（批次 B sparse，最终一次）                 |
| `/tmp/qa-defprobe/app-run.log`            | 批次 A（dense，620 行，净增 +99/次）运行日志     |
| `/tmp/qa-defprobe/app-run-sparse.log`     | 批次 B（sparse，净增 +199/次）运行日志           |
| `/tmp/qa-defprobe/offline-evidence.json`  | T3-desktop 子集 + **T6**                         |
| `/tmp/qa-defprobe/t3-evidence.json`       | T3-desktop 精测（dropdown 选项枚举 + 阻断 URL）  |
| `/tmp/qa-defprobe/web-t3-evidence.json`   | **T3-web**（`PUT /tasks/:id` ×3 + toast）        |
| `/tmp/qa-defprobe/t7-evidence.json`       | **T7** 全部查询与响应                            |
| `/tmp/qa-defprobe/fileproto/` + `main.js` | **T5** `file://` 存储共享 + **T4** `persisted()` |
| `/tmp/qa-defprobe/*.mjs`                  | 全部探针脚本（自包含、随机口令、自动清理）       |
| `/tmp/qa-defprobe/userdata-backup-*`      | 桌面 profile 备份（已用于还原；保留作二次回退）  |

---

## 10. 变更记录

| 日期       | 变更                                                                                                      |
| :--------- | :-------------------------------------------------------------------------------------------------------- |
| 2026-09-23 | 首次成文：T0–T7 探针结论 + 造数清单/回滚证明 + T3 分端写入口清单（24 项）+ 5 项误判风险 + 4 项阻塞/未确认 |