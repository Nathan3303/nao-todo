import { ref, computed, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type {
  ParsedResult,
  TaskCreatorInputValue,
  Token
} from '../types'
import type { TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/application/task/viewobjects'
import type { SelectOption } from '../types'
import { TaskParser, reconstructInputText } from '../utils/parser'
import { DEBOUNCE_DELAY } from '../constants'

/**
 * 智能解析器 Composable
 *
 * 封装输入文本的解析逻辑，包括：
 * - 输入文本与解析结果的双向同步
 * - 防抖解析优化
 * - 解析状态管理
 * - 与外部 value 的同步
 */
export function useSmartParser(options: {
  modelValue: Ref<TaskCreatorInputValue>
  tags: Ref<TaskTagViewObject[]>
  projects: Ref<TaskProjectViewObject[]>
  priorityOptions: Ref<SelectOption[]>
  stateOptions: Ref<SelectOption[]>
  emit: (event: 'update:modelValue', value: TaskCreatorInputValue) => void
}) {
  const { modelValue, tags, projects, priorityOptions, stateOptions, emit } = options

  // 输入框原始文本（包含语法标记）
  const rawText = ref('')

  // 最新的解析结果
  const parsedResult = ref<ParsedResult | null>(null)

  // 解析中状态
  const isParsing = ref(false)

  // 防抖定时器
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // 创建解析器实例
  const parser = computed(
    () =>
      new TaskParser({
        tags: tags.value,
        projects: projects.value,
        priorityOptions: priorityOptions.value,
        stateOptions: stateOptions.value
      })
  )

  // ============== 初始化 ==============

  // 当外部 value 变化时，重构输入文本
  // （用于从编辑模式恢复或初始化）
  watch(
    modelValue,
    newValue => {
      if (!newValue) return

      // 只有当输入框为空时才自动填充
      // 避免覆盖用户正在输入的内容
      if (rawText.value === '') {
        rawText.value = reconstructInputText(newValue, {
          tags: tags.value,
          projects: projects.value
        })
      }
    },
    { immediate: true, deep: true }
  )

  // ============== 解析逻辑 ==============

  /**
   * 立即执行解析（无防抖）
   */
  function parseImmediately(text: string): ParsedResult {
    isParsing.value = true
    try {
      const result = parser.value.parse(text)
      parsedResult.value = result
      return result
    } finally {
      isParsing.value = false
    }
  }

  /**
   * 防抖解析（用于输入过程中）
   */
  function parseDebounced(text: string) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      const result = parseImmediately(text)
      syncToModelValue(result)
    }, DEBOUNCE_DELAY.PARSE)
  }

  /**
   * 同步解析结果到 modelValue
   */
  function syncToModelValue(result: ParsedResult) {
    const newValue: TaskCreatorInputValue = {
      text: result.text,
      tags: result.tags,
      projectId: result.projectId,
      priority: result.priority,
      state: result.state,
      dueAt: result.dueAt
    }

    emit('update:modelValue', newValue)
  }

  // ============== 对外 API ==============

  /**
   * 处理输入变化
   */
  function onInput(text: string) {
    rawText.value = text
    parseDebounced(text)
  }

  /**
   * 强制立即解析并同步（提交前调用）
   */
  function forceParse() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    const result = parseImmediately(rawText.value)
    syncToModelValue(result)
    return result
  }

  /**
   * 在指定位置插入文本
   * 用于自动补全选择后插入
   */
  function insertAtPosition(start: number, end: number, text: string): string {
    const newText = rawText.value.slice(0, start) + text + ' ' + rawText.value.slice(end)
    rawText.value = newText
    parseDebounced(newText)
    return newText
  }

  /**
   * 清空输入
   */
  function clear() {
    rawText.value = ''
    parsedResult.value = null
  }

  // ============== 计算属性 ==============

  /**
   * 已解析的 Token 列表
   */
  const tokens = computed(() => parsedResult.value?.tokens || [])

  /**
   * 已解析的标签 ID 列表
   */
  const resolvedTags = computed(() => parsedResult.value?.tags || [])

  /**
   * 已解析的项目 ID
   */
  const resolvedProjectId = computed(() => parsedResult.value?.projectId || null)

  /**
   * 已解析的优先级
   */
  const resolvedPriority = computed(() => parsedResult.value?.priority || null)

  /**
   * 已解析的状态
   */
  const resolvedState = computed(() => parsedResult.value?.state || null)

  /**
   * 是否有已解析的属性
   */
  const hasResolvedAttributes = computed(
    () =>
      resolvedTags.value.length > 0 ||
      resolvedProjectId.value !== null ||
      resolvedPriority.value !== null ||
      resolvedState.value !== null
  )

  // ============== 返回 ==============

  return {
    // 状态
    rawText,
    parsedResult: parsedResult as ComputedRef<ParsedResult | null>,
    isParsing,

    // 操作
    onInput,
    forceParse,
    insertAtPosition,
    clear,

    // 计算属性
    tokens,
    resolvedTags,
    resolvedProjectId,
    resolvedPriority,
    resolvedState,
    hasResolvedAttributes
  }
}

export default useSmartParser
