import type { TaskViewObject } from '@nao-todo/usecases/task'

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

export type TaskRemindSetterUpdateVO = {
    remindAt: string | null
    remindRepeat: 'none' | 'daily' | 'weekly' | 'monthly'
    remindTime: string | null
    remindWeekdays: number[]
}

export type TaskRemindSetterProps = {
    task?: TaskViewObject
    date?: string
}

export type TaskRemindSetterEmits = {
    (e: 'update', vo: TaskRemindSetterUpdateVO): void
}


