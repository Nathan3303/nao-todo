// 待办事项状态白名单（领域真相，唯一来源）
export const TASK_STATES = ['todo', 'in-progress', 'done'] as const
export type TaskState = (typeof TASK_STATES)[number]

// 待办事项优先级白名单
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

// 待办事项提醒重复类型白名单
export const TASK_REMIND_REPEATS = ['none', 'daily', 'weekly', 'monthly'] as const
export type TaskRemindRepeat = (typeof TASK_REMIND_REPEATS)[number]

// 待办事项默认兜底值
export const DEFAULT_TASK_STATE: TaskState = 'todo'
export const DEFAULT_TASK_PRIORITY: TaskPriority = 'low'
export const DEFAULT_REMIND_REPEAT: TaskRemindRepeat = 'none'

// 待办事项名称与描述长度上限
export const TASK_NAME_MAX_LENGTH = 128
export const TASK_DESC_MAX_LENGTH = 256

// 检查事项名称长度上限
export const CHECK_ITEM_NAME_MAX_LENGTH = 64

// 评论内容有效字符数上限
export const COMMENT_CONTENT_MAX_CHARS = 1000

// 稍后提醒时长边界（分钟）
export const SNOOZE_MIN_MINUTES = 1
export const SNOOZE_MAX_MINUTES = 1440

// 待办事项状态序列号映射
export const stateSNMap = { todo: 1, 'in-progress': 2, doing: 2, done: 3 }

// 待办事项状态选项的反向映射
export const stateSNMapReverse = [null, 'todo', 'in-progress', 'done']

// 待办事项优先级序列号映射
export const prioritySNMap = { low: 1, medium: 2, high: 3 }

// 待办事项优先级选项的反向映射
export const prioritySNMapReverse = [null, 'low', 'medium', 'high']