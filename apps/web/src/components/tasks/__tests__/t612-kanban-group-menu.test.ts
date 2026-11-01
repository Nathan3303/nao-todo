// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { computed, nextTick, ref, type Component, type InjectionKey, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defaultColumns } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import { nueUI } from '@/nue-ui-register'
import BuiltInProjectOperationsDropdown from '../built-in-project/header/operation-dropdown.vue'
import ProjectOperationsDropdown from '../project/header/operation-dropdown.vue'
import TagOperationsDropdown from '../tag/header/operation-dropdown.vue'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '../built-in-project/context'
import { PROJECT_VIEW_CONTEXT_KEY } from '../project/context'
import { TAG_VIEW_CONTEXT_KEY } from '../tag/context'

/**
 * T612 —— 看板「分组切换」搬进右上角「视图」菜单（PRD
 * `docs/prds/2026-11-01-kanban-group-switch-in-menu.md` · ADR
 * `docs/adr/2026-11-01-kanban-group-state-hoisting.md`）
 *
 * 覆盖（三处菜单：内置清单 / 普通清单 / 标签页）：
 *   - AC2 条件渲染：仅看板视图渲染；表格 / 列表视图 **DOM 中不存在**（不是 `v-show` 隐藏）；
 *   - AC1 + R-B 位置：在「视图切换」块内、紧接「看板视图」条目下方；默认高亮「按状态」；
 *   - AC7 + R-A 菜单交互：点分段后弹层**不关闭**，选中态跟随；
 *   - AC6 + R-C 零持久化：`localStorage` / `sessionStorage` 零写入、不发 `UpdatePreference`；
 *   - AC4 三处一致：三处菜单渲染同一形态的分段（同一实现，非三份复制）。
 *
 * 接缝（RD 契约，来自 `T611` 评审 §Q4）：
 *   ① 分段控件的**根元素**带 `data-kanban-group-switch`（用例只认这个标记，不依赖类名 / 组件名）；
 *   ② 分组状态经 `KANBAN_GROUP_BY_KEY` 注入（实现单点
 *      `packages/presentation/task/components/kanban/use-kanban-group.ts`）⇒ 本文件注入同一份 ref，
 *      断言「改的是同一份状态」（R-D 单一来源），而不是各持副本。
 *
 * 状态（`T612` 红基线，2026-11-01 实测）：本文件**全红**（菜单内尚无该控件）。
 */

/**
 * 分组状态注入键的软解析
 * @description RD 第 1 步（状态上提）落地前 `use-kanban-group.ts` **尚不存在** ⇒ 用
 *              `import.meta.glob({ eager: true })` 软解析：命中则用真键，未命中用本地占位键
 *              （占位键下菜单控件尚未实现，不影响红基线成立）。RD 落地后可简化为静态 import。
 */
const KANBAN_GROUP_MODULES = import.meta.glob<{ KANBAN_GROUP_BY_KEY?: symbol }>(
    '/packages/presentation/task/components/kanban/use-kanban-group.ts',
    { eager: true }
)
const KANBAN_GROUP_BY_KEY: symbol =
    Object.values(KANBAN_GROUP_MODULES)[0]?.KANBAN_GROUP_BY_KEY ??
    Symbol('KANBAN_GROUP_BY_KEY_PLACEHOLDER')

type GroupBy = 'state' | 'priority'

type MenuDeps = {
    preference: { value: { viewType: string; columns: typeof defaultColumns } }
    subscriber: { emit: ReturnType<typeof vi.fn> }
}

type MenuDef = {
    label: string
    component: Component
    contextKey: InjectionKey<unknown>
    context: (deps: MenuDeps) => Record<string, unknown>
}

/** 三处菜单（`T611` 评审 §Q3：同一包装件、三处各 1 行） */
const MENUS: MenuDef[] = [
    {
        label: '内置清单',
        component: BuiltInProjectOperationsDropdown,
        contextKey: BUILT_IN_PROJECT_VIEW_CONTEXT_KEY,
        context: ({ preference, subscriber }) => ({
            subscriber,
            preference,
            builtInProjectHandlers: {
                switchCompletedTaskDisplay: vi.fn(),
                updateColumns: vi.fn()
            },
            isHideCompletedAlready: false,
            getColumnLabel: (key: string) => key,
            switchViewTypeToTable: vi.fn(),
            switchViewTypeToKanban: vi.fn(),
            switchViewTypeToList: vi.fn()
        })
    },
    {
        label: '普通清单',
        component: ProjectOperationsDropdown,
        contextKey: PROJECT_VIEW_CONTEXT_KEY,
        context: ({ preference, subscriber }) => ({
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
        })
    },
    {
        label: '标签页',
        component: TagOperationsDropdown,
        contextKey: TAG_VIEW_CONTEXT_KEY,
        context: ({ preference, subscriber }) => ({
            subscriber,
            preference,
            tag: { value: undefined },
            tagUseCase: { delete: vi.fn() },
            tagHandler: {
                switchCompletedTaskDisplay: vi.fn(),
                updateColumns: vi.fn()
            },
            isHideCompletedAlready: false,
            getColumnLabel: (key: string) => key,
            dialogManager: { open: vi.fn() },
            switchViewTypeToTable: vi.fn(),
            switchViewTypeToKanban: vi.fn(),
            switchViewTypeToList: vi.fn()
        })
    }
]

const GROUP_BY_LABELS: Record<GroupBy, string> = {
    state: t('task.kanban.groupByState'),
    priority: t('task.kanban.groupByPriority')
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

/** 弹层是否展开（`nue-dropdown` 容器 `data-visible`；弹层内容常驻 popup-pool，不能以内容有无判定） */
const isMenuOpen = (): boolean =>
    !!document.body.querySelector('.nue-dropdown-wrapper[data-visible="true"]')

/** 全部「分组分段」根元素（RD 契约标记） */
const switchNodes = (): HTMLElement[] => [
    ...document.body.querySelectorAll<HTMLElement>('[data-kanban-group-switch]')
]

const switchNode = (menuLabel: string): HTMLElement => {
    const nodes = switchNodes()
    if (nodes.length !== 1) {
        throw new Error(
            `[缺实现] 「${menuLabel}」菜单内应有且仅有 1 个 [data-kanban-group-switch]，实测 ${nodes.length} 个`
        )
    }
    return nodes[0]!
}

/** 分段里的可点击控件（`button` / `role=tab|radio`），按可见文案定位 */
const segmentButton = (menuLabel: string, groupBy: GroupBy): HTMLElement => {
    const control = [
        ...switchNode(menuLabel).querySelectorAll<HTMLElement>(
            'button, [role="tab"], [role="radio"], [aria-pressed]'
        )
    ].find((el) => (el.textContent ?? '').replace(/\s+/g, '') === GROUP_BY_LABELS[groupBy])
    if (!control) {
        throw new Error(
            `[缺实现] 分段「${GROUP_BY_LABELS[groupBy]}」不是可点击控件；实测 = ${switchNode(menuLabel).innerHTML}`
        )
    }
    return control
}

/** 打开右上角「视图操作」菜单（触发器 = `TaskOperationsDropdown` 默认插槽的 more 按钮） */
const openMenu = async (w: VueWrapper): Promise<void> => {
    const trigger = w.get('.nue-dropdown-wrapper button')
    ;(trigger.element as HTMLElement).click()
    await nextTick()
    await nextTick()
}

const mountMenu = async (
    menu: MenuDef,
    initialViewType: string
): Promise<{
    wrapper: VueWrapper
    /** 视图类型（= 真实现里的 `preference.value.viewType`；用 ref 驱动条件渲染） */
    viewType: Ref<string>
    groupBy: Ref<GroupBy>
    subscriber: MenuDeps['subscriber']
}> => {
    // `preference` 按**真实类型**注入：真实现是 `ComputedRef<… | undefined>`
    // ⇒ 组件里 `preference.viewType`（模板自动解包）与 `preference.value?.viewType` 两种写法均可用
    const viewType = ref(initialViewType)
    const preference = computed(() => ({
        viewType: viewType.value,
        columns: { ...defaultColumns }
    }))
    const subscriber = { emit: vi.fn() }
    const groupBy = ref<GroupBy>('state')

    const w = mount(menu.component, {
        attachTo: document.body,
        global: {
            plugins: [nueUI],
            provide: {
                [menu.contextKey as unknown as string]: menu.context({ preference, subscriber }),
                [KANBAN_GROUP_BY_KEY as unknown as string]: groupBy
            }
        }
    })
    wrapper = w
    await nextTick()
    await openMenu(w)
    return { wrapper: w, viewType, groupBy, subscriber }
}

describe.each(MENUS)('T612 · $label 菜单', (menu) => {
    it('AC2 条件渲染：看板视图 1 个 ⇒ 表格 / 列表 0 个（DOM 不存在，不是 v-show）→ 切回看板重现', async () => {
        const { viewType } = await mountMenu(menu, 'kanban')

        expect(switchNodes(), `「${menu.label}」看板视图下应渲染分组分段`).toHaveLength(1)

        viewType.value = 'table'
        await nextTick()
        expect(
            switchNodes(),
            `「${menu.label}」表格视图下 DOM 中必须不存在该分段（不是 v-show 隐藏）`
        ).toHaveLength(0)

        viewType.value = 'list'
        await nextTick()
        expect(switchNodes(), `「${menu.label}」列表视图下 DOM 中必须不存在该分段`).toHaveLength(0)

        viewType.value = 'kanban'
        await nextTick()
        expect(switchNodes(), `「${menu.label}」切回看板视图后必须重新出现`).toHaveLength(1)
        // 负向断言的前提：菜单确实是打开状态（否则「不存在」可能只是没渲染弹层）
        expect(isMenuOpen(), `「${menu.label}」菜单应保持展开`).toBe(true)
    })

    it('AC1 / R-B 位置：在「视图切换」块内、紧接「看板视图」下方，默认高亮「按状态」', async () => {
        await mountMenu(menu, 'kanban')

        const node = switchNode(menu.label)
        const kanbanItem = document.body.querySelector<HTMLElement>(
            'li[data-executeid="switch-view-to-kanban"]'
        )
        expect(kanbanItem, `「${menu.label}」菜单缺「看板视图」条目`).not.toBeNull()

        const block = kanbanItem!.closest<HTMLElement>('.nue-div--dropdown-div-block')
        expect(block, `「${menu.label}」「看板视图」条目不在分组块内`).not.toBeNull()
        expect(block!.textContent ?? '', '分段必须落在「视图切换」块内').toContain('视图切换')
        expect(
            block!.contains(node),
            `「${menu.label}」分段必须与三条视图条目同属「视图切换」块（R-B）`
        ).toBe(true)

        // 紧接「看板视图」条目正下方（允许一层包裹元素，但必须是其后的第一个元素）
        const next = kanbanItem!.nextElementSibling
        expect(
            next === node || next?.contains(node),
            `「${menu.label}」分段必须紧接「看板视图」条目下方（R-B）`
        ).toBe(true)
        // 仍在「列表视图」之前（不越到块尾）
        const listItem = block!.querySelector('li[data-executeid="switch-view-to-list"]')
        expect(listItem, `「${menu.label}」菜单缺「列表视图」条目`).not.toBeNull()
        expect(
            !!(node.compareDocumentPosition(listItem!) & Node.DOCUMENT_POSITION_FOLLOWING),
            `「${menu.label}」分段必须在「列表视图」之前`
        ).toBe(true)

        // 默认高亮「按状态」（选中态 = `aria-pressed`，不只靠背景色）
        expect(
            segmentButton(menu.label, 'state').getAttribute('aria-pressed'),
            `「${menu.label}」默认应高亮「按状态」`
        ).toBe('true')
        expect(segmentButton(menu.label, 'priority').getAttribute('aria-pressed')).toBe('false')
    })

    it('AC7 / R-A 菜单交互：点「按优先级」后弹层不关闭，选中态与分组状态跟随', async () => {
        const { groupBy } = await mountMenu(menu, 'kanban')

        expect(isMenuOpen(), `「${menu.label}」菜单应已展开`).toBe(true)

        segmentButton(menu.label, 'priority').click()
        await nextTick()

        expect(
            isMenuOpen(),
            `「${menu.label}」点击分段后弹层必须保持展开（R-A：分段是状态控件，不是命令项）`
        ).toBe(true)
        expect(
            segmentButton(menu.label, 'priority').getAttribute('aria-pressed'),
            '切到优先级后「按优先级」应选中'
        ).toBe('true')
        expect(segmentButton(menu.label, 'state').getAttribute('aria-pressed')).toBe('false')
        expect(
            groupBy.value,
            '菜单写入的必须是注入的同一份分组状态（R-D 单一来源，不是各持副本）'
        ).toBe('priority')

        // 切回（防单向接线）
        segmentButton(menu.label, 'state').click()
        await nextTick()
        expect(segmentButton(menu.label, 'state').getAttribute('aria-pressed')).toBe('true')
        expect(groupBy.value).toBe('state')
    })

    it('AC6 / R-C 零持久化：切分组不写 local/sessionStorage，不发 UpdatePreference', async () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
        const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
        const clear = vi.spyOn(Storage.prototype, 'clear')

        const { groupBy, subscriber } = await mountMenu(menu, 'kanban')
        // 只计「切换分组」引起的写入（挂载 / 开菜单期间的噪声不计入）
        setItem.mockClear()
        removeItem.mockClear()
        clear.mockClear()
        subscriber.emit.mockClear()

        segmentButton(menu.label, 'priority').click()
        await nextTick()

        // 正控：切换确实发生（否则「没写」可能是「没切」）
        expect(groupBy.value, '切换未生效 ⇒ 零写入断言不成立').toBe('priority')
        expect(
            {
                setItem: setItem.mock.calls,
                removeItem: removeItem.mock.calls,
                clear: clear.mock.calls
            },
            '分组切换不得写任何偏好存储（R-C：刷新回默认）'
        ).toEqual({ setItem: [], removeItem: [], clear: [] })
        expect(
            subscriber.emit.mock.calls.filter(([event]) => event === 'UpdatePreference'),
            '分组切换不得触发偏好保存（UpdatePreference）'
        ).toEqual([])
    })
})

describe('T612 · AC4 三处菜单一致（同一实现，非三份复制）', () => {
    it('内置清单 / 普通清单 / 标签页三处：分段数量、两段文案、组 aria-label 完全一致', async () => {
        const shapes: unknown[] = []

        for (const menu of MENUS) {
            await mountMenu(menu, 'kanban')
            const node = switchNode(menu.label)
            const group = node.querySelector('[role="group"]')
            expect(
                group,
                `「${menu.label}」分段必须是 SegmentedSwitch 形态（role=group）`
            ).not.toBeNull()
            expect(
                group!.getAttribute('aria-label'),
                `「${menu.label}」分段组 aria-label 应为「${t('task.kanban.groupByLabel')}」`
            ).toBe(t('task.kanban.groupByLabel'))

            shapes.push({
                switches: switchNodes().length,
                labels: [...node.querySelectorAll('button')].map((el) =>
                    (el.textContent ?? '').replace(/\s+/g, '')
                ),
                ariaLabel: group!.getAttribute('aria-label'),
                pressed: [
                    segmentButton(menu.label, 'state').getAttribute('aria-pressed'),
                    segmentButton(menu.label, 'priority').getAttribute('aria-pressed')
                ]
            })

            wrapper?.unmount()
            wrapper = null
            document.body.innerHTML = ''
        }

        expect(shapes[1], '普通清单菜单形态须与内置清单一致').toEqual(shapes[0])
        expect(shapes[2], '标签页菜单形态须与内置清单一致').toEqual(shapes[0])
    })
})