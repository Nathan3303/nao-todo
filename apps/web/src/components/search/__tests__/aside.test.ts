// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { t } from '@nao-todo/shared'
import { nueUI } from '@/nue-ui-register'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { SEARCH_VIEW_CONTEXT_KEY } from '@/views/index/search/context'
import type { SavedSearch } from '../saved-search'
import { QUICK_SEARCH_PRESETS } from '../quick-search'
import SearchAside from '../aside/aside.vue'

/**
 * SEA-05 / T26：搜索侧栏组件断言
 * @description 侧栏从注入上下文读取状态（单一真源），渲染常用搜索/最近搜索并回抛动作；
 *              移动端隐藏拖拽手柄；teleport 随 isDisplayAside 卸载无残留。
 */

const makeSaved = (id: string, name: string): SavedSearch => ({
    id,
    name,
    query: {
        keyword: '',
        projectIds: [],
        tagIds: [],
        priorities: [],
        states: [],
        includeExcluded: false
    },
    createdAt: '2026-09-21T00:00:00.000Z'
})

let wrapper: VueWrapper | null = null

const mountAside = (
    options: {
        saved?: SavedSearch[]
        history?: string[]
        isDisplayAside?: boolean
        isUseFloatAside?: boolean
    } = {}
) => {
    const savedSearches = ref<SavedSearch[]>(options.saved ?? [])
    const history = ref<string[]>(options.history ?? [])
    const isDisplayAside = ref(options.isDisplayAside ?? true)
    const isUseFloatAside = ref(options.isUseFloatAside ?? false)
    const removeSavedSearch = vi.fn()
    const renameSavedSearch = vi.fn()
    const reorderSavedSearches = vi.fn()
    const removeHistory = vi.fn()
    const clearHistory = vi.fn()
    const applyKeyword = vi.fn()
    const applySavedSearch = vi.fn()
    const focusSearchBox = vi.fn()
    const setControllOption = vi.fn()

    wrapper = mount(SearchAside, {
        attachTo: document.body,
        global: {
            plugins: [nueUI],
            provide: {
                [SEARCH_VIEW_CONTEXT_KEY as symbol]: {
                    savedSearches,
                    removeSavedSearch,
                    renameSavedSearch,
                    reorderSavedSearches,
                    history,
                    removeHistory,
                    clearHistory,
                    applyKeyword,
                    applySavedSearch,
                    focusSearchBox
                },
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    isDisplayAside,
                    isUseFloatAside,
                    setControllOption
                }
            }
        }
    })

    return {
        savedSearches,
        history,
        isDisplayAside,
        isUseFloatAside,
        removeSavedSearch,
        removeHistory,
        clearHistory,
        applyKeyword,
        applySavedSearch,
        focusSearchBox,
        setControllOption
    }
}

const slot = (): HTMLElement => document.querySelector('#SubPageAsideTeleportSlot')!
const textsOf = (selector: string): (string | undefined)[] =>
    [...slot().querySelectorAll(selector)].map((el) => el.textContent?.trim())
const click = async (el: Element | null | undefined) => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
}

beforeEach(() => {
    document.body.innerHTML = '<div id="SubPageAsideTeleportSlot"></div>'
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

describe('SearchAside - 渲染与单一真源', () => {
    it('从注入上下文渲染常用搜索 + 最近搜索，并展开应用子栏', () => {
        const api = mountAside({
            saved: [makeSaved('s1', '甲'), makeSaved('s2', '乙')],
            history: ['关键词']
        })

        expect(api.setControllOption).toHaveBeenCalledWith({ useSlot: true, useDrawerSlot: true })
        expect(textsOf('.search-saved__reuse')).toEqual(['甲', '乙'])
        expect(textsOf('.search-history__reuse')).toEqual(['关键词'])
    })

    it('共享 ref 变化即渲染（单一真源）', async () => {
        const api = mountAside({ saved: [], history: [] })
        expect(slot().querySelectorAll('.search-saved__reuse').length).toBe(0)
        expect(slot().querySelector('.search-saved')!.textContent).toContain(
            t('search.saved.empty')
        )

        api.savedSearches.value = [makeSaved('s1', '新增')]
        api.history.value = ['kw']
        await nextTick()

        expect(textsOf('.search-saved__reuse')).toEqual(['新增'])
        expect(textsOf('.search-history__reuse')).toEqual(['kw'])
    })

    it('两区全空：标题恒显示 + 空态文案（无空白感）', () => {
        mountAside({ saved: [], history: [] })
        const saved = slot().querySelector('.search-saved')!
        const history = slot().querySelector('.search-history')!

        expect(saved.textContent).toContain(t('search.saved.title'))
        expect(saved.textContent).toContain(t('search.saved.empty'))
        expect(saved.textContent).toContain(t('search.saved.emptyHint'))
        expect(history.textContent).toContain(t('search.history.title'))
        expect(history.textContent).toContain(t('search.history.empty'))
        // 无历史 → 不渲染清空按钮
        expect(history.querySelector('.search-history__clear')).toBeNull()
    })
})

describe('SearchAside - 动作回抛', () => {
    it('点常用搜索 ⇒ applySavedSearch + 回焦搜索框', async () => {
        const item = makeSaved('s1', '甲')
        const api = mountAside({ saved: [item] })

        await click(slot().querySelector('.search-saved__reuse'))

        expect(api.applySavedSearch).toHaveBeenCalledWith(item)
        expect(api.focusSearchBox).toHaveBeenCalledTimes(1)
    })

    it('点最近搜索 ⇒ applyKeyword + 回焦搜索框', async () => {
        const api = mountAside({ history: ['关键词'] })

        await click(slot().querySelector('.search-history__reuse'))

        expect(api.applyKeyword).toHaveBeenCalledWith('关键词')
        expect(api.focusSearchBox).toHaveBeenCalledTimes(1)
    })

    it('删除常用搜索 / 移除与清空历史 ⇒ 回抛对应动作', async () => {
        const api = mountAside({ saved: [makeSaved('s1', '甲')], history: ['关键词'] })

        await click(slot().querySelector(`[aria-label="${t('search.saved.remove')}"]`))
        await click(slot().querySelector(`[aria-label="${t('search.history.remove')}"]`))
        await click(slot().querySelector('.search-history__clear'))

        expect(api.removeSavedSearch).toHaveBeenCalledWith('s1')
        expect(api.removeHistory).toHaveBeenCalledWith('关键词')
        expect(api.clearHistory).toHaveBeenCalledTimes(1)
    })
})

describe('SearchAside - 快捷搜索（只读预置）', () => {
    it('渲染 4 项预置，且置顶于常用/最近搜索之前', () => {
        mountAside({ saved: [makeSaved('s1', '甲')], history: ['kw'] })

        const labels = textsOf('.search-quick__item')
        expect(labels).toEqual(QUICK_SEARCH_PRESETS.map((preset) => t(preset.nameKey)))

        const order = [
            ...slot().querySelectorAll('.search-quick, .search-saved, .search-history')
        ].map((el) =>
            ['search-quick', 'search-saved', 'search-history'].find((name) =>
                el.classList.contains(name)
            )
        )
        expect(order).toEqual(['search-quick', 'search-saved', 'search-history'])
    })

    it('点预置项 ⇒ applySavedSearch(条件) + 回焦搜索框', async () => {
        const api = mountAside({})

        await click(slot().querySelectorAll('.search-quick__item')[0])

        expect(api.applySavedSearch).toHaveBeenCalledWith(
            expect.objectContaining({ query: QUICK_SEARCH_PRESETS[0]!.query })
        )
        expect(api.focusSearchBox).toHaveBeenCalledTimes(1)
    })

    it('预置项只读：无重命名/删除/拖拽手柄（每项仅一个复用按钮）', () => {
        mountAside({ saved: [makeSaved('s1', '甲')] })
        const quick = slot().querySelector('.search-quick')!

        expect(quick.querySelectorAll('.search-quick__item').length).toBe(4)
        expect(quick.querySelectorAll('.search-quick__item button').length).toBe(0)
        expect(quick.querySelector('.search-saved__handle')).toBeNull()
        expect(quick.querySelector(`[aria-label="${t('search.saved.rename')}"]`)).toBeNull()
        expect(quick.querySelector(`[aria-label="${t('search.saved.remove')}"]`)).toBeNull()
    })
})

describe('SearchAside - 折叠与无障碍（T27′）', () => {
    it('快捷搜索固定常显，不包在折叠容器内；仅两区入折叠', () => {
        mountAside({ saved: [makeSaved('s1', '甲')], history: ['kw'] })

        expect(slot().querySelector('.search-quick')!.closest('.nue-collapse')).toBeNull()
        expect(slot().querySelectorAll('.nue-collapse-item')).toHaveLength(2)
    })

    it('默认全展开 + 折叠头具备 role/aria-expanded/aria-controls（id 对应）', () => {
        mountAside({ saved: [makeSaved('s1', '甲')], history: ['kw'] })
        const headers = [...slot().querySelectorAll('.search-aside__header')]

        expect(headers).toHaveLength(2)
        for (const header of headers) {
            expect(header.getAttribute('role')).toBe('button')
            expect(header.getAttribute('aria-expanded')).toBe('true')
            const controls = header.getAttribute('aria-controls')!
            expect(controls).not.toBe('')
            expect(slot().querySelector(`#${controls}`)).not.toBeNull()
        }
    })

    it('点折叠头 ⇒ 仅该区折叠（非 accordion）', async () => {
        mountAside({ saved: [makeSaved('s1', '甲')], history: ['kw'] })

        await click(slot().querySelectorAll('.search-aside__header')[0])

        const headers = [...slot().querySelectorAll('.search-aside__header')]
        expect(headers[0]!.getAttribute('aria-expanded')).toBe('false')
        expect(headers[1]!.getAttribute('aria-expanded')).toBe('true')
    })

    it('R3：展开态下新增/删除常用搜索不裁切（DOM 存在性）', async () => {
        const api = mountAside({ saved: [] })
        expect(
            slot().querySelectorAll('.search-aside__header')[0]!.getAttribute('aria-expanded')
        ).toBe('true')

        api.savedSearches.value = [makeSaved('s1', '甲')]
        await nextTick()
        expect(textsOf('.search-saved__reuse')).toEqual(['甲'])

        api.savedSearches.value = []
        await nextTick()
        expect(slot().querySelectorAll('.search-saved__reuse').length).toBe(0)
        expect(slot().querySelector('.search-saved')!.textContent).toContain(
            t('search.saved.empty')
        )
    })
})

describe('SearchAside - 折叠头 UI（T29）', () => {
    it('箭头为 nue-icon（search-aside__chevron），不再依赖库类', () => {
        mountAside({ saved: [makeSaved('s1', '甲')], history: ['kw'] })

        const chevrons = [...slot().querySelectorAll('.search-aside__chevron')]
        expect(chevrons).toHaveLength(2)
        for (const chevron of chevrons) {
            expect(chevron.classList.contains('nue-icon')).toBe(true)
            expect(chevron.classList.contains('nue-collapse-item-state-icon')).toBe(false)
            expect(chevron.getAttribute('aria-hidden')).toBe('true')
        }
    })

    it('最近搜索头部含清除按钮，且位于箭头左侧', () => {
        mountAside({ history: ['kw'] })

        const recentHeader = slot().querySelectorAll('.search-aside__header')[1]!
        const clear = recentHeader.querySelector('.search-history__clear')!
        const chevron = recentHeader.querySelector('.search-aside__chevron')!

        expect(clear).not.toBeNull()
        expect(chevron).not.toBeNull()
        // 文档顺序：clear 在 chevron 之前
        expect(
            clear.compareDocumentPosition(chevron) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })

    it('常用搜索头部无清除按钮', () => {
        mountAside({ saved: [makeSaved('s1', '甲')] })
        const savedHeader = slot().querySelectorAll('.search-aside__header')[0]!
        expect(savedHeader.querySelector('.search-history__clear')).toBeNull()
    })

    it('点头部清除不触发区折叠（stopPropagation）', async () => {
        const api = mountAside({ history: ['kw'] })
        const recentHeader = () => slot().querySelectorAll('.search-aside__header')[1]!
        expect(recentHeader().getAttribute('aria-expanded')).toBe('true')

        await click(recentHeader().querySelector('.search-history__clear'))

        expect(api.clearHistory).toHaveBeenCalledTimes(1)
        expect(recentHeader().getAttribute('aria-expanded')).toBe('true')
    })
})

describe('SearchAside - 响应式与传送', () => {
    it('移动端（浮动侧栏）隐藏拖拽手柄', () => {
        mountAside({ saved: [makeSaved('s1', '甲')], isUseFloatAside: true })
        expect(slot().querySelector('.search-saved__handle')).toBeNull()
        expect(slot().querySelector('.search-saved__reuse')).not.toBeNull()
    })

    it('桌面端渲染拖拽手柄', () => {
        mountAside({ saved: [makeSaved('s1', '甲')] })
        expect(slot().querySelector('.search-saved__handle')).not.toBeNull()
    })

    it('isDisplayAside 关闭 ⇒ teleport 卸载无残留', async () => {
        const api = mountAside({ saved: [makeSaved('s1', '甲')] })
        expect(slot().querySelector('.search-saved')).not.toBeNull()

        api.isDisplayAside.value = false
        await nextTick()
        await nextTick()

        expect(slot().querySelector('.search-saved')).toBeNull()
    })
})