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
    public startAt?: string | null // 任务开始时间
    public endAt?: string | null // 任务结束时间
    public projectId?: string // 项目ID
    public tags?: string[] // 任务标签
    public givenUpAt?: string | null // 放弃时间

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
        if (!this.name) return '任务名称不能为空'
        if (this.name.length > 128) return '任务名称长度不能超过128个字符'
        if (this.description && this.description.length > 256)
            return '任务描述长度不能超过256个字符'
        if (this.state && !['todo', 'in-progress', 'done'].includes(this.state))
            return '任务状态无效'
        if (this.priority && !['low', 'medium', 'high'].includes(this.priority))
            return '任务优先级无效'
        if (this.endAt !== void 0 && this.endAt !== null) {
            const entAt = dayjs(this.endAt)
            if (!entAt.isValid()) return '任务结束时间无效'
            this.endAt = entAt.toISOString()
        }
        if (this.startAt !== void 0 && this.startAt !== null) {
            const startAt = dayjs(this.startAt)
            if (!startAt.isValid()) return '任务开始时间无效'
            if (this.endAt && startAt.isAfter(dayjs(this.endAt)))
                return '任务开始时间不能晚于结束时间'
            this.startAt = startAt.toISOString()
        }
        if (this.givenUpAt !== void 0 && this.givenUpAt !== null) {
            const givenUpAt = dayjs(this.givenUpAt)
            if (!givenUpAt.isValid()) return '放弃时间无效'
            if (this.startAt && givenUpAt.isBefore(dayjs(this.startAt)))
                return '放弃时间不能早于任务开始时间'
            this.givenUpAt = givenUpAt.toISOString()
        }
        return null
    }
}

