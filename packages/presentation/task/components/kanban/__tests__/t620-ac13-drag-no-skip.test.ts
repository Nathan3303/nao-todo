// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    columnNode,
    columnTotal,
    dragTaskTo,
    makeTask,
    mountKanban,
    scrollToBottom,
    scrollUntilStable,
    settle,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * `T620` AC13 —— 拖拽后继续触底**不跳条**（PRD R-M / D3）
 *
 * @description 本地仓储分页是 `slice((page-1)*limit, …)`（偏移分页）⇒ 源列被拖走一条后，
 *              直接查下一页会**跳过 1 条**。口径：源列标 `needsRefill`，下次触底先补回已加载区间。
 *              判据 = 与拖拽前的已加载集合比对：最终可加载集合 = 「该列全部任务 − 被拖走的那条」，
 *              **既不缺（跳条）也不重（重复渲染）**。
 *
 * 夹具选 65 条：3 页 = 60 条，被拖走的是第 5 条（在前 3 页内）⇒ 若只查第 4 页，
 * 原第 61 条会被永久跳过（测试在最终集合里精确捕捉这一条）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：AC13①② ⇒ **红**
 *   （现状不翻页、拖拽后卡片不动 ⇒ 源列仍是 65 条，目标列不含被拖走的卡）
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

const allTodoIds = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `todo-${pad(index + 1)}`)

describe('T620 AC13 · 拖走一条后继续触底：不跳条、不重复', () => {
    it('AC13① 源列已加载 3 页 ⇒ 拖走第 5 条 ⇒ 继续触底可加载「其余全部 64 条」', async () => {
        const TODO_COUNT = 65
        const MOVED_ID = 'todo-05'
        const h = mountKanban([
            ...makeTodoTasks(TODO_COUNT),
            makeTask({ id: 'done-01', state: 'done', priority: 'medium' })
        ])
        wrapper = h.wrapper
        await settle()

        // 前置：已加载 3 页（60 条）
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        const loadedBefore = taskIdsIn(columnNode(h.wrapper, 'todo'))
        expect(loadedBefore, '前置：源列已加载 3 页').toHaveLength(60)
        expect(loadedBefore, '前置：被拖走的任务在已加载区间内').toContain(MOVED_ID)

        await dragTaskTo(h.wrapper, MOVED_ID, 'done')
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '源列 total 应 -1').toBe(TODO_COUNT - 1)
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '被拖走的卡应即时离开源列').not.toContain(
            MOVED_ID
        )
        expect(taskIdsIn(columnNode(h.wrapper, 'done')), '被拖走的卡应即时出现在目标列').toContain(
            MOVED_ID
        )

        // 继续触底直到取尽
        const finalIds = await scrollUntilStable(h.wrapper, 'todo', 6)
        expect(finalIds, '最终不得出现重复卡片').toHaveLength(new Set(finalIds).size)

        const expected = allTodoIds(TODO_COUNT).filter((id) => id !== MOVED_ID)
        const missing = expected.filter((id) => !finalIds.includes(id))
        const unexpected = finalIds.filter((id) => !expected.includes(id))
        expect(
            missing,
            `拖拽后继续触底不得跳条（缺失 ${JSON.stringify(missing)}；偏移分页的经典漏项 = 原第 61 条 todo-61）`
        ).toEqual([])
        expect(
            unexpected,
            `不得多出任务（含被拖走的卡回魂）：${JSON.stringify(unexpected)}`
        ).toEqual([])
    })

    it('AC13② 拖拽不塌回第 1 页：拖拽后已加载条数不减少（除被拖走的那 1 条）', async () => {
        const h = mountKanban([
            ...makeTodoTasks(65),
            makeTask({ id: 'done-01', state: 'done', priority: 'medium' })
        ])
        wrapper = h.wrapper
        await settle()

        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        const loadedBefore = taskIdsIn(columnNode(h.wrapper, 'todo')).length

        await dragTaskTo(h.wrapper, 'todo-05', 'done')

        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')).length,
            '本地增量：已加载的其余 59 条必须保留（不得整板重查塌回第 1 页 20 条）'
        ).toBe(loadedBefore - 1)
    })
})