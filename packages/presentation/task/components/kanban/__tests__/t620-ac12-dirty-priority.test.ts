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
    settle,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * `T620` AC12 —— 脏优先级（`null` / `''` / 未知串）必须出现在「**低**」列（PRD R-J / D1）
 *
 * @description 分列查库后，本地仓储的 `priority` 精确匹配会把白名单外的值全部漏掉（`t608-ac4` 回归）。
 *              口径（D1）：`priority` 查询含 `low` 时，把 `prioritySNMap` 白名单外的值也当 low；
 *              **读取归类不改写库中原值**（写只在真拖拽时发生）。
 *              「列表 / 表格按低筛选也含脏值」由仓储用例锁：
 *              `packages/infrastructure/src/persistence-local/__tests__/t620-ac12-low-filter-includes-dirty.test.ts`
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：
 *   - AC12① / ② ⇒ 现 **绿**（现状是客户端 `normalizeKanbanPriority` 过滤，天然归类）——
 *     **保留为回归护栏**：改为「按列查库」后它们最容易回归（ADR 风险②）
 *   - AC12③（「低」列必须真的按 `priority=low` 查库）⇒ **红**（列内目前不查库）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const DIRTY_PRIORITIES = [null, '', 'unknown-x'] as const

const dirtyTasks = (): TaskViewObject[] =>
    DIRTY_PRIORITIES.map((priority, index) =>
        makeTask({
            id: `t-dirty-${index + 1}`,
            state: 'todo',
            priority: priority as unknown as string
        })
    )

const mountDirty = () =>
    mountKanban(
        [
            ...dirtyTasks(),
            makeTask({ id: 't-low', state: 'todo', priority: 'low' }),
            makeTask({ id: 't-medium', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-high', state: 'todo', priority: 'high' })
        ],
        null,
        { groupBy: 'priority' }
    )

describe('T620 AC12 · 脏优先级归「低」列（读取归类、写时归一）', () => {
    it("AC12① null / '' / 'unknown-x' 三张卡都在「低」列，且不出现在其它列", async () => {
        const h = mountDirty()
        wrapper = h.wrapper
        await settle()

        expect(
            [...taskIdsIn(columnNode(h.wrapper, 'low'))].sort(),
            '三档脏值 + 真 low 必须都在「低」列'
        ).toEqual(['t-dirty-1', 't-dirty-2', 't-dirty-3', 't-low'])
        expect(columnTotal(columnNode(h.wrapper, 'low')), '「低」列总数 = 4').toBe(4)

        for (const category of ['urgent', 'high', 'medium']) {
            const ids = taskIdsIn(columnNode(h.wrapper, category))
            for (let index = 0; index < DIRTY_PRIORITIES.length; index += 1) {
                expect(ids, `「${category}」列不得含脏值任务 t-dirty-${index + 1}`).not.toContain(
                    `t-dirty-${index + 1}`
                )
            }
        }
        expect(taskIdsIn(columnNode(h.wrapper, 'medium')), '对照：真 medium 仍落「中」').toEqual([
            't-medium'
        ])
    })

    it('AC12② 归类是「读取时」行为：库中原值逐字不变、且不产生写操作', async () => {
        const h = mountDirty()
        wrapper = h.wrapper
        await settle()

        const priorities = DIRTY_PRIORITIES.map(
            (_, index) => h.db().find((task) => task.id === `t-dirty-${index + 1}`)?.priority
        )
        expect(priorities, '归类不得改写库中原值').toEqual([null, '', 'unknown-x'])
        expect(h.calls(), `归类不应写库：实测 ${JSON.stringify(h.calls())}`).toEqual([])
    })

    it('AC12③ 「低」列的查询必须带 `priority=low`（否则分列查库后脏值会消失）', async () => {
        const h = mountDirty()
        wrapper = h.wrapper
        await settle()

        expect(
            listCallsFor(h, 'priority', 'low'),
            '「低」列必须真的按 priority=low 查库（R-J 在仓储侧落地）'
        ).not.toHaveLength(0)
    })
})