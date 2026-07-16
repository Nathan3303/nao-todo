import type { TriggerState, InlineChipType } from './types'
import { registry } from './trigger-registry'

/**
 * 从光标前的文本中检测触发状态
 *
 * 触发规则由注册的 TriggerHandler 定义（默认支持 #/@/!/~）
 * 忽略规则：
 * - IME 输入期间不触发（由调用方通过 isComposing 控制）
 * - 触发字符前必须为空白或行首
 * - 遇到空格取消触发
 */
export function detectTrigger(
    textBeforeCursor: string,
    isComposing: boolean
): TriggerState {
    const defaultState: TriggerState = {
        active: false,
        type: null,
        query: '',
        startOffset: 0
    }

    if (isComposing) return defaultState
    if (!textBeforeCursor) return defaultState

    // 从末尾向前扫描，跳过尾部空白
    let i = textBeforeCursor.length - 1
    while (i >= 0 && textBeforeCursor[i] === ' ') i--
    if (i < 0) return defaultState

    const queryEnd = i
    // 向左找到空格或行首
    while (i >= 0 && textBeforeCursor[i] !== ' ') i--

    const startChar = textBeforeCursor[i] === ' ' ? i + 1 : 0
    const candidate = textBeforeCursor.slice(startChar, queryEnd + 1)

    if (!candidate) return defaultState

    const triggerChar = candidate[0]!
    const query = candidate.slice(1)

    if (query.includes(' ')) return defaultState

    const handler = registry.getByChar(triggerChar)
    if (handler) {
        return { active: true, type: handler.type as InlineChipType, query, startOffset: startChar }
    }

    return defaultState
}

/**
 * 获取光标前的完整文本（跨 text node 拼接）
 */
export function getTextBeforeCursor(): string {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return ''

    const range = sel.getRangeAt(0)
    const node = range.startContainer
    const offset = range.startOffset

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        return text.slice(0, offset)
    }

    return ''
}

/**
 * 生成短唯一 ID
 */
export function generateChipId(): string {
    return `chip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
