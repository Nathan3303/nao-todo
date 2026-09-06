import type { Go } from '@nao-todo/shared/types'
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
 * 创建任务值对象
 * @description 创建任务值对象，用于创建新任务
 */
export class CreateTaskValueObject {
    /**
     * 创建任务值对象构造函数
     * @param userId 用户ID
     * @param parentTaskId 父任务ID
     * @param name 任务名称
     * @param description 任务描述
     * @param state 任务状态
     * @param priority 任务优先级
     * @param startAt 任务开始时间
     * @param endAt 任务结束时间
     * @param projectId 项目ID
     * @param tags 任务标签
     * @param remindAt 提醒时间
     * @param remindRepeat 提醒重复类型
     * @param remindTime 提醒时刻
     * @param remindWeekdays 提醒星期几
     */
    constructor(
        public userId: string | null,
        public parentTaskId: string | null,
        public name: string,
        public description: string,
        public state: string,
        public priority: string,
        public startAt: string | null,
        public endAt: string | null,
        public projectId: string,
        public tags: string[],
        public remindAt: string | null,
        public remindRepeat: string,
        public remindTime: string | null,
        public remindWeekdays: number[]
    ) {}

    /**
     * 验证创建任务值对象
     * @description 验证创建任务值对象的字段是否符合要求
     * @returns 验证结果，如果验证通过则返回null，否则返回错误信息
     */
    validate(): Go<void> {
        if (!this.name) return TaskErrorCode.NAME_EMPTY
        if (this.name.length > TASK_NAME_MAX_LENGTH) return TaskErrorCode.NAME_TOO_LONG
        if (this.description && this.description.length > TASK_DESC_MAX_LENGTH)
            return TaskErrorCode.DESC_TOO_LONG
        if (this.state && !TASK_STATES.includes(this.state as TaskState))
            return TaskErrorCode.STATE_INVALID
        if (this.priority && !TASK_PRIORITIES.includes(this.priority as TaskPriority))
            return TaskErrorCode.PRIORITY_INVALID
        if (
            this.remindRepeat &&
            !TASK_REMIND_REPEATS.includes(this.remindRepeat as TaskRemindRepeat)
        )
            return TaskErrorCode.REMIND_REPEAT_INVALID
        if (this.remindTime && !/^\d{2}:\d{2}$/.test(this.remindTime))
            return TaskErrorCode.REMIND_TIME_FORMAT_INVALID
        if (this.remindAt) {
            const remindAt = dayjs(this.remindAt)
            if (!remindAt.isValid()) return TaskErrorCode.REMIND_AT_INVALID
        }
        if (this.endAt) {
            const endAt = dayjs(this.endAt)
            if (!endAt.isValid()) return TaskErrorCode.END_AT_INVALID
        }
        if (this.startAt) {
            const startAt = dayjs(this.startAt)
            if (!startAt.isValid()) return TaskErrorCode.START_AT_INVALID
            if (startAt.isAfter(dayjs(this.endAt))) return TaskErrorCode.START_AFTER_END
        }
        return null
    }

    /**
     * 填充任务开始时间
     * @description 适配原有的结束时间逻辑，处理开始时间
     * - 当任务时间为单个时间时，表示任务的结束（截止）时间，任务的开始时间采用创建时间；
     * - 当任务时间为双时间，则自然地分别为开始和结束时间。
     * - 还需要检测创建时间是否大于用户指定时间，如果是则采取用户指定时间的前一分钟作为开始时间
     */
    fillStartAt() {
        // 如果 已经设置了开始时间 或者 没有结束时间 则不作处理
        if (this.startAt || !this.endAt) return
        // 如果 结束时间 在 现在 之前（设置了一个过期的结束时间）
        // 那么 开始时间 则设置在 结束时间 的前一分钟
        const time = dayjs()
        const endAt = dayjs(this.endAt)
        this.startAt = endAt.isAfter(time)
            ? time.toISOString()
            : endAt.subtract(1, 'm').toISOString()
        // console.log(this.startAt)
    }
}