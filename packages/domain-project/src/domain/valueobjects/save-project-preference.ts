/**
 * 保存偏好值对象
 * @description 保存偏好值对象，包含项目的偏好设置
 */
export class SaveProjectPreferenceValueObject {
    public viewType?: string // 视图类型
    public getTasksOptions?: string // 获取任务选项
    public columns?: string // 列配置

    // 保存偏好值对象构造函数
    constructor(
        public id: string, // 项目偏好ID
        public projectId: string // 项目ID
    ) {}
}