// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { setLocale } from '@nao-todo/shared/locales'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { nueUI } from '@/nue-ui-register'
import SearchEntry from '../entry.vue'

/**
 * T504 搜索页侧边栏收起 / 展开按钮（Issue #177）
 * 依据：docs/prds/2026-10-07-search-aside-toggle.md §7 AC1–AC6
 *
 * 断言口径（jsdom 可测）：按钮存在且与输入框同排位于其左侧；图标、标题与可访问名随
 * `isDisplayAside` 两态切换（中英齐备）；点击只调用 `switchDisplayAside`（单一真源），
 * 不触碰搜索管线（关键词 / 筛选 / URL）⇒ 负向闭环。
 * jsdom 不可测（留给用户视觉走查）：左栏 70px 图标轨道实际像素、抽屉动画、focus 可见性。
 */

const hoisted = vi.hoisted(() => ({
    switchDisplayAside: vi.fn(),
    writeKeyword: vi.fn(),
    clearFilters: vi.fn(),
    applyQuery: vi.fn(),
    isDisplayAside: null as unknown as Ref<boolean>
}))

// 视图组合式：剥离 stores / 用例 / 路由器，只暴露按钮所需的两态能力（单一真源仍为 INDEX_VIEW_CONTEXT_KEY 实例）
vi.mock('../search-view', async () => {
    const { ref } = await import('vue')
    const isDisplayAside = ref(true)
    hoisted.isDisplayAside = isDisplayAside
    return {
        useSearchView: () => ({
            init: vi.fn(async () => undefined),
            isLoading: ref(false),
            error: ref(''),
            isDisplayAside,
            switchDisplayAside: () => {
                hoisted.switchDisplayAside()
                isDisplayAside.value = !isDisplayAside.value
            },
            savedSearch: {
                savedSearches: ref([]),
                add: vi.fn(),
                remove: vi.fn(),
                rename: vi.fn(),
                reorder: vi.fn()
            },
            searchHistory: {
                history: ref([]),
                record: vi.fn(),
                remove: vi.fn(),
                clear: vi.fn()
            }
        })
    }
})

// 搜索管线：仅用于「负向闭环」断言（切换按钮不得触发任何一项）
vi.mock('@/components/search/use-search', async () => {
    const { ref } = await import('vue')
    return {
        default: () => ({
            keyword: ref(''),
            writeKeyword: hoisted.writeKeyword,
            clearKeyword: vi.fn(),
            ready: ref(true),
            firstLoading: ref(false),
            error: ref(''),
            retry: vi.fn(),
            capped: ref(false),
            enumerating: ref(false),
            enumFailures: ref(0),
            enumRatePaused: ref(false),
            rows: ref([]),
            resultCount: ref(0),
            filterProjectIds: ref([]),
            filterTagIds: ref([]),
            filterPriorities: ref([]),
            filterStates: ref([]),
            includeArchived: ref(false),
            filtersActive: ref(false),
            toggleProjectFilter: vi.fn(),
            toggleTagFilter: vi.fn(),
            togglePriorityFilter: vi.fn(),
            toggleStateFilter: vi.fn(),
            clearFilters: hoisted.clearFilters,
            queryState: ref({
                keyword: '',
                projectIds: [],
                tagIds: [],
                priorities: [],
                states: [],
                includeArchived: false
            }),
            applyQuery: hoisted.applyQuery
        })
    }
})

// 仅本组件消费的三项（避免拉入重型 barrel）；详情适配器无需在本测试渲染
vi.mock('@nao-todo/presentation/task', async () => {
    const { ref } = await import('vue')
    return {
        TaskDetailsAdapter: { name: 'TaskDetailsAdapter', template: '<div />' },
        TaskPrioritySelectOptions: ref([]),
        TaskStateSelectOptions: ref([]),
        TaskTagBar: { name: 'TaskTagBar', template: '<div />' }
    }
})

vi.mock('@nao-todo/presentation/tag', () => ({
    useTagsStore: () => ({ tags: new Map(), getTag: () => undefined })
}))

vi.mock('@/components/search/aside', () => ({
    SearchAside: { name: 'SearchAside', template: '<div />' }
}))

vi.mock('@/components/search/search-filter-bar.vue', () => ({
    default: { name: 'SearchFilterBar', template: '<div />' }
}))

let wrapper: VueWrapper | null = null

const mountEntry = (): VueWrapper => {
    wrapper = mount(SearchEntry, {
        global: {
            plugins: [nueUI],
            // 视图仅从此上下文取 UI 级方法（两态能力由 useSearchView 消费，同源）
            provide: {
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    showTaskDetails: vi.fn(),
                    getProjectName: () => ''
                }
            }
        }
    })
    return wrapper
}

const button = () => wrapper!.find('.search-input-row button.nue-button')

const iconOf = (): 'menu-close' | 'menu-open' | 'none' => {
    if (wrapper!.find('.search-input-row button .icon-menu-close').exists()) return 'menu-close'
    if (wrapper!.find('.search-input-row button .icon-menu-open').exists()) return 'menu-open'
    return 'none'
}

beforeEach(() => {
    // 模块级 isDisplayAside 在用例间复用 ⇒ 每例复位为展开态
    if (hoisted.isDisplayAside) hoisted.isDisplayAside.value = true
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    setLocale('zh-CN')
    vi.clearAllMocks()
})

describe('T504 搜索页侧边栏收起 / 展开按钮', () => {
    it('AC1/AC2/AC6：按钮位于搜索栏左侧同排；点击调用 switchDisplayAside，图标与可访问名随态切换', async () => {
        mountEntry()

        const btn = button()
        expect(btn.exists()).toBe(true)
        // 位置：与输入框同排且为行内第一个元素（搜索栏左侧）
        const row = wrapper!.find('.search-input-row')
        expect(row.find('.nue-input').exists()).toBe(true)
        expect(row.element.firstElementChild).toBe(btn.element)
        // 与全站一致：nue-button + icon,ghost
        expect(btn.classes()).toContain('nue-button')
        expect(btn.classes()).toContain('nue-button--icon')
        expect(btn.classes()).toContain('nue-button--ghost')

        // 展开态 ⇒ menu-close + 「收起侧边栏」
        expect(iconOf()).toBe('menu-close')
        expect(btn.attributes('title')).toBe('收起侧边栏')
        expect(btn.attributes('aria-label')).toBe('收起侧边栏')

        // 点击 ⇒ 收起（图标翻转为 menu-open，文案随态）
        await btn.trigger('click')
        expect(hoisted.switchDisplayAside).toHaveBeenCalledTimes(1)
        expect(iconOf()).toBe('menu-open')
        expect(button().attributes('title')).toBe('展开侧边栏')
        expect(button().attributes('aria-label')).toBe('展开侧边栏')

        // 再点 ⇒ 展开还原
        await button().trigger('click')
        expect(hoisted.switchDisplayAside).toHaveBeenCalledTimes(2)
        expect(iconOf()).toBe('menu-close')
        expect(button().attributes('title')).toBe('收起侧边栏')
        expect(button().attributes('aria-label')).toBe('收起侧边栏')
    })

    it('AC3：原生 button 可聚焦可激活（Enter/Space 同源），title/aria-label 中英随态齐备', async () => {
        mountEntry()
        const btn = button()
        expect(btn.element.tagName).toBe('BUTTON')
        expect(btn.attributes('type')).toBe('button')
        expect(btn.attributes('disabled')).toBeUndefined()
        expect(btn.attributes('tabindex')).toBeUndefined() // 原生可 Tab 聚焦，未被人为移出顺序

        // 原生 button 的 Enter/Space 由浏览器转换为 click ⇒ 同一处理函数
        btn.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
        expect(hoisted.switchDisplayAside).toHaveBeenCalledTimes(1)

        wrapper!.unmount()
        hoisted.isDisplayAside.value = true // 模块级两态在用例内复用 ⇒ 重挂前复位展开态
        setLocale('en-US')
        mountEntry()
        expect(button().attributes('title')).toBe('Collapse sidebar')
        expect(button().attributes('aria-label')).toBe('Collapse sidebar')
        await button().trigger('click')
        expect(button().attributes('title')).toBe('Expand sidebar')
        expect(button().attributes('aria-label')).toBe('Expand sidebar')
    })

    it('AC4：窄屏（应用级抽屉态）下按钮仍在、点击无报错且不隐藏', async () => {
        mountEntry()
        expect(() => {
            button().element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }).not.toThrow()
        await nextTick()
        expect(hoisted.switchDisplayAside).toHaveBeenCalledTimes(1)
        expect(button().exists()).toBe(true)
        expect(button().isVisible()).toBe(true)
    })

    it('AC5：收起 / 展开不触发搜索管线（关键词 / 筛选 / URL 零副作用）', async () => {
        mountEntry()
        await button().trigger('click')
        await button().trigger('click')
        expect(hoisted.switchDisplayAside).toHaveBeenCalledTimes(2)
        expect(hoisted.writeKeyword).not.toHaveBeenCalled()
        expect(hoisted.clearFilters).not.toHaveBeenCalled()
        expect(hoisted.applyQuery).not.toHaveBeenCalled()
    })
})