// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueButton } from 'nue-ui'
import ScheduleUndoToast from './undo-toast.vue'
import type { ScheduleUndoAction } from './reschedule'

/**
 * U2 action-toast 组件级断言（P3-2 / A1-U2-06）
 * @description 5s 自动消失用假定时器断言时间边界；busy 禁用+文案；撤销/超时事件上抛。
 */
const makeAction = (overrides: Partial<ScheduleUndoAction> = {}): ScheduleUndoAction => ({
    text: '已移至 10 月 5 日',
    tone: 'success',
    snapshots: [{ id: 't1', prevStartAt: null, prevEndAt: '' }],
    ...overrides
})

const bodyToast = () => document.body.querySelector<HTMLElement>('.utoast')
const bodyUndoButton = () => document.body.querySelector<HTMLButtonElement>('.utoast__undo')

let wrapper: VueWrapper | null = null

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountToast = (action: ScheduleUndoAction, busy = false) => {
    wrapper = mount(ScheduleUndoToast, {
        attachTo: document.body,
        props: { action, busy },
        global: {
            components: { NueButton },
            stubs: { transition: true }
        }
    })
    return wrapper
}

describe('ScheduleUndoToast - U2 action-toast', () => {
    it('渲染文案与撤销按钮；success 语义类', () => {
        mountToast(makeAction())
        expect(bodyToast()).toBeTruthy()
        expect(bodyToast()!.textContent).toContain('已移至 10 月 5 日')
        expect(bodyToast()!.classList.contains('utoast--success')).toBe(true)
        expect(bodyUndoButton()!.textContent).toBe('撤销')
    })

    it('warning（部分失败）tone 用 utoast--warning', () => {
        mountToast(makeAction({ tone: 'warning' }))
        expect(bodyToast()!.classList.contains('utoast--warning')).toBe(true)
    })

    it('点击撤销上抛 undo（非 busy）', async () => {
        const w = mountToast(makeAction())
        bodyUndoButton()!.click()
        expect(w.emitted('undo')).toHaveLength(1)
        expect(w.emitted('dismiss')).toBeUndefined()
    })

    it('busy：撤销按钮禁用且文案为撤销中…，点击无副作用', async () => {
        const w = mountToast(makeAction(), true)
        const btn = bodyUndoButton()!
        expect(btn.disabled).toBe(true)
        expect(btn.textContent).toBe('撤销中…')
        btn.click()
        expect(w.emitted('undo')).toBeUndefined()
    })

    it('约 5s 自动超时上抛 dismiss（时间边界：4999ms 未到、5000ms 到达）', () => {
        const w = mountToast(makeAction())
        expect(w.emitted('dismiss')).toBeUndefined()
        vi.advanceTimersByTime(4999)
        expect(w.emitted('dismiss')).toBeUndefined()
        vi.advanceTimersByTime(1)
        expect(w.emitted('dismiss')).toHaveLength(1)
    })

    it('动作替换重置计时（新动作满 5s 才 dismiss）', async () => {
        const w = mountToast(makeAction())
        vi.advanceTimersByTime(3000)
        await w.setProps({ action: makeAction({ text: '已移至 10 月 8 日' }) })
        vi.advanceTimersByTime(4999)
        expect(w.emitted('dismiss')).toBeUndefined()
        vi.advanceTimersByTime(1)
        expect(w.emitted('dismiss')).toHaveLength(1)
    })
})