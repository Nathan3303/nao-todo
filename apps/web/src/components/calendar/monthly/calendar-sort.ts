import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 日历排序（TASK-08）
 * @description 月/周视图头部排序下拉的纯逻辑：四项排序字段 + 升降序两级；
 *              未选字段（默认）按名称升序（`localeCompare`，**固定 `zh-CN`**）；localStorage 独立键持久化，
 *              与任务列表 getTasksOptions.sort 互不串扰；仅影响日历展示顺序，
 *              不写回服务端、不改 sortId（拖拽改期只改日期，显示始终按当前排序重排）。
 */

/** 排序字段（四项；名称即默认排序，不占字段位） */
export type CalendarSortField = 'priority' | 'startAt' | 'endAt' | 'createdAt'

/** 升降序 */
export type CalendarSortOrder = 'asc' | 'desc'

/** 排序状态：field 缺省 = 默认按名称升序 */
export type CalendarSort = {
    field?: CalendarSortField
    order: CalendarSortOrder
}

/** 本地存储键（独立于任务列表排序；月/周双视图共享同一状态） */
export const CALENDAR_SORT_STORAGE_KEY = 'naotodo.calendar.sort'

/** 选中新字段时的默认升降序 */
export const CALENDAR_SORT_DEFAULT_ORDER: CalendarSortOrder = 'asc'

/** 可注入存储最小接口（便于单测与降级；与 search-history 同款） */
export type CalendarSortStorage = Pick<Storage, 'getItem' | 'setItem'>

const CALENDAR_SORT_FIELDS: readonly CalendarSortField[] = [
    'priority',
    'startAt',
    'endAt',
    'createdAt'
]

/** 优先级权重：low < medium < high（升序=低→高；降序=高→低） */
const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 }

/** 解析存储：显式传入（含 null=不可用）；未传则取全局 localStorage */
const resolveStorage = (storage?: CalendarSortStorage | null): CalendarSortStorage | null => {
    if (storage !== undefined) return storage
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

const isField = (value: unknown): value is CalendarSortField =>
    typeof value === 'string' && (CALENDAR_SORT_FIELDS as readonly string[]).includes(value)

const isOrder = (value: unknown): value is CalendarSortOrder => value === 'asc' || value === 'desc'

/** 读取排序偏好（损坏/非法一律回退默认；异常静默降级） */
export const readCalendarSort = (storage?: CalendarSortStorage | null): CalendarSort => {
    const target = resolveStorage(storage)
    if (!target) return { order: CALENDAR_SORT_DEFAULT_ORDER }
    try {
        const raw = target.getItem(CALENDAR_SORT_STORAGE_KEY)
        if (!raw) return { order: CALENDAR_SORT_DEFAULT_ORDER }
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null) {
            return { order: CALENDAR_SORT_DEFAULT_ORDER }
        }
        const { field, order } = parsed as { field?: unknown; order?: unknown }
        return {
            field: isField(field) ? field : undefined,
            order: isOrder(order) ? order : CALENDAR_SORT_DEFAULT_ORDER
        }
    } catch {
        return { order: CALENDAR_SORT_DEFAULT_ORDER }
    }
}

/** 写入排序偏好（失败静默） */
export const writeCalendarSort = (
    sort: CalendarSort,
    storage?: CalendarSortStorage | null
): void => {
    const target = resolveStorage(storage)
    if (!target) return
    try {
        target.setItem(CALENDAR_SORT_STORAGE_KEY, JSON.stringify(sort))
    } catch {
        /* 存储不可用：静默降级 */
    }
}

/**
 * 名称比较（中文自然序 = 拼音序；同名/空名按 id 稳定兜底）
 * @description **显式指定 `zh-CN`**（DEF-40）：`localeCompare` 不传 locale 时取**运行环境**的 ICU 默认值
 *              （`LC_ALL`/`LANG` ⇒ 拼音序 / 码点序 / 其他），同一份数据的展示顺序会**随环境变化**；
 *              固定口径保证跨平台、跨环境**确定性一致**。
 *              ⛔ 不要改回 `localeCompare(b.name)` / `undefined`（那等于退回跨环境不一致）。
 */
const compareByName = (a: TaskViewObject, b: TaskViewObject): number =>
    a.name.localeCompare(b.name, 'zh-CN') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** 字段取值归一：时间字段缺失/无效 → null（排序居末尾）；优先级 → 权重 */
const fieldValueOf = (task: TaskViewObject, field: CalendarSortField): number | null => {
    if (field === 'priority') return PRIORITY_RANK[task.priority] ?? 0
    const raw = task[field]
    if (!raw) return null
    const time = dayjs(raw)
    return time.isValid() ? time.valueOf() : null
}

/** 主字段比较（缺失/无效值恒排末尾——升降序均如此，与本地仓储排序口径一致） */
const compareByField = (
    a: TaskViewObject,
    b: TaskViewObject,
    field: CalendarSortField,
    dir: 1 | -1
): number => {
    const av = fieldValueOf(a, field)
    const bv = fieldValueOf(b, field)
    if (av === bv) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir
}

/**
 * 排序任务快照（返回新数组；不改原数组、不触达 store/服务端/sortId）
 * @param tasks 原始任务快照
 * @param sort 排序状态（field 缺省 → 默认名称升序）
 */
export const sortCalendarTasks = (
    tasks: TaskViewObject[],
    sort: CalendarSort
): TaskViewObject[] => {
    const field = sort.field
    if (!field) return [...tasks].sort(compareByName)
    const dir: 1 | -1 = sort.order === 'desc' ? -1 : 1
    return [...tasks].sort((a, b) => compareByField(a, b, field, dir) || compareByName(a, b))
}