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
 * `T620` AC10 —— **三处一致**（PRD R-G：内置清单 / 普通清单 / 标签页共用一份实现）
 *
 * @description 判据分两层：
 *   ① **行为层**（会红）：三处共同挂载的 `KanbanViewAdapter` 必须真的能翻页
 *      （适配器若仍自己 `loadFirstPage` 一次、把 ≤20 条喂给看板，这一层立刻红）；
 *   ② **结构层**（护栏）：三条页面都**只**引用同一个 `KanbanViewAdapter`，页面自身不写分页逻辑
 *      （防止「三份复制」，R-G 的唯一可静态判据）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：
 *   - AC10① 行为层 ⇒ **红**（适配器只 `loadFirstPage(true)`，看板列内不分页 ⇒ 45 条只到 20）
 *   - AC10② 结构层 ⇒ 现 **绿**（三处早已共用适配器）；保留为「禁止三份复制」的护栏
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

describe('T620 AC10 · 三处共用实现（适配器）真的会翻页', () => {
    it('AC10① 经 `KanbanViewAdapter` 挂载（= 三处页面同一路径）⇒ 45 条可翻到 45', async () => {
        const h = mountKanbanAdapter(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()

        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '首屏第 1 页 20 条').toHaveLength(20)
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '列头总数 45').toBe(45)

        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '触底后 40 条').toHaveLength(40)

        await scrollToBottom(h.wrapper, 'todo')
        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')),
            '再触底 45 条（适配器不得截断在 20）'
        ).toHaveLength(45)
    })
})

describe('T620 AC10 · 结构层：三处页面共用同一适配器（禁止三份复制）', () => {
    const PAGES = {
        builtInProject: '/apps/web/src/components/tasks/built-in-project/main/index.vue',
        project: '/apps/web/src/components/tasks/project/main/index.vue',
        tag: '/apps/web/src/components/tasks/tag/main/index.vue'
    } as const

    const pageSources = (): Record<string, string> => {
        const sources = import.meta.glob('/apps/web/src/components/tasks/*/main/index.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
        return sources
    }

    it('AC10② 三条页面都注册 `kanban-view: KanbanViewAdapter`，且页面内无自写分页逻辑', () => {
        const sources = pageSources()
        for (const [name, path] of Object.entries(PAGES)) {
            const source = sources[path] ?? ''
            expect(source, `${name} 页面源码应可读（${path}）`).not.toBe('')
            expect(source, `${name} 应引用共用适配器 KanbanViewAdapter`).toContain(
                'KanbanViewAdapter'
            )
            expect(
                source,
                `${name} 应把看板视图委托给共用适配器（'kanban-view': KanbanViewAdapter）`
            ).toContain("'kanban-view': KanbanViewAdapter")
            expect(
                source.includes('loadNextPage') || source.includes('loadMore'),
                `${name} 页面内不得自写分页逻辑（R-G：单一实现）`
            ).toBe(false)
        }
    })
})