import { Entity } from '@nao-todo/shared'

/**
 * 番茄专注常用专注实体
 */
export class PomodoroEntity extends Entity {
    // 番茄专注常用专注实体构造函数
    constructor(
        public id: string, // ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public type: number, // 类型
        public name: string, // 名称
        public description: string | null, // 描述
        public duration: number, // 专注时间
        public archivedAt: string | null, // 归档时间
        public totalDuration: number // 总专注时间
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }
}
