import { TASK_PRIORITIES } from '@nao-todo/domain-task'

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

// @constant 看板组件上下文 Key
const TODO_KANBAN_CONTEXT_KEY = Symbol('TODO_KANBAN_CONTEXT_KEY')

// @exports
export { KANBAN_GROUP_BY_NAMES, KANBAN_DEFAULT_GROUP_BY, TODO_KANBAN_CONTEXT_KEY }