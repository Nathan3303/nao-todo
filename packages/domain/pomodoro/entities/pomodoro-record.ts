import { Entity } from '@nao-todo/shared'

/**
 * 番茄专注记录实体
 * @description 专注记录的业务实体
 */
export class PomodoroRecordEntity extends Entity {
    // constructor 番茄专注记录实体构造函数
    constructor(
        public id: string, // 记录ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public sessionId: string, // 会话ID
        public pomodoroId: string | null, // 常用番茄专注ID
        public type: number, // 类型
        public taskId: string, // 任务ID
        public taskName: string, // 任务名称
        public description: string, // 描述
        public startAt: string, // 开始时间
        public endAt: string, // 结束时间
        public duration: number, // 专注时间
        public note: string | null // 备注
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }
}

