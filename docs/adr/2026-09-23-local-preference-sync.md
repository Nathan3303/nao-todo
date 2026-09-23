# 2026-09-23 本地偏好同步（TASK-26）架构评审 —— 结论：**有条件可行**

- **日期**：2026-09-23
- **状态**：⏳ 有条件通过（**PS-1…PS-9**；**DP-1…DP-6 待 PM 拍板**）｜⛔ **纯设计，未改任何代码**
- **评审对象**：T129 —— 本地偏好同步的**写路径语义 / 服务端契约 / 冲突语义 / 同步时机**
- **依据**：PRD `docs/prds/2026-09-23-local-preference-sync.md`（v0.2）；`docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 r5 / §10.9）；`docs/tasks-state.md` TASK-26 条
- **关联仓库**：`/home/nathan/Project/nao-todo`（客户端）、`/home/nathan/Project/nao-todo-server`（服务端，Q4′ 已授权跨仓）
- **代码边界**：本 ADR 为**纯文档产出**，未修改任何仓库代码（含服务端）
- **影响面工具**：`codegraph impact/callers`（`UserConfigEntity` 26 符号 / `loadUserConfig` 1 调用点 / `BuiltInProjectRepository` 11 符号 / `useAsideWidth` 10 调用点）+ 行号级读码

---

## 0. 结论摘要（先看这里）

| #      | 问题                       | 结论                                                                                                                                                                                                                                                                                                                                     |
| :----- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | 写路径语义（与 C-59 关系） | **偏好面独立于业务数据面**（**不入 `syncQueue`**）。**web 不新增本地写路径**（偏好写远端，C-59 **不放宽**）；**desktop 偏好本地写 + 回传远端**（既有 desktop 写路径的**功能扩展**）。**C-59 只需文档级收窄/登记**（明确「本地写路径」= 业务数据面 + 偏好面例外）—— **须 PM 拍板登记（DP-1）**。离线**不入队**，用轻量脏标记 + 读时对账。 |
| **Q2** | 服务端契约                 | `UserConfig` **加一个 nullable JSON 列 `preferences`**（推荐，非加字段/非改 blob）；**普通清单偏好复用既有 `project_preferences` 表 + REST（零服务端改动）**；**内建清单偏好进 `UserConfig.preferences`**（**不复用 `ProjectPreference`**）；迁移 = GORM AutoMigrate 加列（additive、无回填、无破坏性）。                                |
| **Q3** | 冲突语义                   | **LWW**：设置面 = **快照级 LWW，服务端 `user_configs.updated_at` 为权威**；普通清单偏好 = **按行 `updatedAt` LWW（读时对账）**。**不用客户端时间戳做主判据**。已知局限：设置面整快照覆盖 → v1 接受，升级路径 = 字段级 `updatedAt`。                                                                                                      |
| **Q4** | 同步时机                   | 启动/登录**拉取**（复用 `loadUserConfig`，非阻塞、失败静默降级 + 可见计数）；变更**防抖推送**（~2s）；失败**指数退避重试**（`online`/前台恢复/启动触发）；登出清本地（既有）→ 重登拉回。                                                                                                                                                 |

**一句话**：偏好不是业务数据 —— 应走**独立的「设置面」通道**（普通清单偏好复用其既有 REST，其余进 `UserConfig.preferences`），**不碰业务同步引擎**（`syncQueue`/`markDirty`/`SYNC_TABLES`），也**不需要放宽 web 离线只读**；真正需要 PM 拍板的是 **C-59 的文档级作用域登记**与 **PRD AC3 的端限定**。

---

## 1. 事实核对：对 PM 输入信封 / PRD 的 8 处更正与补强

| #      | 原述                                                                         | 核实结果                                                                                                                                                                                                                                                                                                             | 证据                                                                                                                                                                         |
| :----- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | 「普通清单偏好：服务端 API 已存在 ⇒ **无需新增 API**」（PRD §附）            | ✅ **API 无需新增**（对），但 ❌ **「已同步」是错觉** —— desktop binding 用**本地仓储**（`newLocalProjectPreferenceRepository()`），`save` **不 `markDirty`**，`SYNC_TABLES` **无 preferences** ⇒ **desktop 既不推也不拉**；仅 **web 在线**写远端（`ProjectPreferenceRepoImpl`）。**⇒ 需新增同步接线，非「已有」**。 | `apps/desktop/.../binding.ts:37`；`persistence-local/repos/project-preference-repo-impl.ts:42-52`；`persistence-sync/sync-service.ts:112`；`apps/web/.../binding.ts:127-132` |
| **P2** | `sync-tracker.ts` 注释「projectPreferences/tagPreferences **随父实体同步**」 | ❌ **与代码不符**（无 `markDirty`、无 `SYNC_TABLES` 项、服务端 `/sync/push`\|`/sync/pull` **无 preference**）⇒ **该注释是设计意图的残留，非事实**；须更正（否则后续 RD 会被误导）。                                                                                                                                  | `persistence-sync/sync-tracker.ts:5`；`sync-service.ts:54`；server `interfaces/controllers/sync.go`（Push/Pull 无 preference）                                               |
| **P3** | 服务端路由 `/project/:projectId/preference`（PRD §附，**单数**）             | ⚠️ **笔误**：实际为 **`/projects/:projectId/preference`（复数）** GET/POST。                                                                                                                                                                                                                                         | server `interfaces/routers/projectRouter.go:59,63`；client `persistence-go/project/project-preference-repo-impl.ts`（`/projects/...`）                                       |
| **P4** | 内建清单偏好键 `${userId}/${builtInId}`「**已含 userId**」                   | ⚠️ **该 `userId` 实为 `email`**（调用点传 `profile.value?.email ?? ''`）⇒ 用户**改邮箱**会串号/丢失。                                                                                                                                                                                                                | `apps/web/src/components/tasks/built-in-project/main/index.vue:77`；`built-in/project/repoImpl.ts:59-98`                                                                     |
| **P5** | 「内建清单偏好**按 builtIn id**」                                            | ✅ 对，但**该写路径未纳入 web 离线写闸门** —— `use-built-in-project-usecase.ts` **无** `decorateUseCase`，`write-methods.ts` **无** builtIn 项 ⇒ **web 离线可写内建偏好**（与 C-59 其余写入口不一致的**既有漏洞**）。                                                                                                | `apps/web/src/hooks/usecases/use-built-in-project-usecase.ts`；`packages/presentation/offline/write-methods.ts`                                                              |
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

**web 离线写闸门**：`packages/presentation/offline/write-methods.ts` 已含 `PROJECT_WRITE_METHODS.saveProjectPreference` 与 `USER_WRITE_METHODS.updateUserConfig`（离线拦截 + `NueMessage` 可见提示，稳定码 `OFFLINE_READONLY`）；**未含内建偏好**（P5）。

---

## 3. 决策

### D-1 写路径语义：偏好面独立于业务数据面（与 C-59 的关系）

**裁定**：

1. **偏好面 = 独立「设置面」**，**不入 `syncQueue`**（不产生业务 `markDirty` 依赖，不新增 `SYNC_TABLES` 项）。
2. **分端写路径**（保持与既有架构同构）：
    - **web**：**不新增本地写路径**。普通清单偏好 → 既有 `ProjectPreferenceRepoImpl`（**远端直连**，C-59 不变）；设置类（内建/侧边栏/日历）→ 远端 `PUT /user/config`。**离线**沿用既有只读闸门（`saveProjectPreference`/`updateUserConfig` 已在清单内；**须补**内建偏好入口，见 PS-7）。
    - **desktop**：**本地优先 + 回传远端**（功能扩展）。普通清单偏好 → 写本地 `project_preferences` + **best-effort 回传** `POST /projects/:id/preference`；设置类 → 写 localStorage + **防抖 `PUT /user/config`**。
3. **离线**：**不入 `syncQueue`**。用**轻量脏标记**（localStorage，随登出清除）+ **读时对账**（普通清单偏好：本地/远端 `updatedAt` 比较，本地新则回传、远端新则应用）+ **`online`/启动重试**（设置面：指数退避，复用 `sync-retry` 理念）。
4. **恢复路径**：登出清本地（既有）→ 重登/启动 **拉取 + LWW 合并** ⇒ AC1/AC2 成立（web 走远端读、desktop 走本地 miss→远端）。

**与 C-59 的关系（关键）**：

- C-59 r5 的读法 = **外科读法**：**web 离线只读 + desktop 写路径不变**；LWW 豁免 = 「阶段一**不新增**依赖写缓冲/冲突语义的路径」。
- 本方案**不放宽 web 离线只读**（web 无偏好本地写）⇒ **C-59 的 web 半边不受影响**。
- 但 **desktop 偏好回传**与**设置面 LWW**严格属于「新增依赖冲突语义的路径」⇒ **触发 LWW 豁免条款**，须 **PM 显式登记为 C-59 的偏好面例外**（DP-1）。理由：
    - 偏好是**幂等、无父子、低频**的用户设置，与业务数据（任务/清单/标签）的冲突面**性质不同**；
    - 偏好**不入 `syncQueue`** ⇒ 不引入业务回传的 C-1 风险（登出丢未同步业务写入）；
    - 阶段二「写路径切本地 + 回传队列」落地时，偏好面**无需翻改**（已自洽）。
- **C-59 措辞修订（文档级）**：把「阶段一不得新增本地写路径」的**作用域明确为「业务数据面」**，并登记偏好面处置（PS-1/PS-2）。

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

- **设置面（`UserConfig.preferences`）**：**快照级 LWW，以服务端 `user_configs.updated_at` 为权威时间**。
    - 客户端本地存 `SETTINGS_SYNCED_AT`（上次成功同步的服务端 `updatedAt`）。
    - 启动/登录/回传：`server.updatedAt > SETTINGS_SYNCED_AT` ⇒ **服务端覆盖本地**；否则本地脏 ⇒ **推送**。
    - **不用客户端时间戳做主判据**（时钟不可信）。
- **普通清单偏好**：**按行 `updatedAt` LWW**（读时对账：本地新 → 回传；远端新 → 应用）。
- **已知局限（显式接受）**：设置面为**整快照覆盖** ⇒ 两台设备并发改**不同**偏好时，后推者会覆盖前者（丢一台的改动）。v1 **接受**（设置低频、影响小、可再改）；**升级路径** = blob 内每偏好带 `updatedAt` 做字段级合并（不在本批）。
- **否决**：纯「后写覆盖」（无时间戳）—— 会让「本地陈旧快照在换设备登录时覆盖服务端较新值」（反向覆盖，用户可见回归）。

### D-4 同步时机

| 时机             | 策略                                                                                                                                         |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **启动 / 登录**  | **拉取 + LWW 合并**（复用 `loadUserConfig()` 挂载点，`index-view.ts:170-175`）；**非阻塞**（不阻塞进入应用）；失败静默降级 + 可见计数（AC4） |
| **变更即推**     | 本地偏好变更 → **置脏** → **防抖 ~2s** → 推送（设置面 `PUT /user/config`；普通清单偏好 `POST /projects/:id/preference`）                     |
| **失败重试**     | **指数退避**（复用 `sync-retry` 的 `backoffDelayMs` 理念，**不复用 `syncQueue`**）；`online` / 前台恢复 / 下次启动触发重试；**不阻断 UI**    |
| **登出**         | 偏好随清库清除（用户级；`CALENDAR_WEEKSTART` 须移出设备级白名单，PS-6）⇒ 下次登录从服务端拉回（AC1/AC2）                                     |
| **服务端不可达** | 本地生效；**可见提示**（复用/扩展同步状态面，AC4）；恢复后按退避重试                                                                         |

---

## 4. 硬约束（PS）

- **PS-1 偏好面不得进入业务同步引擎**：不得为偏好新增 `syncQueue` 项、不得为偏好新增 `SYNC_TABLES` 项、不得依赖业务 `markDirty`/LWW 回传机制。
- **PS-2 web 不得新增本地偏好写路径**：web 偏好写一律远端直连（C-59 不变）；本地副本由拉取（镜像）填充。
- **PS-3 普通清单偏好服务端唯一真源 = `project_preferences` 表 + REST**（移动端共用，**禁改语义/禁弃用**）。
- **PS-4 内建清单偏好不得复用 `ProjectPreference`**（不得伪造服务端 project 行）。
- **PS-5 `preferences` 列必须 nullable + versioned + 服务端不解析**（服务端保持哑存储；新增偏好无需跨仓改）。
- **PS-6 `CALENDAR_WEEKSTART` 从 `DEVICE_LEVEL_STORAGE_KEYS` 移入身份级**（Q3′；否则登出保留 ⇒ 切换账号串号风险）。
- **PS-7 内建偏好写入口必须纳入 web 离线写闸门**（补 `write-methods.ts` 或经 `updateUserConfig` 统一），消除 P5 既有漏洞。
- **PS-8 冲突判据必须用服务端时间**（`user_configs.updated_at` / 行 `updatedAt`），**禁**用客户端时间戳作唯一判据。
- **PS-9 偏好同步失败不得阻断登录/使用**（AC4）；失败须**可见**（禁静默吞）。

---

## 5. 风险清单（每项含影响 + 应对）

| #   | 风险                                                                  | 影响                              | 应对                                                                                                                  |
| :-- | :-------------------------------------------------------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| R-1 | **C-59 作用域登记**未获 PM 拍板                                       | 实现期越界 / 事后返工             | **DP-1 阻塞开工**；ADR 先登记，PM 拍板后再派实现                                                                      |
| R-2 | **设置面整快照 LWW 覆盖**（并发改不同偏好丢一方）                     | 用户可见设置回退（低频、可再改）  | 显式接受（D-3）；升级路径 = 字段级 `updatedAt`；QA 用例覆盖「两端各改不同偏好」的最坏情形                             |
| R-3 | **`appearance` 的 `binding:"required"`** 改可选，触碰既有外观更新路径 | 外观更新回归                      | 改为可选 + 保留既有校验（`changeAppearence` 白名单）；回归测试覆盖「仅 appearance」「仅 preferences」「两者」三种 PUT |
| R-4 | **`GET /user/config` 加 `updatedAt`** 可能影响既有客户端解析          | 低（additive 字段）               | additive only；`vp check` + 既有 user-store 测试回归                                                                  |
| R-5 | **内建偏好键用 email**（P4）⇒ 改邮箱丢偏好                            | 中（边缘场景）                    | 本批**不改键**（避免迁移）；登记遗留（后续单）或改用稳定 userId（需迁移逻辑）                                         |
| R-6 | **`LocalUserConfigRepoImpl` 死代码**被误当作可用本地存储              | RD 误用                           | 本 ADR 显式登记（P7）；实现若复用须先补 `preferences` 字段 + 测试                                                     |
| R-7 | **桌面端离线偏好变更未回传**（用户长期离线）                          | 服务端无最新偏好 ⇒ 换设备恢复旧值 | 脏标记 + 启动/`online` 重试；**不阻断**；可见计数提示                                                                 |
| R-8 | **PRD AC3「离线改偏好本地生效」与 C-59 web 离线只读冲突**             | AC 不可测 / 实现分歧              | **DP-2**：推荐 AC3 限 desktop（web 离线只读，C-59 不变）；备选 = web 偏好豁免（须用户知情）                           |
| R-9 | **tagPreference 未处理** ⇒ 「标签偏好」仍两端不一致                   | 与「两端一致」目标部分未达成      | **DP-5**：随本批同法处理，或显式登记后续单                                                                            |

---

## 6. 分阶段里程碑（建议实现顺序）

| 阶段 | 内容                                                                                            | Owner | 依赖            |
| :--- | :---------------------------------------------------------------------------------------------- | :---- | :-------------- |
| M0   | **PM 拍板 DP-1…DP-6** + PRD v0.3 修订（AC3 端限定 / 契约 / 非范围 / P3 复数修正 / P1·P2 更正）  | PM    | 本 ADR          |
| M1   | 服务端：`user_configs.preferences` 加列 + DTO `updatedAt` + `UpdateUserConfigReq` 可选化 + 测试 | rd-be | M0（DP-1/DP-3） |
| M2   | 客户端设置面：`preferences` 读写 + LWW + 防抖 + 重试 + 启动合并（web 远端 / desktop 本地+回传） | rd-fe | M1              |
| M3   | 客户端普通清单偏好：desktop「写时回传 + 读时对账」（web 零改动）                                | rd-fe | M0（DP-1）      |
| M4   | 清库口径：`CALENDAR_WEEKSTART` 设备级→身份级 + 内建偏好纳入写闸门（PS-6/PS-7）                  | rd-fe | M2              |
| M5   | 回归：登出恢复 / 换设备 / 离线 / 失败降级 + 全范围门禁（8 项）                                  | qa    | M1–M4           |

---

## 7. 连带同步清单（含 Owner）

> 本评审**改变/更正既有结论**，以下文档与代码注释须同步（禁只改一处）。

| #   | 文件 / 位置                                                                                                                                                                                                                                                 | Owner | 须同步内容                                                                                                        |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---- | :---------------------------------------------------------------------------------------------------------------- |
| S1  | `docs/prds/2026-09-23-local-preference-sync.md`                                                                                                                                                                                                             | PM    | AC3 端限定（DP-2）；服务端契约（D-2）；tagPreference 非范围显式化（DP-5）；`/projects` 复数修正（P3）；P1/P2 更正 |
| S2  | `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-59 §3.6 / §10.9）                                                                                                                                                                  | arch  | 登记 C-59 **作用域 = 业务数据面** + 偏好面例外（PS-1/PS-2）；变更记录一行                                         |
| S3  | `docs/adr/README.md`                                                                                                                                                                                                                                        | arch  | 本篇索引行 + 待拍板 DP-1…DP-6                                                                                     |
| S4  | `docs/tasks-state.md`                                                                                                                                                                                                                                       | PM    | TASK-26 台账（T129 结论 / 待拍板 / M0–M5）                                                                        |
| S5  | `packages/infrastructure/src/persistence-sync/sync-tracker.ts:5` + `sync-service.ts:54`                                                                                                                                                                     | RD    | 注释更正：「preferences 随父实体同步」**不实**（P2）                                                              |
| S6  | `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts:34`                                                                                                                                                                         | RD    | `CALENDAR_WEEKSTART` 设备级 → 身份级（PS-6）                                                                      |
| S7  | `packages/presentation/offline/write-methods.ts`                                                                                                                                                                                                            | RD    | 补内建偏好写入口（PS-7）                                                                                          |
| S8  | `nao-todo-server`：`domain/identity/entities/userConfig.go` · `infrastructure/persistence/models/user.go:61` · `application/user/dto/user.go:52-59` · `interfaces/types/user.go:50-57` · `infrastructure/persistence/identity/{converters,userRepoImpl}.go` | rd-be | `preferences` 列 + `updatedAt` 出参 + `appearance` 可选化                                                         |
| S9  | `docs/reports/defect-pool.md`                                                                                                                                                                                                                               | PM    | 登记「偏好落点不一致」（`CALENDAR_WEEKSTART` 设备级 vs 其余身份级；内建偏好未纳入写闸门）是否立缺陷               |
| S10 | `AGENTS.md`                                                                                                                                                                                                                                                 | PM    | 若新增守卫/命令（如偏好同步回归门禁）则补                                                                         |

---

## 8. 待 PM 拍板决策点

| #        | 议题                                                                                                                                    | 建议                                                             | 备注                                                 |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- | :--------------------------------------------------- |
| **DP-1** | **C-59 作用域登记**：是否将 C-59「不得新增本地写路径」**明确为业务数据面**，并把偏好面（desktop 回传 + 设置面 LWW）登记为**显式例外**？ | **是**（文档级修订，**不放宽 web 离线只读**）                    | **阻塞开工**；arch 不单方面放宽 P0 条款              |
| **DP-2** | **PRD AC3「离线改偏好本地生效」端范围**：web 离线是否可改偏好？                                                                         | **AC3 限 desktop**（web 离线只读，与 C-59 一致）                 | 备选 = 给 web 偏好开本地写豁免 ⇒ **须用户显式知情**  |
| **DP-3** | **`UserConfig` 扩展形态**：JSON blob（`preferences`）vs 加字段                                                                          | **JSON blob**（D-2）                                             | 已给四步法理由                                       |
| **DP-4** | **内建偏好归属**：进 `UserConfig.preferences` vs 新增服务端实体                                                                         | **进 `preferences`**（D-2）                                      | 内建 id 是客户端概念                                 |
| **DP-5** | **tagPreference**（标签偏好，PRD 非范围）：随本批同法处理 vs 后续单                                                                     | **随本批同法处理**（否则「两端一致」留缺口）或**显式登记后续单** | `tag_preferences` 表 + REST + 本地仓储同型           |
| **DP-6** | **`CALENDAR_WEEKSTART` 设备级→用户级**（Q3′ 已答「是」）：确认「登出即清、切换账号不串号」可接受                                        | **接受**（PS-6）                                                 | 会**改变现有「登出保留」行为**（用户可见但符合 Q3′） |

---

## 9. 未过项

- **未过：无**（清单 11 项 + 硬性红线 9 项逐项核对通过；本 ADR 为纯文档产出，**未改代码**，无测试门禁口径适用；影响面评审已用 `codegraph impact/callers`）。
- **阻塞项**：DP-1（C-59 作用域登记）—— 未拍板前**不得派发实现**（M1–M5）。

---

## 变更记录

| 版本 | 日期       | 变更                                                                                               | 作者 |
| :--- | :--------- | :------------------------------------------------------------------------------------------------- | :--- |
| r1   | 2026-09-23 | 首次评审：D-1…D-4 裁定 + PS-1…PS-9 + 8 处事实更正（P1–P8）+ 连带同步清单 S1–S10 + 待拍板 DP-1…DP-6 | arch |