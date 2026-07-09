import { Entity } from '../../shares/entity'

/**
 * 标签偏好实体
 * @description 标签偏好实体类，用于表示标签偏好的属性和操作
 */
export class TagPreferenceEntity extends Entity {
    // 标签偏好实体构造函数
    constructor(
        public id: string, // 标签偏好ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        // public userId: string, // 用户ID
        public tagId: string, // 标签ID
        public viewType: string, // 视图类型
        public getTasksOptions: string, // 获取任务选项
        public columns: string // 列配置
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }
}

