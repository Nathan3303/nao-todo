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
    /**
     * 只读（`T795`）：已归档任务等只读场景禁用日期/提醒编辑入口
     * @description 触发器按钮原生 `disabled` ⇒ 下拉打不开、`edit-start` / `update-all` 都不会发生
     * @default false
     */
    disabled?: boolean
}

// 任务日期选择器事件
export type TaskDateSelectorEmits = {
    (e: 'update-all', vo: UpdateTaskViewObject): void
    /** 面板打开那一刻（`DEF-153`）：供调用方冻结日期/提醒字段的编辑基准 */
    (e: 'edit-start'): void
}