import type { Go } from '@nao-todo/types'
import dayjs from 'dayjs'

/**
 * 更新任务值对象
 * @description 更新任务的值对象，包含任务的更新字段
 */
export class UpdateTaskValueObject {
    public name?: string // 任务名称
    public description?: string // 任务描述
    public state?: string // 任务状态
    public priority?: string // 任务优先级
    public startAt?: string // 任务开始时间
    public endAt?: string // 任务结束时间
    public projectId?: string // 项目ID
    public tags?: string[] // 任务标签

    /**
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
        if (!this.name) return '任务名称不能为空'
        if (this.name.length > 256) return '任务名称长度不能超过256个字符'
        if (this.description && this.description.length > 256)
            return '任务描述长度不能超过256个字符'
        if (this.state && !['todo', 'in-progress', 'done'].includes(this.state))
            return '任务状态无效'
        if (this.priority && !['low', 'medium', 'high'].includes(this.priority))
            return '任务优先级无效'
        if (this.endAt) {
            const entAt = dayjs(this.endAt)
            if (!entAt.isValid()) return '任务结束时间无效'
        }
        if (this.startAt) {
            const startAt = dayjs(this.startAt)
            if (!startAt.isValid()) return '任务开始时间无效'
            if (startAt.isAfter(dayjs(this.endAt))) return '任务开始时间不能晚于结束时间'
        }
        return null
    }
}

