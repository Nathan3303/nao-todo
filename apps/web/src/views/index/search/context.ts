import type { InjectionKey, Ref } from 'vue'
import type { SavedSearch } from '@/components/search/saved-search'

/**
 * 搜索视图上下文
 * @description 承载跨区共享状态与动作：侧栏（teleport 至应用子栏）与主区（结果/筛选）
 *              共享同一份常用搜索/最近搜索实例（单一真源），并由主区引擎提供
 *              「应用关键词 / 应用常用搜索 / 回焦搜索框」跨区回调。
 */
export type SearchViewContext = {
    // 常用搜索（SEA-05）
    savedSearches: Ref<SavedSearch[]>
    removeSavedSearch: (id: SavedSearch['id']) => void
    renameSavedSearch: (id: SavedSearch['id'], name: string) => void
    reorderSavedSearches: (fromIndex: number, toIndex: number) => void

    // 最近搜索（SEA-04 / S6）
    history: Ref<string[]>
    removeHistory: (keyword: string) => void
    clearHistory: () => void

    // 跨区动作（主区引擎持有）
    applyKeyword: (keyword: string) => void
    applySavedSearch: (item: SavedSearch) => void
    focusSearchBox: () => void
}

/** 搜索视图上下文注入键 */
export const SEARCH_VIEW_CONTEXT_KEY: InjectionKey<SearchViewContext> =
    Symbol('SEARCH_VIEW_CONTEXT')