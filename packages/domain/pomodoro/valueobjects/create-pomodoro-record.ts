import type { Go } from '@nao-todo/types'

/**
 * 创建 Pomodoro 记录值对象
 * @description 用于创建新 Pomodoro 记录，包含字段验证
 */
export class CreatePomodoroRecordValueObject {
    constructor(
        public sessionId: string,
        public type: number,
        public taskId: string | null,
        public taskName: string | null,
        public description: string | null,
        public startAt: string,
        public endAt: string,
        public duration: number,
        public note: string | null
    ) {}

    /**
     * 验证创建 Pomodoro 记录值对象
     * @returns 验证结果，通过返回 null，否则返回错误信息
     */
    validate(): Go<void> {
        if (!this.sessionId) return '会话ID不能为空'
        if (this.type !== 0 && this.type !== 1) return '专注类型无效'
        // if (!this.taskId) return '任务ID不能为空'
        // if (!this.taskName) return '任务名称不能为空'
        if (!this.startAt) return '开始时间不能为空'
        if (!this.endAt) return '结束时间不能为空'
        if (this.duration <= 0) return '专注时长必须大于0'
        return null
    }
}

