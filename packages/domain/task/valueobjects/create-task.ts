import type { Go } from '@nao-todo/types'
import dayjs from 'dayjs'

/**
 * 创建任务值对象
 * @description 创建任务值对象，用于创建新任务
 */
export class CreateTaskValueObject {
    /**
     * 创建任务值对象构造函数
     * @param userId 用户ID
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
        public userId: string,
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
        if (!this.name) return '任务名称不能为空'
        if (this.name.length > 128) return '任务名称最多128个字符'
        if (this.description && this.description.length > 256) return '任务描述最多256个字符'
        if (this.state && !['todo', 'in-progress', 'done'].includes(this.state))
            return '任务状态无效'
        if (this.priority && !['low', 'medium', 'high'].includes(this.priority))
            return '任务优先级无效'
        if (
            this.remindRepeat &&
            !['none', 'daily', 'weekly', 'monthly'].includes(this.remindRepeat)
        )
            return '提醒重复类型无效'
        if (this.remindTime && !/^\d{2}:\d{2}$/.test(this.remindTime))
            return '提醒时间格式无效（应为 HH:mm）'
        if (this.remindAt) {
            const remindAt = dayjs(this.remindAt)
            if (!remindAt.isValid()) return '提醒时间无效'
        }
        const entAt = dayjs(this.endAt)
        if (!entAt.isValid()) return '任务结束时间无效'
        if (this.startAt) {
            const startAt = dayjs(this.startAt)
            if (!startAt.isValid()) return '任务开始时间无效'
            if (startAt.isAfter(entAt)) return '任务开始时间不能晚于结束时间'
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

