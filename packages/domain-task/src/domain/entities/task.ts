import { Entity, type Go } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { SNOOZE_MAX_MINUTES, SNOOZE_MIN_MINUTES } from '../constants'
import { TaskErrorCode } from '../errors'

/**
 * isGivenUpBy 判定是否已放弃
 * @description 「什么算已放弃」的领域规则唯一来源，供实体与应用层共用
 * @param givenUpAt 放弃时间
 */
export const isGivenUpBy = (givenUpAt: string | null | undefined): boolean => {
    return dayjs(givenUpAt).isValid()
}

/**
 * isStarMarkedBy 判定是否已星标
 * @description 「什么算已星标」的领域规则唯一来源，供实体与应用层共用
 * @param starMarkAt 星标时间
 */
export const isStarMarkedBy = (starMarkAt: string | null | undefined): boolean => {
    return dayjs(starMarkAt).isValid()
}

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
        return isGivenUpBy(this.givenUpAt)
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
        return isStarMarkedBy(this.starMarkAt)
    }

    /**
     * star 收藏任务
     * @description 将 starMarkAt 置为当前时间（ISO 8601）；已删除、已归档的任务不允许收藏
     * @param now 收藏时间，默认当前时间
     * @returns 校验通过返回 null，否则返回领域错误码
     */
    star(now = new Date().toISOString()): Go<void> {
        if (this.isDeleted || this.isArchived) return TaskErrorCode.STAR_MARK_FORBIDDEN
        this.starMarkAt = now
        return null
    }

    /**
     * unstar 取消收藏
     * @description 清除 starMarkAt（后端以空字符串表示清除星标）
     * @returns 校验通过返回 null，否则返回领域错误码
     */
    unstar(): Go<void> {
        if (this.isDeleted || this.isArchived) return TaskErrorCode.STAR_MARK_FORBIDDEN
        this.starMarkAt = ''
        return null
    }

    /**
     * isDone 是否已完成
     */
    get isDone(): boolean {
        return this.state === 'done'
    }

    /**
     * canSnooze 是否可稍后提醒
     * @description 已删除、已归档、已放弃的任务不允许延迟提醒
     */
    get canSnooze(): boolean {
        return !this.isDeleted && !this.isArchived && !this.isGivenUp
    }

    /**
     * validateSnoozeDuration 校验稍后提醒时长
     * @description 领域规则：必须为整数分钟，且落在允许区间内
     * @param durationMinutes 延迟分钟数
     * @returns 校验通过返回 null，否则返回领域错误码
     */
    static validateSnoozeDuration(durationMinutes: number): Go<void> {
        if (!Number.isInteger(durationMinutes)) {
            return TaskErrorCode.SNOOZE_DURATION_NOT_INTEGER
        }
        if (durationMinutes < SNOOZE_MIN_MINUTES || durationMinutes > SNOOZE_MAX_MINUTES) {
            return TaskErrorCode.SNOOZE_DURATION_OUT_OF_RANGE
        }
        return null
    }
}