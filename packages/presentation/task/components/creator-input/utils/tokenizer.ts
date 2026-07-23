import type { Token, TokenType } from '../types'
import { TOKEN_REGEX, CHAR_TO_TYPE, BOUNDARY_REGEX, TRIGGER_CHARS } from '../constants'

// ============== 辅助函数 ==============

/**
 * 检查触发字符是否有独立边界
 * 确保不会误匹配 URL 中的 # 或 email 中的 @
 */
function hasValidBoundary(text: string, pos: number): boolean {
  // 开头位置自动有效
  if (pos === 0) return true

  const prevChar = text[pos - 1]
  return BOUNDARY_REGEX.test(prevChar)
}

/**
 * 提取触发字符后的查询词
 */
function extractQuery(text: string, startPos: number): string {
  let endPos = startPos
  while (endPos < text.length && !BOUNDARY_REGEX.test(text[endPos])) {
    endPos++
  }
  return text.slice(startPos, endPos)
}

// ============== 词法分词器 ==============

/**
 * 词法分词 - 将输入文本解析为 Token 列表
 *
 * 算法说明：
 * 1. 使用正则匹配所有触发字符开头的词
 * 2. 验证边界有效性（避免误匹配 URL/email 中的特殊字符）
 * 3. 填充间隙为 text 类型的 Token
 * 4. 返回按位置排序的 Token 列表
 *
 * @param text 输入文本
 * @returns Token 列表
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const matches: Array<{ match: RegExpMatchArray; index: number }> = []

  // 1. 收集所有匹配
  let match: RegExpMatchArray | null
  const regex = new RegExp(TOKEN_REGEX.source, TOKEN_REGEX.flags)

  while ((match = regex.exec(text)) !== null) {
    matches.push({ match, index: match.index || 0 })
  }

  // 2. 处理每个匹配，验证边界并生成 Token
  let lastEnd = 0

  for (const { match: m, index } of matches) {
    const triggerChar = m[1] as string
    const value = m[2] as string
    const raw = m[0] as string
    const start = index
    const end = start + raw.length

    // 边界验证
    if (!hasValidBoundary(text, start)) {
      continue
    }

    // 添加间隙的文本 Token
    if (start > lastEnd) {
      tokens.push({
        type: 'text',
        raw: text.slice(lastEnd, start),
        value: text.slice(lastEnd, start),
        start: lastEnd,
        end: start
      })
    }

    // 添加语法 Token
    const type = CHAR_TO_TYPE[triggerChar] as TokenType
    if (type) {
      tokens.push({
        type,
        raw,
        value,
        start,
        end,
        resolved: false
      })
    }

    lastEnd = end
  }

  // 3. 添加剩余的文本
  if (lastEnd < text.length) {
    tokens.push({
      type: 'text',
      raw: text.slice(lastEnd),
      value: text.slice(lastEnd),
      start: lastEnd,
      end: text.length
    })
  }

  // 4. 处理相邻的纯文本 Token（合并连续的 text 类型）
  return mergeAdjacentTextTokens(tokens)
}

/**
 * 合并相邻的纯文本 Token
 * 减少不必要的 Token 数量
 */
function mergeAdjacentTextTokens(tokens: Token[]): Token[] {
  if (tokens.length <= 1) return tokens

  const result: Token[] = []
  let currentTextToken: Token | null = null

  for (const token of tokens) {
    if (token.type === 'text') {
      if (currentTextToken) {
        // 合并到当前文本 Token
        currentTextToken.raw += token.raw
        currentTextToken.value += token.value
        currentTextToken.end = token.end
      } else {
        // 开始新的文本 Token
        currentTextToken = { ...token }
      }
    } else {
      // 先保存累积的文本 Token
      if (currentTextToken) {
        result.push(currentTextToken)
        currentTextToken = null
      }
      result.push(token)
    }
  }

  // 处理最后一个文本 Token
  if (currentTextToken) {
    result.push(currentTextToken)
  }

  return result
}

// ============== 光标位置检测 ==============

/**
 * 检测光标位置是否在某个触发字符的查询范围内
 * 用于自动补全的触发
 *
 * @param text 完整文本
 * @param cursorPos 光标位置（selectionEnd）
 * @returns 光标位置信息，未触发则返回 null
 */
export function detectCursorPosition(text: string, cursorPos: number): {
  type: TokenType
  query: string
  start: number
  end: number
} | null {
  if (cursorPos === 0) return null

  // 从光标位置反向查找最近的触发字符
  let searchPos = cursorPos - 1
  let triggerChar: string | null = null
  let triggerPos = -1

  // 最多回退 100 个字符（防止长文本性能问题）
  const maxBacktrack = Math.min(100, searchPos + 1)

  for (let i = 0; i < maxBacktrack; i++) {
    const char = text[searchPos]

    // 遇到边界字符就停止（说明触发字符不在当前词中）
    if (BOUNDARY_REGEX.test(char)) {
      break
    }

    // 找到触发字符
    if (TRIGGER_CHARS.includes(char)) {
      // 验证边界
      if (searchPos === 0 || BOUNDARY_REGEX.test(text[searchPos - 1])) {
        triggerChar = char
        triggerPos = searchPos
        break
      }
    }

    searchPos--
  }

  if (!triggerChar || triggerPos === -1) return null

  // 提取查询词（从触发字符后到当前光标）
  const query = text.slice(triggerPos + 1, cursorPos)
  const type = CHAR_TO_TYPE[triggerChar] as TokenType

  if (!type) return null

  return {
    type,
    query,
    start: triggerPos,
    end: cursorPos
  }
}

// ============== 替换工具 ==============

/**
 * 替换文本中的某个范围
 * 用于自动补全选择后的替换
 */
export function replaceRange(
  text: string,
  start: number,
  end: number,
  replacement: string
): {
  newText: string
  newCursorPos: number
} {
  const newText = text.slice(0, start) + replacement + text.slice(end)
  const newCursorPos = start + replacement.length

  return { newText, newCursorPos }
}

/**
 * 删除光标前的整个 Token（按 Backspace 时）
 */
export function deleteTokenAtCursor(
  text: string,
  cursorPos: number
): {
  newText: string
  newCursorPos: number
  deleted: boolean
} {
  const tokens = tokenize(text)

  // 找到包含光标位置的 Token
  for (const token of tokens) {
    if (token.type !== 'text' && token.start < cursorPos && cursorPos <= token.end) {
      // 删除整个 Token（包括前面可能的空格）
      const deleteStart = token.start > 0 && text[token.start - 1] === ' '
        ? token.start - 1
        : token.start

      return {
        newText: text.slice(0, deleteStart) + text.slice(token.end),
        newCursorPos: deleteStart,
        deleted: true
      }
    }
  }

  // 没有找到可删除的 Token
  return { newText: text, newCursorPos: cursorPos, deleted: false }
}
