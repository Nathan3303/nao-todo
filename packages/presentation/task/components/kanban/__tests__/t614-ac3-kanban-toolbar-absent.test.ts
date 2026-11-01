// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import { columnNodes, GROUP_BY_LABELS, makeTask, mountKanban } from './t608-kanban-harness'

/**
 * T614 AC3 —— 原位置（看板内容区顶部那一行）**正向**断言：DOM 中不存在
 *
 * @description PRD `docs/prds/2026-11-01-kanban-group-switch-in-menu.md` AC3：看板视图下
 *              内容区顶部**不存在**分组行，列区上方无空白占位。`T612` 期间这条只能做「负向缺口」
 *              记录（RD 未删 toolbar 时无法写死）；`T613` 删除后此处**写死**为正向断言 ——
 *              任何人把分组行加回看板，本文件即红。
 *
 * 断言口径（都不依赖组件名/内部实现，全部落在真实渲染的 DOM 上）：
 *   1. 分组控件的旧容器（`.kanban-toolbar`）不存在；内容区里也没有分段控件
 *      （`[data-kanban-group-switch]` / `role="group"` / 「按状态」「按优先级」文案）；
 *   2. 列区直接顶到 `nue-main`（`nue-content` 的第一个元素子节点就是列），即**没有**占位行；
 *   3. 两种分组下都成立（state 3 列 / priority 4 列），防止只在某一种分组下漏删。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountAt = (groupBy: 'state' | 'priority') => {
    const harness = mountKanban(
        [
            makeTask({ id: 't-1', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-2', state: 'done', priority: 'urgent' })
        ],
        null,
        { groupBy }
    )
    wrapper = harness.wrapper
    return harness
}

describe('T614 AC3 · 看板内容区顶部不再有分组行（旧位置已移除）', () => {
    it.each(['state', 'priority'] as const)(
        'AC3① groupBy=%s：旧 toolbar 容器 / 分段控件在看板 DOM 中均不存在',
        (groupBy) => {
            const { wrapper: w } = mountAt(groupBy)

            expect(
                w.find('.kanban-toolbar').exists(),
                '看板内不得再有 `.kanban-toolbar`（旧分组行容器）'
            ).toBe(false)
            expect(
                w.find('[data-kanban-group-switch]').exists(),
                '看板内不得再有分组分段控件（控件只在右上角「视图」菜单里）'
            ).toBe(false)
            expect(
                w.find('[role="group"]').exists(),
                '看板内不得再有 `role="group"` 的分段容器'
            ).toBe(false)

            const text = (w.element.textContent ?? '').replace(/\s+/g, '')
            const labels = Object.values(GROUP_BY_LABELS).filter((label) => text.includes(label))
            expect(
                labels,
                `看板内不得出现分段文案「按状态 / 按优先级」；实测命中 = ${JSON.stringify(labels)}`
            ).toEqual([])
        }
    )

    it('AC3② 列区直接顶到 nue-main：nue-content 的第一个元素子节点就是列（无空白占位行）', () => {
        const { wrapper: w } = mountAt('priority')

        const container = w.get('#TodoKanbanContainer').element
        const main = container.querySelector(':scope > .nue-main')
        expect(main, '看板结构应为 #TodoKanbanContainer > .nue-main').not.toBeNull()

        const content = main!.querySelector(':scope > .nue-content')
        expect(content, '看板结构应为 .nue-main > .nue-content').not.toBeNull()

        // 间距/占位口径：列区之上不得再插入任何行（旧实现是 `nue-header.kanban-toolbar`）
        expect(
            main!.children.length,
            `nue-main 直接子元素应只有 nue-content，实测 ${main!.children.length} 个`
        ).toBe(1)
        const firstChild = content!.firstElementChild
        expect(firstChild, 'nue-content 内应渲染列').not.toBeNull()
        expect(
            firstChild!.classList.contains('kanban-column'),
            `nue-content 的第一个元素子节点必须是列（不得是占位行）；实测 class=${firstChild!.className}`
        ).toBe(true)

        // 列数兜底：占位行若被「当成一列」也会在这里暴露
        expect(columnNodes(w).length).toBe(4)
    })
})