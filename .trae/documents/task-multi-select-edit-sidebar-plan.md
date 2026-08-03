# 待办多选编辑侧栏实施计划

## 概述

复用现有 `shift+click` 范围多选机制，新增右侧浮动编辑侧栏（与任务详情同款 `<nue-drawer theme="float-aside">`），在多选状态下可对所选任务批量修改属性（优先级、状态、结束日期、清单、标签）或执行操作（删除/恢复、放弃/取消放弃）。

---

## 决策记录（grill-me 产出）

| 维度     | 决策                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 位置     | 右侧浮动抽屉（与 TaskDetails 视觉一致）                                             |
| 触发     | 仅 shift+click 范围多选（现有机制），不改键盘或加按钮                               |
| 行为     | 浮动覆盖，不挤压任务列表                                                            |
| 验证     | 软破坏性动作（删除/放弃）弹 NueConfirm；其它直接生效                                |
| 副作用   | 破坏性后自动清空选择；改属性后保留选择；批量中显示 loading；逐项容错（续行 + 总结） |
| 属性控件 | 直接单值应用（无 mixed-state 摘要）                                                 |
| 回收站   | 选中含已删除任务时禁用全部操作（按钮 + tooltip）                                    |
| 代码分层 | `presentation/task/multi-select` 新模块，复用 TaskHandler                           |
| 执行方式 | 逐任务循环调用 TaskHandler（不动 usecase）                                          |
| 视觉     | 镜像 `task-details` float drawer                                                    |
| 标签批量 | 两个按钮：添加 / 移除（沿用 NaoTagSelector）                                        |
| 挂载     | `apps/web/src/views/index/tasks/entry.vue` 与 `<task-details-adapter />` 并列       |
| 状态     | 绑定到既有 `selectRange`，范围非空即开、空即关                                      |

---

## 现状分析

### 已存在

- `packages/presentation/task/components/list/use-multi-select.ts` 等 3 个视图（list/table/kanban）已实现 `selectRange = { original, start, end }` 与 `showMultiSelectPanel(idx)`：

    - `click.stop.exact` → `handleClickTask`（打开详情）

    - `click.stop.shift.exact` → `showMultiSelectPanel(idx)`（以 original 为起点，idx 为终点确定范围并 emit）

    - emit payload：`{ selectedIds: TaskViewObject['id'][], selectRange }`

- ViewAdapter 层（`list-view-adapter.vue` / `table-view-adapter.vue` / `kanban-view-adapter.vue`）**没有**接收 `@showMultiSelectPanel`，emit 出去了但被丢弃——即"管线已就位，缺消费者"。

- `TaskHandler` 已具备：`update / updateTaskState / updateTaskPriority / updateTaskEndAt / delete / restore / giveUp / ungiveUp`，全部带 NueMessage 提示。

- 任务详情右侧抽屉位于 `apps/web/src/views/index/tasks/entry.vue`，`<nue-drawer theme="float-aside" span="min(100%,448px)" />` 模板可直接复用，**span 缩为 360px** 适配批量面板。

### 缺口

1. ViewAdapter 未消费 `@showMultiSelectPanel`。
2. 没有"打开多选面板"的事件总线/状态，drawer 无法知道何时显示。
3. 没有任何批量执行编排（loading / 容错 / 计数 / 总结）。
4. 没有"侧栏内容组件"。
5. NaoTagSelector 已有添加标签 UI，但没有"移除标签"对话（移除用 TaskDetails 中已存在的反向操作）。

---

## 架构调整方案

### 数据流

```
[list/table/kanban 行 shift+click]
        ↓ use-multi-select.showMultiSelectPanel(idx)
        ↓ emit('showMultiSelectPanel', { selectedIds, selectRange })
[view-adapter]   ← 新增 @showMultiSelectPanel 接收
        ↓ 转发到 app-level injected 'multi-select state'  （provide/inject）
[TaskMultiSelectAdapter]   ← 新组件，挂在 entry.vue
        ↓ 读 selectRange / selectedIds
        ↓ 决定 isOpen = (start !== -1 && end !== -1)
[TaskMultiSelectPanel]     ← 新组件，<nue-drawer> 内容
        ↓ 调 TaskHandler.* 逐项执行
        ↓ 完成后 emit 'close' / 'cleared'
```

**关键点**：drawer 不维护自己的 `selectedIds`，而是从注入的 `MULTI_SELECT_CONTEXT_KEY` 读取；该 context 由 `entry.vue` 中的 `<task-multi-select-adapter>` 持有并响应 `@showMultiSelectPanel` 事件。

### 注入的 Context（apps/web 层）

```ts
// apps/web/src/views/index/tasks/multi-select-context.ts
type MultiSelectContext = {
    isOpen: Ref<boolean>
    selectedIds: Ref<TaskViewObject['id'][]>
    selectRange: { start: number; end: number; original: number }
    openPanel: (payload: TaskListMultiSelectPayload) => void
    closePanel: () => void
    clearRange: () => void
}
```

`clearRange` 调 `use-multi-select` 的 `clearMultiSelect(true)`。由于各视图的 `use-multi-select` 是局部 hook，需要在 ViewAdapter 上额外加一个 `@clear-multi-select` 事件，由 adapter 转发到对应 `useTaskList/Table/Kanban` 实例调 `clearMultiSelect(true)`。

---

## 实施步骤

### 1. ViewAdapter 增加 @showMultiSelectPanel / @clear-multi-select 事件

**文件**：

- [packages/presentation/task/components/view-adapters/list-view-adapter/list-view-adapter.vue](file:///c:/Users/LEE19/Projects/nao-todo/packages/presentation/task/components/view-adapters/list-view-adapter/list-view-adapter.vue)

- [packages/presentation/task/components/view-adapters/table-view-adapter/table-view-adapter.vue](file:///c:/Users/LEE19/Projects/nao-todo/packages/presentation/task/components/view-adapters/table-view-adapter/table-view-adapter.vue)

- [packages/presentation/task/components/view-adapters/kanban-view-adapter/kanban-view-adapter.vue](file:///c:/Users/LEE19/Projects/nao-todo/packages/presentation/task/components/view-adapters/kanban-view-adapter/kanban-view-adapter.vue)

**改动**：

- `<task-list/table/kanban>` 增加 `@show-multi-select-panel` 与 `@clear-multi-select` 监听并 emit

- `task-list`/`task-table`/`task-kanban` 已存在 `@showMultiSelectPanel` emit，只要把 emit 透传出来即可

- 新增 emit（仅 adapter 上层）：`'multiSelectChanged'(payload: TaskListMultiSelectPayload)` 与 `'clearMultiSelect'()`

**为何这样改**：保留 list/table/kanban 内部 hook 不变，把"打开侧栏"的需求上提一层到 ViewAdapter 与 apps/web，由 context 统一管理。零侵入到 use-multi-select。

---

### 2. 新增 `presentation/task/multi-select` 模块

**目录**：`packages/presentation/task/components/multi-select/`

**文件**：

| 文件                             | 角色                                                   |
| -------------------------------- | ------------------------------------------------------ |
| `index.ts`                       | 导出 `TaskMultiSelectPanel`                            |
| `types.ts`                       | `MultiSelectContext` / `BatchOpResult` / props / emits |
| `use-task-multi-select-panel.ts` | 编排批量动作（loading、容错、summary）                 |
| `task-multi-select-panel.vue`    | 抽屉 + 内容布局（不持有数据，仅消费 context）          |
| `use-batch-executor.ts`          | 实际逐项循环调用 `TaskHandler` 的执行器                |

**核心设计**：

```ts
// types.ts
type BatchOpResult = {
    total: number
    succeeded: number
    failed: number
    errors: Array<{ taskId: string; error: string }>
}

type MultiSelectPanelProps = {
    taskHandler: TaskHandler // 注入以调单任务动作
    avaliableProjects: TaskProjectViewObject[]
    avaliableTags: TaskTagViewObject[]
}

type MultiSelectPanelEmits = {
    (e: 'close'): void // 用户主动关闭
    (e: 'cleared'): void // 破坏性后自动清空请求
}
```

```ts
// use-batch-executor.ts —— 纯函数风格，单一职责
export const useBatchExecutor = (taskHandler: TaskHandler) => {
    const isRunning = ref(false)
    const run = async <K extends keyof BatchOpMap>(
        op: K,
        taskIds: string[],
        payload?: BatchOpMap[K]['payload']
    ): Promise<BatchOpResult> => {
        isRunning.value = true
        const errors: BatchOpResult['errors'] = []
        let succeeded = 0
        for (const id of taskIds) {
            try {
                const err = await taskHandler[op](id, payload as never)
                if (err) errors.push({ taskId: id, error: String(err) })
                else succeeded++
            } catch (e) {
                errors.push({ taskId: id, error: String(e) })
            }
        }
        isRunning.value = false
        return { total: taskIds.length, succeeded, failed: errors.length, errors }
    }
    return { isRunning, run }
}
```

注：单任务 handler 已自带 NueMessage 提示。批量执行时**关闭单任务提示**改为汇总一次（在 `use-task-multi-select-panel` 里用 `taskHandler.silent = true` 或者新增一个 `batch` 标志位 —— 选择**新 flag** 以避免影响其他调用方）。

**`use-task-multi-select-panel.ts`** **要点**：

- 接受 props + inject 的 `MultiSelectContext`（读 `selectedIds`、`isOpen`、调 `closePanel` / `clearRange`）

- 计算属性：

    - `selectedTasks`：从 `taskHandler.taskUseCase.taskStore` 取出当前 store 中匹配 `selectedIds` 的 TaskViewObject

    - `hasTrashedTask`：任一 isDeleted

    - `actionsDisabled`：hasTrashedTask 或 isRunning

- 8 个动作方法，每个都走 `run(op, ids, payload)` → 返回 `BatchOpResult` → `NueMessage.summary`

- 破坏性动作（delete / giveUp）前弹 NueConfirm（count 信息来自 selectedIds.length）

- 破坏性动作完成且 succeeded > 0 → emit `'cleared'`（让 context 自动 clearMultiSelect(true) + close）

**`task-multi-select-panel.vue`** **结构**：

```
<nue-drawer v-model="isOpen" theme="float-aside" span="min(100%,360px)" @after-leave="...">
    <nue-container>
        <nue-header>
            <nue-text>批量编辑</nue-text>
            <nue-text muted>已选 {{ selectedIds.length }} 项</nue-text>
            <nue-button icon="close" @click="closePanel" />
        </nue-header>
        <nue-main>
            <section title="属性">
                <PriorityGroup :disabled="actionsDisabled" @set="(p) => batch('updateTaskPriority', p)" />
                <StateGroup :disabled="actionsDisabled" @set="(s) => batch('updateTaskState', s)" />
                <EndAtGroup :disabled="actionsDisabled" @set="(d) => batch('updateTaskEndAt', d)" />
                <ProjectGroup :disabled="actionsDisabled"
                              :projects="avaliableProjects"
                              @set="(pid) => batch('update', { projectId: pid })" />
                <TagGroup :disabled="actionsDisabled"
                          :tags="avaliableTags"
                          @add="(ids) => batch('addTags', ids)"
                          @remove="(ids) => batch('removeTags', ids)" />
            </section>
            <nue-divider />
            <section title="操作">
                <DangerRow :disabled="actionsDisabled" @delete="confirmDelete" @restore="batch('restore')" />
                <DangerRow :disabled="actionsDisabled" @giveup="confirmGiveUp" @ungiveup="batch('ungiveUp')" />
            </section>
        </nue-main>
        <nue-footer v-if="isRunning">
            <nue-text muted>正在更新 {{ progress }}...</nue-text>
        </nue-footer>
    </nue-container>
</nue-drawer>
```

风格遵循 `task-details/details.vue` 的 nue-container + header/main/footer 三段式，以及 `task-details/footer/index.vue` 的 InnerDropdownOption + DropdownDivBlock 视觉语言（按钮使用 `theme="icon,ghost,pure"` 之类）。

**关于 addTags / removeTags 的 handler**：当前 `TaskHandler.update` 接收 `tags: string[]`（整体替换）。为了"添加"与"移除"，需要在 use-case 上加一个**读 → 合并 → 写**的辅助方法，或在 hook 里直接 `get` 当前 task.tags 后合并再 `update`。**选择后者**（hook 内合并），避免改动 domain/usecase 层。

---

### 3. 在 apps/web 层创建 MultiSelectContext 并挂载 Adapter

**新建**：

- [apps/web/src/views/index/tasks/multi-select-context.ts](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/views/index/tasks/multi-select-context.ts) — context 定义

- [apps/web/src/views/index/tasks/multi-select-adapter.vue](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/views/index/tasks/multi-select-adapter.vue) — 持有 `isOpen` / `selectedIds` / `selectRange`，监听 `viewAdapter` 上抛的 `@multi-select-changed` 与 `@clear-multi-select`，渲染 `<task-multi-select-panel>`

**修改**：

- [apps/web/src/views/index/tasks/entry.vue](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/views/index/tasks/entry.vue) — 引入 `<task-multi-select-adapter />` 并 `provide(MULTI_SELECT_CONTEXT_KEY, ...)`

**为什么在 entry.vue**：单个 context 覆盖 `/tasks` 下所有子路由（built-in / project / tag / search）。用户切换 viewType（list/table/kanban）时 selectRange 在各视图局部 hook 内，需由 ViewAdapter 主动 emit 上来。context 不持有范围，只持有"打开状态 + 选中 ID 列表"。

**Router 视图层挂载**：所有经过 `tasks-view` 的子路由（built-in project / project / tag）共用同一 entry.vue，搜索页（`/search`）和首页 tasks 都走同一壳，无需重复挂载。

**ViewAdapter → entry 的事件桥**：view-adapter 自身在哪个子路由里就 emit 给谁的父组件。最直接做法是在每个 view 入口的 wrapper（`apps/web/src/components/tasks/{built-in-project,project,tag}/main/index.vue`）上接收并 `emit('multiSelectChanged', payload)`，最后由 entry.vue 上的 `<task-multi-select-adapter>` 接收。或者在 `apps/web/src/views/index/tasks/entry.vue` 内部用 `provide + inject`，让 wrapper 通过 inject 拿到的 `MultiSelectContext` 写入。**选择后者**（少一层事件传递），具体：

- entry.vue `provide(MULTI_SELECT_CONTEXT_KEY, ctx)`

- 各 wrapper 通过 `inject` 拿到 `openPanel / clearRange`

- wrapper 在其 `ViewAdapter` 上加 `@show-multi-select-panel="ctx.openPanel"` 与 `@clear-multi-select="ctx.clearRange"` 监听

---

### 4. 阻止破坏性动作跨越回收站

在 `use-task-multi-select-panel` 中计算 `hasTrashedTask`，并把该布尔值传为 `:disabled` 到所有 `<InnerDropdownOption>` / `<nue-button>` 组件。在 `batch()` 入口处加 `if (actionsDisabled) return`，并对每个按钮挂 `tooltip="包含已删除任务时无法操作"`。

---

### 5. 单一职责：执行 vs 编排

- `use-batch-executor.ts` 单纯跑循环，不碰 UI。

- `use-task-multi-select-panel.ts` 负责 confirm、loading、summary 消息、emit 'cleared'。

- Vue 组件只负责布局与事件转发。

这样保持与既有 `task-details/use-task-view-object.ts` + `task-details.ts` + `details.vue` 三段拆分一致。

---

## 文件变更清单

### 新增

| 路径                                                                                | 作用                  |
| ----------------------------------------------------------------------------------- | --------------------- |
| `packages/presentation/task/components/multi-select/index.ts`                       | 桶导出                |
| `packages/presentation/task/components/multi-select/types.ts`                       | 类型                  |
| `packages/presentation/task/components/multi-select/use-batch-executor.ts`          | 批量执行器            |
| `packages/presentation/task/components/multi-select/use-task-multi-select-panel.ts` | 编排 hook             |
| `packages/presentation/task/components/multi-select/task-multi-select-panel.vue`    | 抽屉 UI               |
| `apps/web/src/views/index/tasks/multi-select-context.ts`                            | context 定义 + 注入键 |
| `apps/web/src/views/index/tasks/multi-select-adapter.vue`                           | 持有状态 + 渲染 panel |

### 修改

| 路径                                                                                              | 改动                                                                                    |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/presentation/task/components/view-adapters/list-view-adapter/list-view-adapter.vue`     | 透传 `@showMultiSelectPanel` → `@multi-select-changed`，新增 `@clear-multi-select` 监听 |
| `packages/presentation/task/components/view-adapters/table-view-adapter/table-view-adapter.vue`   | 同上                                                                                    |
| `packages/presentation/task/components/view-adapters/kanban-view-adapter/kanban-view-adapter.vue` | 同上                                                                                    |
| `apps/web/src/views/index/tasks/entry.vue`                                                        | 引入并 provide context、挂载 `<task-multi-select-adapter />`                            |
| `apps/web/src/components/tasks/built-in-project/main/index.vue`                                   | inject context，转发事件                                                                |
| `apps/web/src/components/tasks/project/main/index.vue`                                            | 同上                                                                                    |
| `apps/web/src/components/tasks/tag/main/index.vue`                                                | 同上                                                                                    |

（搜索页 `apps/web/src/views/index/search/entry.vue` 不属于 tasks 视图，按用户使用路径暂不涉及；如果搜索也用 task-list，需要在那边也加一个 @multi-select-changed 透传；v1 范围内仅 tasks 视图。）

---

## 关键设计取舍

1. **不新增 usecase.batchUpdate**：保持领域层不变，沿用 TaskHandler 逐项执行。优点：零后端耦合、改动小；缺点：N 次网络请求。对个人用户量级 OK。
2. **selectRange 仍由各视图局部 hook 持有**：context 只缓存 `selectedIds` 与 `isOpen`，不复制范围对象。这样切换 viewType 时旧范围的 isInMultiSelectRange 自然失效（行不存在），但 selectedIds 仍可能匹配到新视图的任务 → drawer 保持打开但内容合理（仍显示选中的 TaskViewObject）。
3. **关闭 drawer 行为**：用户按 Esc / 点 overlay / 点关闭按钮 → `closePanel()`，把 `isOpen = false` 但**不**清 selectRange；这样用户重开 drawer 仍能继续操作。"破坏性动作完成后"才调 `clearRange(true)` 清零。
4. **addTags/removeTags 在 hook 内合并**，不污染 domain。代码量小、可控。
5. **每任务 handler 提示的静默**：新增 `TaskHandler` 实例的 `silent` 局部开关，批量调用时设为 true，避免 N 条 NueMessage 刷屏。`silent` 不暴露给外部 API，只在 `use-batch-executor.ts` 内对单个 handler 实例设置。
6. **NaoTagSelector 复用**：添加标签直接打开现有的选择器，把"确认"动作换成"批量写入"（保留单任务的 onSelect 调用方式，但用 selectedIds 替代单 id）。
7. **不引入"全部/部分"摘要**：用户决定 = 直接应用。混合值时直接覆盖为用户选定的值。
8. **drawer width 360px**：比 task-details 的 448px 窄，节省屏幕。

---

## 验证步骤

每一步均可在浏览器中肉眼验证：

1. **进入多选**：

    - 在 list/table 视图按住 shift 点击第 1 行，再 shift 点击第 5 行 → 期望：5 行高亮 + 右侧 drawer 滑入，header 显示"已选 5 项"。

2. **优先级**：

    - 点 drawer 内的"高优先级"按钮 → 期望：5 个任务全部更新为高，drawer 保持打开，store UI 立刻反映。

3. **状态**：类似，但 1 个原本已 done 的任务也会被覆盖。
4. **结束日期**：点日期选择器选 2026-09-01 → 期望：5 个任务的结束日期全部更新。
5. **清单**：选某清单 → 期望：5 个任务的 projectId 全部更新。
6. **添加标签**：点"+ 标签" → NaoTagSelector 弹出 → 选 2 个标签 → 期望：5 个任务的 tags 数组并集后写入。
7. **删除**：点删除 → NueConfirm "确认删除 5 个任务？" → 确认 → 期望：5 个任务移入回收站，drawer 自动关闭，选择范围被清空。
8. **恢复**：在 trash 视图多选 3 个已删除任务 → 期望：drawer 打开，但所有按钮 disabled + tooltip "包含已删除任务时无法操作"（因为"含已删除任务"规则在 7 的破坏性后，selection 已清；这条用例应是：**先恢复选择 → 但选择项 isDeleted=true** → drawer 按钮全 disabled）。需手动验证：进入 trash 视图，shift+click 两个已删除任务 → drawer 打开但所有按钮 disabled，提示"包含已删除任务时无法操作"。
9. **放弃 / 取消放弃**：选 2 个未放弃任务 → 点"放弃" → confirm → 期望：givenUpAt 更新；选 2 个已放弃任务 → 点"取消放弃" → 直接生效。
10. **esc 关闭 + 重开**：drawer 打开后按 Esc → drawer 滑出但选择范围保留。再 shift+click 同一区间 → drawer 重新出现。
11. **错误容错**：人为把其中一个 taskId 改为不存在的 ID（开发时 mock），执行任意批量 → 期望：成功的更新，失败的进入 errors 数组，summary 提示"已更新 4/5，1 个失败"。

### 自动化

本项目尚无 ViewAdapter 的单测，多选 hook 已有逻辑且未改。建议在 `use-batch-executor` 上加最少 1 个单元测试：

```ts
// packages/presentation/task/components/multi-select/__tests__/use-batch-executor.test.ts
it('continues on per-item error and reports summary', async () => {
    const handler = new TaskHandler(...) // mock
    handler.update = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('err')
    const { run } = useBatchExecutor(handler)
    const res = await run('update', ['t1', 't2'])
    expect(res.succeeded).toBe(1)
    expect(res.failed).toBe(1)
})
```

跑 `vp test` 验证。

---

## 风险与边界

- **路由切换后范围残留**：选择后切换到 search 路由 → list/table 已卸载 → 切回时 selectRange 是新 hook 实例（空）。drawer 因 selectedIds 仍持有 ID 可能继续显示。若不希望残留，**watch route 变化 → 自动 closePanel + clearRange**。计划在 `multi-select-adapter.vue` 加 `watch(() => route.fullPath, ...)`。

- **大量选择导致 N 次请求**：暂不优化，作为已知限制。

- **Kanban 视图多选**：当前 `use-multi-select` 在 kanban 也有（按设计对称），但 Kanban 行内 shift+click 的 UX 不如 list/table 自然。v1 不专门优化，沿用现有 hook；若发现体验差再迭代。

---

## 验收标准

1. shift+click 多选 → 右侧 drawer 自动出现。
2. 8 类动作（priority / state / endAt / project / addTags / removeTags / delete / restore / giveUp / ungiveUp）全部可用。
3. 破坏性动作（delete / giveUp）弹 NueConfirm；其他动作直接生效。
4. 含已删除任务时所有按钮 disabled。
5. 批量执行有 loading 态 + 续行容错 + 汇总提示。
6. 破坏性动作完成后 drawer 自动关闭 + 选择清空。
7. 属性修改后选择保留。
8. 路由切换后 drawer 自动关闭、选择清空。
9. 视觉与 `<task-details-adapter />` 一致（nue-drawer theme=浮 aside）。
10. `vp check` 与 `vp test` 通过。