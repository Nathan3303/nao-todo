import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/domain-task'
import type { TaskRemindData } from '../remind-setter/types'

// 任务日期选择器属性
export type TaskDateSelectorProps = {
    colored?: boolean
    startAt?: string | null
    endAt?: string | null
    task?: TaskViewObject
    remind?: TaskRemindData
    refreshKey?: number
}

// 任务日期选择器事件
export type TaskDateSelectorEmits = {
    (e: 'update-all', vo: UpdateTaskViewObject): void
    /** 面板打开那一刻（`DEF-153`）：供调用方冻结日期/提醒字段的编辑基准 */
    (e: 'edit-start'): void
}