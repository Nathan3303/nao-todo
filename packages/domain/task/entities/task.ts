import { Entity } from '@nao-todo/shared'
import dayjs from 'dayjs'

/**
 * TaskEntity 任务实体
 * @description 任务实体类，用于表示任务的业务逻辑和数据存储。
 */
export class TaskEntity extends Entity {
    // constructor 任务实体构造函数
    constructor(
        public id: string, // 任务ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        // public localId: string, // 本地任务ID
        // public userId: string, // 用户ID
        public parentTaskId: string, // 父任务ID
        public name: string, // 任务名称
        public description: string, // 任务描述
        public state: string, // 任务状态
        public priority: string, // 任务优先级
        public startAt: string, // 任务开始时间
        public endAt: string, // 任务结束时间
        public projectId: string, // 项目ID
        public tags: string[], // 任务标签
        public archivedAt: string | null, // 归档时间
        public starMarkAt: string | null, // 星标时间
        public givenUpAt: string | null, // 放弃时间
        public remindAt: string, // 提醒时间
        public remindRepeat: string, // 提醒重复类型
        public remindTime: string, // 提醒时刻
        public remindWeekdays: number[] // 提醒星期几
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * isGivenUp 是否已放弃
     * @description givenUpAt 为合法日期时视为已放弃
     */
    get isGivenUp(): boolean {
        return dayjs(this.givenUpAt).isValid()
    }

    /**
     * isArchived 是否已归档
     * @description archivedAt 为合法日期时视为已归档
     */
    get isArchived(): boolean {
        return dayjs(this.archivedAt).isValid()
    }

    /**
     * isStarMarked 是否已星标
     * @description starMarkAt 为合法日期时视为已星标
     */
    get isStarMarked(): boolean {
        return dayjs(this.starMarkAt).isValid()
    }
}