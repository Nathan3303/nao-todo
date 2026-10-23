import { describe, expect, it } from 'vite-plus/test'
import { collectDueReminders, type ReminderTask } from '@nao-todo/shared/reminder'
import { isoOffset, makeTask } from './reminder-harness'

/**
 * T525 · 纯核心 `collectDueReminders`（判定口径）
 *
 * @see ../__tests__/reminder-harness.ts（契约总表）
 * AC 映射：AC1（主路径判定）· AC7（活跃过滤 / 子任务）· AC8（键随 remindAt 变化）·
 *          AC6（脏数据不参与）· NFR R8（解析后比较）
 */

const BASE = new Date('2026-10-23T10:00:00.000Z').getTime()
const nothingClaimed = (): boolean => false
/** 判定的返回值条目（显式标注，避免依赖未实现的模块导出做推断） */
type DueItem = { task: ReminderTask; key: string }

describe('collectDueReminders · 主路径（AC1）', () => {
    it('AC1 到期活跃任务 ⇒ 返回 1 条，键 = `taskId@remindAt`，携带原任务对象', () => {
        const task = makeTask({
            id: 't1',
            name: '买菜',
            description: '别忘了',
            remindAt: isoOffset(BASE, -1000)
        })

        const due = collectDueReminders([task], BASE, nothingClaimed)

        expect(due).toHaveLength(1)
        expect(due[0]?.task).toBe(task)
        expect(due[0]?.key).toBe(`t1@${task.remindAt}`)
    })

    it('AC1 无到期项 ⇒ 返回空（不产生任何事件）', () => {
        const future = makeTask({ id: 't2', remindAt: isoOffset(BASE, 60_000) })
        const noRemind = makeTask({ id: 't3', remindAt: null })

        expect(collectDueReminders([future, noRemind], BASE, nothingClaimed)).toEqual([])
        expect(collectDueReminders([], BASE, nothingClaimed)).toEqual([])
    })

    it('AC1 到期时间必须**解析**后比较（RFC3339 带时区偏移，字符串比较不可靠）', () => {
        // 2026-10-23T18:00:00+08:00 === 2026-10-23T10:00:00Z === BASE
        const task = makeTask({ id: 't4', remindAt: '2026-10-23T18:00:00+08:00' })

        expect(collectDueReminders([task], BASE, nothingClaimed)).toHaveLength(1)
    })
})

describe('collectDueReminders · 边界（AC1 / AC5 前置）', () => {
    it('闭区间：remindAt === now 触发；早 1ms 触发；晚 1ms 不触发', () => {
        const exactly = makeTask({ id: 'eq', remindAt: isoOffset(BASE, 0) })
        const justPast = makeTask({ id: 'past', remindAt: isoOffset(BASE, -1) })
        const justFuture = makeTask({ id: 'future', remindAt: isoOffset(BASE, 1) })

        const keys = collectDueReminders([exactly, justPast, justFuture], BASE, nothingClaimed).map(
            (item: DueItem) => item.key
        )

        expect(keys).toEqual([`past@${justPast.remindAt}`, `eq@${exactly.remindAt}`])
    })

    it('多条到期 ⇒ 按 remindAt 升序；同刻保持入参顺序（稳定排序）', () => {
        const late = makeTask({ id: 'late', remindAt: isoOffset(BASE, -1000) })
        const early = makeTask({ id: 'early', remindAt: isoOffset(BASE, -5000) })
        const tieA = makeTask({ id: 'tie-a', remindAt: isoOffset(BASE, -2000) })
        const tieB = makeTask({ id: 'tie-b', remindAt: isoOffset(BASE, -2000) })

        const ids = collectDueReminders([late, early, tieA, tieB], BASE, nothingClaimed).map(
            (item: DueItem) => item.task.id
        )

        expect(ids).toEqual(['early', 'tie-a', 'tie-b', 'late'])
    })
})

describe('collectDueReminders · 活跃过滤（AC7，对齐 ADR D1）', () => {
    it('AC7 done / 归档 / 放弃 / 删除 ⇒ 全部不弹', () => {
        const tasks = [
            makeTask({ id: 'done', remindAt: isoOffset(BASE, -1000), state: 'done' }),
            makeTask({
                id: 'archived',
                remindAt: isoOffset(BASE, -1000),
                archivedAt: isoOffset(BASE, -9000)
            }),
            makeTask({
                id: 'given-up',
                remindAt: isoOffset(BASE, -1000),
                givenUpAt: isoOffset(BASE, -9000)
            }),
            makeTask({
                id: 'deleted',
                remindAt: isoOffset(BASE, -1000),
                deletedAt: isoOffset(BASE, -9000)
            })
        ]

        expect(collectDueReminders(tasks, BASE, nothingClaimed)).toEqual([])
    })

    it('AC7 未完成状态（todo / in-progress）仍弹', () => {
        const tasks = [
            makeTask({ id: 'todo', remindAt: isoOffset(BASE, -1000), state: 'todo' }),
            makeTask({ id: 'doing', remindAt: isoOffset(BASE, -1000), state: 'in-progress' })
        ]

        expect(collectDueReminders(tasks, BASE, nothingClaimed)).toHaveLength(2)
    })

    it('AC7 子任务不过滤（parentTaskId 非空照常弹；与顶层同口径）', () => {
        const child = makeTask({
            id: 'child',
            parentTaskId: 'parent-1',
            remindAt: isoOffset(BASE, -1000)
        })

        const due = collectDueReminders([child], BASE, nothingClaimed)

        expect(due.map((item: DueItem) => item.task.id)).toEqual(['child'])
    })
})

describe('collectDueReminders · 异常与去重（AC6 / AC3 前置）', () => {
    it('AC6 remindAt 缺失 / 空串 / 非法日期 ⇒ 跳过（且不产生键，避免脏数据被记成已交付）', () => {
        const tasks = [
            makeTask({ id: 'null', remindAt: null }),
            makeTask({ id: 'empty', remindAt: '' }),
            makeTask({ id: 'garbage', remindAt: 'not-a-date' })
        ]

        expect(collectDueReminders(tasks, BASE, nothingClaimed)).toEqual([])
    })

    it('AC3 已落账的键 ⇒ 不返回（重复扫描幂等）', () => {
        const task = makeTask({ id: 't9', remindAt: isoOffset(BASE, -1000) })
        const claimed = new Set([`t9@${task.remindAt}`])

        const due = collectDueReminders([task], BASE, (key: string) => claimed.has(key))

        expect(due).toEqual([])
    })

    it('AC8 Snooze 后 remindAt 变化 ⇒ 键变 ⇒ 视为新到期项（旧键不影响）', () => {
        const snoozed = makeTask({ id: 't10', remindAt: isoOffset(BASE, -2000) })
        const oldKey = `t10@${isoOffset(BASE, -900_000)}`
        const claimed = new Set([oldKey])

        const due = collectDueReminders([snoozed], BASE, (key: string) => claimed.has(key))

        expect(due.map((item: DueItem) => item.key)).toEqual([`t10@${snoozed.remindAt}`])
    })
})