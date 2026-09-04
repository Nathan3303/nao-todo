import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 任务筛选谓词纯函数
 * @description 侧边栏复选框 / 头部范围菜单 / 隐藏已完成 共用的过滤规则：
 *              组内 OR（选中多个清单或标签命中其一即可）、组间 AND、hideCompleted 排除 done。
 */
export type TaskCalendarFilter = {
    projectIds: string[]
    tagIds: string[]
    hideCompleted: boolean
}

export const matchTaskFilter = (task: TaskViewObject, filter: TaskCalendarFilter): boolean => {
    // 隐藏已完成（等价任务页 state = todo,in-progress 语义）
    if (filter.hideCompleted && task.state === 'done') return false
    // 清单：未勾选任何清单时不限制；否则任务必须属于其中一个清单
    if (filter.projectIds.length > 0 && !filter.projectIds.includes(task.projectId ?? '')) {
        return false
    }
    // 标签：未勾选任何标签时不限制；否则任务必须命中其中一个标签
    if (filter.tagIds.length > 0 && !filter.tagIds.some((id) => task.tags.includes(id))) {
        return false
    }
    return true
}