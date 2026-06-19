import type { Modifier, ParsedKey, KeyEvent, Platform } from './types'

/**
 * 解析快捷键字符串
 * @param keys 快捷键字符串，如 "ctrl+k"、"$mod+s"、"Escape"
 * @example parseKeys("ctrl+k") // { key: "k", modifiers: Set { "ctrl" } }
 */
export function parseKeys(keys: string): ParsedKey {
    const trimmed = keys.trim().toLowerCase()
    const parts = trimmed.split('+')

    const modifiers = new Set<Modifier>()
    let mainKey = ''

    for (const part of parts) {
        const trimmedPart = part.trim()
        switch (trimmedPart) {
            case 'ctrl':
            case 'control': {
                modifiers.add('ctrl')
                break
            }
            case 'alt':
            case 'option': {
                modifiers.add('alt')
                break
            }
            case 'shift': {
                modifiers.add('shift')
                break
            }
            case 'meta':
            case 'cmd':
            case 'command': {
                modifiers.add('meta')
                break
            }
            case '$mod':
            case 'mod': {
                modifiers.add('$mod')
                break
            }
            default: {
                mainKey = trimmedPart
                break
            }
        }
    }

    return { key: mainKey || '?', modifiers }
}

/**
 * 判断按键事件是否匹配快捷键绑定
 * @param binding 解析后的快捷键绑定
 * @param event 归一化的按键事件
 * @param platform 当前平台，用于 $mod 的展开
 */
export function matchesKeyEvent(
    binding: ParsedKey,
    event: KeyEvent,
    platform: Platform
): boolean {
    // 主键匹配（字母不区分大小写）
    const keyMatch = binding.key.toLowerCase() === event.key.toLowerCase()
    if (!keyMatch) return false

    // 将 $mod 按平台展开为具体修饰键
    const concrete = expandModifiers(binding.modifiers, platform)

    // 判断是否为 shifted char（非字母数字的单字符，如 "?"、"!"）
    // 这类按键本身不需要 shift 修饰键也能在绑定中书写
    const isShiftedChar =
        binding.key.length === 1 &&
        binding.modifiers.size === 0 &&
        !/^[a-zA-Z0-9]$/.test(binding.key)

    // 检查绑定中包含的修饰键是否已激活
    if (concrete.has('ctrl') && !event.ctrlKey) return false
    if (concrete.has('alt') && !event.altKey) return false
    if (concrete.has('shift') && !event.shiftKey) return false
    if (concrete.has('meta') && !event.metaKey) return false

    // 严格检查：未在绑定中的修饰键必须为 false
    // 这是为了防止 ctrl+k 在 ctrl+shift+k 时误触发
    if (!concrete.has('ctrl') && event.ctrlKey) return false
    if (!concrete.has('alt') && event.altKey) return false
    if (!concrete.has('meta') && event.metaKey) return false
    if (!isShiftedChar && !concrete.has('shift') && event.shiftKey) return false

    return true
}

/**
 * 展开修饰键集合，将 $mod 按平台映射为 ctrl 或 meta
 * @param modifiers 原始修饰键集合
 * @param platform 当前平台
 */
function expandModifiers(
    modifiers: Set<Modifier>,
    platform: Platform
): Set<Exclude<Modifier, '$mod'>> {
    const result = new Set<Exclude<Modifier, '$mod'>>()
    for (const m of modifiers) {
        if (m === '$mod') {
            result.add(platform === 'mac' ? 'meta' : 'ctrl')
        } else {
            result.add(m)
        }
    }
    return result
}
