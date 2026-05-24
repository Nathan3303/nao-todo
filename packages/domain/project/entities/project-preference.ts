/**
 * 任务清单偏好实体
 * @description 任务清单偏好实体，包含任务清单的偏好属性和方法
 */
export class ProjectPreferenceEntity {
    /**
     * 任务清单偏好实体构造函数
     * @param id 任务清单偏好ID
     * @param projectId 任务清单ID
     * @param viewType 视图类型
     * @param getTasksOptions 获取任务选项
     * @param columns 列配置
     * @param createdAt 创建时间
     * @param updatedAt 更新时间
     */
    constructor(
        public id: string,
        public projectId: string,
        public viewType: string,
        public getTasksOptions: string,
        public columns: string,
        public createdAt: string,
        public updatedAt: string
    ) {}
}

