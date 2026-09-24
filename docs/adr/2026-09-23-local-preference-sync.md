# 2026-09-23 本地偏好同步（TASK-26）架构评审 —— 结论：**有条件可行**

- **日期**：2026-09-23
- **状态**：✅ **有条件通过（r2 修订，2026-09-23）** —— **DP-1 已批准**（C-59 作用域收窄为「业务数据面」+ 偏好/设置面显式例外）· **DP-2 作废**（用户裁定：web 也可离线改偏好）· **DP-3 / DP-4 / DP-6 已裁定** · **DP-5 = 后续单**；**r3（2026-09-24，T140）GAP-4 按 PM 裁定 (b) 登记** —— 普通清单偏好「按行 LWW」**v1 未落地**（措辞改为「本地优先 + 仅本地缺失读时对账」+ **R-10b** 已知局限）｜⛔ **纯设计，未改任何代码**
- **评审对象**：T129 —— 本地偏好同步的**写路径语义 / 服务端契约 / 冲突语义 / 同步时机**
- **依据**：PRD `docs/prds/2026-09-23-local-preference-sync.md`（v0.2）；`docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 r5 / §10.9）；`docs/tasks-state.md` TASK-26 条
- **关联仓库**：`/home/nathan/Project/nao-todo`（客户端）、`/home/nathan/Project/nao-todo-server`（服务端，Q4′ 已授权跨仓）
- **代码边界**：本 ADR 为**纯文档产出**，未修改任何仓库代码（含服务端）
- **影响面工具**：`codegraph impact/callers`（`UserConfigEntity` 26 符号 / `loadUserConfig` 1 调用点 / `BuiltInProjectRepository` 11 符号 / `useAsideWidth` 10 调用点）+ 行号级读码

---

## 0. 结论摘要（先看这里）

| #      | 问题                       | 结论                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :----- | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | 写路径语义（与 C-59 关系） | **偏好面 = 独立「设置面」**（**不入 `syncQueue`**）。**两端一致 = 本地优先（local-first）→ 再同步远端**：**web 与 desktop 均先写本地**（普通清单偏好 → IndexedDB `projectPreferences`；设置类 → 既有本地存储 + 入偏好队列），**离线改动本地生效**，联网后经**独立轻量偏好队列**回传（§D-1b）。**C-59 作用域收窄为「业务数据面」**，偏好面为**显式例外**（**DP-1 已批准**）；**业务数据面实质不变**（web 仍**不新增业务本地写** · `markDirty` **恒 0** · 离线写入口**拦截 + `OFFLINE_READONLY` 可见提示**）。 |
| **Q2** | 服务端契约                 | `UserConfig` **加一个 nullable JSON 列 `preferences`**（推荐，非加字段/非改 blob）；**普通清单偏好复用既有 `project_preferences` 表 + REST（零服务端改动）**；**内建清单偏好进 `UserConfig.preferences`**（**不复用 `ProjectPreference`**）；迁移 = GORM AutoMigrate 加列（additive、无回填、无破坏性）。                                                                                                                                                                                                    |
| **Q3** | 冲突语义                   | **LWW**：设置面 = **快照级 LWW，服务端 `user_configs.updated_at` 为权威**；普通清单偏好 = **本地优先 + 仅「本地缺失」时读时对账**（**v1 不含按行 LWW / 推送前对账 / 「远端胜」** —— **本地无 per-row `syncedUpdatedAt`**（服务端行 `updatedAt` 已提供，客户端未读）⇒ 按行 LWW **未落地**，登记为**已知局限**，见 §D-3 / R-10b）。**不用客户端时间戳做主判据**。已知局限：设置面整快照覆盖 → v1 接受，升级路径 = 字段级 `updatedAt`。                                                                         |
| **Q4** | 同步时机                   | 启动/登录**拉取**（复用 `loadUserConfig`，非阻塞、失败静默降级 + 可见计数）；变更**防抖推送**（~2s）；失败**指数退避重试**（`online`/前台恢复/启动触发）；登出清本地（既有）→ 重登拉回。                                                                                                                                                                                                                                                                                                                     |

**一句话**：偏好不是业务数据 —— 走**独立的「设置面」通道**（普通清单偏好复用其既有 REST，其余进 `UserConfig.preferences`），**不碰业务同步引擎**（`syncQueue`/`markDirty`/`SYNC_TABLES`）；**两端一律本地优先**（web 与 desktop 同构：先写本地 → 独立偏好队列回传 → LWW 拉取合并），**C-59 作用域收窄为业务数据面**（偏好/设置面显式例外；业务数据面实质不变）。**DP-1 已批准、DP-2 作废**（用户裁定：web 也可离线改偏好）。

---

## 1. 事实核对：对 PM 输入信封 / PRD 的 8 处更正与补强

| #      | 原述                                                                         | 核实结果                                                                                                                                                                                                                                                                                                             | 证据                                                                                                                                                                         |
| :----- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | 「普通清单偏好：服务端 API 已存在 ⇒ **无需新增 API**」（PRD §附）            | ✅ **API 无需新增**（对），但 ❌ **「已同步」是错觉** —— desktop binding 用**本地仓储**（`newLocalProjectPreferenceRepository()`），`save` **不 `markDirty`**，`SYNC_TABLES` **无 preferences** ⇒ **desktop 既不推也不拉**；仅 **web 在线**写远端（`ProjectPreferenceRepoImpl`）。**⇒ 需新增同步接线，非「已有」**。 | `apps/desktop/.../binding.ts:37`；`persistence-local/repos/project-preference-repo-impl.ts:42-52`；`persistence-sync/sync-service.ts:112`；`apps/web/.../binding.ts:127-132` |
| **P2** | `sync-tracker.ts` 注释「projectPreferences/tagPreferences **随父实体同步**」 | ❌ **与代码不符**（无 `markDirty`、无 `SYNC_TABLES` 项、服务端 `/sync/push`\|`/sync/pull` **无 preference**）⇒ **该注释是设计意图的残留，非事实**；须更正（否则后续 RD 会被误导）。                                                                                                                                  | `persistence-sync/sync-tracker.ts:5`；`sync-service.ts:54`；server `interfaces/controllers/sync.go`（Push/Pull 无 preference）                                               |
| **P3** | 服务端路由 `/project/:projectId/preference`（PRD §附，**单数**）             | ⚠️ **笔误**：实际为 **`/projects/:projectId/preference`（复数）** GET/POST。                                                                                                                                                                                                                                         | server `interfaces/routers/projectRouter.go:59,63`；client `persistence-go/project/project-preference-repo-impl.ts`（`/projects/...`）                                       |
| **P4** | 内建清单偏好键 `${userId}/${builtInId}`「**已含 userId**」                   | ⚠️ **该 `userId` 实为 `email`**（调用点传 `profile.value?.email ?? ''`）⇒ 用户**改邮箱**会串号/丢失。                                                                                                                                                                                                                | `apps/web/src/components/tasks/built-in-project/main/index.vue:77`；`built-in/project/repoImpl.ts:59-98`                                                                     |
| **P5** | 「内建清单偏好**按 builtIn id**」                                            | ✅ 对，但**该写路径未纳入 web 离线写闸门** —— `use-built-in-project-usecase.ts` **无** `decorateUseCase`，`write-methods.ts` **无** builtIn 项 ⇒ **web 离线可写内建偏好**（**r2 重新定性：不是漏洞** —— 偏好面允许离线写，内建偏好**本就不应**入离线写闸门，见 PS-7 撤销）。                                         | `apps/web/src/hooks/usecases/use-built-in-project-usecase.ts`；`packages/presentation/offline/write-methods.ts`                                                              |
| **P6** | （未述）本地 `project_preferences` 主键形态                                  | ⚠️ **合成主键** `entity.id \|\| `${userId}:${projectId}``（默认偏好实体 id 为空串）⇒ **非雪花 id** ⇒ **与 `/sync/push` 的「客户端预置 id upsert」契约不兼容** ⇒ **不能直接把 preference 加入批量同步**。                                                                                                             | `persistence-local/converters/preference.ts:14`；server `interfaces/controllers/sync.go`（`syncID`/`Create` upsert）                                                         |
| **P7** | （未述）`LocalUserConfigRepoImpl` + 本地 `userConfigs` 表                    | ⚠️ **已存在但生产零调用**（`newLocalUserConfigRepository` 无调用点）⇒ 是**死代码/半成品**；`userConfigs` 在 `BUSINESS_TABLES` 内（登出必清）。**登记死代码，本单不删**（AGENTS.md §3）。                                                                                                                             | `persistence-local/repos/user-config-repo-impl.ts`；`db/local-database.ts:165,247`                                                                                           |
| **P8** | （未述）移动端对偏好 REST 的依赖                                             | ⚠️ **红线相关**：`packages/presentation-react` **使用** `ProjectPreferenceRepoImpl` / `TagPreferenceRepoImpl`（REST）⇒ **服务端 `project_preferences`/`tag_preferences` 表 + REST 不可弃用、不可改语义**（否则移动端与 web/desktop 三方分歧）。**这直接否掉了「把普通清单偏好统一搬进 `UserConfig` blob」的方案**。  | `presentation-react/src/logic/compose-project-usecase.ts:39`；`compose-tag-usecase.ts:36`                                                                                    |

> **PM 认账要求**：P1/P2 属「设计意图被误读为事实」，**须在 PRD 与代码注释双处更正**（见 §7 连带同步清单）。

---

## 2. 现状落点（读码证据）

| 偏好                      | 本地落点                                                                            | 服务端落点                                                        | 现状同步                                           | 登出后                                        |
| :------------------------ | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------- | :------------------------------------------------- | :-------------------------------------------- |
| **普通清单偏好**          | IndexedDB `projectPreferences`（`local-database.ts:257`；`BUSINESS_TABLES` 内）     | `project_preferences` 表 + `/projects/:id/preference`（GET/POST） | **web 在线写远端**；**desktop 写本地（不推不拉）** | ❌ 被清                                       |
| **内建清单偏好**          | localStorage `${email}/${builtInId}`（`built-in/project/repoImpl.ts`）              | **无实体**                                                        | 无                                                 | ❌ 被清                                       |
| **侧边栏宽度**            | localStorage `ASIDE_WIDTH`（`use-aside-width.ts:3`）                                | 无                                                                | 无                                                 | ❌ 被清（身份级名单）                         |
| **日历偏好**              | localStorage `CALENDAR_WEEKSTART` / `CALENDAR_POMODORO_BADGE` / `CALENDAR_DAY_ZOOM` | 无                                                                | 无                                                 | ⚠️ **周起始保留、其余被清**（**现状不一致**） |
| **用户外观** `appearance` | （远端为主）                                                                        | `user_configs.appearance` + `/user/config`（GET/PUT）             | 远端，启动 `loadUserConfig()`                      | ❌ 被清                                       |

**清库口径**：`deletion-service.ts:57` `wipeUserData` 清 `BUSINESS_TABLES`（含 `projectPreferences`）+ `meta`/`syncQueue`/`syncCursor` + localStorage **身份级**键；`DEVICE_LEVEL_STORAGE_KEYS`（`local-storage-policy.ts:34`）**保留** `CALENDAR_WEEKSTART`。**Q3′ 已答「统一用户级」⇒ 须移出设备级白名单**。

**启动加载点**：`apps/web/src/views/index/index-view.ts:170-175` `userUseCase.loadUserConfig()`（两端共用，经 webapp 共享视图）—— **这是设置面同步的天然挂载点**。

**web 离线写闸门**：`packages/presentation/offline/write-methods.ts` 已含 `PROJECT_WRITE_METHODS.saveProjectPreference` 与 `USER_WRITE_METHODS.updateUserConfig`（离线拦截 + `NueMessage` 可见提示，稳定码 `OFFLINE_READONLY`）；**未含内建偏好**（P5）。**r2**：偏好写入口（`saveProjectPreference` / `updateUserConfig`）**须移出**该清单，内建偏好**保持不在**（PS-2a）。

---

## 3. 决策

### D-1 写路径语义：偏好面独立于业务数据面 + **两端本地优先**（与 C-59 的关系）

> **r2 修订（用户裁定，2026-09-23）**：用户原话「**web 端可以离线改，跟 desktop 端一样，都有 indexedDB 的功能**」+「**如果 Web 端不优先走本地然后同步数据到后端的话那还要 indexedDB 干嘛？**」+「**产品整体**：Web 与 Desktop **都是读写本地**，然后**同步服务同步、与后端解决更新冲突**；**Desktop 只是给 Web 套了一层桌面壳**」⇒ **撤销 r1 的「web 不新增本地写路径」结论**，改为 **web 与 desktop 同构的本地优先（local-first）**。

**裁定**：

1. **偏好面 = 独立「设置面」**，**不入 `syncQueue`**（不产生业务 `markDirty`，不新增 `SYNC_TABLES` 项，不改变业务 `pendingCount` 语义）。
2. **两端写路径同构 = 本地优先 + 回传**（**不再分端**）：
    - **普通清单偏好**：两端均写**本地 IndexedDB `projectPreferences`**（web 由 r1 的 `ProjectPreferenceRepoImpl` **远端直连改为本地仓储** `newLocalProjectPreferenceRepository()`）+ 入**偏好队列**；回传 = `POST /projects/:id/preference`。
    - **设置类**（内建清单偏好 / 侧边栏宽度 / 日历偏好）：两端均写**既有本地存储**（内建 `${userId}/${builtInId}` 的 localStorage、`ASIDE_WIDTH`、`CALENDAR_*`）+ 入**偏好队列**；回传 = 推送时**装配快照** `PUT /user/config`（`preferences` blob）。
    - **离线**：**本地写入照常成功**（local-first），**不拦截、不报错**；队列项保留，联网后自动回传。
3. **读路径 = 本地优先**（**r2 新增硬约束**）：偏好读取以**本地为准**（web 不得再走「远端优先」—— 否则刚写入的本地值会被远端陈旧值即时覆盖）。服务端值经**拉取 + LWW** 合并进本地。首次登录 / 本地为空时先返回默认值，由启动拉取补齐（与 desktop 一致）。
4. **偏好同步不阻断 UI**：本地写入同步返回；回传异步、失败静默降级 + 可见计数（AC4）。

**与 C-59 的关系（r2 修订）**：

- C-59 的**实质不变**，仅**作用域收窄**：原文「阶段一不得新增本地写路径」→ **「业务数据面不得新增本地写路径」**，并**显式登记偏好/设置面例外 = 本地优先 + 同步**（见 §D-1b / §D-1c / PS-1a）。
- **业务数据面**（任务/清单/标签/番茄及其写入口）**一字不变**：web 仍**不新增业务本地写**、`markDirty` **恒 0**（含离线）、离线写入口**统一拦截 + `OFFLINE_READONLY` 可见提示**；desktop 业务写路径**不变**。
- **偏好面**为**显式例外**（本地优先 + 同步）——**DP-1 已由 PM 批准**（措辞修订）⇒ **r1 的「阻塞开工」解除**。
- **定性（r2，用户追加）**：C-59 的 **web 业务只读是「过渡态」**，**不是终态** —— 阶段二将撤销 web 只读、**两端统一 local-first**（C-66 的终局即「Web 与 Desktop 都是读写本地 + 同步服务解决冲突」）。故 **C-59 修订措辞不得写成「永久例外」**（见 §10）。

### D-1b web 离线偏好改动的回传与冲突方案（r2 新增，T133 核心交付）

**问题**：r1 设计「偏好面**不入 `syncQueue`**」⇒ 离线期间的偏好改动**没有回传载体**。web 现在也允许离线改偏好 ⇒ 必须给出回传机制。

**候选与裁定**：

| 候选                               | 裁定          | 理由                                                                                                                                                                                                                                                        |
| :--------------------------------- | :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① 复用业务 `syncQueue`             | ❌ **否决**   | ① 本地普通清单偏好为**合成主键**（P6），与 `/sync/push` 的「客户端预置 id upsert」契约**不兼容**；② 会把偏好混入**业务**待推送计数 ⇒ 破坏 C-59「web 业务 `markDirty` 恒 0 / `pendingCount` ≡ 0」的**可验证不变量**；③ 违反 PS-1（偏好不得进业务同步引擎）。 |
| ② **独立轻量偏好队列**（**采纳**） | ✅ **采纳**   | 独立存储 + 独立推送路径（只打偏好端点），**不碰** `syncQueue`/`markDirty`/`SYNC_TABLES`；复用 `sync-retry` 的**退避/到期原语**与既有**触发源**（启动 / `online` / 前台恢复 / 定时），零新增重试机制。                                                       |
| ③ 联网即全量 PUT 快照              | ➖ **并入 ②** | 「设置面」本身就是**整快照 PUT**（`UserConfig.preferences`），故 ② 的 `userConfig` 队列项**天然是全量快照回传**（推送时从本地装配）；普通清单偏好为**按行**回传（不整表 PUT）。⇒ ③ 不是独立方案，是 ② 的一种形态。                                          |

**② 的设计（偏好队列）**：

- **存储**：`meta` 表**单记录** `${userId}:preference-queue`（`MetaRecord` 纯追加可选字段；**不 bump Dexie version、不加索引**，同 C-60 r5 `mirror-status` 先例；登出清库随 `meta` 一并清除）。
- **队列项（去重键 = 单位）**：
    - `{ kind: 'projectPreference', projectId }` —— 按 `projectId` 去重（同一清单偏好多次改合并为最新）。
    - `{ kind: 'userConfig' }` —— 每用户**仅一条**（设置面整快照；多次改合并为最新）。
    - 字段：`createdAt`（首次入队）/ `attempts` / `nextAttemptAt` / `lastErrorClass`（纯追加，复用 `sync-retry` 语义）。
- **入队时机**：本地写成功**之后**（先本地后队列 ⇒ 本地永远是权威可读态）。
- **推送（防抖 ~2s + 退避）**：
    - `userConfig` 项 ⇒ **推送时**从本地存储**装配快照** `{ version: 1, builtInProjectPreferences, asideWidth, calendar }` ⇒ `PUT /user/config`（**全量快照**）。
    - `projectPreference` 项 ⇒ 从本地 `projectPreferences`（解密）取该行 ⇒ `POST /projects/:id/preference`（**按行**）。
    - 成功 ⇒ 出队；**业务类失败** ⇒ 指数退避（`nextAttemptAt`）；**网络类失败** ⇒ 暂停不计数（与 SHELL-06 C-38 同口径）；**凭证类** ⇒ 会话失效。
- **触发源**：启动/登录（拉后推）、`online`、前台恢复、退避定时（复用既有触发注册，**不新增**触发机制）。
- **不变量**：偏好队列**不计入** `syncQueue` / `syncStatus.pendingCount`（业务口径）；偏好同步失败**可见**（AC4 计数/提示），**不阻断**。
- **已知局限（显式接受）**：偏好队列为**单记录**，web 多标签并发写可能互相覆盖（阶段二跨标签协调统一处理，同 C-57/C-45 口径）；登出清库会**丢弃未回传的偏好改动**（见 R-11）。

**冲突语义（LWW 是否仍成立）**：✅ **设置面仍成立**，且**不因 web 离线写而调整**；⚠️ **普通清单偏好 v1 未落地**（**r3 修订，T140 / GAP-4**，PM 裁定 (b)）—— 按下述**分面**读：

- 判据**只用服务端时间**（设置面 = `user_configs.updated_at`；普通清单偏好 = 服务端行 `updated_at`），客户端本地时间戳**仅用于 UI 与队列合并顺序**，**不作冲突判据**（PS-8 不变）。
- **设置面（已落地）**：推送前**先比对** `server.updatedAt` vs 本地持久化的「上次同步到的服务端版本」`SETTINGS_SYNCED_AT`：
    - 相等 ⇒ 远端未变，本地脏则**推送**；
    - **远端更新** ⇒ **远端胜**（应用远端、清本地脏）—— 即「**离线期间他端已改 ⇒ 本端离线改动被丢弃**」（低频、影响小；见 R-2/R-10a，v1 显式接受）；
    - 远端更旧（时钟回拨）⇒ 视为未变，**推送**本地。
- **普通清单偏好（v1 已知局限：按行对账未落地）**：本地 record **无 per-row `syncedUpdatedAt`**，其 `updatedAt` 是**客户端时间**（ADR / PS-8 **禁**作 LWW 判据）⇒ **不做按行对账**：
    - **读路径** = **本地优先 + 仅「本地缺失」时读时对账**（本地缺失 ⇒ `GET /projects/:id/preference` 拉取并落库）；**本地有行 ⇒ 不拉取**；
    - **推送前不对账** ⇒ **他端已改时本端会覆盖他端**（与「远端胜」**反向**）⇒ **AC3-03 不成立**；
    - 登记为**已知局限**（§D-3 / **R-10b**）；**后续单**为**客户端**补齐按行对账 —— **版本标记服务端已提供**（`GET /projects/:id/preference` 返回 `updatedAt`），**无需跨仓**（见 §D-3 后续单条件①）。
- **离线改动不带可信时间戳**，故**不能**用「我改得晚」来主张覆盖 ⇒ 保持 r1 的保守 LWW（服务端权威），**不引入客户端时钟**（该理由同时说明：**不得**用本地 `updatedAt` 顶替 per-row 判据）。

> **r3 说明**：原措辞「同步前先比对 ……（/ 按行 `syncedUpdatedAt`）」的**按行部分未实现** ⇒ 本块按**实际落地**修订；**判据形态不变**（服务端时间为权威，PS-8 不变）。

### D-1c 终态定位：偏好面按「终态架构」设计（阶段二无需翻改）

**依据（用户 2026-09-23 定性）**：产品整体方向 = **Web 与 Desktop 都是读写本地 + 同步服务同步 + 与后端解决更新冲突**；**Desktop 只是给 Web 套了一层桌面壳**。⇒ 阶段一的 **web 业务只读（C-59）是过渡态**，阶段二将**两端统一 local-first**。

**因此偏好面**（本单范围）**直接按终态做**，**无需在阶段二翻改**。依据（逐条）：

1. **写路径已是终态形态**：偏好面在 web/desktop 均为「**写本地 → 独立偏好队列 → 回传**」，与阶段二业务数据面的目标形态（本地写 + 回传队列）**同构**；阶段二只需**复用**该模式（偏好队列可作业务回传队列的**参考实现**），**不改偏好面**。
2. **不依赖阶段一临时机制**：偏好面**不入 `syncQueue`**、**不依赖业务 `markDirty`**、**不依赖 web 离线写闸门** ⇒ 阶段二撤销 web 只读、把业务写路径切本地时，偏好面**不在被切换的集合内**。
3. **冲突语义已按终态选型**：**LWW + 服务端时间为权威**（与「与后端解决更新冲突」一致；**普通清单偏好按行 LWW v1 未落地** —— 见 §D-3 / R-10b，属**实现补齐**、**不推翻选型**）；阶段二若升级为**字段级 `updatedAt` 合并**，属**additive 增强**（blob 内加字段 + 按单位持久化 `syncedUpdatedAt`），**不推翻**本设计。
4. **两端同构**：web 与 desktop 的偏好写/读/同步路径**同一份实现**（本地仓储 + 偏好队列）⇒ 阶段二「两端一致」目标对偏好面**已提前达成**，无二次迁移。

**反证（若按阶段一临时形态做的代价）**：若把 web 偏好做成「远端直连写 / 离线只读」，阶段二必须**重写 web 偏好写路径 + 重做离线回传**，并**推翻用户已裁定的能力**（web 可离线改）⇒ 明确的**返工 + 用户可见能力回退**。故**不采用**。

### D-2 服务端契约

| 项                     | 裁定                                                                                                                                                                                                            | 理由（选型四步法）                                                                                                                                                                                                                                                                                                                               |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`UserConfig` 扩展**  | **新增一个 nullable JSON 列 `preferences`**（**推荐**）；`appearance` **保持独立不动**                                                                                                                          | ① 业务匹配：偏好是客户端拥有的设置集，服务端只需**哑存储**；② 成熟度：GORM AutoMigrate 加列 = additive、无回填、无破坏性；③ 团队能力：JSON 列零学习成本；④ 成本：**新增偏好无需再改服务端**（跨仓部署成本高）。**否决**「加字段」= 字段爆炸 + 每次新增跨仓改；**否决**「改 JSON blob 替换 `appearance`」= 触碰既有校验路径（`changeAppearence`） |
| **`preferences` 内容** | `{ version: 1, builtInProjectPreferences: { <builtInId>: { viewType, getTasksOptions, columns } }, asideWidth, calendar: { weekStart, pomodoroBadge, dayZoom } }`（versioned，服务端不解析）                    | 内建 id 是**客户端概念**（all/today/...）⇒ 不进业务实体                                                                                                                                                                                                                                                                                          |
| **内建清单偏好**       | **进 `UserConfig.preferences`**；**不复用 `ProjectPreference`**                                                                                                                                                 | 内建 id 非服务端 project id；复用需伪造 project 行/破外键 ⇒ 污染业务模型（且服务端**无对应实体**）                                                                                                                                                                                                                                               |
| **普通清单偏好**       | **复用服务端 `project_preferences` 表 + REST（零服务端改动）**；**不加入批量同步**                                                                                                                              | ① **移动端红线**：`presentation-react` 共用该 REST（P8）⇒ 唯一真源不可搬；② **合成主键不兼容** `/sync/push` 的 id upsert 契约（P6）；③ 既有 GET/POST 已按 `projectId` upsert ⇒ 语义天然契合                                                                                                                                                      |
| **DTO / 路由**         | `GET /user/config` 响应**新增 `updatedAt`**（**服务端当前未返回**，客户端 `res.updatedAt` 实为 `undefined`）；`UpdateUserConfigReq.appearance` 由 `binding:"required"` **改可选**（否则无法只推 `preferences`） | LWW 需要服务端权威时间；`required` 会拦截纯偏好更新                                                                                                                                                                                                                                                                                              |
| **迁移**               | GORM AutoMigrate **加列**（`infrastructure/persistence/dbs/mysql.go` AutoMigrate 列表）；**无数据回填**（首次 GET `preferences` 为空 ⇒ 返回空对象，客户端以本地为准并回传）；`appearance` 不动                  | 无破坏性迁移、可回滚（弃列即可）                                                                                                                                                                                                                                                                                                                 |
| **tagPreference**      | **同源问题**（`tag_preferences` 表 + REST + 本地仓储 + mobile 共用）—— PRD **非范围** ⇒ **须显式决策**（DP-5）                                                                                                  | 不处理则「标签偏好」仍两端不一致                                                                                                                                                                                                                                                                                                                 |

### D-3 冲突语义

- **统一判据 = LWW，服务端时间为权威**（**客户端时间戳不作判据**，PS-8）。**两端本地优先不改变本判据**。**（r3）**：该判据**设置面已落地**；**普通清单偏好 v1 未落地**（见下条 / R-10b）。
- **设置面（`UserConfig.preferences`）**：**快照级 LWW，以服务端 `user_configs.updated_at` 为权威时间**。
    - 客户端本地存 `SETTINGS_SYNCED_AT`（上次成功同步的服务端 `updatedAt`）。
    - 启动/登录/`online`：先 `GET /user/config`；`server.updatedAt > SETTINGS_SYNCED_AT` ⇒ **服务端覆盖本地**；否则本地脏 ⇒ **推送**（`PUT`）。
    - **不用客户端时间戳做主判据**（时钟不可信；离线改动尤其无可信时间）。
- **普通清单偏好（r3 修订，T140 / GAP-4）**：**本地优先 + 仅「本地缺失」时读时对账**（本地缺失 ⇒ `GET /projects/:id/preference` 拉取并落库）—— **v1 不含按行 LWW / 推送前对账 / 「远端胜」**。**理由**：本地 record **无 per-row `syncedUpdatedAt`**，唯一现成的 `updatedAt` 是**客户端时间** ⇒ 作按行判据将**违 PS-8**（ADR 禁用客户端时钟）⇒ **非一行可补**。
    - **已知后果（显式接受）**：**本地有行 ⇒ 永不拉取**（他端更新不收敛）；**推送前不与服务端 `updated_at` 对账 ⇒ 他端已改时本端覆盖他端**（与「远端胜」**反向**）⇒ **AC3-03 / R-10 对普通清单偏好不成立**（v1；**不影响** AC1/AC2 恢复 · GAP-1/2/3 · 门禁 · PS-1/PS-10）。
    - **后续单条件**（全部满足方可升级为按行 LWW）：① **版本标记服务端已提供 ⇒ 后续单**无需跨仓**（r3 核实更正 PM 信封「(a) 需跨仓」）**：`GET /projects/:id/preference` 响应已含 `updatedAt`（`GetProjectPreferenceRes.UpdatedAt` ← `ModelBase.UpdatedAt`，服务端 `Save` 走 GORM `Updates` 自动维护；`nao-todo-server` `application/project/converters.go:130`）；⚠️ 客户端 `ProjectPreferenceRes` **当前未声明该字段**（`persistence-go/models/project.ts:41-46`）⇒ 客户端补读即可（另需验证：**同一值重复写入时 `updated_at` 仍推进**；若不推进则服务端补显式 touch）；② 客户端本地 `projectPreferences` **新增 per-row `syncedUpdatedAt`**（纯追加，不 bump Dexie version / 不加索引，同 C-60 r5 口径）；③ **推送前** GET 该行 + 版本比对 ⇒ 「远端更新 ⇒ 远端胜（应用远端 + 清本地脏）」；④ 回归覆盖「双端并发改同一清单偏好」。**不在本批**（见 R-10b）。
- **已知局限（显式接受）**：
    1. 设置面为**整快照覆盖** ⇒ 两台设备并发改**不同**偏好时，后推者会覆盖前者（丢一台的改动）。
    2. **离线期间他端已改** ⇒ 本端离线改动在联网后按「远端胜」被丢弃（**设置面**；见 §D-1b / R-10a）。
    3. **（r3 新增）普通清单偏好按行 LWW 未落地** ⇒ ① 他端更新不收敛；② 本端覆盖他端（条件与后续单见上；R-10b）。
    - v1 **接受**（设置低频、影响小、可再改）；**升级路径** = blob 内每偏好带 `updatedAt` 做字段级合并 + 按单位持久化 `syncedUpdatedAt`（设置面字段级合并、普通清单偏好按行对账，均**不在本批**）。
- **否决**：① 纯「后写覆盖」（无时间戳）—— 会让「本地陈旧快照在换设备登录时覆盖服务端较新值」（反向覆盖，用户可见回归）；② 用**客户端时间戳**主张「我改得晚」⇒ 时钟不可信，且与 web 离线写引入的时钟依赖冲突。

### D-4 同步时机

| 时机             | 策略                                                                                                                                                         |
| :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **启动 / 登录**  | **先拉取 + LWW 合并**（复用 `loadUserConfig()` 挂载点，`index-view.ts:170-175`）；**非阻塞**（不阻塞进入应用）；失败静默降级 + 可见计数（AC4）               |
| **本地变更**     | **先写本地（立即生效，含离线）** → 入偏好队列 → **防抖 ~2s** → 推送（设置面 `PUT /user/config` 全量快照；普通清单偏好 `POST /projects/:id/preference` 按行） |
| **失败重试**     | **指数退避**（复用 `sync-retry` 的 `backoffDelayMs` / `isRetryDue`，**不复用 `syncQueue`**）；`online` / 前台恢复 / 下次启动触发重试；**不阻断 UI**          |
| **登出**         | 偏好随清库清除（用户级；`CALENDAR_WEEKSTART` 须移出设备级白名单，PS-6）⇒ 下次登录从服务端拉回（AC1/AC2）；**未回传的偏好改动会丢失**（R-11，v1 接受）        |
| **服务端不可达** | 本地照常读写（local-first）；**可见提示**（复用/扩展同步状态面，AC4）；恢复后按退避重试                                                                      |

---

## 4. 硬约束（PS）

- **PS-1 偏好面不得进入业务同步引擎**：不得为偏好新增 `syncQueue` 项、不得为偏好新增 `SYNC_TABLES` 项、不得依赖业务 `markDirty` / 业务 LWW 回传机制；偏好回传走**独立偏好队列**（§D-1b）。
- **PS-1a（r2）偏好/设置面 = 本地优先 + 同步（两端一致）**：**web 与 desktop 写偏好一律先写本地**（普通清单偏好 → IndexedDB `projectPreferences`；设置类 → 既有本地存储），**离线改动本地生效**，联网后经偏好队列回传。**禁**把 web 偏好设计成「远端直连写」。
- **PS-1b（r2）偏好读路径 = 本地优先**：web 偏好读取**不得**再走「远端优先」（否则本地刚写入的值会被远端陈旧值覆盖）；远端值经拉取 + LWW 合并进本地。
- **PS-2（r2 重写）业务数据面 web 不得新增本地写路径**：业务数据（任务/清单/标签/番茄/评论/检查项等）web 写一律**远端直连**（C-59 实质不变）；`markDirty` **恒 0**（含离线）；离线写入口**统一拦截 + `OFFLINE_READONLY` 可见提示**。**偏好/设置面不适用本约束**（PS-1a 例外）。
- **PS-2a（r2）离线写闸门须移除偏好入口**：`PROJECT_WRITE_METHODS.saveProjectPreference`、`USER_WRITE_METHODS.updateUserConfig` **必须移出** web 离线写闸门清单（否则离线改偏好仍被拦截，与用户裁定冲突）；内建偏好（`savePreference`）本就不在清单内 ⇒ **保持不在**（r1 的 PS-7 撤销）。
- **PS-3 普通清单偏好服务端唯一真源 = `project_preferences` 表 + REST**（移动端共用，**禁改语义/禁弃用**）。
- **PS-4 内建清单偏好不得复用 `ProjectPreference`**（不得伪造服务端 project 行）。
- **PS-5 `preferences` 列必须 nullable + versioned + 服务端不解析**（服务端保持哑存储；新增偏好无需跨仓改）。
- **PS-6 `CALENDAR_WEEKSTART` 从 `DEVICE_LEVEL_STORAGE_KEYS` 移入身份级**（Q3′；否则登出保留 ⇒ 切换账号串号风险）。
- **PS-7（r2 撤销）** ~~内建偏好写入口必须纳入 web 离线写闸门~~ ⇒ **撤销**：偏好面允许离线写，内建偏好**不得**加入离线写闸门。
- **PS-8 冲突判据必须用服务端时间**（`user_configs.updated_at` / 行 `updated_at`），**禁**用客户端时间戳作判据。
- **PS-9 偏好同步失败不得阻断登录/使用**（AC4）；失败须**可见**（禁静默吞）。
- **PS-10（r2）偏好队列不得改变业务同步可验证性**：偏好队列**不计入** `syncQueue` / `syncStatus.pendingCount`（业务口径）；偏好队列存储**不 bump Dexie version、不加索引**（`meta` 单记录，不触 C-44）。
- **PS-11（r2）偏好面按终态架构设计**：实现**不得**引入「阶段二需翻改」的临时形态（见 §D-1c）。

---

## 5. 风险清单（每项含影响 + 应对）

| #   | 风险                                                                  | 影响                              | 应对                                                                                                                  |
| :-- | :-------------------------------------------------------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| R-1 | **C-59 作用域登记**未获 PM 拍板                                       | 实现期越界 / 事后返工             | ✅ **已关闭（r2）**：DP-1 已批准（C-59 作用域收窄为业务数据面）；**开工阻塞解除**                                     |
| R-2 | **设置面整快照 LWW 覆盖**（并发改不同偏好丢一方）                     | 用户可见设置回退（低频、可再改）  | 显式接受（D-3）；升级路径 = 字段级 `updatedAt`；QA 用例覆盖「两端各改不同偏好」的最坏情形                             |
| R-3 | **`appearance` 的 `binding:"required"`** 改可选，触碰既有外观更新路径 | 外观更新回归                      | 改为可选 + 保留既有校验（`changeAppearence` 白名单）；回归测试覆盖「仅 appearance」「仅 preferences」「两者」三种 PUT |
| R-4 | **`GET /user/config` 加 `updatedAt`** 可能影响既有客户端解析          | 低（additive 字段）               | additive only；`vp check` + 既有 user-store 测试回归                                                                  |
| R-5 | **内建偏好键用 email**（P4）⇒ 改邮箱丢偏好                            | 中（边缘场景）                    | 本批**不改键**（避免迁移）；登记遗留（后续单）或改用稳定 userId（需迁移逻辑）                                         |
| R-6 | **`LocalUserConfigRepoImpl` 死代码**被误当作可用本地存储              | RD 误用                           | 本 ADR 显式登记（P7）；实现若复用须先补 `preferences` 字段 + 测试                                                     |
| R-7 | **桌面端离线偏好变更未回传**（用户长期离线）                          | 服务端无最新偏好 ⇒ 换设备恢复旧值 | 脏标记 + 启动/`online` 重试；**不阻断**；可见计数提示                                                                 |
| R-8 | ~~PRD AC3「离线改偏好本地生效」与 C-59 web 离线只读冲突~~             | —                                 | ✅ **已关闭（r2）**：用户裁定 web 也可离线改偏好 ⇒ AC3 **两端一致**；C-59 作用域收窄为业务数据面（DP-1 已批准）       |
| R-9 | **tagPreference 未处理** ⇒ 「标签偏好」仍两端不一致                   | 与「两端一致」目标部分未达成      | **DP-5**：随本批同法处理，或显式登记后续单（**PM 已裁定 = 后续单**）                                                  |

**r2 新增风险（T133）**

- **R-10（r3 扩展，T140）偏好冲突未闭环 —— 两类**：
    - **R-10a（设置面，已落地）**：**离线期间他端已改 ⇒ 本端离线偏好改动被 LWW 丢弃**（影响：低 —— 偏好低频、可再改）｜应对：显式接受（§D-1b / §D-3）；升级路径 = 字段级 `updatedAt` 合并；QA 覆盖「离线改 + 他端在线改」最坏情形。
    - **R-10b（普通清单偏好，v1 已知局限，未落地）**：**按行 LWW 未实现** ⇒ ① **本地有行 ⇒ 永不拉取**（他端更新不收敛）；② `pushProjectPreference` **推送前不与服务端 `updated_at` 对账** ⇒ **他端已改时本端覆盖他端**（与 §D-3「远端胜」**反向** ⇒ **AC3-03 不成立**）。**根因**：本地 `ProjectPreferenceRecord` **无 per-row `syncedUpdatedAt`**，其 `updatedAt` 为**客户端时间**（ADR / PS-8 禁作 LWW 判据）⇒ **非一行可补**。**影响**：低（偏好低频、可再改；**不影响** AC1/AC2 · GAP-1/2/3 · 门禁 · PS-1/PS-10）。**应对**：**PM 裁定 (b) = 显式登记局限**（本批不改实现，消除「设计与实现不一致」）。**后续单条件（全部满足方可升级；r3 已核实更正）**：① **版本标记服务端已提供 ⇒ 后续单**无需跨仓**（r3 核实更正 PM 信封「(a) 需跨仓」）**：`GET /projects/:id/preference` 响应已含 `updatedAt`（`GetProjectPreferenceRes.UpdatedAt` ← `ModelBase.UpdatedAt`，服务端 `Save` 走 GORM `Updates` 自动维护；`nao-todo-server` `application/project/converters.go:130`）；⚠️ 客户端 `ProjectPreferenceRes` **当前未声明该字段**（`persistence-go/models/project.ts:41-46`）⇒ 客户端补读即可（另需验证：**同一值重复写入时 `updated_at` 仍推进**；若不推进则服务端补显式 touch）；② 客户端本地 `projectPreferences` **新增 per-row `syncedUpdatedAt`**（纯追加，不 bump Dexie version / 不加索引，同 C-60 r5 口径）；③ **推送前** GET 该行 + 与服务端版本比对 ⇒ 「远端更新 ⇒ 远端胜（应用远端 + 清本地脏）」；④ 回归覆盖「双端并发改同一清单偏好」。→ **不在本批**（T140 仅改文档）。
- **R-11 登出清库丢弃未回传的偏好改动**（影响：低）｜应对：登出前 **best-effort flush**（在线时先推一次）；离线登出 ⇒ 改动丢失，文档登记（与业务面 C-1 同口径，v1 接受）。
- **R-12 web 偏好读路径改本地优先 ⇒ 首次登录 / 本地为空时短暂显示默认值**（影响：低）｜应对：启动拉取**非阻塞**补齐 + UI 响应式更新（AC2 可测）；与 desktop 行为一致。
- **R-13 web 多标签并发写偏好队列（`meta` 单记录）互相覆盖**（影响：低）｜应对：偏好写低频 + 队列项按单位去重；阶段二跨标签协调统一处理（同 C-45 / C-57 口径）。
- **R-14 离线写闸门移除偏好入口后，`tagPreference` 仍被拦截**（DP-5 后续单）⇒ 暂时与「偏好可离线改」不一致｜应对：DP-5 单内一并处理；本批显式登记（**不得**声称「偏好面全部一致」）。
- **R-15 偏好队列写入 `meta` 单记录是否违反 C-44**（协议冻结 + 记录字段纯追加）｜应对：**不 bump Dexie version、不加索引**、仅新增 `meta` 键 `${userId}:preference-queue`（同 C-60 r5 `mirror-status` 先例，K-5 判为**不违反**）。

---

## 6. 分阶段里程碑（建议实现顺序）

| 阶段 | 内容                                                                                                                                                   | Owner | 依赖            |
| :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :---- | :-------------- |
| M0   | **PM 落地 DP 裁定** + PRD v0.3 修订（AC3 **两端一致** / 契约 / 非范围 / P3 复数修正 / P1·P2 更正）                                                     | PM    | 本 ADR          |
| M1   | 服务端：`user_configs.preferences` 加列 + DTO `updatedAt` + `UpdateUserConfigReq` 可选化 + 测试                                                        | rd-be | M0（DP-1/DP-3） |
| M2   | 客户端设置面：**本地优先**读写 + 偏好队列 + LWW + 防抖 + 重试 + 启动合并（**两端同构**）                                                               | rd-fe | M1              |
| M3   | 客户端普通清单偏好：**两端**「本地写 + 队列回传 + **读时对账（v1 仅「本地缺失」恢复；按行 LWW 不在本批，见 R-10b）**」（web 由远端直连**改本地仓储**） | rd-fe | M0（DP-1）      |
| M4   | 清库口径：`CALENDAR_WEEKSTART` 设备级→身份级（PS-6）+ **偏好写入口移出离线写闸门（PS-2a）**                                                            | rd-fe | M2              |
| M5   | 回归：登出恢复 / 换设备 / 离线 / 失败降级 + 全范围门禁（8 项）                                                                                         | qa    | M1–M4           |

**r2 追加里程碑（T133）**

| 阶段 | 内容                                                                                                                          | Owner | 依赖 |
| :--- | :---------------------------------------------------------------------------------------------------------------------------- | :---- | :--- |
| M6   | **偏好队列模块**：独立存储（`meta` 单记录）+ 推送（设置面快照 / 普通清单偏好按行）+ 触发接线 + 退避（§D-1b）                  | rd-fe | M1   |
| M7   | **web 偏好本地优先改造**：`ProjectPreferenceRepoImpl` → 本地仓储 + 读路径本地优先（PS-1b）+ 偏好写入口移出离线写闸门（PS-2a） | rd-fe | M6   |

> **不在本批（后续单，见 R-10b）**：普通清单偏好**按行 LWW**（客户端读服务端行 `updatedAt` + 本地 per-row `syncedUpdatedAt` + 推送前对账；**服务端无需改动**）。本批按 PM 裁定 **(b)** 仅**登记局限**（T140）。

---

## 7. 连带同步清单（含 Owner）

> 本评审**改变/更正既有结论**，以下文档与代码注释须同步（禁只改一处）。

| #   | 文件 / 位置                                                                                                                                                                                                                                                 | Owner | 须同步内容                                                                                                                               |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `docs/prds/2026-09-23-local-preference-sync.md`                                                                                                                                                                                                             | PM    | AC3 **两端一致**（DP-2 作废）；服务端契约（D-2）；tagPreference 非范围显式化（DP-5）；`/projects` 复数修正（P3）；P1/P2 更正             |
| S2  | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 §3.6 / §10.9）                                                                                                                                                                  | arch  | **按本 ADR §10 确切措辞**替换 C-59 正文 + 追加 §10.10 + **C-66 作用域限定为业务数据面** + 变更记录 r9（**Owner 改 PM**，用户过目后落地） |
| S3  | `docs/adr/README.md`                                                                                                                                                                                                                                        | arch  | 本篇索引行 + 待拍板 DP-1…DP-6                                                                                                            |
| S4  | `docs/tasks-state.md`                                                                                                                                                                                                                                       | PM    | TASK-26 台账（T129 结论 / 待拍板 / M0–M5）                                                                                               |
| S5  | `packages/infrastructure/src/persistence-sync/sync-tracker.ts:5` + `sync-service.ts:54`                                                                                                                                                                     | RD    | 注释更正：「preferences 随父实体同步」**不实**（P2）                                                                                     |
| S6  | `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts:34`                                                                                                                                                                         | RD    | `CALENDAR_WEEKSTART` 设备级 → 身份级（PS-6）                                                                                             |
| S7  | `packages/presentation/offline/write-methods.ts`                                                                                                                                                                                                            | RD    | **移除偏好写入口**（`saveProjectPreference` / `updateUserConfig`）；内建 `savePreference` **不得列入**（PS-2a）                          |
| S8  | `nao-todo-server`：`domain/identity/entities/userConfig.go` · `infrastructure/persistence/models/user.go:61` · `application/user/dto/user.go:52-59` · `interfaces/types/user.go:50-57` · `infrastructure/persistence/identity/{converters,userRepoImpl}.go` | rd-be | `preferences` 列 + `updatedAt` 出参 + `appearance` 可选化                                                                                |
| S9  | `docs/reports/defect-pool.md`                                                                                                                                                                                                                               | PM    | 登记「偏好落点不一致」（`CALENDAR_WEEKSTART` 设备级 vs 其余身份级；内建偏好未纳入写闸门）是否立缺陷                                      |
| S10 | `AGENTS.md`                                                                                                                                                                                                                                                 | PM    | 若新增守卫/命令（如偏好同步回归门禁）则补                                                                                                |

**r2 追加连带（T133）**

| #   | 文件 / 位置                                                                                      | Owner | 须同步内容                                                                                                                                                         |
| :-- | :----------------------------------------------------------------------------------------------- | :---- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S11 | `packages/presentation/offline/write-methods.ts`                                                 | rd-fe | **移除** `PROJECT_WRITE_METHODS.saveProjectPreference` 与 `USER_WRITE_METHODS.updateUserConfig`；内建 `savePreference` **不得列入**（PS-2a）                       |
| S12 | `apps/web/src/hooks/usecases/binding.ts`                                                         | rd-fe | `createProjectPreferenceRepository` 由 `withMirrorFallback(远端, 本地)` **改为本地仓储**（偏好读路径本地优先，PS-1b）；偏好写入口**不再被 `decorateUseCase` 拦截** |
| S13 | `packages/infrastructure/src/persistence-sync/**`（新增 `preference-sync` / `preference-queue`） | rd-fe | 偏好队列 + 推送 + 触发（§D-1b）；**不得**改 `syncQueue` / `SYNC_TABLES` / `markDirty`                                                                              |

**r3 追加连带（T140：GAP-4 按 PM 裁定 (b) 登记局限）**

| #   | 文件 / 位置                                                                                | Owner | 须同步内容                                                                                                                          |
| :-- | :----------------------------------------------------------------------------------------- | :---- | :---------------------------------------------------------------------------------------------------------------------------------- |
| S14 | `docs/adr/2026-09-23-local-preference-sync.md`（§0-Q3 / §D-1b / §D-3 / §5-R-10 / §6-M3）   | arch  | **本批已落**：普通清单偏好口径 = 「本地优先 + 仅本地缺失读时对账」；按行 LWW 登记为**已知局限 R-10b**（含后续单条件）               |
| S15 | `docs/adr/README.md`（TASK-26 索引行）                                                     | arch  | 索引行补「普通清单偏好按行 LWW v1 未落地（R-10b）」+ 状态 r3                                                                        |
| S16 | `docs/prds/2026-09-23-local-preference-sync.md`（§7 AC3-03 / 冲突语义表述）                | PM    | AC3-03（他端更新 ⇒ 本端收敛）v1 **不成立** ⇒ 按 (b) 口径降级为**已知局限**或移出本批 AC（由 PM 定稿）                               |
| S17 | `docs/qa/2026-09-23-task26-preference-sync-acceptance.md`（§11.9 GAP-4 / AC 矩阵 AC3-03）  | qa    | GAP-4 处置改为「按 (b) 登记局限（R-10b）」；AC3-03 加「v1 = 已知局限，非缺陷」口径                                                  |
| S18 | `docs/tasks-state.md`（TASK-26 条）                                                        | PM    | 登记 GAP-4 处置 = (b) + R-10b + 后续单条件                                                                                          |
| S19 | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 §10 / §10.10） | PM    | **本轮不动**（任务显式要求保持 PM 已落地的 `33c9d248` 措辞）；如需在 C-59 侧加 v1 局限指针，由 PM 决定（本篇 §10 仍为措辞单一真源） |

---

## 8. 待 PM 拍板决策点

| #        | 议题                                                                                                                                    | 建议                                                                                                                                                                                                                                                                                                                                                            | 备注                                                                   |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **DP-1** | **C-59 作用域登记**：是否将 C-59「不得新增本地写路径」**明确为业务数据面**，并把偏好面（desktop 回传 + 设置面 LWW）登记为**显式例外**？ | ✅ **已批准（PM，r2）** —— 作用域收窄为「业务数据面」+ 偏好/设置面显式例外（**业务数据面实质不变**）                                                                                                                                                                                                                                                            | ✅ **阻塞已解除**（用户裁定 + PM 批准；arch 不单方面放宽 P0 条款）     |
| **DP-2** | **PRD AC3「离线改偏好本地生效」端范围**：web 离线是否可改偏好？                                                                         | ❌ **作废**（用户裁定：web 也可离线改偏好）                                                                                                                                                                                                                                                                                                                     | ✅ 用户已裁定（2026-09-23）：**web 与 desktop 一致 = 本地优先 + 同步** |
| **DP-3** | **`UserConfig` 扩展形态**：JSON blob（`preferences`）vs 加字段                                                                          | **JSON blob**（D-2）                                                                                                                                                                                                                                                                                                                                            | 已给四步法理由                                                         |
| **DP-4** | **内建偏好归属**：进 `UserConfig.preferences` vs 新增服务端实体                                                                         | **进 `preferences`**（D-2）                                                                                                                                                                                                                                                                                                                                     | 内建 id 是客户端概念                                                   |
| **DP-5** | **tagPreference**（标签偏好，PRD 非范围）：随本批同法处理 vs 后续单                                                                     | **后续单**（PM 已裁定，r2；本批聚焦用户明确列出的 4 类偏好）                                                                                                                                                                                                                                                                                                    | `tag_preferences` 表 + REST + 本地仓储同型                             |
| **DP-6** | **`CALENDAR_WEEKSTART` 设备级→用户级**（Q3′ 已答「是」）：确认「登出即清、切换账号不串号」可接受                                        | **接受**（PS-6）                                                                                                                                                                                                                                                                                                                                                | 会**改变现有「登出保留」行为**（用户可见但符合 Q3′；用户已拍板）       |
| **DP-7** | **GAP-4 处置**：普通清单偏好「按行 LWW（读时 / 推送前对账）」未落地 —— (a) 本批补实现 vs (b) 修订 ADR 措辞 + 登记局限？                 | ✅ **(b) 已裁定（PM，2026-09-24，T140）**：措辞改为「本地优先 + 仅本地缺失读时对账」+ 扩展 **R-10b** + 后续单。理由：(a) 需补 per-row 对账 + 客户端迁移（**非小单**；PM 原述「跨仓」经 **r3 核实不成立** —— 服务端 GET 已返回 per-row `updatedAt`，缺口在客户端）；(b) 立即消除「设计与实现不一致」、不阻塞本批、不影响 AC1/AC2 · GAP-1/2/3 · 门禁 · PS-1/PS-10 | 后续单条件见 **R-10b**                                                 |

---

## 9. 未过项

- **未过：无**（清单 11 项 + 硬性红线 9 项逐项核对通过；本 ADR 为纯文档产出，**未改代码**，无测试门禁口径适用；影响面评审已用 `codegraph impact/callers`）。
- **阻塞项：无** —— **DP-1 已批准**（r2），开工阻塞解除。
- **r3 登记（GAP-4，非阻塞已知局限）**：**普通清单偏好按行 LWW 未落地** ⇒ **AC3-03 / R-10（普通清单偏好）在 v1 不成立**（PM 裁定 (b)，显式接受；详见 §D-3 / **R-10b**）。**不影响**：AC1/AC2 · GAP-1/2/3 闭合 · 门禁 · PS-1/PS-10。
- **待办（非阻塞）**：**DP-5（tagPreference）后续单**（R-9 / R-14）；**GAP-4 后续单**（客户端读服务端行 `updatedAt` + 本地 per-row `syncedUpdatedAt` + 推送前对账；**服务端无需改动**，见 **R-10b**）；**§10 C-59 措辞**已由 PM 落地（`33c9d248`）。

---

## 10. C-59 修订确切措辞（T133 交付；供 PM 落地并交用户过目）

> **用途**：替换 `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md` §3.6 的 **C-59** 条目正文，并在该篇 §10 追加 **§10.10**（对应本 ADR 的 §D-1b / §D-1c）。
> **定性（用户 2026-09-23）**：**web 业务只读为「过渡态」，不是终态**；偏好/设置面**本阶段即按终态做**。⇒ 措辞**不得**写成「web 永久只读」或「偏好面永久例外」。

```text
- [ ] **C-59 业务数据面阶段一不得新增本地写路径（P0；⚠️ r9 作用域裁定 + 偏好/设置面例外，见 §10.10）**：
      作用域 = **业务数据面**（任务 / 清单 / 标签 / 番茄 / 评论 / 检查项等）。读法 = **外科读法**
      （**离线只读** + **禁新增本地写**），**不是**「两端全程禁写」。分端口径：

    - **web（业务数据面）**：写路径保持**远端直连**（**不得**接本地写仓储）⇒ web 端业务 `markDirty`
      **恒 0**（含离线）；**离线时**（`navigator.onLine === false` 或会话级「离线进入」）业务写入口
      **统一拦截 + 可见提示**（稳定错误码 `OFFLINE_READONLY`，**禁**依赖文案判定）。
    - **desktop（业务数据面）**：写路径**一律不变**（在线：本地仓储 + `markDirty` + push；离线：同上 +
      SHELL-06 入队回传）⇒ **不得**在 desktop 侧套用 web 的离线写闸门。

    - **偏好/设置面（显式例外，两端一致）= 本地优先（local-first）+ 同步，本阶段即按终态做**：
      偏好与设置类数据**不受本条约束** —— 两端**一律先写本地**：
        · 普通清单偏好 → 本地 IndexedDB `projectPreferences`；
        · 内建清单偏好 / 侧边栏宽度 / 日历偏好 → 既有本地存储。
      **离线改动本地生效**（**不拦截**、不报 `OFFLINE_READONLY`）；联网后经**独立轻量偏好队列**
      （**不入 `syncQueue`**、**不产生业务 `markDirty`**）回传服务端：
        · 设置面 → `PUT /user/config`（推送时装配**全量快照** `preferences` blob）；
        · 普通清单偏好 → `POST /projects/:id/preference`（**按行**）。
      读取**本地优先**；冲突 = **LWW，服务端时间为权威**（客户端时间戳**不作判据**）。
      ⇒ **偏好写入口（`saveProjectPreference` / `updateUserConfig` / 内建 `savePreference`）必须移出 /
        不得列入 web 离线写闸门清单。**

    - **过渡态定性（用户 2026-09-23 裁定，见 §10.10）**：**web 业务只读为过渡态，不是终态** ——
      产品整体方向 = **Web 与 Desktop 都是读写本地 + 同步服务同步 + 与后端解决更新冲突**
      （**Desktop 只是给 Web 套了一层桌面壳**）⇒ **阶段二将撤销 web 业务只读、两端统一 local-first**。
      故本条**不得**被引用为「web 永久只读」的依据。

    - **「离线进入」flag 生命周期（PM 补定 + arch 技术约束，r5.1 补记；原文照留）**：……（原文不动）……
    - **清单唯一真源**：**P1 探针报告 `docs/reports/2026-09-23-DEF-PROBE-P1-offline-probes.md` §3.3**
      （**业务写入口清单**；⚠️ 偏好写入口**已移出**该清单，见上；**禁引硬计数**）。
    - **拦截落点**：用例装配层**统一包装**（**禁**逐个改仓储、**禁**逐个 UI 入口各写一套判定）；
      **禁写开关不得拦截** `signOut` / 登出清库 / 迁移 / 离线进入 / 镜像读取等**非写**路径。
    - **LWW 豁免（r5 重新表述，r9 补充）**：豁免 = 「阶段一**不新增**依赖写缓冲/冲突语义的路径」，
      **不是**「无写 / `syncQueue` 恒空」（desktop 既有写路径**在线也**产生 `markDirty` ⇒ 原前提**不成立**）。
      **r9 补充**：**偏好/设置面为显式例外**（本地优先 + 独立偏好队列 + 服务端权威 LWW）——
      因其**不入 `syncQueue`、不产生业务 `markDirty`** ⇒ **不使业务面的豁免判定失效**；
      阶段二两端统一 local-first 时，**偏好面无需翻改**（见 §10.10）。
```

**连带（PM 落地时同批改）**：① **C-66** 中「**web 不得接本地写仓储**」须限定为**业务数据面**（偏好面**必须**接本地仓储）；② C-59 末条「离线进入 flag」与「清单唯一真源」原文**照留**（仅补「偏好写入口已移出」指针）；③ 变更记录追加 **r9** 一行；④ 本 ADR §7-S2 已登记。

### 10.10（建议新增于 C-59 ADR）偏好/设置面 = 终态 local-first（阶段二无需翻改）

> 内容 = 本 ADR **§D-1b + §D-1c** 的浓缩：偏好/设置面两端**本地优先 + 独立偏好队列回传 + 服务端权威 LWW**；**web 业务只读为过渡态**，阶段二两端统一 local-first 时偏好面**不在被切换集合内**（4 条依据见 §D-1c）。

---

## 变更记录

| 版本 | 日期       | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 作者 |
| :--- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| r1   | 2026-09-23 | 首次评审：D-1…D-4 裁定 + PS-1…PS-9 + 8 处事实更正（P1–P8）+ 连带同步清单 S1–S10 + 待拍板 DP-1…DP-6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | arch |
| r2   | 2026-09-23 | **T133 用户裁定修订**：撤销「web 不新增本地写」⇒ **两端本地优先 + 独立偏好队列回传**（新增 §D-1b / §D-1c）· 撤销 DP-2 · C-59 作用域收窄为业务数据面（DP-1 批准）· 偏好写入口移出离线写闸门（PS-2a）· 新增 R-10…R-15 / M6·M7 / S11…S13 / §10（C-59 确切措辞）                                                                                                                                                                                                                                                                                                                                         | arch |
| r3   | 2026-09-24 | **T140（GAP-4 按 PM 裁定 (b) 登记局限）**：修订 **§0-Q3 / §D-1b / §D-3 / §D-1c-3** —— 普通清单偏好口径改为「**本地优先 + 仅「本地缺失」读时对账**」（**不含**按行 LWW / 推送前对账 / 远端胜）；**R-10 扩展为 R-10a（设置面）/ R-10b（普通清单偏好按行 LWW 未落地 + 后续单条件）**；§6-M3 加注 + 后续单说明 · §7 新增 **S14–S19** · §8 新增 **DP-7（已裁定 (b)）** · §9 登记非阻塞局限；**更正 PM 信封「(a) 需跨仓服务端版本标记」**—— 服务端 GET 已返回 per-row `updatedAt`（`converters.go:130`）⇒ 后续单为**客户端**改造。**⛔ 未改代码；§10 / §10.10（C-59 措辞，PM 已落地 `33c9d248`）保持不动** | arch |