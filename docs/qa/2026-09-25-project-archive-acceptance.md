# 2026-09-25 清单归档（Issue #99）P4 终验 · 发布前验收报告

> **任务**：`T184`（qa，P4 终验 — 独立验收 + 全范围门禁，发布前最后闸门）
> **分支 / 基线**：`feat/99-project-archive`，验收 HEAD = **`6704ac44`**（代码提交 = **`281d051a`**；`6704ac44` 仅 `docs/tasks-state.md` 台账）
> **真源**：PRD `docs/prds/2026-09-24-project-archive.md`（v0.2，AC1–AC6 / §12 DP）· ADR `docs/adr/2026-09-24-project-archive.md`（r2，§15 定名 / §Q1–Q6 / PA-1…PA-10）· 缺陷池 `DEF-36` / `DEF-12`
> **跨仓**：`nao-todo-server` @ `1c29a69`（**PR #31 Draft**，base `arch/go-ddd`）——**只读引用**
> **执行**：qa-T184 ｜ **性质**：独立验收（不改实现、不改基线、移动端零改动）
> **方法声明**：所有门禁由 qa **独立实跑**；AC 结论 = 行为级用例 + 源码走查；变异测试在**临时改动后完整还原**（工作区最终 `git status` 干净）。

---

## 0. 结论

**✅ 可发布 —— 无阻塞项。**

- **AC1–AC6 逐条通过**（§1）；**8 项全范围门禁全绿**（§2）。
- 4 处「基线机制修正」复核：**断言强度未降**、**判别力仍在**（§3 + §4 变异测试）。
- 变异测试 **6 组受控变异全部被杀死**、还原后复绿（§4）；另有 1 次辅助变异因提示节流未被捕获（§3 观察，不影响判别力）。
- **非阻塞项 4 条 + 遗留观察 2 条**（§7）：均不改变「AC1–AC6 通过、可发布」的结论，但其中 **2 条须随发布说明登记/修正**（DP-1 表述、N 口径补充），**1 条建议发布前补验证**（R-5）。
- **未过项 1 条**：PR 评论尚未贴（本分支客户端**尚无 PR**，`gh pr list --head feat/99-project-archive` 空；本报告即为可引用的精确数字来源）。

---

## 1. AC1–AC6 逐条验收

> 证据列 = 「断言 → 来源（文件:行 / 用例 / 命令）」。全部用例实跑通过。

### AC1 归档闭环（归档 → 从活动区消失 → 可找回 → 取消归档回最近位置）

| 断言                                                         | 证据                                                                                                                                                                     | 结论 |
| :----------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 归档 = 写 `archivedAt`，**绝不写 `deletedAt`/`deactivedAt`** | `ProjectUseCase.archive`（`project-service/project.ts:178-190`）委派 `taskCascade.archiveByProjectId` / `repo.archive`；`project-repo-impl.ts:125-141` 只置 `archivedAt` | ✅   |
| 清单与其下任务**同事务**级联                                 | `project-archive-cascade.ts:36`（`db.transaction('rw', db.projects, db.tasks, db.syncQueue, …)`）                                                                        | ✅   |
| 归档后清单从侧栏消失                                         | 侧栏走 `avaliableProjects`（`use-project-store-base.ts`，`!isDeleted && !isArchived`）；store 即时收敛 `archiveProject`（`project.ts:190`）                              | ✅   |
| 可从「已归档」找回                                           | `project-manager` `archived` tab（`use-project-manager.ts:63-66, 108-116`）                                                                                              | ✅   |
| 取消归档 ⇒ 其下**仍归档**任务全部恢复                        | 级联 `unarchive` 只恢复仍归档行（`project-archive-cascade.ts:57-63`）                                                                                                    | ✅   |
| 恢复**回最近位置**（保留 `sortId`；碰撞以恢复值作锚归一）    | `project-service/project.ts:200-236`（`normalizeSortAfterUnarchive`）                                                                                                    | ✅   |

**测试**：`local-project-archive-cascade.baseline.test.ts`（9 例：归档/恢复/跳过已归档/不复活脱归档/同事务/逐任务 `markDirty`）· `project-archive-usecase.baseline.test.ts`（面1/面11：`DEF-36` 语义 + `sortId` 保留 + 碰撞归一）· `project-manager-archived-tab.baseline.test.ts`（2 例）。

### AC2 入口（头部菜单 + 右键菜单同一 `execute-id` + 侧栏底部「已归档」⇒ `archived` tab）

| 断言                                             | 证据                                                                                                                     | 结论 |
| :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :--- |
| 头部操作菜单「归档清单」已接线（非注释态）       | `apps/web/src/components/tasks/project/header/operation-dropdown.vue`（`execute-id="archive-project"`）                  | ✅   |
| 右键菜单项 = **同一 id `archive-project`**       | `apps/web/src/components/tasks/aside/use-aside.ts`（`executeProjectContextMenu('archive-project')`）+ `aside.vue` 右键层 | ✅   |
| 侧栏底部「已归档」入口 ⇒ 管理弹窗 `archived` tab | `aside.vue`（`openProjectManager('archived')`）+ `project-manager.vue`（`open(payload?)` 读 `payload?.activeTab`）       | ✅   |
| 二次确认 N 提示                                  | `apps/web/src/components/tasks/project/archive-project-action.ts`（`runProjectArchive` + `NueConfirm`）                  | ✅   |

**测试**：`apps/web/src/__tests__/project-archive-wiring.baseline.test.ts`（面4：两处入口 + 同 id）· `aside-archived-entry.test.ts`（4 例）· `project-manager-archived-tab.baseline.test.ts`。

### AC3 可见性 7 处 + 8 内置视图 + 搜索开关

| 断言                                                       | 证据                                                                                                                           | 结论 |
| :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :--- |
| **L1 单一杠杆**：`list()` 未传 `isArchived` ⇒ 默认排除归档 | `task-repo-impl.ts:331-340`（`includeArchived` 优先 → 显式 `true` 包含 → **否则排除**）                                        | ✅   |
| 清单视图（表格/列表/看板）+ **8 个内置视图** 排除          | 同上（用例驱动偏好 `getTasksOptions`）；`local-task-archive-visibility.baseline.test.ts`（14 例，含 8 内置视图逐处）           | ✅   |
| 侧栏 / 日历 / 番茄 / 新建下拉 已排除（保守护栏）           | `avaliableProjects` / `calendar/monthly/list-query.ts` / `focus-depend-dropdown/use-task-panel.ts`                             | ✅   |
| 搜索默认排除 + 「包含已归档」**唯一显式包含**通道          | `use-search.ts` `buildRootQuery`/`buildChildQuery`（开 ⇒ `includeArchived:true`；关 ⇒ `isArchived:false`）                     | ✅   |
| URL `archived=1` 往返                                      | `apps/web/src/components/search/search-query.ts`（parse/serialize/equals）+ `search-filter-bar.vue`（prop + `toggleArchived`） | ✅   |
| 结果带「已归档」标识 + i18n                                | `search.state.archived` / `search.includeArchived`（中英）；`search-tasks.ts` 开关控制                                         | ✅   |

**测试**：`local-task-archive-visibility.baseline.test.ts`（14）· `local-task-archive-search.baseline.test.ts` · `search-include-archived.baseline.test.ts` + `search-include-archived.wiring.test.ts`（端到端查询串 + URL 往返 + UI + i18n）。

### AC4 只读（`ARCHIVED_READONLY`，web + desktop 一致；`unarchive` 唯一例外；命中提示可见）

| 断言                                                            | 证据                                                                                                                           | 结论 |
| :-------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :--- |
| 独立错误码 `ARCHIVED_READONLY`（**不复用** `OFFLINE_READONLY`） | `packages/presentation/task/archive-gate.ts:23`                                                                                | ✅   |
| 写方法全拦；`allow` 默认 **`['unarchive']`**（唯一例外）        | `archive-gate.ts:72` + `TASK_ARCHIVE_WRITE_METHODS`（`create/update/delete/restore/batchUpdate/resort/copy/snooze/unarchive`） | ✅   |
| 按原方法返回形态（`'error'` 直返 / `'tuple'` = `[null, …]`）    | `archive-gate.ts`（`archivedReadOnlyResult`）                                                                                  | ✅   |
| 命中 ⇒ 可见提示（节流 1200ms）                                  | `archive-gate.ts:37,46-53`（`notifyArchivedReadOnly` → `NueMessage.warn(t('archive.readOnlyHint'))`）                          | ✅   |
| **两返回形态** `'error'` / `'tuple'` 同源                       | 测试 `archive-gate.baseline.test.ts`                                                                                           | ✅   |
| **web + desktop 双端注入**，同一 `archive-gate` 实现            | `apps/web/src/hooks/usecases/binding.ts:115-116` · `apps/desktop/src/renderer/src/hooks/usecases/binding.ts:55`                | ✅   |
| 判据 = 任务 `archivedAt` 非空（用例层拦截 ⇒ URL 直达亦不可写）  | `createTaskArchivedTargetJudge`（`archive-gate.ts`，按方法入参取目标；`create` 判所属清单归档）                                | ✅   |

**测试**：`archive-gate.baseline.test.ts`（8 例：拦截 + 形态 + allow 例外 + allow 可覆盖 + 不误伤 + 读透传 + i18n）· `task-unarchive-wiring.test.ts`（handler 接线）· `write-gate-wiring.test.ts`（两端注入 + desktop 不套离线闸门）。

### AC5 收集箱（不可归档；单任务脱归档 ⇒ `'inbox'` + 可见提醒；清单已恢复 ⇒ 回原清单）

| 断言                                                                                      | 证据                                                                                 | 结论 |
| :---------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :--- |
| 内建收集箱**不可归档**（兜底拒绝）                                                        | `project-service/project.ts:178-181`（`projectId === 'inbox'` ⇒ 返回错误，不调仓储） | ✅   |
| 单任务脱归档：**同事务**读任务 + 读清单归档态（无 TOCTOU）                                | `task-repo-impl.ts:284-313`（`db.transaction('rw', tasks, projects, syncQueue)`）    | ✅   |
| 清单**仍归档** ⇒ `archivedAt=null` + `projectId='inbox'`（**字面**）+ `movedToInbox=true` | 同上（`:299,304`）                                                                   | ✅   |
| 清单**已恢复** ⇒ `movedToInbox=false`，`projectId` **不变**（回原清单）                   | 同上（`:304`）                                                                       | ✅   |
| **可见提醒**（「已移入收集箱」+「原清单仍归档」）                                         | `packages/presentation/task/handlers/task.ts` `unarchiveTask`（`NueMessage.warn`）   | ✅   |
| 唯一写例外 = `unarchive`                                                                  | 见 AC4                                                                               | ✅   |

**测试**：`project-archive-usecase.baseline.test.ts` 面10（`archive('inbox')` 被拒且仓储零调用）· `local-task-unarchive.baseline.test.ts`（①②分支 `toEqual({movedToInbox})` + `projectId` 严格断言 + i18n）· `task-unarchive.baseline.test.ts`（用例层）· `task-unarchive-wiring.test.ts`（提醒文案 + silent 分支）。

### AC6 数据安全（不写 `deletedAt`/`deactivedAt`；同事务；逐任务入队；`archivedAt` 严格 `null`）

| 断言                                                       | 证据                                                                                                                          | 结论 |
| :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :--- |
| 归档路径**绝不**写 `deletedAt` / `deactivedAt`（PA-4）     | `project-archive-cascade.ts`（只改 `archivedAt`+`updatedAt`）· 测试面1 三例 `expect(entity.deletedAt/deactivedAt).toBeNull()` | ✅   |
| 级联**同一 `rw` 事务**（PA-5）                             | `project-archive-cascade.ts:36`                                                                                               | ✅   |
| 逐任务 `markDirty`（PA-7，离线一致）                       | `project-archive-cascade.ts:65`                                                                                               | ✅   |
| `archivedAt` 写**严格 `null`**（非 `''`）                  | `task-repo-impl.ts:303`（`archivedAt: null`）+ `local-task-unarchive.baseline.test.ts` `expect(record.archivedAt).toBeNull()` | ✅   |
| `UpdateTaskValueObject.archivedAt` 支持 + `update` 应用    | `packages/domain-task/src/domain/valueobjects/update-task.ts` + `task-repo-impl.ts:154`                                       | ✅   |
| `DEF-36` 根因消除（`archive/unarchive` 不再误调 `delete`） | `project-service/project.ts`（两方法均 `return this.taskCascade… / this.projectRepo.archive / this.projectRepo.unarchive`）   | ✅   |

---

## 2. 8 项全范围门禁（qa 独立实跑，精确数字）

> 口径按项目 `AGENTS.md`「全范围门禁」。**由 qa 单会话串行执行**（避免多会话抢 CPU 致抖动）。

| #   | 门禁                 | 命令                                                                | 结果（精确）                                                                                 | exit  |
| :-- | :------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- | :---- |
| ①   | 格式 + lint + 类型   | `pnpm exec vp check`                                                | **1469 文件格式 OK / 1249 文件 0 warning·lint·type error**                                   | 0     |
| ②   | **全仓**单测         | `pnpm exec vp test --run`                                           | **190 文件 / 1544 例 / 0 红**（`190 passed` / `1544 passed`）；wall **134.97s**              | 0     |
| ③   | 领域隔离             | `pnpm run guard:ddd`                                                | OK（domain 未引用 shared 根桶/展示层）                                                       | 0     |
| ④   | 门禁 pathspec 存在性 | `pnpm run guard:gate-pathspec`                                      | OK（门禁命令 pathspec 均存在）                                                               | 0     |
| ⑤   | 导入面可解析性       | `pnpm run guard:barrel-imports`                                     | OK（**1249 文件 · 校验 1340 条 `@nao-todo` 导入 / 1936 命名**，含 type-only）                | 0     |
| ⑥   | 移动端红线守卫       | `pnpm run guard:mobile-imports`                                     | OK（**72 源文件**，未引 `persistence-local`/`persistence-sync`/`dexie`/infrastructure 根桶） | 0     |
| ⑦   | 双端构建             | `pnpm exec vp run webapp build` / `pnpm run desktop:build`          | webapp ✓ built（**17.38s**）· desktop ✓ built（**21.87s**）                                  | 0 / 0 |
| ⑧   | 移动端工作区零改动   | `git status --porcelain -- packages/presentation-react apps/mobile` | **0 行**                                                                                     | —     |

**受影响面定位**：`codegraph affected`（8 个核心源文件）⇒ 118 个受影响测试文件（含全部功能基线）。
⚠️ **codegraph 盲区（回退 grep）**：`archive-gate.baseline.test.ts` · `project-archive-wiring.baseline.test.ts` · `aside-archived-entry.test.ts` 三者经 `import.meta.glob` 动态加载被测源码 ⇒ 静态图不可达、`affected` **未命中**；已用 grep 回退确认（三者均在功能基线集内且实跑通过）。此为已知盲区（与 AGENTS `T118` 结论一致），非本批引入。

**功能基线集单跑**：16 文件 / **106 例 / 0 红**（13.63s）。

---

## 3. 4 处「基线机制修正」复核（我是基线作者，独立认账）

> 逐处以 `git diff` 为据核对「**`expect` 断言强度未降**」，并以变异测试证「**判别力仍在**」。

### 3.1 `61e7a9a1`（`local-project-archive-cascade.baseline.test.ts`，2 处）

| #   | 修正                                                                                              | `git diff` 核对（断言强度）                                                                                  | 判别力证据                               | 结论 |
| :-- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- | :--------------------------------------- | :--- |
| ①   | `mockRestore()` 会清空 `mock.calls` ⇒ **先读 `rwCall` 再 restore**                                | diff 仅移动读取位置 + 加注释；**无任何 `expect` 文本变化**                                                   | **变异 M1** 杀死「PA-5 同事务」用例      | ✅   |
| ②   | `markDirty` 按 `${userId}:${table}:${id}` 主键覆盖（不增计数）⇒ **取 `before` 前清 `tasks` 队列** | diff 仅新增 `syncQueue.where('table').equals('tasks').delete()`；`expect(... - before).toBe(3)` **逐字未变** | **变异 M2** 杀死「逐任务 markDirty」用例 | ✅   |

### 3.2 `eeb0b7b5`（`archive-gate.baseline.test.ts`，2 处）

| #   | 修正                                                 | `git diff` 核对（断言强度）                                                                                                                                             | 判别力证据                                      | 结论 |
| :-- | :--------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- | :--- |
| ①   | 用例2 入参 `'新任务'` ⇒ `'archived-1'`               | 仅**入参**变化，`expect(...).resolves.toEqual([null, ARCHIVED_READONLY])` **逐字未变**。原入参对判据替身恒非归档目标 ⇒ 该用例**原为不可通过的笔误**，修正后强度**提升** | **变异 M5**（create 不拦）+ **M6b**（过度拦截） | ✅   |
| ②   | 文件顶部新增 `afterEach(() => vi.restoreAllMocks())` | 仅新增钩子；**无 `expect` 变化**。修复「`vi.spyOn(NueMessage,'warn')` 跨用例泄漏调用记录 ⇒ 用例5 误读用例1」的**假红**                                                  | **M6b**（用例5 主断言可杀死「非归档目标被拦」） | ✅   |

**判断**：4 处**均为探针机制性修正，非断言意图变化**；断言强度**未降**（①-`eeb0b7b5` 甚至修复了一处不可通过用例）。**无「仍不够强」到需要改基线的项**。

> **基线强度观察（登记，不建议改）**：`archive-gate` 用例5 的 `expect(warn).not.toHaveBeenCalled()` 受 **1200ms 提示节流**影响**可能恒绿** —— 我做了辅助变异 **M6**（把 `notifyArchivedReadOnly()` 前置到「非归档目标」分支，仍返回原方法）**未被该断言捕获**；但用例5 的**主动断言**（`spies.update/create` 已调用、`resolves` 值）仍能杀死「过度拦截」变异（**M6b 证明**）⇒ 该用例整体判别力不受影响，无需改动。

---

## 4. 变异测试（6 组，全部杀死；随后完整还原复绿）

> 受控变异仅针对**实现文件**，每次**只改 1 点**，跑**对应基线单文件**，随后 `git checkout -- <file>` 完整还原并复跑确认恢复绿。

| 变异 | 变异点（实现文件）                                                                | 预期被杀用例（基线）                                                        | 实测                                         | 还原后      |
| :--- | :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------- | :---------- |
| M1   | `project-archive-cascade.ts`：**去掉 `db.transaction('rw',…)` 包裹**（内联 IIFE） | `local-project-archive-cascade`「级联必须在同一 Dexie `rw` 事务内（PA-5）」 | **1 红 / 8 绿**（仅 PA-5 用例红 ⇒ 精确命中） | 9/9 绿 ✅   |
| M2   | `project-archive-cascade.ts`：**去掉逐任务 `syncTracker.markDirty('tasks',…)`**   | 同文件「级联逐任务 markDirty（计数 = 受影响任务数，PA-7）」                 | **1 红 / 8 绿**（仅 PA-7 用例红）            | 9/9 绿 ✅   |
| M3   | `task-repo-impl.ts`：`unarchive` 分支 **恒 `movedToInbox=false`**（不判清单归档） | `local-task-unarchive`「① 清单仍归档 ⇒ `movedToInbox=true` + `'inbox'`」    | **1 红 / 3 绿**（② 仍绿 ⇒ 分支区分被杀死）   | 4/4 绿 ✅   |
| M4   | `task-repo-impl.ts`：`list()` **L1 默认排除归档被移除**（`else` 分支置空）        | `local-task-archive-visibility`（清单视图 + 8 内置视图默认排除）            | **12 红 / 2 绿**（L1 覆盖点大面积转红）      | 14/14 绿 ✅ |
| M5   | `archive-gate.ts`：守卫 **放行 `create`**（不拦截）                               | `archive-gate.baseline`「'tuple' ⇒ `[null, ARCHIVED_READONLY]`」            | **1 红 / 7 绿**                              | 8/8 绿 ✅   |
| M6b  | `archive-gate.ts`：**过度拦截**（非归档目标也返回 `ARCHIVED_READONLY`）           | `archive-gate.baseline`「非归档目标 ⇒ 写方法正常执行（不误伤）」            | **1 红 / 7 绿**                              | 8/8 绿 ✅   |

**结论**：基线**非恒绿、具判别力**；关键实现（同事务 / 逐任务入队 / 脱归档分支 / L1 默认排除 / 只读守卫）每一处被移除或反转都会**被对应用例精确捕获**。

---

## 5. 端到端走查（web + desktop 一致）

> **方法声明（如实）**：本环境无 Playwright/Cypress（`node_modules` 无安装），且登录依赖后端会话 ⇒ **未做真机浏览器点击走查**。走查以**行为级集成用例 + 源码路径**完成；`desktop` 经 `@/* → apps/web/src/*` 复用同一组件与同一 `archive-gate`（仅 binding 注入点不同）⇒ **两端同组件、同逻辑**。
> **建议**：发布前用既有清单 `docs/qa/2026-09-23-desktop-manual-smoke-checklist.md` 做一次人工点击烟测（并入发布前动作）。

| 走查步骤                               | web 证据                                                                  | desktop 证据                                                      | 结论 |
| :------------------------------------- | :------------------------------------------------------------------------ | :---------------------------------------------------------------- | :--- |
| 归档 → 从活动区/7 处消失               | L1 `task-repo-impl.ts:331-340` + `local-task-archive-visibility`（14 例） | 同组件（`@` 复用 web）+ 同 binding 注入                           | ✅   |
| 找回（侧栏「已归档」→ `archived` tab） | `aside.vue` + `use-project-manager.ts` + 对应基线                         | 同组件                                                            | ✅   |
| 取消归档（回最近位置，任务全恢复）     | `project.ts:200-236` + 级联 + 面11 用例                                   | 同逻辑                                                            | ✅   |
| 只读命中提示（`ARCHIVED_READONLY`）    | binding 注入 `withArchivedReadOnlyGuard`（`binding.ts:115`）              | binding 注入（`binding.ts:55`）+ `write-gate-wiring.test.ts` 断言 | ✅   |
| 单任务脱归档 → 收集箱 + 提醒           | `task-repo-impl.ts:284-313` + `handlers/task.ts` + 接线用例               | 同实现                                                            | ✅   |
| 搜索「包含已归档」开关 + URL 往返      | `search-query.ts` / `use-search.ts` / `search-filter-bar.vue` + 用例      | desktop 复用 web 组件（同 URL 态）                                | ✅   |
| 收集箱拒绝归档                         | `project.ts:178-181` + 面10 用例                                          | 同用例层                                                          | ✅   |

### 5.1 边界 / 反例核对

| 反例                                      | 期望                           | 证据 / 结论                                                                                         |
| :---------------------------------------- | :----------------------------- | :-------------------------------------------------------------------------------------------------- |
| `projectId` 不得写 `''`（必须 `'inbox'`） | 脱归档到收集箱时字面 `'inbox'` | `task-repo-impl.ts:304`；用例 `expect(record.projectId).toBe('inbox')` ✅                           |
| `archivedAt` 不得写 `''`                  | 严格 `null`                    | `task-repo-impl.ts:303`；用例 `expect(record.archivedAt).toBeNull()`（**未放宽**，PM 裁定保持）✅   |
| 归档不得改 `deletedAt`/`deactivedAt`      | 二者保持 `null`                | 面1 三例 `toBeNull()`；级联代码只写 `archivedAt`/`updatedAt` ✅                                     |
| `sortId` 碰撞需归一                       | 碰撞时以恢复值作锚重排         | `project.ts:215-236`；面11 用例 `expect(archivedSort).not.toBe(activeSort)` + `batchUpdate` 被调 ✅ |

### 5.2 已登记微差（PM 已裁定，qa 独立复核描述准确性）

| 项                                | PM 登记口径                                                                 | qa 复核结论                                                                                                                                                              |
| :-------------------------------- | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 二次确认 N 可能略小（不含已放弃） | 「N 用 `list()` 默认口径（不含已放弃），级联会归档已放弃任务 ⇒ N 可能略小」 | **方向准确，但成因列举不完整**：`list()` 默认还**只取顶层任务**（`parentTaskId=''`），而级联会归档**子任务** ⇒ 实际归档数可能因**子任务**更大。见 §7-③（建议补充登记）。 |
| `NueMessage.warn` 1200ms 节流     | 「刻意去重」                                                                | **属实**：`archive-gate.ts:37,46-53`（`NOTICE_THROTTLE_MS = 1200`）✅                                                                                                    |
| N 与 tab 两个口径                 | 确认 N = 未归档且未删除；`archived` tab 计数 = 已归档且未删除               | **属实**：N ⇒ `runProjectArchive`（未归档未删除，还排除放弃/子任务）；tab 计数 ⇒ `dialog-adapter.vue` `isArchived:true` 计数 ✅                                          |

---

## 6. 跨仓只读核对（`nao-todo-server` @ `1c29a69`，PR #31 Draft）

| 断言                                                        | 证据                                                                                                                               | 结论 |
| :---------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--- |
| `isArchived=false` **与未传** ⇒ `archived_at IS NULL`       | `infrastructure/persistence/task/scopes.go:142-147`（`true` ⇒ `IS NOT NULL`；否则 `IS NULL`）；Go 零值 ⇒ 未传与显式 `false` 同分支 | ✅   |
| `sort` 白名单（字段 + 方向），非法 ⇒ 回落默认序、**不拼接** | `infrastructure/utils/query/sorting.go`（`sortableFields` / `sortDirections`）                                                     | ✅   |
| **`/sync/pull` 仍返回归档**（镜像完整）                     | `repoImpl.go:325` `ListSync` 仅 `user_id + keyset + SyncOrder`，**不经 `ByTaskArchived`**；`TestListSyncStillReturnsArchived`      | ✅   |
| `ByTaskArchived` 唯一使用点 = REST List 路径                | `repoImpl.go:287`                                                                                                                  | ✅   |
| 契约测试：三态 + 注入样例回落（不得 500）                   | `archive_filter_integration_test.go`（`TestListArchivedFilterSemantics` / `TestListArchivedWithSort`）                             | ✅   |

### 6.1 「移动端生产代码零改动 + 服务端默认排除 ⇒ 移动端不再显示已归档内容」表述核对

| 分项                         | 复核结果                                                                                                                                                                                                     | 表述裁定              |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| 移动端生产代码**零改动**     | `git diff --name-only 9bbbf1ec..HEAD` 不含 `packages/presentation-react` / `apps/mobile`；`guard:mobile-imports` rc=0；红线 `git status` = **0**                                                             | ✅ 准确               |
| 移动端不再显示已归档**任务** | 移动端不传 `isArchived`（生产 0 处）⇒ 服务端默认 `false` ⇒ `archived_at IS NULL` ⇒ 排除；`/sync/pull` 仍同步（镜像完整）                                                                                     | ✅ 准确               |
| 移动端不再显示已归档**清单** | ❌ **不成立**：服务端**项目列表** `GetByUserId`（`project/repoImpl.go:283`）**无 archived 过滤**；移动端 `presentation-react` 亦无 `isArchived` 处理 ⇒ 已归档清单在移动端**仍会出现**（其任务为空）。见 §7-② | ⚠️ **须修正发布说明** |

---

## 7. 非阻塞项与遗留观察（不改结论，但须登记）

| #   | 级别             | 事项                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 建议                                                                                                                                 |
| :-- | :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| ①   | **登记（建议）** | **ADR §7.2「清单**自身** `update/delete/resort/archive` 亦应拦截（除 `unarchive`）」未实现** —— 归档守卫仅注入**任务域**（`binding.ts` `kind==='task'`），**项目域无守卫**。URL 直达归档清单详情后，头部「编辑清单 / 删除清单」仍可执行。**PRD AC3/AC4 只约束「其下任务」，故不属本批 AC 缺口**；但 ADR 明写该约束。                                                                                                                                                                                                               | 由 PM/arch 决定：**补项目域归档守卫** 或 **收窄 ADR §7.2 措辞**（二选一，勿双源）。                                                  |
| ②   | **须修正**       | **DP-1 发布说明表述**：应只写「移动端不再显示**已归档任务**」；已归档**清单**在移动端仍会出现（服务端项目列表未过滤 + 移动端无过滤，见 §6.1）。                                                                                                                                                                                                                                                                                                                                                                                    | 发布说明按「任务排除 / 清单仍可见（空）」如实拆分登记；如需移动端也隐藏清单 ⇒ 另立单（服务端 project 列表默认排除 + 移动端零改动）。 |
| ③   | **须补充**       | **N 口径微差成因补充**：除「不含已放弃」外，**N 还不含子任务**（`list()` 默认 `parentTaskId=''` 仅顶层），而级联归档子任务 ⇒ 实际归档数可能 > N。用户可见文案为「{count} 个任务将一并归档」。                                                                                                                                                                                                                                                                                                                                      | 将「不含子任务」并入既有微差登记（文案可不改，PM 已接受「N 可能略小」）。                                                            |
| ④   | **登记**         | **R-5 未被本批验证/闭环**（ADR §5/§9 明写「实现单内必验，不通过则单独登记交 PM」）：本批新路径「单任务脱归档 ⇒ `projectId='inbox'`」在 push/pull 往返后，服务端将 `'inbox'` 归一为 `userId`（`server/application/task/converters.go:33` `FormatID(ProjectId)`），本地 pull 按原值落库（`persistence-local/converters/task.ts:22`）⇒ 本地收集箱视图按字面 `'inbox'` 过滤（`task-repo-impl.ts`）**将不再命中该任务**（可见性从收集箱"消失"，但数据仍在）。**[静态推断，未实测]**，属**既有缺口**（非本批引入），但本批路径使其可达。 | 发布前补 1 次**受控探针**验证往返；或明确随发布说明登记并另立单。                                                                    |

**补充观察（低优先，登记即可）**

- `LocalTaskRepoImpl.unarchive` 未校验目标是否**确实处于归档态**：命令式调用非归档任务（且清单归档）会把未归档任务也移入收集箱。当前 UI 仅在 `vo.archivedAt` 时暴露入口 ⇒ **不可达**；建议后续加前置校验（防御性），或明确不修。
- 归档清单详情页其余操作按钮未置灰（仅靠守卫拦截 + 提示）——符合「只读 + 命中提示可见」的 AC4，但 UX 上可选择置灰（非本批要求）。

---

## 8. 交付检查清单核对（只报未过项）

- **未过：**「PR 评论已贴全量门禁精确数字 + 预览环境结论」—— 客户端分支 **尚无 PR**（`gh pr list --head feat/99-project-archive` 无输出）；本报告已提供可引用的**精确数字**，待 RD 开 PR / PM 发布时贴入。
- 其余检查项 **pass**（范围与风险、零改实现、零改基线、用例可追溯 AC、分层对齐、回归全跑、报告含统计/风险/建议、无生产数据、无探针残留〔变异已完整还原，工作区干净〕、环境按 AGENTS.md、受影响测试已用 codegraph 定位并注明 glob 盲区回退、未在 PM 验收前催合并）。

---

## 附录 A 环境与命令

- Node `v24.20.0` · pnpm `11.18.0` · vitest `v4.1.10`（via `vp`）· 仓库 `/home/nathan/Project/nao-todo` @ `6704ac44`（代码 `281d051a`）。
- 全仓测试 wall **134.97s**（transform 24.71s / import 81.10s / tests 150.25s / env 117.19s；聚合 > wall ⇒ 并发 ~2.7）。
- 变异测试全部**临时改动 → 单文件实跑 → `git checkout -- <file>` 还原 → 复跑**；收尾 `git status --porcelain` = 空。

## 附录 B 验收依据文件（本批 68 文件中的关键面）

| 层             | 关键文件                                                                                                                                                                                    |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| domain-project | `project-service/project.ts`（archive/unarchive/复位归一）· `domain/entities/project.ts`（PA-1 `isDeleted` + `isProjectDeleted`）· `converters.ts`                                          |
| domain-task    | `application/usecases/task.ts`（`unarchive`）· `domain/repositories/task.ts`（可选方法）· `valueobjects/update-task.ts`（`archivedAt`）                                                     |
| infrastructure | `persistence-local/repos/project-archive-cascade.ts`（同事务级联）· `task-repo-impl.ts`（`unarchive` 分支 / L1 / `includeArchived`）· `repos/project-repo-impl.ts`（archive/unarchive）     |
| presentation   | `task/archive-gate.ts`（`ARCHIVED_READONLY` + 守卫）· `task/handlers/task.ts` · `project/handlers/project.ts` · `project/stores/projects-store.ts` · `project/components/dialogs/manager/*` |
| apps           | web/desktop `binding.ts`（双端注入）· web `aside/*` · `header/operation-dropdown.vue` · `archive-project-action.ts` · `search/*` · `dialog-adapter.vue`                                     |
| shared         | `locales/{zh-CN,en-US,types}.ts` · `components/project-card/*` · `components/project-archive-button/*` · `constants/task.ts`                                                                |