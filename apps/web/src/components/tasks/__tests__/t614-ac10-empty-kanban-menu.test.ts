// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { computed, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defaultColumns } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import { nueUI } from '@/nue-ui-register'
import {
    columnNode,
    columnNodes,
    headerText,
    mountKanban,
    priorityLabel,
    stateLabel
} from '@nao-todo/presentation/task/components/kanban/__tests__/t608-kanban-harness'
import { KANBAN_GROUP_BY_KEY } from '@nao-todo/presentation/task/components/kanban/use-kanban-group'
import ProjectOperationsDropdown from '../project/header/operation-dropdown.vue'
import { PROJECT_VIEW_CONTEXT_KEY } from '../project/context'

/**
 * T614 AC10 —— 空看板（0 任务）下菜单侧分组切换可用
 *
 * @description PRD AC10：`Given` 0 任务空看板，`When` 在菜单内切分组，`Then` 列头与空态正常、
 *              分组可切、无写入、无错误提示。`T612` 只锁了「菜单里有分段」，未锁 0 任务这一边界
 *              （`kanban-column.vue` 在 `columnTasks.length === 0` 时走 `nue-empty` 分支）⇒ 本文件补上。
 *
 * 断言口径（跨组件单一来源）：
 *   ① 菜单里两个分段都在、默认「按状态」选中；空看板渲染 3 个状态空列 + 每列空态文案；
 *   ② 点「按优先级」⇒ **同一份注入状态**驱动空看板变 4 个优先级空列（列头是优先级标签，不是状态名），
 *      菜单保持展开（R-A）；
 *   ③ 切回「按状态」⇒ 恢复 3 列（防单向接线）；
 *   ④ 全程无 Storage 写入（R-C）—— 空看板不改变「不持久化」口径。
 */

const GROUP_BY_LABELS = {
    state: t('task.kanban.groupByState'),
    priority: t('task.kanban.groupByPriority')
} as const

let menus: VueWrapper[] = []
let kanban: VueWrapper | null = null

afterEach(() => {
    menus.forEach((w) => w.unmount())
    menus = []
    kanban?.unmount()
    kanban = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const isMenuOpen = (): boolean =>
    !!document.body.querySelector('.nue-dropdown-wrapper[data-visible="true"]')

const switchNode = (): HTMLElement => {
    const nodes = [...document.body.querySelectorAll<HTMLElement>('[data-kanban-group-switch]')]
    expect(nodes, '空看板下菜单里也应有且仅有 1 个分组分段').toHaveLength(1)
    return nodes[0]!
}

const segmentButton = (groupBy: keyof typeof GROUP_BY_LABELS): HTMLElement => {
    const control = [
        ...switchNode().querySelectorAll<HTMLElement>(
            'button, [role="tab"], [role="radio"], [aria-pressed]'
        )
    ].find((el) => (el.textContent ?? '').replace(/\s+/g, '') === GROUP_BY_LABELS[groupBy])
    if (!control) {
        throw new Error(
            `[缺实现] 分段「${GROUP_BY_LABELS[groupBy]}」不是可点击控件；实测 = ${switchNode().innerHTML}`
        )
    }
    return control
}

/**
 * 挂载「空看板 + 右上角菜单」，两者共享**同一份**分组状态（= 真实页面的 provide 形态）
 */
const mountEmptyKanbanWithMenu = async () => {
    // 0 任务：列内走 `nue-empty` 分支
    const harness = mountKanban([])
    kanban = harness.wrapper

    const viewType = ref('kanban')
    const preference = computed(() => ({
        viewType: viewType.value,
        columns: { ...defaultColumns }
    }))
    const subscriber = { emit: vi.fn() }

    const menu = mount(ProjectOperationsDropdown, {
        attachTo: document.body,
        global: {
            plugins: [nueUI],
            provide: {
                [PROJECT_VIEW_CONTEXT_KEY as unknown as string]: {
                    subscriber,
                    preference,
                    project: { value: undefined },
                    projectUseCase: { delete: vi.fn(), archive: vi.fn() },
                    taskUseCase: { update: vi.fn() },
                    projectHandler: {
                        switchCompletedTaskDisplay: vi.fn(),
                        updateColumns: vi.fn()
                    },
                    isHideCompletedAlready: false,
                    getColumnLabel: (key: string) => key,
                    dialogManager: { open: vi.fn() },
                    switchViewTypeToTable: vi.fn(),
                    switchViewTypeToKanban: vi.fn(),
                    switchViewTypeToList: vi.fn()
                },
                // 与看板同一份 ref ⇒ 菜单写入即看板可见（R-D 单一来源）
                [KANBAN_GROUP_BY_KEY as unknown as string]: harness.groupBy
            }
        }
    })
    menus.push(menu)

    await nextTick()
    ;(menu.get('.nue-dropdown-wrapper button').element as HTMLElement).click()
    await nextTick()
    await nextTick()

    return { harness, menu, groupBy: harness.groupBy }
}

/** 每列的空态文案（`kanban-column.vue`：`columnTasks.length === 0` ⇒ `nue-empty`） */
const emptyTextsOf = (): string[] =>
    columnNodes(kanban!).map((node) =>
        (node.element.querySelector('.nue-empty')?.textContent ?? '').replace(/\s+/g, '')
    )

describe('T614 AC10 · 空看板（0 任务）下菜单分组切换', () => {
    it('AC10① 空看板：菜单分段存在、默认「按状态」，3 个状态空列各显示空态', async () => {
        await mountEmptyKanbanWithMenu()

        expect(isMenuOpen(), '菜单应已展开').toBe(true)
        expect(segmentButton('state').getAttribute('aria-pressed')).toBe('true')
        expect(segmentButton('priority').getAttribute('aria-pressed')).toBe('false')

        expect(
            columnNodes(kanban!).map((n) => n.attributes('data-category')),
            '0 任务下仍应渲染状态三列'
        ).toEqual(['todo', 'in-progress', 'done'])

        const headers = columnNodes(kanban!).map(headerText)
        for (const state of ['todo', 'in-progress', 'done'] as const) {
            expect(
                headers.some((text) => text.includes(stateLabel(state))),
                `列头应为状态名「${stateLabel(state)}」；实测 = ${JSON.stringify(headers)}`
            ).toBe(true)
        }
        expect(
            emptyTextsOf(),
            `四个/三个空列都应有空态文案，实测 = ${JSON.stringify(emptyTextsOf())}`
        ).toEqual(['无待办任务', '无待办任务', '无待办任务'])
    })

    it('AC10② 空看板点「按优先级」⇒ 变 4 个优先级空列、菜单不关闭、无错误提示', async () => {
        const { groupBy } = await mountEmptyKanbanWithMenu()

        segmentButton('priority').click()
        await nextTick()
        await nextTick()

        expect(groupBy.value, '菜单应写入共享分组状态').toBe('priority')
        expect(
            isMenuOpen(),
            '空看板下点分段同样不得关闭菜单（R-A：分段是状态控件，不是命令项）'
        ).toBe(true)

        expect(
            columnNodes(kanban!).map((n) => n.attributes('data-category')),
            '空看板切到优先级后应渲染优先级四列（紧急→低）'
        ).toEqual(['urgent', 'high', 'medium', 'low'])

        const headers = columnNodes(kanban!).map(headerText)
        for (const priority of ['urgent', 'high', 'medium', 'low']) {
            expect(
                headers.some((text) => text.includes(priorityLabel(priority))),
                `列头应为优先级标签「${priorityLabel(priority)}」；实测 = ${JSON.stringify(headers)}`
            ).toBe(true)
        }
        // 语义正确性：优先级列头不得出现状态名（防「列头仍按 state 渲染」）
        for (const state of ['todo', 'in-progress', 'done'] as const) {
            expect(
                headers.some((text) => text.includes(stateLabel(state))),
                `优先级分组下列头不得含状态名「${stateLabel(state)}」；实测 = ${JSON.stringify(headers)}`
            ).toBe(false)
        }
        expect(
            emptyTextsOf(),
            `四个优先级空列都应有空态文案，实测 = ${JSON.stringify(emptyTextsOf())}`
        ).toEqual(['无待办任务', '无待办任务', '无待办任务', '无待办任务'])

        // 无错误提示（空看板不得把「0 任务」误报成错误）
        expect(
            kanban!.findAll('.nue-empty').some((n) => /错误|失败|加载失败/.test(n.text())),
            '空看板不应出现错误态文案'
        ).toBe(false)

        // 切回（防单向接线）
        segmentButton('state').click()
        await nextTick()
        expect(groupBy.value).toBe('state')
        expect(columnNodes(kanban!).map((n) => n.attributes('data-category'))).toEqual([
            'todo',
            'in-progress',
            'done'
        ])
        expect(columnNode(kanban!, 'done')).toBeTruthy()
    })

    it('AC10③ 空看板切换分组：Storage 零写入（R-C 不持久化口径不变）', async () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
        const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
        const clear = vi.spyOn(Storage.prototype, 'clear')

        const { groupBy } = await mountEmptyKanbanWithMenu()
        setItem.mockClear()
        removeItem.mockClear()
        clear.mockClear()

        segmentButton('priority').click()
        await nextTick()

        expect(groupBy.value, '切换未生效 ⇒ 零写入断言不成立').toBe('priority')
        expect(
            {
                setItem: setItem.mock.calls,
                removeItem: removeItem.mock.calls,
                clear: clear.mock.calls
            },
            '空看板下切分组同样不得写任何偏好存储（R-C）'
        ).toEqual({ setItem: [], removeItem: [], clear: [] })
    })
})