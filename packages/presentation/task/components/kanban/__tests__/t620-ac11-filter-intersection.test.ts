// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    columnNode,
    columnTotal,
    listCallsFor,
    makeTask,
    mountKanban,
    scrollToBottom,
    settle,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * `T620` AC11 —— **筛选求交**（PRD R-I / ADR 硬约束 1）
 *
 * @description 用户基础筛选（`getTasksOptions.priority = 'high'`）与列条件必须**求交**：
 *              「中 / 低」列 **0 条且对该列零请求** —— 不是「先发出去再在客户端过滤」。
 *              判据 = 列内卡片 + `taskUseCase.list` 的**实际入参**（覆盖式实现会在这里露馅）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：AC11①② ⇒ **红**
 *   （现状看板不吃 `getTasksOptions` ⇒ 「中 / 低」列把 10 / 5 条全渲染出来）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const pad = (value: number): string => String(value).padStart(2, '0')

/** 23 高 + 10 中 + 5 低（同状态待办） */
const makeFilteredTasks = (): TaskViewObject[] => [
    ...Array.from({ length: 23 }, (_, index) =>
        makeTask({ id: `high-${pad(index + 1)}`, state: 'todo', priority: 'high' })
    ),
    ...Array.from({ length: 10 }, (_, index) =>
        makeTask({ id: `medium-${pad(index + 1)}`, state: 'todo', priority: 'medium' })
    ),
    ...Array.from({ length: 5 }, (_, index) =>
        makeTask({ id: `low-${pad(index + 1)}`, state: 'todo', priority: 'low' })
    )
]

const mountFiltered = () =>
    mountKanban(makeFilteredTasks(), null, {
        groupBy: 'priority',
        getTasksOptions: { priority: 'high' }
    })

describe('T620 AC11 · 用户筛选优先级=高 ⇒ 中/低列 0 条且零请求', () => {
    it('AC11① 「中」「低」（以及「紧急」）列 0 条，且对该列零请求（不是先查再过滤）', async () => {
        const h = mountFiltered()
        wrapper = h.wrapper
        await settle()

        for (const category of ['urgent', 'medium', 'low']) {
            expect(
                taskIdsIn(columnNode(h.wrapper, category)),
                `「${category}」列与用户筛选求交为空 ⇒ 必须 0 条`
            ).toEqual([])
            expect(
                columnTotal(columnNode(h.wrapper, category)),
                `「${category}」列列头应为 0`
            ).toBe(0)
            expect(
                listCallsFor(h, 'priority', category),
                `「${category}」列求交为空 ⇒ 不得发起查询（实测入参 ${JSON.stringify(listCallsFor(h, 'priority', category))}）`
            ).toEqual([])
        }

        // 更强的反证：任何一次查询都不得把用户筛选覆盖掉
        const offenders = h
            .listCalls()
            .filter((options) => !(options.priority ?? '').split(',').includes('high'))
        expect(
            offenders,
            `所有列查询都必须保留用户筛选 priority=high（覆盖式实现会在这里被抓住）：${JSON.stringify(offenders)}`
        ).toEqual([])
    })

    it('AC11② 「高」列正常分页：20 → 23（求交不是把高列也一起掐掉）', async () => {
        const h = mountFiltered()
        wrapper = h.wrapper
        await settle()

        expect(taskIdsIn(columnNode(h.wrapper, 'high')), '「高」列第 1 页 20 条').toHaveLength(20)
        expect(columnTotal(columnNode(h.wrapper, 'high')), '「高」列总数 23').toBe(23)
        expect(listCallsFor(h, 'priority', 'high'), '「高」列首屏 1 次查询').toHaveLength(1)

        await scrollToBottom(h.wrapper, 'high')
        expect(taskIdsIn(columnNode(h.wrapper, 'high')), '触底后 23 条').toHaveLength(23)
        expect(listCallsFor(h, 'priority', 'high'), '「高」列共 2 次查询').toHaveLength(2)
    })
})