# 看板卡片更新状态显示功能计划

## 1. 概述

### 1.1 背景

在看板视图中，用户可以通过拖拽卡片到不同列来更新任务状态。目前当用户触发更新后，没有视觉反馈显示任务正在处理中。

### 1.2 目标

- 当拖拽卡片并触发更新后，卡片显示为不可拖拽状态
- 降低正在更新卡片的可见度（透明度）
- 在卡片上显示"正在处理"等更新中状态的文字提示
- 更新完成后恢复正常状态

### 1.3 范围

- 看板组件相关文件
- 不影响列表视图、表格视图等其他视图

---

## 2. 现有功能分析

### 2.1 当前功能列表

| 功能             | 状态    | 说明                                    |
| ---------------- | ------- | --------------------------------------- |
| 拖拽卡片到不同列 | ✅ 已有 | 支持 HTML5 Drag & Drop API              |
| 更新任务状态     | ✅ 已有 | 通过 taskUseCase.updateTask 实现        |
| Loading 组件     | ✅ 已有 | packages/components/loading/loading.vue |

### 2.2 现有文件结构

```
components/tasks/kanban/
├── kanban.vue              # 看板主组件
├── kanban-column.vue       # 看板列组件
├── kanban-column-item.vue  # 看板卡片组件
├── use-kanban.ts           # 看板逻辑 Hook
├── use-kanban-dragger.ts   # 拖拽逻辑 Hook
├── types.ts                # 类型定义
└── kanban.css              # 样式文件
```

---

## 3. 新增功能设计

### 3.1 核心实现思路

1. 在 `use-kanban.ts` 中添加一个状态来跟踪正在更新的任务 ID
2. 当 `handleTaskDrop` 被调用时，将任务 ID 添加到更新状态集合中
3. 等待 `updateTask` Promise 完成后，从集合中移除该任务 ID
4. 在 `kanban-column-item.vue` 中接收 `isUpdating` prop
5. 根据 `isUpdating` 状态控制卡片的可拖拽性、透明度和提示文字

### 3.2 交互设计

1. 拖拽卡片到目标列并释放
2. 卡片立即显示更新状态：
    - 透明度降低（如 0.5）
    - 不可再次拖拽（draggable="false"）
    - 显示"正在处理..."提示
3. 更新完成后恢复正常状态

### 3.3 类型定义修改

#### 3.3.1 更新 `types.ts` 中的 TaskKanbanContext

```typescript
export type TaskKanbanContext = {
    // ... 现有字段
    updatingTaskIds: ComputedRef<Set<TaskViewObject['id']>>
}
```

#### 3.3.2 更新 TaskKanbanColumnItemProps

```typescript
export type TaskKanbanColumnItemProps = {
    task: TaskViewObject
    tags: TagViewObject[]
    actived?: boolean
    columns?: TaskColumnOptions
    isUpdating?: boolean
}
```

### 3.4 核心实现逻辑

#### 3.4.1 修改 `use-kanban.ts`

```typescript
// 添加正在更新的任务 ID 集合
const updatingTaskIds = reactive<Set<TaskViewObject['id']>>(new Set())

// 修改 handleTaskDrop 方法
const handleTaskDrop = async (taskId: TaskViewObject['id'], category: TaskViewObject['state']) => {
    const task = props.tasks.find((t) => t.id === taskId)
    if (task && task.state !== category) {
        // 添加到更新状态
        updatingTaskIds.add(taskId)
        try {
            await props.taskUseCase.updateTask(taskId, { state: category })
        } finally {
            // 更新完成后移除
            updatingTaskIds.delete(taskId)
        }
    }
}

// 提供给 context
provide<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY, {
    // ... 现有字段
    updatingTaskIds: computed(() => updatingTaskIds)
})
```

#### 3.4.2 修改 `kanban-column.vue`

```vue
<task-kanban-column-item
    v-for="task in columnTasks"
    :key="task.id"
    :is-updating="kanbanCtx.updatingTaskIds.has(task.id)"
    :draggable="!kanbanCtx.updatingTaskIds.has(task.id)"
    <!-- 其他 props -->
/>
```

#### 3.4.3 修改 `kanban-column-item.vue`

```vue
<!-- 添加 isUpdating prop -->
const props = defineProps<TaskKanbanColumnItemProps>()

<!-- 模板中根据 isUpdating 显示状态 -->
<nue-div
    class="todo-card"
    :class="{ 'todo-card--updating': isUpdating }"
    :draggable="!isUpdating"
>
    <!-- 现有内容 -->
    <nue-div v-if="isUpdating" class="todo-card__updating-overlay">
        <nue-text>正在处理...</nue-text>
    </nue-div>
</nue-div>

<!-- 样式 -->
<style scoped>
.todo-card--updating {
    opacity: 0.5;
    pointer-events: none;
}

.todo-card__updating-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.8);
    border-radius: inherit;
}
</style>
```

---

## 4. 实施计划

### 4.1 阶段一：类型定义更新

1. 更新 `types.ts` 添加 `updatingTaskIds` 到 `TaskKanbanContext`
2. 更新 `TaskKanbanColumnItemProps` 添加 `isUpdating` 字段

### 4.2 阶段二：状态管理实现

1. 修改 `use-kanban.ts` 添加 `updatingTaskIds` 状态
2. 修改 `handleTaskDrop` 为 async 函数
3. 集成更新状态到 provide context

### 4.3 阶段三：UI 组件更新

1. 修改 `kanban-column.vue` 传递 `isUpdating` 和控制 `draggable`
2. 修改 `kanban-column-item.vue` 接收并应用 `isUpdating` 状态
3. 添加更新状态的视觉样式

### 4.4 阶段四：测试

1. 测试拖拽更新功能
2. 验证更新状态显示
3. 验证更新完成后的状态恢复

### 4.5 文件变更清单

| 文件                     | 操作 | 说明             |
| ------------------------ | ---- | ---------------- |
| `types.ts`               | 修改 | 添加新类型定义   |
| `use-kanban.ts`          | 修改 | 添加更新状态管理 |
| `kanban-column.vue`      | 修改 | 传递更新状态     |
| `kanban-column-item.vue` | 修改 | 显示更新状态 UI  |
| `kanban.css`             | 修改 | 添加更新状态样式 |

---

## 5. 注意事项

### 5.1 技术要点

- 使用 `Set` 数据结构高效管理正在更新的任务 ID
- `handleTaskDrop` 需要改为 async/await 来等待更新完成
- 使用 `try/finally` 确保无论成功失败都会清除更新状态
- 使用 `pointer-events: none` 阻止更新中的卡片交互

### 5.2 兼容性

- 向后兼容现有代码
- 不影响其他视图功能

---

## 6. 验收标准

- [ ] 拖拽卡片到其他列后，卡片显示更新状态
- [ ] 更新中的卡片透明度降低
- [ ] 更新中的卡片不可拖拽
- [ ] 更新中的卡片显示"正在处理..."提示
- [ ] 更新完成后卡片恢复正常状态
- [ ] 无 TypeScript 类型错误

---

## 7. 时间线

| 阶段                 | 预估时间   |
| -------------------- | ---------- |
| 阶段一：类型定义更新 | 15 分钟    |
| 阶段二：状态管理实现 | 30 分钟    |
| 阶段三：UI 组件更新  | 45 分钟    |
| 测试和调试           | 30 分钟    |
| **总计**             | **2 小时** |