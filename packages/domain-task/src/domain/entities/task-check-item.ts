import { Entity } from '@nao-todo/shared'

// TaskCheckItemEntity 待办任务检查事项实体
export class TaskCheckItemEntity extends Entity {
    // constructor 待办任务检查事项实体构造函数
    constructor(
        public id: string, // 检查事项 ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public taskId: string, // 所属待办任务 ID
        public name: string, // 检查事项名称
        public isDone: boolean, // 检查事项是否完成
        public sortId: number // 检查事项排序 ID
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }
}