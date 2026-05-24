/**
 * 任务实体
 * @description 任务实体类，用于表示任务的业务逻辑和数据存储。
 */
export class TaskEntity {
    /**
     * 任务实体构造函数
     * @param id 任务ID
     * @param localId 本地任务任务ID
     * @param userId 用户ID
     * @param parentTaskId 父任务ID
     * @param name 任务名称
     * @param description 任务描述
     * @param state 任务状态
     * @param priority 任务优先级
     * @param startAt 任务开始时间
     * @param endAt 任务结束时间
     * @param projectId 项目ID
     * @param tags 任务标签
     * @param createdAt 创建时间
     * @param updatedAt 更新时间
     * @param deletedAt 删除时间
     * @param archivedAt 归档时间
     * @param starMarkAt 星标时间
     * @param givenUpAt 放弃时间
     * @param remindAt 提醒时间
     * @param remindRepeat 提醒重复类型
     * @param remindTime 提醒时刻
     * @param remindWeekdays 提醒星期几
     */
    constructor(
        public id: string,
        public localId: string,
        public userId: string,
        public parentTaskId: string,
        public name: string,
        public description: string,
        public state: string,
        public priority: string,
        public startAt: string,
        public endAt: string,
        public projectId: string,
        public tags: string[],
        public createdAt: string,
        public updatedAt: string,
        public deletedAt: string | null,
        public archivedAt: string | null,
        public starMarkAt: string | null,
        public givenUpAt: string | null,
        public remindAt: string,
        public remindRepeat: string,
        public remindTime: string,
        public remindWeekdays: number[]
    ) {}
}



