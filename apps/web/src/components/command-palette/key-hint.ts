import type { Platform } from '@nao-todo/shared/commands'

/**
 * 快捷键键面（面向用户的按键提示）
 * @description 把注册表里的键位字面量（`$mod+k` / `arrowleft` / `$mod+wheel` …）翻译成可读提示，
 *              **平台可辨**：mac 用 `⌘`，其它平台用 `Ctrl`；非键盘手势（`wheel`）用词表本地化。
 *              纯函数（无 DOM / 无 i18n 实例依赖）⇒ 可单测两平台两态。
 */

/** 修饰键的分平台文案（`$mod` 是唯一按平台分叉的修饰键，与 matcher 的展开口径一致） */
const MODIFIER_LABELS: Record<string, { mac: string; other: string }> = {
    $mod: { mac: '⌘', other: 'Ctrl' },
    mod: { mac: '⌘', other: 'Ctrl' },
    ctrl: { mac: '⌃', other: 'Ctrl' },
    control: { mac: '⌃', other: 'Ctrl' },
    alt: { mac: '⌥', other: 'Alt' },
    option: { mac: '⌥', other: 'Alt' },
    shift: { mac: '⇧', other: 'Shift' },
    meta: { mac: '⌘', other: 'Win' },
    cmd: { mac: '⌘', other: 'Win' },
    command: { mac: '⌘', other: 'Win' }
}

/** 主键的通用符号（跨语言可辨，不入 i18n） */
const KEY_LABELS: Record<string, string> = {
    arrowleft: '←',
    left: '←',
    arrowright: '→',
    right: '→',
    arrowup: '↑',
    up: '↑',
    arrowdown: '↓',
    down: '↓',
    enter: '↵',
    return: '↵',
    escape: 'Esc',
    esc: 'Esc',
    ' ': 'Space',
    '-': '−'
}

/** 需要本地化词表的「非按键」手势（滚轮 / scroll） */
const GESTURE_LABELS: Record<string, 'wheel'> = {
    wheel: 'wheel'
}

export interface FormatKeyHintOptions {
    platform: Platform
    /** `wheel` 的本地化词（`commands.key.wheel`） */
    wheelLabel: string
}

/** 单段（修饰键 / 主键 / 手势）的显示文案 */
const partLabelOf = (part: string, options: FormatKeyHintOptions): string => {
    const modifier = MODIFIER_LABELS[part]
    if (modifier) return options.platform === 'mac' ? modifier.mac : modifier.other
    if (GESTURE_LABELS[part]) return options.wheelLabel
    const key = KEY_LABELS[part]
    if (key) return key
    // 单字母统一大写（`k` ⇒ `K`）；其余符号（`?` / `,` / `=` / `0`）原样
    return /^[a-z]$/.test(part) ? part.toUpperCase() : part
}

/**
 * 格式化键位提示
 * @param keys 键位字面量（`"$mod+k"`、`"arrowleft"`、`"$mod+wheel"`…）
 * @example formatKeyHint('$mod+k', { platform: 'mac', wheelLabel: '滚轮' }) // '⌘+K'
 */
export const formatKeyHint = (keys: string | undefined, options: FormatKeyHintOptions): string => {
    if (!keys) return ''
    return keys
        .split('+')
        .map((part) => part.trim().toLowerCase())
        .filter((part) => part !== '')
        .map((part) => partLabelOf(part, options))
        .join('+')
}