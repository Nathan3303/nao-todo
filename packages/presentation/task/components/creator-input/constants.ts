import type { PriorityValue, StateValue, TriggerConfig } from './types'

// ============== 触发字符配置 ==============

/**
 * 智能输入触发字符配置
 * 参考 Todoist Quick Add 语法设计
 */
export const TRIGGER_CONFIGS: TriggerConfig[] = [
  {
    char: '#',
    type: 'tag',
    label: '标签',
    icon: 'tag'
  },
  {
    char: '@',
    type: 'project',
    label: '清单',
    icon: 'folder'
  },
  {
    char: '!',
    type: 'priority',
    label: '优先级',
    icon: 'priority'
  },
  {
    char: '~',
    type: 'status',
    label: '状态',
    icon: 'circle'
  }
  // { char: ':', type: 'date', label: '日期', icon: 'calendar' } // Phase 2 实现
]

/**
 * 触发字符到类型的映射
 */
export const CHAR_TO_TYPE: Record<string, string> = {
  '#': 'tag',
  '@': 'project',
  '!': 'priority',
  '~': 'status'
  // ':': 'date' // Phase 2 实现
}

/**
 * 类型到触发字符的映射
 */
export const TYPE_TO_CHAR: Record<string, string> = {
  tag: '#',
  project: '@',
  priority: '!',
  status: '~'
  // date: ':' // Phase 2 实现
}

// ============== 优先级映射 ==============

/**
 * 优先级别名映射
 * 支持中英文多种表达方式
 */
export const PRIORITY_ALIASES: Record<string, PriorityValue> = {
  // 中文
  '低': 'low',
  '中': 'medium',
  '高': 'high',
  '普通': 'low',
  '重要': 'medium',
  '紧急': 'high',

  // 英文
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
  'p1': 'high',
  'p2': 'medium',
  'p3': 'low',
  'P1': 'high',
  'P2': 'medium',
  'P3': 'low',
  'none': 'low'
}

// ============== 状态映射 ==============

/**
 * 任务状态别名映射
 * 支持中英文多种表达方式
 */
export const STATE_ALIASES: Record<string, StateValue> = {
  // 中文
  '待办': 'todo',
  '进行': 'in-progress',
  '进行中': 'in-progress',
  '完成': 'done',
  '已完成': 'done',

  // 英文
  'todo': 'todo',
  'in-progress': 'in-progress',
  'inprogress': 'in-progress',
  'doing': 'in-progress',
  'done': 'done'
}

// ============== 正则表达式 ==============

/**
 * Token 匹配正则 - 匹配所有触发字符开头的词
 * 支持中英文、数字、下划线、连字符
 */
export const TOKEN_REGEX = /([#@!~])([\p{L}\p{N}_\-]+)/gu

/**
 * 触发字符匹配正则 - 用于光标位置检测
 */
export const TRIGGER_CHARS = '#@!~'

/**
 * 边界字符正则 - 用于检测触发字符的独立边界
 */
export const BOUNDARY_REGEX = /[\s\.,;!?\(\)\[\]\{\}\'\"<>]/

// ============== 性能配置 ==============

/**
 * 防抖延迟时间（毫秒）
 */
export const DEBOUNCE_DELAY = {
  /** 解析防抖 - 避免频繁重解析 */
  PARSE: 50,
  /** 自动补全查询防抖 */
  AUTOCOMPLETE: 100
} as const

/**
 * 自动补全配置
 */
export const AUTOCOMPLETE_CONFIG = {
  /** 最小查询长度（0 = 触发即显示） */
  MIN_QUERY_LENGTH: 0,
  /** 最大建议数量 */
  MAX_SUGGESTIONS: 8,
  /** 是否支持创建新项 */
  ALLOW_CREATE: true
} as const

// ============== 样式常量 ==============

/**
 * Token 高亮颜色配置
 * 遵循现有设计系统
 */
export const TOKEN_COLORS: Record<string, { bg: string; text: string }> = {
  tag: {
    bg: 'rgba(59, 130, 246, 0.15)',
    text: 'rgb(37, 99, 235)'
  },
  project: {
    bg: 'rgba(16, 185, 129, 0.15)',
    text: 'rgb(5, 150, 105)'
  },
  priority: {
    bg: 'rgba(245, 158, 11, 0.15)',
    text: 'rgb(217, 119, 6)'
  },
  status: {
    bg: 'rgba(139, 92, 246, 0.15)',
    text: 'rgb(124, 58, 237)'
  }
}

// ============== 键盘快捷键 ==============

/**
 * 导航快捷键
 */
export const NAV_KEYS = {
  UP: ['ArrowUp', 'Up'],
  DOWN: ['ArrowDown', 'Down'],
  SELECT: ['Enter', 'Tab'],
  CANCEL: ['Escape', 'Esc'],
  DELETE: ['Backspace']
} as const
