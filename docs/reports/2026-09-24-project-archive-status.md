# 清单归档（Project Archive）现状核查报告

> 任务：`T174`（探针单 · 只读为主 · **未改任何源码/测试/构建配置**）
> 基线：`main` = **`94c1369c`**（v1.11.0 已发布）· 工作区核查时干净
> 范围：`nao-todo`（web/desktop + packages）+ 跨仓只读 `nao-todo-server` @ `ac72a37`
> 方法：**读码（静态）为主 + 既有自动化用例实测**；因入口被注释（见 §1），**未能做端到端点击实测**
> 证据分级：**[静态]** = 读码确认；**[实测]** = 本次命令/用例运行；**[推断]** = 由静态事实推导、未实测

---

## 0. TL;DR（对 PM 六条「已核现状」的独立核实结论）

| #   | PM 结论                                                             | 核实                      | 说明                                                                                                                                                                                                                               |
| :-- | :------------------------------------------------------------------ | :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Project` 有 `archivedAt`/`isArchived()`，列表已过滤 `!isArchived`  | ✅ 属实                   | 实体 `project.ts:18,38`；**过滤在 store**（`projects-store.ts:23`），非 `project-service/project.ts`（该处 215/306 是**排序**用 `activeProjects`）                                                                                 |
| 2   | web **已有「归档清单」入口** ⇒ `projectUseCase.archive()`           | ❌ **不成立**             | 菜单项**整段被注释**（`operation-dropdown.vue:105-110`，PM 引用的 107-109 在注释内）；仅残留 handler 注册（40-43）**无 UI 触发**。且 `archive()` 实为 `projectRepo.delete()`（`project.ts:156-159`）⇒ 即便触发也是**删除**而非归档 |
| 3   | 服务端已有 `Unarchive`（级联）+ `Archive`                           | ⚠️ 部分                   | 两者**都级联**（`appImpl.go:234` 与 `:268`），「只有 Unarchive 级联」不成立；路由 `PUT /projects/archive/:projectId` 与 `PUT /projects/unarchive/:projectId` 均存在                                                                |
| 4   | i18n 已有 `unarchiveProject`/`projectCard.archived`，**疑无消费方** | ✅ 属实                   | 三个键（含 `archiveProject`）**全为死键**；另有 `project-archive-button` 组件、`ProjectCard/ProjectBoard` 的 `unarchiveProject` 事件、store 的 `archiveProject/unarchiveProject` action **均无消费方**                             |
| 5   | 本地库 `archivedAt` 字段存在                                        | ✅ 属实                   | `local-database.ts:20,83,138`（projects/tasks/pomodoros）                                                                                                                                                                          |
| 6   | 既有缺陷 `DEF-12`（`isArchived=false` 空操作 + `sort` 无白名单）    | ✅ 属实，**影响面需更正** | 服务端 `scopes.go:139-146` 空操作 + `sorting.go:12-23` 无白名单；但 **web/desktop 已切本地优先**（binding 全本地仓储，本地**显式**过滤 `isArchived`）⇒ `DEF-12①` 主要影响**移动端/直连 API**，**不影响 web/desktop 列表**          |

**一句话结论**：**「清单归档」在当前代码里是一个"骨架存在、闭环缺失、且核心实现是错的"的半成品** —— 数据模型与同步字段齐备、服务端 API 与级联齐备，但 **① web/desktop 无任何可达入口**、**② 客户端用例 `archive/unarchive` 均误调 `delete`（误删数据）**、**③ 无「查看已归档」与「取消归档」UI**、**④ 客户端无任务级联**。

---

## 1. 归档可达性与生效（Q1）

### 1.1 入口可达性

| 端       | 入口                       | 状态          | 证据                                                                                                                                                                                                    |
| :------- | :------------------------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| web      | 清单页操作下拉「归档清单」 | ⛔ **不可达** | `apps/web/src/components/tasks/project/header/operation-dropdown.vue:105-110` 整段 `<!-- ... -->` 注释（`disabled` + `icon="archive"` + `title="归档清单"` + `execute-id="archive-project"`）**[静态]** |
| web      | 同文件 handler 注册        | ⚠️ 死代码     | 同文件 `:40-43` `register('archive-project', …)` 仍在，但下拉**只渲染 slot 内容**（`packages/presentation/task/components/dropdowns/operations-dropdown.vue`）⇒ 无菜单项即永不触发 **[静态]**           |
| desktop  | 同上                       | ⛔ **不可达** | `apps/desktop/electron.vite.config.ts:47` `@ → apps/web/src` ⇒ 桌面渲染层**复用 web 同一 UI** **[静态]**                                                                                                |
| 侧栏     | 清单区底部「已归档」       | ⛔ 不存在     | `apps/web/src/components/tasks/aside/aside.vue` 仅内建链接 + `project-smart-list` + `tag-smart-list` **[静态]**                                                                                         |
| 右键菜单 | 清单右键「归档」           | ⛔ 不存在     | `packages/shared/components/smart-list/smart-list.vue` 无 `contextmenu`；全仓侧栏无右键处理 **[静态]**                                                                                                  |

历史注：该菜单项在当前文件历史中**自 2026-07-18 `c7ec2854`（DDD 重构引入本文件）起即为注释态**，注释内保留 `disabled` 属性 ⇒ 更早即被禁用。**[静态]**

### 1.2 「点击后是否生效」——**无点击面，未能实测**；以读码判定：**若触发，行为是"删除"而非"归档"**

| 层       | 事实                                                                                   | 证据                                                                                             |
| :------- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| 用例     | `ProjectUseCase.archive(id)` → `return await this.projectRepo.delete(id)`              | `packages/domain-project/src/application/usecases/project-service/project.ts:156-159` **[静态]** |
| 用例     | `ProjectUseCase.unarchive(id)` → 同样 `return await this.projectRepo.delete(id)`       | 同文件 `:166-169` **[静态]**                                                                     |
| 本地仓储 | `delete()` 写 `deletedAt`（非 `archivedAt`）+ `markDirty('projects', id, 'delete', …)` | `packages/infrastructure/src/persistence-local/repos/project-repo-impl.ts:84-100` **[静态]**     |
| 本地仓储 | 真正的 `archive()`（写 `archivedAt` + `markDirty(…, 'upsert')`）**存在但无调用方**     | 同文件 `:125-140`（`archive`）/ `:143-157`（`unarchive`）**[静态]**                              |
| 同步     | push 时 `item.action === 'delete'` ⇒ 走 `deletions`（删除接口），不进 upsert body      | `packages/infrastructure/src/persistence-sync/sync-service.ts:975-978` **[静态]**                |
| 服务端   | `DELETE /projects/:id` ⇒ 软删 Project + **级联软删任务**                               | `nao-todo-server` `application/project/appImpl.go:132-170`（`SoftDeleteByProjectId`）**[静态]**  |

### 1.3 落到哪个 repo / 是否入队回传 / 离线

| 问项                            | 结论                                                                                     | 证据                                                                                                             |
| :------------------------------ | :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| repo（web）                     | **本地 IndexedDB**（非远端直连）                                                         | `apps/web/src/hooks/usecases/binding.ts` `createProjectRepository: () => newLocalProjectRepository()` **[静态]** |
| repo（desktop）                 | **本地 IndexedDB**（与 web 同构）                                                        | `apps/desktop/src/renderer/src/hooks/usecases/binding.ts` 同名绑定 **[静态]**                                    |
| 入 `syncQueue`                  | **是**（当前路径以 `action='delete'` 入队）                                              | `project-repo-impl.ts:95-100` **[静态]**                                                                         |
| `archivedAt` 是否在 push 字段内 | **是**（projects `entityToPush` 含 `archivedAt`；tasks `buildTaskPush` 含 `archivedAt`） | `sync-service.ts:126-136`（projects）· `:88-113`（tasks `buildTaskPush`）· 出现行 `:99/:130/:201` **[静态]**     |
| 离线归档                        | **能**（本地写 + 入队，联网后回传）——**但当前实现是"离线删除"**                          | 同上 **[静态]**                                                                                                  |

> ⚠️ **风险 R1（P0 级实现缺陷）**：`archive/unarchive` 都是 `delete` 占位。**若直接放开被注释的菜单项，用户点「归档清单」将真实删除清单（并级联删任务）**。必须**先修 usecase** 再启用入口。

---

## 2. 归档后可见性（Q2）—— 逐处

> 前提：可见性依赖**任务级** `archivedAt`（服务端级联写入 / pull 回本地）。**客户端不会级联**（见 §3），故"仅归档清单、任务未归档"时以下任务级排除**全部失效**。

| #   | 位置               | 清单级（项目归档）               | 任务级（任务已归档）                | 证据                                                                                                                                                                                                                                                                           |
| :-- | :----------------- | :------------------------------- | :---------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | 侧栏清单列表       | **已排除**                       | n/a                                 | `packages/presentation/project/stores/projects-store.ts:21-24` `filter(p => !p.isDeleted && !p.isArchived)`；侧栏 `projectLinks` 取自 `avaliableProjects`（`apps/web/src/components/tasks/aside/use-aside.ts:60-70`）**[静态]**                                                |
| ②   | 搜索               | **未排除**（不按清单归档态过滤） | **已排除**                          | 查询 `isArchived:false`（`apps/web/src/components/search/use-search.ts:81,92`）+ 客户端 `if (task.isArchived) continue`（`search-tasks.ts:111`）**[静态]**                                                                                                                     |
| ③   | 日历               | **未排除**                       | **已排除**                          | `apps/web/src/components/calendar/monthly/list-query.ts:24-29` `isArchived:false` **[静态]**                                                                                                                                                                                   |
| ④   | 看板               | **未排除**（仅可经 URL 直达）    | **未排除**（查询不含 `isArchived`） | 清单视图任务查询 = `preference.getTasksOptions`（`apps/web/src/components/tasks/project/main/index.vue:90`）；该 options 由用户筛选器/偏好决定，**默认无 `isArchived`**；路由 `/tasks/p/:projectId` 无归档态守卫（`apps/web/src/views/index/tasks/routes.ts:39-58`）**[静态]** |
| ⑤   | 统计计数           | 见下                             | 见下                                | —                                                                                                                                                                                                                                                                              |
| ⑥   | 番茄选择器         | **未排除**                       | **已排除**                          | `apps/web/src/components/pomodoro/focus-depend-dropdown/use-task-panel.ts:55` `isArchived:false` **[静态]**                                                                                                                                                                    |
| ⑦   | 新建任务的清单下拉 | **已排除**                       | n/a                                 | 创建器用 `avaliableProjects`（`apps/web/src/views/index/tasks/multi-select-adapter.vue:22,41`；`packages/presentation/task/components/dialogs/creator/*`）**[静态]**                                                                                                           |

**⑤ 统计计数细化**

- 清单**任务计数** `taskCount`：**全仓无 UI 消费方**（仅实体/转换器/DB schema 透传）⇒ **当前不可见**。**[静态]**
- 服务端该计数口径**含归档任务**（`nao-todo-server` `infrastructure/persistence/project/repoImpl.go:364-365` 注释「含子任务/**含归档**/含放弃；不含已删除」）⇒ **若未来展示，会包含已归档任务**。**[静态]**
- 侧栏折叠项计数 = 清单条数（`packages/shared/components/smart-list/smart-list.vue:19` `count ?? links.length`）⇒ 已排除归档清单。**[静态]**

**内置视图（「所有任务/今日/明日/本周/收藏夹/过期/已放弃」）额外缺口**：其默认 `getTasksOptions` **不含 `isArchived`**（`packages/infrastructure/src/built-in/project/default.ts:90-209`；**全文件 grep `isArchived` = 0 命中**）⇒ 已归档任务会出现在内置视图。**[静态]**（决策④「全排除」不满足）

> 注：因入口不可达，以上**未能做端到端实测**；结论均为 **[静态]**，请按「实现归档功能时必须逐处补测」对待。

---

## 3. 任务级联（Q3）

| 问项                                   | 结论                                                                                                             | 证据                                                                                                                                                                                                                           |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 客户端是否级联                         | ❌ **否**（全仓无「清单归档 ⇒ 置任务 `archivedAt`」代码）                                                        | 客户端任务仓储**无 archive 方法**：`packages/infrastructure/src/persistence-local/repos/task-repo-impl.ts` 仅 `get/create/update/remove/cascadeRemove/restore/list/copy/snooze`；`archivedAt` 唯一写入点是同步 pull **[静态]** |
| 服务端 `Archive` 是否级联              | ✅ **是**                                                                                                        | `nao-todo-server` `application/project/appImpl.go:217-249`，`:234` `taskRepo.ArchiveByProjectId`；repo 实现 `infrastructure/persistence/task/repoImpl.go:1141-1163` **[静态]**                                                 |
| 服务端 `Unarchive` 是否级联            | ✅ **是**（对照项）                                                                                              | `appImpl.go:251-282`，`:268` `UnarchiveByProjectId`；repo `:1172-1192` **[静态]**                                                                                                                                              |
| 离线归档时任务状态                     | ⚠️ **会出现「清单已归档但任务仍出现在日历」**                                                                    | 客户端不级联 ⇒ 本地任务 `archivedAt` 仍空 ⇒ 日历按 `isArchived:false` 查询仍命中；且离线无 pull ⇒ 服务端级联结果无法回灌 **[推断]**                                                                                            |
| 当前实现（archive=delete）下的离线表现 | 本地清单被软删、**本地任务未级联** ⇒ 任务仍在本地日历/内置视图可见，待联网 push 后服务端级联软删、再 pull 才消失 | 同上 **[推断]**                                                                                                                                                                                                                |

> 服务端级联**未实测**（本单只读，未运行 server 测试/未起 Go 服务）；以上为读码结论。

---

## 4. 取消归档（Q4）

| 问项                        | 结论                                                                                        | 证据                                                                                                                                                                                                                                                           |
| :-------------------------- | :------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI 路径                     | ⛔ **无**                                                                                   | 全仓无 `unarchive` 调用方（grep 仅定义）**[静态]**                                                                                                                                                                                                             |
| 客户端消费方                | ⛔ 无                                                                                       | `project-archive-button`（shared）**无消费方**；`ProjectCard`/`ProjectBoard` 的 `unarchiveProject` 事件**无监听方**（`project-manager.vue` 只监听 `delete-project`/`restore-project`）；`useProjectsStoreBase.unarchiveProject` action **无调用方** **[静态]** |
| 服务端 API                  | ✅ 可达：`PUT /projects/unarchive/:projectId`                                               | `nao-todo-server` `interfaces/routers/projectRouter.go:54-57`；controller `:417-450`；app `:251-282` **[静态]**                                                                                                                                                |
| 级联恢复任务                | ✅ 成立                                                                                     | `appImpl.go:268` + `repoImpl.go:1172-1192` **[静态]**                                                                                                                                                                                                          |
| local-first 下是否入队/回传 | ✅ 会（若被调用）：`unarchive` 置 `archivedAt=null` + `markDirty('projects', id, 'upsert')` | `project-repo-impl.ts:143-157` **[静态]**                                                                                                                                                                                                                      |

> **结论：当前「取消归档」仅服务端 API 可达**；客户端 UI 不可达，且客户端用例实现为 `delete` 占位。

---

## 5. 数据完整性（Q5）

| 链路                 | 结论                                                                                                                                                                                                                                                                                                                                                                                        | 证据                                                                                                               |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| 字段存在（本地）     | ✅                                                                                                                                                                                                                                                                                                                                                                                          | `local-database.ts:20/83/138`（projects/tasks/pomodoros）**[静态]**                                                |
| pull 落库            | ✅ 完整（含 `archivedAt`）                                                                                                                                                                                                                                                                                                                                                                  | `packages/infrastructure/src/persistence-go/project/converters.ts:30-43`（`res.archivedAt`）；task 同理 **[静态]** |
| push 回传            | ✅ 完整（projects + tasks 均含 `archivedAt`）                                                                                                                                                                                                                                                                                                                                               | `sync-service.ts:126-136` / `:88-113` **[静态]**                                                                   |
| `meta`/字段遗漏      | **未发现遗漏**                                                                                                                                                                                                                                                                                                                                                                              | 上述字段闭环 **[静态]**                                                                                            |
| 是否受 `DEF-12` 影响 | **① 影响面更正**：服务端 `ByTaskArchived(false)` 空操作（`scopes.go:139-146`）+ `List` 直接透传 `q.IsArchived`（`repoImpl.go:287`）⇒ 服务端 API 默认**漏入归档任务**；但 **web/desktop 已本地优先**，本地仓储**显式**过滤（`task-repo-impl.ts:279-282`）⇒ **web/desktop 列表不受 DEF-12① 影响**，主要影响**移动端（`presentation-react` 用 `persistence-go`）与直连 API 调用方** **[静态]** |
| `DEF-12②`            | 仍然成立：`sort` 无白名单（`nao-todo-server` `infrastructure/utils/query/sorting.go:12-23` `Order(ToSnakeCase(field) + " " + direction)`）⇒ SQL 注入面，**与归档功能正交但同属该缺陷** **[静态]**                                                                                                                                                                                           |

---

## 6. 内建清单（Q6）

| 问项           | 结论                                                          | 证据                                                                                                                                                                                                                                                                                                               |
| :------------- | :------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 现状是否可归档 | ⛔ **不可**（数据模型/入口均无）                              | 内建清单为**硬编码**：`packages/infrastructure/src/built-in/project/default.ts:5-88`（含 `inbox` 收集箱）；实体 `BuiltInProjectEntity` **无 `archivedAt`**（`packages/domain-built-in-project/src/domain/entities/built-in-project.ts`）；仓库**无 archive 方法**（`…/domain/repositories/builtins.ts`）**[静态]** |
| 侧栏来源       | 内建链接来自 `builtInProjectsStore`（非 `avaliableProjects`） | `apps/web/src/components/tasks/aside/use-aside.ts:50-58` **[静态]**                                                                                                                                                                                                                                                |
| 归档后是否异常 | n/a（不可归档）                                               | 服务端亦无 projects 行（隐式桶 `projectId = userId`）**[静态]**                                                                                                                                                                                                                                                    |

> 决策⑧「禁止归档内建收集箱」在现状下**自然满足**；实现新功能时需**显式防呆**（内建 id 与真实清单 id 空间不同，但应加守卫/测试锁定）。

---

## 7. 测试覆盖（Q7）

### 7.1 已锁定归档行为的用例（**[实测]** 本次运行）

| 文件                                                                                                                                                    | 覆盖点                                                  | 本次运行                               |
| :------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------ | :------------------------------------- |
| `packages/infrastructure/src/persistence-local/__tests__/local-project-repos.test.ts:40-63`                                                             | 项目仓储 `update/archive/unarchive/delete/restore` 语义 | **1 文件 / 13 例 / 0 红 / 6.25s**      |
| `apps/web/src/components/search/__tests__/search-tasks.test.ts:81,99`                                                                                   | 搜索排除 `archived`                                     | **含于 3 文件 / 65 例 / 0 红 / 616ms** |
| `apps/web/src/components/calendar/monthly/__tests__/list-query.test.ts:11`                                                                              | 日历查询 `isArchived:false`                             | 同上                                   |
| `packages/presentation/offline/__tests__/write-methods.test.ts:33-58`                                                                                   | `archive/unarchive` 不在离线只读闸门表（透传）          | 同上                                   |
| `packages/infrastructure/src/persistence-local/__tests__/local-task-repos.test.ts:164-206`                                                              | 本地任务 `isArchived` 过滤（含空串惯例）                | 未单独运行（静态确认存在）             |
| 服务端 `domain/project/entities/project_test.go`（`TestProject_Archive/Unarchive`）· `domain/task/entities/task_test.go`（`TestTaskArchive/Unarchive`） | 实体级归档时间语义                                      | 未运行（跨仓，只读）                   |

命令（可复现）：

```text
pnpm exec vp test --run packages/infrastructure/src/persistence-local/__tests__/local-project-repos.test.ts
pnpm exec vp test --run apps/web/src/components/search/__tests__/search-tasks.test.ts apps/web/src/components/calendar/monthly/__tests__/list-query.test.ts packages/presentation/offline/__tests__/write-methods.test.ts
```

### 7.2 **未覆盖**（缺口）

- ❌ `ProjectUseCase.archive/unarchive` **无用例**（且实现为 `delete` 占位 ⇒ **无测试会发现该缺陷**）
- ❌ 服务端 `appImpl.Archive/Unarchive` 的**级联**行为**无用例**（仅实体级）
- ❌ 端到端「归档 ⇒ 7 处消失」· 取消归档 UI · 二次确认 · 归档面板只读 · 内建禁归档 · 双端一致性

---

## 8. 缺口映射（Q8）—— 用户 10 项决策 vs 现状

| #   | 决策                                            | 现状                          | 依据                                                                                                                                                                         |
| :-- | :---------------------------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | 补齐闭环（查看已归档 + 取消归档）               | ⛔ **缺失**                   | 无归档面板；无 unarchive UI/消费方；`unarchive` 用例为 `delete` 占位（§1.2/§4）                                                                                              |
| ②   | 归档时任务随清单隐藏/恢复                       | ⛔ **缺失**                   | 客户端无级联；服务端有级联但仅 API 路径（§3）                                                                                                                                |
| ③   | 入口 = 侧栏清单区底部「已归档」→ 面板内取消归档 | ⛔ **缺失**                   | 侧栏无该入口；`project-manager` 仅 `all/active/deleted` 三 tab（`use-project-manager.ts:35`），**无 archived tab**（且归档清单会混入「全部/正常」tab，仅能 delete/restore）  |
| ④   | 可见性 = 全排除（7 处）                         | 🟡 **部分**                   | 清单级：①⑦ 已排除；任务级：②③⑥ 仅排除"已归档任务"；④看板 + 内置视图**无 `isArchived` 过滤**；⑤ 无 UI 消费方（§2）                                                            |
| ⑤   | web + desktop 双端一致（移动端零改动）          | 🟡 **架构天然满足，功能缺失** | desktop `@ → apps/web/src`（同一 UI）；移动端 `composeProjectUseCase` **不暴露 archive**（`packages/presentation-react/src/logic/compose-project-usecase.ts`）⇒ 零改动易达成 |
| ⑥   | 归档需二次确认（提示「N 个任务将一并归档」）    | ⛔ **缺失**                   | 全仓无归档确认文案/`NueConfirm` 调用（`NueConfirm` 仅用于 delete，`presentation/project/handlers/project.ts`）                                                               |
| ⑦   | 归档清单只读（禁新建/编辑）                     | ⛔ **缺失**                   | 无归档面板；清单视图对归档态无守卫（URL 直达可编辑）                                                                                                                         |
| ⑧   | 禁止归档内建收集箱                              | ✅ **现状自然满足**           | 内建清单不在 projects 表、实体无 `archivedAt`（§6）；实现时需加防呆                                                                                                          |
| ⑨   | 归档入口也放清单右键菜单                        | ⛔ **缺失**                   | 侧栏 `NaoSmartList` 无 `contextmenu`（§1.1）                                                                                                                                 |
| ⑩   | 取消归档后清单回侧栏原位、任务全恢复            | ⛔ **缺失**                   | 无 unarchive UI；**数据层可行**：`sortId` 在归档时保留 ⇒ 复位可恢复原位；任务恢复依赖服务端级联 + pull                                                                       |

---

## 9. 风险与需 PM/arch 裁定项

| ID     | 风险                                                                                                                                                   | 级别               | 建议裁定方                              |
| :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- | :-------------------------------------- |
| **R1** | `ProjectUseCase.archive/unarchive` 均误调 `delete` ⇒ **启用入口即误删数据**（含级联删任务）                                                            | **P0（实现缺陷）** | arch + rd-fe：**修 usecase 是启用前置** |
| **R2** | 任务级联口径未定：客户端不级联 ⇒ **离线归档后任务仍可见**（日历/内置视图）；是否需客户端级联（新增任务仓储 archive 方法）？                            | P1                 | arch（影响面/同步语义）                 |
| **R3** | 内置视图（所有任务/今日…）与看板**缺 `isArchived` 过滤** ⇒ 决策④「全排除」无法仅靠"任务级联"达成                                                       | P1                 | arch + rd-fe                            |
| **R4** | `DEF-12①` 影响面更正（web/desktop 本地优先 ⇒ 不受影响，主要影响移动端/直连 API）                                                                       | 口径               | PM（更新缺陷池口径）                    |
| **R5** | `deactivedAt`（VO `isDeleted` 判据）vs `deletedAt`（本地 `delete()` 写入）双字段语义不一致 —— 与归档实现强耦合，须先明确"归档 vs 停用 vs 删除"三态边界 | P1                 | arch                                    |
| **R6** | 只读面板 + 取消归档回原位需新路由/组件；`sortId` 保留使复位可行，但归档期间**排序重建**（`resortWithRebuild`）是否会把归档项计入/打乱需确认            | P2                 | rd-fe                                   |
| **R7** | 文档承诺 vs 现实：清单管理弹窗警示语称「可以使用归档功能」（`packages/shared/locales/zh-CN.ts:651-652`）但功能不存在 ⇒ 用户预期落差                    | P2                 | PM（文案/需求）                         |

---

## 10. 未能证实 / 边界声明

- **未能证实（未实测）**：Q1「点击后是否生效」、Q2 七处可见性、Q3 服务端级联运行时行为、Q3 离线端到端表现 —— 因**入口被注释、无点击面**，均为 **[静态]/[推断]**，未做浏览器/Electron 实测。
- **未使用**：dev server / 预览环境（无点击面 ⇒ 拉起无增量证据）。本机 `*.vercel.app` DNS 不可达，本单未涉及该场景。
- **未触碰**：源码 / 测试 / 构建配置 / `docs/adr/**`；移动端零改动。
- **跨仓**：`nao-todo-server` 仅只读引用（未运行其测试）。
- **门禁**：报告提交前跑 `pnpm exec vp check`（探针单口径）。

---

## 附：关键证据索引（速查）

```text
web/desktop 共享 UI
  apps/web/src/components/tasks/project/header/operation-dropdown.vue:40-43  （handler 注册，死代码）
  apps/web/src/components/tasks/project/header/operation-dropdown.vue:105-110（菜单项，整段注释）
  apps/desktop/electron.vite.config.ts:47                                    （@ → apps/web/src）

客户端用例/仓储（错误实现）
  packages/domain-project/src/application/usecases/project-service/project.ts:156-159 / 166-169（archive/unarchive → delete）
  packages/infrastructure/src/persistence-local/repos/project-repo-impl.ts:84-100（delete）/ 125-157（archive/unarchive 正确但无调用方）
  packages/infrastructure/src/persistence-sync/sync-service.ts:975-978（action=delete ⇒ deletions）

可见性
  packages/presentation/project/stores/projects-store.ts:21-24（侧栏排除）
  apps/web/src/components/search/use-search.ts:81,92 + search-tasks.ts:111
  apps/web/src/components/calendar/monthly/list-query.ts:24-29
  apps/web/src/components/pomodoro/focus-depend-dropdown/use-task-panel.ts:55
  apps/web/src/views/index/tasks/multi-select-adapter.vue:22,41
  packages/infrastructure/src/built-in/project/default.ts:90-209（内置视图无 isArchived，全文件 0 命中）

服务端（nao-todo-server @ ac72a37）
  interfaces/routers/projectRouter.go:51-57（archive/unarchive 路由）
  application/project/appImpl.go:217-249 / 251-282（Archive/Unarchive 均级联）
  infrastructure/persistence/task/repoImpl.go:1141-1163 / 1172-1192（级联实现）
  infrastructure/persistence/task/scopes.go:139-146（DEF-12① 空操作）
  infrastructure/utils/query/sorting.go:12-23（DEF-12② 无白名单）
```