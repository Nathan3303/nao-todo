/**
 * 任务清单偏好实体
 * @description 任务清单偏好实体，包含任务清单的偏好属性和方法
 */
export class ProjectPreferenceEntity {
    /**
     * 任务清单偏好实体构造函数
     * @param id 任务清单偏好ID
     * @param userId 用户ID
     * @param projectId 任务清单ID
     * @param viewType 视图类型
     * @param getTasksOptions 获取任务选项
     * @param columns 列配置
     */
    constructor(
        public id: string,
        public userId: string,
        public projectId: string,
        public viewType: string,
        public getTasksOptions: string,
        public columns: string
    ) {}
}
