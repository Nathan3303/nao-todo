// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { detectPlatform } from '@/commands/platform'
import { formatKeyHint } from '../key-hint'

/**
 * T766 · 键位提示的平台可辨性（Issue #371）
 *
 * @description 面板/帮助里的按键提示必须与**引擎的展开口径同源**：
 *              mac 上 `$mod` = `⌘`，其它平台 = `Ctrl`；非键盘手势（`wheel`）按语言取词。
 *              纯函数直测两平台两态（不挂组件）。
 */

const MAC = { platform: 'mac', wheelLabel: '滚轮' } as const
const WIN = { platform: 'win', wheelLabel: '滚轮' } as const

describe('T766 · formatKeyHint 平台键面', () => {
    it('`$mod` 按平台展开：mac ⇒ ⌘，非 mac ⇒ Ctrl', () => {
        expect(formatKeyHint('$mod+k', MAC)).toBe('⌘+K')
        expect(formatKeyHint('$mod+k', WIN)).toBe('Ctrl+K')
        expect(formatKeyHint('$mod+,', MAC)).toBe('⌘+,')
        expect(formatKeyHint('$mod+,', WIN)).toBe('Ctrl+,')
    })

    it('组合键右侧符号原样保留（= / − / 0）', () => {
        expect(formatKeyHint('$mod+=', MAC)).toBe('⌘+=')
        expect(formatKeyHint('$mod+-', WIN)).toBe('Ctrl+−')
        expect(formatKeyHint('$mod+0', WIN)).toBe('Ctrl+0')
    })

    it('单键：字母大写、方向键/回车/问号用可辨符号', () => {
        expect(formatKeyHint('n', WIN)).toBe('N')
        expect(formatKeyHint('p', MAC)).toBe('P')
        expect(formatKeyHint('arrowleft', MAC)).toBe('←')
        expect(formatKeyHint('arrowright', WIN)).toBe('→')
        expect(formatKeyHint('enter', MAC)).toBe('↵')
        expect(formatKeyHint('?', MAC)).toBe('?')
    })

    it('手势 `wheel` 用本地化词（同一字面量在两种语言下不同）', () => {
        expect(formatKeyHint('$mod+wheel', MAC)).toBe('⌘+滚轮')
        expect(formatKeyHint('$mod+wheel', { platform: 'win', wheelLabel: 'scroll' })).toBe(
            'Ctrl+scroll'
        )
    })

    it('无键位 ⇒ 空串（面板/帮助不渲染键位胶囊）', () => {
        expect(formatKeyHint(undefined, WIN)).toBe('')
        expect(formatKeyHint('', WIN)).toBe('')
    })
})

describe('T766 · detectPlatform 与引擎同源', () => {
    it('Mac 平台字串 ⇒ mac；其余（含 jsdom 默认）⇒ win', () => {
        expect(detectPlatform({ platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' })).toBe(
            'mac'
        )
        expect(detectPlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows)' })).toBe(
            'win'
        )
        expect(detectPlatform({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11)' })).toBe(
            'win'
        )
        expect(detectPlatform(undefined)).toBe('win')
    })
})