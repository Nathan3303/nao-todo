// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    columnNode,
    columnTotal,
    makeTask,
    scrollToBottom,
    settle,
    taskIdsIn
} from '../../../kanban/__tests__/t608-kanban-harness'
import { mountKanbanAdapter } from './t620-adapter-harness'

/**
 * `T620` AC14 —— **新增任务**：目标列置顶插入 + `total + 1` + **不塌回第 1 页**（PRD R-M / D2）
 *
 * @description 触发口 = 真实创建链路的事件 `AddNewTaskId`（创建成功后广播）⇒
 *              `subscriber.emit('AddNewTaskId', id)`（经适配器，三处页面同一条路径）。
 *              口径：**只向目标列置顶插入**，不重查整板（否则用户已滚的多页会塌回第 1 页）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：AC14①②③ ⇒ **红**
 *   （现状：新卡追加在末尾、列头数字 = 已渲染条数、且已加载集合只有适配器那一页）
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

describe('T620 AC14 · 新增任务置顶插入且保留已加载页', () => {
    it('AC14① 目标列已加载 2 页 ⇒ 新增任务出现在该列首位，total +1，已加载条数不减', async () => {
        const h = mountKanbanAdapter([
            ...makeTodoTasks(45),
            makeTask({ id: 'done-01', state: 'done', priority: 'medium' })
        ])
        wrapper = h.wrapper
        await settle()

        await scrollToBottom(h.wrapper, 'todo')
        const loadedBefore = taskIdsIn(columnNode(h.wrapper, 'todo'))
        expect(loadedBefore, '前置：已加载 2 页（40 条）').toHaveLength(40)
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '前置：总数 45').toBe(45)

        await h.addTask(makeTask({ id: 'todo-new', state: 'todo', priority: 'medium' }))

        const ids = taskIdsIn(columnNode(h.wrapper, 'todo'))
        expect(ids[0], `新增任务必须置顶（实测首位 = ${ids[0]}）`).toBe('todo-new')
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '目标列 total 应 +1').toBe(46)
        expect(ids, '已加载的 40 条必须保留（不得整板重查塌回第 1 页 20 条）').toHaveLength(
            loadedBefore.length + 1
        )
        expect(
            loadedBefore.every((id) => ids.includes(id)),
            '原已加载的卡片不得丢失'
        ).toBe(true)
    })

    it('AC14② 非目标列的列头与卡片不受影响', async () => {
        const h = mountKanbanAdapter([
            ...makeTodoTasks(45),
            makeTask({ id: 'done-01', state: 'done', priority: 'medium' })
        ])
        wrapper = h.wrapper
        await settle()

        const doneBefore = taskIdsIn(columnNode(h.wrapper, 'done'))
        const doneTotalBefore = columnTotal(columnNode(h.wrapper, 'done'))

        await h.addTask(makeTask({ id: 'todo-new', state: 'todo', priority: 'medium' }))

        expect(taskIdsIn(columnNode(h.wrapper, 'done')), '已完成列卡片不得变化').toEqual(doneBefore)
        expect(columnTotal(columnNode(h.wrapper, 'done')), '已完成列总数不得变化').toBe(
            doneTotalBefore
        )
    })
})