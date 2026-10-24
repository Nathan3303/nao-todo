// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import useTaskReminder from '../use-task-reminder'

/**
 * T525 · AC9（弹窗内点任务名 ⇒ 打开任务详情）
 *
 * @description 现状 `viewDetail` 是注释掉的空实现（`use-task-reminder.ts:80-84`）⇒ 点了没反应。
 *              改造口径（报告 §1）：**不引 router**，经 props `onOpenTask(taskId)` 由装配层注入。
 *              弹窗动作集不变（确认 + 稍后），故追加断言「仅跳转、不动队列」。
 * @see docs/prds/2026-10-23-reminder-local-polling.md §七 AC9
 */

type ReminderProps = Parameters<typeof useTaskReminder>[0] & {
    onOpenTask?: (taskId: string) => void
}

const makeApi = (onOpenTask?: (taskId: string) => void) => {
    const api = useTaskReminder({
        dialogManager: {} as never,
        taskUseCase: {} as never,
        onOpenTask
    } as ReminderProps)
    // T531：事件扩 projectId / remindAt（清单名与原定时间）
    api.enqueue({ taskId: 't1', taskName: '买菜', projectId: 'p1', remindAt: '' })
    api.enqueue({ taskId: 't2', taskName: '洗车', projectId: 'p1', remindAt: '' })
    return api
}

beforeEach(() => {
    setActivePinia(createPinia())
})

describe('T525 · AC9 提醒弹窗内打开任务详情', () => {
    it('AC9 点任务名 ⇒ 以当前提醒的任务 id 调 onOpenTask', () => {
        const onOpenTask = vi.fn()
        const api = makeApi(onOpenTask)

        api.viewDetail()

        expect(onOpenTask).toHaveBeenCalledTimes(1)
        expect(onOpenTask).toHaveBeenCalledWith('t1')
    })

    it('AC9 仅跳转、不改队列（动作集仍只有确认 + 稍后）', () => {
        const api = makeApi(vi.fn())

        api.viewDetail()

        expect(api.queue.value.length).toBe(2)
        expect(api.currentEvent.value?.taskId).toBe('t1')
    })

    it('AC9 未注入 onOpenTask ⇒ 不抛错（装配缺失时防御）', () => {
        const api = makeApi(undefined)

        expect(() => api.viewDetail()).not.toThrow()
    })
})