import type { GetTasksOptions } from '@nao-todo/shared/constants/task'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { LocaleKey } from '@nao-todo/shared/locales/types'

/**
 * 内建清单默认查询选项
 * @description 对齐 Web 端 built-in/project/default.ts 的默认偏好（defaultBuiltInProjectPreferences），
 *              Lynx 端偏好为内存态，列表页直接按清单 id 取查询选项（纯函数，可单测）。
 */
const BUILTIN_LIST_OPTIONS: Record<string, GetTasksOptions> = {
    all: { limit: 20, isGivenUp: false },
    today: { relativeDate: 'today', limit: 20, isGivenUp: false },
    tomorrow: { relativeDate: 'tomorrow', limit: 20, isGivenUp: false },
    week: { relativeDate: 'week', limit: 20, isGivenUp: false },
    inbox: { projectId: 'inbox', limit: 20, isGivenUp: false },
    favourite: { isStarMarked: true, limit: 20, isGivenUp: false },
    deleted: {
        isDeleted: true,
        sort: { field: 'deletedAt', order: 'desc' },
        limit: 20,
        isGivenUp: false
    },
    overdue: {
        relativeDate: '-today',
        state: 'todo,in-progress',
        sort: { field: 'endAt', order: 'desc' },
        limit: 20,
        isGivenUp: false,
        isDeleted: false
    },
    givenup: { isGivenUp: true, limit: 20, isDeleted: false }
}

/** 内建清单 id 白名单（侧边栏子页链接渲染顺序） */
export const BUILTIN_LIST_IDS = [
    'all',
    'today',
    'tomorrow',
    'week',
    'inbox',
    'favourite',
    'overdue',
    'givenup',
    'deleted'
] as const

/** 未知清单 id 回退到「所有任务」 */
export const getBuiltInListTasksOptions = (builtinId: string): GetTasksOptions => ({
    ...(BUILTIN_LIST_OPTIONS[builtinId] ?? BUILTIN_LIST_OPTIONS.all)
})

/** 项目清单查询选项 */
export const getProjectListTasksOptions = (projectId: string): GetTasksOptions => ({
    projectId,
    limit: 20,
    isGivenUp: false,
    isDeleted: false
})

/** 标签清单查询选项 */
export const getTagListTasksOptions = (tagId: string): GetTasksOptions => ({
    tagId,
    limit: 20,
    isGivenUp: false,
    isDeleted: false
})

// ---------------------------------------------------------------------------
// 前端兜底过滤（双保险：请求仍带参数，渲染前本地二次过滤，幂等）
// ---------------------------------------------------------------------------

/** 当前视图作用域（与 nav-core 的 task-list 参数对齐） */
export type TaskListViewScope = {
    builtinId?: string
    projectId?: string
    tagId?: string
}

/** 按日期的 0 点时间戳 */
const startOfDay = (date: Date): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** 取任务结束时间戳（Web 领域语义：relativeDate 按 endAt 判定） */
const taskEndTime = (task: TaskViewObject): number | null => {
    const end = task.endAt ? new Date(task.endAt).getTime() : null
    return end !== null && !Number.isNaN(end) ? end : null
}

/** 内建清单过滤（本地语义对齐 Web matchRelativeDate：按 endAt） */
const filterByBuiltin = (tasks: TaskViewObject[], builtinId: string): TaskViewObject[] => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const DAY = 24 * 60 * 60 * 1000

    switch (builtinId) {
        case 'today':
            // 今日任务：结束日期在今天及之后（未到期）都算；无截止时间不匹配（对齐 Web 正向条件）
            return tasks.filter((task) => {
                const end = taskEndTime(task)
                return end !== null && end >= todayStart
            })
        case 'tomorrow':
            return tasks.filter((task) => {
                const end = taskEndTime(task)
                return end !== null && end >= todayStart + DAY && end < todayStart + 2 * DAY
            })
        case 'week': {
            // 周起点：周日（与 dayjs isSame(now, 'week') 默认一致）
            const weekStart = todayStart - now.getDay() * DAY
            return tasks.filter((task) => {
                const end = taskEndTime(task)
                return end !== null && end >= weekStart && end < weekStart + 7 * DAY
            })
        }
        case 'overdue':
            // 结束日期早于今日零点且未完成；无截止时间视为保留（对齐 Web 负向条件）
            return tasks.filter((task) => {
                if (task.state === 'done' || task.isDeleted || task.isGivenUp) return false
                const end = taskEndTime(task)
                if (end === null) return true
                return end < todayStart
            })
        case 'inbox':
            return tasks.filter((task) => task.projectId === 'inbox')
        case 'favourite':
            return tasks.filter((task) => task.isStarMarked)
        case 'deleted':
            return tasks.filter((task) => task.isDeleted)
        case 'givenup':
            return tasks.filter((task) => task.isGivenUp)
        case 'all':
        default:
            // 所有任务：排除已删除/已放弃
            return tasks.filter((task) => !task.isDeleted && !task.isGivenUp)
    }
}

/**
 * 按当前视图过滤任务（前端兜底，幂等）
 * @description 请求仍携带后端过滤参数；本函数在渲染前二次过滤，
 *              即使后端忽略某参数也能保证视图内容正确。
 */
export const filterTasksByView = (
    tasks: TaskViewObject[],
    scope: TaskListViewScope
): TaskViewObject[] => {
    if (scope.builtinId !== undefined) return filterByBuiltin(tasks, scope.builtinId)
    if (scope.projectId !== undefined) {
        return tasks.filter((task) => task.projectId === scope.projectId && !task.isDeleted)
    }
    if (scope.tagId !== undefined) {
        return tasks.filter(
            (task) => (task.tags ?? []).includes(scope.tagId ?? '') && !task.isDeleted
        )
    }
    // 无作用域：兜底「今日任务」（与登录默认页一致）
    return filterByBuiltin(tasks, 'today')
}

/**
 * 任务状态 → i18n 键（in-progress 为驼峰键，其余与值一致）
 */
export const taskStateLocaleKey = (state: string): LocaleKey => {
    if (state === 'in-progress') return 'task.state.inProgress'
    return `task.state.${state}` as LocaleKey
}

/**
 * 任务优先级 → i18n 键（键与值一致：high/medium/low/none；统一入口防拼写风险）
 */
export const taskPriorityLocaleKey = (priority: string): LocaleKey => {
    const key = `task.priority.${priority}` as LocaleKey
    // 白名单校验：未知值回退 none（避免渲染出裸键）
    if (priority !== 'high' && priority !== 'medium' && priority !== 'low' && priority !== 'none') {
        return 'task.priority.none'
    }
    return key
}

// ---------------------------------------------------------------------------
// 列表排序 / 筛选（Web 端 filter-dropdown 参数：state / priority / sort）
// ---------------------------------------------------------------------------

/** 排序方向 */
export type SortOrder = 'asc' | 'desc'

/** 排序字段白名单（对齐 Web TaskSortOperator 常用列） */
export type TaskSortField = 'createdAt' | 'updatedAt' | 'endAt' | 'priority'

/** 排序选项 */
export type TaskSortOptions = { field: TaskSortField; order: SortOrder }

/** 优先级权重（高→低），用于 priority 字段排序；未知值权重 0 */
const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 }

const priorityWeight = (priority: string): number => PRIORITY_WEIGHT[priority] ?? 0

/** 取时间戳（非法/空返回 null） */
const timeValue = (iso: string | null | undefined): number | null => {
    if (!iso) return null
    const time = new Date(iso).getTime()
    return Number.isNaN(time) ? null : time
}

/** 比较器：时间字段（空值排末） */
const compareTime = (a: number | null, b: number | null, order: SortOrder): number => {
    if (a === null && b === null) return 0
    if (a === null) return 1
    if (b === null) return -1
    return order === 'asc' ? a - b : b - a
}

/**
 * 排序任务列表（纯函数，前端兜底；请求参数同步携带 sort）
 */
export const getSortedTasks = (
    tasks: TaskViewObject[],
    sort?: TaskSortOptions
): TaskViewObject[] => {
    if (!sort) return tasks
    const { field, order } = sort
    const sorted = [...tasks]
    sorted.sort((a, b) => {
        switch (field) {
            case 'createdAt':
            case 'updatedAt':
            case 'endAt':
                return compareTime(timeValue(a[field]), timeValue(b[field]), order)
            case 'priority':
                return order === 'asc'
                    ? priorityWeight(a.priority) - priorityWeight(b.priority)
                    : priorityWeight(b.priority) - priorityWeight(a.priority)
            default:
                return 0
        }
    })
    return sorted
}

/**
 * 按状态/优先级过滤（「全部」为空串；幂等，请求参数同步携带）
 */
export const filterTasksByStatePriority = (
    tasks: TaskViewObject[],
    state: string,
    priority: string
): TaskViewObject[] =>
    tasks.filter(
        (task) =>
            (state === '' || task.state === state) &&
            (priority === '' || task.priority === priority)
    )

/** 列表排序/筛选合并为请求选项（GetTasksOptions） */
export type TaskListFilters = {
    sort?: TaskSortOptions
    state?: string
    priority?: string
    isHideCompleted?: boolean
}

/**
 * 合并排序/筛选进请求选项（后端同参与过滤；isHideCompleted 映射为 state 排除 done）
 */
export const mergeListOptions = <T extends GetTasksOptions>(
    base: T,
    filters: TaskListFilters
): T => {
    const next = { ...base } as T
    if (filters.sort?.field) next.sort = { field: filters.sort.field, order: filters.sort.order }
    if (filters.state !== undefined && filters.state !== '') next.state = filters.state
    else delete next.state
    if (filters.priority !== undefined && filters.priority !== '') {
        next.priority = filters.priority
    } else {
        delete next.priority
    }
    if (filters.isHideCompleted) {
        // 隐藏已完成：state 排除 done（与 Web isHideCompletedAlready 语义一致）
        const state = next.state
        next.state = state && state !== '' && !state.includes('done') ? state : 'todo,in-progress'
    }
    return next
}