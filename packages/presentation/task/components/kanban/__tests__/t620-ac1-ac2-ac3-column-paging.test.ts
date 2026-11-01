// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    columnNode,
    columnTotal,
    isNoMoreVisible,
    listCallsFor,
    makeTask,
    mountKanban,
    scrollToBottom,
    settle,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * `T620` AC1 / AC2 / AC3 —— 看板**列内独立分页**主路径（`DEF-126`）
 *
 * @description 判据落点 = 列内卡片（用户可见）+ `taskUseCase.list` 入参（分页是否真按列发生）。
 *              触底走 `nue-infinite-scroll` 自己的 IntersectionObserver 路径（harness
 *              `scrollToBottom`），`disabled` 由组件自己拦 —— 不用手工 emit 绕过守卫。
 *
 * PRD `docs/prds/2026-11-01-kanban-column-paging.md`：
 *   - R-A：每列每页 **20** 条；R-B：到底文案「没有更多了」；R-D：列头 = 该列**总数**。
 *   - AC1：45 条 ⇒ 触底 20→40→45，再触底不再增长；卡片不重复不丢。
 *   - AC2：待办 45 / 已完成 3，待办触底 ⇒ 已完成列卡片与页码**不变**（列间隔离）。
 *   - AC3：待办 45 仅加载 20 ⇒ 列头显示 **45**（总数，不是已加载数）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：
 *   - AC1①② ⇒ **红**（列内 `loadMore` 是空函数、`isDone` 恒真 ⇒ 触底不增长；且首屏一次性渲染全部 45 条）
 *   - AC2 ⇒ **红**（待办首屏即 45 条，与「只加载第 1 页」相反）
 *   - AC3 ⇒ **红**（列头数字现在是「已加载条数」`columnTasks.length`，与总数偶然相等 ⇒ 必须用「只加载 20 条时列头仍为 45」来判）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const pad = (value: number): string => String(value).padStart(2, '0')

/** 同状态批量任务（顺序稳定：`todo-01` → `todo-45`） */
const makeTodoTasks = (count: number): TaskViewObject[] =>
    Array.from({ length: count }, (_, index) =>
        makeTask({ id: `todo-${pad(index + 1)}`, state: 'todo', priority: 'medium' })
    )

const todoIds = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `todo-${pad(index + 1)}`)

describe('T620 AC1 · 列内翻页（45 条 ⇒ 20 → 40 → 45）', () => {
    it('AC1① 首屏只加载第 1 页 20 条；触底 20→40→45（不是全列合计 20）', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()

        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')),
            '看板首屏必须只加载该列第 1 页（20 条）；实测（含「全列合计 ≤20」的现状缺陷）'
        ).toHaveLength(20)
        expect(listCallsFor(h, 'state', 'todo'), '首屏只应查该列 1 次').toHaveLength(1)

        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '第 1 次触底应追加到 40 条').toHaveLength(
            40
        )

        await scrollToBottom(h.wrapper, 'todo')
        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')),
            '第 2 次触底应追加到 45 条（末页 5 条）'
        ).toHaveLength(45)
    })

    it('AC1② 追加不重复、不丢：每轮条数 20→40→45，并集 = 全 45 条且顺序稳定', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()

        const sizes: number[] = []
        let seen: string[] = []
        for (let round = 0; round < 3; round += 1) {
            const ids = taskIdsIn(columnNode(h.wrapper, 'todo'))
            expect(ids, `第 ${round + 1} 次观察出现重复卡片`).toHaveLength(new Set(ids).size)
            sizes.push(ids.length)
            seen = ids
            await scrollToBottom(h.wrapper, 'todo')
        }

        expect(sizes, '每轮观察到的条数必须是 20→40→45（分页生效且不跳条）').toEqual([20, 40, 45])
        expect(seen, '翻页后必须能看全该列 45 条，且不跳条').toEqual(todoIds(45))
    })

    it('AC1③ 到底后再触底：不增长、不报错（文案见 AC4）', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()

        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        const settled = taskIdsIn(columnNode(h.wrapper, 'todo'))
        expect(settled).toHaveLength(45)

        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '到底后不得再增长').toEqual(settled)
        expect(isNoMoreVisible(columnNode(h.wrapper, 'todo')), '到底文案「没有更多了」应可见').toBe(
            true
        )
    })
})

describe('T620 AC2 · 列间隔离（待办触底不影响已完成列）', () => {
    const makeMixedFixture = (): TaskViewObject[] => [
        ...makeTodoTasks(45),
        makeTask({ id: 'done-01', state: 'done', priority: 'medium' }),
        makeTask({ id: 'done-02', state: 'done', priority: 'medium' }),
        makeTask({ id: 'done-03', state: 'done', priority: 'medium' })
    ]

    it('AC2① 待办列触底两次 ⇒ 已完成列卡片与列头总数逐项不变', async () => {
        const h = mountKanban(makeMixedFixture())
        wrapper = h.wrapper
        await settle()

        const doneIdsBefore = taskIdsIn(columnNode(h.wrapper, 'done'))
        const doneTotalBefore = columnTotal(columnNode(h.wrapper, 'done'))
        const doneCallsBefore = listCallsFor(h, 'state', 'done').length
        expect(doneIdsBefore, '已完成列 3 条应一屏显示').toEqual(['done-01', 'done-02', 'done-03'])

        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')

        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')),
            '待办列应已加载 45 条（对照：本用例主判据在下方「已完成列不变」）'
        ).toHaveLength(45)
        expect(taskIdsIn(columnNode(h.wrapper, 'done')), '已完成列卡片不得变化').toEqual(
            doneIdsBefore
        )
        expect(columnTotal(columnNode(h.wrapper, 'done')), '已完成列总数不得变化').toBe(
            doneTotalBefore
        )
        expect(
            listCallsFor(h, 'state', 'done').length,
            '已完成列已到底 ⇒ 不得因待办列触底而重新查询'
        ).toBe(doneCallsBefore)
    })

    it('AC2② 各列独立分页：待办 1 次查询/页，已完成只有首屏 1 次', async () => {
        const h = mountKanban(makeMixedFixture())
        wrapper = h.wrapper
        await settle()
        await scrollToBottom(h.wrapper, 'todo')

        expect(listCallsFor(h, 'state', 'todo'), '待办列应查 2 次（第 1、2 页）').toHaveLength(2)
        expect(listCallsFor(h, 'state', 'done'), '已完成列只有首屏 1 次查询').toHaveLength(1)
    })
})

describe('T620 AC3 · 列头 = 该列总数（不是已加载数）', () => {
    it('AC3① 待办 45 条仅加载 20 条 ⇒ 列头显示 45', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()

        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '前置：只加载第 1 页').toHaveLength(20)
        expect(
            columnTotal(columnNode(h.wrapper, 'todo')),
            '列头数字必须是该列总数（45），不是已加载数（20）—— PRD R-D'
        ).toBe(45)
    })

    it('AC3② 触底加载后列头仍为总数 45（不随已加载数变化）', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()
        await scrollToBottom(h.wrapper, 'todo')

        expect(taskIdsIn(columnNode(h.wrapper, 'todo'))).toHaveLength(40)
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '已加载 40 条时列头仍是 45').toBe(45)
    })
})