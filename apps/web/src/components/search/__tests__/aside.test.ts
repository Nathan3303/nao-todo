// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { t } from '@nao-todo/shared'
import { nueUI } from '@/nue-ui-register'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { SEARCH_VIEW_CONTEXT_KEY } from '@/views/index/search/context'
import type { SavedSearch } from '../saved-search'
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
const click = async (el: Element | null) => {
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
        expect(slot().querySelector('.search-saved')).toBeNull()

        api.savedSearches.value = [makeSaved('s1', '新增')]
        api.history.value = ['kw']
        await nextTick()

        expect(textsOf('.search-saved__reuse')).toEqual(['新增'])
        expect(textsOf('.search-history__reuse')).toEqual(['kw'])
    })

    it('两区全空时不渲染空标题', () => {
        mountAside({ saved: [], history: [] })
        expect(slot().querySelector('.search-saved')).toBeNull()
        expect(slot().querySelector('.search-history')).toBeNull()
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