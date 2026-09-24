# 2026-09-24 清单归档（Project Archive）架构评审 —— 结论：**有条件可行**

- **日期**：2026-09-24
- **状态**：⏳ **有条件可行**（**无「不可行」项**；**阻塞项 1 项** = `DEF-36` 前置修复；**DP-1 已裁定 = (b)**（2026-09-24，用户）· **DP-2…DP-5 待 PM 拍板**；**r2 = 接口命名与形状（§15）+ DP-1 入档**）｜⛔ **纯设计，未改任何代码**（含服务端）
- **任务**：`T175`（清单归档 PRD 架构评审，6 项）
- **评审对象**：PRD `docs/prds/2026-09-24-project-archive.md`（v0.1，用户 12 条口径）
- **事实依据**：现状核查报告 `docs/reports/2026-09-24-project-archive-status.md`（`T174` 探针，`ce272bc3`）—— **本 ADR 逐条独立读码复核**（不采信转述；对探针/PM 结论的更正见 §1.3）
- **关联仓库**：`/home/nathan/Project/nao-todo`（客户端）、`/home/nathan/Project/nao-todo-server`（服务端，**只读**引用）
- **硬约束**：**不丢失数据**（归档绝不写删除位）· **不丢失功能**（阶段一/二零回归）· **移动端零改动**（红线）
- **前置**：**`DEF-36` 必须与入口同批修复** —— `ProjectUseCase.archive()` / `unarchive()` 当前**均误调 `projectRepo.delete()`**

---

## 0. 结论摘要（先看这里）

| #      | 议题               | 结论（要点）                                                                                                                                                                                                                                                                                                                                                                            |
| :----- | :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **客户端任务级联** | **必做**（新增任务仓储 `archiveByProjectId` / `unarchiveByProjectId`，**单个 Dexie `rw` 事务**内改「清单 + 其下任务」+ **逐任务 `markDirty`**）。否则离线窗口违反 AC1/AC2 且产生「清单收起、任务仍可见」（R-B）。**代价** = N 任务本地写 + N 队列项 + N 推送项（低频、单请求批量、幂等）                                                                                                |
| **Q2** | **可见性补漏**     | **单一杠杆 = 本地任务仓储 `list()` 默认排除归档**（未传 `isArchived` ⇒ 视同 `false`）⇒ 覆盖清单视图 + 内置视图 + 未来调用方；**逐处清单见 §3.2**。**`taskCount` 口径不变**（含归档/不含删除），但**二次确认的 N 不得用 `taskCount`**（取「未归档且未删除」计数）                                                                                                                        |
| **Q3** | **三态边界**       | **归档 = `archivedAt`** · **停用/删除 = `deactivedAt`（服务端权威）** · **墓碑 = `deletedAt`（仅同步/清库）**。客户端「已删除」判据 = **`deletedAt` ∪ `deactivedAt` 任一非空**；`ProjectEntity.isDeactived()`（未来时间判据，**0 调用方**）**废弃**（系用户域「注销宽限期」语义误移植）。**无数据迁移**                                                                                 |
| **Q4** | **收集箱表示**     | **写 `projectId = 'inbox'`（内建 id），禁写 `''`**（`''` 是搜索内部 + URL token）。服务端 `''`/`'inbox'` **等价归一**为隐式桶 `userId`（CAL-03）；写 `''` 会因**本地**按 `'inbox'` 过滤而**当场「任务消失」**。单任务脱归档 ⇒ **`archivedAt=null` + `projectId='inbox'`**（两者同批写）                                                                                                 |
| **Q5** | **`DEF-12`**       | **②（`sort` 无白名单 = 注入面）同批修**；**①（`isArchived=false` 空操作）同批修但只修显式 `false` 分支**（**不改服务端默认**，避免改变移动端可见结果）。**「移动端可见归档」⇒ DP-1 已裁定 = (b)：服务端列表**默认（未传 `isArchived`）**也排除归档**（已核实 `/sync/pull` 不经该 scope ⇒ 技术上安全）⇒ **R-8 关闭**；**移动端代码零改动**，行为变化随发布说明登记**。跨仓 ⇒ 须 PM 批准  |
| **Q6** | **只读面板与复位** | 路由**复用**清单视图 `/tasks/p/:projectId/:viewType/:taskId?` + **数据驱动归档态守卫**（判据 = 任务 `archivedAt` 非空，写用例层拦截）；**新增独立错误码 `ARCHIVED_READONLY`**（**不复用** `OFFLINE_READONLY`）。「已归档」入口 = 侧栏底部 + **复用 `project-manager` 弹窗新增 `archived` tab**。**`sortId`**：重建仍只含活动项；恢复时若碰撞 ⇒ 以恢复值作锚归一（「回原位」= 最近位置） |

**一句话**：归档的数据骨架、同步字段、服务端 API 与**双向级联****都已存在**；本批的实质是**把「归档」与「删除」在两端彻底分开**（`archivedAt` ≠ `deactivedAt` ≠ `deletedAt`）+ **补齐客户端级联与可见性默认排除** + **闭环入口/面板/只读**；**唯一 P0 前置是 `DEF-36`**（否则「归档」按钮 = 删数据按钮）。

---

## 1. 事实基线（读码核实）

### 1.1 两端字段与谓词（**权威表**）

| 字段                    | 端              | 写入者                                                                                                         | 语义                                    | 证据                                                                                                                                           |
| :---------------------- | :-------------- | :------------------------------------------------------------------------------------------------------------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **`archivedAt`**        | 客户端 + 服务端 | 客户端 `projectRepo.archive/unarchive`（**当前无调用方**）；服务端 `Project.Archive/Unarchive`（**级联任务**） | **归档**（可逆）                        | `project-repo-impl.ts:125-157`；`domain/project/entities/project.go:28-35`；`application/project/appImpl.go:217-282`                           |
| **`deactivedAt`**       | 客户端 + 服务端 | 服务端 `Project.Delete/Restore`（**级联软删任务**）；客户端**仅 pull 回填**                                    | **停用 = 删除**（可恢复；7 天后 purge） | `domain/project/entities/project.go:37-43`（注释「软删除，设置停用时间」）；`appImpl.go:132-170`；`repoImpl.go:204-209,325-337`                |
| **`deletedAt`**         | 客户端 + 服务端 | 客户端 `projectRepo.delete()`（**本地墓碑**）；服务端**仅 purge** 时由 GORM 写入                               | **墓碑/清除**（**不作业务判定**）       | `project-repo-impl.ts:84-100`；`repoImpl.go:325-337`（`DeleteDeactivatedProjects`）                                                            |
| **`taskCount`**         | 服务端 owned    | 服务端计数事件（反规范化列）                                                                                   | **含归档 / 含子任务 / 不含已删除**      | `models/project.go`（注释）；`repoImpl.go:364-365`                                                                                             |
| **`projectId='inbox'`** | 两端数据面      | 客户端建/改；服务端 `''`/`'inbox'` **归一为 `userId` 隐式桶**                                                  | **收集箱单一真源（数据面）**            | `built-in/project/default.ts:48,135-142`；`server/application/task/converters.go:133,206`；ADR `2026-09-21-inbox-sentinel-single-source.md` D3 |

**客户端谓词现状（**存在不一致，须收敛**）**：

| 谓词                           | 现状实现                                                  | 问题                                                                                                              |
| :----------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `ProjectViewObject.isArchived` | `dayjs(archivedAt).isValid()`（**presence**）             | ✅ 与「归档 = `archivedAt` 非空」一致                                                                             |
| `ProjectViewObject.isDeleted`  | `dayjs(deactivedAt).isValid()`（**presence**）            | ⚠️ **只看 `deactivedAt`**，而本地真删除写的是 `deletedAt` ⇒ **两个「已删除」字段并存**（§2）                      |
| `ProjectEntity.isDeactived()`  | `deactivedAt !== null && dayjs(deactivedAt).isAfter(now)` | ⚠️ **未来时间判据**（用户域「注销宽限期」语义）⇒ 与项目域（服务端写**过去**时间）**相反**；**0 调用方**（死代码） |
| 侧栏 `avaliableProjects`       | `!isDeleted && !isArchived`                               | ✅ 已排除归档（依赖上面的 presence 谓词）                                                                         |

证据：`domain-project/src/application/usecases/project-service/converters.ts:31-39`；`domain/entities/project.ts:27-38`；`packages/presentation/project/stores/projects-store.ts:21-24`；`application/user/converters.go:22-23`（**用户**域 `deactivedAt` = 停用时间 **+7 天**）vs `application/project/converters.go:58`（**项目**域 = 原值，**过去**）。

### 1.2 级联与可见性现状

| 环节                | 客户端                                                            | 服务端                                                                        |
| :------------------ | :---------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| 清单归档 ⇒ 任务归档 | ❌ **无级联**（任务仓储无 archive 方法；`archivedAt` 仅 pull 写） | ✅ **级联**（`ArchiveByProjectId`）                                           |
| 清单恢复 ⇒ 任务恢复 | ❌ 无                                                             | ✅ **级联**（`UnarchiveByProjectId`）                                         |
| 清单删除 ⇒ 任务软删 | ❌ 无（仅清单 `deletedAt`）                                       | ✅ **级联**（`SoftDeleteByProjectId`）                                        |
| 归档/删除入口       | ⛔ **不可达**（菜单项整段注释 + `archive()` 误调 `delete()`）     | ✅ API 可达（`PUT /projects/archive\|unarchive/:id`、`DELETE /projects/:id`） |
| 可见性（任务级）    | 🟡 **部分**（见 §3.2）                                            | 🟡 `ByTaskArchived(false)` **空操作**（`DEF-12①`）                            |

### 1.3 对探针 / PM 结论的**独立更正**

| #      | 原述（探针 / PRD）                                                                           | 复核结果                                                                                                                                                                                                                                                                            |
| :----- | :------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | 「`DEF-12①` 主要影响**移动端**/直连 API」                                                    | ⚠️ **需收窄**：`packages/presentation-react` **生产代码 0 处传 `isArchived`**（仅测试）⇒ 移动端**当前不触发**该 scope ⇒ `DEF-12①` 现为**潜伏**缺陷；**归档上线后**移动端会**看到归档任务**（因其不过滤）—— 但**修 `false` 分支不能解决**该问题（移动端没传 `false`）⇒ 见 §6 的 DP-1 |
| **C2** | PRD §12-④「沿用 `projectId: ''`（CAL-03 约定）」                                             | ❌ **不采纳**：`''` 是**搜索内部 + URL token**；**数据面**单一真源是 `'inbox'`（ADR 2026-09-21 D3）。服务端虽把二者等价归一为 `userId`，但**本地仓储**按字面 `'inbox'` 过滤 ⇒ 写 `''` ⇒ **本地当场不可见**                                                                          |
| **C3** | 「服务端 `res.projectId` 返回 `'inbox'`」（由 ADR 2026-09-21「真实数据 = `'inbox'`」可推得） | ⚠️ **服务端返回的是 `FormatID(entity.ProjectId)` = `userId`**（隐式桶），**不是** `'inbox'`（`application/task/converters.go:33`）⇒ **内建收集箱视图的本地过滤（按 `'inbox'`）与 pull 落库值（`userId`）之间存在既有口径缺口**（**非本批引入**，登记为 **R-5**，见 §9）             |
| **C4** | 「`archive`/`unarchive` 均误调 `delete`」（`DEF-36`）                                        | ✅ **属实**（`project.ts:156-169`），且本地仓储的正确实现 `archive/unarchive` **存在但 0 调用方** ⇒ 修复 = **只改用例委托目标**，无需新写仓储逻辑                                                                                                                                   |

---

## 2. Q3 三态边界（**权威判据**，先定此条）

**裁定（三态唯一口径）**：

| 状态                         | 权威字段                        | 谓词（**必须按此实现**）                         | 可逆         | 级联                  |
| :--------------------------- | :------------------------------ | :----------------------------------------------- | :----------- | :-------------------- |
| **归档（Archived）**         | `archivedAt`                    | `archivedAt` **非空**                            | ✅           | 清单 ⇒ 任务（两端）   |
| **停用/删除（Deactivated）** | `deactivedAt`（**服务端权威**） | `deactivedAt` **非空**                           | ✅（7 天内） | 清单 ⇒ 任务（服务端） |
| **墓碑（Tombstone）**        | `deletedAt`                     | **仅同步 / 清库 / 去重用**；**不作 UI 业务判定** | ❌           | —                     |

**PA-1（客户端「已删除」判据收敛）**：`ProjectViewObject.isDeleted` 必须改为 **`deletedAt` ∪ `deactivedAt` 任一非空**（而非仅 `deactivedAt`）。理由：本地真删除写 `deletedAt`、服务端删除写 `deactivedAt`，二者**任一**都意味着「已删除」；只认一个会出现「本地删了但侧栏仍显示」（依赖 store `removeItem` 兜底，非判据）。

**PA-2（废弃反向谓词）**：`ProjectEntity.isDeactived()`（未来时间判据）**必须废弃**（删除或改为 presence 语义 + 注明「项目域 ≠ 用户域」）。当前 **0 调用方**（死代码），但保留会误导实现者（§1.1）。

**PA-3（`DEF-36` 修复的精确边界）**：

- `ProjectUseCase.archive(id)` ⇒ `projectRepo.archive(id)`（写 `archivedAt` + `markDirty('projects', id, 'upsert')`）；
- `ProjectUseCase.unarchive(id)` ⇒ `projectRepo.unarchive(id)`（清 `archivedAt` + upsert）；
- **`deletedAt` 的写入点唯一** = `projectRepo.delete()`（真删除流程）；
- 归档路径 **绝不** 触碰 `deletedAt` / `deactivedAt`（**PA-4 红线**）。

**迁移 / 兼容**：**无数据迁移**（三字段均已存在且双向同步闭环：`archivedAt`/`deactivedAt` 均在 projects push 字段内、pull 均回填；`deletedAt` 为本地墓碑）。改动仅 **谓词归属 + 死代码**。

---

## 3. Q2 可见性谓词与逐处改动

### 3.1 单一真源（**裁定**）

> **可见性只认任务自身字段**：`archivedAt`（排除归档）· `deletedAt`（排除墓碑）。
> **禁止**用「所属项目 `archivedAt`」做**二次推导** —— 否则「单任务脱归档但清单仍归档」时该任务会被**再次隐藏**（Q4 的「任务消失」根因）。
> 一致性由**级联**保证（服务端已级联；客户端**必须补级联**，见 §4）。

### 3.2 逐处改动点（7 处 + 2 个杠杆）

| #      | 位置                                                                                  | 现状                                                             | **改动**                                                                                                     |
| :----- | :------------------------------------------------------------------------------------ | :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **L1** | **本地任务仓储 `list()` 默认**（`persistence-local/repos/task-repo-impl.ts:278-282`） | 未传 `isArchived` ⇒ **不过滤**（归档任务混入）                   | ⭐ **改为默认排除**：`isArchived` 未传 ⇒ 视同 `'false'`（`isAbsentStamp(archivedAt)`）；显式 `'true'` 才包含 |
| ①      | 侧栏清单列表（`projects-store.ts:21-24`）                                             | ✅ 已排除（`!isDeleted && !isArchived`）                         | 无需改（但 `isDeleted` 按 **PA-1** 收敛）                                                                    |
| ②      | 搜索（`use-search.ts:81,92` + `search-tasks.ts`）                                     | ✅ 任务级已排除（`isArchived:false`）；**无「包含已归档」开关**  | 保留排除 + **新增显式开关**（开 ⇒ `isArchived:true`）+ 结果**「已归档」标识**                                |
| ③      | 日历（`calendar/monthly/list-query.ts:24-29`）                                        | ✅ 已排除（`isArchived:false`）                                  | 无需改                                                                                                       |
| ④      | **清单视图（表格/列表/看板）**（`tasks/project/main/index.vue:90`）                   | ❌ 用 `preference.getTasksOptions`（**默认无 `isArchived`**）    | **由 L1 覆盖**（若偏好里显式带了 `isArchived` 则尊重之）；**须补用例**钉死                                   |
| ⑤      | **统计计数 `taskCount`**                                                              | **无 UI 消费方**；服务端口径 = **含归档 / 不含删除**             | **口径不变**（不动服务端计数事件链）；**但**归档二次确认的 **N ≠ `taskCount`**（见 §4.2）                    |
| ⑥      | 番茄选择器（`focus-depend-dropdown/use-task-panel.ts:55`）                            | ✅ 已排除（`isArchived:false`）                                  | 无需改                                                                                                       |
| ⑦      | 新建任务的清单下拉（`avaliableProjects`，`multi-select-adapter.vue:22,41`）           | ✅ 已排除（走 `avaliableProjects`）                              | 无需改                                                                                                       |
| **L2** | **内置视图**（`built-in/project/default.ts:90-209`）                                  | ❌ **8 个 `getTasksOptions` 全无 `isArchived`**（全文件 0 命中） | **由 L1 覆盖**；**建议**同时在内置视图显式写 `isArchived:false`（**防御性 + 可读性**，非必需）               |
| ⑧      | 服务端任务 List（`scopes.go:139-146`）                                                | ❌ `ByTaskArchived(false)` **空操作**                            | 见 §6（`DEF-12①`，跨仓）                                                                                     |

**性能**：L1 是**既有行级过滤的谓词扩展**（`records.filter` 已是内存过滤，无新扫描面）；②④⑧ 同。**不引入**全表扫描或新索引需求。

---

## 4. Q1 客户端级联

### 4.1 裁定：**必做**（本地事务 + 逐任务 `markDirty`）

**方案**（`packages/infrastructure/src/persistence-local/repos/task-repo-impl.ts` 新增两个**批量**方法）：

```text
archiveByProjectId(projectId)     // 其下「未删除且未归档」的任务：archivedAt = nowCalibratedIso() + markDirty(upsert)
unarchiveByProjectId(projectId)   // 其下「未删除且**仍归档**」的任务：archivedAt = null + markDirty(upsert)
```

**硬约束**：

- **PA-5 原子性**：清单与任务的写入**必须同一 Dexie `rw` 事务**（`db.transaction('rw', db.projects, db.tasks, db.syncQueue, ...)`）⇒ 禁止出现「清单已归档、任务未归档」的持久化中间态（PRD NFR「离线窗口内级联必须一致」）。
- **PA-6 级联范围**：**只改「状态确实要变」的行**（归档：跳过已归档；恢复：**只恢复仍归档的**，不复活用户已单任务脱归档的）⇒ 避免无谓 `markDirty` 与推送量。
- **PA-7 推送量**：级联对**每个受影响任务**产生 1 队列项（+1 推送项）。**代价可接受**（归档为**低频**操作；`/sync/push` 已是**单请求批量 upsert** 且幂等）⇒ **不引入**新批量通道。**登记 R-3**（大清单 ⇒ 单次 N 项）。
- **PA-8 push 表序依赖**：服务端 `Push` 的条目处理序 = **tasks → … → projects**（`interfaces/controllers/sync.go`）⇒ 客户端级联的 task upsert（带**级联前** base）**先于** project upsert 被应用 ⇒ 不会因服务端级联推进版本而判 `stale`。**⚠️ 该序是隐式契约**：若未来把 `projects` 提到 `tasks` 之前 ⇒ 客户端级联的 task upsert 会成批 `stale`（journal 噪声）⇒ **须回评审**（登记 **R-4**）。

### 4.2 二次确认的 N（**口径裁定**）

- **N = 「该清单下**未归档且未删除**的任务数」**（客户端本地查询可得），**不得**用 `taskCount`（**含归档** ⇒ 重复归档/已归档清单会虚高，与文案「N 个任务将一并归档」不符）。
- 归档**幂等**：对已归档清单再次归档 ⇒ N=0 / 入口禁用（见 §7 只读）。

### 4.3 离线一致性（端到端）

离线归档：清单 upsert + 任务 upsert 同事务入队 ⇒ 联网：`pull`（远端旧 ⇒ **队列项保护本地胜**，不会把任务改回活动）→ `push`（任务先应用、清单后触发服务端级联）→ 下一轮 `pull` 以服务端级联版本刷新 base。**结论：不出现「清单收起、任务仍可见」**。

---

## 5. Q4 「归属收集箱」的表示

**裁定：写 `projectId = 'inbox'`（内建 id）；禁写 `''`。**

理由：

1. **数据面单一真源 = `'inbox'`**（ADR `2026-09-21-inbox-sentinel-single-source.md` D3：真实数据 / 服务端 / 列表 / 内建清单查询 / 移动端均 `'inbox'`）；`''` 仅是**搜索内部状态 + URL token**。
2. 服务端 `converters.go:133` 对 `''` 与 `'inbox'` **等价归一**为隐式桶 `userId` ⇒ **远端存储相同**，但**客户端本地**仓储按字面过滤（`task-repo-impl.ts:309` `r.projectId === query.projectId`）⇒ 写 `''` ⇒ 收集箱视图（按 `'inbox'`）**当场不命中** ⇒ **「任务消失」**。
3. 因此：**本地与远端写入值都取 `'inbox'`**（远端归一由服务端负责，无需客户端发送 `''`）。

**单任务脱归档（清单仍归档）的字段写法**（Q4 的核心）：

```text
task.archivedAt = null        // 脱归档（可见性判据）
task.projectId  = 'inbox'     // 归属收集箱（用户规则；同时避免被「清单归档」的任何二次推导再次隐藏）
task.updatedAt  = nowCalibratedIso()
⇒ 同一事务内写 + markDirty(upsert) + 可见提醒（中英）
```

- **可见提醒**（中英）：复用 `NueMessage` 范式（与写闸门 `notifyReadOnly` 同型），**不新增全局组件**。
- **若清单已恢复**：该任务回到原清单（即脱归档**不改** `projectId`；仅当**清单仍归档**时改归属）—— 判据 = **该任务所属清单当前是否归档**（读项目行，非任务推导）。
- **反向不变量（PA-9）**：**不得**因为「任务被脱归档」而修改清单的 `archivedAt`（用户规则：清单仍归档）。

**既存缺口登记 R-5**：服务端返回的收集箱任务 `projectId` = `userId`（隐式桶，`converters.go:33`）而非 `'inbox'`，与**本地内建收集箱视图按 `'inbox'` 过滤**存在口径缺口（**非本批引入**；§1.3-C3）。本批**不改**（避免动两端归一链）；**须在实现单内验证**「收集箱视图在 local-first 下能命中 pull 落库的任务」，若不能 ⇒ 单独登记并交 PM 排期。

---

## 6. Q5 `DEF-12`（跨仓）

| 子项  | 事实                                                                            | **裁定**                                                                                                                                                                                                                                   |
| :---- | :------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **①** | `ByTaskArchived(false)` ⇒ `return db`（**空操作**）；`repoImpl.go:287` 直接透传 | **同批修（DP-1 已裁定 (b)）**：`isArchived === true` ⇒ **仅归档**；**`false` 与「未传」⇒ 一律 `Where("archived_at IS NULL")`**（即**默认也排除归档**）⇒ **移动端亦不再显示归档任务**（**移动端代码零改动**；**行为变化须随发布说明登记**） |
| **②** | `query.Sort` 无白名单：`Order(ToSnakeCase(field) + " " + direction)`            | **同批修（安全项，必做）**：字段白名单 + `direction ∈ {asc,desc}`；与归档正交但同属 `DEF-12`                                                                                                                                               |

**理由**：① 由 **DP-1 裁定 (b)**（用户 2026-09-24）—— 一次性对齐两端可见性；**技术安全性已核实**：`ByTaskArchived` **仅** `repoImpl.go:287` 使用、**`/sync/pull` 不经过**（归档任务照常同步 ⇒ 客户端镜像完整）⇒ 默认排除**不影响同步面**。**代价**：移动端**可见结果变化**（不再显示归档任务）⇒ **零代码改动**但**须随发布说明登记**（R-8 关闭，见 §9）。② 是**注入面**，无理由拖延。

**跨仓纪律**：`nao-todo-server` 改动须 PM 批准（本 ADR 为**只读**引用）；服务端须补契约测试（`false` ⇒ 排除归档；`sort` 非法字段/方向 ⇒ 拒绝或忽略并留证）。

**R-8 关闭（DP-1 = (b)）**：服务端**默认排除归档** ⇒ **移动端亦不再显示归档任务** ⇒ 可见性不一致消除；**移动端零改动**；**行为变化随发布说明登记**（残留：移动端**无「包含已归档」开关** ⇒ 归档内容在移动端不可见，属**产品可接受**；若需对齐另立单）。

---

## 7. Q6 只读面板落点与复位

### 7.1 「已归档」入口与面板（落点）

- **入口**：**侧栏清单区底部**「已归档」（PRD §3-3）；**实现落点 = 复用既有 `project-manager` 弹窗，新增 `archived` tab**（该弹窗已有 `all / active / deleted` 三 tab + `ProjectCard` + 恢复动作范式：`use-project-manager.ts:35`、`project-card.vue`）。
    - 复用收益：零新组件、两端同 UI（desktop 经 `@` 复用 web）、既有「恢复」交互范式。
    - 需补：`archived` 过滤（`project.isArchived`）、条目显示「归档时间」+「任务数」、**「取消归档」动作**。
- **归档清单详情（只读查看）**：**复用清单视图路由** `/tasks/p/:projectId/:viewType/:taskId?`（`views/index/tasks/routes.ts:39-58`）⇒ **同一组件、两端一致**；进入时若清单归档 ⇒ **只读态**（§7.2）。
- **死件清理（同批）**：`packages/shared/components/project-archive-button/**`（0 消费方）、`project-board` 的 `archiveProject/unarchiveProject` 事件（0 监听）、`useProjectsStoreBase` 的 `archiveProject/unarchiveProject` action（0 调用）、i18n `component.archiveProject` / `component.unarchiveProject` / `component.projectCard.archived`（死键）⇒ **接线或删除**（**禁**留下两套）。

### 7.2 归档态只读（**机制复用边界**）

**裁定**：

- **判据 = 任务 `archivedAt` 非空**（写用例层拦截；由级联保证与清单一致）⇒ **不需要 join 清单**。
- **机制形态复用** `withReadOnlyGuard`（装饰器 + 稳定错误码 + 可见提示），但**不复用 `OFFLINE_READONLY`**：**新增独立错误码 `ARCHIVED_READONLY`**。
    - 理由：`OFFLINE_READONLY` 是**身份域离线写闸门**的稳定标识（阶段二 ADR §2.6 W5 保留项），其语义 = 「离线不可写」；归档只读是**在线、可写能力被数据状态禁用**，**两者根因不同** ⇒ 复用错误码会让调用方/测试无法区分，并污染离线 flag 生命周期推理。
- **作用面**：归档清单下任务的**全部写方法**（create/update/remove/restore/copy/snooze/resort/batch…）⇒ 拒绝 + 可见提示；**唯一例外 = 单任务 `unarchive`**（§5）。
- **清单自身**：归档清单的 `update/delete/resort/archive`（幂等）亦应拦截（除 `unarchive`）。
- **URL 直达必须只读**（AC3）：守卫在**用例层**（非仅 UI 隐藏）⇒ 直达 URL 也无法写。

### 7.3 `sortId` 复位

- **现状**：`resortWithRebuild` 的 `activeProjects = filter(!isDeleted && !isArchived)` ⇒ **只对活动项重编号**（`(index+1)*1000`），归档项**保持原 `sortId` 不动**（`project.ts:304-340`）。
- **裁定**：**保持「重建只含活动项」**（不改排序语义，低风险）；**归档时保留 `sortId`**（现状）。
- **恢复（unarchive）时的碰撞处理（PA-10）**：若恢复项的 `sortId` 与活动项**碰撞**（归档期间发生过重建 ⇒ 活动项被重编号）⇒ **以恢复项的 `sortId` 为锚做一次归一**（`resortSingle`，必要时 `resortWithRebuild`）⇒ 语义 = **「按归档时的相对位置插入到最接近位置」**。
    - **如实登记**：PRD AC5 的「恢复回原位」在**归档期间发生过排序重建**时**不是像素级原位**（是最近位置）；未发生重建时=原位（`sortId` 未变）。

---

## 8. 硬约束（PA-1…PA-10）

| #     | 约束                                                                                                                                             |
| :---- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-1  | 客户端「已删除」判据 = `deletedAt` ∪ `deactivedAt` 任一非空（§2）                                                                                |
| PA-2  | 废弃 `ProjectEntity.isDeactived()`（未来时间判据；0 调用方）（§2）                                                                               |
| PA-3  | `DEF-36`：`archive()` ⇒ `repo.archive()`；`unarchive()` ⇒ `repo.unarchive()`；`deletedAt` 只由真删除写（§2）                                     |
| PA-4  | **归档路径绝不写 `deletedAt` / `deactivedAt`**（数据零丢失红线）                                                                                 |
| PA-5  | 客户端级联（清单 + 任务）**必须同一 Dexie `rw` 事务**（§4.1）                                                                                    |
| PA-6  | 级联**只改需要变状态的行**（归档跳过已归档；恢复只恢复仍归档的）（§4.1）                                                                         |
| PA-7  | 级联逐任务 `markDirty`（离线一致性优先）；接受 N 项推送量，**不新建批量通道**（§4.1）                                                            |
| PA-8  | **push 表序 `tasks → projects` 是隐式契约**（若改动须回评审）（§4.1）                                                                            |
| PA-9  | 单任务脱归档**不得**修改清单 `archivedAt`；仅当清单仍归档时改 `projectId='inbox'`（§5）                                                          |
| PA-10 | 可见性**只认任务自身字段**；**禁止**用清单 `archivedAt` 二次推导（§3.1）；只读判据 = 任务 `archivedAt`；错误码 = **`ARCHIVED_READONLY`**（§7.2） |

---

## 9. 风险清单

| #    | 风险                                                                   | 影响                       | 应对                                                                                                               |
| :--- | :--------------------------------------------------------------------- | :------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| R-1  | **`DEF-36` 未修即接线** ⇒ 点「归档」= 真删清单 + 级联删任务            | **数据丢失（P0）**         | **PA-3 前置硬阻塞**；入口与修复**同批**；新增 usecase 用例钉死                                                     |
| R-2  | 客户端无级联 ⇒ 离线窗口「清单收起、任务仍可见」                        | 功能/一致性（P1）          | **§4 级联**（同事务 + markDirty）                                                                                  |
| R-3  | 大清单归档 ⇒ 单次 N 项本地写 + 队列项 + 推送项                         | 性能（P2）                 | 低频 + 单请求批量 + 幂等；**不新建通道**；必要时限流/分批（后续）                                                  |
| R-4  | **push 表序变更**（projects 提前）⇒ 级联 upsert 成批 `stale`           | journal 噪声（P2）         | **PA-8** 显式契约 + 回归用例                                                                                       |
| R-5  | 收集箱 `projectId` 口径缺口（服务端回 `userId` vs 本地过滤 `'inbox'`） | 「收集箱看不到任务」（P1） | **非本批引入**；实现单内**必验**；不通过则单独登记交 PM（§5）                                                      |
| R-6  | 归档期间发生排序重建 ⇒ 恢复**非像素级原位**                            | 体验（P2）                 | **PA-10** 归一 + 如实登记                                                                                          |
| R-7  | 只读错误码复用 `OFFLINE_READONLY` ⇒ 语义混淆                           | 可维护性（P2）             | **§7.2** 新增 `ARCHIVED_READONLY`                                                                                  |
| R-8  | 移动端将看到归档任务（服务端默认不排除 + 移动端不过滤）                | 可见性不一致（P1）         | ✅ **已关闭（DP-1 = (b)，2026-09-24）**：服务端默认排除归档 ⇒ 移动端亦不显示；移动端零改动；行为变化随发布说明登记 |
| R-9  | 文档承诺 vs 现实（管理弹窗文案称「可以使用归档功能」）                 | 用户预期（P2）             | 随本批上线自然消解；**实现前**若用户可见 ⇒ PM 决定是否临时改文案                                                   |
| R-10 | 级联后 base 陈旧窗口（服务端级联推进任务 `updated_at`）                | 冲突 journal 噪声（P3）    | 既有「pull 先于 push」+ 归档态**只读**（窗口内不可编辑）⇒ 影响可忽略；登记                                         |

---

## 10. 回归矩阵（验收判据）

| #     | 场景                       | 期望                                                                                       | 守护（新增/既有）                                                   |
| :---- | :------------------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| RA-1  | `archive()` 调用           | `archivedAt` 置位；**`deletedAt`/`deactivedAt` 不变**（`DEF-36`）                          | **新增** `project-usecase-archive.test.ts`                          |
| RA-2  | `unarchive()` 调用         | `archivedAt` 清空；其余字段不变                                                            | 新增                                                                |
| RA-3  | 归档 + 级联（本地事务）    | 清单与其下「未删除未归档」任务同事务置位；**无中间态**（事务中断 ⇒ 全不改）                | 新增（含事务中断注入）                                              |
| RA-4  | 恢复 + 级联                | 清单恢复；**仅仍归档**的任务恢复；已单任务脱归档的**不复活**                               | 新增                                                                |
| RA-5  | 离线归档 → 联网            | 本地一致；push 后服务端级联；pull 收敛；**无「清单收起任务仍见」**                         | 新增（离线/在线双态）                                               |
| RA-6  | 可见性 7 处 + 内置视图     | 归档任务**全部**不出现在 ②③④⑥⑧（L1 覆盖）+ ①⑦ 已排除                                       | **既有**（search/calendar/pomodoro）+ **新增**（内置视图/清单视图） |
| RA-7  | 搜索开关                   | 默认排除；开关开 ⇒ 命中 + **「已归档」标识**                                               | 新增                                                                |
| RA-8  | 只读                       | 归档清单内**一切写被拒**（`ARCHIVED_READONLY` + 可见提示）；**URL 直达同样被拒**           | 新增                                                                |
| RA-9  | 单任务脱归档（清单仍归档） | `archivedAt=null` + `projectId='inbox'` + 可见提醒；**可正常编辑**；清单 `archivedAt` 不变 | 新增                                                                |
| RA-10 | 单任务脱归档（清单已恢复） | `archivedAt=null`；**`projectId` 不变**（回原清单）                                        | 新增                                                                |
| RA-11 | 复位                       | `sortId` 保留；碰撞时归一；未重建 ⇒ 原位                                                   | 新增                                                                |
| RA-12 | 内建清单不可归档           | 入口禁用/不出现 + 兜底拒绝                                                                 | 新增                                                                |
| RA-13 | 两端一致                   | web/desktop 同组件同逻辑（`@` 复用）                                                       | 既有（两端共用）                                                    |
| RA-14 | 阶段一/二零回归            | 离线镜像 / 迁移门 / 清库 / 明文姿态 / 状态面 / 偏好 / OCC-冲突 UX **全部不变**             | 既有（阶段一 R-01…R-06 + 阶段二 R-10…R-20）                         |
| RA-15 | 移动端 0                   | `git status --porcelain -- packages/presentation-react apps/mobile` = 0                    | `guard:mobile-imports`                                              |
| RA-16 | 服务端 `DEF-12`            | `isArchived=false` ⇒ 排除归档；`sort` 非法字段/方向 ⇒ 拒绝或忽略（留证）                   | 新增（服务端契约测试）                                              |

---

## 11. 分期与任务拆分（供 PM 出开工确认卡）

| 阶段   | 内容                                                                                                                                                       | Owner         | 依赖                         | 验收判据（摘要）                                     |
| :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :--------------------------- | :--------------------------------------------------- |
| **P0** | **前置修复**：`DEF-36`（`archive/unarchive` ⇒ `repo.*`）+ **PA-1/PA-2 谓词收敛** + **死件清理**（组件/事件/store action/i18n 死键）                        | rd-fe         | —                            | RA-1/RA-2 绿；既有 `local-project-repos` 13 例零回归 |
| **P1** | **归档/恢复闭环 + 客户端级联**：入口（头部菜单 + 右键）+ 二次确认（**N = 未归档未删除**）+ 本地级联（同事务）+ **已归档面板（`archived` tab）** + 取消归档 | rd-fe         | P0                           | RA-3/RA-4/RA-5 + AC1/AC2                             |
| **P2** | **可见性补漏**：**L1 默认排除** + ④/⑧ 用例 + ② 搜索开关 + **服务端 `DEF-12①②`**                                                                            | rd-fe / rd-be | P1（客户端）/ 独立（服务端） | RA-6/RA-7/RA-16                                      |
| **P3** | **只读 + 单任务脱归档**：归档态守卫（`ARCHIVED_READONLY`）+ 只读面板 + 单任务脱归档 → 收集箱 + 提醒 + 复位归一                                             | rd-fe         | P1                           | RA-8/RA-9/RA-10/RA-11                                |
| **P4** | **门禁 / 终验**：8 项门禁 + 阶段一/二回归 + 移动端 0 + **端到端走查**（登录 → 归档 → 7 处消失 → 面板 → 取消归档 → 单任务脱归档）                           | qa            | P0–P3                        | 全仓门禁全绿 + RA-14/RA-15 + 端到端证据              |

> **依赖硬约束**：**P0 未完成不得开工 P1**（`DEF-36` 为 P0 阻塞）；**P1 → P2/P3**（可见性与只读都需要级联后的数据态）；**P2 的服务端部分可独立并行**（跨仓，须 PM 批准）。**P2 的 L1（本地默认排除）建议与 P1 同批落**（否则 P1 的离线用例会被「归档任务仍出现在内置视图」干扰）。

---

## 12. 连带同步清单（S 项 + Owner）

| #   | 位置                                                                                      | Owner     | 须同步内容                                                                                                 | 状态     |
| :-- | :---------------------------------------------------------------------------------------- | :-------- | :--------------------------------------------------------------------------------------------------------- | :------- |
| S1  | 本篇（`docs/adr/2026-09-24-project-archive.md`）                                          | **arch**  | 首次归档（三态 / 可见性 / 级联 / 收集箱 / 只读 / 分期）                                                    | ✅ 本单  |
| S2  | `docs/adr/README.md`（索引行）                                                            | **arch**  | 新增索引行                                                                                                 | ✅ 本单  |
| S3  | `docs/prds/2026-09-24-project-archive.md`（§5 规则 4 / §7 AC4-AC5 / §12 六项）            | **PM**    | 收集箱表示改 **`'inbox'`**（**不是 `''`**）· 二次确认 N 口径 · 「回原位」= 最近位置（PA-10）· 六项裁定回写 | ⏳ PM    |
| S4  | `docs/reports/defect-pool.md`                                                             | **PM**    | `DEF-36` 处置 + `DEF-12①/②` 口径更正（含 C1 收窄）· **R-8 移动端可见归档** 登记                            | ⏳ PM    |
| S5  | `docs/tasks-state.md`                                                                     | **PM**    | `T175` 回执 + P0–P4 派单                                                                                   | ⏳ PM    |
| S6  | `docs/adr/2026-09-21-inbox-sentinel-single-source.md`（互记）                             | **arch**  | 归档「单任务脱归档 ⇒ 归属收集箱」**写 `'inbox'`** 与本篇互记（避免再引 `''`）                              | ✅ 本单  |
| S7  | `docs/adr/2026-09-24-stage2-both-ends-local-first.md`（§9 邻接）                          | **arch**  | 归档级联与 OCC 的关系（PA-8 表序契约 / R-4 / R-10）指针                                                    | ✅ 本单  |
| S8  | `nao-todo-server`（`scopes.go` / `query/sorting.go` + 契约测试）                          | **rd-be** | `DEF-12①`（仅显式 `false`）+ `DEF-12②`（白名单）                                                           | ⏳ P2    |
| S9  | 客户端实现面（`domain-project` usecase / `persistence-local` 仓储 / `presentation` 组件） | **rd-fe** | PA-1…PA-10 + §3.2 逐处 + §7 落点                                                                           | ⏳ P0–P3 |
| S10 | `AGENTS.md`                                                                               | **PM**    | 若新增守卫（`ARCHIVED_READONLY` 接线断言 / 可见性默认排除断言）则补                                        | ⏳ PM    |

---

## 13. 需 PM 拍板（DP）

| #        | 议题                                                                                                                                                                                          | 建议                                                                                                                                               |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DP-1** | **移动端可见归档任务**（R-8）：a 移动端补过滤（违「移动端零改动」红线，需用户授权）/ b **服务端列表默认排除归档**（**已核实 `/sync/pull` 不经 `ByTaskArchived`** ⇒ 技术上安全）/ c 接受并登记 | ✅ **已裁定 = (b)（用户 2026-09-24）**：服务端**默认（未传 `isArchived`）也排除归档**；移动端零代码改动；**行为变化随发布说明登记** ⇒ **R-8 关闭** |
| **DP-2** | 「**单任务归档**」入口是否本批做（PRD 已列非范围）                                                                                                                                            | **不做**（本批只做「归档清单」+「单任务取消归档」；待用户拍板）                                                                                    |
| **DP-3** | 归档面板/清单内的**任务数**展示口径                                                                                                                                                           | **「未归档且未删除」**（与二次确认 N 同源；`taskCount` 含归档，**不得**直接展示为「将归档 N」）                                                    |
| **DP-4** | 只读错误码命名                                                                                                                                                                                | **`ARCHIVED_READONLY`**（不复用 `OFFLINE_READONLY`）                                                                                               |
| **DP-5** | 「已归档」入口落点                                                                                                                                                                            | **复用 `project-manager` 新增 `archived` tab**（零新组件、两端同 UI）                                                                              |

---

## 14. 未过项

- **未过：无**（arch 检查清单逐项核对通过；本 ADR 为**纯文档**产出，**未改代码**，无测试门禁适用）。
- **阻塞项：1 项** —— **`DEF-36` 前置修复**（P0；未修即接线 = 误删数据）。**其余无阻塞**：**DP-1 已裁定 (b)**；DP-2…DP-5 不影响 P0/P1 开工。
- **登记（非阻塞）**：R-3（大清单推送量）· R-4（push 表序契约）· R-5（收集箱口径缺口，**非本批引入**）· R-6（复位非像素级）· R-9（文案承诺）· R-10（级联后 base 陈旧窗口）。**R-8 已关闭**（DP-1 = (b)）。

---

## 15. 接口命名与形状（`T175b`；供 qa 红基线承载 + 实现对齐）

> **用途**：把 `T175` 六项裁定中 **3 个「缺 API 面」**定名定形（qa `T178` 红基线无法承载 ⇒ 本节点名后方可补测）。**命名一律沿用仓内既有同族约定**（`includeExcluded` / `OFFLINE_READONLY` / `common.*` / `dialog.project*`）。

### 15.1 任务级「取消归档」（Q1/Q4）

| 项                | 定名 / 定形                                                                                                                                                                                                                                                                                                                                  |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **用例层入口**    | **`TaskUseCase.unarchive(id: TaskViewObject['id']): GoAsync<{ movedToInbox: boolean }>`** —— `packages/domain-task/src/application/usecases/task.ts`（**命名与 `ProjectUseCase.unarchive(id)` 对称**；**不放 `ProjectUseCase`** ⇒ 避免 domain-project → domain-task 跨域依赖）                                                               |
| **仓储（本地）**  | **`LocalTaskRepoImpl.unarchive(id): GoAsync<{ movedToInbox: boolean }>`** —— `packages/infrastructure/src/persistence-local/repos/task-repo-impl.ts`；**同一 Dexie `rw` 事务**内：读任务 → 读 `db.projects.get(task.projectId)` → 写 `archivedAt = null` +（`movedToInbox` 时）`projectId = 'inbox'` + `markDirty('tasks', id, 'upsert', …)` |
| **仓储（接口）**  | **`TaskRepository.unarchive?(id)`（可选方法）** ⇒ 远端实现（`persistence-go`）**不必实现**（**移动端 / 直连 API 零影响**）；用例内 `typeof === 'function'` 守卫，缺失 ⇒ 返回「当前环境不支持」                                                                                                                                               |
| **分支判定落点**  | **`LocalTaskRepoImpl.unarchive`（基础设施层）** —— 判据 = `db.projects.get(task.projectId)?.archivedAt` 非空；**同事务读取**（无 TOCTOU）。**否决**：放 `ProjectUseCase`（跨域依赖）/ 放 presentation（业务规则进 UI，且 `TaskHandler` 无 project store）                                                                                    |
| **字段写入能力**  | `UpdateTaskValueObject`（**VO 类**）补 `archivedAt`（viewobject **类型已有** `archivedAt?`）+ `LocalTaskRepoImpl.update` **应用** `archivedAt` ⇒ **qa 面9 直接成立**；`unarchive` 内部即「`archivedAt=null` + `projectId='inbox'` 同批写」                                                                                                   |
| **presentation**  | **`TaskHandler.unarchiveTask(taskId: string): GoAsync<void>`** —— `packages/presentation/task/handlers/task.ts`：调 `taskUseCase.unarchive(id)`；`movedToInbox === true` ⇒ 可见提醒                                                                                                                                                          |
| **i18n（中/英）** | **`task.unarchivedToInbox`** = 「已移入收集箱」/「Moved to Inbox」· **`task.unarchivedToInboxHint`** = 「原清单仍处于归档状态」/「Its project is still archived」· **`task.unarchiveFailed`** = 「取消归档失败」/「Failed to unarchive」                                                                                                     |
| **只读守卫例外**  | `unarchive` 是归档任务上**唯一**允许的写方法（§15.3 `allow`）                                                                                                                                                                                                                                                                                |

### 15.2 搜索「包含已归档」开关（Q2）

| 项                 | 定名 / 定形                                                                                                                                                                                                                                                                   |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **字段名**         | **`includeArchived?: boolean`**（与既有 **`includeExcluded`** 对称）                                                                                                                                                                                                          |
| **共享查询选项**   | `GetTasksOptions.includeArchived?: boolean`（`packages/shared/constants/task.ts`，**additive**）；**语义 = 不按归档态过滤（包含已归档）**，**优先级高于 `isArchived`**（因 L1 使「未传 `isArchived`」= **排除** ⇒「包含」必须用**正向**信号）；**web-only**（服务端无该参数） |
| **搜索状态 + URL** | `SearchQueryState.includeArchived: boolean`（`apps/web/src/components/search/search-query.ts`，与 `includeExcluded` 并列）+ **URL 参数 `archived=1`**（镜像既有 `excluded=1` / `EXCLUDED_ON` 范式）+ `parse`/`serialize`/`equals` 同步                                        |
| **查询构造**       | `use-search.ts` 的 `buildRootQuery` / `buildChildQuery`：`includeArchived` ⇒ 传 `includeArchived: true`；否则传 `isArchived: false`（**顶层与子任务同口径**）                                                                                                                 |
| **UI 落点**        | `apps/web/src/components/search/search-filter-bar.vue`：新增 prop **`includeArchived`** + 事件 **`toggleArchived(value: boolean)`**（与 `includeExcluded`/`toggleExcluded` 同型）                                                                                             |
| **本地仓储**       | `task-repo-impl.ts` `list()`：`query.includeArchived === 'true'` ⇒ **不加归档过滤**（否则维持 L1 默认排除 / 显式 `isArchived`）                                                                                                                                               |
| **i18n（中/英）**  | 开关标签 **`search.includeArchived`** = 「包含已归档」/「Include archived」（与 `search.includeExcluded` 同族）· 结果标识 **`search.state.archived`** = 「已归档」/「Archived」（与 `search.state.deleted` / `search.state.givenUp` 同族）                                    |

### 15.3 只读守卫形状（Q6 / DP-4）

| 项                     | 定名 / 定形                                                                                                                                                                                                                                                                                                                     |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **错误码常量**         | **`ARCHIVED_READONLY_ERROR = 'ARCHIVED_READONLY'`** —— **新文件 `packages/presentation/task/archive-gate.ts`**（**不复用** `packages/presentation/offline/write-gate.ts` ⇒ 不混淆离线语义；仅**复用其类型** `WriteMethodMap` / `WriteReturnShape`）                                                                             |
| **守卫函数**           | **`withArchivedReadOnlyGuard<T extends object>(useCase: T, writeMethods: WriteMethodMap, options: { allow?: readonly string[]; isArchivedTarget: (method: string, args: unknown[]) => Promise<boolean> }): T`** —— **用例装配层**（web `binding.ts` 的 `decorateUseCase` 对 `kind === 'task'` 注入；desktop 同 binding 同逻辑） |
| **判据 / 例外**        | 判据 = `isArchivedTarget` 为真（读任务 `archivedAt` 非空）；`options.allow` 默认 **`['unarchive']`**（**唯一例外**）；命中 ⇒ 按原方法形态返回 `ARCHIVED_READONLY`（`'error'` / `'tuple'`）+ 可见提示                                                                                                                            |
| **可见提示 i18n**      | **`archive.readOnlyHint`** = 「该清单已归档，请先取消归档」/「This project is archived — unarchive it first」                                                                                                                                                                                                                   |
| **右键菜单项 id**      | **`archive-project`**（与头部 `execute-id="archive-project"` **同一 id** ⇒ **一次 handler 注册覆盖两处入口**；`register('archive-project', …)` 不变）                                                                                                                                                                           |
| **`archived` tab key** | **`'archived'`**（`ProjectManagerVO.activeTab` 联合类型扩为 `'all' \| 'active' \| 'deleted' \| 'archived'`）；tab 文案键 **`common.archived`** = 「已归档」/「Archived」（与 `common.all`/`common.normal`/`common.deleted` 同族；**`common.archived` 为新增键**）                                                               |
| **侧栏入口文案**       | 复用 **`common.archived`**（若需独立文案，保留 **`aside.archivedProjects`** 命名）                                                                                                                                                                                                                                              |
| **二次确认文案键**     | **`dialog.projectArchiveConfirmTitle`** = 「确认归档清单吗？」· **`dialog.projectArchiveConfirmContent`** = 「该清单内 {count} 个任务将一并归档」（**`{count}` = 未归档且未删除计数**，§4.2）· 确认按钮 **`dialog.confirmArchive`** = 「确认归档」；取消复用 `common.cancel`                                                    |
| **取消归档反馈键**     | **`dialog.projectUnarchiveSuccess`** / **`dialog.projectUnarchiveFailed`**（与 `dialog.projectRestoreSuccess/Failed` 同族）                                                                                                                                                                                                     |

> **与死件清理的关系（§7.1）**：既有死键 `component.archiveProject` / `component.unarchiveProject` / `component.projectCard.archived` 与死组件 `packages/shared/components/project-archive-button/**` **一并接线或删除**；**禁**同时存在两套命名。

---

## 变更记录

| 版本 | 日期       | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 作者 |
| :--- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| r1   | 2026-09-24 | 首次评审（`T175`）：**结论 = 有条件可行**。六项裁定（Q1 客户端级联**必做**（同事务 + markDirty）/ Q2 可见性**单一杠杆 L1** + 逐处清单 / Q3 **三态权威判据**（`archivedAt` / `deactivedAt` / `deletedAt`）+ 谓词收敛 PA-1/PA-2 / Q4 收集箱**写 `'inbox'`** / Q5 `DEF-12` **②必做 ①仅修显式 false** / Q6 路由复用 + **`ARCHIVED_READONLY`** + 复位归一）+ **PA-1…PA-10 硬约束** + 风险 R-1…R-10 + 回归矩阵 RA-1…RA-16 + **分期 P0–P4** + 连带 S1–S10（S1/S2/S6/S7 本单落地）+ **DP-1…DP-5** + **4 处事实更正**（§1.3）。**⛔ 未改代码**                                                                                                                                                                                                                                                                                                                                      | arch |
| r2   | 2026-09-24 | **`T175b`（arch，doc-only）—— DP-1 入档 + 接口命名与形状**：① **`DP-1` 已裁定 = (b)**（用户 2026-09-24）—— 服务端列表**默认（未传 `isArchived`）也排除归档** ⇒ **`R-8` 关闭**（移动端亦不再显示归档任务；**移动端零代码改动**；**行为变化须随发布说明登记**）；§0-Q5 / §6 / §9-R-8 / §13-DP-1 / §14 同步更新。② 新增 **§15 接口命名与形状**（3 个缺 API 面：**`TaskUseCase.unarchive(id): GoAsync<{movedToInbox}>`**（判定落点 = 本地仓储、同事务；`TaskRepository.unarchive?` 可选 ⇒ 远端零影响）+ **`includeArchived`**（`GetTasksOptions` / `SearchQueryState` / URL `archived=1` / `search-filter-bar`）+ **`ARCHIVED_READONLY`**（新文件 `packages/presentation/task/archive-gate.ts` + `withArchivedReadOnlyGuard`）；并显式列出 **右键 `archive-project`** / **`archived` tab（`common.archived`）** / **二次确认与反馈文案键** / **中英 i18n 键**。**⛔ 未改代码** | arch |