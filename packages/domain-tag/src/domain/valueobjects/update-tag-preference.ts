/**
 * 更新标签偏好值对象
 * @description 更新标签偏好值对象，用于定义更新标签偏好相关的业务逻辑和数据操作
 */
export class UpdateTagPreferenceValueObject {
    public viewType?: string // 视图类型
    public getTasksOptions?: string // 获取任务选项
    public columns?: string // 列配置

    // constructor 更新标签偏好值对象构造函数
    constructor(
        public id: string, // 标签偏好ID
        public tagId: string // 标签ID
    ) {}
}