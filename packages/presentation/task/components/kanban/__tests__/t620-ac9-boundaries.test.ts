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
 * `T620` AC9 —— 分页边界：**0 条 / 恰好 20 条 / 21 条**（PRD R-K）
 *
 * @description 「恰好 20 条」是最容易被误判的边界：共享 loader 的 `isDone = taskIds.length < limit`
 *              会把「刚好满一页」判成「未到底」⇒ 多一次空查询 + 到底文案晚一屏。
 *              列内口径必须是 `page * limit >= total`（R-K）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：
 *   - AC9①（0 条）⇒ 现 **绿**（既有空态文案）；保留为护栏（分页改造不得破坏空态）
 *   - AC9②（恰好 20）⇒ **红**（列内不查库、到底文案是「没有更多数据了」且被 CSS 隐藏）
 *   - AC9③（21 条）⇒ **红**（同上，且触底不追加载第 2 页那 1 条）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const pad = (value: number): string => String(value).padStart(2, '0')

const makeTodoTasks = (count: number): TaskViewObject[] =>
    Array.from({ length: count }, (_, index) =>
        makeTask({ id: `todo-${pad(index + 1)}`, state: 'todo', priority: 'medium' })
    )

const columnText = (w: VueWrapper, category: string): string =>
    (columnNode(w, category).element.textContent ?? '').replace(/\s+/g, '')

describe('T620 AC9 · 边界（0 / 恰好 20 / 21）', () => {
    it('AC9① 0 条 ⇒ 既有空态（不是「没有更多了」也不是崩溃）', async () => {
        const h = mountKanban([makeTask({ id: 'done-01', state: 'done', priority: 'medium' })])
        wrapper = h.wrapper
        await settle()

        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '空列不得有卡片').toEqual([])
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '空列列头 = 0').toBe(0)
        expect(columnText(h.wrapper, 'todo'), '空列应显示既有空态文案').toContain('无待办任务')
    })

    it('AC9② 恰好 20 条 ⇒ 首屏即到底（文案可见）且**零额外请求**', async () => {
        const h = mountKanban(makeTodoTasks(20))
        wrapper = h.wrapper
        await settle()

        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '恰好一页应全部显示').toHaveLength(20)
        expect(
            listCallsFor(h, 'state', 'todo'),
            '恰好 20 条 ⇒ 只应有首屏 1 次查询（不得因 `length < limit` 误判再多查一次）'
        ).toHaveLength(1)
        expect(
            isNoMoreVisible(columnNode(h.wrapper, 'todo')),
            '第 1 页加载完即应显示「没有更多了」（R-K）'
        ).toBe(true)

        await scrollToBottom(h.wrapper, 'todo')
        expect(listCallsFor(h, 'state', 'todo').length, '已到底 ⇒ 再触底不得产生额外查询').toBe(1)
    })

    it('AC9③ 21 条 ⇒ 第 1 页 20 条，触底补 1 条后到底', async () => {
        const h = mountKanban(makeTodoTasks(21))
        wrapper = h.wrapper
        await settle()

        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '第 1 页 = 20 条').toHaveLength(20)
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '列头总数 = 21').toBe(21)
        expect(
            isNoMoreVisible(columnNode(h.wrapper, 'todo')),
            '还有 1 条未加载 ⇒ 不得显示到底文案'
        ).toBe(false)

        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '第 2 页补 1 条').toHaveLength(21)
        expect(listCallsFor(h, 'state', 'todo'), '共 2 次查询').toHaveLength(2)
        expect(
            isNoMoreVisible(columnNode(h.wrapper, 'todo')),
            '补完最后 1 条后应显示「没有更多了」'
        ).toBe(true)
    })
})