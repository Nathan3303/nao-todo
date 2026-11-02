# ADR：看板列内独立分页（列自持 loader + 父级注册表）

- 状态：已接受（待落地）
- 更新：2026-11-01
- Owner：arch-designer
- 指针：PRD `docs/prds/2026-11-01-kanban-column-paging.md` · 取证 `docs/reports/T618-def126-verification.md` · 评审 `T619`（arch 回执）

## 背景

- `DEF-126`：看板首屏 = **全部列合计 ≤20 条**（适配器只 `loadFirstPage`；列内 `loadMore` 空桩、`isDone` 恒真 —— `use-kanban-column.ts:11` / `:32`）⇒ 65 条实测「待办 20 / 进行中 0 / 已完成 0」假空，58 个已发行 tag 全带病。
- 用户 2026-11-01 定**方案 B**（每列各自分页，每页 20 条）；本地优先 ⇒ 分页在本地仓储完成，**零**服务端 / 同步契约改动；约束 = 三处页面同一实现（R-G）· 列条件与写路径同源（R-F）· 文案走 i18n（R-H）。

## 决策

1. 数据面：每列自持 `useTasksLoader`（`kanban/use-kanban-column.ts`）；`TaskKanban` 提供**列注册表**（`kanban/use-kanban-column-paging.ts`，`KANBAN_COLUMN_PAGING_KEY`）作为唯一编排入口（reset / 拖拽增量 / 新增任务）。
2. 契约：`TaskKanban` 增 `getTasksOptions` / `getTask(id)` / `refreshToken` / **`newTaskId`（`T621` 实施增量：命令通道，PM 2026-11-01 裁定接受 · **arch 2026-11-02 追认：有条件接受**，条件 C-1…C-4 见 `docs/adr/2026-11-02-nue-ui-upgrade-and-workaround-retire.md` 决策 4）** + emit `summaryChange`；**移除 `tasks` prop**（D5）；删除 `kanban-view-adapter` 的全局 `taskLoader`，外层 `loading-error` 只保留「整页空 / 整页错」，判据为聚合摘要（`settled && total === 0`），外层不再承担 loading。
3. 重置：`use-kanban.ts` 一处 `resetAllColumns()`，来源 = `refreshToken`（`RefreshData`）+ `getTasksOptions` 深监听；分组切换用 `:key="\`${groupBy}:${groupName}\`"` **结构性重置**，不加第三个 watch。
4. 一致性：拖拽成功后只做**本地增量**（目标列插 id + `total+1`、源列 `total−1`，源列置 `needsRefill` 于下次触底补回已加载区间）；`AddNewTaskId` 只向目标列**插入置顶** + `total+1`（D2）。
5. 分页语义：`limit=20`；列内 `isDone = page*limit >= total`；列头数字 = `pagination.total`；到底文案新增 1 个 i18n 键 `task.kanban.noMore`。

## 理由

- 业务匹配：AC2（列间隔离）与 AC3（列头总数）**只有**列级 loader 能达成；共享游标方案会保留「某列先满」的假空。
- 成熟度：`useTasksLoader` 已被 4 处独立实例化（table / list / kanban adapter / subtasks），列内复用同一 hook 不引新机制；注册表只是 handle 集合。
- 团队能力 / 成本：改动集中在 `kanban/` + 适配器；零 domain / 零契约 / 零持久化；每步可独立验收、单条 squash 可回滚。
- 可测：接缝仍是「真挂载 + stub `taskUseCase`」（`t608-kanban-harness.ts` 补 fake `list` / `getTask` / `refreshToken`），无需 provide 假 factory、无需 Pinia。

## 对照过的备选模式

1. **维持现状（全板一个 loader + 列内过滤 `props.tasks`）** —— 适用：不要求列间独立；代价：AC2 / AC3 结构性不可得（现状全列合计 ≤20）；不采纳。
2. **单 loader + 共享 `loadNextPage`（T618 §八.2 的修法建议）** —— 适用：只求「能翻页」；代价：列共享游标（某列看完才轮到别的列）、列头无列总数、假空仍在；不采纳（用户已选 B）。
3. **父级 factory 创建各列 loader 并 provide** —— 适用：要求父级独占 loader 生命周期；代价：`Map` 创建 / 销毁时序 + 测试须 provide 假 factory，收益仅「少一层 handle」；不采纳。
4. **列自持 loader + 父级注册表（采纳 ④）** —— 适用：状态须列内隔离且有统一编排入口；代价：多一个注入键与注册 / 反注册；采纳。
5. **第三个 `groupBy` watch（替代 `:key`）** —— 适用：列不重建；代价：旧列会先拿新 `groupBy` 查错字段再卸载（空转查询），且依赖 `state` / `priority` 列名互斥的巧合；不采纳，改 `:key` 显式化重建。
6. **拖拽后两列重查 / 整板刷新（替代本地增量）** —— 适用：无本地增量手段；代价：已加载页塌回第 1 页（用户已滚多页），整板刷新更差；不采纳 —— `taskUseCase.update` 已 patch Pinia store（`domain-task/src/application/usecases/task.ts:278`），增量即可一致。
7. **沿用共享 `isDone`（`res.taskIds.length < limit`）** —— 适用：列表 / 表格（保持不变）；代价：「恰好 20 条」判 false ⇒ 多一次空查询 + 到底文案晚一屏（AC9 / AC4 不过）；不采纳，列内覆盖为 `page*limit >= total`（不改共享 hook，其 4 个调用方在范围外）。

## 后果与风险

- 正面：每列可见该列全部任务；列头给筛选后总数；离线照常翻页；零服务端 / 同步契约改动、零移动端红线触碰。
- 风险①：`getTasksOptions` 含用户自选筛选（`state` / `priority`，三处 filter-dropdown 在写）⇒ 列条件若「覆盖」即静默绕过筛选。应对：**求交**（基础值不含本列 ⇒ 该列 0 条且不发请求）。
- 风险②：本地仓储 `priority` 为精确匹配（`task-repo-impl.ts:386-390`）⇒ 分列查库后白名单外脏值进不了「低」列（`t608-ac4` 回归）。应对（PM D1）：`priority` 含 `low` 时把 `prioritySNMap` 白名单外的值也当 low（零契约改动）；连带改变列表 / 表格「低」筛选结果 ⇒ 记 PRD 行为变化 + `v1.16.2` release notes「⚠️ 请留意」。
- 风险③：本地删 / 移后 page 偏移会跳过 1 条（`task-repo-impl.ts:453` 为 `slice((page-1)*limit,…)`）⇒ 源列 `needsRefill` 补回（D3，不容忍跳条）。
- 风险④：本地镜像可能不完整（`DEF-6` 已修：续拉至取尽、`mirrorTruncated` 如实标记，见 `sync-service.ts:899-928` / `sync-status.ts:207-217`）⇒ 不完整时「没有更多了」可能不绝对。判定为**与列表视图同级、非本单新增**；观察项登记 `DEF-126` 备注（D4：不新增第 2 文案键）。

## 限制与已知边界

- **硬约束 1（求交而非覆盖）**：列 options = 基础筛选 ∩ 列条件；求交为空 ⇒ 0 条且**不发查询**，禁止「先查再过滤」。
- **硬约束 2（`isDone` / loading 拆分）**：列内不使用共享 `isDone` 判据（改 `page*limit >= total`）；`loadingFirst` / `loadingMore` 必须分离，触底加载**不得**把整列换成加载态。
- 不覆盖：列表 / 表格视图分页 · 服务端契约与同步协议 · 整板全局分页 · 拖拽载荷键集合（`DEF-114` 已锁）· 移动端红线目录。
- 「列表侧按低筛选含脏值」属行为变化：不回填历史数据、不改服务端语义、不做数据迁移。

## 相关指针

- PRD `docs/prds/2026-11-01-kanban-column-paging.md`（§5 R-A…R-H · §7 AC1–AC10）· 取证 `docs/reports/T618-def126-verification.md`（量化 + 缺陷起点 `b55dd5b2`）
- 关联 ADR `docs/adr/2026-11-01-kanban-group-state-hoisting.md`（`KANBAN_GROUP_BY_KEY` 语义与位置不变）

## 参考来源

- 未检索到外部来源（结论来自本仓代码、PRD 与 `T618` 实测取证）。