import type { Go } from '@nao-todo/shared'
import dayjs from 'dayjs'
import {
    TASK_DESC_MAX_LENGTH,
    TASK_NAME_MAX_LENGTH,
    TASK_PRIORITIES,
    TASK_REMIND_REPEATS,
    TASK_STATES,
    type TaskPriority,
    type TaskRemindRepeat,
    type TaskState
} from '../constants'
import { TaskErrorCode } from '../errors'

/**
 * 更新任务值对象
 * @description 更新任务的值对象，包含任务的更新字段
 */
export class UpdateTaskValueObject {
    public parentTaskId?: string // 父任务ID
    public name?: string // 任务名称
    public description?: string // 任务描述
    public state?: string // 任务状态
    public priority?: string // 任务优先级
    public startAt?: string | null // 任务开始时间
    public endAt?: string | null // 任务结束时间
    public projectId?: string // 项目ID
    public tags?: string[] // 任务标签
    public givenUpAt?: string | null // 放弃时间
    public remindAt?: string | null // 提醒时间
    public remindRepeat?: string // 提醒重复类型
    public remindTime?: string | null // 提醒时刻
    public remindWeekdays?: number[] // 提醒星期几

    /**s
     * 更新任务值对象构造函数
     * @param id 任务ID
     */
    constructor(public id: string) {}

    /**
     * 验证更新任务值对象
     * @description 验证更新任务值对象的字段是否符合要求
     * @returns 验证结果，如果验证通过则返回null，否则返回错误信息
     */
    validate(): Go<void> {
        if (this.name !== void 0) {
            if (this.name === '') return TaskErrorCode.NAME_EMPTY
            else if (this.name.length > TASK_NAME_MAX_LENGTH) return TaskErrorCode.NAME_TOO_LONG
        }
        if (this.description && this.description.length > TASK_DESC_MAX_LENGTH)
            return TaskErrorCode.DESC_TOO_LONG
        if (this.state && !TASK_STATES.includes(this.state as TaskState))
            return TaskErrorCode.STATE_INVALID
        if (this.priority && !TASK_PRIORITIES.includes(this.priority as TaskPriority))
            return TaskErrorCode.PRIORITY_INVALID
        if (
            this.remindRepeat !== undefined &&
            !TASK_REMIND_REPEATS.includes(this.remindRepeat as TaskRemindRepeat)
        )
            return TaskErrorCode.REMIND_REPEAT_INVALID
        if (
            this.remindTime !== undefined &&
            this.remindTime !== null &&
            !/^\d{2}:\d{2}$/.test(this.remindTime)
        )
            return TaskErrorCode.REMIND_TIME_FORMAT_INVALID
        if (this.remindAt !== undefined && this.remindAt !== null) {
            const remindAt = dayjs(this.remindAt)
            if (!remindAt.isValid()) return TaskErrorCode.REMIND_AT_INVALID
        }
        if (this.endAt !== void 0 && this.endAt !== null) {
            const entAt = dayjs(this.endAt)
            if (!entAt.isValid()) return TaskErrorCode.END_AT_INVALID
            this.endAt = entAt.toISOString()
        }
        if (this.startAt !== void 0 && this.startAt !== null) {
            const startAt = dayjs(this.startAt)
            if (!startAt.isValid()) return TaskErrorCode.START_AT_INVALID
            if (this.endAt && startAt.isAfter(dayjs(this.endAt)))
                return TaskErrorCode.START_AFTER_END
            this.startAt = startAt.toISOString()
        }
        if (this.givenUpAt !== void 0 && this.givenUpAt !== null && this.givenUpAt !== '') {
            const givenUpAt = dayjs(this.givenUpAt)
            if (!givenUpAt.isValid()) return TaskErrorCode.GIVEN_UP_AT_INVALID
            if (this.startAt && givenUpAt.isBefore(dayjs(this.startAt)))
                return TaskErrorCode.GIVEN_UP_BEFORE_START
            this.givenUpAt = givenUpAt.toISOString()
        }
        return null
    }
}