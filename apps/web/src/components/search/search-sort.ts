/**
 * 搜索排序 / 截止日区间的状态原语（T770）
 * @description 零框架、无副作用：只放「类型 + 默认值 + 白名单守卫 + 日期键工具」，
 *              供 URL 编解码（search-query）、常用搜索归一（saved-search）与纯函数层
 *              （search-tasks）共用，避免三处各写一份白名单/默认方向。
 */

/** 排序字段（相关性默认，无方向；其余四项支持升/降） */
export type SearchSortField = 'relevance' | 'updatedAt' | 'dueAt' | 'priority' | 'name'

/** 升降序 */
export type SearchSortOrder = 'asc' | 'desc'

/** 排序状态 */
export type SearchSort = { field: SearchSortField; order: SearchSortOrder }

/** 排序字段清单（下拉展示序；也是 URL / 存储白名单） */
export const SEARCH_SORT_FIELDS: readonly SearchSortField[] = [
    'relevance',
    'updatedAt',
    'dueAt',
    'priority',
    'name'
]

/** 默认排序（相关性） */
export const DEFAULT_SEARCH_SORT: SearchSort = { field: 'relevance', order: 'desc' }

/**
 * 各字段默认方向
 * @description 用户切到某字段时的初值：更新时间「最近更新在前」、截止日「最快到期在前」、
 *              优先级「紧急在前」、名称 A→Z；相关性无方向（恒取 desc 占位，UI 不呈现）。
 */
export const SEARCH_SORT_DEFAULT_ORDER: Record<SearchSortField, SearchSortOrder> = {
    relevance: 'desc',
    updatedAt: 'desc',
    dueAt: 'asc',
    priority: 'desc',
    name: 'asc'
}

/** 字段默认方向 */
export const defaultOrderOf = (field: SearchSortField): SearchSortOrder =>
    SEARCH_SORT_DEFAULT_ORDER[field]

/** 是否合法排序字段（URL / 存储白名单，非法值一律忽略） */
export const isSearchSortField = (value: unknown): value is SearchSortField =>
    typeof value === 'string' && (SEARCH_SORT_FIELDS as readonly string[]).includes(value)

/** 是否合法升降序 */
export const isSearchSortOrder = (value: unknown): value is SearchSortOrder =>
    value === 'asc' || value === 'desc'

/** 排序等价（缺省 = 默认排序；用于 URL 对账与保存搜索复现） */
export const searchSortEquals = (a?: SearchSort | null, b?: SearchSort | null): boolean => {
    const left = a ?? DEFAULT_SEARCH_SORT
    const right = b ?? DEFAULT_SEARCH_SORT
    return left.field === right.field && left.order === right.order
}

/** 是否非默认排序（默认排序在 URL / 存储中省略，保持旧格式干净） */
export const isCustomSort = (sort?: SearchSort | null): boolean =>
    !!sort && !searchSortEquals(sort, DEFAULT_SEARCH_SORT)

/** 截止日区间（`YYYY-MM-DD` 日粒度闭区间；`''` = 该侧不限） */
export type SearchDueRange = { from: string; to: string }

/** 空区间（默认关闭） */
export const EMPTY_DUE_RANGE: SearchDueRange = { from: '', to: '' }

/** 区间是否生效（单边也算） */
export const isDueRangeActive = (range?: SearchDueRange | null): boolean =>
    !!range && (range.from !== '' || range.to !== '')

/** 日期键（`YYYY-MM-DD`）白名单 */
export const isDateKey = (value: unknown): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** 日期键归一（非法/空 → `''`） */
export const normalizeDateKey = (value: unknown): string => (isDateKey(value) ? value : '')

const pad2 = (value: number): string => (value < 10 ? `0${value}` : String(value))

/**
 * ISO 时间 → 本地日期键（`YYYY-MM-DD`）
 * @description 与日历视图同口径（`dayjs(x).format('YYYY-MM-DD')`，即**本地自然日**）：
 *              用原生 Date 本地取值实现，避免在 5 万条排序/筛选热路径上逐条走 dayjs。
 *              空值/非法值 → `''`（= 无截止日）。
 */
export const dateKeyOfIso = (iso: string | null | undefined): string => {
    if (!iso) return ''
    const date = new Date(iso)
    const time = date.getTime()
    if (Number.isNaN(time)) return ''
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** ISO 时间 → 本地日期键（NueDatePicker 输出 → 状态存值；空/非法 → `''`） */
export const dueRangeValueOfIso = (value: string | null | undefined): string => dateKeyOfIso(value)