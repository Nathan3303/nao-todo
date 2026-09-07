import { describe, expect, it } from 'vite-plus/test'
import {
    CALENDAR_KEY_SCOPE,
    INTERACTIVE_KEY_TARGET_SELECTOR,
    isCalendarKeyLocked,
    isInteractiveKeyTarget
} from './keyboard-nav'

/** 假 document：按选择器返回预置元素/空 */
const fakeDoc = (present: string[]): { querySelector: (selector: string) => Element | null } => ({
    querySelector: (selector: string) => (present.includes(selector) ? ({} as Element) : null)
})

/** 假元素：closest 命中/未命中 */
const fakeEl = (hits: string[]): { closest: (selector: string) => unknown } => ({
    closest: (selector: string) => (hits.includes(selector) ? { matched: true } : null)
})

describe('C1-F8 keyboard-nav 纯逻辑', () => {
    it('作用域常量 = calendar', () => {
        expect(CALENDAR_KEY_SCOPE).toBe('calendar')
    })

    it('弹层抑制谓词：F4 菜单(.rmenu) 或 激活弹层(popup-pool[data-actived=true]) 任一命中即抑制', () => {
        expect(isCalendarKeyLocked(fakeDoc([]))).toBe(false)
        expect(isCalendarKeyLocked(fakeDoc(['.rmenu']))).toBe(true)
        expect(isCalendarKeyLocked(fakeDoc(['.nue-popup-pool[data-actived="true"]']))).toBe(true)
        expect(
            isCalendarKeyLocked(fakeDoc(['.rmenu', '.nue-popup-pool[data-actived="true"]']))
        ).toBe(true)
    })

    it('未激活 popup-pool（data-actived=false/无）与轻提示不算抑制', () => {
        expect(isCalendarKeyLocked(fakeDoc(['.nue-popup-pool[data-actived="false"]']))).toBe(false)
        expect(isCalendarKeyLocked(fakeDoc(['.nue-popup-pool']))).toBe(false)
    })

    it('Enter 目标守卫：可聚焦交互控件命中返回 true（button/a/select/role=button/contenteditable/input）', () => {
        const sel = INTERACTIVE_KEY_TARGET_SELECTOR
        expect(isInteractiveKeyTarget(fakeEl([sel]))).toBe(true)
        expect(isInteractiveKeyTarget(fakeEl([]))).toBe(false)
        expect(isInteractiveKeyTarget(null)).toBe(false)
        expect(isInteractiveKeyTarget({})).toBe(false)
        // 无 closest 的普通元素不算交互目标
        expect(isInteractiveKeyTarget({ tagName: 'DIV' })).toBe(false)
    })
})