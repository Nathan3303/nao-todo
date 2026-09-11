# Changelog

本仓库为私有 monorepo（root `private: true`，内部依赖 `workspace:*`）。版本策略：功能批次 → minor（root 协同版本 + 实际变更包各自语义化 bump）；发布以注解 tag 记录。历史 PRD 明细见 [docs/prds/](docs/prds/)。

## [v1.4.5] - 2026-09-12

发布批次：任务查询默认排除已删除（快速修复）。Tag: `v1.4.5` · root `1.4.5` / `@nao-todo/infrastructure` `0.2.2` / `@nao-todo/desktopapp` `1.4.5`（`@nao-todo/presentation` `0.2.1` 不变）。范围：本地查询层（web + desktop 共用；mobile 走服务端仓库，零影响）。

### Fixed（缺陷修复）

- **任务查询默认包含已删除任务（含子任务）**：`task-repo-impl.ts` 未传 `isDeleted` 时不过滤，已删除任务（含子任务）照常出现在默认视图查询里——与项目仓库（`project-repo-impl.ts`「对齐远程 GET /projects/ 语义」）及 `isGivenUp`「默认排除」惯例不一致。修复（提交 `8f5dbb6a`）：默认（未传）或 `isDeleted=false` ⇒ 排除已删除；`isDeleted=true` ⇒ 仅已删除（行级过滤，父/子一视同仁）。
- 影响面：父任务选择器显式 `isDeleted:false` 不受影响；「垃圾桶」内置视图（`builtin.deleted`）显式 `isDeleted:true`，**不受默认排除影响**；移动端走服务端仓库，零跨端涟漪。
- 恢复路径（订正，2026-09-12 用户提示「垃圾桶」后核实）：「垃圾桶」内置视图**已存在**（`builtin.deleted`，`default.ts:177` 偏好 `getTasksOptions` 显式含 `isDeleted: true` + `sort: deletedAt desc`）——显式传参不受默认排除影响 ⇒ **恢复入口完好**，本批不触碰它。

### Changed

- 无公开 API 变更（`infrastructure` `0.2.1 → 0.2.2` 为 patch；行为默认值变更属缺陷修复）。

### 质量门槛

- `vp test run`：**503 passed**（唯一失败 = 已裁决的周六边界 flake `task-filter-core tomorrow/week`，与本次无关；`local-repos.test.ts` 59/59 全绿）｜`vp check --no-fmt`：**1007 文件 0 错 0 警**。
- 突变验证：回退旧实现跑新 2 测试 ⇒ 2 failed（真实护栏）。
- 新增测试：默认不查已删除任务 / 默认不查已删除的子任务。

### 已知遗留

- 周六边界 flake（`task-filter-core.test.ts`，presentation-react 红线包内）未修（test-only 修复待用户放行）。
- 其余同 v1.4.4（A6 删除 / 协议 v2.3 落 PRD §9 / DEF-STORE-01 重构 / C4 前半 / §7）。

[v1.4.5]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.5

## [v1.4.4] - 2026-09-11

发布批次：`DEF-STORE-06` 内存 store 未随落库失效（P1 用户可见陈旧）修复。Tag: `v1.4.4` · root `1.4.4` / `@nao-todo/presentation` `0.2.1` / `@nao-todo/desktopapp` `1.4.4`（`@nao-todo/infrastructure` 本版零改动，不 bump）。范围：web + desktop（presentation 层）。设计记录：ADR `docs/adr/2026-09-11-def-store-06-store-invalidation.md`。

### Fixed（缺陷修复）

- **`DEF-STORE-06`（P1，用户可见陈旧）：外部变更经「立即同步」已落本地 DB，但重载前内存 store 与面板行文案仍旧值**。根因 = 失效（invalidation）依赖**视图域订阅**：`nao-todo:data-changed` 的监听与 `RefreshData` 发射绑在 `index-view.ts`（随视图挂载存在/卸载消失），且 `TaskDetailsStore` 无任何 `RefreshData` 订阅者 ⇒ 详情副本只在 `initialize()`（路由变更/重挂载/重试）刷新。修复（ADR 决策，提交 `4e51ca30`）：
    - **方向 1**：新增应用级失效中心 `useStoreInvalidationHub()`（`packages/presentation/task/stores/store-invalidation.ts`）—— `window 'nao-todo:data-changed'` → 全局 `useSubscriber().emit('RefreshData')`，与视图挂载解耦；web/desktop 各一行接线；幂等守卫保证整应用只注册一次。
    - **方向 2**：`use-subtasks.ts` 订阅 `RefreshData` → `retrySubTasks()`（以当前父任务 id 清空整体重取 = 等价 `initialize()` 语义），`onUnmounted` 反订阅。
    - **方向 4（事件不丢失）**：`use-task-loader.ts` 的 `loadAndReplace` 由"在飞时静默丢弃"改为**单槽 pending**（置脏 → 完成后重跑一次；单槽天然防风暴）。
- 验收（QA 实机 T1 断言）：外部直写 + 立即同步 + **静置 3s 零交互** ⇒ `store.details` 与面板行文案**应变新**（重载自愈对照）。【QA 结论：**PASS**（`RUN_TAG=mtwulk95`：T1 时 `store.details`=B 且行文案=新值；T2 重载自愈对照通过；`pulls=1`、重复 pull=0 ⇒ hub 幂等守卫有效）】

### Changed

- 无公开 API 变更（`presentation` `0.2.0 → 0.2.1` 为 patch）。`stores/index.ts` 补导出 `store-invalidation`（接线所需）。

### 质量门槛

- `vp test run`：**55 文件 / 502 例全绿**（499 + 新增 3：在飞不丢失 / RefreshData 重取 / mock 补导出）｜`vp check --no-fmt`：**1006 文件 0 错 0 警**。
- 回归线：`sync-service.ts` / `syncStatus`（BC-3a/b/c）、五个视图适配器、`loadAndPush`/翻页均未触碰。

### 已知遗留

- 列表 store 的"顶层行 T1 仍陈旧"已**静态判定为分页作用域假象**（主列表默认只查顶层任务，子任务不进页内数据集；滚动/筛选触发新批次即新）⇒ **不立新单**。
- `DEF-STORE-01`（观察项，P2-leaning）维持；A6 `fillStartAt()` 死方法删除、§7"内容未变跳过写入"、T1 断言落常驻探针等仍为延后/待触发。

[v1.4.4]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.4

## [v1.4.3] - 2026-09-11

发布批次：`DEF-SYNC-05` 客户端拉取游标修复 + 零调用 API/死字段清理（补丁；含一处**包导出面收窄**）。Tag: `v1.4.3` · root `1.4.3` / `@nao-todo/presentation` `0.2.0` / `@nao-todo/infrastructure` `0.2.1` / `@nao-todo/desktopapp` `1.4.3`。范围：web + desktop（+ `infrastructure` 同步层）；**移动端不动**。设计记录：ADR `docs/adr/2026-09-11-def-sync-05-client-pull-cursor.md` + `docs/adr/2026-09-11-infra-cleanup.md`。

### Fixed（缺陷修复）

- **`DEF-SYNC-05`：外部变更经「立即同步」不回灌本地（P2）**。根因**两处叠加**：① 客户端游标推进用**字符串 max**（`applyPullBatch`，混合 `+08:00`/`Z` 表示法时**字典序即错**）；② 服务端 keyset 为**严格 `>`**（`updated_at > cursor OR (= AND id > cursorId)`，`query/sync.go:26-36`）⇒ 游标一旦越过某行 bump 后的 `updated_at`（毫秒级/同秒 + 更高 `cursorId`），该行**静默漏拉且永不重拉**（重载/重启自愈走的是**非 pull** 路径，故表现得像“能自愈”）。修法（ADR 选 **A**）：游标推进改**瞬时（ms）比较**；请求游标按瞬时**回拉 Δ=1s**，回拉时 `cursorId` 置空（同刻低 id 行否则仍被跳过）、**保持原时区后缀与精度形态**、**不可解析/无时区 ⇒ 原样返回**（退化为修复前行为，不冒险）。**存储游标只前进不后退**；BC-3a/b/c 回归线未触碰（diff 内相关符号出现 0 次）。
- 被否方案：**B**（拉取后以本地 `max(updatedAt)` 比对补偿 —— 受客户端时钟、未推送写入、服务端秒级截断干扰 ⇒ 易假阳性 ⇒ 触发重复拉取风暴）｜**服务端改 `>=`**（破坏 keyset 分页契约）。
- 验收：新增 4 例（含**硬判据**：预置 `syncCursor` ≥ 变更行 `updatedAt`（ms 级）+ fake requester 按服务端 keyset 严格 `>` 过滤 ⇒ 断言该行**仍被应用**）；并做**突变验证**（回退旧实现 ⇒ 新增 4 例**全 FAIL**，硬判据症状 `expected undefined to be defined` = 外部变更行确实未落库）⇒ 证明测试能抓住旧缺陷。

### Changed（API 收窄）

- **移除零调用公开 API 与死字段（`@nao-todo/presentation` 导出面收窄）**：`TaskHandler.updateTaskName` / `updateTaskDescription` / `updateTaskEndAt` / `giveUp`（4 个方法**全仓零引用**）+ `TaskDetailsStore.taskDetails` / `setTaskDetails`（**连带删除孤儿 import**）—— **同批一次删完，禁止半删**（避免留下语义不明的半成品 API）。判据三条：**零引用 + 无孤儿 + 不改运行时行为**。
- **保留**：`common.edit` 词典键（被 TASK-02 单测**反向断言**依赖，删除会静默弱化断言）；`TaskHandler` 其余存活方法。
- **延后**：客户端 `CreateTaskValueObject.fillStartAt()`（保留作服务端 `DEF-SYNC-04` 的语义参考，跨单协调后再处理）。
- ⇒ 版本语义：`@nao-todo/presentation` `0.1.3 → 0.2.0`（**移除导出面成员属破坏性变更**，0.x 下走 minor 位；本仓消费者对这 4 个方法零引用 ⇒ **实际破坏为 0**，语义如实标注）。

### 质量门槛

- `vp test run`：**55 文件 / 499 例全绿**（v1.4.2 基线 495 + 新增 4）｜`vp check --no-fmt`：**1005 文件 0 错 0 警**。
- 实机：QA `defsync05` 探针（外部 API 直写 → 「立即同步」→ 读本地 DB）在修复后应从 FAIL **转 PASS**（列后置复跑）。

### 已知遗留（本版不修）

- **回拉窗口的重复写入**：窗口内已应用的行会被再次 `put()` 并计入 `writtenCount`（`applyPullBatch` 未入队分支无条件 `put`）⇒ 理论上游轮同步**可能多触发一次 `data-changed`（视图重拉）**；**无数据风险**（同 id upsert 幂等）。若观察到刷新抖动 ⇒ 另单加“内容未变跳过写入”。
- **`DEF-SYNC-04`（服务端 P1，另一仓库）**：`FillStartAt()` 覆盖客户端显式 `startAt` ⇒ 已在 `nao-todo-server` 修复（`fae99e2` 提交；`go test -count=1` 三包通过，已独立复跑核对），待该仓发版。
- **`DEF-STORE-01`（观察项，P2-leaning）**：Pinia 任务多副本（两副本同 id 同时在场为**必然**、任一侧后续写入会让另一侧陈旧）；**用户可见陈旧未复现**（受控 P3 阴性）；修复方向 = **单一权威源**（另立设计单，不混入清理单）。
- **`DEF-UI-01`**：**已驳回关闭** —— 原判“已有时间窗子任务日历打不开”系**探针误报**（误找 creator 式按钮 + 误用无效区间）；实测日历可用、无效区间提交**有 toast 校验**非静默。
- **清理单延后/另立**：A6 `fillStartAt()`｜C1 `DEF-STORE-01` 单一权威源重构｜C2 `giveUp()`（含确认弹窗）与批量 `update({givenUpAt})`（静默）的**行为差异**（产品语义决策）｜C3 TASK-01 移动端遗留（继承未覆盖、继承规则升级 B、行内日期编辑）｜C4 SHELL-02/03 遗留（nue-ui 版本对齐、infrastructure 硬编码中文 i18n、离线写入口径、`apps/mobile` 壳耦合）。
- 其余沿用 v1.4.2/v1.4.1/v1.4.0 已登记遗留。

[v1.4.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.3

## [v1.4.2] - 2026-09-11

发布批次：TASK-02 子任务行布局精简（补丁）。Tag: `v1.4.2` · root `1.4.2` / `@nao-todo/presentation` `0.1.3` / `@nao-todo/desktopapp` `1.4.2`。范围：**仅 web + desktop**（均消费 `@nao-todo/presentation`）；**移动端不动**。明细见归档 PRD（`docs/prds/2026-09-11-subtask-row-layout.md`）+ ADR（`docs/adr/2026-09-11-task-02-subtask-row-layout.md`）。

### Changed（行为变更）

- **子任务行布局（TASK-02）**：开始/结束时间由第二行 meta **移至名称末尾内联**；**脱离父任务**按钮由独立操作列**移至名称末尾**，该列整体移除。布局判据 = **α + 时间相对上限**：时间 `flex: 0 0 auto`（宽度随内容、**不收缩**）+ `max-width`（默认 `60%`，CSS 变量 `--subtask-row-time-max-width` 可调）+ 省略号；名称 `flex: 1 1 auto; min-width: 0` ⇒ **空间不足时名称先被省略号截断、时间保持完整**；时间被截断时**全文由 `title` 提供**。
- **子任务改名入口收敛**：行内改名唯一入口（编辑按钮）移除后，**改名唯一入口 = 点击名称进入该子任务详情页标题**（`task-details/main/index.vue` 标题 textarea → `updateTaskDetails`）⇒ **能力不丢**。点击导航**仅挂在名称元素**：点击时间、点击脱离按钮**均不触发**详情导航。
- 描述**仍居第二行**（无描述则不渲染该行）；时间内联后 `metaText()` 的“时间 ~ 描述”拼接**死分支**一并清理。**不新增可见文案**（i18n 三文件未动）。

### Removed（移除）

- 子任务行内改名机制整体删除：编辑按钮 + 编辑输入框 + 编辑态 check/clear 按钮 + `data-editing` 属性 + 仅其使用的 CSS（`editingId`/`editingName`/`startEditName`/`submitEditName`/`cancelEditName`）。**`TaskHandler.updateTaskName` 保持零调用**（登记死代码，不在本单删）。

### 质量门槛

- `vp test run` **55 文件 / 495 例全绿**（本单 +1 文件 +6 例；TASK-01 既有 489 例**无回归**）；`vp check --no-fmt` **1004 文件 0 错 0 警**；提交前后各跑一次一致。
- 实机冒烟（Electron/CDP，`scripts/electron-smoke --feature task-02`）：**AC①…⑧ + 追加 A/B 全 PASS（PASS 34 / FAIL 0 / SKIP 0）**。关键实测：AC③ 时间截断 `181px ≤ 上限 183.2px`（占行宽 59.9%）；整行 `scrollWidth == clientWidth`（**无横向溢出**）；脱离按钮 `width=14 > 0` 且**未被裁掉**；`opacity` hover/focus 单帧 `0 → 1`（**无 transition**）。
- **TASK-01 冒烟回归**（`--feature task-01`，同文件被改）：case1–case4 + case1recheck **0 FAIL**。
- 提交：`2f04ec93`（实现）→ 发布提交（版本协同 + CHANGELOG）。

### 已知遗留（非阻断）

- **跳端不一致（C-R1；用户明确“移动端不动”）**：移动端子任务行 = `checkbox + 名称 + 删除(✕)`，**无时间展示 / 无行内改名 / 无脱离父任务**；web/desktop 端**无删除** ⇒ 两端**动作集不相交**。文档与验收**不得声称两端一致**；跨端收敛另立单。
- **名称截断事实口径**：详情抽屉内容宽固定 ~404px，内联时间约占 218px ⇒ **名称可用 ≈138px ≈ 10 个中文字**后省略号。用户已确认**保持 60%**（降上限会切掉尾部「截止 <时间>」= 本域锚点）；若要给名称腾空间 ⇒ “**压缩时间文案**”另单。
- `common.edit` 词典键三处定义**保留**（移除按钮后零引用属**预期**，**不得**当死键清理）。
- 时间整体截断**可能切在 `~` 中间**（预期；不拆分分段 `span`）。
- **`DEF-STORE-01`（观察项，暂不定级）**：任务实体在两 store 各存一份（`TasksStore.tasks` ↔ `TaskDetailsStore.tasks`，两个独立 `useMapperStoreBase` Map、无跨 store 同步）；且**两副本同 id 同时在场是必然**（`TaskUseCase.get` 末尾 `addTask` 写列表 store；子任务列表由 `subTaskUseCase` 写详情 store）⇒ 任一侧后续写入会让另一侧陈旧。但“用户可见的陈旧”**属未复现而非否定**：探针差异 0/10 的**前置条件未满足**（未断言两副本同 id 同时在场、且那轮未产生写入）⇒ **保持观察**；复现且该行曾被渲染出陈旧值 ⇒ P1。
- 其余沿用 v1.4.1/v1.4.0 已登记遗留（`DEF-SYNC-04` 服务端 `startAt` 覆盖、错误文案 i18n、离线写入边界、fmt 基线、nue-ui 双版本等）。

[v1.4.2]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.2

## [v1.4.1] - 2026-09-10

发布批次：TASK-01 子任务创建继承父任务清单与时间窗（补丁）。Tag: `v1.4.1` · root `1.4.1` / `@nao-todo/presentation` `0.1.2` / `@nao-todo/desktopapp` `1.4.1`。明细见归档 PRD（`docs/prds/`）+ ADR（`docs/adr/2026-09-10-task-01-subtask-inherit.md`）。

### Added（新增功能）

- **子任务继承父任务参数（TASK-01）**：任务详情页「添加子任务」创建时，新增继承父任务的**清单**（`projectId`）与**时间窗**（`startAt`/`endAt`）。规则 = **以 `endAt` 为锚的快照拷贝**：两者皆有效且 `start ≤ end` ⇒ 逐字拷贝两者；仅 `endAt` ⇒ 拷贝 `endAt` 且 `startAt=null`；`endAt` 缺失/无效 ⇒ 均**未安排**；`startAt` 缺失/无效/倒置 ⇒ 仅 `startAt=null`（**保留有效 `endAt`**）；`projectId` 原样拷贝（`''`/`null` 均＝收集箱）。新增**模块内**纯函数 `resolveSubTaskDraft`（单一实现；**不经包公开面导出** ⇒ 仍属 patch 变更）+ 5 例单测（U1–U5）。

### Changed（行为变更）

- **父任务未排期时，新建子任务不再默认落在「今天」**，而是**未安排**（此前硬编码 `endAt = 当天`）。注：子任务数据结构性隔离（写 `taskDetailsStore`，与日历/任务视图读的 `tasksStore` 分离）⇒ **不进日历、不进未安排桶、不影响计数**。
- 继承为**创建时快照**：父任务之后改清单/时间窗**不回写**已存在子任务（禁级联）。

### 质量门槛

- `vp test run` **54 文件 / 489 例全绿**（本单 +5 例）；`vp check --no-fmt` **1003 文件 0 错 0 警**；提交前后各跑一次结果一致。
- 提交：`5117cc48`（功能）→ 发布提交（版本协同 + CHANGELOG）。

### 已知遗留（非阻断）

- **跳端不一致（D7-a=B，用户裁决）**：移动端 `packages/presentation-react/src/logic/compose-task-usecase.ts:129` 的同源 `createSubTask` **未同步修** ⇒ 手机端新建子任务仍为「收集箱 + 当天」。**故本次不触发移动端发版**（`presentation-react` 不在本版版本表内属**有意**：`apps/mobile` 依赖的正是该包、不含 `presentation`）。升级判据 B-5（同类硬编码第二次回归）已命中 ⇒ 下一次触碰“子任务创建默认值”应直接升级为 application 层默认解析，不再逐端修。
- 存量数据**不回填**：同一父任务下新旧子任务可并存（旧为“今天”、新可能“未安排”），**不得当缺陷报**。
- 本单**不新增**子任务行内的日期编辑 UI（未安排子任务仍可进详情页设日期）。
- 待清理死代码登记（另立清理批次）：`CreateTaskValueObject.fillStartAt()`（`create-task.ts:98`，零调用点）、`taskDetailsStore.taskDetails/setTaskDetails`（零调用点）、`LocalUserRepoImpl`。
- 其余沿用 v1.4.0 已登记遗留（错误文案 i18n、离线写入边界、fmt 基线、nue-ui 双版本等）。

[v1.4.1]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.1

## [v1.4.0] - 2026-09-10

发布批次：SHELL-02 桌面端同步状态并入侧栏轨道 + SHELL-03 离线可用性（离线白屏 / 门壳终态完备 / 同步状态运行级语义 / 离线进入路由与守卫 / 离线身份呈现）。Tag: `v1.4.0` · root `1.4.0` / `@nao-todo/shared` `1.2.0` / `@nao-todo/infrastructure` `0.2.0` / `@nao-todo/domain-identity` `1.1.0` / `@nao-todo/presentation-identity` `1.1.0` / `@nao-todo/desktopapp` `1.4.0`。

> 两单同日交付且交叉依赖已闭合（SHELL-02 的失败可见性依赖 SHELL-03 的运行级语义；SHELL-03 的离线壳依赖 SHELL-02 的轨道注入点），故合并为一个发布批次。明细见 [docs/prds/2026-09-10-desktop-sync-status-rail-merge.md](docs/prds/2026-09-10-desktop-sync-status-rail-merge.md) 与 [docs/prds/2026-09-10-shell-03-offline-availability.md](docs/prds/2026-09-10-shell-03-offline-availability.md)，约束与决策见 [docs/adr/](docs/adr/)。

### Added（新增功能）

- **轨道同步入口（SHELL-02）**：同步状态由「视口左下角悬浮层」改为「主侧栏 70px 轨道底部、齿轮上方」的常驻按钮（`NueTooltip` 标签 + `NueDropdown` 面板 + `NueButton` 立即同步），面板含上次同步时间 / 待推送 / 失败 / 错误摘要（2 行截断 + `title` 全文）；附 `aria-label`、`aria-expanded` 与常驻读屏活动区域（只播摘要，不播错误全文）；中英三处新增 `sync.*` 7 键。
- **离线身份呈现（SHELL-03）**：本地缓存**昵称**（白名单 `{userId, nickname, cachedAt}`，明文 localStorage、无 TTL、失败静默、解锁前可读）→ 首字母头像（复用 `NueAvatar` 的 `default` slot + 确定性哈希色块映主题令牌）+ 离线标识；新增 `@nao-todo/presentation-identity` 的 `UserInitialAvatar` 组件与 `identity.*` / `gate.*` 4 键。
- **桌面端实机测试基建**：`scripts/electron-smoke/`（CDP 驱动真实 Electron、零第三方依赖、凭据只走环境变量；含 `checks/` 断言脚本、`lib/` 驱动、人工对照单）。

### Fixed（缺陷修复）

- **设置齿轮被同步浮层遮挡（SHELL-02）**：浮层 `position:fixed; left:1rem; bottom:1rem` 与轨道底部齿轮同水平带，指针路径 100% 不可点。修复 = 归位到侧栏轨道布局。
- **`z-index:9999` 压模态（SHELL-02，连带）**：该值越过 Nue 弹层池基线 99，导致设置对话框开启时浮层仍浮在遮罩之上且可点。修复 = 移除该 z-index，面板改由弹层池承载。
- **离线冷启动白屏（SHELL-03 / DEF-OFFLINE-01）**：`unlock-gate.vue` 模板仅 `v-if checking / v-else-if profile` 两分支且 `profile` 仅内存（离线必缺失）、`loadUserProfile()` 返回元组不抛错（原 `try/catch` 永不触发）⇒ 渲染空。修复 = 显式终态机（`checking`/`ready`/`error` + `v-else` 兜底）+ 就绪判据只用本地事实（JWT / 密钥包 / 本地库）+ profile 降级为装饰。
- **拉取阶段失败被同一次运行清空（SHELL-03 / DEF-SYNC-01）**：`markSyncing()` 在两阶段开端均 `set({lastError:null})` ⇒ 面板失败态永不出现。修复 = 同步状态引入运行边界（`beginRun`/`noteRunError`/`endRun`）。
- **队列项全超限时假成功 + `syncing` 永久 true（SHELL-03 / DEF-SYNC-02）**：`pushBody`/`deletions` 皆空时直接 `return` 不结算；且未确认实体仅 `console.warn`。修复 = 所有入口 `try/finally` 必达结算 + 失败/超限/未确认计入运行错误。
- **`lastSyncAt` 失败也推进（SHELL-03 / DEF-SYNC-03）**：`markSynced()` 无条件写时间戳。修复 = 仅无错运行推进（面板「上次同步」在失败运行后不再刷新，属**修正**）。
- **「离线进入」落登录页死路（SHELL-03 / DEF-01）**：离线时 auth 守卫把「有 JWT 但未认证」强制推入检入页，检入离线必败又 `replace('/auth/signin')` ⇒ 壳不可达。修复 = 跳转唯一点归 `AppRoot`（先 `await replace` 再挂载）+ 守卫**四条件**本地事实放行 + 会话级内存 flag + 检入失败分类（网络类不再跳登录页、改页内可重试）。
- **损坏的昵称缓存未清键（SHELL-03 / DEF-02）**：解析/形状失败时直接 `return`，脏键长期留存（与 C-16 文档约定不符）。修复 = `removeItem` 后返回 null。
- **`LoadingError` 潜在空渲染（SHELL-03 / F-5）**：末支 `<slot v-else />` 在调用方未提供 default slot 时渲染空。修复 = 加安全兜底（最小空态占位）。
- **壳耦合：轨道被 `profile` 门住（SHELL-03 / F-6）**：`aside-v2.vue` 的 `v-if="profile"` 使导航/齿轮/同步入口在离线时全部消失。修复 = 轨道常驻 + 身份区仅作装饰降级（含抽屉分支）。
- **凭证类失败不得授予离线进入（SHELL-03 / 安全）**：避免用无效凭证进壳；凭证类失败时「离线进入」隐藏。

### Changed（行为与口径变更）

- 同步状态语义：`lastError` = 本次运行**首个错误阶段**的错误（仅新运行清空）；新增 `errors[]` / `errorCount`；删 `markSyncing()`；`start()`/`manualSync()`/`pullAll()`/`pushAll()` 返回 `SyncRunResult`；初始同步门改以返回值判成败。
- 门/壳就绪判据分层：网络装饰数据（profile/config）**不得**作为就绪或渲染条件；缺失用占位。
- auth 守卫新增四条件离线放行（flag + JWT 用户一致 + 本地会话一致 + 本地已解锁）；**未**使用 `navigator.onLine`、**未**使用昵称缓存；在线且凭证无效仍走 signin/checkin。
- 检入页失败分类：网络类不再跳 `signin`（页内可重试，含「重试」+「重新登录」）；凭证类保持跳 `signin`。
- 初始同步门失败态三键：「重试」+「离线进入」+「登出/重新登录」（会话失效时主按钮文案切「重新登录」）。
- `AppRoot` 的 `initialSynced` 更名 `gatePassed`（语义 = 门已通过，含离线进入）。
- 新增用户可见文案一律 i18n；**存量**硬编码中文（解锁/登出/重试等）本轮不动（登记遗留）。

### 质量门槛

- `vp test run` **53 文件 / 484 例全绿**（本批新增 58 例）；`vp check --no-fmt` **1000 文件 0 错 0 警**；`webapp` / `desktopapp` 构建通过；`guard:ddd` OK。
- QA 实机（Electron 43.4.1 / Chromium 150，CDP 真实命中 + 内嵌证据）：**SHELL-02 PASS 51 / FAIL 0**；**SHELL-03 复跑 PASS 17 / FAIL 0 / SKIP 0**（BC-6 采单测口径，登记为验证方法选择）；测试前后 hash 逐条一致（无不明写入）。
- 冻结基线：SHELL-02 6 文件 / SHELL-03 最终 41 文件 hash 见两份 PRD 归档。

### 已知遗留（非阻断）

- 错误文案 i18n（infrastructure 内硬编码中文，如「拉取失败：网络错误」）与「等 N 项」计数文案。
- 离线**写入**完整口径（本地写上限、超限暂停提示、回在线批量回传可见性）；`retryCount` 无重置路径 ⇒ 永久超限设备每次冷启动停在 failed（可「离线进入」）。
- 离线专属常驻 UI（顶栏/图标「离线」标识）；`apps/mobile` 同类壳耦合未扫。
- 昵称缓存白名单之外的字段（**头像图片/邮箱**）若需缓存须**重新评审**（ADR 明载：白名单扩展即「有条件可行」结论失效）。
- `isCredentialFailure` 依赖错误文案匹配（现由文案集固定保证）；更稳做法是 `SyncRunResult` 增显式标记。
- `LocalUserRepoImpl` 疑似死代码；`NueAside` 的 `v-model:displayed` 为惰性写法；nue-ui 双版本并存（web 1.11.0 / desktop 1.10.58）；全仓 oxfmt 基线漂移（v1.3.0 已记 860 文件，本批 846）。
- QA 本地 dev 账号 `probe@x.local`（后端无 DELETE 用户端点）与昵称 `QA-Shell03`，登记待清理。

## [v1.3.3] - 2026-09-09

发布批次：SHELL-01-DEF-01 生产缺陷修复。Tag: `v1.3.3` · 修复提交 `5bc18ecd` · root `1.3.3` / `@nao-todo/presentation-identity` `1.0.1` / `@nao-todo/presentation` `0.1.1`。

### Fixed（缺陷修复）

- **设置对话框切「修改密码」致背景任务列表置空（SHELL-01-DEF-01）**：浏览器凭据自动填充把已保存账号邮箱写入任务名筛选框 → `GET /tasks?name=<邮箱>` 空返回 → 列表空态。修复 = 双保险：改密表单三密码输入标注 `autocomplete=current-password/new-password`（源侧隔离，浏览器不再视其为登录表单）+ 任务名筛选框内层 input `autocomplete="off"`（受害字段屏蔽，一处覆盖 全部/项目/标签 三视图）；附组件级回归单测 5 断言。

### 质量门槛

- vp test 42 文件 / 419 例全绿（含新增 5）；lint 0 错；webapp 生产构建通过（terser）。
- 真实浏览器自动填充路径 headless 无法触发，由新增单测覆盖（符合「仅生产复现则以断言覆盖」条款）；生产实机复验以用户指示发布为终签。

### 已知遗留（非阻断）

- 个别浏览器密码管理器对 `autocomplete="off"` 的 username 填充可能不完全尊重——备用方案（筛选框失焦/弹层关闭清空 name 过滤）待业务语义拍板。
- 日历/搜索页等同类型无 autocomplete 文本输入的全站排查建议单独立项（SHELL-01 齿轮全站可用）。

## [v1.3.0] - 2026-09-07

发布批次：日历排期效率 / 导航体验 / 番茄专注徽标三线（`v1.2.0..v1.3.0` 共 13 提交）。Tag: `v1.3.0` · Release commit: `a945a06c` · root `1.3.0` / `@nao-todo/shared` `1.1.0`。

### Added（新增功能）

- **日历排期效率三件套（CAL-07）**：未安排任务批量安排（多选模式 / 今天 / 明天 / 选择日期，部分失败保留选中可重试）；任务条快速改期菜单（右键 + 悬停三点：今天 / 明天 / 下周同日 / 选择日期…）；拖拽排期（未安排行拖出即安排、已排期任务条拖拽 = T1 整体平移改期，5px 阈值消歧点击）；共享改期内核 `reschedule.ts`（T1 平移语义）+ U2「最近一次操作撤销」action-toast。
- **日历导航体验（CAL-08）**：键盘导航（`←/→` 翻页、`T` 今天、`M/W` 切视图、`Enter` 开当日面板、`N` 格内快建；弹层开启 7 键全抑制；输入框守卫；n/p 遮蔽与回退）；标题点击年-月面板跳转（月视图定位 / 周视图落含 1 号周，weekStart 边界）。
- **番茄专注徽标（CAL-09）**：月格 / 周列头显示当日完成番茄轮数（type=1 按 startAt 落日，0 隐藏、99+ cap，含孤儿记录）；侧栏「专注徽标」开关（默认开、localStorage 持久化、off 停拉）。

### Fixed（缺陷修复）

- done 行单行「安排到…」守卫越权变更恢复 B7（单条含 done 可历史回填；仅批量/多选排除 done）。
- 抽屉内「安排到…」菜单外点 / 再点触发器不关闭（外点豁免收窄至 .rmenu / 触发器 / 展开的日期面板）。
- 专注徽标"请求有、徽标无"集成缺陷（store.records 为 Map 被强转数组迭代 → `toTimerRecordList` 归一 + Map 形态集成回归测试）。
- 逾期任务条呈现改版：背景 `error-10`（hover/focus → `error-20`）+ 左缘条仅随优先级（用户两轮裁决定稿）。

### Changed（行为/口径变更）

- `deferToToday`（当日面板"延期到今天"）归入 T1 内核：带 startAt 逾期任务整窗平移至今天（原仅改 endAt 会拉长跨度）。
- 全局 `n`（新建任务）/`p`（新建项目）命令绑定 `index-view` scope（五子 tab 均覆盖，auth 页 inert，无用户可见回归）。
- `@nao-todo/shared`：`Command.available` 上下文新增可选 `event`（供 Enter 等目标守卫判定）。

### 质量门槛

- vitest 39 文件 / 410 用例全绿（含 41+ 组件/集成断言）；vp check 0 错 0 警；webapp / desktopapp 构建通过。
- QA 独立验收（A 线 63 条 / C 线 27 条 / B 线 22 条用例）+ 用户 dev / 桌面（Electron 同源）双端终签冒烟。

### 已知遗留（P3，非阻断）

- `calendar.arrange_*` / `nav_shortcut` / `focus_badge_impression` 埋点口径已定义、落地待基建批次。
- pomodoro records store 跨区间累积不清理（建议 eviction）。
- `?`（快捷键帮助）/ `⌘K`（命令面板）全局实装后需对 C1 键位冲突复测。
- oxfmt 全仓 860 文件格式漂移（存量，另立清理批次）。

[v1.3.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.3.0
[v1.3.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.3.3
[v1.4.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.0