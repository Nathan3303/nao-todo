import type { TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/application/task/viewobjects'

// ============== 核心类型 ==============

/**
 * Token 类型 - 词法分析的结果类型
 */
export type TokenType = 'text' | 'tag' | 'project' | 'priority' | 'status' | 'date'

/**
 * 词法 Token - 单个解析标记
 */
export interface Token {
  /** 标记类型 */
  type: TokenType
  /** 原始文本（含前缀，如 #工作） */
  raw: string
  /** 解析后的值（不含前缀） */
  value: string
  /** 起始位置 */
  start: number
  /** 结束位置 */
  end: number
  /** 是否已匹配到现有数据（如已存在的标签） */
  resolved?: boolean
  /** 匹配到的实体 ID（如标签 ID） */
  id?: string
}

/**
 * 自动补全建议项
 */
export interface SuggestionItem {
  id: string
  label: string
  type: TokenType
  icon?: string
  color?: string
  /** 是否为新建项（如不存在的标签） */
  isNew?: boolean
}

/**
 * 解析结果 - 包含所有解析出的任务属性
 */
export interface ParsedResult {
  /** 解析出的所有 Token */
  tokens: Token[]
  /** 纯任务标题（移除所有已解析的语法标记） */
  text: string
  /** 标签 ID 列表 */
  tags: string[]
  /** 项目/清单 ID */
  projectId: string | null
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | null
  /** 任务状态 */
  state: 'todo' | 'in-progress' | 'done' | null
  /** 截止日期（ISO 字符串） */
  dueAt: string | null
}

/**
 * 输入框输出值 - 保持与现有系统兼容
 */
export interface TaskCreatorInputValue {
  text: string
  tags: string[]
  projectId: string | null
  priority: string | null
  state: string | null
  dueAt: string | null
}

// ============== 组件 Props ==============

/**
 * 任务创建器输入框 Props
 */
export interface TaskCreatorInputProps {
  modelValue: TaskCreatorInputValue
  /** 可用标签列表 */
  tags: TaskTagViewObject[]
  /** 可用项目/清单列表 */
  projects: TaskProjectViewObject[]
  /** 优先级选项 */
  priorityOptions: SelectOption[]
  /** 状态选项 */
  stateOptions: SelectOption[]
  /** 占位符文本 */
  placeholder?: string
  /** 是否自动聚焦 */
  autofocus?: boolean
}

/**
 * 任务创建器输入框 Emits
 */
export interface TaskCreatorInputEmits {
  (e: 'update:modelValue', value: TaskCreatorInputValue): void
  (e: 'create-tag', name: string): void
  (e: 'submit'): void
}

// ============== 内部类型 ==============

/**
 * 选择选项 - 通用类型
 */
export interface SelectOption {
  label: string
  value: string
  icon?: string
}

/**
 * 触发字符配置
 */
export interface TriggerConfig {
  /** 触发字符 */
  char: string
  /** 对应的 Token 类型 */
  type: TokenType
  /** 显示名称 */
  label: string
  /** 图标 */
  icon: string
}

/**
 * 光标位置信息 - 用于自动补全
 */
export interface CursorPosition {
  /** 触发字符类型 */
  type: TokenType | null
  /** 查询关键词 */
  query: string
  /** 触发字符起始位置 */
  start: number
  /** 当前光标位置 */
  end: number
}

/**
 * 优先级映射值类型
 */
export type PriorityValue = 'low' | 'medium' | 'high'

/**
 * 状态映射值类型
 */
export type StateValue = 'todo' | 'in-progress' | 'done'

/**
 * 自动补全建议结果类型
 */
export type SuggestionResult = {
  id: string
  label: string
  type: string
  isNew?: boolean
}
