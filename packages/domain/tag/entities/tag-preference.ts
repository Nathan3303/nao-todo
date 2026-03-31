/**
 * 标签偏好实体
 * @description 标签偏好实体类，用于表示标签偏好的属性和操作
 */
export class TagPreferenceEntity {
    /**
     * 标签偏好实体构造函数
     * @param id 标签偏好ID
     * @param userId 用户ID
     * @param tagId 标签ID
     * @param viewType 视图类型
     * @param getTasksOptions 获取任务选项
     * @param columns 列配置
     */
    constructor(
        public id: string,
        public userId: string,
        public tagId: string,
        public viewType: string,
        public getTasksOptions: string,
        public columns: string
    ) {}
}
