import type { Token } from '../types'
import { TOKEN_COLORS, TYPE_TO_CHAR } from '../constants'

// ============== HTML 高亮渲染 ==============

/**
 * 将 Token 列表渲染为带高亮的 HTML
 * 用于底层高亮层的显示
 */
export function renderHighlightedHTML(tokens: Token[]): string {
  return tokens
    .map(token => {
      if (token.type === 'text' || !token.resolved) {
        // 纯文本或未解析的标记，使用透明色占位
        return escapeHtml(token.raw)
      }

      // 已解析的标记，使用背景色高亮
      const colors = TOKEN_COLORS[token.type]
      const style = `background-color: ${colors.bg}; color: transparent; border-radius: 4px; padding: 0 2px;`

      return `<span style="${style}">${escapeHtml(token.raw)}</span>`
    })
    .join('')
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ============== 样式辅助函数 ==============

/**
 * 获取 Token 的显示颜色（前景）
 */
export function getTokenTextColor(type: string): string {
  return TOKEN_COLORS[type]?.text || 'inherit'
}

/**
 * 获取 Token 的背景颜色
 */
export function getTokenBgColor(type: string): string {
  return TOKEN_COLORS[type]?.bg || 'transparent'
}

// ============== 高亮位置计算 ==============

/**
 * 获取文本中所有高亮区域的位置
 * 用于自定义渲染（如 Canvas 或纯 CSS 定位）
 */
export function getHighlightRanges(
  tokens: Token[],
  charWidth: number,
  lineHeight: number
): Array<{
  type: string
  left: number
  top: number
  width: number
  height: number
}> {
  const ranges: Array<{
    type: string
    left: number
    top: number
    width: number
    height: number
  }> = []

  // 简单的单行实现
  // 多行需要更复杂的换行位置计算
  for (const token of tokens) {
    if (token.type !== 'text' && token.resolved) {
      ranges.push({
        type: token.type,
        left: token.start * charWidth,
        top: 0,
        width: (token.end - token.start) * charWidth,
        height: lineHeight
      })
    }
  }

  return ranges
}

// ============== Chips 渲染辅助 ==============

/**
 * Token 显示配置
 */
export interface TokenDisplayConfig {
  label: string
  icon: string
  color: string
  bgColor: string
}

/**
 * 获取 Token 的显示配置
 * 用于渲染解析结果的 Chips
 */
export function getTokenDisplayConfig(
  token: Token,
  options: {
    tagNames?: Record<string, string>
    projectNames?: Record<string, string>
    priorityLabels?: Record<string, string>
    stateLabels?: Record<string, string>
  }
): TokenDisplayConfig | null {
  if (!token.resolved) return null

  const colors = TOKEN_COLORS[token.type]

  switch (token.type) {
    case 'tag':
      return {
        label: options.tagNames?.[token.id || ''] || token.value,
        icon: 'tag',
        color: colors.text,
        bgColor: colors.bg
      }

    case 'project':
      return {
        label: options.projectNames?.[token.id || ''] || token.value,
        icon: 'folder',
        color: colors.text,
        bgColor: colors.bg
      }

    case 'priority':
      return {
        label: options.priorityLabels?.[token.id || ''] || token.value,
        icon: 'priority',
        color: colors.text,
        bgColor: colors.bg
      }

    case 'status':
      return {
        label: options.stateLabels?.[token.id || ''] || token.value,
        icon: 'circle',
        color: colors.text,
        bgColor: colors.bg
      }

    default:
      return null
  }
}

/**
 * 从 Token 列表中提取唯一的显示配置
 * 用于 Chips 预览区
 */
export function getUniqueChips(
  tokens: Token[],
  options: {
    tagNames?: Record<string, string>
    projectNames?: Record<string, string>
    priorityLabels?: Record<string, string>
    stateLabels?: Record<string, string>
  }
): TokenDisplayConfig[] {
  const seen = new Set<string>()
  const chips: TokenDisplayConfig[] = []

  for (const token of tokens) {
    if (!token.resolved || !token.id) continue

    const key = `${token.type}:${token.id}`
    if (seen.has(key)) continue

    seen.add(key)

    const config = getTokenDisplayConfig(token, options)
    if (config) {
      chips.push(config)
    }
  }

  return chips
}

// ============== 纯文本提取 ==============

/**
 * 从 Token 列表中提取纯文本（移除所有已解析的语法标记）
 * 用于生成最终的任务标题
 */
export function extractPlainText(tokens: Token[]): string {
  return tokens
    .filter(token => token.type === 'text' || !token.resolved)
    .map(token => token.raw)
    .join('')
    .trim()
}

/**
 * 获取语法提示占位符文本
 */
export function getSyntaxHintPlaceholder(): string {
  return `输入任务标题，使用 ${TYPE_TO_CHAR.tag}标签 ${TYPE_TO_CHAR.project}清单 ${TYPE_TO_CHAR.priority}优先级 ${TYPE_TO_CHAR.status}状态`
}
