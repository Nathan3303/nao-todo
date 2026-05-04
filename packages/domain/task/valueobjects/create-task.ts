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
        public tags: string[]
    ) {}

    /**
     * 验证创建任务值对象
     * @description 验证创建任务值对象的字段是否符合要求
     * @returns 验证结果，如果验证通过则返回null，否则返回错误信息
     */
    validate(): Go<void> {
        // if (!this.userId) return '用户ID不能为空'
        if (!this.name) return '任务名称不能为空'
        if (this.name.length > 128) return '任务名称最多128个字符'
        if (this.description && this.description.length > 256) return '任务描述最多256个字符'
        if (this.state && !['todo', 'in-progress', 'done'].includes(this.state))
            return '任务状态无效'
        if (this.priority && !['low', 'medium', 'high'].includes(this.priority))
            return '任务优先级无效'
        const entAt = dayjs(this.endAt)
        if (!entAt.isValid()) return '任务结束时间无效'
        if (this.startAt) {
            const startAt = dayjs(this.startAt)
            if (!startAt.isValid()) return '任务开始时间无效'
            if (startAt.isAfter(entAt)) return '任务开始时间不能晚于结束时间'
        }
        // if (!this.projectId) return '项目ID不能为空'
        return null
    }

    /**
     * 填充任务开始时间
     * @description 如果任务开始时间为空，则充为当前时间
     */
    fillStartAtThroughEndAt(): Go<void> {
        if (!this.endAt) return '任务结束时间为空, 无法填充开始时间'
        const startAt = dayjs(this.startAt)
        if (startAt.isValid()) {
            console.warn('任务开始时间已存在, 无法填充')
            return null
        }
        this.startAt = dayjs(this.endAt).startOf('D').toISOString()
        return null
    }
}
