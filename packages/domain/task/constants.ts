import type { TaskColumnOptions } from './types'

// 默认显示的列
export const defaultColumns: Record<keyof TaskColumnOptions, boolean> = {
    name: true,
    description: false,
    state: true,
    priority: true,
    startAt: false,
    endAt: true,
    project: true,
    tags: true,
    givenUpAt: false,
    starMarkAt: false,
    archivedAt: false,
    createdAt: false,
    updatedAt: true,
    deletedAt: false
}

// 待办事项状态序列号映射
export const stateSNMap = { todo: 1, 'in-progress': 2, doing: 2, done: 3 }

// 待办事项状态选项的反向映射
export const stateSNMapReverse = [null, 'todo', 'in-progress', 'done']

// 待办事项优先级序列号映射
export const prioritySNMap = { low: 1, medium: 2, high: 3 }

// 待办事项优先级选项的反向映射
export const prioritySNMapReverse = [null, 'low', 'medium', 'high']

// 待办事项创建器弹窗键
export const TASK_CREATOR_DIALOG_KEY = Symbol('task-creator-dialog')

// 待办事项提醒器弹窗键
export const TASK_REMINDER_DIALOG_KEY = Symbol('task-reminder-dialog')

