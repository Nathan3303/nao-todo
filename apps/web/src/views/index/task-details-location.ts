import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 任务详情下钻路由（SEA-04-DEF-01）
 * @description 保留当前路由的 query，避免从 `/search?q=…` 下钻 `/search/<taskId>` 时
 *              搜索深链状态被清空（use-search 的 URL 真源会解析出空状态并回写空 query）；
 *              无 query 的视图（tasks/calendar/pomodoro）保留空 query 即原样。
 *              纯函数、零框架依赖，便于回归单测。
 */
export const taskDetailsLocation = (
    current: Pick<RouteLocationNormalizedLoaded, 'name' | 'query'>,
    taskId: TaskViewObject['id']
): RouteLocationRaw => ({
    name: current.name ?? undefined,
    params: { taskId },
    query: current.query
})