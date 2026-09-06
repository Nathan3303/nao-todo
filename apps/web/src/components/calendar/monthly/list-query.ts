import type { GetTasksOptions } from '@nao-todo/shared'

/**
 * 日历任务列表查询构造（纯函数）
 * @description 服务端筛选契约（后端 arch/go-ddd 已落地）：projectId/tagId 逗号多值，
 *              同参数内 OR、两参数组间 AND；「隐藏已完成」表达为 state=todo,in-progress
 *              （复用后端 state IN 语义，等价排除 done）。
 *              稳定排序（id asc）保证 offset 分页翻页不重不漏。
 */
export type CalendarListFilter = {
    projectIds: string[]
    tagIds: string[]
    hideCompleted: boolean
}

/** 单页条数 / 全量拉取页数上限（上限 1000 条） */
export const PAGE_LIMIT = 100
export const MAX_PAGES = 10

export const buildCalendarListQuery = (
    filter: CalendarListFilter,
    page: number
): GetTasksOptions => {
    const options: GetTasksOptions = {
        isGivenUp: false,
        isDeleted: false,
        isArchived: false,
        sort: { field: 'id', order: 'asc' },
        limit: PAGE_LIMIT,
        page
    }
    if (filter.projectIds.length > 0) options.projectId = filter.projectIds.join(',')
    if (filter.tagIds.length > 0) options.tagId = filter.tagIds.join(',')
    if (filter.hideCompleted) options.state = 'todo,in-progress'
    return options
}