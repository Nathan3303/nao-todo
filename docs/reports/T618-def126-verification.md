# T618 看板视图「滚动触底加载更多」失效 —— 复现与归因验证

- 状态：**判定 = 既有缺陷（非本批回归）** · `DEF-126` 保持 **P2**（不建议因本结论升级）· **不阻塞 `v1.16.1`**
- 日期：2026-11-01 · Owner：qa · 上下文：`T618`（诊断类，**只读 + 文档，未改源码、未改测试**）
- 被测版本：`v1.16.0` = `a0931fc6`（worktree `/tmp/t618-v1160`）· `v1.16.1` = `1ccca750`（worktree `/tmp/t618-cur`）；报告写作时 `main` = `1b922285`（`nao/def126-ledger`），`v1.16.1` tag 已打（`eb4511d2`）
- 用户原话：「表格视图有分页器，列表视图触底加载正常，就看板视图不行」⇒ 本轮实测**完全复现**这句描述。

## 一、结论（一句话可判）

**`DEF-126` = 既有缺陷**：看板视图自 **`b55dd5b2`（2026-04-14「实现看板视图功能」）起** 列内 `loadMore` 就是空函数、`states.isDone` 恒 `true`，页面适配器只 `loadFirstPage` 不接 `loadNextPage` ⇒ **全部 58 个已发行 tag（`v1.1.3` → `v1.16.1`）都带此缺陷**；`a0931fc6`（v1.16.0）与 `1ccca750`（v1.16.1）**逐项实测一致**（看板均卡在 20 条、列表与表格均正常）⇒ **不是本批 4 个提交引入的回归**，**不阻塞 `v1.16.1` 发布**。

## 二、受控对照（worktree + 双 dev，不碰主工作区）

```bash
git worktree add /tmp/t618-v1160 a0931fc6      # v1.16.0
git worktree add /tmp/t618-cur   1ccca750      # v1.16.1
# 依赖：两版 package.json 仅版本号字段不同（git diff --stat a0931fc6..1ccca750 -- package.json 'apps/*/package.json' 'packages/*/package.json' ⇒ 3 文件 3 行，pnpm-lock.yaml 零变化）
cd /tmp/t618-cur   && pnpm install --frozen-lockfile   # 1m01s（--offline 失败：store 缺 @vitejs/plugin-vue 6.0.8 的 tarball，故走联网一次，之后 v1160 侧 4.2s 复用）
cd /tmp/t618-v1160 && pnpm install --frozen-lockfile   # 4.2s
cd /tmp/t618-cur   && pnpm --filter @nao-todo/webapp exec vp dev --config vite.config.ts --port 5181 --strictPort
cd /tmp/t618-v1160 && pnpm --filter @nao-todo/webapp exec vp dev --config vite.config.ts --port 5180 --strictPort
```

- 端口：**5180 = v1.16.0 · 5181 = v1.16.1**（未占用 5173；两侧各自独立 `node_modules` 与独立 IndexedDB 源）。
- **CORS 处置（关键，口径要说清）**：后端 `http://localhost:3302` 只放行 `5173` origin ⇒ 5180/5181 直连浏览器会 `ERR_FAILED`（CORS 预检被拒）。实测用 **Playwright `page.route()` 在浏览器侧代理转发** `localhost:3302/**`（Node 侧 fetch 透传 `content-type` / `authorization`，回填 `Access-Control-Allow-Origin: <origin>` + `Allow-Credentials: true`）——**不改源码、不改 `.env`、不改后端**，请求/响应体逐字节透传，行为等价同源。
- 数据：全新建测试账号 + 后端 API 造数（`POST /api/tasks/`），登录后由 `syncService` 首次拉取进本地镜像（Dexie `nao-todo-desktop`），因此 UI 数据来自**本地库**（分页读本地仓储，**不产生 `/api/tasks` 请求**，故证据以 DOM/计数为准）。

## 三、两版 × 三视图实测对照（同一账号、同一数据集）

数据集 A：**45 条同状态（todo）**；数据集 B：**65 条 = 45 todo + 10 doing + 10 done**（B 用于暴露「空列谎报」）。每视图进入后先滚轮、再把所有可滚动容器连续 5 次滚到底（每次间隔 2.5s），记录条目数与 DOM 状态。

| 视图     | 版本                | 首屏条目 | 触底后条目                                                                                                               | 列内 infinite-scroll 状态                                                        | 判定               |
| :------- | :------------------ | :------- | :----------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- | :----------------- |
| **看板** | `a0931fc6`(v1.16.0) | **20**   | **20（不变）**                                                                                                           | 3 列全部渲染 `.nue-infinite-scroll__disable-bar` = 「**没有更多数据了**」        | **不加载（复现）** |
| **看板** | `1ccca750`(v1.16.1) | **20**   | **20（不变）**                                                                                                           | 同上，3 列均「没有更多数据了」                                                   | **不加载（复现）** |
| **列表** | `a0931fc6`          | 20       | **45**                                                                                                                   | 到底后出现「**45 条待办任务已全部加载完成**」（`disabled` 由真实 `isDone` 驱动） | 正常               |
| **列表** | `1ccca750`          | 20       | **45**                                                                                                                   | 同上                                                                             | 正常               |
| **表格** | `a0931fc6`          | 20 行    | 20 行（分页器翻页，非无限滚动）                                                                                          | 页脚「当前列表 20 项， 共计 45 项。 **第 1 页，共 3 页** 20 条每页」             | 正常               |
| **表格** | `1ccca750`          | 20 行    | 数据集 A：同上「第 1 页，共 3 页」；数据集 B（65 条）点「下一页」⇒ **第 2 页**（共 4 页），首行 = `T618 分页探针任务 21` | 翻页实测成功                                                                     | 正常               |

数据集 B（65 条，`1ccca750`，`:5181`）：

```text
看板 before/settled: 待办 20 / 正在进行 0 / 已完成 0   本地镜像 tasks = 65   disableBar 文案 = 没有更多数据了 ×3
列表 before → settled: 20 → 65                        disableBar 文案 = 65 条待办任务已全部加载完成
表格：当前列表 20 项， 共计 65 项。 第 1 页，共 4 页
```

⇒ **同一份本地数据（65 条）、同一台机器**：列表能到 65、表格能翻 4 页，**看板三列合计恒 20**，且**「正在进行」「已完成」两列显示 0（假空）**，尽管库里各有 10 条。

## 四、代码事实（行号为实测时 HEAD）

定位方式（三段阶梯）：① 原生入口 `codegraph_explore`（`useKanbanColumn / loadMore / isDone / useKanbanViewAdapter / loadFirstPage` ⇒ 一次拿到 `use-kanban-column.ts` 与 `use-task-loader.ts` 全文，并给出 `kanban-column.vue → loadMore` 的动态派发链）→ ② ③ `grep -n` 行段穷尽核对（`kanban-column.vue` / 两个适配器 / `use-task-loader.ts` 的 `limit`），历史考古部分走 `git show <commit>:<path>` 逐版本而非图谱（图谱只覆盖当前工作树）。

| 位置                                                                                                    | 事实                                                                                                                                                                                                              |
| :------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/presentation/task/components/kanban/use-kanban-column.ts:11` / `:29`                          | `states.isDone` 初始 `true`，`fetchTasks` 末尾又置 `true` ⇒ 恒真                                                                                                                                                  |
| `packages/presentation/task/components/kanban/use-kanban-column.ts:32`                                  | `const loadMore = async () => {}` —— **空函数**                                                                                                                                                                   |
| `packages/presentation/task/components/kanban/kanban-column.vue:31`                                     | `<nue-infinite-scroll @load-more="loadMore" :disabled="states.isDone" trigger-height="2px">` ⇒ **`disabled` 恒 true**（`nue-ui` 源码：`disabled` ⇒ 不 emit `loadMore`，并渲染 `__disable-bar`「没有更多数据了」） |
| `packages/presentation/task/components/view-adapters/kanban-view-adapter/use-kanban-view-adapter.ts:51` | 仅 `taskLoader.loadFirstPage(true)`，**无** `loadNextPage`；列数据 = 对这份 ≤20 条 `props.tasks` 做 filter（`use-kanban-column.ts:20-26`）                                                                        |
| `packages/presentation/task/components/view-adapters/list-view-adapter/use-list-view-adapter.ts:27-31`  | `handleNextPage → taskLoader.loadNextPage(false)`（对照组：列表为何正常）                                                                                                                                         |
| `packages/presentation/task/hooks/use-task-loader.ts:34` / `:188`                                       | `pagination.limit` 默认 **20**（`originalGetOptions?.limit ?? 20`；`reset()` 亦回落 20）                                                                                                                          |
| `apps/web/src/components/tasks/{built-in-project,project,tag}/main/index.vue`                           | **三处页面共用** `KanbanViewAdapter` ⇒ 影响面 = 任务页 / 清单页 / 标签页的看板视图                                                                                                                                |

## 五、代码史时间线（回答「看板历史上有没有分页」）

```text
$ git log -S "loadMore" -- packages/presentation/task/components/kanban
b51ea6ed refactor(domain): 重构代码结构…（仅“搬家”，空函数原样带过去）

$ git log -S "loadNextPage" -- packages/presentation/task/components/kanban
（无输出 = 该目录从未出现 loadNextPage）
```

逐提交核对（路径随重构迁移，故用 cat-file 逐版本取）：

| 提交                    | 日期                    | `loadMore` 实现                                        | 说明                                                                                                                                                           |
| :---------------------- | :---------------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `558133d6`              | 2025-12-31（temp 暂存） | `await loadAndPush({ state: props.category })`         | 列**自带 loader**，`loadReplace` 后 `isDone=false` ⇒ 当时是**真按列分页**                                                                                      |
| `f9b80959`              | 2026-03-05（temp 暂存） | 同上                                                   | 仍可用（WIP 状态）                                                                                                                                             |
| **`b55dd5b2`**          | **2026-04-14**          | **`const loadMore = async () => {}` + `isDone: true`** | **缺陷起点**：看板特性正式落地时列改为「对父级 props 做 filter」，分页被换成桩                                                                                 |
| `8a39bad8`              | 2026-07-16              | 空函数（照搬）                                         | DDD t2 重构，适配器亦只 `loadFirstPage`（`git show 8a39bad8:packages/domain/task/components/view-adapters/kanban-view-adapter/use-kanban-view-adapter.ts:56`） |
| `b51ea6ed`              | 2026-07-20              | 空函数（照搬）                                         | 迁至 `packages/presentation`                                                                                                                                   |
| `2ddb298f` … `1ccca750` | 2026-11                 | 空函数（未动）                                         | 本批 4 提交（`514d5013` / `7de06d58` / `254ddf6a` / `7046f2cc`）**均未触碰**该四文件                                                                           |

**发行口径**：仓库最早 tag = `v1.1.3`（2026-08-31，晚于缺陷起点），其文件即已含空函数（`git show v1.1.3:packages/presentation/task/components/kanban/use-kanban-column.ts:24` = `const loadMore = async () => {}`；同版适配器 `:51` 仅 `loadFirstPage`）⇒ **58 个 tag（`v1.1.3` → `v1.16.1`）全部带缺陷，已发行版本从未有过可用的看板分页**；更早的「按列分页」只存在于两条 `temp 暂存` WIP 提交里，**从未随任何 tag 发布**。

## 六、量化口径

| 项                      | 值                                                                                           | 依据                                                                                                                  |
| :---------------------- | :------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| 默认 `pagination.limit` | **20**                                                                                       | `use-task-loader.ts:34`（`:188` reset 亦 20）                                                                         |
| 看板首屏上限            | **全部列合计 ≤ 20 条**（**不是每列 20**）                                                    | 适配器只 `loadFirstPage(true)` 一次；列是对同一份 ≤20 条 `props.tasks` 过滤                                           |
| 实测（45 条同列）       | 待办列 **20**，不可见 **25**（**55.6%**）                                                    | 数据集 A                                                                                                              |
| 实测（65 条混合）       | 待办 **20** / 正在进行 **0** / 已完成 **0**，不可见 **45**（**69.2%**，含 10+10 条「假空」） | 数据集 B                                                                                                              |
| 188 条外推              | 最多可见 **20** ⇒ 不可见 **≥168**（**89.4%**）                                               | 188 为用户/PM 口径，qa 无法读取用户本机本地库；按同一上限线性外推（若某状态更靠后，其列可能整列为 0，实际不可见更多） |

**附带症状（用户可感）**：列底恒显示「**没有更多数据了**」——数据明明还有，文案在**说谎**，用户不会想到「其实是功能坏了」。

## 七、影响面

- **范围**：任务页 / 清单页 / 标签页三处**看板视图**（共用 `KanbanViewAdapter`）；桌面与 Web 同源同代码。
- **可绕过**：切列表（无限滚动正常）或表格（分页器正常）——**数据不丢、可编辑可达**，故**不是数据安全事故**。
- **用户感知**：任务数 > 20 的清单里，看板「只能看到 20 条」且部分列看起来是空的（实际有任务）；早期用户会怀疑「任务丢了」。
- **触发条件**：任一视图下本地任务 > 20 条即出现（188 条属重度触发）。

## 八、处置建议

1. **定级与发布**：维持 **P2**（有替代路径、无数据风险）；**不阻塞 `v1.16.1`**（已按此结论发布）。是否升 P1 由 PM 依「用户感知/口碑」裁量，技术依据上**无阻塞理由**。
2. **修法（建议最小改法，与列表对齐）**：
    - `use-kanban-view-adapter.ts` 暴露 `isDone` / `loading` / `nextPage = () => taskLoader.loadNextPage(false)`；
    - `kanban-view-adapter.vue` → `TaskKanban` 以 props/emit 透传，`provide` 进列（`TASK_KANBAN_CONTEXT_KEY` 已有先例）；
    - `use-kanban-column.ts` **删掉** `states.isDone` 桩与空 `loadMore`，改为调用注入的 `nextPage`；`kanban-column.vue:31` 的 `:disabled` 绑**真实的** `isDone`（不再恒真）；
    - 口径建议：**任一列触底 ⇒ 追加下一页**（共享分页，与列表同语义）；代价是「某列先满」时需多滚几次，但无需改查询结构。
3. **不建议**：恢复「每列独立 loader」（2026-03 WIP 设计）——语义更准但需三份查询 + 列级计数 + 与分组切换/拖拽写路径重新对齐，改动面远超收益。
4. **修好前可选的止血**：列底不显示「没有更多数据了」（即便功能未修，也别对用户说谎）；一行绑定即可，但属 UX 决策，需 PM 点头。
5. **验收建议（供 RD 修复后 QA 复用）**：① `loadNextPage` 被调用 ≤1 次/触底且 `isDone` 真时不再调用；② 65 条数据集下看板三列合计可增长到 65；③ 空列为真空（不因分页缺失而假空）；④ 与列表/表格同数据集条数一致。

## 九、测试环境与回滚（造数已完整回滚）

- 造数：本地 dev 后端（docker `naotodo-server` / MySQL `naotodo`）新建测试账号 `t618qa1793530017@example.com`（userId `486124941092065280`）+ **65 条任务**；浏览器侧本地镜像随 Playwright 上下文销毁（未落用户目录）。
- **回滚后逐表计数（全部 0）**：`tasks=0 · user_configs=0 · user_sessions=0 · sessions=0 · projects=0 · tags=0 · task_check_items=0 · task_comments=0 · pomodoros=0 · pomodoro_records=0 · project_preferences=0 · tag_preferences=0 · users=0`。
- **孤儿扫描（通用口径）**：`tasks LEFT JOIN users ⇒ 0` · `task_check_items LEFT JOIN tasks ⇒ 0` · `task_comments LEFT JOIN tasks ⇒ 0` · `projects LEFT JOIN users ⇒ 0`。
- 收尾：两个 dev server 已停（5180/5181 端口释放）、`git worktree remove --force /tmp/t618-v1160 /tmp/t618-cur` 完成（`git worktree list` 仅剩主工作区 + 3 个既有 `prunable` 的 `/tmp/nao-dist-*`，非本次产物）。仓库工作区：**未改任何源码/测试**；本报告为本单唯一新增文件。

## 十、遗留（三出口）

| #   | 遗留                                                           | 出口                                                 |
| :-- | :------------------------------------------------------------- | :--------------------------------------------------- |
| 1   | `DEF-126` 修复（看板接 `loadNextPage`，见 §八.2）              | **转办 rd-fe**（需 PM 排期；本单不含修复）           |
| 2   | 「没有更多数据了」误导文案（§八.4，功能修好即消失）            | **与 1 合并处理**（不单开）                          |
| 3   | `/tmp/nao-dist-*` 三个 `prunable` worktree（历史产物，非本次） | **接受**（与本单无关，PM 择机 `git worktree prune`） |

无其它遗留。