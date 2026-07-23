import { ref, computed, watch, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { SuggestionResult } from '../types'
import type { TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/application/task/viewobjects'
import type { SelectOption } from '../types'
import { detectCursorPosition } from '../utils/tokenizer'
import { getSuggestions } from '../utils/parser'
import { AUTOCOMPLETE_CONFIG, DEBOUNCE_DELAY } from '../constants'

/**
 * 自动补全 Composable
 *
 * 处理输入框的自动补全逻辑：
 * - 光标位置检测
 * - 触发字符识别
 * - 建议列表查询
 * - 键盘导航支持
 * - 选择后替换
 */
export function useAutocomplete(options: {
  rawText: Ref<string>
  tags: Ref<TaskTagViewObject[]>
  projects: Ref<TaskProjectViewObject[]>
  priorityOptions: Ref<SelectOption[]>
  stateOptions: Ref<SelectOption[]>
  onSelect?: (item: SuggestionResult, trigger: { type: string; start: number; end: number }) => void
  onCreateTag?: (name: string) => void
}) {
  const { rawText, tags, projects, priorityOptions, stateOptions, onSelect, onCreateTag } =
    options

  // 弹出层显示状态
  const isOpen = ref(false)

  // 当前激活项索引
  const activeIndex = ref(0)

  // 建议列表
  const suggestions = ref<SuggestionResult[]>([])

  // 当前触发信息
  const currentTrigger = ref<{
    type: string
    query: string
    start: number
    end: number
  } | null>(null)

  // 输入框 DOM 引用
  const inputRef = ref<HTMLTextAreaElement | null>(null)

  // 防抖定时器
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // ============== 触发检测 ==============

  /**
   * 检查光标位置并更新建议列表
   */
  function checkTrigger(cursorPos?: number) {
    const input = inputRef.value
    if (!input) {
      return
    }

    const pos = cursorPos ?? input.selectionStart
    const trigger = detectCursorPosition(rawText.value, pos)

    if (!trigger) {
      close()
      return
    }

    // 更新当前触发信息
    currentTrigger.value = {
      type: trigger.type,
      query: trigger.query,
      start: trigger.start,
      end: trigger.end
    }

    // 更新建议列表
    updateSuggestions(trigger.type, trigger.query)
  }

  /**
   * 更新建议列表（带防抖）
   */
  function updateSuggestions(type: string, query: string) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      const results = getSuggestions(type, query, {
        tags: tags.value,
        projects: projects.value,
        priorityOptions: priorityOptions.value,
        stateOptions: stateOptions.value
      })

      suggestions.value = results.slice(0, AUTOCOMPLETE_CONFIG.MAX_SUGGESTIONS)
      activeIndex.value = 0
      isOpen.value = results.length > 0
    }, 50) // 降低到 50ms 以获得更快的响应
  }

  // ============== 键盘导航 ==============

  /**
   * 向上导航
   */
  function navigateUp() {
    if (!isOpen.value || suggestions.value.length === 0) return

    activeIndex.value =
      activeIndex.value <= 0 ? suggestions.value.length - 1 : activeIndex.value - 1
  }

  /**
   * 向下导航
   */
  function navigateDown() {
    if (!isOpen.value || suggestions.value.length === 0) return

    activeIndex.value =
      activeIndex.value >= suggestions.value.length - 1 ? 0 : activeIndex.value + 1
  }

  /**
   * 选择当前激活项
   */
  function selectActive(): boolean {
    if (!isOpen.value || suggestions.value.length === 0) return false

    const item = suggestions.value[activeIndex.value]
    if (item) {
      selectItem(item)
      return true
    }

    return false
  }

  /**
   * 选择指定项
   */
  function selectItem(item: SuggestionResult) {
    // 处理创建新标签
    if (item.isNew && item.type === 'tag' && item.id.startsWith('new:')) {
      const newTagName = item.id.slice(4)
      onCreateTag?.(newTagName)
      close()
      return
    }

    // 通知外部选择
    if (currentTrigger.value && onSelect) {
      onSelect(item, {
        type: currentTrigger.value.type,
        start: currentTrigger.value.start,
        end: currentTrigger.value.end
      })
    }

    close()
  }

  /**
   * 关闭弹出层
   */
  function close() {
    isOpen.value = false
    suggestions.value = []
    currentTrigger.value = null
    activeIndex.value = 0

    // 恢复焦点到输入框
    inputRef.value?.focus()
  }

  // ============== 事件处理 ==============

  /**
   * 处理键盘事件
   * 返回 true 表示事件已被消费
   */
  function handleKeydown(event: KeyboardEvent): boolean {
    if (!isOpen.value) return false

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        navigateUp()
        return true

      case 'ArrowDown':
        event.preventDefault()
        navigateDown()
        return true

      case 'Enter':
      case 'Tab':
        if (selectActive()) {
          event.preventDefault()
          return true
        }
        return false

      case 'Escape':
        event.preventDefault()
        close()
        return true

      default:
        return false
    }
  }

  /**
   * 处理点击事件（点击外部关闭）
   */
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement
    const isInput = inputRef.value?.contains(target)
    const isPopover = target.closest('[data-autocomplete-popover]')

    if (!isInput && !isPopover) {
      close()
    }
  }

  // ============== 监听与清理 ==============

  // 输入文本变化时检查触发
  watch(rawText, () => {
    // 使用 nextTick 确保 selection 已更新
    requestAnimationFrame(() => {
      checkTrigger()
    })
  })

  // ============== 计算属性 ==============

  /**
   * 当前触发类型的显示名称
   */
  const triggerLabel = computed(() => {
    const type = currentTrigger.value?.type
    const labels: Record<string, string> = {
      tag: '标签',
      project: '清单',
      priority: '优先级',
      status: '状态'
    }
    return labels[type || ''] || ''
  })

  /**
   * 当前激活项
   */
  const activeItem = computed(() => suggestions.value[activeIndex.value] || null)

  /**
   * 弹出层位置（基于光标）
   */
  const popoverPosition = computed(() => {
    const input = inputRef.value
    if (!input || !currentTrigger.value) return { top: 0, left: 0 }

    // 简化实现：使用输入框左侧位置
    // 完整实现需要测量光标位置，可以使用 range.getBoundingClientRect()
    const rect = input.getBoundingClientRect()
    return {
      top: rect.bottom + 4,
      left: rect.left
    }
  })

  // ============== 返回 ==============

  return {
    // 状态
    isOpen,
    suggestions: suggestions as ComputedRef<SuggestionResult[]>,
    activeIndex,
    currentTrigger,
    triggerLabel,
    activeItem,
    popoverPosition,

    // DOM 引用
    inputRef,

    // 操作
    checkTrigger,
    close,
    selectItem,
    selectActive,
    navigateUp,
    navigateDown,

    // 事件处理
    handleKeydown,
    handleClickOutside
  }
}

export default useAutocomplete
