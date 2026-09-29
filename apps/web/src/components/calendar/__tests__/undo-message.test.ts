// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    closeScheduleUndo,
    presentScheduleUndo,
    UNDO_MESSAGE_DURATION,
    type ScheduleUndoPresentation,
    type ScheduleUndoStatus
} from '../undo-message'
import type { ScheduleUndoAction } from '../monthly/reschedule'

/**
 * T362 撤销入口呈现（NueMessage extension）
 * @description 取代原 `undo-toast.vue` 的组件级断言：呈现参数（类型/时长/扩展区）、
 *              **单一入口不变量**（新动作先关上一条并令其失效）、超时失效、幂等关闭、
 *              身份守卫（不得误关他人那条）。库渲染（DOM/位置/动画）由 nue-ui 自身保障 ⇒
 *              此处 mock `NueMessage` 只断言我们下发的契约；新动作替换/超时仍按原逻辑 close。
 *
 *              T364：主文案改由扩展区组件渲染 ⇒ 库 `message` 传空串（不断言动作文案在库侧）。
 */

const messageMock = vi.hoisted(() => vi.fn())

vi.mock('nue-ui', () => ({ NueMessage: messageMock }))

type Handle = { close: ReturnType<typeof vi.fn> }
let handles: Handle[] = []

const makeAction = (overrides: Partial<ScheduleUndoAction> = {}): ScheduleUndoAction => ({
    text: '已移至 10 月 5 日',
    tone: 'success',
    snapshots: [{ id: 't1', prevStartAt: null, prevEndAt: '' }],
    ...overrides
})

const makePresentation = (
    action: ScheduleUndoAction = makeAction(),
    status: ScheduleUndoStatus = 'idle'
): { presentation: ScheduleUndoPresentation; dismiss: ReturnType<typeof vi.fn> } => {
    const dismiss = vi.fn()
    return {
        presentation: { action, status: () => status, undo: vi.fn(), dismiss },
        dismiss
    }
}

beforeEach(() => {
    vi.useFakeTimers()
    handles = []
    messageMock.mockReset().mockImplementation(() => {
        const handle: Handle = { close: vi.fn() }
        handles.push(handle)
        return handle
    })
})

afterEach(() => {
    closeScheduleUndo()
    vi.useRealTimers()
})

describe('T362 撤销入口呈现（NueMessage extension）', () => {
    it('动作出现 ⇒ 以消息呈现：空主文案/类型/时长/扩展区（扩展区携带动作文案与状态取值函数）', () => {
        const { presentation } = makePresentation()
        presentScheduleUndo(presentation)

        expect(messageMock).toHaveBeenCalledTimes(1)
        const payload = messageMock.mock.calls[0]![0] as {
            message: string
            type: string
            duration: number
            extension: (ctx: { close: () => void }) => unknown
        }
        // 主文案改由扩展区组件渲染（库 message 为静态 prop）⇒ 传空串
        expect(payload.message).toBe('')
        expect(payload.type).toBe('success')
        expect(payload.duration).toBe(UNDO_MESSAGE_DURATION)
        expect(typeof payload.extension).toBe('function')
        // 扩展区渲染函数（库注入 { close } 上下文；本实现自行收口，不依赖该上下文）
        const node = payload.extension({ close: vi.fn() }) as { props?: Record<string, unknown> }
        expect(node).toBeTruthy()
        expect(node.props?.text).toBe('已移至 10 月 5 日')
        expect(typeof node.props?.status).toBe('function')
    })

    it('warning（部分失败）tone ⇒ warning 类型；5s 时长恒定', () => {
        const { presentation } = makePresentation(makeAction({ tone: 'warning' }))
        presentScheduleUndo(presentation)
        const payload = messageMock.mock.calls[0]![0] as { type: string; duration: number }
        expect(payload.type).toBe('warning')
        expect(payload.duration).toBe(UNDO_MESSAGE_DURATION)
    })

    it('单一入口：新动作先关闭上一条消息（旧入口因消息被关而不可达）', () => {
        const first = makePresentation(makeAction({ text: '已移至 10 月 5 日' }))
        const second = makePresentation(makeAction({ text: '已移至 10 月 8 日' }))

        presentScheduleUndo(first.presentation)
        presentScheduleUndo(second.presentation)

        expect(messageMock).toHaveBeenCalledTimes(2)
        expect(handles).toHaveLength(2)
        expect(handles[0]!.close).toHaveBeenCalledTimes(1)
        expect(handles[1]!.close).not.toHaveBeenCalled()
        // ⚠️ 替换只关消息，不 dismiss 旧载荷：旧载荷可能同属一个 ref，dismiss 会把新动作一起清掉
        expect(first.dismiss).not.toHaveBeenCalled()
        expect(second.dismiss).not.toHaveBeenCalled()
    })

    it('超时失效：4999ms 未失效、5000ms 关闭消息并失效（不可再撤销）', () => {
        const { presentation, dismiss } = makePresentation()
        presentScheduleUndo(presentation)

        vi.advanceTimersByTime(UNDO_MESSAGE_DURATION - 1)
        expect(dismiss).not.toHaveBeenCalled()
        expect(handles[0]!.close).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(dismiss).toHaveBeenCalledTimes(1)
        expect(handles[0]!.close).toHaveBeenCalledTimes(1)
    })

    it('T364：成功终态（undone）不主动关闭消息 ⇒ 仍按既有超时自动消失', () => {
        const { presentation, dismiss } = makePresentation(makeAction(), 'undone')
        presentScheduleUndo(presentation)

        // 终态期间消息保持打开（状态稳定，不重建 DOM）
        vi.advanceTimersByTime(UNDO_MESSAGE_DURATION - 1)
        expect(handles[0]!.close).not.toHaveBeenCalled()
        expect(dismiss).not.toHaveBeenCalled()

        // 既有超时到点 ⇒ 自动消失
        vi.advanceTimersByTime(1)
        expect(dismiss).toHaveBeenCalledTimes(1)
        expect(handles[0]!.close).toHaveBeenCalledTimes(1)
    })

    it('替换后旧计时被清除：旧动作不再触发超时失效', () => {
        const first = makePresentation(makeAction({ text: 'A' }))
        const second = makePresentation(makeAction({ text: 'B' }))

        presentScheduleUndo(first.presentation)
        vi.advanceTimersByTime(3000)
        presentScheduleUndo(second.presentation)

        vi.advanceTimersByTime(UNDO_MESSAGE_DURATION - 1)
        expect(second.dismiss).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(second.dismiss).toHaveBeenCalledTimes(1)
        expect(first.dismiss).not.toHaveBeenCalled() // 旧计时已清除，不再失效
    })

    it('撤销完成后的收口：closeScheduleUndo 幂等（重复调用只关一次）', () => {
        const { presentation, dismiss } = makePresentation()
        presentScheduleUndo(presentation)

        closeScheduleUndo()
        closeScheduleUndo()

        expect(handles[0]!.close).toHaveBeenCalledTimes(1)
        // 关闭 ≠ 失效：失效由数据面（undoAction 置空）驱动
        expect(dismiss).not.toHaveBeenCalled()
    })

    it('身份守卫：关闭别的实例那条不得误关当前消息', () => {
        const mine = makePresentation()
        const other = makePresentation(makeAction({ text: '别人那条' }))
        presentScheduleUndo(mine.presentation)

        closeScheduleUndo(other.presentation)
        expect(handles[0]!.close).not.toHaveBeenCalled()

        closeScheduleUndo(mine.presentation)
        expect(handles[0]!.close).toHaveBeenCalledTimes(1)
    })
})