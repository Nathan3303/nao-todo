// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useCalendarSchedule } from '../use-calendar-schedule'

/**
 * T364 撤销入口状态机（useCalendarSchedule）
 * @description 成功/失败终态**只能来自真实写回结果**（禁止乐观置位）：
 *              - 全部写回成功 ⇒ undone（终态，连点/连击最多生效一次）
 *              - 任一失败 ⇒ failed（不显示已撤销，入口保留可重试）
 *              - 新动作到达 ⇒ 状态重置为 idle（旧消息仍由 `undo-message` 按原逻辑 close）
 */

const hoisted = vi.hoisted(() => ({ update: vi.fn() }))
const messageMock = vi.hoisted(() =>
    Object.assign(vi.fn(), { error: vi.fn(), warn: vi.fn(), success: vi.fn(), info: vi.fn() })
)

vi.mock('nue-ui', async (importOriginal) => ({
    ...(await importOriginal<typeof import('nue-ui')>()),
    NueMessage: messageMock
}))
vi.mock('@/hooks', () => ({ useTaskUseCase: () => ({ update: hoisted.update }) }))

const makeTask = (): TaskViewObject =>
    ({
        id: 't1',
        name: '任务 A',
        state: 'todo',
        priority: 'low',
        startAt: '2026-09-25T01:00:00.000Z',
        endAt: '2026-09-25T02:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z'
    }) as unknown as TaskViewObject

const setup = (): ReturnType<typeof useCalendarSchedule> => {
    let api!: ReturnType<typeof useCalendarSchedule>
    mount(
        defineComponent({
            setup() {
                api = useCalendarSchedule({ taskUseCase: { update: hoisted.update } } as never)
                return () => h('div')
            }
        })
    )
    return api
}

beforeEach(() => {
    hoisted.update.mockReset().mockResolvedValue(null)
    messageMock.mockReset().mockImplementation(() => ({ close: vi.fn() }))
    messageMock.error.mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('T364 撤销状态机（useCalendarSchedule）', () => {
    it('成功：全部写回成功才入 undone 终态；再点不再发请求（幂等，最多生效一次）', async () => {
        const api = setup()
        await api.scheduleToDay(makeTask(), '2026-10-05')
        expect(api.undoStatus.value).toBe('idle')
        expect(hoisted.update).toHaveBeenCalledTimes(1)

        await api.undoLast()
        expect(api.undoStatus.value).toBe('undone')
        expect(hoisted.update).toHaveBeenCalledTimes(2)
        // 终态仍保留入口（等既有超时消失），但不为可点
        expect(api.undoAction.value).not.toBeNull()

        await api.undoLast()
        await api.undoLast()
        expect(hoisted.update).toHaveBeenCalledTimes(2)
    })

    it('并发连点：两次 undoLast 只发一轮写回', async () => {
        const api = setup()
        await api.scheduleToDay(makeTask(), '2026-10-05')
        const before = hoisted.update.mock.calls.length

        await Promise.all([api.undoLast(), api.undoLast()])

        expect(hoisted.update.mock.calls.length - before).toBe(1)
        expect(api.undoStatus.value).toBe('undone')
    })

    it('失败：不得进入 undone（failed）；入口保留、重试成功后才转 undone', async () => {
        const api = setup()
        await api.scheduleToDay(makeTask(), '2026-10-05')

        hoisted.update.mockResolvedValueOnce('boom')
        await api.undoLast()
        expect(api.undoStatus.value).toBe('failed')
        expect(api.undoAction.value).not.toBeNull() // 入口仍在，可重试

        hoisted.update.mockResolvedValueOnce(null)
        await api.undoLast()
        expect(api.undoStatus.value).toBe('undone')
    })

    it('新动作替换旧终态：状态重置为 idle，入口文案为最新一次动作', async () => {
        const api = setup()
        await api.scheduleToDay(makeTask(), '2026-10-05')
        await api.undoLast()
        expect(api.undoStatus.value).toBe('undone')

        await api.scheduleToDay(makeTask(), '2026-10-08')
        expect(api.undoStatus.value).toBe('idle')
        expect(api.undoAction.value?.text).toBe('已移至 10 月 8 日')
    })
})