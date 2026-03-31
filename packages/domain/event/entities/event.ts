/**
 * 检查事项实体
 * @description 检查事项实体，包含检查事项的 ID、任务 ID、名称、描述、是否完成和排序 ID
 */
export class EventEntity {
    /**
     * 检查事项实体构造函数
     * @param id 检查事项 ID
     * @param taskId 任务 ID
     * @param name 检查事项名称
     * @param isDone 是否完成
     * @param sortId 排序 ID
     */
    constructor(
        public id: string,
        public taskId: string,
        public name: string,
        public isDone: boolean,
        public sortId: number
    ) {}
}
