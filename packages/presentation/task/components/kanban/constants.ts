import { DEFAULT_TASK_PRIORITY, TASK_PRIORITIES, type TaskPriority } from '@nao-todo/domain-task'

// @constant 看板默认分组
const KANBAN_DEFAULT_GROUP_BY = 'state'

// @constants 看板 GroupBy 名称列表
const KANBAN_STATES = ['todo', 'in-progress', 'done']
// 优先级列 = domain 枚举的降序副本（单一来源 R1）⇒ 新增档位（如 urgent，T582）自动有列可落，不会凭空消失
const KANBAN_PRIORITY = [...TASK_PRIORITIES].reverse()
const KANBAN_GROUP_BY_NAMES = {
    state: KANBAN_STATES,
    priority: KANBAN_PRIORITY
}

// @method 优先级归类：白名单外的空值/脏值 ⇒ 默认档（「低」）
// 口径（PRD R3）：**读取时归类、写入时才归一** —— 归类不改写库中原值，只有拖拽落列时才写合法档位。
const normalizeKanbanPriority = (priority: unknown): TaskPriority =>
    TASK_PRIORITIES.includes(priority as TaskPriority)
        ? (priority as TaskPriority)
        : DEFAULT_TASK_PRIORITY

// @constant 看板组件上下文 Key
const TODO_KANBAN_CONTEXT_KEY = Symbol('TODO_KANBAN_CONTEXT_KEY')

// @exports
export {
    KANBAN_GROUP_BY_NAMES,
    KANBAN_DEFAULT_GROUP_BY,
    TODO_KANBAN_CONTEXT_KEY,
    normalizeKanbanPriority
}