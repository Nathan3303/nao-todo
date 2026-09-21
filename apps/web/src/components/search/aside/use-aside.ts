import { inject, ref } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { SEARCH_VIEW_CONTEXT_KEY } from '@/views/index/search/context'

/** 可折叠区名（快捷搜索固定常显，不入折叠控制） */
export const ASIDE_SECTION_SAVED = 'saved'
export const ASIDE_SECTION_RECENT = 'recent'

/** 折叠内容容器 id（aria-controls 指向） */
export const ASIDE_SAVED_CONTENT_ID = 'search-aside-saved-content'
export const ASIDE_RECENT_CONTENT_ID = 'search-aside-recent-content'

/**
 * 搜索侧栏组合式（T27′）
 * @description 注入搜索视图上下文（单一真源）与首页壳上下文，并承载折叠状态：
 *              默认全展开、不持久化（刷新复位）、非 accordion（多项独立展开）。
 */
const useAside = () => {
    const {
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
    } = inject(SEARCH_VIEW_CONTEXT_KEY)!
    const { isDisplayAside, isUseFloatAside, setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!

    // @state 折叠展开项（默认全展开；不持久化）
    const collapseItemsRecord = ref<string[]>([ASIDE_SECTION_SAVED, ASIDE_SECTION_RECENT])

    return {
        savedSearches,
        removeSavedSearch,
        renameSavedSearch,
        reorderSavedSearches,
        history,
        removeHistory,
        clearHistory,
        applyKeyword,
        applySavedSearch,
        focusSearchBox,
        isDisplayAside,
        isUseFloatAside,
        setControllOption,
        collapseItemsRecord
    }
}

export default useAside