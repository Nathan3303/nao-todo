import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    createReminderEngine,
    type ReminderTask,
    type TaskReminderEvent
} from '@nao-todo/shared/reminder'
import { FakeStorage, flushMicrotasks, makeTask } from './reminder-harness'

/**
 * T531 · 提醒事件字段扩展（AC8 事件载荷 · 红基线）
 *
 * 契约（架构报告 §5.1，`packages/shared/types/reminder.ts`）：
 *
 * ```ts
 * export type TaskReminderEvent = {
 *     taskId: string
 *     taskName: string
 *     description?: string
 *     projectId: string   // 候选透出（`ReminderTask.projectId`），弹窗按它解析清单名
 *     remindAt: string    // **本次触发时刻**（原值），不是推进后的下一次
 * }
 * ```
 *
 * 为什么必须是事件携带而非弹窗读 store：引擎在 `notify` 之后**立即** consume
 * （`create-reminder-engine.ts` 现状），弹窗渲染时任务 `remindAt` 已被推进（重复提醒）
 * 或已清空（一次性）⇒ 从 store 读到的不是「原定时间」，补弹场景会显示错误时刻。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §七 AC8
 */

const BASE = new Date(2026, 9, 24, 23, 0, 0, 0).getTime()
const isoAt = (ms: number): string => new Date(ms).toISOString()

const createEngine = (
    tasks: ReminderTask[],
    onConsume?: (id: string, next: string | null) => void
) => {
    const notify = vi.fn((_event: TaskReminderEvent) => undefined)
    const storage = new FakeStorage()
    const engine = createReminderEngine({
        listCandidates: async () => tasks,
        now: () => BASE,
        ledger: {
            claim: (() => {
                const keys = new Set<string>()
                return (key: string) => (keys.has(key) ? false : (keys.add(key), true))
            })(),
            has: () => false
        },
        notify,
        consume: (taskId, nextRemindAt) => onConsume?.(taskId, nextRemindAt)
    })
    return { engine, notify, storage }
}

beforeEach(() => {
    vi.useFakeTimers({ now: BASE })
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('T531 · AC8 事件携带清单与触发时刻', () => {
    it('AC8 事件携带 projectId（来自候选任务）', async () => {
        const task = makeTask({
            id: 't1',
            remindAt: isoAt(BASE - 60_000),
            projectId: 'project-work'
        })
        const { engine, notify } = createEngine([task])

        engine.start()
        await flushMicrotasks()

        const event = notify.mock.calls[0]?.[0] as TaskReminderEvent
        expect(event.projectId).toBe('project-work')
    })

    it('AC8 事件 remindAt = 原定触发时刻（重复提醒被推进后仍是原值）', async () => {
        const firedAt = isoAt(BASE - 60_000)
        const task = makeTask({
            id: 'daily',
            remindAt: firedAt,
            remindRepeat: 'daily',
            remindTime: '23:00'
        })
        const { engine, notify } = createEngine([task], (id, next) => {
            if (id === task.id) task.remindAt = next
        })

        engine.start()
        await flushMicrotasks()

        const event = notify.mock.calls[0]?.[0] as TaskReminderEvent
        expect(event.remindAt).toBe(firedAt)
        expect(task.remindAt).not.toBe(firedAt) // 消费已推进
        expect(new Date(task.remindAt as string).getTime()).toBeGreaterThan(
            new Date(firedAt).getTime()
        )
    })

    it('AC8 一次性提醒：事件 remindAt = 原值，消费后任务 remindAt 清空', async () => {
        const firedAt = isoAt(BASE - 120_000)
        const task = makeTask({ id: 'once', remindAt: firedAt, remindRepeat: 'none' })
        const { engine, notify } = createEngine([task], (id, next) => {
            if (id === task.id) task.remindAt = next
        })

        engine.start()
        await flushMicrotasks()

        const event = notify.mock.calls[0]?.[0] as TaskReminderEvent
        expect(event.remindAt).toBe(firedAt)
        expect(task.remindAt).toBeNull()
    })

    it('AC8 补弹（原定时刻远早于当前）：事件仍携带原定时刻，不被改写', async () => {
        // 免打扰补弹场景：22:10 到点、次日 08:00 才弹 ⇒ 事件必须携带 22:10（弹窗标注「原定 …」）
        const firedAt = isoAt(BASE - 9 * 60 * 60_000)
        const task = makeTask({ id: 'quiet', remindAt: firedAt })
        const { engine, notify } = createEngine([task])

        engine.start()
        await flushMicrotasks()

        const event = notify.mock.calls[0]?.[0] as TaskReminderEvent
        expect(event.remindAt).toBe(firedAt)
        expect(new Date(event.remindAt).getTime()).toBeLessThan(BASE)
    })

    it('AC12 去重键格式不变（`taskId@remindAt`，R2 单一键）', async () => {
        const firedAt = isoAt(BASE - 60_000)
        const task = makeTask({ id: 't1', remindAt: firedAt })
        const claimKeys: string[] = []
        const notify = vi.fn()
        const engine = createReminderEngine({
            listCandidates: async () => [task],
            now: () => BASE,
            ledger: {
                claim: (key: string) => {
                    claimKeys.push(key)
                    return true
                },
                has: () => false
            },
            notify,
            consume: () => undefined
        })

        engine.start()
        await flushMicrotasks()

        expect(claimKeys).toEqual([`t1@${firedAt}`])
    })
})