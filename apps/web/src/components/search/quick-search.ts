import type { LocaleKey } from '@nao-todo/shared'
import type { SearchQueryState } from './search-query'

/**
 * 快捷搜索预置（SEA-05 / T27）
 * @description 只读预置分区：仅使用现有 `SearchQueryState`（零模型改动），
 *              当前只覆盖优先级 / 状态两个维度。纯常量，可单测。
 */

export type QuickSearchPreset = {
    /** 稳定标识（渲染 key / 测试用） */
    id: string
    /** 预置名 i18n 键 */
    nameKey: LocaleKey
    /** 图标（nue-ui iconfont 名） */
    icon: string
    /** 查询条件 */
    query: SearchQueryState
}

/** 由部分条件派生完整查询状态（其余维度为空） */
const presetQuery = (overrides: Partial<SearchQueryState>): SearchQueryState => ({
    keyword: '',
    projectIds: [],
    tagIds: [],
    priorities: [],
    states: [],
    includeExcluded: false,
    ...overrides
})

/** 预置快捷搜索（顺序即展示序） */
export const QUICK_SEARCH_PRESETS: QuickSearchPreset[] = [
    {
        id: 'high-priority',
        nameKey: 'search.quick.highPriority',
        icon: 'priority-1',
        query: presetQuery({ priorities: ['high'] })
    },
    {
        id: 'todo',
        nameKey: 'search.quick.todo',
        icon: 'todo',
        query: presetQuery({ states: ['todo'] })
    },
    {
        id: 'in-progress',
        nameKey: 'search.quick.inProgress',
        icon: 'in-progress',
        query: presetQuery({ states: ['in-progress'] })
    },
    {
        id: 'done',
        nameKey: 'search.quick.done',
        icon: 'completed',
        query: presetQuery({ states: ['done'] })
    }
]