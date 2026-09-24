import type { TaskViewObject } from '@nao-todo/domain-task'

export type TaskRemindData = {
    remindAt?: string | null
    remindRepeat?: 'none' | 'daily' | 'weekly' | 'monthly'
    remindTime?: string | null
    remindWeekdays?: number[]
}

export type TaskRemindSetterVO = {
    enabled: boolean
    hour: number
    minute: number
    repeatWay: number // 0: 每天 1: 每周 2: 每月
    repeatDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]
}

/**
 * 提醒设置器更新 VO
 * @description 时间字段一律产出具体值：合法值 = 设值，空串 = 清空（服务端同步契约
 *              `nil`/JSON `null` = 缺省不写列、`''` = 清空置 NULL）；
 *              因此不存在用 `null` 表达「本次不触碰」的用法——不触碰即不进更新载荷。
 */
export type TaskRemindSetterUpdateVO = {
    remindAt: string
    remindRepeat: 'none' | 'daily' | 'weekly' | 'monthly'
    remindTime: string
    remindWeekdays: number[]
}

export type TaskRemindSetterProps = {
    task?: TaskViewObject
    remind?: TaskRemindData
    date?: string
}

export type TaskRemindSetterEmits = {
    (e: 'update', vo: TaskRemindSetterUpdateVO): void
}