import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/domain-task'

// 任务日期选择器属性
export type TaskDateSelectorProps = {
    colored?: boolean
    startAt?: string | null
    endAt?: string | null
    task?: TaskViewObject
    refreshKey?: number
}

// 任务日期选择器事件
export type TaskDateSelectorEmits = {
    (e: 'update-all', vo: UpdateTaskViewObject): void
}