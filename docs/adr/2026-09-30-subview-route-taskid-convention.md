# 2026-09-30 子视图路由「可选 `:taskId`」统一约定 ADR —— 切换子视图不得重置任务详情面板

- **日期**：2026-09-30
- **状态**：✅ **已采纳并落地**（番茄页；其余视图核查后**无需改动**）
- **任务**：`T450` / `T451`（番茄专注页面优化 · 第 2 项）
- **触发**：用户报告 —— 「**路由优化：各子视图切换不应导致任务详情面板重置（`:taskId?`）**」
- **依据**：`apps/web/src/views/index/*/routes.ts` 现状核查 · `views/index/task-details-location.ts` · `TaskDetailsAdapter` 挂载位置 · 用户裁定「**search 页面没有这个问题，只有番茄页有，先修番茄页**」
- **硬约束**：不改服务端契约 · 移动端零改动 · 不扩大到未授权页面 · 不引入 store 侧面板状态（保持路由真源）

---

## 0. 结论

**凡支持「任务详情下钻」的子视图，其叶子路由必须带可选参数 `:taskId?`；任务详情面板挂在其父级（`<router-view>` 之外），由 `route.params.taskId` 驱动。**

于是：子视图之间切换时 `taskId` 稳定 ⇒ 面板**不卸载**、同 `taskId` **不重复初始化** ⇒ 已加载内容（任务 / 评论 / 检查项 / 子任务）得以保留；深链 `/<subview>/<taskId>` 可直达、刷新仍打开。

番茄页是本仓**唯一缺口**（`pomodoros` / `records` 两条叶子缺 `:taskId?`），已补齐。

## 1. 问题与机制

- 现象：在番茄钟页打开某任务详情后，切到「常用专注」或「专注记录」，**详情面板重置**（内容回到空态）
- 机制：目标路由（`pomodoro-collection` / `pomodoro-records`）**路径上没有 `:taskId` 段** ⇒ 参数在目标路由**不存在** ⇒ `route.params.taskId` 变 `undefined` ⇒ 面板关闭 / 重新初始化
- 反向验证（⚠️ **该推断已于 2026-09-30 被实测证伪，见 §7**）：曾假定 `tasks` 视图切换使用**同名** `router.replace` ⇒ vue-router 会**补齐缺失 params** ⇒ `tasks` 未暴露同类问题；**实测不成立**（`/tasks/all/table/t1` 切「列表」⇒ `/tasks/all/list`，`taskId` 丢失）

## 2. 事实核查（2026-09-30，逐视图）

- **`tasks`**：三条主叶子已带 `:viewType(table|list|kanban)/:taskId?`；⚠️ 但**视图切换走同名 `replace` 时会丢 `taskId`**（同日实测，原「参数不丢」的判断**已证伪**）⇒ 详见 §7 修正记录
- **`calendar`**：三条叶子已带 `:taskId?`
- **`search`**：`search/:taskId?` 已带 ⇒ 与用户实测「没有这个问题」一致
- **`pomodoro`**：仅 `:type(timer|focus)/:taskId?` 带；`pomodoros`（`pomodoro-collection`）与 `records`（`pomodoro-records`）**缺** ⇒ **唯一缺口**
- **面板挂载**：`views/index/pomodoro/entry.vue` 的 `<task-details-adapter />` 位于 `<router-view>` **之外**（页面级）⇒ 子路由切换**不会卸载**它；`details.vue` 以 `watch(taskId, initialize, { immediate: true })` 驱动 ⇒ **值不变则不重初始化**

## 3. 决策

1. 叶子路由补可选参数：`pomodoros/:taskId?`、`records/:taskId?`
    - **不新增 `props: true`**：详情适配器直读 `route.params`，集合页 / 记录页组件本身不声明该 prop（避免无意义 prop 透传）
2. 子视图导航（侧栏 `nue-link`）由字符串改为**对象路由**，并透传**当前** `taskId`（无则不传）
3. `taskDetailsLocation` / `closeDetails` / `switchTaskDetails` **不改**（新增可选参数后自然成立）
4. 面板保持**父级挂载**（⛔ 不在子视图内重复挂载）

## 4. 后果 / 影响

- **正面**：切子视图保留面板与已加载内容；深链可直达；刷新保持；关闭面板仍会清理参数
- **约束（后续开发必须遵守）**：**新增的支持任务详情下钻的子视图，必须同样带 `:taskId?` 且把面板挂在父级**，否则会重现同类缺陷
- **边界行为**：无 `taskId` 的深链 ⇒ 面板关闭（预期）· 非法 `taskId` ⇒ 既有空态提示，不崩 · 关闭面板 ⇒ 参数被清理

## 5. 备选与不采纳

- **全站同修**：核查后**无必要**（其余视图已具备参数）⇒ 不扩大范围（用户裁定仅修番茄页）
- **把详情面板放进各子视图**：切换即卸载 ⇒ 直接排除
- **用 store 保存面板态**：破坏深链 / 刷新语义（与「路由为真源」冲突）⇒ 不采纳

## 6. 遗留

- **一致性回归**：已加源级断言覆盖 `calendar` / `search` / `tasks` 的 `:taskId?` 仍在
- 若将来某页面**有意不挂父级面板**（例如全屏详情）⇒ 需在本 ADR 追加**例外说明**

## 7. 修正记录（2026-09-30，`T474` 审计后）

**被证伪的论断**：§2 曾写「`tasks` 视图切换使用**同名** `router.replace`（vue-router 对同名路由会**补齐缺失 params**）⇒ 因此 `tasks` 未暴露同类问题」。

**实测结论（真实 vue-router，`T474` 审计）**：**不成立** —— 在 `/tasks/all/table/t1` 打开任务详情后执行 `replace({ name: 'tasks-built-in-project-main', params: { viewType: 'list' } })` ⇒ 结果为 `/tasks/all/list`，**`taskId` 被丢弃**（`projectId` 因属**父记录**而保留）。

**因此修正 §0 的适用范围**：本约定不仅适用于「叶子缺 `:taskId?`」的视图（番茄页），**同样适用于「切换子视图时未透传当前 `taskId`」的视图** ⇒ 二者是**同一约束的两个失效面**。

**修复（`PR #169` 合并 `74cd0d7a`）**：三处 `switchViewType` 显式透传当前 `taskId`（`params: { viewType, taskId: route.params.taskId }`）；**共存关键 = `undefined` 省略可选参数段** ⇒ 既保留「切视图不丢参数」，又不破坏「`closeDetails` 仍能清参数」（行为用例已证）。

**新增约束（后续开发）**：任何「切换子视图 / 同层视图」的导航入口，**必须显式透传当前 `taskId`**；不得依赖「同名路由自动补齐参数」（已证伪）。寄存器级回归断言见 `apps/web/src/views/index/__tests__/subview-taskid-convention.test.ts` 与 `components/tasks/__tests__/view-switch-keeps-taskid.test.ts`。

**回归结论（同批核查）**：`calendar`（异名路由 + `resolveViewSwitch` 显式 `params: taskId ? { taskId } : {}`）与 `pomodoro`（路径字符串拼接）**均无此问题**；`tasks-view.ts` 的「项目被删后重置到 `/tasks/all`」属**有意重置**，非缺口。