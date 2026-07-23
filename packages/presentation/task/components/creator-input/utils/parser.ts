import type {
  ParsedResult,
  PriorityValue,
  StateValue,
  TaskCreatorInputValue,
  Token,
  SuggestionResult
} from '../types'
import type { TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/application/task/viewobjects'
import type { SelectOption } from '../types'
import { PRIORITY_ALIASES, STATE_ALIASES, TYPE_TO_CHAR } from '../constants'
import { tokenize } from './tokenizer'

// ============== 任务解析器类 ==============

/**
 * 任务智能解析器
 *
 * 功能：
 * 1. 词法分析 - 将输入文本拆分为 Token
 * 2. 语义解析 - 匹配现有数据（标签、项目等）
 * 3. 属性聚合 - 将解析结果聚合成任务属性
 * 4. 纯文本提取 - 移除所有语法标记后的任务标题
 */
export class TaskParser {
  private availableTags: TaskTagViewObject[]
  private availableProjects: TaskProjectViewObject[]
  private priorityOptions: SelectOption[]
  private stateOptions: SelectOption[]

  constructor(
    options: {
      tags: TaskTagViewObject[]
      projects: TaskProjectViewObject[]
      priorityOptions: SelectOption[]
      stateOptions: SelectOption[]
    }
  ) {
    this.availableTags = options.tags || []
    this.availableProjects = options.projects || []
    this.priorityOptions = options.priorityOptions || []
    this.stateOptions = options.stateOptions || []
  }

  /**
   * 解析输入文本
   */
  parse(text: string): ParsedResult {
    // 1. 词法分词
    const tokens = tokenize(text)

    // 2. 语义解析 - 匹配现有数据
    const resolvedTokens = tokens.map(token => this.resolveToken(token))

    // 3. 提取纯文本标题
    const pureText = this.extractPureText(resolvedTokens)

    // 4. 聚合属性
    return this.aggregateAttributes(resolvedTokens, pureText)
  }

  /**
   * 解析单个 Token - 匹配现有数据
   */
  private resolveToken(token: Token): Token {
    if (token.type === 'text') return token

    switch (token.type) {
      case 'tag':
        return this.resolveTagToken(token)
      case 'project':
        return this.resolveProjectToken(token)
      case 'priority':
        return this.resolvePriorityToken(token)
      case 'status':
        return this.resolveStatusToken(token)
      default:
        return token
    }
  }

  /**
   * 解析标签 Token
   * 支持模糊匹配（不区分大小写）
   */
  private resolveTagToken(token: Token): Token {
    const query = token.value.toLowerCase()

    const matchedTag = this.availableTags.find(tag =>
      tag.name?.toLowerCase() === query ||
      tag.name?.toLowerCase().includes(query) ||
      tag.id === query
    )

    if (matchedTag) {
      return {
        ...token,
        resolved: true,
        id: matchedTag.id
      }
    }

    return token
  }

  /**
   * 解析项目/清单 Token
   * 支持模糊匹配（不区分大小写）
   */
  private resolveProjectToken(token: Token): Token {
    const query = token.value.toLowerCase()

    const matchedProject = this.availableProjects.find(project =>
      project.name?.toLowerCase() === query ||
      project.name?.toLowerCase().includes(query) ||
      project.id === query
    )

    if (matchedProject) {
      return {
        ...token,
        resolved: true,
        id: matchedProject.id
      }
    }

    return token
  }

  /**
   * 解析优先级 Token
   * 使用别名映射支持多种表达方式
   */
  private resolvePriorityToken(token: Token): Token {
    const query = token.value.toLowerCase()
    const priority = PRIORITY_ALIASES[query]

    if (priority) {
      // 验证优先级在可选列表中
      const isValid = this.priorityOptions.some(opt => opt.value === priority)
      if (isValid) {
        return {
          ...token,
          resolved: true,
          id: priority
        }
      }
    }

    return token
  }

  /**
   * 解析状态 Token
   * 使用别名映射支持多种表达方式
   */
  private resolveStatusToken(token: Token): Token {
    const query = token.value.toLowerCase()
    const state = STATE_ALIASES[query]

    if (state) {
      // 验证状态在可选列表中
      const isValid = this.stateOptions.some(opt => opt.value === state)
      if (isValid) {
        return {
          ...token,
          resolved: true,
          id: state
        }
      }
    }

    return token
  }

  /**
   * 提取纯文本标题
   * 移除所有已解析的语法标记，保留未解析的文本
   */
  private extractPureText(tokens: Token[]): string {
    const parts: string[] = []

    for (const token of tokens) {
      if (token.type === 'text') {
        parts.push(token.raw)
      } else if (!token.resolved) {
        // 未解析的标记保留为纯文本（如不存在的标签名）
        parts.push(token.raw)
      }
      // 已解析的标记不加入标题
    }

    return parts.join('').trim()
  }

  /**
   * 聚合并解析所有属性
   */
  private aggregateAttributes(tokens: Token[], text: string): ParsedResult {
    const tags: string[] = []
    let projectId: string | null = null
    let priority: PriorityValue | null = null
    let state: StateValue | null = null

    for (const token of tokens) {
      if (!token.resolved || !token.id) continue

      switch (token.type) {
        case 'tag':
          if (!tags.includes(token.id)) {
            tags.push(token.id)
          }
          break
        case 'project':
          // 最后一个项目覆盖之前的
          projectId = token.id
          break
        case 'priority':
          // 最后一个优先级覆盖之前的
          priority = token.id as PriorityValue
          break
        case 'status':
          // 最后一个状态覆盖之前的
          state = token.id as StateValue
          break
      }
    }

    return {
      tokens,
      text,
      tags,
      projectId,
      priority,
      state,
      dueAt: null // Phase 2 实现
    }
  }

  /**
   * 将解析结果转换为输入框输出值
   * 保持与现有系统的兼容性
   */
  toInputValue(result: ParsedResult): TaskCreatorInputValue {
    return {
      text: result.text,
      tags: result.tags,
      projectId: result.projectId,
      priority: result.priority,
      state: result.state,
      dueAt: result.dueAt
    }
  }
}

// ============== 便捷函数 ==============

/**
 * 便捷函数：直接解析文本
 */
export function parseTaskText(
  text: string,
  options: {
    tags: TaskTagViewObject[]
    projects: TaskProjectViewObject[]
    priorityOptions: SelectOption[]
    stateOptions: SelectOption[]
  }
): ParsedResult {
  const parser = new TaskParser(options)
  return parser.parse(text)
}

/**
 * 根据解析结果重构带语法的输入文本
 * 用于初始化时将已有值转换为智能输入格式
 */
export function reconstructInputText(
  value: TaskCreatorInputValue,
  options: {
    tags: TaskTagViewObject[]
    projects: TaskProjectViewObject[]
  }
): string {
  const parts: string[] = [value.text]

  // 添加标签
  for (const tagId of value.tags || []) {
    const tag = options.tags.find(t => t.id === tagId)
    if (tag?.name) {
      parts.push(`${TYPE_TO_CHAR.tag}${tag.name}`)
    }
  }

  // 添加项目
  if (value.projectId) {
    const project = options.projects.find(p => p.id === value.projectId)
    if (project?.name) {
      parts.push(`${TYPE_TO_CHAR.project}${project.name}`)
    }
  }

  // 添加优先级
  if (value.priority) {
    parts.push(`${TYPE_TO_CHAR.priority}${value.priority}`)
  }

  // 添加状态
  if (value.state) {
    parts.push(`${TYPE_TO_CHAR.status}${value.state}`)
  }

  return parts.join(' ')
}

/**
 * 获取自动补全建议
 */
export function getSuggestions(
  type: string,
  query: string,
  options: {
    tags: TaskTagViewObject[]
    projects: TaskProjectViewObject[]
    priorityOptions: SelectOption[]
    stateOptions: SelectOption[]
  }
): SuggestionResult[] {
  const queryLower = query.toLowerCase()

  switch (type) {
    case 'tag': {
      const matchedTags: SuggestionResult[] = options.tags
        .filter(tag => tag.name?.toLowerCase().includes(queryLower))
        .map(tag => ({
          id: tag.id,
          label: tag.name || '',
          type: 'tag'
        }))
        .slice(0, 5)

      // 如果没有精确匹配且查询非空，提供创建选项
      const exactMatch = options.tags.some(
        tag => tag.name?.toLowerCase() === queryLower
      )
      if (!exactMatch && query.trim()) {
        matchedTags.push({
          id: `new:${query}`,
          label: `创建新标签: "${query}"`,
          type: 'tag',
          isNew: true
        })
      }

      return matchedTags
    }

    case 'project':
      return options.projects
        .filter(project => project.name?.toLowerCase().includes(queryLower))
        .map(project => ({
          id: project.id,
          label: project.name || '',
          type: 'project'
        }))
        .slice(0, 5)

    case 'priority':
      return options.priorityOptions
        .filter(opt => opt.label.toLowerCase().includes(queryLower))
        .map(opt => ({
          id: opt.value,
          label: opt.label,
          type: 'priority'
        }))

    case 'status':
      return options.stateOptions
        .filter(opt => opt.label.toLowerCase().includes(queryLower))
        .map(opt => ({
          id: opt.value,
          label: opt.label,
          type: 'status'
        }))

    default:
      return []
  }
}
