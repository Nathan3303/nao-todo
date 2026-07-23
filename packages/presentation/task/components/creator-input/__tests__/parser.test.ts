import { describe, it, expect } from 'vitest'
import { tokenize, detectCursorPosition, TaskParser } from '../index'
import type { SelectOption } from '../types'

describe('tokenize - 词法分词', () => {
  it('应该正确识别标签 #', () => {
    const tokens = tokenize('完成报告 #工作')

    expect(tokens).toHaveLength(2)
    expect(tokens[0].type).toBe('text')
    expect(tokens[0].value).toBe('完成报告 ')
    expect(tokens[1].type).toBe('tag')
    expect(tokens[1].value).toBe('工作')
    expect(tokens[1].raw).toBe('#工作')
  })

  it('应该正确识别项目 @', () => {
    const tokens = tokenize('写代码 @个人项目')

    expect(tokens).toHaveLength(2)
    expect(tokens[1].type).toBe('project')
    expect(tokens[1].value).toBe('个人项目')
  })

  it('应该正确识别优先级 !', () => {
    const tokens = tokenize('修复bug !高')

    expect(tokens).toHaveLength(2)
    expect(tokens[1].type).toBe('priority')
    expect(tokens[1].value).toBe('高')
  })

  it('应该正确识别状态 ~', () => {
    const tokens = tokenize('代码评审 ~进行中')

    expect(tokens).toHaveLength(2)
    expect(tokens[1].type).toBe('status')
    expect(tokens[1].value).toBe('进行中')
  })

  it('应该正确处理多个标记', () => {
    const tokens = tokenize('完成报告 #工作 @项目A !高 ~待办')

    expect(tokens).toHaveLength(5) // 文本 + 4 个标记
    expect(tokens[1].type).toBe('tag')
    expect(tokens[2].type).toBe('project')
    expect(tokens[3].type).toBe('priority')
    expect(tokens[4].type).toBe('status')
  })

  it('应该忽略 URL 中的 #', () => {
    const tokens = tokenize('查看 https://example.com#section')

    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('text')
  })

  it('应该忽略 email 中的 @', () => {
    const tokens = tokenize('发送邮件到 test@example.com')

    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('text')
  })

  it('应该处理空字符串', () => {
    const tokens = tokenize('')
    expect(tokens).toHaveLength(0)
  })
})

describe('detectCursorPosition - 光标位置检测', () => {
  const text = '完成报告 #工作'

  it('应该在标签中间检测到触发', () => {
    // '完成报告 #工|作' -> 光标在 '工' 后面
    const cursorPos = '完成报告 #工'.length
    const result = detectCursorPosition(text, cursorPos)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('tag')
    expect(result?.query).toBe('工')
  })

  it('应该在标签开头检测到触发', () => {
    // '完成报告 #|工作' -> 光标在 # 后面
    const cursorPos = '完成报告 #'.length
    const result = detectCursorPosition(text, cursorPos)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('tag')
    expect(result?.query).toBe('')
  })

  it('不应该在普通文本中检测到触发', () => {
    const cursorPos = '完成报告'.length
    const result = detectCursorPosition(text, cursorPos)

    expect(result).toBeNull()
  })

  it('不应该在文本开头检测到触发', () => {
    const result = detectCursorPosition(text, 0)
    expect(result).toBeNull()
  })
})

describe('TaskParser - 语义解析器', () => {
  const mockTags = [
    { id: 'tag-1', name: '工作' },
    { id: 'tag-2', name: '个人' }
  ]

  const mockProjects = [
    { id: 'proj-1', name: '项目A' },
    { id: 'proj-2', name: '项目B' }
  ]

  const mockPriorityOptions: SelectOption[] = [
    { label: '低', value: 'low' },
    { label: '中', value: 'medium' },
    { label: '高', value: 'high' }
  ]

  const mockStateOptions: SelectOption[] = [
    { label: '待办', value: 'todo' },
    { label: '进行中', value: 'in-progress' },
    { label: '已完成', value: 'done' }
  ]

  const parser = new TaskParser({
    tags: mockTags,
    projects: mockProjects,
    priorityOptions: mockPriorityOptions,
    stateOptions: mockStateOptions
  })

  it('应该正确解析标签', () => {
    const result = parser.parse('完成报告 #工作 #个人')

    expect(result.tags).toEqual(['tag-1', 'tag-2'])
    expect(result.text).toBe('完成报告')
  })

  it('应该正确解析项目', () => {
    const result = parser.parse('写代码 @项目A')

    expect(result.projectId).toBe('proj-1')
    expect(result.text).toBe('写代码')
  })

  it('应该正确解析优先级 - 中文', () => {
    const result = parser.parse('修复bug !高')

    expect(result.priority).toBe('high')
    expect(result.text).toBe('修复bug')
  })

  it('应该正确解析优先级 - p1/p2/p3', () => {
    expect(parser.parse('任务 !p1').priority).toBe('high')
    expect(parser.parse('任务 !p2').priority).toBe('medium')
    expect(parser.parse('任务 !p3').priority).toBe('low')
  })

  it('应该正确解析状态', () => {
    expect(parser.parse('任务 ~待办').state).toBe('todo')
    expect(parser.parse('任务 ~进行中').state).toBe('in-progress')
    expect(parser.parse('任务 ~完成').state).toBe('done')
  })

  it('应该正确解析所有属性组合', () => {
    const result = parser.parse('完成报告 #工作 @项目A !高 ~待办')

    expect(result.text).toBe('完成报告')
    expect(result.tags).toEqual(['tag-1'])
    expect(result.projectId).toBe('proj-1')
    expect(result.priority).toBe('high')
    expect(result.state).toBe('todo')
  })

  it('未匹配的标签应该保留在文本中', () => {
    const result = parser.parse('任务 #不存在的标签')

    expect(result.tags).toHaveLength(0)
    expect(result.text).toBe('任务 #不存在的标签')
  })

  it('应该正确处理空输入', () => {
    const result = parser.parse('')

    expect(result.text).toBe('')
    expect(result.tags).toHaveLength(0)
    expect(result.projectId).toBeNull()
    expect(result.priority).toBeNull()
    expect(result.state).toBeNull()
  })
})

describe('优先级别名映射', () => {
  const parser = new TaskParser({
    tags: [],
    projects: [],
    priorityOptions: [
      { label: '低', value: 'low' },
      { label: '中', value: 'medium' },
      { label: '高', value: 'high' }
    ],
    stateOptions: []
  })

  it('应该支持多种优先级别名', () => {
    expect(parser.parse('任务 !低').priority).toBe('low')
    expect(parser.parse('任务 !普通').priority).toBe('low')
    expect(parser.parse('任务 !中').priority).toBe('medium')
    expect(parser.parse('任务 !重要').priority).toBe('medium')
    expect(parser.parse('任务 !高').priority).toBe('high')
    expect(parser.parse('任务 !紧急').priority).toBe('high')
    expect(parser.parse('任务 !p1').priority).toBe('high')
    expect(parser.parse('任务 !P1').priority).toBe('high')
  })
})
