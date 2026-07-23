import type { Ref } from 'vue'
import { deleteTokenAtCursor } from '../utils/tokenizer'

/**
 * 键盘导航 Composable
 *
 * 处理智能输入框的特殊键盘交互：
 * - Backspace 删除整个标记
 * - 快捷键支持
 */
export function useKeyboardNav(options: {
  rawText: Ref<string>
  inputRef: Ref<HTMLTextAreaElement | null>
  onTextChange: (text: string) => void
}) {
  const { rawText, inputRef, onTextChange } = options

  /**
   * 处理 Backspace 键
   * 如果光标在标记末尾，删除整个标记
   */
  function handleBackspace(event: KeyboardEvent): boolean {
    const input = inputRef.value
    if (!input) return false

    const cursorPos = input.selectionStart
    const text = rawText.value

    // 只有当光标紧跟在标记后面时才触发智能删除
    const result = deleteTokenAtCursor(text, cursorPos)

    if (result.deleted) {
      event.preventDefault()
      onTextChange(result.newText)

      // 更新光标位置
      requestAnimationFrame(() => {
        if (input) {
          input.selectionStart = input.selectionEnd = result.newCursorPos
        }
      })

      return true
    }

    return false
  }

  /**
   * 处理 Esc 键
   * 关闭弹出层，保持焦点
   */
  function handleEscape(): boolean {
    // 主要逻辑在 useAutocomplete 中处理
    // 这里保留扩展空间
    return false
  }

  /**
   * 处理 Enter 键
   * 提交任务（如果弹出层已关闭）
   */
  function handleEnter(event: KeyboardEvent, isPopoverOpen: boolean): boolean {
    // 如果弹出层已打开，由自动补全处理
    if (isPopoverOpen) return false

    // Ctrl/Cmd + Enter 提交
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      return true
    }

    return false
  }

  /**
   * 统一的键盘事件分发
   * 返回 true 表示事件已被消费
   */
  function handleKeydown(event: KeyboardEvent, isPopoverOpen: boolean): boolean {
    switch (event.key) {
      case 'Backspace':
        return handleBackspace(event)

      case 'Escape':
        return handleEscape()

      case 'Enter':
        return handleEnter(event, isPopoverOpen)

      default:
        return false
    }
  }

  return {
    handleKeydown,
    handleBackspace,
    handleEnter,
    handleEscape
  }
}

export default useKeyboardNav
