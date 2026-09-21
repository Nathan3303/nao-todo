import { ref } from 'vue'
import {
    addSavedSearch,
    readSavedSearches,
    removeSavedSearch,
    renameSavedSearch,
    reorderSavedSearches,
    SAVED_SEARCH_MAX,
    type SavedSearch
} from './saved-search'
import type { SearchQueryState } from './search-query'

/** 新增结果（供调用方决定提示口径） */
export type AddSavedSearchResult = 'ok' | 'full' | 'unavailable'

/**
 * 常用搜索组合式（SEA-05）
 * @description 视图侧唯一入口：持有响应式列表，仓储式读写收敛在纯层
 *              （localStorage 容错在 saved-search.ts）。新增/删除/重命名/排序均由本组合式驱动。
 */
export const useSavedSearch = () => {
    const savedSearches = ref<SavedSearch[]>(readSavedSearches())

    /**
     * 新增（已达上限返回 'full'；存储不可用返回 'unavailable'，静默降级）
     */
    const add = (name: string, query: SearchQueryState): AddSavedSearchResult => {
        if (savedSearches.value.length >= SAVED_SEARCH_MAX) return 'full'
        const before = savedSearches.value.length
        const next = addSavedSearch({ name, query })
        savedSearches.value = next
        return next.length > before ? 'ok' : 'unavailable'
    }

    /** 删除单条 */
    const remove = (id: SavedSearch['id']): void => {
        savedSearches.value = removeSavedSearch(id)
    }

    /** 重命名 */
    const rename = (id: SavedSearch['id'], name: string): void => {
        savedSearches.value = renameSavedSearch(id, name)
    }

    /** 拖拽排序（按下标） */
    const reorder = (fromIndex: number, toIndex: number): void => {
        savedSearches.value = reorderSavedSearches(fromIndex, toIndex)
    }

    return { savedSearches, add, remove, rename, reorder }
}