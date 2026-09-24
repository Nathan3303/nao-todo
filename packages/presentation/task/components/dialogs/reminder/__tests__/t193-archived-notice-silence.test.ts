// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { NueMessage } from 'nue-ui'
import { ARCHIVED_READONLY_ERROR } from '../../../../archive-gate'
import { OFFLINE_READONLY_ERROR } from '../../../../../offline/write-gate'
import useTaskReminder from '../use-task-reminder'

/**
 * T193 · 任务提醒（延时）只读码静默（ADR §15.3 漏点 ③）
 *
 * 已归档任务到点提醒 ⇒ 点「延时提醒」`snooze` 被守卫拦截，返回 `ARCHIVED_READONLY`。
 * 守卫已弹唯一本地化提示 ⇒ 本入口不得再弹原始码；`snoozing` 复位与 `dequeue` 逻辑不被带偏。
 */

afterEach(() => {
    vi.restoreAllMocks()
})

beforeEach(() => {
    setActivePinia(createPinia())
})

const makeApi = (snoozeResult: unknown) => {
    const api = useTaskReminder({
        dialogManager: {} as never,
        taskUseCase: { snooze: vi.fn(async () => snoozeResult) } as never
    })
    api.enqueue({ taskId: 't1', taskName: '已归档任务' })
    return api
}

describe('T193 · 任务提醒只读码静默（漏点 ③）', () => {
    it('归档码 ⇒ 不弹提示；snoozing 复位、不出队（当前项保留）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})
        const api = makeApi(ARCHIVED_READONLY_ERROR)

        await api.snooze(5)

        expect(error).not.toHaveBeenCalled()
        expect(success).not.toHaveBeenCalled()
        expect(api.snoozing.value).toBe(false)
        expect(api.queue.value.length).toBe(1)
        expect(api.currentEvent.value?.taskId).toBe('t1')
    })

    it('其它错误码 ⇒ 原样透出（含原始码，防过度静默）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const api = makeApi(OFFLINE_READONLY_ERROR)

        await api.snooze(5)

        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
        expect(api.snoozing.value).toBe(false)
        expect(api.queue.value.length).toBe(1)
    })

    it('成功路径仍弹成功提示并出队', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})
        const api = makeApi(null)

        await api.snooze(5)

        expect(success).toHaveBeenCalledTimes(1)
        expect(error).not.toHaveBeenCalled()
        expect(api.queue.value.length).toBe(0)
    })
})