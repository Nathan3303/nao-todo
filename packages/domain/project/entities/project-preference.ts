import { Entity } from '../../shares/entity'

/**
 * 任务清单偏好实体
 * @description 任务清单偏好实体，包含任务清单的偏好属性和方法
 */
export class ProjectPreferenceEntity extends Entity {
    // 项目偏好实体构造函数
    constructor(
        public id: string, // 项目偏好ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null,
        public projectId: string, // 项目ID
        public viewType: string, // 视图类型
        public getTasksOptions: string, // 获取任务选项
        public columns: string // 列配置
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }
}

