// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NueDiv, NueText } from 'nue-ui'
import RoundsIndicator from '../rounds-indicator.vue'
import { usePomodoroSessionStore, usePomodoroTimerStore } from '../../../stores'

/**
 * T576 ③ 轮次指示器组件（AC9 / AC10 / AC12）
 *
 * @description 真实组件挂载（不 stub nue-div / nue-text）：断言容器 `role="img"` + `aria-label`、
 *              圆点 `aria-hidden`、实心数 = 已完成数、M=10 时节点数 = 10。
 *              纯视图模型的文案口径已由 `t575-rounds-view.test.ts` 覆盖，本文件只补 DOM 契约。
 */

const FOCUS_S = 25 * 60

const nueComponents = { 'nue-div': NueDiv, 'nue-text': NueText }

let timer: ReturnType<typeof usePomodoroTimerStore>
let session: ReturnType<typeof usePomodoroSessionStore>

const mountIndicator = () => mount(RoundsIndicator, { global: { components: nueComponents } })

const dotCount = (wrapper: ReturnType<typeof mountIndicator>) =>
    wrapper.findAll('.nue-div--rounds-dot').length

const filledCount = (wrapper: ReturnType<typeof mountIndicator>) =>
    wrapper.findAll('.nue-div--rounds-dot-filled').length

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0, 0))
    localStorage.clear()
    setActivePinia(createPinia())
    session = usePomodoroSessionStore()
    session.setFocusDuration(FOCUS_S)
    session.setBreakDuration(5 * 60)
    session.setSessionsUntilLongBreak(4)
    session.setAutoRest(true)
    session.setAutoStartNextFocusSession(false)
    timer = usePomodoroTimerStore()
    timer.updateConfig()
    timer.setCreateRecordFn(vi.fn(async () => [[], null] as never) as never)
})

afterEach(() => {
    timer.destroy()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('T576 ③ 轮次指示器组件', () => {
    it('idle（M=4）⇒ 4 个空心圆点 + role=img / aria-label / 圆点 aria-hidden', () => {
        const wrapper = mountIndicator()

        expect(wrapper.attributes('role')).toBe('img')
        expect(wrapper.attributes('aria-label')).toBe('共 4 轮一轮长休')
        expect(dotCount(wrapper)).toBe(4)
        expect(filledCount(wrapper)).toBe(0)
        expect(wrapper.text()).toContain('共 4 轮一轮长休')

        const dots = wrapper.find('[aria-hidden="true"]')
        expect(dots.exists()).toBe(true)

        wrapper.unmount()
    })

    it('完成 1 次专注（进入短休）⇒ 实心数 = 已完成数 = 1，文字与阶段一致', () => {
        const wrapper = mountIndicator()
        timer.start()
        vi.advanceTimersByTime(FOCUS_S * 1000 + 500)
        return wrapper.vm.$nextTick().then(() => {
            expect(timer.phase).toBe('break')
            expect(dotCount(wrapper)).toBe(4)
            expect(filledCount(wrapper)).toBe(1)
            expect(wrapper.attributes('aria-label')).toBe('休息中 · 已完成 1/4')
            wrapper.unmount()
        })
    })

    it('M=10 ⇒ 圆点节点数 = 10（上限内，无额外节点）', () => {
        session.setSessionsUntilLongBreak(10)
        const wrapper = mountIndicator()

        expect(dotCount(wrapper)).toBe(10)
        expect(wrapper.attributes('aria-label')).toBe('共 10 轮一轮长休')

        wrapper.unmount()
    })

    it('M=1 专注中 ⇒ 1 个空心圆点 + 「第 1/1 轮 · 本轮结束后长休」（无 M=1 特例）', () => {
        session.setSessionsUntilLongBreak(1)
        const wrapper = mountIndicator()
        timer.start()
        return wrapper.vm.$nextTick().then(() => {
            expect(dotCount(wrapper)).toBe(1)
            expect(filledCount(wrapper)).toBe(0)
            expect(wrapper.attributes('aria-label')).toBe('第 1/1 轮 · 本轮结束后长休')
            wrapper.unmount()
        })
    })
})